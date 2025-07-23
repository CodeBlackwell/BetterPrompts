from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class TechniqueType(str, Enum):
    """Supported prompt engineering techniques"""
    CHAIN_OF_THOUGHT = "chain_of_thought"
    TREE_OF_THOUGHTS = "tree_of_thoughts"
    FEW_SHOT = "few_shot"
    ZERO_SHOT = "zero_shot"
    ROLE_PLAY = "role_play"
    STEP_BY_STEP = "step_by_step"
    STRUCTURED_OUTPUT = "structured_output"
    EMOTIONAL_APPEAL = "emotional_appeal"
    CONSTRAINTS = "constraints"
    ANALOGICAL = "analogical"
    SELF_CONSISTENCY = "self_consistency"
    REACT = "react"
    SOCRATIC = "socratic"
    META_PROMPTING = "meta_prompting"
    RECURSIVE = "recursive"
    ADVERSARIAL = "adversarial"


class ComplexityLevel(str, Enum):
    """Complexity level enumeration"""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"


class PromptGenerationRequest(BaseModel):
    """Request model for prompt generation"""
    text: str = Field(..., min_length=1, max_length=5000, description="Original user input")
    intent: str = Field(..., description="Classified intent")
    complexity: str = Field(..., description="Complexity level", pattern="^(simple|moderate|complex)$")
    techniques: List[str] = Field(..., description="Selected techniques to apply")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Technique parameters")
    target_model: Optional[str] = Field(default="gpt-4", description="Target LLM model")
    max_tokens: Optional[int] = Field(default=None, description="Maximum tokens for output")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    
    @validator('techniques')
    def validate_techniques(cls, v):
        valid_techniques = [t.value for t in TechniqueType]
        for technique in v:
            if technique not in valid_techniques:
                raise ValueError(f"Invalid technique: {technique}")
        return v


class PromptGenerationResponse(BaseModel):
    """Response model for prompt generation"""
    text: str = Field(..., description="Generated enhanced prompt", alias="enhanced_prompt")
    model_version: str = Field(..., description="Generator model version")
    tokens_used: int = Field(..., description="Estimated token count", alias="token_count")
    
    # Additional fields for internal use
    id: Optional[str] = Field(default=None, description="Unique generation ID")
    original_text: Optional[str] = Field(default=None, description="Original input text")
    techniques_applied: Optional[List[str]] = Field(default=None, description="Techniques actually applied")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    generation_time_ms: Optional[float] = Field(default=None, description="Generation time in milliseconds")
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    warnings: Optional[List[str]] = Field(default=None)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class TechniqueConfig(BaseModel):
    """Configuration for a prompt engineering technique"""
    id: str
    name: str
    description: str
    template: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    examples: Optional[List[Dict[str, str]]] = None
    best_for: List[str] = Field(default_factory=list)
    not_recommended_for: List[str] = Field(default_factory=list)
    min_complexity: str = Field(default="simple", description="Minimum complexity level")
    max_tokens_overhead: int = Field(default=100)
    priority: int = Field(default=0)
    enabled: bool = Field(default=True)


class TemplateVariable(BaseModel):
    """Variable definition for prompt templates"""
    name: str
    type: str = Field(default="string")  # string, number, boolean, list, dict
    required: bool = Field(default=True)
    default: Optional[Any] = None
    description: Optional[str] = None
    validation: Optional[Dict[str, Any]] = None


class PromptTemplate(BaseModel):
    """Reusable prompt template"""
    id: str
    name: str
    description: str
    template: str
    variables: List[TemplateVariable] = Field(default_factory=list)
    techniques: List[str] = Field(default_factory=list)
    category: str
    tags: List[str] = Field(default_factory=list)
    examples: Optional[List[Dict[str, Any]]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ValidationResult(BaseModel):
    """Result of prompt validation"""
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    token_count: int
    estimated_cost: Optional[float] = None
    complexity_score: float
    readability_score: float


class EnhancementMetrics(BaseModel):
    """Metrics for prompt enhancement quality"""
    clarity_score: float = Field(..., ge=0.0, le=1.0)
    specificity_score: float = Field(..., ge=0.0, le=1.0)
    coherence_score: float = Field(..., ge=0.0, le=1.0)
    technique_effectiveness: Dict[str, float] = Field(default_factory=dict)
    overall_quality: float = Field(..., ge=0.0, le=1.0)
    improvement_percentage: float
    
    
class BatchGenerationRequest(BaseModel):
    """Request for batch prompt generation"""
    prompts: List[PromptGenerationRequest]
    batch_id: Optional[str] = None
    priority: int = Field(default=0, ge=0, le=10)
    callback_url: Optional[str] = None


class BatchGenerationResponse(BaseModel):
    """Response for batch prompt generation"""
    batch_id: str
    total_prompts: int
    successful: int
    failed: int
    results: List[PromptGenerationResponse]
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    processing_time_ms: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TechniqueExample(BaseModel):
    """Example for a specific technique"""
    technique: str
    input_text: str
    output_prompt: str
    explanation: str
    effectiveness_score: float = Field(..., ge=0.0, le=1.0)
    use_case: str
    tags: List[str] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    """Request model for submitting feedback"""
    prompt_history_id: str = Field(..., description="ID of the prompt history entry")
    rating: Optional[int] = Field(None, ge=1, le=5, description="Overall rating (1-5)")
    feedback_type: Optional[str] = Field(default="rating", pattern="^(rating|positive|negative|suggestion|bug_report)$")
    feedback_text: Optional[str] = Field(None, max_length=1000, description="Detailed feedback text")
    technique_ratings: Optional[Dict[str, int]] = Field(None, description="Individual technique ratings")
    most_helpful_technique: Optional[str] = Field(None, description="Most helpful technique")
    least_helpful_technique: Optional[str] = Field(None, description="Least helpful technique")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    @validator('technique_ratings')
    def validate_technique_ratings(cls, v):
        if v:
            for technique, rating in v.items():
                if not 1 <= rating <= 5:
                    raise ValueError(f"Rating for {technique} must be between 1 and 5")
        return v


class FeedbackResponse(BaseModel):
    """Response model for feedback submission"""
    id: str
    prompt_history_id: str
    rating: Optional[int]
    feedback_type: str
    created_at: datetime
    message: str = "Thank you for your feedback!"
    
    class Config:
        populate_by_name = True


class TechniqueEffectivenessRequest(BaseModel):
    """Request model for technique effectiveness query"""
    technique: str = Field(..., description="Technique to analyze")
    intent: Optional[str] = Field(None, description="Filter by intent")
    complexity: Optional[str] = Field(None, description="Filter by complexity")
    period_days: int = Field(default=30, ge=1, le=365, description="Analysis period in days")


class TechniqueEffectivenessResponse(BaseModel):
    """Response model for technique effectiveness"""
    technique: str
    intent: Optional[str]
    complexity: Optional[str]
    effectiveness_score: Optional[float]
    average_rating: Optional[float]
    positive_ratio: Optional[float]
    negative_ratio: Optional[float]
    confidence: str = Field(..., pattern="^(low|medium|high)$")
    sample_size: int
    period_days: int
    last_updated: datetime = Field(default_factory=datetime.utcnow)