"""
Dependency injection for FastAPI application.

This module provides dependency functions for the prompt generator service.
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
import jwt
import structlog

from .database import SessionLocal
from .services.effectiveness_tracker import EffectivenessTracker, EffectivenessTrackingConfig
from .config import settings

logger = structlog.get_logger()

# Global instances
_effectiveness_tracker: Optional[EffectivenessTracker] = None


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_effectiveness_tracker() -> EffectivenessTracker:
    """Dependency to get effectiveness tracker instance."""
    global _effectiveness_tracker
    
    if _effectiveness_tracker is None:
        # Initialize configuration
        config = EffectivenessTrackingConfig(
            enabled=settings.EFFECTIVENESS_TRACKING_ENABLED,
            sample_rate=settings.EFFECTIVENESS_SAMPLE_RATE,
            retention_days=settings.EFFECTIVENESS_RETENTION_DAYS,
            async_processing=settings.EFFECTIVENESS_ASYNC_PROCESSING
        )
        
        # Create tracker instance
        _effectiveness_tracker = EffectivenessTracker(config)
        
        logger.info("Initialized effectiveness tracker", config=config.dict())
    
    return _effectiveness_tracker


async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """
    Dependency to get current user from JWT token.
    
    Returns None if no token provided (anonymous access).
    Raises HTTPException if token is invalid.
    """
    if not authorization:
        return None
    
    try:
        # Extract token from "Bearer <token>" format
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token = parts[1]
        
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Extract user information
        user = {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "is_admin": payload.get("is_admin", False),
            "permissions": payload.get("permissions", [])
        }
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error("Error decoding JWT token", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )


def require_auth(current_user: Optional[Dict[str, Any]] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency that requires authentication."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return current_user


def require_admin(current_user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    """Dependency that requires admin privileges."""
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


class RateLimiter:
    """Rate limiting dependency."""
    
    def __init__(self, calls: int = 10, period: int = 60):
        self.calls = calls
        self.period = period
        self._cache = {}  # In production, use Redis
    
    async def __call__(self, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
        # Simplified rate limiting - in production use Redis
        user_id = current_user["id"] if current_user else "anonymous"
        
        # Check rate limit
        # This is a placeholder - implement proper rate limiting with Redis
        
        return True


# Create rate limiter instances
rate_limit_strict = RateLimiter(calls=10, period=60)  # 10 calls per minute
rate_limit_normal = RateLimiter(calls=60, period=60)  # 60 calls per minute
rate_limit_relaxed = RateLimiter(calls=300, period=60)  # 300 calls per minute