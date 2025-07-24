package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/betterprompts/api-gateway/internal/handlers"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type ValidationTestSuite struct {
	suite.Suite
	router *gin.Engine
	logger *logrus.Logger
}

func (suite *ValidationTestSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	suite.logger = logrus.New()
	suite.logger.Out = nil // Disable logging during tests
	
	// Setup router with required middleware
	suite.router = gin.New()
	suite.router.Use(func(c *gin.Context) {
		entry := suite.logger.WithField("request_id", "test-request-id")
		c.Set("logger", entry)
		c.Set("request_id", "test-request-id")
		c.Next()
	})
}

// Helper function
func (suite *ValidationTestSuite) makeRequest(method, path string, body interface{}) *httptest.ResponseRecorder {
	var req *http.Request
	
	switch v := body.(type) {
	case string:
		// Raw string body
		req = httptest.NewRequest(method, path, strings.NewReader(v))
	case []byte:
		// Raw byte body
		req = httptest.NewRequest(method, path, bytes.NewReader(v))
	default:
		// JSON body
		jsonBody, _ := json.Marshal(body)
		req = httptest.NewRequest(method, path, bytes.NewBuffer(jsonBody))
	}
	
	req.Header.Set("Content-Type", "application/json")
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

// Test validation handler that uses various binding tags
func testValidationEndpoint(c *gin.Context) {
	type TestRequest struct {
		RequiredField string   `json:"required_field" binding:"required"`
		MinLength     string   `json:"min_length" binding:"min=5"`
		MaxLength     string   `json:"max_length" binding:"max=10"`
		Email         string   `json:"email" binding:"omitempty,email"`
		NumericRange  int      `json:"numeric_range" binding:"min=1,max=100"`
		OneOf         string   `json:"one_of" binding:"oneof=option1 option2 option3"`
		ArrayField    []string `json:"array_field" binding:"min=1,max=5,dive,min=3"`
	}
	
	var req TestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Validation passed",
		"data":    req,
	})
}

// Test Cases - Field Validation

func (suite *ValidationTestSuite) TestValidation_RequiredField() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Missing required field
	req := map[string]interface{}{
		"min_length":    "hello",
		"max_length":    "test",
		"numeric_range": 50,
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Validation failed", resp["error"])
	assert.Contains(suite.T(), resp["details"], "required_field")
	assert.Contains(suite.T(), resp["details"], "required")
}

func (suite *ValidationTestSuite) TestValidation_MinLength() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// String too short
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hi", // Less than 5 characters
		"max_length":     "test",
		"numeric_range":  50,
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "min_length")
	assert.Contains(suite.T(), resp["details"], "min")
}

func (suite *ValidationTestSuite) TestValidation_MaxLength() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// String too long
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "this is way too long", // More than 10 characters
		"numeric_range":  50,
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "max_length")
	assert.Contains(suite.T(), resp["details"], "max")
}

func (suite *ValidationTestSuite) TestValidation_EmailFormat() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Invalid email format
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "test",
		"email":          "not-an-email",
		"numeric_range":  50,
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "email")
}

func (suite *ValidationTestSuite) TestValidation_NumericRange() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Number out of range
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "test",
		"numeric_range":  150, // Greater than 100
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "numeric_range")
}

func (suite *ValidationTestSuite) TestValidation_OneOf() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Invalid option
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "test",
		"numeric_range":  50,
		"one_of":         "invalid_option", // Not in allowed list
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "one_of")
	assert.Contains(suite.T(), resp["details"], "oneof")
}

func (suite *ValidationTestSuite) TestValidation_ArrayValidation() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Array with invalid elements
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "test",
		"numeric_range":  50,
		"array_field":    []string{"ab", "abc", "abcd"}, // Some elements less than 3 chars
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "array_field")
}

func (suite *ValidationTestSuite) TestValidation_ValidRequest() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// All fields valid
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello world",
		"max_length":     "test123",
		"email":          "test@example.com",
		"numeric_range":  50,
		"one_of":         "option2",
		"array_field":    []string{"abc", "defg", "hijkl"},
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Validation passed", resp["message"])
}

// Test Cases - JSON Parsing Errors

func (suite *ValidationTestSuite) TestValidation_InvalidJSON() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Invalid JSON
	invalidJSON := `{"required_field": "test", "invalid": }`
	
	rec := suite.makeRequest("POST", "/validate", invalidJSON)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Validation failed", resp["error"])
}

