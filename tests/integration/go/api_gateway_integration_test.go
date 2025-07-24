package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// APIGatewayIntegrationSuite tests the integration between API Gateway and backend services
type APIGatewayIntegrationSuite struct {
	suite.Suite
	apiGateway         *httptest.Server
	mockIntentService  *httptest.Server
	mockTechniqueService *httptest.Server
	mockPromptService  *httptest.Server
	authToken          string
}

// SetupSuite runs before all tests
func (s *APIGatewayIntegrationSuite) SetupSuite() {
	// Set up mock backend services
	s.setupMockIntentClassifier()
	s.setupMockTechniqueSelector()
	s.setupMockPromptGenerator()

	// In a real integration test, we would start the actual API Gateway
	// For this example, we'll simulate it
	s.setupAPIGateway()
}

// TearDownSuite runs after all tests
func (s *APIGatewayIntegrationSuite) TearDownSuite() {
	if s.apiGateway != nil {
		s.apiGateway.Close()
	}
	if s.mockIntentService != nil {
		s.mockIntentService.Close()
	}
	if s.mockTechniqueService != nil {
		s.mockTechniqueService.Close()
	}
	if s.mockPromptService != nil {
		s.mockPromptService.Close()
	}
}

// setupMockIntentClassifier creates a mock intent classification service
func (s *APIGatewayIntegrationSuite) setupMockIntentClassifier() {
	router := gin.New()
	
	router.POST("/api/v1/intents/classify", func(c *gin.Context) {
		var req map[string]string
		c.BindJSON(&req)
		
		// Simulate different responses based on input
		text := req["text"]
		var response map[string]interface{}
		
		switch {
		case strings.Contains(text, "error"):
			c.JSON(http.StatusInternalServerError, gin.H{"error": "classification failed"})
			return
		case strings.Contains(text, "timeout"):
			time.Sleep(15 * time.Second) // Simulate timeout
			return
		case strings.Contains(text, "explain"):
			response = map[string]interface{}{
				"intent":     "explanation",
				"confidence": 0.95,
				"complexity": "moderate",
				"suggested_techniques": []string{"chain_of_thought", "few_shot"},
			}
		default:
			response = map[string]interface{}{
				"intent":     "general",
				"confidence": 0.85,
				"complexity": "simple",
				"suggested_techniques": []string{"chain_of_thought"},
			}
		}
		
		c.JSON(http.StatusOK, response)
	})
	
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	
	s.mockIntentService = httptest.NewServer(router)
}

// setupMockTechniqueSelector creates a mock technique selection service
func (s *APIGatewayIntegrationSuite) setupMockTechniqueSelector() {
	router := gin.New()
	
	router.POST("/api/v1/select", func(c *gin.Context) {
		var req map[string]interface{}
		c.BindJSON(&req)
		
		// Simulate different responses based on intent
		intent := req["intent"].(string)
		
		switch intent {
		case "error":
			c.JSON(http.StatusInternalServerError, gin.H{"error": "selection failed"})
			return
		case "explanation":
			c.JSON(http.StatusOK, gin.H{
				"techniques": []map[string]interface{}{
					{
						"id":          "chain_of_thought",
						"name":        "Chain of Thought",
						"priority":    1,
						"confidence":  0.9,
					},
					{
						"id":          "few_shot",
						"name":        "Few-Shot Learning",
						"priority":    2,
						"confidence":  0.8,
					},
				},
				"primary_technique": "chain_of_thought",
				"confidence":        0.9,
			})
		default:
			c.JSON(http.StatusOK, gin.H{
				"techniques": []map[string]interface{}{
					{
						"id":          "chain_of_thought",
						"name":        "Chain of Thought",
						"priority":    1,
						"confidence":  0.85,
					},
				},
				"primary_technique": "chain_of_thought",
				"confidence":        0.85,
			})
		}
	})
	
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	
	s.mockTechniqueService = httptest.NewServer(router)
}

