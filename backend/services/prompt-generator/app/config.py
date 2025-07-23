from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    app_name: str = "prompt-generator"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, env="DEBUG")
    
    # Server
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8003, env="PORT")
    workers: int = Field(default=4, env="WORKERS")
    
    # Database
    database_url: str = Field(
        default="postgresql://betterprompts:betterprompts@postgres:5432/betterprompts",
        env="DATABASE_URL"
    )
    
    # Redis
    redis_url: str = Field(default="redis://redis:6379", env="REDIS_URL")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    
    # Service URLs
    intent_classifier_url: str = Field(
        default="http://intent-classifier:8001",
        env="INTENT_CLASSIFIER_URL"
    )
    technique_selector_url: str = Field(
        default="http://technique-selector:8002",
        env="TECHNIQUE_SELECTOR_URL"
    )
    
    # Model settings
    model_cache_dir: str = Field(default="./models", env="MODEL_CACHE_DIR")
    max_prompt_length: int = Field(default=4096, env="MAX_PROMPT_LENGTH")
    default_temperature: float = Field(default=0.7, env="DEFAULT_TEMPERATURE")
    
    # Technique settings
    techniques_config_path: str = Field(
        default="./configs/techniques.yaml",
        env="TECHNIQUES_CONFIG_PATH"
    )
    templates_dir: str = Field(default="./configs/templates", env="TEMPLATES_DIR")
    
    # API Keys (optional for external services)
    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    
    # Performance
    cache_ttl: int = Field(default=3600, env="CACHE_TTL")  # seconds
    max_concurrent_requests: int = Field(default=100, env="MAX_CONCURRENT_REQUESTS")
    request_timeout: int = Field(default=30, env="REQUEST_TIMEOUT")  # seconds
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    
    # Security
    api_key_header: str = Field(default="X-API-Key", env="API_KEY_HEADER")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        env="CORS_ORIGINS"
    )
    
    # Feature flags
    enable_caching: bool = Field(default=True, env="ENABLE_CACHING")
    enable_metrics: bool = Field(default=True, env="ENABLE_METRICS")
    enable_validation: bool = Field(default=True, env="ENABLE_VALIDATION")
    enable_async_processing: bool = Field(default=True, env="ENABLE_ASYNC_PROCESSING")
    
    # Effectiveness tracking
    effectiveness_tracking_enabled: bool = Field(default=True, env="EFFECTIVENESS_TRACKING_ENABLED")
    effectiveness_sample_rate: float = Field(default=1.0, env="EFFECTIVENESS_SAMPLE_RATE")
    effectiveness_retention_days: int = Field(default=90, env="EFFECTIVENESS_RETENTION_DAYS")
    effectiveness_async_processing: bool = Field(default=True, env="EFFECTIVENESS_ASYNC_PROCESSING")
    
    # JWT settings
    jwt_secret_key: str = Field(default="change-me-in-production", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expiration_minutes: int = Field(default=30, env="JWT_EXPIRATION_MINUTES")
    
    # Redis settings for effectiveness tracking
    redis_host: str = Field(default="redis", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_db: int = Field(default=0, env="REDIS_DB")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create global settings instance
settings = Settings()