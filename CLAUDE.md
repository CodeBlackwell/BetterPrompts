# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BetterPrompts is a Prompt Engineering Assistant project designed to democratize advanced prompt engineering techniques for non-technical users. The system analyzes natural language input and automatically suggests or applies optimal prompting strategies (Chain of Thought, Tree of Thoughts, Few-shot learning, etc.) without requiring users to understand the underlying techniques.

## Project Status

**Current Phase**: Implementation (Phase 6)  
**Progress**: ~50% Complete  
**Last Updated**: July 18, 2025

The project has moved from planning to active implementation with significant infrastructure and services already built.

## Repository Structure

```
BetterPrompts/
├── backend/                    # Backend services
│   └── services/
│       ├── api-gateway/       # Go/Gin API gateway (85% complete)
│       ├── intent-classifier/ # Python/FastAPI ML service (structure only)
│       ├── technique-selector/# Go/Gin technique selection (100% complete)
│       └── prompt-generator/  # Python/FastAPI generation (structure only)
├── frontend/                  # Next.js UI application (70% complete)
├── ml-pipeline/              # ML training infrastructure
│   ├── configs/              # Training configurations
│   ├── data/                 # Data processing pipelines
│   ├── models/               # Model architectures
│   └── scripts/              # Training and evaluation scripts
├── infrastructure/           # Deployment and operations
│   └── model-serving/        # TorchServe infrastructure (100% complete)
│       ├── kubernetes/       # K8s manifests with HPA
│       ├── docker/           # Docker configurations
│       ├── monitoring/       # Prometheus/Grafana setup
│       └── gateway/          # API gateway configs
├── docker/                   # Docker configurations for all services
│   ├── frontend/            # Next.js Dockerfile
│   ├── backend/             # Service-specific Dockerfiles
│   └── nginx/               # Reverse proxy configuration
├── planning/                 # Architecture and design documents
│   ├── sc_plans/            # SuperClaude command plans
│   └── *.md                 # Design documents
├── docker-compose.yml        # Local development setup
├── docker-compose.prod.yml   # Production deployment
└── .env.example             # Environment configuration template
```

## Key Architecture Decisions

### Technology Stack
- **Frontend**: Next.js 14+ with TypeScript, React 18+, Tailwind CSS, Shadcn/ui
- **Backend Services**:
  - API Gateway: Go 1.23+ with Gin (JWT auth, rate limiting, CORS)
  - Intent Classification Service: Python 3.11+ with FastAPI
  - Technique Selection Engine: Go 1.23+ with Gin
  - Prompt Generation Service: Python 3.11+ with FastAPI
- **Databases**: PostgreSQL 16 with pgvector, Redis 7 (cache/sessions)
- **ML Stack**: 
  - Training: DeBERTa-v3, PyTorch, MLflow, DVC, Optuna
  - Serving: TorchServe with GPU support, custom handlers
- **Infrastructure**: 
  - Containers: Docker with multi-stage builds
  - Orchestration: Kubernetes with HPA
  - Monitoring: Prometheus + Grafana
  - API Gateway: Nginx (with Kong/Traefik alternatives)

### Core Components
1. **Intent Classification Engine**: Analyzes user input to identify task type and complexity
2. **Technique Selection Engine**: Matches intents to optimal prompt engineering techniques
3. **Prompt Generation Service**: Applies techniques to generate enhanced prompts
4. **User Interface**: Simple input with technique suggestions and educational tooltips
5. **Learning Component**: Tracks technique effectiveness and personalizes recommendations

## Development Commands

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/your-org/betterprompts.git
cd betterprompts

# Setup environment
cp .env.example .env
# Edit .env with your configuration (API keys, database credentials)

# Validate Docker setup
./docker/validate.sh
```

### Local Development with Docker
```bash
# Build all services
docker compose build

# Start all services
docker compose up -d

# Check service health
docker compose ps
docker compose logs -f [service-name]

# Access services:
# - Frontend: http://localhost:3000
# - API Gateway: http://localhost/api/v1
# - Grafana: http://localhost:3001 (admin/admin)
# - Prometheus: http://localhost:9090
```

### Individual Service Development
```bash
# API Gateway (Go)
cd backend/services/api-gateway
go mod download
go run cmd/server/main.go

# Intent Classifier (Python)
cd backend/services/intent-classifier
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Frontend (Next.js)
cd frontend
npm install
npm run dev

