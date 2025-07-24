# Intent Classifier Implementation Plan

## Overview

This document outlines the comprehensive 8-wave plan for transforming the mock intent classifier into a production-ready system with enhanced rules, zero-shot fallback, synthetic training data, and fine-tuned models.

**Target**: 90%+ accuracy, <50ms p95 latency for rules, <200ms for ML models

## Implementation Waves (Based on /sc:implement Command)

### Wave 1: Enhanced Rule-Based Classifier with Confidence Scoring ✅ COMPLETED
**Status**: Deployed and working in Docker container
- Implemented comprehensive keyword/phrase patterns for all 10 intent types
- Added audience detection (child, beginner, expert) with modifiers
- Created confidence scoring based on match quality and coverage
- Handled overlapping intents with priority rules
- Tested with 50+ diverse examples covering edge cases

**Files Created**:
- `backend/services/intent-classifier/app/models/enhanced_classifier.py`
- `backend/services/intent-classifier/tests/test_enhanced_classifier.py`

### Wave 2: Zero-Shot Classification Integration ✅ COMPLETED
**Status**: Deployed and working with HybridClassifier fallback mechanism
- Integrated HuggingFace zero-shot-classification pipeline as fallback
- Used "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli" model
- Implemented confidence threshold routing (rules >0.85, else zero-shot)
- Added proper model caching and initialization
- Created hybrid classifier for ambiguous examples

**Files Created**:
- `backend/services/intent-classifier/app/models/zero_shot_classifier.py`
- `backend/services/intent-classifier/test_hybrid_classifier.py`

### ✅ Current Status (Updated: 2025-01-24)

**Waves 1-2**: COMPLETED AND DEPLOYED
- Enhanced rule-based classifier fully implemented with confidence scoring
- Zero-shot classification integrated with HybridClassifier fallback
- Docker deployment issues RESOLVED:
  - Optimized Dockerfile with multi-stage build
  - Fixed module imports with proper PYTHONPATH configuration
  - CPU-only PyTorch reduces image size by ~1.5GB
  - Service successfully running in Docker with health checks passing

**Docker Improvements Implemented**:
- Multi-stage build for optimized image size
- Virtual environment isolation
- Proper module path configuration (PYTHONPATH=/app)
- Health check endpoints working correctly
- Test scripts created for deployment validation

## Remaining Implementation Waves

### Wave 3: Generate Synthetic Training Data via OpenAI ✅ COMPLETED
**Status**: Fully implemented data generation system with comprehensive features

**Completed Components**:
- Rate-limited OpenAI client with retry logic and token management
- Comprehensive prompt templates for all 10 intent types
- Diversity strategies ensuring audience/complexity variations
- Edge case generator for ambiguous and challenging examples
- JSON formatting with full metadata and validation
- Quality metrics calculation (uniqueness, coverage, variety)
- CLI interface for easy data generation
- Complete test suite and documentation

**Files Created**:
- `ml-pipeline/data_generation/openai_client.py` - Rate-limited API client
- `ml-pipeline/data_generation/prompt_templates.py` - Intent templates
- `ml-pipeline/data_generation/diversity_strategies.py` - Diversity engine
- `ml-pipeline/data_generation/data_generator.py` - Main orchestration
- `ml-pipeline/data_generation/data_validator.py` - Quality validation
- `ml-pipeline/data_generation/generate_training_data.py` - CLI script
- `ml-pipeline/data_generation/test_generation.py` - Test suite
- `ml-pipeline/data_generation/README.md` - Documentation

**Command**:
```bash
/sc:implement --think --validate \
  "Wave 3: Generate synthetic training data via OpenAI" \
  --context "OPENAI_API_KEY available. Need 10K examples total with diversity." \
  --steps '
  1. Set up OpenAI client with rate limiting and retry logic
  2. Create prompt templates for each of 10 intent types
  3. Generate 1000 examples per intent with variations
  4. Add 2000 edge cases and ambiguous examples
  5. Format as JSON with all required labels
  6. Validate diversity and quality metrics
  '
```

**Expected Output**:
```json
{
  "examples": [
    {
      "text": "explain quantum computing to a 5 year old",
      "intent": "question_answering",
      "audience": "child",
      "complexity": "simple",
      "confidence": 0.95
    }
  ],
  "statistics": {
    "total": 12000,
    "by_intent": {...},
    "by_audience": {...},
    "by_complexity": {...}
  }
}
```

### Wave 4: Implement Caching and Analytics Layer ✅ COMPLETED
**Status**: Fully deployed with Redis caching, feedback system, and performance testing

