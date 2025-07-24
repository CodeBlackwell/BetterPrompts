# BetterPrompts Demo Environment Checklist

Use this checklist to ensure the demo environment is properly set up and validated before any demonstration.

## 🚨 Pre-Demo Critical Fixes

- [ ] **Fix Enhancement Pipeline** (REQUIRED)
  ```go
  // In backend/services/api-gateway/internal/handlers/enhance.go line ~110
  Context: map[string]interface{}{"enhanced": true}
  ```
  - [ ] Apply fix to enhance.go and enhance_optimized.go
  - [ ] Rebuild: `docker compose build api-gateway`
  - [ ] Restart: `docker compose restart api-gateway`
  - [ ] Verify enhancement actually works

## 📋 Environment Setup (1 Hour Before Demo)

### 1. System Requirements
- [ ] Docker Desktop running with 8GB+ RAM allocated
- [ ] Ports available: 80, 3000, 8090, 8001-8003, 5432, 6379, 9090, 3001
- [ ] 10GB+ free disk space
- [ ] Stable internet connection

### 2. Initial Setup (30 minutes)
- [ ] Clone latest code from repository
- [ ] Copy `.env.example` to `.env` and configure:
  ```bash
  JWT_SECRET_KEY=your-secret-key-here
  JWT_REFRESH_SECRET_KEY=your-refresh-secret-key-here
  DATABASE_URL=postgres://betterprompts:betterprompts@postgres:5432/betterprompts?sslmode=disable
  REDIS_URL=redis:6379
  ```

### 3. Build and Start Services (20 minutes)
- [ ] Run: `docker compose down -v` (clean slate)
- [ ] Run: `docker compose build --no-cache` (fresh build)
- [ ] Run: `docker compose up -d`
- [ ] Wait 2 minutes for all services to initialize
- [ ] Run: `docker compose ps` (verify all are "Up")

### 4. Health Verification (10 minutes)
- [ ] API Gateway: `curl http://localhost/health` → Should return `{"status":"healthy"}`
- [ ] Frontend: Open http://localhost:3000 → Should load without errors
- [ ] Monitoring: Open http://localhost:3001 (Grafana admin/admin)
- [ ] All services healthy in `docker compose ps`

## 🧪 Functionality Testing (30 minutes before demo)

### 1. Create Demo User
- [ ] Run database migrations:
  ```bash
  docker compose exec api-gateway ./migrate -database $DATABASE_URL -path migrations up
  ```
- [ ] Create user via API or UI:
  ```bash
  curl -X POST http://localhost/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "demo@betterprompts.ai",
      "username": "demo",
      "password": "DemoPass123!",
      "confirm_password": "DemoPass123!"
    }'
  ```

### 2. Test Core Enhancement Flow
- [ ] **Login**: 
  ```bash
  curl -X POST http://localhost/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email_or_username": "demo", "password": "DemoPass123!"}'
  # Save the access_token from response
  ```

- [ ] **Enhance Prompt** (MUST return different text):
  ```bash
  curl -X POST http://localhost/api/v1/enhance \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "explain machine learning"}'
  ```
  - [ ] Verify `enhanced_text` is different from `original_text`
  - [ ] Verify `techniques_used` array is not empty
  - [ ] Response time < 500ms

- [ ] **View History**:
  ```bash
  curl http://localhost/api/v1/history \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

### 3. Test UI Flow
- [ ] Navigate to http://localhost:3000
- [ ] Click "Get Started" or "Login"
- [ ] Login with demo credentials
- [ ] Enter a prompt in the enhancement box
- [ ] Click "Enhance"
- [ ] Verify enhanced result appears
- [ ] Check technique cards are displayed
- [ ] Test feedback buttons (thumbs up/down)

## 🎯 Demo Scenarios Validation

### Scenario 1: First-Time User
- [ ] Register new account
- [ ] Complete email verification (if enabled)
- [ ] Enhance first prompt
- [ ] View explanation of techniques used

### Scenario 2: Power User
- [ ] Login with existing account
- [ ] Enhance complex prompt
- [ ] Select specific techniques
- [ ] View history
- [ ] Provide feedback

### Scenario 3: API Developer
- [ ] Show API documentation
- [ ] Demonstrate REST endpoints
- [ ] Show authentication flow
- [ ] Display rate limiting

## 🔍 Performance Validation

- [ ] Enhancement response < 500ms
- [ ] Page load time < 3 seconds
- [ ] No console errors in browser
- [ ] Memory usage stable (check `docker stats`)
- [ ] Database queries < 50ms (check logs)

## 🛠️ Demo Day Setup (30 minutes before)

### Terminal Setup
Open 4 terminal windows:

**Terminal 1 - Main Control**:
```bash
cd /path/to/BetterPrompts
docker compose ps
```

**Terminal 2 - API Logs**:
```bash
docker compose logs -f api-gateway prompt-generator
```

**Terminal 3 - Performance Monitor**:
```bash
watch -n 2 'docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"'
```

**Terminal 4 - Emergency Commands**:
```bash
# Ready to run if needed:
# docker compose restart api-gateway
# docker compose restart frontend
# docker compose logs --tail=50 [service-name]
```

### Browser Setup
- [ ] Tab 1: http://localhost:3000 (Main app)
- [ ] Tab 2: http://localhost:3001 (Grafana monitoring)
- [ ] Tab 3: http://localhost/api/v1/health (API health)
- [ ] Tab 4: This checklist for reference

### Demo Data Preparation
- [ ] 3-5 example prompts ready to paste:
  - Simple: "explain quantum computing"
  - Medium: "write a Python function to sort a list"
  - Complex: "design a microservices architecture for an e-commerce platform"
- [ ] Demo user credentials saved
- [ ] API token ready for Postman/curl demos

## 🚑 Emergency Procedures

### If Enhancement Stops Working
```bash
docker compose restart api-gateway prompt-generator
# Wait 30 seconds
# Test with curl command from above
```

### If Frontend Shows Errors
```bash
docker compose restart frontend nginx
# Clear browser cache
# Try incognito mode
```

### If Database Issues
```bash
docker compose restart postgres
sleep 10
docker compose restart api-gateway
```

### Complete Reset (Nuclear Option)
```bash
docker compose down
docker volume prune -f
docker compose up -d
# Note: This will delete all data!
```

## ✅ Final Checks (5 minutes before demo)

- [ ] All services show "Up" in `docker compose ps`
- [ ] Enhancement returns meaningful results
- [ ] UI loads without console errors
- [ ] Demo user can login successfully
- [ ] History shows previous enhancements
- [ ] Feedback buttons work
- [ ] No error logs in past 5 minutes
- [ ] System resources < 70% utilization
- [ ] Backup plan ready if demo fails

## 📝 Demo Talk Track Ready

- [ ] Introduction: Problem statement and solution
- [ ] Live Demo: Show enhancement flow
- [ ] Technical Deep Dive: Architecture diagram ready
- [ ] Q&A: Common questions and answers prepared

## 🎉 Post-Demo

- [ ] Thank audience
- [ ] Share GitHub repository link
- [ ] Provide contact information
- [ ] Stop recording (if applicable)
- [ ] Save chat questions for follow-up
- [ ] Celebrate successful demo! 🎊

---

**Remember**: The enhancement feature is the heart of the demo. If it's not working properly, the demo cannot proceed. Always verify it works before starting!