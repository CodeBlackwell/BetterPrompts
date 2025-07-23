"""Feedback API endpoints for the prompt-generator service."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
import logging

from app.models import (
    FeedbackRequest,
    FeedbackResponse,
    TechniqueEffectivenessRequest,
    TechniqueEffectivenessResponse
)
from app.database import (
    get_db,
    save_feedback,
    get_feedback_by_prompt_history,
    calculate_technique_effectiveness,
    FeedbackType
)
from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback_request: FeedbackRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> FeedbackResponse:
    """Submit feedback for an enhanced prompt"""
    try:
        # Extract additional metadata from request
        user_agent = request.headers.get("User-Agent")
        # In production, use proper IP extraction considering proxies
        ip_address = request.client.host if request.client else None
        
        # Get user_id and session_id from headers if available
        user_id = request.headers.get("X-User-ID")
        session_id = request.headers.get("X-Session-ID")
        
        # Check if feedback already exists for this user/session
        existing_feedback = get_feedback_by_prompt_history(
            db,
            feedback_request.prompt_history_id,
            user_id
        )
        
        if existing_feedback:
            logger.warning(
                f"Feedback already exists for prompt_history_id: {feedback_request.prompt_history_id}, "
                f"user_id: {user_id}"
            )
            return FeedbackResponse(
                id=existing_feedback.id,
                prompt_history_id=existing_feedback.prompt_history_id,
                rating=existing_feedback.rating,
                feedback_type=existing_feedback.feedback_type.value,
                created_at=existing_feedback.created_at,
                message="Feedback already submitted for this prompt"
            )
        
        # Save feedback
        feedback_type = FeedbackType(feedback_request.feedback_type)
        feedback = save_feedback(
            db=db,
            prompt_history_id=feedback_request.prompt_history_id,
            rating=feedback_request.rating,
            feedback_type=feedback_type,
            feedback_text=feedback_request.feedback_text,
            technique_ratings=feedback_request.technique_ratings,
            most_helpful_technique=feedback_request.most_helpful_technique,
            least_helpful_technique=feedback_request.least_helpful_technique,
            user_id=user_id,
            session_id=session_id,
            user_agent=user_agent,
            ip_address=ip_address,
            metadata=feedback_request.metadata
        )
        
        logger.info(f"Feedback saved successfully: {feedback.id}")
        
        return FeedbackResponse(
            id=feedback.id,
            prompt_history_id=feedback.prompt_history_id,
            rating=feedback.rating,
            feedback_type=feedback.feedback_type.value,
            created_at=feedback.created_at
        )
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit feedback"
        )


@router.get("/prompt/{prompt_history_id}", response_model=Optional[FeedbackResponse])
async def get_feedback(
    prompt_history_id: str,
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[FeedbackResponse]:
    """Get feedback for a specific prompt history entry"""
    try:
        user_id = request.headers.get("X-User-ID")
        
        feedback = get_feedback_by_prompt_history(
            db,
            prompt_history_id,
            user_id
        )
        
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        return FeedbackResponse(
            id=feedback.id,
            prompt_history_id=feedback.prompt_history_id,
            rating=feedback.rating,
            feedback_type=feedback.feedback_type.value,
            created_at=feedback.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve feedback"
        )


@router.post("/effectiveness", response_model=TechniqueEffectivenessResponse)
async def get_technique_effectiveness(
    request: TechniqueEffectivenessRequest,
    db: Session = Depends(get_db)
) -> TechniqueEffectivenessResponse:
    """Get effectiveness metrics for a specific technique"""
    try:
        effectiveness = calculate_technique_effectiveness(
            db=db,
            technique=request.technique,
            intent=request.intent,
            complexity=request.complexity,
            period_days=request.period_days
        )
        
        return TechniqueEffectivenessResponse(
            technique=effectiveness["technique"],
            intent=effectiveness.get("intent"),
            complexity=effectiveness.get("complexity"),
            effectiveness_score=effectiveness.get("effectiveness_score"),
            average_rating=effectiveness.get("average_rating"),
            positive_ratio=effectiveness.get("positive_ratio"),
            negative_ratio=effectiveness.get("negative_ratio"),
            confidence=effectiveness["confidence"],
            sample_size=effectiveness["sample_size"],
            period_days=request.period_days
        )
        
    except Exception as e:
        logger.error(f"Error calculating technique effectiveness: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate technique effectiveness"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for feedback service"""
    return {"status": "healthy", "service": "feedback"}