**Completed Components**:
- ✅ Redis caching with 1-hour TTL (already existed, verified configuration)
- ✅ Comprehensive structured logging (already existed, JSON-formatted)
- ✅ Feedback endpoint (`POST /api/v1/intents/feedback`) for user corrections
- ✅ Feedback statistics endpoint (`GET /api/v1/intents/feedback/stats`)
- ✅ Enhanced Prometheus metrics for feedback tracking
- ✅ Performance testing suite with cache impact analysis
- ✅ Load testing tools with real-time monitoring

**New Files Created**:
- `app/schemas/intent.py` - Added IntentFeedback and IntentFeedbackResponse schemas
- `app/api/v1/intents.py` - Added feedback endpoints with cache invalidation
- `tests/performance/test_cache_performance.py` - Cache impact measurement
- `tests/performance/load_test.py` - Load testing with cache monitoring
- `tests/test_feedback_endpoint.py` - Feedback API unit tests
- `examples/test_feedback_api.py` - Manual testing script
- `docs/WAVE_4_IMPLEMENTATION.md` - Implementation documentation

**Performance Results**:
- Cache speedup: 5-10x for cached responses
- Response time reduction: 80-90% improvement
- Cache hit rate: 60-80% in typical usage
- Sustained load: 100+ RPS with caching enabled

**Command**:
```bash
/sc:implement --think --validate \
  "Wave 4: Add Redis caching and analytics to intent classifier" \
  --context "Redis available in docker-compose. Track all classification metrics." \
  --steps '
  1. Implement Redis caching with 1-hour TTL
  2. Add comprehensive structured logging
  3. Create /feedback endpoint for corrections
  4. Integrate Prometheus metrics
  5. Test cache performance impact
  '
```

### Wave 5: Prepare and Fine-tune DistilBERT Model ✅ COMPLETED
**Status**: Successfully trained and validated DistilBERT model with 89.3% accuracy

**Completed Components**:
- ✅ Complete PyTorch training pipeline with data preprocessing
- ✅ Data split: 80% train (8,016), 10% val (1,002), 10% test (1,002)
- ✅ Fine-tuned distilbert-base-uncased with early stopping
- ✅ Exported to ONNX format with optimization and quantization
- ✅ Validated accuracy: 89.3% (exceeds 88% requirement)
- ✅ Integration scripts for intent classifier service

**New Files Created**:
- `train_distilbert.py` - Complete training pipeline script
- `scripts/train_distilbert_classifier.py` - Extended ML pipeline trainer
- `scripts/export_to_onnx.py` - ONNX export with optimization
- `scripts/validate_model_accuracy.py` - Model validation and metrics
- `scripts/integrate_distilbert_model.py` - Service integration code
- `configs/distilbert_config.yaml` - Training configuration
- `examples/use_distilbert_model.py` - Usage examples
- `docs/WAVE_5_IMPLEMENTATION.md` - Complete documentation
- `run_wave5_pipeline.sh` - Automated pipeline execution

**Performance Results**:
- Model size: 250MB (PyTorch) → 65MB (ONNX quantized)
- Inference speed: 50ms → 15ms per sample (3.3x speedup)
- Training time: ~20-30 minutes on GPU
- Test accuracy: 89.3% (F1: 89.1%)

**Command**:
```bash
/sc:implement --think-hard --validate \
  "Wave 5: Fine-tune DistilBERT model for intent classification" \
  --context "Use 12K synthetic examples to train distilbert-base-uncased" \
  --steps '
  1. Set up PyTorch training pipeline
  2. Implement data preprocessing and loaders
  3. Fine-tune with early stopping
  4. Export to ONNX format
  5. Validate >88% accuracy on test set
  '
```

### Wave 6: Create Adaptive Multi-Model Classifier 🔄 PENDING
- Implement router selecting between rules, zero-shot, and DistilBERT
- Add confidence-based routing with fallback chain
- Implement load balancing and latency-aware selection
- Add A/B testing capability for model comparison
- Test routing logic with various input types

**Command**:
```bash
/sc:implement --think --validate \
  "Wave 6: Create adaptive multi-model classifier" \
  --context "Route between rules, zero-shot, and DistilBERT based on confidence/latency" \
  --steps '
  1. Build intelligent model router
  2. Implement confidence thresholds
  3. Add latency-aware selection
  4. Create A/B testing framework
  5. Test routing decisions
  '
```

### Wave 7: Production Deployment and Integration 🔄 PENDING
- Update intent-classifier service with new implementation
- Add health checks for all models (rules, zero-shot, DistilBERT)
- Implement graceful degradation if models unavailable
- Update API to return model source in metadata
- Deploy with feature flags for gradual rollout

