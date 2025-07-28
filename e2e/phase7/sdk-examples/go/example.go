package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// BetterPromptsClient represents the API client
type BetterPromptsClient struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new BetterPrompts API client
func NewClient(apiKey string) *BetterPromptsClient {
	return &BetterPromptsClient{
		APIKey:  apiKey,
		BaseURL: "https://api.betterprompts.io/v1",
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Request structures
type EnhanceRequest struct {
	Text               string                 `json:"text"`
	Context            map[string]interface{} `json:"context,omitempty"`
	PreferTechniques   []string               `json:"prefer_techniques,omitempty"`
	ExcludeTechniques  []string               `json:"exclude_techniques,omitempty"`
	TargetComplexity   string                 `json:"target_complexity,omitempty"`
}

type BatchRequest struct {
	Requests []EnhanceRequest `json:"requests"`
}

// Response structures
type EnhanceResponse struct {
	ID               string                 `json:"id"`
	OriginalText     string                 `json:"original_text"`
	EnhancedText     string                 `json:"enhanced_text"`
	Intent           string                 `json:"intent"`
	Complexity       string                 `json:"complexity"`
	TechniquesUsed   []string               `json:"techniques_used"`
	Confidence       float64                `json:"confidence"`
	ProcessingTimeMs float64                `json:"processing_time_ms"`
	Enhanced         bool                   `json:"enhanced"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

type Technique struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Category      string                 `json:"category"`
	Description   string                 `json:"description"`
	Complexity    int                    `json:"complexity"`
	Examples      []string               `json:"examples"`
	Parameters    map[string]interface{} `json:"parameters,omitempty"`
	Effectiveness struct {
		Overall  float64            `json:"overall"`
		ByIntent map[string]float64 `json:"byIntent"`
	} `json:"effectiveness"`
}

type HistoryResponse struct {
	Items      []HistoryItem `json:"items"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	Limit      int           `json:"limit"`
	TotalPages int           `json:"total_pages"`
	HasNext    bool          `json:"has_next"`
	HasPrev    bool          `json:"has_prev"`
}

type HistoryItem struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	OriginalText     string    `json:"original_text"`
	EnhancedText     string    `json:"enhanced_text"`
	Intent           string    `json:"intent"`
	Complexity       string    `json:"complexity"`
	TechniquesUsed   []string  `json:"techniques_used"`
	Confidence       float64   `json:"confidence"`
	ProcessingTimeMs float64   `json:"processing_time_ms"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ErrorResponse struct {
	Error     string                 `json:"error"`
	Message   string                 `json:"message,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
}

// doRequest performs an HTTP request with authentication
func (c *BetterPromptsClient) doRequest(method, path string, body interface{}, token string) (*http.Response, error) {
	url := c.BaseURL + path

	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else {
		req.Header.Set("X-API-Key", c.APIKey)
	}

	return c.HTTPClient.Do(req)
}

// handleResponse processes the API response
func handleResponse(resp *http.Response, result interface{}) error {
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errResp ErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			return fmt.Errorf("API error (status %d)", resp.StatusCode)
		}
		
		if resp.StatusCode == 429 {
			// Handle rate limiting
			retryAfter := resp.Header.Get("Retry-After")
			return fmt.Errorf("rate limited - retry after %s seconds", retryAfter)
		}
		
		return fmt.Errorf("API error (%d): %s - %s", resp.StatusCode, errResp.Error, errResp.Message)
	}

	return json.NewDecoder(resp.Body).Decode(result)
}

