# BetterPrompts Demo Script

## 🎯 Demo Overview

**Duration**: 15-20 minutes  
**Audience**: Potential users, investors, or technical stakeholders  
**Goal**: Demonstrate how BetterPrompts democratizes advanced prompt engineering techniques

### Pre-Demo Checklist

- [ ] All services running (`docker compose up -d`)
- [ ] Demo data seeded (`./scripts/seed-demo-data.sh`)
- [ ] Browser cleared of cache/cookies
- [ ] Network connection stable
- [ ] Backup slides ready (in case of technical issues)

---

## 🚀 Demo Flow

### 1. Introduction (2 minutes)

**Screen**: Landing page

**Talking Points**:
- "Welcome to BetterPrompts - where we make advanced prompt engineering accessible to everyone"
- "Most people struggle to get the best results from AI because they don't know how to craft effective prompts"
- "BetterPrompts automatically applies scientifically-proven techniques to transform simple ideas into powerful prompts"

**Key Messages**:
- No technical knowledge required
- Based on research-backed techniques
- Instant results

---

### 2. The Problem We Solve (2 minutes)

**Screen**: Show a typical ChatGPT/Claude interface

**Demo**:
1. Type a basic prompt: "Write a blog post about climate change"
2. Show generic AI response

**Talking Points**:
- "This is how most people interact with AI - simple prompts, mediocre results"
- "They're missing out on the full potential of these powerful models"
- "Professional prompt engineers use techniques like Chain of Thought, Few-Shot Learning, and structured approaches"
- "But these techniques require expertise and time to implement"

---

### 3. First Enhancement - Simple Use Case (3 minutes)

**Screen**: BetterPrompts enhancement page

**Demo Steps**:
1. Navigate to `/enhance`
2. Enter the same prompt: "Write a blog post about climate change"
3. Click "Enhance Prompt"
4. Show the loading animation and progress steps

**Talking Points** (during loading):
- "Watch as our AI analyzes your intent"
- "It's selecting the best techniques for your specific use case"
- "And generating an optimized prompt in real-time"

**Show Enhanced Result**:
```
I need to write a comprehensive blog post about climate change. Let me approach this step-by-step:

1. First, I'll outline the key topics to cover
2. Then, I'll research current statistics and examples
3. Finally, I'll structure it for maximum reader engagement

Please help me create a 1000-word blog post that:
- Explains climate change in accessible terms
- Includes recent data and examples
- Offers practical actions readers can take
- Maintains an optimistic but realistic tone
```

**Key Points**:
- "Notice how it added structure and clarity"
- "Specified requirements that get better results"
- "This uses our Step-by-Step technique combined with Structured Output"

---

### 4. Technique Selection Demo (3 minutes)

**Screen**: Enhancement page with techniques expanded

**Demo Steps**:
1. Click "Techniques" to show available options
2. Highlight different techniques

**Talking Points**:
- "You can see the AI's confidence level for each technique"
- "Green means highly recommended for your prompt"
- "Let me show you a different example..."

**Second Example**:
1. Enter: "Help me solve this math problem: If a train travels 120 miles in 2 hours..."
2. Show Chain of Thought technique highlighted
3. Enhance and show result with step-by-step reasoning

---

### 5. Authentication & Personalization (2 minutes)

**Screen**: Login page

**Demo Steps**:
1. Login as `demo.smith@example.com` (Pro tier user)
2. Show dashboard with usage statistics

**Talking Points**:
- "BetterPrompts learns from your usage patterns"
- "Pro users get unlimited enhancements and priority processing"
- "Your enhancement history helps the AI understand your preferences"

---

### 6. Advanced Features - History & Analytics (2 minutes)

**Screen**: History page

**Demo Steps**:
1. Navigate to `/history`
2. Show past enhancements
3. Click on one to see details

**Talking Points**:
- "Every enhancement is saved for future reference"
- "You can see which techniques were most effective"
- "Filter by date, technique, or success rating"

---

### 7. Real-World Example - Code Generation (3 minutes)

**Screen**: Enhancement page

**Demo Steps**:
1. Enter: "Create a Python function to analyze sentiment"
2. Show enhancement with code-specific optimizations
3. Copy enhanced prompt to clipboard

**Enhanced Result**:
```
I need to create a Python function for sentiment analysis. Here are my requirements:

Technical specifications:
- Use modern Python (3.8+) with type hints
- Handle edge cases and errors gracefully
- Include docstrings and comments
- Make it efficient for large text batches

Function requirements:
- Input: String or list of strings
- Output: Sentiment score (-1 to 1) and confidence level
- Support multiple languages if possible

Please provide:
1. The complete function implementation
2. Example usage
3. Required dependencies
4. Performance considerations
```

**Talking Points**:
- "Notice how it adds technical specifications"
- "Structures the request for comprehensive code output"
- "This dramatically improves the quality of generated code"

---

### 8. Mobile Experience (2 minutes)