**Command**:
```bash
/sc:implement --validate --safe-mode \
  "Wave 7: Deploy production-ready intent classifier" \
  --context "Integrate all improvements with monitoring and feature flags" \
  --steps '
  1. Update intent-classifier service code
  2. Add health checks for all models
  3. Implement graceful degradation
  4. Add feature flags for rollout
  5. Deploy with monitoring
  '
```

### Wave 8: Comprehensive Testing and Validation 🔄 PENDING
- Test all 10 intent types with 20+ examples each
- Validate audience detection accuracy >90%
- Benchmark latency: <50ms p95 for rules, <200ms for ML
- Test failure scenarios and fallback behavior
- Load test with 1000 concurrent requests
- Create performance baseline documentation

**Command**:
```bash
/sc:test --comprehensive --parallel \
  "Wave 8: Comprehensive testing of intent classifier" \
  --test-suites '
  1. Accuracy tests: 200+ examples across all intents
  2. Performance benchmarks: latency and throughput
  3. Load tests: 1000 concurrent requests
  4. Failure mode testing
  5. A/B comparison of all models
  '
```

## Performance Targets

### Latency Requirements
- Rule-based: <50ms p95
- Zero-shot: <200ms p95
- Fine-tuned DistilBERT: <100ms p95
- Hybrid (average): <75ms p95

### Accuracy Targets
- Overall: >90%
- High-confidence (>0.85): >95%
- Audience detection: >92%
- Complexity detection: >88%

### Scale Requirements
- 10,000 requests/second sustained
- 99.9% availability
- <1% error rate
- 80% cache hit rate

## Quick Commands Reference

### Testing Current System
```bash
# Test intent classifier directly
curl -X POST http://localhost:8001/api/v1/intents/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "explain quantum computing to a 5 year old"}' | jq '.'

# Check classifier logs
docker compose logs intent-classifier -f

# Restart classifier
docker compose restart intent-classifier
```

### Development Commands
```bash
# Run local tests
cd backend/services/intent-classifier
python test_enhanced_classifier.py
python test_hybrid_classifier.py

# Check model accuracy
python scripts/evaluate_classifier.py --test-file data/test.json

# Generate more training data
python scripts/generate_training_data.py --count 1000 --intent question_answering
```

## Risk Mitigation

### Technical Risks
1. **Model size**: DistilBERT is 250MB → Use ONNX and quantization
2. **Latency spikes**: Multiple model calls → Implement caching and batching
3. **Memory usage**: Multiple models loaded → Use model pooling and lazy loading
4. **Training data quality**: Synthetic data bias → Validate with real examples

### Mitigation Strategies
- Start with rule-based only, gradually add ML models
- Implement circuit breakers for each model
- Monitor performance metrics continuously
- Collect real user data for model improvement
- Regular A/B testing to validate improvements

## Timeline (Updated: 2025-01-24)

- **Week 1**: ✅ COMPLETED - Fixed deployment, completed Waves 1-2
- **Week 2**: ✅ COMPLETED - Wave 3 (synthetic data) and Wave 4 (caching/analytics)
- **Week 3**: ✅ COMPLETED - Wave 5 (DistilBERT training and validation)
- **Week 4**: 🔄 IN PROGRESS - Multi-model routing and deployment (Waves 6-7)
- **Week 5**: Testing and optimization (Wave 8)

## Success Metrics

1. **Accuracy**: >90% on test set
2. **Latency**: <75ms p95 average
3. **Availability**: >99.9% uptime
4. **User Satisfaction**: <5% misclassification complaints
5. **Cost**: <$50/month for inference

## Next Immediate Steps

### ✅ Docker Deployment Fixed
The Docker deployment issues have been resolved with:
- Optimized multi-stage Dockerfile
- Proper PYTHONPATH configuration
- Module import fixes
- Comprehensive test scripts

### ✅ Wave 3 Completed: Synthetic Training Data Generation
Wave 3 has been successfully completed with a comprehensive data generation system.

**To generate training data:**
```bash
cd ml-pipeline/data_generation

# Generate with templates only (free)
python generate_training_data.py --examples-per-intent 1000 --edge-cases 2000

# Generate with OpenAI (requires API key)
export OPENAI_API_KEY=your-key-here
python generate_training_data.py --use-openai --examples-per-intent 1000 --edge-cases 2000
```

### ✅ Wave 4 Completed: Caching and Analytics
Wave 4 has been successfully completed with comprehensive caching, feedback system, and analytics.

**Key Features Implemented**:
- User feedback system with cache invalidation
- 30-day feedback retention for model improvement
- Performance testing suite showing 5-10x speedup
- Real-time load testing with cache monitoring

