"""Database models and configuration for the prompt-generator service."""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, JSON, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
import enum

from app.config import settings

# Create engine
engine = create_engine(settings.database_url, pool_pre_ping=True)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base model
Base = declarative_base()


class FeedbackRating(enum.Enum):
    """Feedback rating scale"""
    VERY_POOR = 1
    POOR = 2
    NEUTRAL = 3
    GOOD = 4
    EXCELLENT = 5


class FeedbackType(enum.Enum):
    """Type of feedback"""
    RATING = "rating"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    SUGGESTION = "suggestion"
    BUG_REPORT = "bug_report"


class PromptFeedback(Base):
    """Feedback model for enhanced prompts"""
    __tablename__ = "prompt_feedback"
    __table_args__ = {"schema": "prompts"}
    
    id = Column(String, primary_key=True, default=lambda: f"fb_{uuid.uuid4().hex}")
    prompt_history_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, nullable=True)
    
    # Feedback data
    rating = Column(Integer, nullable=True)  # 1-5 scale
    feedback_type = Column(SQLEnum(FeedbackType), default=FeedbackType.RATING)
    feedback_text = Column(Text, nullable=True)
    
    # Technique-specific feedback
    technique_ratings = Column(JSON, nullable=True)  # {"chain_of_thought": 4, "few_shot": 5}
    most_helpful_technique = Column(String, nullable=True)
    least_helpful_technique = Column(String, nullable=True)
    
    # Additional metadata
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "prompt_history_id": self.prompt_history_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "rating": self.rating,
            "feedback_type": self.feedback_type.value if self.feedback_type else None,
            "feedback_text": self.feedback_text,
            "technique_ratings": self.technique_ratings,
            "most_helpful_technique": self.most_helpful_technique,
            "least_helpful_technique": self.least_helpful_technique,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TechniqueEffectivenessMetrics(Base):
    """Aggregated metrics for technique effectiveness"""
    __tablename__ = "technique_effectiveness_metrics"
    __table_args__ = {"schema": "analytics"}
    
    id = Column(String, primary_key=True, default=lambda: f"tem_{uuid.uuid4().hex}")
    technique = Column(String, nullable=False, index=True)
    intent = Column(String, nullable=True, index=True)
    complexity = Column(String, nullable=True, index=True)
    
    # Metrics
    total_uses = Column(Integer, default=0)
    total_feedback_count = Column(Integer, default=0)
    average_rating = Column(Float, nullable=True)
    positive_feedback_count = Column(Integer, default=0)
    negative_feedback_count = Column(Integer, default=0)
    
    # Performance metrics
    average_token_increase = Column(Float, nullable=True)
    average_processing_time_ms = Column(Float, nullable=True)
    
    # Effectiveness scores
    effectiveness_score = Column(Float, nullable=True)  # Calculated based on multiple factors
    confidence_interval = Column(Float, nullable=True)
    
    # Time-based data
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Metadata
    metadata = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "technique": self.technique,
            "intent": self.intent,
            "complexity": self.complexity,
            "total_uses": self.total_uses,
            "total_feedback_count": self.total_feedback_count,
            "average_rating": self.average_rating,
            "positive_feedback_count": self.positive_feedback_count,
            "negative_feedback_count": self.negative_feedback_count,
            "average_token_increase": self.average_token_increase,
            "average_processing_time_ms": self.average_processing_time_ms,
            "effectiveness_score": self.effectiveness_score,
            "confidence_interval": self.confidence_interval,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


# Database helper functions
def get_db() -> Session:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    # Import effectiveness models to ensure they're registered
    try:
        from .models.effectiveness import Base as EffectivenessBase
        # This ensures the effectiveness tables are included
    except ImportError:
        pass
    
    Base.metadata.create_all(bind=engine)


def save_feedback(
    db: Session,
    prompt_history_id: str,
    rating: Optional[int] = None,
    feedback_type: FeedbackType = FeedbackType.RATING,
    feedback_text: Optional[str] = None,
    technique_ratings: Optional[Dict[str, int]] = None,
    most_helpful_technique: Optional[str] = None,
    least_helpful_technique: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> PromptFeedback:
    """Save feedback to database"""
    feedback = PromptFeedback(
        prompt_history_id=prompt_history_id,
        rating=rating,
        feedback_type=feedback_type,
        feedback_text=feedback_text,
        technique_ratings=technique_ratings,
        most_helpful_technique=most_helpful_technique,
        least_helpful_technique=least_helpful_technique,
        user_id=user_id,
        session_id=session_id,
        user_agent=user_agent,
        ip_address=ip_address,
        metadata=metadata
    )
    
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    return feedback


def get_feedback_by_prompt_history(
    db: Session,
    prompt_history_id: str,
    user_id: Optional[str] = None
) -> Optional[PromptFeedback]:
    """Get feedback for a specific prompt history entry"""
    query = db.query(PromptFeedback).filter(
        PromptFeedback.prompt_history_id == prompt_history_id
    )
    
    if user_id:
        query = query.filter(PromptFeedback.user_id == user_id)
    
    return query.first()


def calculate_technique_effectiveness(
    db: Session,
    technique: str,
    intent: Optional[str] = None,
    complexity: Optional[str] = None,
    period_days: int = 30
) -> Dict[str, Any]:
    """Calculate technique effectiveness based on feedback"""
    from datetime import timedelta
    from sqlalchemy import func
    
    # Base query
    query = db.query(
        func.avg(PromptFeedback.rating).label("average_rating"),
        func.count(PromptFeedback.id).label("total_feedback"),
        func.sum(func.cast(PromptFeedback.rating >= 4, Integer)).label("positive_count"),
        func.sum(func.cast(PromptFeedback.rating <= 2, Integer)).label("negative_count")
    ).filter(
        PromptFeedback.created_at >= datetime.utcnow() - timedelta(days=period_days)
    )
    
    # Add filters if specified
    if intent:
        query = query.filter(PromptFeedback.metadata["intent"].astext == intent)
    if complexity:
        query = query.filter(PromptFeedback.metadata["complexity"].astext == complexity)
    
    # Filter for technique
    query = query.filter(
        func.jsonb_exists(PromptFeedback.technique_ratings, technique)
    )
    
    result = query.first()
    
    if not result or not result.total_feedback:
        return {
            "technique": technique,
            "intent": intent,
            "complexity": complexity,
            "effectiveness_score": None,
            "confidence": "low",
            "sample_size": 0
        }
    
    # Calculate effectiveness score
    avg_rating = result.average_rating or 0
    positive_ratio = (result.positive_count or 0) / result.total_feedback
    
    # Weighted score: 70% average rating, 30% positive ratio
    effectiveness_score = (avg_rating / 5) * 0.7 + positive_ratio * 0.3
    
    # Determine confidence based on sample size
    confidence = "low"
    if result.total_feedback >= 100:
        confidence = "high"
    elif result.total_feedback >= 50:
        confidence = "medium"
    
    return {
        "technique": technique,
        "intent": intent,
        "complexity": complexity,
        "effectiveness_score": round(effectiveness_score, 3),
        "average_rating": round(avg_rating, 2) if avg_rating else None,
        "positive_ratio": round(positive_ratio, 3),
        "negative_ratio": round((result.negative_count or 0) / result.total_feedback, 3),
        "confidence": confidence,
        "sample_size": result.total_feedback
    }