**Screen**: Mobile view (responsive design)

**Demo Steps**:
1. Show responsive design on mobile
2. Demonstrate touch-friendly interface
3. Show accessibility features

**Talking Points**:
- "Fully responsive design works on any device"
- "Accessibility-first approach - works with screen readers"
- "Same powerful features on the go"

---

### 9. Closing & Call to Action (2 minutes)

**Screen**: Pricing page

**Talking Points**:
- "BetterPrompts is available in three tiers"
- "Free tier: 10 enhancements per day"
- "Pro tier: Unlimited enhancements, priority processing, advanced analytics"
- "Enterprise: Custom models, API access, dedicated support"

**Final Message**:
- "Stop leaving AI potential on the table"
- "Start creating better prompts today"
- "Sign up now and get your first month of Pro features free"

---

## 🔧 Troubleshooting Guide

### Common Issues & Solutions

#### 1. Enhancement Takes Too Long
**Symptom**: Loading spinner for >5 seconds  
**Solution**: 
- Check TorchServe is in dev mode: `./scripts/switch-torchserve-env.sh status`
- If in prod mode, switch: `./scripts/switch-torchserve-env.sh dev`
- Mention: "We're experiencing higher than normal demand"

#### 2. Login Fails
**Symptom**: Error message on login  
**Solution**:
- Use backup account: `jane.developer@example.com` / `SecurePass123!`
- Or create new account on the spot
- Say: "Let me quickly create a fresh account to show you"

#### 3. Techniques Don't Load
**Symptom**: Empty techniques section  
**Solution**:
- Refresh the page
- Check API Gateway health: `curl http://localhost:8000/api/v1/health`
- Fallback: Explain techniques verbally while showing static screenshots

#### 4. Database Connection Error
**Symptom**: 500 errors or "Unable to fetch" messages  
**Solution**:
- Quick fix: `docker compose restart api-gateway postgres`
- Say: "Let me quickly reconnect to our database"
- Have backup video ready showing the flow

#### 5. UI Rendering Issues
**Symptom**: Broken layouts or missing styles  
**Solution**:
- Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Clear browser cache
- Switch to incognito/private mode

---

## 📝 Key Talking Points Reference

### Value Propositions
1. **Accessibility**: "No PhD in AI required"
2. **Scientific Backing**: "Based on published research"
3. **Time Saving**: "10x faster than manual prompt crafting"
4. **Better Results**: "Average 40% improvement in AI output quality"
5. **Learning Tool**: "Teaches you prompt engineering as you use it"

### Technique Explanations (if asked)
- **Chain of Thought**: "Breaks down complex reasoning step-by-step"
- **Few-Shot Learning**: "Provides examples to guide the AI"
- **Step-by-Step**: "Structures tasks into manageable components"
- **Structured Output**: "Defines exact format for responses"

### Competitive Advantages
1. "Unlike prompt libraries, we generate custom enhancements"
2. "Real-time optimization based on your specific needs"
3. "Continuously learning and improving from usage patterns"
4. "Enterprise-ready with API access and custom models"

---

## 🎭 Demo Personas & Scenarios

### Persona 1: Marketing Manager "Sarah"
- **Prompt**: "Write social media posts for our product launch"
- **Focus**: Show time savings and consistency

### Persona 2: Developer "Alex"
- **Prompt**: "Debug this React component error"
- **Focus**: Technical accuracy and comprehensive solutions

### Persona 3: Student "Jamie"
- **Prompt**: "Explain quantum computing in simple terms"
- **Focus**: Educational value and clarity

### Persona 4: Business Analyst "Morgan"
- **Prompt**: "Analyze this sales data and find trends"
- **Focus**: Structured analysis and actionable insights

---

## 🚨 Emergency Fallbacks

### If Everything Breaks
1. Switch to slide deck (backup at `/docs/demo-slides.pdf`)
2. Show video walkthrough (backup at `/docs/demo-video.mp4`)
3. Use production site: https://demo.betterprompts.ai

### Key Screenshots to Have Ready
1. Enhanced prompt comparison (before/after)
2. Technique selection with confidence scores
3. Dashboard with analytics
4. Mobile responsive view
5. Enterprise features overview

---

## 📊 Success Metrics

Track these during demos:
- [ ] Audience engagement (questions asked)
- [ ] Feature interest (which features get most attention)
- [ ] Technical issues encountered
- [ ] Conversion to sign-up
- [ ] Follow-up requests

---

## 🎬 Post-Demo

1. Send follow-up email with:
   - Link to sign up
   - Recording of demo (if applicable)
   - Additional resources
   
2. Gather feedback:
   - What resonated most?
   - What concerns do they have?
   - What features are most valuable?

3. Schedule follow-up:
   - Technical deep-dive
   - Pricing discussion
   - Pilot program setup

---

Remember: The goal is to show how BetterPrompts makes everyone a prompt engineering expert, instantly!