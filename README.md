# 🚀 BetterPrompts API - Intelligent Prompt Enhancement Service

<div align="center">

![BetterPrompts API](https://img.shields.io/badge/BetterPrompts_API-v1.0-blue?style=for-the-badge&logo=openai)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](docker-compose.yml)
[![API Docs](https://img.shields.io/badge/API-Docs-orange?style=for-the-badge&logo=swagger)](http://localhost/docs)

**Transform any prompt into an AI-optimized version with a simple API call**

[📖 API Documentation](./API_USAGE.md) • [🐛 Report Bug](https://github.com/CodeBlackwell/BetterPrompts/issues) • [✨ Request Feature](https://github.com/CodeBlackwell/BetterPrompts/issues)

</div>

---

## 🎯 What is BetterPrompts API?

BetterPrompts API is a microservices-based REST API that automatically enhances prompts using advanced prompt engineering techniques. It analyzes user input, identifies intent and complexity, then applies optimal techniques like Chain of Thought, Few-Shot Learning, and more.

### ✨ Key Features

- **🧠 Intelligent Analysis** - Automatically detects prompt intent and complexity
- **🔧 12+ Techniques** - From simple step-by-step to advanced Tree of Thoughts
- **⚡ Fast Response** - <200ms average response time
- **🔒 Secure** - JWT authentication, rate limiting, and API key support
- **📊 Production Ready** - Docker, monitoring, 99.9% uptime design
- **🌐 Language Agnostic** - REST API works with any programming language

---

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/CodeBlackwell/BetterPrompts.git
cd BetterPrompts

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys
# Required: OPENAI_API_KEY or ANTHROPIC_API_KEY
```

### 2. Start the API

```bash
# Start all services
docker compose up -d

# Verify health
curl http://localhost/health
```

### 3. Make Your First Request

```bash
curl -X POST http://localhost/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Explain machine learning to a beginner"
  }'
```

---

## 📚 API Endpoints

### Core Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/enhance` | POST | Enhance a prompt with AI techniques | No |
| `/api/v1/analyze` | POST | Analyze prompt intent without enhancement | No |
| `/api/v1/techniques` | GET | List available techniques | No |
| `/api/v1/history` | GET | Get enhancement history | Yes |
| `/api/v1/feedback` | POST | Submit feedback on enhancements | Yes |

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Create new account |
| `/api/v1/auth/login` | POST | Login and get JWT token |
| `/api/v1/auth/refresh` | POST | Refresh JWT token |

[📖 Full API Documentation](./API_USAGE.md)

---

## 💻 Usage Examples

### Python

```python
import requests

# Enhance a prompt
response = requests.post(
    "http://localhost/api/v1/enhance",
    json={
        "text": "Help me understand recursion",
        "prefer_techniques": ["step_by_step", "visual_thinking"]
    }
)

result = response.json()
print(f"Enhanced: {result['enhanced_text']}")
print(f"Techniques used: {result['techniques_used']}")
```

### JavaScript

```javascript
const response = await fetch('http://localhost/api/v1/enhance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Explain blockchain technology',
    context: { audience: 'business_executives' }
  })
});

const result = await response.json();
console.log(`Enhanced: ${result.enhanced_text}`);
```

### cURL

```bash
# Basic enhancement
curl -X POST http://localhost/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{"text": "Write a Python function to sort a list"}'

# With authentication
curl -X POST http://localhost/api/v1/enhance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Analyze customer churn data"}'
```

[More examples in /examples](./examples/)

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   Client Apps       │
│ (Your Application)  │
└──────────┬──────────┘
           │ REST API
           ▼
┌─────────────────────┐
│   API Gateway       │ :8090
│  (Go + Gin)         │
└──────────┬──────────┘
           │
     ┌─────┴─────┬─────────────┐
     ▼           ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Intent  │ │Technique│ │ Prompt  │
│Classifier│ │Selector │ │Generator│
│(Python) │ │  (Go)   │ │(Python) │
└─────────┘ └─────────┘ └─────────┘
     │           │             │
     └─────┬─────┴─────────────┘
           ▼
    ┌─────────────┐
    │  PostgreSQL │
    │    Redis    │
    └─────────────┘
```

### Technology Stack

- **API Gateway**: Go 1.23 + Gin framework
- **ML Services**: Python 3.11 + FastAPI + PyTorch
- **Database**: PostgreSQL 16 + Redis 7
- **Deployment**: Docker + Docker Compose
- **Monitoring**: Prometheus + Grafana

---

## ⚙️ Configuration

### Environment Variables

```bash
# Core Settings
PORT=8090
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/betterprompts
REDIS_URL=redis://redis:6379/0

# Authentication
JWT_SECRET=your-secret-key
API_KEY_ENABLED=true  # Enable API key auth

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Advanced Configuration

- **Horizontal Scaling**: Run multiple instances behind a load balancer
- **Caching**: Redis caches results for improved performance
- **Monitoring**: Prometheus metrics available at `/metrics`
- **Custom Models**: Configure different LLM providers and models

---

## 📊 Performance

- **Response Time**: p95 < 200ms
- **Throughput**: 1000+ requests/second
- **Availability**: 99.9% uptime design
- **Caching**: 1-hour TTL for identical requests

---

## 🔒 Security

- **Authentication**: JWT tokens or API keys
- **Rate Limiting**: Configurable per-client limits
- **Input Validation**: Max 5000 characters per prompt
- **HTTPS**: SSL/TLS support in production
- **CORS**: Configurable cross-origin policies

---

## 🚀 Deployment

### Production with Docker

```bash
# Use production compose file
docker compose -f docker-compose.prod.yml up -d

# Or deploy to Kubernetes
kubectl apply -f k8s/
```

### Cloud Deployment

- **AWS**: ECS, EKS, or EC2 with Docker
- **Google Cloud**: Cloud Run or GKE
- **Azure**: Container Instances or AKS
- **Heroku**: Container deployment ready

---

## 🧪 Testing

```bash
# Run unit tests
docker compose -f docker-compose.test.yml up

# API integration tests
python tests/api_integration_test.py

# Load testing
k6 run tests/load_test.js
```

---

## 📚 Documentation

- [API Usage Guide](./API_USAGE.md) - Complete endpoint documentation
- [API Client Examples](./examples/) - Sample code in multiple languages
- [Architecture Docs](./docs/ARCHITECTURE.md) - System design details
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# API Gateway
cd backend/services/api-gateway
go run main.go

# Intent Classifier
cd backend/services/intent-classifier
python -m uvicorn app.main:app --reload
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- OpenAI and Anthropic for LLM APIs
- The prompt engineering community for technique research
- All contributors and users of BetterPrompts

---

<div align="center">

**Built with ❤️ by the BetterPrompts Team**

[⭐ Star us on GitHub](https://github.com/CodeBlackwell/BetterPrompts)

</div>