// setupMockPromptGenerator creates a mock prompt generation service
func (s *APIGatewayIntegrationSuite) setupMockPromptGenerator() {
	router := gin.New()
	
	router.POST("/api/v1/generate", func(c *gin.Context) {
		var req map[string]interface{}
		c.BindJSON(&req)
		
		// Check for error scenarios
		if strings.Contains(req["text"].(string), "error") {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "generation failed"})
			return
		}
		
		// Generate enhanced prompt based on techniques
		techniques := req["techniques"].([]interface{})
		enhancedPrompt := fmt.Sprintf("Enhanced with %d techniques: %s", len(techniques), req["text"])
		
		c.JSON(http.StatusOK, gin.H{
			"enhanced_prompt": enhancedPrompt,
			"techniques_applied": techniques,
			"metadata": map[string]interface{}{
				"processing_time": 150,
				"token_count":     len(enhancedPrompt),
			},
		})
	})
	
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	
	s.mockPromptService = httptest.NewServer(router)
}

// setupAPIGateway creates the API Gateway server with proper configuration
func (s *APIGatewayIntegrationSuite) setupAPIGateway() {
	// In a real test, we would start the actual API Gateway
	// For now, we'll create a simple mock that forwards requests
	router := gin.New()
	
	// Health endpoints
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	
	router.GET("/health/ready", func(c *gin.Context) {
		// Check all services
		services := map[string]string{
			"intent_classifier": s.mockIntentService.URL + "/health",
			"technique_selector": s.mockTechniqueService.URL + "/health",
			"prompt_generator": s.mockPromptService.URL + "/health",
		}
		
		ready := true
		serviceStatus := make(map[string]string)
		
		for name, url := range services {
			resp, err := http.Get(url)
			if err != nil || resp.StatusCode != http.StatusOK {
				ready = false
				serviceStatus[name] = "unhealthy"
			} else {
				serviceStatus[name] = "healthy"
			}
		}
		
		if ready {
			c.JSON(http.StatusOK, gin.H{"ready": true, "services": serviceStatus})
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"ready": false, "services": serviceStatus})
		}
	})
	
	// Main enhancement endpoint
	router.POST("/api/v1/enhance", func(c *gin.Context) {
		var req map[string]interface{}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		text := req["text"].(string)
		
		// Step 1: Classify intent
		intentResp, err := s.callIntentClassifier(text)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "intent classification failed"})
			return
		}
		
		// Step 2: Select techniques
		techniqueResp, err := s.callTechniqueSelector(text, intentResp)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "technique selection failed"})
			return
		}
		
		// Step 3: Generate enhanced prompt
		promptResp, err := s.callPromptGenerator(text, techniqueResp)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "prompt generation failed"})
			return
		}
		
		c.JSON(http.StatusOK, promptResp)
	})
	
	// Auth endpoints
	router.POST("/api/v1/auth/register", func(c *gin.Context) {
		var req map[string]string
		c.BindJSON(&req)
		
		// Simple mock registration
		c.JSON(http.StatusCreated, gin.H{
			"id": "user123",
			"email": req["email"],
			"token": "mock-jwt-token",
		})
	})
	
	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		var req map[string]string
		c.BindJSON(&req)
		
		// Check credentials
		if req["email"] == "test@example.com" && req["password"] == "password123" {
			c.JSON(http.StatusOK, gin.H{
				"token": "mock-jwt-token",
				"refresh_token": "mock-refresh-token",
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		}
	})
	
	s.apiGateway = httptest.NewServer(router)
}