// Enhance enhances a single prompt
func (c *BetterPromptsClient) Enhance(req EnhanceRequest) (*EnhanceResponse, error) {
	resp, err := c.doRequest("POST", "/enhance", req, "")
	if err != nil {
		return nil, err
	}

	var result EnhanceResponse
	if err := handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetTechniques retrieves available techniques
func (c *BetterPromptsClient) GetTechniques(category string, complexity int) ([]Technique, error) {
	path := "/techniques"
	if category != "" || complexity > 0 {
		path += "?"
		if category != "" {
			path += fmt.Sprintf("category=%s&", category)
		}
		if complexity > 0 {
			path += fmt.Sprintf("complexity=%d", complexity)
		}
	}

	resp, err := c.doRequest("GET", path, nil, "")
	if err != nil {
		return nil, err
	}

	var result []Technique
	if err := handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// GetHistory retrieves enhancement history (requires authentication)
func (c *BetterPromptsClient) GetHistory(token string, page, limit int) (*HistoryResponse, error) {
	path := fmt.Sprintf("/history?page=%d&limit=%d", page, limit)

	resp, err := c.doRequest("GET", path, nil, token)
	if err != nil {
		return nil, err
	}

	var result HistoryResponse
	if err := handleResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// VerifyWebhookSignature verifies the HMAC signature of a webhook
func VerifyWebhookSignature(payload []byte, signature, secret string) bool {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	expectedSignature := "sha256=" + hex.EncodeToString(h.Sum(nil))
	
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// Example functions

func exampleBasicEnhancement(client *BetterPromptsClient) {
	fmt.Println("\n=== Basic Enhancement ===")

	req := EnhanceRequest{
		Text: "Write a function to reverse a string",
	}

	result, err := client.Enhance(req)
	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	fmt.Printf("Original: %s\n", result.OriginalText)
	fmt.Printf("Enhanced: %s\n", result.EnhancedText)
	fmt.Printf("Techniques: %v\n", result.TechniquesUsed)
	fmt.Printf("Processing time: %.2fms\n", result.ProcessingTimeMs)
}

func exampleEnhancementWithOptions(client *BetterPromptsClient) {
	fmt.Println("\n=== Enhancement with Options ===")

	req := EnhanceRequest{
		Text: "Explain databases to a beginner",
		Context: map[string]interface{}{
			"audience": "non-technical person",
			"purpose":  "general understanding",
		},
		PreferTechniques:  []string{"analogies", "real_world_examples"},
		ExcludeTechniques: []string{"technical_details"},
		TargetComplexity:  "simple",
	}

	result, err := client.Enhance(req)
	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	fmt.Printf("Intent: %s\n", result.Intent)
	fmt.Printf("Complexity: %s\n", result.Complexity)
	fmt.Printf("Confidence: %.2f\n", result.Confidence)
	fmt.Printf("Enhanced (first 200 chars): %s...\n", result.EnhancedText[:min(200, len(result.EnhancedText))])
}

func exampleGetTechniques(client *BetterPromptsClient) {
	fmt.Println("\n=== Available Techniques ===")

	techniques, err := client.GetTechniques("reasoning", 0)
	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	fmt.Printf("Found %d reasoning techniques:\n", len(techniques))
	for i, tech := range techniques {
		if i >= 5 { // Show only first 5
			break
		}
		fmt.Printf("\n- %s (%s)\n", tech.Name, tech.ID)
		fmt.Printf("  Category: %s\n", tech.Category)
		fmt.Printf("  Complexity: %d/5\n", tech.Complexity)
		fmt.Printf("  Effectiveness: %.2f\n", tech.Effectiveness.Overall)
	}
}

func exampleErrorHandling(client *BetterPromptsClient) {
	fmt.Println("\n=== Error Handling ===")

	testCases := []struct {
		name string
		req  EnhanceRequest
	}{
		{
			name: "Empty text",
			req:  EnhanceRequest{Text: ""},
		},
		{
			name: "Text too long",
			req:  EnhanceRequest{Text: string(make([]byte, 5001))},
		},
		{
			name: "Invalid technique",
			req: EnhanceRequest{
				Text:             "Test",
				PreferTechniques: []string{"invalid_technique"},
			},
		},
	}

	for _, tc := range testCases {
		_, err := client.Enhance(tc.req)
		if err != nil {
			fmt.Printf("\n%s: %v\n", tc.name, err)
		}
	}
}

// Webhook handler example
func webhookHandler(w http.ResponseWriter, r *http.Request, secret string) {
	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}

	// Verify signature
	signature := r.Header.Get("X-Webhook-Signature")
	if !VerifyWebhookSignature(body, signature, secret) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// Parse event
	var event struct {
		Event     string                 `json:"event"`
		Timestamp string                 `json:"timestamp"`
		Data      map[string]interface{} `json:"data"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Handle event
	switch event.Event {
	case "enhancement.completed":
		fmt.Printf("Enhancement completed: %v\n", event.Data["id"])
	case "batch.finished":
		fmt.Printf("Batch finished: %v\n", event.Data["job_id"])
	case "error.occurred":
		fmt.Printf("Error occurred: %v\n", event.Data)
	}

	// Respond
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	fmt.Println("BetterPrompts API - Go Examples")
	fmt.Println("===============================")

	// Initialize client
	apiKey := os.Getenv("BETTERPROMPTS_API_KEY")
	if apiKey == "" {
		apiKey = "your-api-key-here"
	}

	client := NewClient(apiKey)

	// Run examples
	exampleBasicEnhancement(client)
	exampleEnhancementWithOptions(client)
	exampleGetTechniques(client)
	exampleErrorHandling(client)

	// For authenticated endpoints, you would need to login first:
	// loginResp, _ := client.Login("user@example.com", "password")
	// token := loginResp.AccessToken
	// 
	// history, _ := client.GetHistory(token, 1, 10)
	// fmt.Printf("Total enhancements: %d\n", history.Total)

	// Example webhook server
	fmt.Println("\n=== Webhook Server Example ===")
	fmt.Println("To handle webhooks, use the webhookHandler function with your HTTP server")
	fmt.Println("Example:")
	fmt.Println(`
	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		webhookHandler(w, r, "your-webhook-secret")
	})
	http.ListenAndServe(":8080", nil)
	`)
}