"""
API endpoints for technique effectiveness tracking and metrics.

This module provides REST API endpoints for retrieving and analyzing
effectiveness metrics for prompt engineering techniques.
"""

from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
import structlog

from ..models.effectiveness import (
    EffectivenessMetricsRequest,
    EffectivenessMetricsResponse,
    TechniquePerformanceMetrics,
    MetricType,
    FeedbackType
)
from ..services.effectiveness_tracker import EffectivenessTracker
from ..dependencies import get_effectiveness_tracker, get_current_user
from ..config import settings

logger = structlog.get_logger()

router = APIRouter(
    prefix="/effectiveness",
    tags=["effectiveness"],
    responses={404: {"description": "Not found"}},
)


@router.post("/metrics", response_model=EffectivenessMetricsResponse)
async def get_effectiveness_metrics(
    request: EffectivenessMetricsRequest,
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Retrieve effectiveness metrics for techniques.
    
    This endpoint allows querying aggregated effectiveness metrics
    with various filtering options.
    """
    try:
        logger.info(
            "Getting effectiveness metrics",
            user_id=current_user.get("id") if current_user else None,
            request=request.dict()
        )
        
        # Add user filter if not admin
        if current_user and not current_user.get("is_admin", False):
            request.user_id = current_user["id"]
        
        response = await tracker.get_effectiveness_metrics(request)
        
        return response
        
    except Exception as e:
        logger.error("Error getting effectiveness metrics", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve effectiveness metrics"
        )


@router.get("/techniques/{technique_id}/performance", response_model=TechniquePerformanceMetrics)
async def get_technique_performance(
    technique_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Get comprehensive performance metrics for a specific technique.
    
    Returns detailed performance analysis including success rates,
    response times, user ratings, and contextual breakdowns.
    """
    try:
        logger.info(
            "Getting technique performance",
            technique_id=technique_id,
            days=days,
            user_id=current_user.get("id") if current_user else None
        )
        
        performance = await tracker.get_technique_performance(technique_id, days)
        
        if performance.total_applications == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No data found for technique: {technique_id}"
            )
        
        return performance
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error getting technique performance",
            error=str(e),
            technique_id=technique_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve technique performance"
        )