// Helper methods for calling services
func (s *APIGatewayIntegrationSuite) callIntentClassifier(text string) (map[string]interface{}, error) {
	reqBody, _ := json.Marshal(map[string]string{"text": text})
	resp, err := http.Post(s.mockIntentService.URL+"/api/v1/intents/classify", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func (s *APIGatewayIntegrationSuite) callTechniqueSelector(text string, intentData map[string]interface{}) (map[string]interface{}, error) {
	reqBody, _ := json.Marshal(map[string]interface{}{
		"text":       text,
		"intent":     intentData["intent"],
		"complexity": intentData["complexity"],
	})
	
	resp, err := http.Post(s.mockTechniqueService.URL+"/api/v1/select", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func (s *APIGatewayIntegrationSuite) callPromptGenerator(text string, techniqueData map[string]interface{}) (map[string]interface{}, error) {
	techniques := techniqueData["techniques"].([]interface{})
	techniqueIDs := make([]string, len(techniques))
	for i, t := range techniques {
		techniqueIDs[i] = t.(map[string]interface{})["id"].(string)
	}
	
	reqBody, _ := json.Marshal(map[string]interface{}{
		"text":       text,
		"techniques": techniqueIDs,
	})
	
	resp, err := http.Post(s.mockPromptService.URL+"/api/v1/generate", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// Test Cases

func (s *APIGatewayIntegrationSuite) TestHealthChecks() {
	// Test basic health endpoint
	resp, err := http.Get(s.apiGateway.URL + "/health")
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	
	// Test readiness endpoint
	resp, err = http.Get(s.apiGateway.URL + "/health/ready")
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	
	var readiness map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&readiness)
	assert.True(s.T(), readiness["ready"].(bool))
}

func (s *APIGatewayIntegrationSuite) TestCompleteEnhancementPipeline() {
	// Test the full enhancement flow
	reqBody, _ := json.Marshal(map[string]interface{}{
		"text": "explain quantum computing",
	})
	
	resp, err := http.Post(s.apiGateway.URL+"/api/v1/enhance", "application/json", bytes.NewReader(reqBody))
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	// Verify the response contains expected fields
	assert.Contains(s.T(), result, "enhanced_prompt")
	assert.Contains(s.T(), result, "techniques_applied")
	assert.Contains(s.T(), result, "metadata")
	
	// Verify techniques were applied
	techniques := result["techniques_applied"].([]interface{})
	assert.GreaterOrEqual(s.T(), len(techniques), 1)
}

func (s *APIGatewayIntegrationSuite) TestErrorPropagation() {
	// Test error handling when a service fails
	reqBody, _ := json.Marshal(map[string]interface{}{
		"text": "trigger error in classification",
	})
	
	resp, err := http.Post(s.apiGateway.URL+"/api/v1/enhance", "application/json", bytes.NewReader(reqBody))
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusInternalServerError, resp.StatusCode)
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Contains(s.T(), result, "error")
}

func (s *APIGatewayIntegrationSuite) TestAuthenticationFlow() {
	// Test registration
	regBody, _ := json.Marshal(map[string]interface{}{
		"email":    "newuser@example.com",
		"password": "securepassword123",
		"name":     "New User",
	})
	
	resp, err := http.Post(s.apiGateway.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(regBody))
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusCreated, resp.StatusCode)
	
	// Test login
	loginBody, _ := json.Marshal(map[string]interface{}{
		"email":    "test@example.com",
		"password": "password123",
	})
	
	resp, err = http.Post(s.apiGateway.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(loginBody))
	require.NoError(s.T(), err)
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	
	var loginResult map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginResult)
	assert.Contains(s.T(), loginResult, "token")
	assert.Contains(s.T(), loginResult, "refresh_token")
}

func (s *APIGatewayIntegrationSuite) TestServiceTimeout() {
	// Test timeout handling
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	
	reqBody, _ := json.Marshal(map[string]interface{}{
		"text": "trigger timeout",
	})
	
	req, _ := http.NewRequestWithContext(ctx, "POST", s.apiGateway.URL+"/api/v1/enhance", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	
	// Should timeout or return error
	if err == nil {
		assert.Equal(s.T(), http.StatusInternalServerError, resp.StatusCode)
	} else {
		assert.Contains(s.T(), err.Error(), "context deadline exceeded")
	}
}

// TestApiGatewayIntegration runs the test suite
func TestApiGatewayIntegration(t *testing.T) {
	suite.Run(t, new(APIGatewayIntegrationSuite))
}