func (suite *ValidationTestSuite) TestValidation_WrongDataType() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Wrong data type for field
	req := map[string]interface{}{
		"required_field": "test",
		"min_length":     "hello",
		"max_length":     "test",
		"numeric_range":  "not a number", // Should be int
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "numeric_range")
}

// Test Cases - Enhance Request Validation

func (suite *ValidationTestSuite) TestEnhanceRequest_EmptyText() {
	// Create a simple handler that validates EnhanceRequest
	suite.router.POST("/enhance", func(c *gin.Context) {
		var req handlers.EnhanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request body",
				"details": err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})
	
	req := handlers.EnhanceRequest{
		Text: "", // Empty text
	}
	
	rec := suite.makeRequest("POST", "/enhance", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid request body", resp["error"])
	assert.Contains(suite.T(), resp["details"], "Text")
	assert.Contains(suite.T(), resp["details"], "min")
}

func (suite *ValidationTestSuite) TestEnhanceRequest_TextTooLong() {
	// Create a simple handler that validates EnhanceRequest
	suite.router.POST("/enhance", func(c *gin.Context) {
		var req handlers.EnhanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request body",
				"details": err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})
	
	// Create text longer than 5000 characters
	longText := strings.Repeat("a", 5001)
	
	req := handlers.EnhanceRequest{
		Text: longText,
	}
	
	rec := suite.makeRequest("POST", "/enhance", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid request body", resp["error"])
	assert.Contains(suite.T(), resp["details"], "Text")
	assert.Contains(suite.T(), resp["details"], "max")
}

func (suite *ValidationTestSuite) TestEnhanceRequest_ValidWithOptionalFields() {
	// Create a simple handler that validates EnhanceRequest
	suite.router.POST("/enhance", func(c *gin.Context) {
		var req handlers.EnhanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request body",
				"details": err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, req)
	})
	
	req := handlers.EnhanceRequest{
		Text: "This is a valid prompt text",
		Context: map[string]interface{}{
			"domain": "coding",
			"level":  "intermediate",
		},
		PreferTechniques:  []string{"chain_of_thought", "examples"},
		ExcludeTechniques: []string{"tree_of_thoughts"},
		TargetComplexity:  "medium",
	}
	
	rec := suite.makeRequest("POST", "/enhance", req)
	
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceRequest
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), req.Text, resp.Text)
	assert.Equal(suite.T(), req.Context, resp.Context)
	assert.Equal(suite.T(), req.PreferTechniques, resp.PreferTechniques)
	assert.Equal(suite.T(), req.ExcludeTechniques, resp.ExcludeTechniques)
	assert.Equal(suite.T(), req.TargetComplexity, resp.TargetComplexity)
}

// Test Cases - Complex Validation Scenarios

func (suite *ValidationTestSuite) TestValidation_MultipleErrors() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Multiple validation errors
	req := map[string]interface{}{
		// Missing required_field
		"min_length":    "hi",              // Too short
		"max_length":    "way too long!!!!", // Too long
		"email":         "invalid",         // Invalid email
		"numeric_range": 200,               // Out of range
		"one_of":        "bad_option",      // Invalid option
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	// Should contain multiple error messages
	details := resp["details"].(string)
	assert.Contains(suite.T(), details, "required_field")
	assert.Contains(suite.T(), details, "min_length")
	assert.Contains(suite.T(), details, "max_length")
	assert.Contains(suite.T(), details, "email")
	assert.Contains(suite.T(), details, "numeric_range")
	assert.Contains(suite.T(), details, "one_of")
}

func (suite *ValidationTestSuite) TestValidation_EmptyBody() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Empty body
	rec := suite.makeRequest("POST", "/validate", []byte(""))
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Validation failed", resp["error"])
}

func (suite *ValidationTestSuite) TestValidation_NullValues() {
	suite.router.POST("/validate", testValidationEndpoint)
	
	// Null values for required fields
	req := map[string]interface{}{
		"required_field": nil,
		"min_length":     "hello",
		"max_length":     "test",
		"numeric_range":  50,
	}
	
	rec := suite.makeRequest("POST", "/validate", req)
	
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp["details"], "required_field")
}

// Test Runner
func TestValidationTestSuite(t *testing.T) {
	suite.Run(t, new(ValidationTestSuite))
}