@router.get("/techniques/ranking")
async def get_technique_ranking(
    metric: str = Query("success_rate", description="Metric to rank by"),
    min_applications: int = Query(10, ge=1, description="Minimum applications to include"),
    limit: int = Query(10, ge=1, le=50, description="Number of techniques to return"),
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Get ranking of techniques by specified metric.
    
    Available metrics:
    - success_rate: Overall success rate
    - avg_time: Average application time
    - user_rating: Average user rating
    - token_efficiency: Token increase efficiency
    """
    try:
        logger.info(
            "Getting technique ranking",
            metric=metric,
            min_applications=min_applications,
            limit=limit
        )
        
        # Validate metric
        valid_metrics = ["success_rate", "avg_time", "user_rating", "token_efficiency"]
        if metric not in valid_metrics:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid metric. Valid options: {valid_metrics}"
            )
        
        # Get performance data for all techniques
        # This would typically be optimized with a specific query
        techniques = []
        
        # Get list of all technique IDs (this would come from configuration)
        technique_ids = [
            "chain_of_thought", "tree_of_thoughts", "few_shot", "zero_shot",
            "role_play", "step_by_step", "structured_output", "emotional_appeal",
            "constraints", "analogical", "self_consistency", "react"
        ]
        
        for technique_id in technique_ids:
            try:
                performance = await tracker.get_technique_performance(technique_id, days=30)
                if performance.total_applications >= min_applications:
                    techniques.append(performance)
            except Exception as e:
                logger.warning(f"Failed to get performance for {technique_id}: {e}")
        
        # Sort by metric
        if metric == "success_rate":
            techniques.sort(key=lambda x: x.success_rate, reverse=True)
        elif metric == "avg_time":
            techniques.sort(key=lambda x: x.avg_application_time_ms)
        elif metric == "user_rating":
            techniques.sort(key=lambda x: x.avg_user_rating or 0, reverse=True)
        elif metric == "token_efficiency":
            techniques.sort(key=lambda x: x.avg_token_increase_ratio)
        
        # Return top N
        return {
            "metric": metric,
            "techniques": [
                {
                    "technique_id": t.technique_id,
                    "rank": i + 1,
                    "value": getattr(t, metric.replace("avg_", "avg_").replace("_", "_")),
                    "total_applications": t.total_applications,
                    "trend": t.trend_direction
                }
                for i, t in enumerate(techniques[:limit])
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting technique ranking", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve technique ranking"
        )


@router.get("/recommendations/{intent_type}")
async def get_technique_recommendations(
    intent_type: str,
    complexity_level: Optional[str] = Query(None, description="Complexity level filter"),
    domain: Optional[str] = Query(None, description="Domain filter"),
    limit: int = Query(5, ge=1, le=10, description="Number of recommendations"),
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Get technique recommendations based on intent and context.
    
    Returns techniques that perform best for the given intent type
    and optional context filters.
    """
    try:
        logger.info(
            "Getting technique recommendations",
            intent_type=intent_type,
            complexity_level=complexity_level,
            domain=domain
        )
        
        # This would typically use a more sophisticated recommendation algorithm
        # For now, we'll use performance data
        
        technique_ids = [
            "chain_of_thought", "tree_of_thoughts", "few_shot", "zero_shot",
            "role_play", "step_by_step", "structured_output", "emotional_appeal",
            "constraints", "analogical", "self_consistency", "react"
        ]
        
        recommendations = []
        
        for technique_id in technique_ids:
            try:
                performance = await tracker.get_technique_performance(technique_id, days=30)
                
                # Check if technique is recommended for this context
                context_key = f"intent:{intent_type}"
                if context_key in performance.recommended_contexts:
                    score = 1.0
                elif context_key in performance.not_recommended_contexts:
                    continue  # Skip not recommended
                else:
                    # Calculate score based on performance for this intent
                    intent_perf = performance.performance_by_intent.get(intent_type, {})
                    if intent_perf and intent_perf.get("count", 0) >= 5:
                        score = intent_perf.get("success_rate", 0.5)
                    else:
                        score = 0.5  # Default score
                
                # Adjust score based on complexity if provided
                if complexity_level and complexity_level in performance.performance_by_complexity:
                    complexity_perf = performance.performance_by_complexity[complexity_level]
                    if complexity_perf.get("count", 0) >= 5:
                        score *= complexity_perf.get("success_rate", 1.0)
                
                # Adjust score based on domain if provided
                if domain and domain in performance.performance_by_domain:
                    domain_perf = performance.performance_by_domain[domain]
                    if domain_perf.get("count", 0) >= 5:
                        score *= domain_perf.get("success_rate", 1.0)
                
                recommendations.append({
                    "technique_id": technique_id,
                    "score": score,
                    "success_rate": performance.success_rate,
                    "avg_time_ms": performance.avg_application_time_ms,
                    "user_rating": performance.avg_user_rating,
                    "applications": performance.total_applications
                })
                
            except Exception as e:
                logger.warning(f"Failed to get performance for {technique_id}: {e}")
        
        # Sort by score
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "intent_type": intent_type,
            "complexity_level": complexity_level,
            "domain": domain,
            "recommendations": recommendations[:limit]
        }
        
    except Exception as e:
        logger.error("Error getting technique recommendations", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve technique recommendations"
        )


@router.get("/health-check")
async def effectiveness_health_check(
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker)
):
    """
    Check health of effectiveness tracking system.
    
    Returns status of various components including database connectivity,
    Redis availability, and background task status.
    """
    try:
        health_status = {
            "status": "healthy",
            "components": {
                "database": "unknown",
                "redis": "unknown",
                "background_tasks": "unknown"
            },
            "config": {
                "tracking_enabled": tracker.config.enabled,
                "sample_rate": tracker.config.sample_rate,
                "retention_days": tracker.config.retention_days
            }
        }
        
        # Check database
        try:
            with tracker.SessionLocal() as session:
                session.execute("SELECT 1")
                health_status["components"]["database"] = "healthy"
        except Exception as e:
            health_status["components"]["database"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        # Check Redis
        try:
            tracker.redis_client.ping()
            health_status["components"]["redis"] = "healthy"
        except Exception as e:
            health_status["components"]["redis"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        # Check background tasks
        if tracker._processing_task:
            if tracker._processing_task.done():
                health_status["components"]["background_tasks"] = "stopped"
                health_status["status"] = "degraded"
            else:
                health_status["components"]["background_tasks"] = "running"
        else:
            health_status["components"]["background_tasks"] = "not started"
            if tracker.config.async_processing:
                health_status["status"] = "degraded"
        
        return health_status
        
    except Exception as e:
        logger.error("Error checking effectiveness health", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@router.post("/cleanup")
async def trigger_cleanup(
    tracker: EffectivenessTracker = Depends(get_effectiveness_tracker),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Trigger cleanup of old effectiveness records.
    
    Admin only endpoint to manually trigger cleanup based on retention policy.
    """
    try:
        # Check admin permission
        if not current_user or not current_user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        logger.info("Triggering effectiveness cleanup", user_id=current_user["id"])
        
        await tracker.cleanup_old_records()
        
        return {
            "status": "success",
            "message": "Cleanup triggered successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error triggering cleanup", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger cleanup"
        )