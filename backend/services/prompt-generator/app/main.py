"""
FastAPI application for Prompt Generation Service
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
import time
from prometheus_client import Counter, Histogram, generate_latest
from starlette.responses import Response

from .config import settings
from .models import (
    PromptGenerationRequest,
    PromptGenerationResponse,
    BatchGenerationRequest,
    BatchGenerationResponse
)
from .engine import PromptGenerationEngine
from .health import health_router
from .routers.feedback import router as feedback_router
from .routers.effectiveness import router as effectiveness_router
from .database import init_db
from .dependencies import get_effectiveness_tracker

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
request_count = Counter(
    'prompt_generation_requests_total',
    'Total number of prompt generation requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'prompt_generation_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

generation_duration = Histogram(
    'prompt_generation_duration_seconds',
    'Prompt generation duration in seconds',
    ['technique']
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info(
        "Starting Prompt Generation Service",
        version=settings.app_version,
        environment=settings.debug and "development" or "production"
    )
    
    # Initialize database
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    
    # Initialize effectiveness tracker
    effectiveness_tracker = get_effectiveness_tracker()
    await effectiveness_tracker.start()
    app.state.effectiveness_tracker = effectiveness_tracker
    logger.info("Effectiveness tracker initialized")
    
    # Initialize engine
    app.state.engine = PromptGenerationEngine()
    # Set effectiveness tracker on engine
    app.state.engine.set_effectiveness_tracker(effectiveness_tracker)
    logger.info("Prompt generation engine initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Prompt Generation Service")
    await effectiveness_tracker.stop()


# Create FastAPI app
app = FastAPI(
    title="Prompt Generation Service",
    description="Service for applying prompt engineering techniques",
    version=settings.app_version,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Record metrics
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    request_duration.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(process_time)
    
    return response


# Exception handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle validation errors"""
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": str(exc)}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors"""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"}
    )


# Include routers
app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(feedback_router, prefix="/api/v1", tags=["feedback"])
app.include_router(effectiveness_router, prefix="/api/v1", tags=["effectiveness"])


# Main endpoints
@app.post(
    "/api/v1/generate",
    response_model=PromptGenerationResponse,
    summary="Generate enhanced prompt",
    description="Apply prompt engineering techniques to enhance the input prompt"
)
async def generate_prompt(request: PromptGenerationRequest):
    """Generate an enhanced prompt using selected techniques"""
    try:
        engine = app.state.engine
        
        # Record start time for metrics
        start_time = time.time()
        
        # Generate enhanced prompt
        response = await engine.generate(request)
        
        # Record generation time
        duration = time.time() - start_time
        for technique in request.techniques:
            generation_duration.labels(technique=technique).observe(duration)
            
        logger.info(
            "Prompt generated successfully",
            generation_id=response.id,
            techniques=request.techniques,
            duration=duration
        )
        
        return response
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate prompt"
        )


@app.post(
    "/api/v1/generate/batch",
    response_model=BatchGenerationResponse,
    summary="Generate multiple enhanced prompts",
    description="Batch process multiple prompts"
)
async def generate_prompts_batch(request: BatchGenerationRequest):
    """Generate enhanced prompts for multiple inputs"""
    try:
        engine = app.state.engine
        start_time = time.time()
        
        results = []
        errors = []
        
        # Process each prompt
        for i, prompt_request in enumerate(request.prompts):
            try:
                result = await engine.generate(prompt_request)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to process prompt {i}: {e}")
                errors.append({
                    "index": i,
                    "error": str(e),
                    "prompt": prompt_request.text[:100] + "..."
                })
                
        response = BatchGenerationResponse(
            batch_id=request.batch_id or f"batch_{int(time.time())}",
            total_prompts=len(request.prompts),
            successful=len(results),
            failed=len(errors),
            results=results,
            errors=errors,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        logger.info(
            "Batch generation completed",
            batch_id=response.batch_id,
            total=response.total_prompts,
            successful=response.successful,
            failed=response.failed
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Batch generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process batch"
        )


@app.get(
    "/api/v1/techniques",
    summary="List available techniques",
    description="Get list of all available prompt engineering techniques"
)
async def list_techniques():
    """List all available prompt engineering techniques"""
    techniques = [
        {
            "id": "chain_of_thought",
            "name": "Chain of Thought",
            "description": "Encourages step-by-step reasoning",
            "best_for": ["complex reasoning", "problem solving", "analysis"]
        },
        {
            "id": "tree_of_thoughts",
            "name": "Tree of Thoughts",
            "description": "Explores multiple solution paths",
            "best_for": ["complex problems", "optimization", "creative solutions"]
        },
        {
            "id": "few_shot",
            "name": "Few-Shot Learning",
            "description": "Provides examples to guide behavior",
            "best_for": ["pattern matching", "formatting", "consistency"]
        },
        {
            "id": "zero_shot",
            "name": "Zero-Shot Learning",
            "description": "Clear instructions without examples",
            "best_for": ["straightforward tasks", "general queries"]
        },
        {
            "id": "role_play",
            "name": "Role Playing",
            "description": "Assigns specific role or expertise",
            "best_for": ["expert advice", "specialized knowledge", "perspective"]
        },
        {
            "id": "step_by_step",
            "name": "Step by Step",
            "description": "Breaks down complex tasks",
            "best_for": ["procedures", "tutorials", "workflows"]
        },
        {
            "id": "structured_output",
            "name": "Structured Output",
            "description": "Requests specific output format",
            "best_for": ["data extraction", "formatting", "organization"]
        },
        {
            "id": "emotional_appeal",
            "name": "Emotional Appeal",
            "description": "Adds emotional context for engagement",
            "best_for": ["creative tasks", "persuasion", "engagement"]
        },
        {
            "id": "constraints",
            "name": "Constraints",
            "description": "Adds specific requirements and limits",
            "best_for": ["precision", "compliance", "boundaries"]
        },
        {
            "id": "analogical",
            "name": "Analogical Reasoning",
            "description": "Uses analogies to explain concepts",
            "best_for": ["explanation", "understanding", "teaching"]
        }
    ]
    
    return {"techniques": techniques}


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    if settings.enable_metrics:
        return Response(content=generate_latest(), media_type="text/plain")
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Metrics not enabled"
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers if not settings.debug else 1,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
                "json": {
                    "format": "%(message)s",
                    "class": "pythonjsonlogger.jsonlogger.JsonFormatter"
                }
            },
            "handlers": {
                "default": {
                    "formatter": settings.log_format,
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout"
                }
            },
            "root": {
                "level": settings.log_level,
                "handlers": ["default"]
            }
        }
    )