# ML Pipeline
cd ml-pipeline
pip install -r requirements.txt
python scripts/train_intent_classifier.py
```

### Testing
```bash
# Run all tests
docker compose -f docker-compose.test.yml up

# Unit tests for specific service
cd backend/services/api-gateway
go test ./...

# Frontend tests
cd frontend
npm run test
npm run test:e2e
```

## Implementation Status

### ✅ Completed Components (~50%)
- **Frontend UI**: 70% - All major components built, missing API integration
- **API Gateway**: 85% - JWT auth, rate limiting, middleware stack complete
- **Technique Selector**: 100% - Rule-based engine with effectiveness scoring
- **ML Pipeline**: Training infrastructure with DeBERTa-v3 ready
- **TorchServe**: 100% - Production-ready model serving with GPU support
- **Docker Setup**: All services containerized with security best practices
- **Monitoring**: Prometheus + Grafana integrated

### 🔄 In Progress
- **ML Integration**: Connecting intent classifier to TorchServe (0%)
- **Prompt Generation**: Basic structure done, logic implementation needed (20%)

### 📋 Pending
- **Testing**: No tests written yet (0% coverage)
- **Kubernetes**: Application manifests (TorchServe K8s done)
- **CI/CD**: GitHub Actions pipeline setup
- **Documentation**: User guides and API docs

## Key Design Patterns

### Domain-Driven Design
The system is organized into bounded contexts:
- **UserManagement**: Authentication, profiles, preferences
- **PromptEngineering**: Intent classification, technique selection, prompt generation
- **Learning**: Feedback processing, personalization, model training
- **Analytics**: Metrics, reporting, business intelligence

### API Design
RESTful endpoints with potential GraphQL layer:
- `POST /api/v1/enhance` - Main enhancement endpoint
- `POST /api/v1/analyze` - Intent analysis
- `GET /api/v1/techniques` - Available techniques

### Security Considerations
- JWT authentication with refresh tokens
- End-to-end encryption for sensitive data
- Role-based access control (RBAC)
- API rate limiting by tier
- SOC 2 compliance target

## Performance Requirements

- **API Response Time**: p95 < 200ms
- **Model Inference**: p95 < 500ms
- **Availability**: 99.9% uptime SLA
- **Throughput**: 10,000 sustained RPS

## ML Model Management

- Intent classifier based on fine-tuned DeBERTa-v3
- Initial target: 80% accuracy, improving to 90%+ 
- A/B testing framework for model improvements
- Drift detection and monitoring

## Testing Strategy

When implemented, the project will include:
- Unit tests for all services
- Integration tests for API endpoints
- E2E tests for critical user flows
- ML model validation pipeline
- Performance benchmarking

## Critical Next Steps

### 🚨 Highest Priority (Blocking Issues)
1. **ML Model Integration**: Connect intent-classifier service to TorchServe endpoint
   ```bash
   # The TorchServe infrastructure is ready at:
   # - Local: http://localhost:8080/predictions/intent_classifier
   # - K8s: http://torchserve.model-serving:8080/predictions/intent_classifier
   ```

2. **Prompt Generation Logic**: Implement actual technique application
   - Complete the 10 technique implementations in `backend/services/prompt-generator/app/techniques/`
   - Add technique chaining and context awareness

### Development Tips

1. **Use Docker Compose** for local development - all services are configured
2. **Check service health** endpoints before integrating:
   - API Gateway: `http://localhost/health`
   - TorchServe: `http://localhost:8080/ping`
   - Each service: `http://localhost/api/v1/{service}/health`

3. **Environment Variables**: Copy `.env.example` to `.env` and configure:
   - `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for LLM integration
   - Database credentials (default: betterprompts/betterprompts)
   - JWT secret for authentication

4. **Model Deployment**:
   ```bash
   # Deploy trained model to TorchServe
   cd infrastructure/model-serving
   ./scripts/deploy.sh staging 1.0.0 rolling
   ```

## Project Metrics

- **Timeline**: 10-12 weeks to completion from current state
- **Budget**: ~$1.3M total, $245K/month operational
- **Performance Targets**: <200ms API response, <500ms inference
- **Scale**: 10,000 RPS sustained, 99.9% uptime SLA

## Development Considerations

- **Local Development Notes**:
  - Remember that we don't use TorchServe in the local development. Still write tests, configurations etc for production environment, but note that we don't use it locally

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
ALWAYS proactively create and UPDATE documentation files (*.md) or README files. 