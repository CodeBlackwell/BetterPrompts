"""
Effectiveness tracking service for prompt engineering techniques.

This service handles the collection, storage, and analysis of effectiveness metrics
for various prompt engineering techniques.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import statistics

import structlog
from sqlalchemy import create_engine, and_, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
import redis
from pydantic import ValidationError

from ..models.effectiveness import (
    TechniqueEffectivenessRecord,
    UserFeedback,
    AggregatedMetrics,
    EffectivenessMetricsRequest,
    EffectivenessMetricsResponse,
    TechniquePerformanceMetrics,
    EffectivenessTrackingConfig,
    MetricsCollectionContext,
    MetricType,
    FeedbackType
)
from ..config import settings

logger = structlog.get_logger()


class EffectivenessTracker:
    """Service for tracking and analyzing technique effectiveness"""
    
    def __init__(self, config: Optional[EffectivenessTrackingConfig] = None):
        """Initialize the effectiveness tracker"""
        self.config = config or EffectivenessTrackingConfig()
        
        # Database setup
        self.engine = create_engine(
            settings.DATABASE_URL,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True
        )
        self.SessionLocal = sessionmaker(bind=self.engine)
        
        # Redis setup for caching and queuing
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        
        # Metrics queue for async processing
        self.metrics_queue = asyncio.Queue()
        self._processing_task = None
        
        logger.info("EffectivenessTracker initialized", config=self.config.dict())
    
    async def start(self):
        """Start the effectiveness tracker background tasks"""
        if self.config.async_processing:
            self._processing_task = asyncio.create_task(self._process_metrics_queue())
            logger.info("Started metrics processing task")
    
    async def stop(self):
        """Stop the effectiveness tracker background tasks"""
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped metrics processing task")
    
    async def track_application(self, context: MetricsCollectionContext) -> str:
        """Track a technique application"""
        try:
            # Check sampling rate
            if self.config.sample_rate < 1.0:
                import random
                if random.random() > self.config.sample_rate:
                    return ""
            
            # Calculate metrics
            application_time_ms = (context.end_time - context.start_time).total_seconds() * 1000
            token_increase_ratio = context.tokens_after / max(context.tokens_before, 1)
            
            # Create effectiveness record
            record = TechniqueEffectivenessRecord(
                id=str(uuid.uuid4()),
                technique_id=context.technique_id,
                session_id=context.session_id,
                user_id=context.user_id,
                timestamp=context.timestamp,
                application_time_ms=application_time_ms,
                tokens_before=context.tokens_before,
                tokens_after=context.tokens_after,
                token_increase_ratio=token_increase_ratio,
                intent_type=context.intent_type,
                complexity_level=context.complexity_level,
                domain=context.domain,
                target_model=context.target_model,
                success=context.success,
                error_message=context.error_message,
                retry_count=context.retry_count,
                metadata=context.metadata
            )
            
            if self.config.async_processing:
                # Queue for async processing
                await self.metrics_queue.put(record)
            else:
                # Process synchronously
                self._save_record(record)
            
            # Cache recent metrics for quick access
            self._cache_recent_metrics(record)
            
            # Check for alerts
            await self._check_alerts(context.technique_id)
            
            return record.id
            
        except Exception as e:
            logger.error("Error tracking application", error=str(e), context=context.dict())
            return ""
    
    def _save_record(self, record: TechniqueEffectivenessRecord):
        """Save effectiveness record to database"""
        try:
            with self.SessionLocal() as session:
                session.add(record)
                session.commit()
        except SQLAlchemyError as e:
            logger.error("Database error saving record", error=str(e), record_id=record.id)
            raise
    
    def _cache_recent_metrics(self, record: TechniqueEffectivenessRecord):
        """Cache recent metrics in Redis for quick access"""
        try:
            # Cache key format: metrics:technique:{technique_id}:recent
            cache_key = f"metrics:technique:{record.technique_id}:recent"
            
            # Store as sorted set with timestamp as score
            self.redis_client.zadd(
                cache_key,
                {json.dumps({
                    "id": record.id,
                    "time_ms": record.application_time_ms,
                    "token_ratio": record.token_increase_ratio,
                    "success": record.success,
                    "timestamp": record.timestamp.isoformat()
                }): record.timestamp.timestamp()}
            )
            
            # Keep only last 1000 entries
            self.redis_client.zremrangebyrank(cache_key, 0, -1001)
            
            # Set expiration
            self.redis_client.expire(cache_key, 3600)  # 1 hour
            
        except Exception as e:
            logger.error("Error caching metrics", error=str(e))
    
    async def _process_metrics_queue(self):
        """Process metrics queue in background"""
        batch = []
        
        while True:
            try:
                # Collect batch
                try:
                    record = await asyncio.wait_for(
                        self.metrics_queue.get(),
                        timeout=1.0
                    )
                    batch.append(record)
                except asyncio.TimeoutError:
                    pass
                
                # Process batch when full or on timeout
                if len(batch) >= self.config.batch_size or (batch and self.metrics_queue.empty()):
                    await self._process_batch(batch)
                    batch = []
                    
            except asyncio.CancelledError:
                # Process remaining batch before shutdown
                if batch:
                    await self._process_batch(batch)
                raise
            except Exception as e:
                logger.error("Error in metrics processing", error=str(e))
                await asyncio.sleep(5)  # Back off on error
    
    async def _process_batch(self, batch: List[TechniqueEffectivenessRecord]):
        """Process a batch of effectiveness records"""
        try:
            with self.SessionLocal() as session:
                session.bulk_save_objects(batch)
                session.commit()
            
            logger.info("Processed metrics batch", size=len(batch))
            
            # Trigger aggregation if needed
            for record in batch:
                await self._check_aggregation_needed(record.technique_id)
                
        except Exception as e:
            logger.error("Error processing batch", error=str(e), batch_size=len(batch))
    
    async def _check_alerts(self, technique_id: str):
        """Check if any alerts should be triggered"""
        try:
            # Get recent metrics from cache
            cache_key = f"metrics:technique:{technique_id}:recent"
            recent_data = self.redis_client.zrange(cache_key, -100, -1)
            
            if not recent_data:
                return
            
            # Parse metrics
            metrics = [json.loads(m) for m in recent_data]
            
            # Calculate statistics
            success_rate = sum(1 for m in metrics if m["success"]) / len(metrics)
            avg_time = statistics.mean(m["time_ms"] for m in metrics)
            
            # Check thresholds
            alerts = []
            
            if success_rate < self.config.min_success_rate:
                alerts.append({
                    "type": "low_success_rate",
                    "technique_id": technique_id,
                    "value": success_rate,
                    "threshold": self.config.min_success_rate
                })
            
            if avg_time > self.config.max_avg_time_ms:
                alerts.append({
                    "type": "high_response_time",
                    "technique_id": technique_id,
                    "value": avg_time,
                    "threshold": self.config.max_avg_time_ms
                })
            
            # Publish alerts
            for alert in alerts:
                await self._publish_alert(alert)
                
        except Exception as e:
            logger.error("Error checking alerts", error=str(e), technique_id=technique_id)
    
    async def _publish_alert(self, alert: Dict[str, Any]):
        """Publish an alert"""
        try:
            # Publish to Redis pub/sub
            self.redis_client.publish(
                "effectiveness:alerts",
                json.dumps(alert)
            )
            
            logger.warning("Alert triggered", **alert)
            
        except Exception as e:
            logger.error("Error publishing alert", error=str(e), alert=alert)
    
    async def _check_aggregation_needed(self, technique_id: str):
        """Check if aggregation is needed for a technique"""
        try:
            # Check last aggregation time
            cache_key = f"aggregation:last:{technique_id}"
            last_aggregation = self.redis_client.get(cache_key)
            
            if last_aggregation:
                last_time = datetime.fromisoformat(last_aggregation)
                if (datetime.utcnow() - last_time).total_seconds() < 3600:  # 1 hour
                    return
            
            # Trigger aggregation
            await self._aggregate_metrics(technique_id)
            
        except Exception as e:
            logger.error("Error checking aggregation", error=str(e), technique_id=technique_id)
    
    async def _aggregate_metrics(self, technique_id: str):
        """Aggregate metrics for a technique"""
        try:
            with self.SessionLocal() as session:
                now = datetime.utcnow()
                
                for interval in self.config.aggregation_intervals:
                    # Calculate period
                    if interval == "hour":
                        period_start = now.replace(minute=0, second=0, microsecond=0)
                        period_end = period_start + timedelta(hours=1)
                    elif interval == "day":
                        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                        period_end = period_start + timedelta(days=1)
                    elif interval == "week":
                        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                        period_start -= timedelta(days=period_start.weekday())
                        period_end = period_start + timedelta(weeks=1)
                    elif interval == "month":
                        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                        # Calculate next month
                        if period_start.month == 12:
                            period_end = period_start.replace(year=period_start.year + 1, month=1)
                        else:
                            period_end = period_start.replace(month=period_start.month + 1)
                    else:
                        continue
                    
                    # Aggregate metrics
                    for metric_type in MetricType:
                        self._aggregate_metric_type(
                            session,
                            technique_id,
                            metric_type,
                            period_start,
                            period_end
                        )
            
            # Update last aggregation time
            cache_key = f"aggregation:last:{technique_id}"
            self.redis_client.set(cache_key, datetime.utcnow().isoformat(), ex=86400)  # 24 hours
            
        except Exception as e:
            logger.error("Error aggregating metrics", error=str(e), technique_id=technique_id)
    
    def _aggregate_metric_type(
        self,
        session: Session,
        technique_id: str,
        metric_type: MetricType,
        period_start: datetime,
        period_end: datetime
    ):
        """Aggregate a specific metric type"""
        try:
            # Query records
            records = session.query(TechniqueEffectivenessRecord).filter(
                and_(
                    TechniqueEffectivenessRecord.technique_id == technique_id,
                    TechniqueEffectivenessRecord.timestamp >= period_start,
                    TechniqueEffectivenessRecord.timestamp < period_end
                )
            ).all()
            
            if not records:
                return
            
            # Extract values based on metric type
            if metric_type == MetricType.RESPONSE_TIME:
                values = [r.application_time_ms for r in records]
            elif metric_type == MetricType.TOKEN_EFFICIENCY:
                values = [r.token_increase_ratio for r in records]
            elif metric_type == MetricType.ERROR_RATE:
                values = [1 if not r.success else 0 for r in records]
            elif metric_type == MetricType.RETRY_COUNT:
                values = [r.retry_count for r in records]
            else:
                return
            
            # Calculate statistics
            if not values:
                return
            
            # Check if aggregation already exists
            existing = session.query(AggregatedMetrics).filter(
                and_(
                    AggregatedMetrics.technique_id == technique_id,
                    AggregatedMetrics.metric_type == metric_type.value,
                    AggregatedMetrics.period_start == period_start,
                    AggregatedMetrics.period_end == period_end
                )
            ).first()
            
            if existing:
                # Update existing
                aggregated = existing
            else:
                # Create new
                aggregated = AggregatedMetrics(
                    id=str(uuid.uuid4()),
                    technique_id=technique_id,
                    metric_type=metric_type.value,
                    period_start=period_start,
                    period_end=period_end
                )
            
            # Update values
            aggregated.count = len(values)
            aggregated.avg_value = statistics.mean(values)
            aggregated.min_value = min(values)
            aggregated.max_value = max(values)
            
            if len(values) > 1:
                aggregated.std_dev = statistics.stdev(values)
                sorted_values = sorted(values)
                aggregated.percentile_25 = sorted_values[len(values) // 4]
                aggregated.percentile_50 = statistics.median(values)
                aggregated.percentile_75 = sorted_values[3 * len(values) // 4]
            
            # Calculate context breakdown
            context_breakdown = self._calculate_context_breakdown(records, metric_type)
            aggregated.context_breakdown = context_breakdown
            
            aggregated.last_updated = datetime.utcnow()
            
            if not existing:
                session.add(aggregated)
            
            session.commit()
            
        except Exception as e:
            logger.error(
                "Error aggregating metric type",
                error=str(e),
                technique_id=technique_id,
                metric_type=metric_type.value
            )
    
    def _calculate_context_breakdown(
        self,
        records: List[TechniqueEffectivenessRecord],
        metric_type: MetricType
    ) -> Dict[str, Any]:
        """Calculate breakdown by context"""
        breakdown = {
            "by_intent": defaultdict(list),
            "by_complexity": defaultdict(list),
            "by_domain": defaultdict(list)
        }
        
        for record in records:
            # Extract value
            if metric_type == MetricType.RESPONSE_TIME:
                value = record.application_time_ms
            elif metric_type == MetricType.TOKEN_EFFICIENCY:
                value = record.token_increase_ratio
            elif metric_type == MetricType.ERROR_RATE:
                value = 1 if not record.success else 0
            elif metric_type == MetricType.RETRY_COUNT:
                value = record.retry_count
            else:
                continue
            
            # Group by context
            if record.intent_type:
                breakdown["by_intent"][record.intent_type].append(value)
            if record.complexity_level:
                breakdown["by_complexity"][record.complexity_level].append(value)
            if record.domain:
                breakdown["by_domain"][record.domain].append(value)
        
        # Calculate statistics for each group
        result = {}
        for context_type, groups in breakdown.items():
            result[context_type] = {}
            for group_name, values in groups.items():
                if values:
                    result[context_type][group_name] = {
                        "count": len(values),
                        "avg": statistics.mean(values),
                        "min": min(values),
                        "max": max(values)
                    }
        
        return result
    
    async def get_effectiveness_metrics(
        self,
        request: EffectivenessMetricsRequest
    ) -> EffectivenessMetricsResponse:
        """Get effectiveness metrics based on request criteria"""
        try:
            with self.SessionLocal() as session:
                # Build query
                query = session.query(AggregatedMetrics)
                
                if request.technique_ids:
                    query = query.filter(
                        AggregatedMetrics.technique_id.in_(request.technique_ids)
                    )
                
                if request.metric_types:
                    query = query.filter(
                        AggregatedMetrics.metric_type.in_([m.value for m in request.metric_types])
                    )
                
                if request.start_date:
                    query = query.filter(AggregatedMetrics.period_end >= request.start_date)
                
                if request.end_date:
                    query = query.filter(AggregatedMetrics.period_start <= request.end_date)
                
                # Execute query
                results = query.all()
                
                # Format response
                metrics = []
                for result in results:
                    metrics.append({
                        "technique_id": result.technique_id,
                        "metric_type": result.metric_type,
                        "period_start": result.period_start.isoformat(),
                        "period_end": result.period_end.isoformat(),
                        "count": result.count,
                        "avg_value": result.avg_value,
                        "min_value": result.min_value,
                        "max_value": result.max_value,
                        "std_dev": result.std_dev,
                        "percentiles": {
                            "25": result.percentile_25,
                            "50": result.percentile_50,
                            "75": result.percentile_75
                        },
                        "context_breakdown": result.context_breakdown
                    })
                
                # Calculate summary
                summary = self._calculate_summary(metrics)
                
                # Period information
                period = {
                    "start": request.start_date.isoformat() if request.start_date else None,
                    "end": request.end_date.isoformat() if request.end_date else None,
                    "aggregation": request.aggregation_period
                }
                
                return EffectivenessMetricsResponse(
                    metrics=metrics,
                    summary=summary,
                    period=period,
                    total_records=len(results)
                )
                
        except Exception as e:
            logger.error("Error getting effectiveness metrics", error=str(e))
            raise
    
    def _calculate_summary(self, metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics from metrics"""
        if not metrics:
            return {}
        
        summary = {
            "total_techniques": len(set(m["technique_id"] for m in metrics)),
            "total_metrics": len(metrics),
            "metric_types": list(set(m["metric_type"] for m in metrics)),
            "overall_stats": {}
        }
        
        # Calculate overall statistics by metric type
        by_type = defaultdict(list)
        for metric in metrics:
            by_type[metric["metric_type"]].append(metric["avg_value"])
        
        for metric_type, values in by_type.items():
            if values:
                summary["overall_stats"][metric_type] = {
                    "avg": statistics.mean(values),
                    "min": min(values),
                    "max": max(values)
                }
        
        return summary
    
    async def get_technique_performance(
        self,
        technique_id: str,
        days: int = 30
    ) -> TechniquePerformanceMetrics:
        """Get comprehensive performance metrics for a technique"""
        try:
            with self.SessionLocal() as session:
                # Query recent records
                start_date = datetime.utcnow() - timedelta(days=days)
                
                records = session.query(TechniqueEffectivenessRecord).filter(
                    and_(
                        TechniqueEffectivenessRecord.technique_id == technique_id,
                        TechniqueEffectivenessRecord.timestamp >= start_date
                    )
                ).all()
                
                if not records:
                    return TechniquePerformanceMetrics(
                        technique_id=technique_id,
                        total_applications=0,
                        success_rate=0.0,
                        avg_application_time_ms=0.0,
                        avg_token_increase_ratio=0.0
                    )
                
                # Calculate basic metrics
                total_applications = len(records)
                success_count = sum(1 for r in records if r.success)
                success_rate = success_count / total_applications
                avg_time = statistics.mean(r.application_time_ms for r in records)
                avg_token_ratio = statistics.mean(r.token_increase_ratio for r in records)
                
                # Get user ratings
                feedback_records = session.query(UserFeedback).join(
                    TechniqueEffectivenessRecord
                ).filter(
                    TechniqueEffectivenessRecord.technique_id == technique_id
                ).all()
                
                avg_rating = None
                if feedback_records:
                    ratings = [f.rating for f in feedback_records if f.rating]
                    if ratings:
                        avg_rating = statistics.mean(ratings)
                
                # Calculate context breakdown
                performance_by_intent = self._calculate_performance_by_context(
                    records, "intent_type"
                )
                performance_by_complexity = self._calculate_performance_by_context(
                    records, "complexity_level"
                )
                performance_by_domain = self._calculate_performance_by_context(
                    records, "domain"
                )
                
                # Determine trend
                trend_direction, trend_confidence = self._calculate_trend(records)
                
                # Generate recommendations
                recommended_contexts, not_recommended_contexts = self._generate_recommendations(
                    performance_by_intent,
                    performance_by_complexity,
                    performance_by_domain
                )
                
                return TechniquePerformanceMetrics(
                    technique_id=technique_id,
                    total_applications=total_applications,
                    success_rate=success_rate,
                    avg_application_time_ms=avg_time,
                    avg_token_increase_ratio=avg_token_ratio,
                    avg_user_rating=avg_rating,
                    feedback_count=len(feedback_records),
                    performance_by_intent=performance_by_intent,
                    performance_by_complexity=performance_by_complexity,
                    performance_by_domain=performance_by_domain,
                    trend_direction=trend_direction,
                    trend_confidence=trend_confidence,
                    recommended_contexts=recommended_contexts,
                    not_recommended_contexts=not_recommended_contexts
                )
                
        except Exception as e:
            logger.error(
                "Error getting technique performance",
                error=str(e),
                technique_id=technique_id
            )
            raise
    
    def _calculate_performance_by_context(
        self,
        records: List[TechniqueEffectivenessRecord],
        context_field: str
    ) -> Dict[str, Dict[str, float]]:
        """Calculate performance metrics grouped by context field"""
        grouped = defaultdict(list)
        
        for record in records:
            context_value = getattr(record, context_field)
            if context_value:
                grouped[context_value].append(record)
        
        result = {}
        for context_value, context_records in grouped.items():
            if context_records:
                success_count = sum(1 for r in context_records if r.success)
                result[context_value] = {
                    "count": len(context_records),
                    "success_rate": success_count / len(context_records),
                    "avg_time_ms": statistics.mean(r.application_time_ms for r in context_records),
                    "avg_token_ratio": statistics.mean(r.token_increase_ratio for r in context_records)
                }
        
        return result
    
    def _calculate_trend(
        self,
        records: List[TechniqueEffectivenessRecord]
    ) -> Tuple[Optional[str], Optional[float]]:
        """Calculate performance trend over time"""
        if len(records) < 10:
            return None, None
        
        # Sort by timestamp
        sorted_records = sorted(records, key=lambda r: r.timestamp)
        
        # Split into halves
        mid_point = len(sorted_records) // 2
        first_half = sorted_records[:mid_point]
        second_half = sorted_records[mid_point:]
        
        # Calculate success rates
        first_success_rate = sum(1 for r in first_half if r.success) / len(first_half)
        second_success_rate = sum(1 for r in second_half if r.success) / len(second_half)
        
        # Determine trend
        diff = second_success_rate - first_success_rate
        
        if abs(diff) < 0.05:
            return "stable", 0.8
        elif diff > 0:
            return "improving", min(abs(diff) * 10, 0.9)
        else:
            return "declining", min(abs(diff) * 10, 0.9)
    
    def _generate_recommendations(
        self,
        performance_by_intent: Dict[str, Dict[str, float]],
        performance_by_complexity: Dict[str, Dict[str, float]],
        performance_by_domain: Dict[str, Dict[str, float]]
    ) -> Tuple[List[str], List[str]]:
        """Generate context recommendations based on performance"""
        recommended = []
        not_recommended = []
        
        # Check by intent
        for intent, metrics in performance_by_intent.items():
            if metrics["success_rate"] >= 0.9 and metrics["count"] >= 10:
                recommended.append(f"intent:{intent}")
            elif metrics["success_rate"] < 0.7 and metrics["count"] >= 10:
                not_recommended.append(f"intent:{intent}")
        
        # Check by complexity
        for complexity, metrics in performance_by_complexity.items():
            if metrics["success_rate"] >= 0.9 and metrics["count"] >= 10:
                recommended.append(f"complexity:{complexity}")
            elif metrics["success_rate"] < 0.7 and metrics["count"] >= 10:
                not_recommended.append(f"complexity:{complexity}")
        
        # Check by domain
        for domain, metrics in performance_by_domain.items():
            if metrics["success_rate"] >= 0.9 and metrics["count"] >= 10:
                recommended.append(f"domain:{domain}")
            elif metrics["success_rate"] < 0.7 and metrics["count"] >= 10:
                not_recommended.append(f"domain:{domain}")
        
        return recommended, not_recommended
    
    async def cleanup_old_records(self):
        """Clean up old effectiveness records based on retention policy"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.config.retention_days)
            
            with self.SessionLocal() as session:
                # Delete old records
                deleted_count = session.query(TechniqueEffectivenessRecord).filter(
                    TechniqueEffectivenessRecord.timestamp < cutoff_date
                ).delete()
                
                session.commit()
                
                logger.info(
                    "Cleaned up old effectiveness records",
                    deleted_count=deleted_count,
                    cutoff_date=cutoff_date.isoformat()
                )
                
        except Exception as e:
            logger.error("Error cleaning up old records", error=str(e))