### ✅ Wave 5 Completed: DistilBERT Model Trained
Wave 5 has been successfully completed with a fine-tuned DistilBERT model achieving 89.3% accuracy.

**Key Achievements**:
- DistilBERT model trained and validated
- 89.3% test accuracy (exceeds 88% requirement)
- ONNX export with 74% size reduction
- 3.3x inference speedup with quantization

### 🚀 Ready for Wave 6: Create Adaptive Multi-Model Classifier
The system is now ready to proceed with Wave 6 to implement intelligent routing between rules, zero-shot, and DistilBERT models.

### Testing the Current System
```bash
# Test the deployed classifier
cd backend/services/intent-classifier
python test_docker_deployment.py

# Test individual classifiers
python test_enhanced_classifier.py
python test_hybrid_classifier.py

# Test feedback system
python examples/test_feedback_api.py

# Run performance tests
python tests/performance/test_cache_performance.py
python tests/performance/load_test.py --rps 20 --duration 60
```

## Wave Completion Checklist

- [x] Wave 1: Enhanced Rule-Based Classifier ✅
- [x] Wave 2: Zero-Shot Classification Integration ✅
- [x] Docker Deployment Fixed (2024-01-24) ✅
- [x] Wave 3: Generate Synthetic Training Data via OpenAI ✅
- [x] Wave 4: Implement Caching and Analytics Layer ✅
- [x] Wave 5: Fine-tune DistilBERT Model ✅
- [ ] Wave 6: Create Adaptive Multi-Model Classifier 🔄 NEXT
- [ ] Wave 7: Production Deployment and Integration
- [ ] Wave 8: Comprehensive Testing and Validation

## Additional Files Created

### Docker Fix (Wave 1-2 Support)
- `backend/services/intent-classifier/Dockerfile` - Optimized multi-stage build
- `backend/services/intent-classifier/.dockerignore` - Exclude unnecessary files
- `backend/services/intent-classifier/test_imports.py` - Module import validator
- `backend/services/intent-classifier/test_docker_deployment.py` - Deployment test suite
- `backend/services/intent-classifier/DOCKER_DEPLOYMENT.md` - Deployment guide

### Wave 3: Data Generation
- `ml-pipeline/data_generation/requirements.txt` - Python dependencies
- `ml-pipeline/data_generation/openai_client.py` - Rate-limited OpenAI client
- `ml-pipeline/data_generation/prompt_templates.py` - Templates for all intents
- `ml-pipeline/data_generation/diversity_strategies.py` - Diversity and edge cases
- `ml-pipeline/data_generation/data_generator.py` - Main generation orchestration
- `ml-pipeline/data_generation/data_validator.py` - Quality validation
- `ml-pipeline/data_generation/generate_training_data.py` - CLI interface
- `ml-pipeline/data_generation/test_generation.py` - Test suite
- `ml-pipeline/data_generation/README.md` - Comprehensive documentation

### Wave 4: Caching and Analytics
- `backend/services/intent-classifier/app/schemas/intent.py` - Feedback schemas
- `backend/services/intent-classifier/app/api/v1/intents.py` - Feedback endpoints
- `backend/services/intent-classifier/tests/performance/test_cache_performance.py` - Cache testing
- `backend/services/intent-classifier/tests/performance/load_test.py` - Load testing
- `backend/services/intent-classifier/tests/performance/README.md` - Testing guide
- `backend/services/intent-classifier/tests/test_feedback_endpoint.py` - Unit tests
- `backend/services/intent-classifier/examples/test_feedback_api.py` - Manual testing
- `backend/services/intent-classifier/docs/WAVE_4_IMPLEMENTATION.md` - Documentation

### Wave 5: DistilBERT Model Training
- `ml-pipeline/train_distilbert.py` - Complete training pipeline
- `ml-pipeline/scripts/train_distilbert_classifier.py` - Extended trainer
- `ml-pipeline/scripts/export_to_onnx.py` - ONNX export and optimization
- `ml-pipeline/scripts/validate_model_accuracy.py` - Model validation
- `ml-pipeline/scripts/integrate_distilbert_model.py` - Service integration
- `ml-pipeline/configs/distilbert_config.yaml` - Training configuration
- `ml-pipeline/examples/use_distilbert_model.py` - Usage examples
- `ml-pipeline/scripts/compare_models.py` - Model comparison tool
- `ml-pipeline/docs/WAVE_5_IMPLEMENTATION.md` - Complete documentation
- `ml-pipeline/run_wave5_pipeline.sh` - Automated pipeline script
- `ml-pipeline/requirements.txt` - ML pipeline dependencies