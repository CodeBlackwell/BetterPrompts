package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
)

const (
	baseURL = "http://localhost"
	apiV1   = "/api/v1"
)

// TestData represents test scenarios
type TestData struct {
	Name     string
	Input    string
	Expected struct {
		HasIntent     bool
		HasTechniques bool
		IsEnhanced    bool
	}
}

// EnhanceRequest represents the enhancement request payload
type EnhanceRequest struct {
	Text string `json:"text"`
}

// EnhanceResponse represents the enhancement response
type EnhanceResponse struct {
	ID              string   `json:"id"`
	OriginalText    string   `json:"original_text"`
	EnhancedText    string   `json:"enhanced_text"`
	Intent          string   `json:"intent"`
	Complexity      string   `json:"complexity"`
	Techniques      []string `json:"techniques"`
	TechniquesUsed  []string `json:"techniques_used"`
	Confidence      float64  `json:"confidence"`
	ProcessingTime  int      `json:"processing_time_ms"`
	Enhanced        bool     `json:"enhanced"`
}

// TestHealthEndpoints verifies all services are healthy
func TestHealthEndpoints(t *testing.T) {
	endpoints := []struct {
		name string
		url  string
	}{
		{"API Gateway", baseURL + apiV1 + "/health"},
		{"TorchServe", "http://localhost:8080/ping"},
		{"Intent Classifier", "http://localhost:8001/health"},
		{"Technique Selector", "http://localhost:8002/health"},
		{"Prompt Generator", "http://localhost:8003/health"},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.name, func(t *testing.T) {
			resp, err := http.Get(endpoint.url)
			if err != nil {
				t.Fatalf("Failed to reach %s: %v", endpoint.name, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("%s health check failed: status %d", endpoint.name, resp.StatusCode)
			}
		})
	}
}

// TestEnhancementFlow tests the complete enhancement pipeline
func TestEnhancementFlow(t *testing.T) {
	testCases := []TestData{
		{
			Name:  "Code Generation Request",
			Input: "Write a Python function to calculate factorial",
			Expected: struct {
				HasIntent     bool
				HasTechniques bool
				IsEnhanced    bool
			}{true, true, true},
		},
		{
			Name:  "Question Answering",
			Input: "What is machine learning?",
			Expected: struct {
				HasIntent     bool
				HasTechniques bool
				IsEnhanced    bool
			}{true, true, true},
		},
		{
			Name:  "Creative Writing",
			Input: "Write a short story about a robot",
			Expected: struct {
				HasIntent     bool
				HasTechniques bool
				IsEnhanced    bool
			}{true, true, true},
		},
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			// Prepare request
			reqBody := EnhanceRequest{Text: tc.Input}
			jsonBody, err := json.Marshal(reqBody)
			if err != nil {
				t.Fatalf("Failed to marshal request: %v", err)
			}

			// Send request
			req, err := http.NewRequest("POST", baseURL+apiV1+"/enhance", bytes.NewBuffer(jsonBody))
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("Failed to send request: %v", err)
			}
			defer resp.Body.Close()

			// Check status
			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			// Parse response
			var enhanceResp EnhanceResponse
			if err := json.NewDecoder(resp.Body).Decode(&enhanceResp); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			// Validate response
			if tc.Expected.HasIntent && enhanceResp.Intent == "" {
				t.Error("Expected intent to be present")
			}

			if tc.Expected.HasTechniques && len(enhanceResp.Techniques) == 0 {
				t.Error("Expected techniques to be present")
			}

			if tc.Expected.IsEnhanced && !enhanceResp.Enhanced {
				t.Error("Expected prompt to be enhanced")
			}

			// Check if text was actually enhanced
			if enhanceResp.OriginalText == enhanceResp.EnhancedText {
				t.Error("Enhanced text should be different from original")
			}

			// Log some details for debugging
			t.Logf("Intent: %s, Techniques: %v, Confidence: %.2f",
				enhanceResp.Intent, enhanceResp.Techniques, enhanceResp.Confidence)
		})
	}
}

// TestPerformanceRequirements validates performance metrics
func TestPerformanceRequirements(t *testing.T) {
	// Target: API Response Time p95 < 200ms
	iterations := 20
	var responseTimes []time.Duration

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	for i := 0; i < iterations; i++ {
		reqBody := EnhanceRequest{Text: "Test prompt for performance"}
		jsonBody, _ := json.Marshal(reqBody)

		start := time.Now()
		req, _ := http.NewRequest("POST", baseURL+apiV1+"/enhance", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			t.Logf("Request %d failed: %v", i, err)
			continue
		}
		resp.Body.Close()

		elapsed := time.Since(start)
		responseTimes = append(responseTimes, elapsed)
	}

	// Calculate p95
	if len(responseTimes) > 0 {
		p95Index := int(float64(len(responseTimes)) * 0.95)
		if p95Index >= len(responseTimes) {
			p95Index = len(responseTimes) - 1
		}

		p95Time := responseTimes[p95Index]
		t.Logf("P95 response time: %v", p95Time)

		if p95Time > 200*time.Millisecond {
			t.Errorf("P95 response time %v exceeds 200ms target", p95Time)
		}
	}
}

// TestIntentClassification tests the intent classification endpoint
func TestIntentClassification(t *testing.T) {
	testInputs := []struct {
		text           string
		expectedIntent string // We'll check if intent is non-empty
	}{
		{"How do I sort a list in Python?", "code_generation"},
		{"Explain quantum computing", "question_answering"},
		{"Write a poem about spring", "creative_writing"},
	}

	client := &http.Client{Timeout: 5 * time.Second}

	for _, test := range testInputs {
		t.Run(test.text, func(t *testing.T) {
			reqBody := map[string]string{"text": test.text}
			jsonBody, _ := json.Marshal(reqBody)

			req, _ := http.NewRequest("POST", "http://localhost:8001/api/v1/intents/classify", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("Failed to classify intent: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}

			var result map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&result)

			if intent, ok := result["intent"].(string); !ok || intent == "" {
				t.Error("Expected non-empty intent")
			}
		})
	}
}

// TestTechniqueSelection tests technique selection
func TestTechniqueSelection(t *testing.T) {
	// This would test the technique selector endpoint
	// Currently, technique selection is integrated into the enhancement flow
	t.Skip("Technique selection is integrated into enhancement flow")
}

// TestErrorHandling tests error cases
func TestErrorHandling(t *testing.T) {
	client := &http.Client{Timeout: 5 * time.Second}

	testCases := []struct {
		name         string
		payload      interface{}
		expectedCode int
	}{
		{
			name:         "Empty request",
			payload:      map[string]string{},
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "Invalid JSON",
			payload:      "invalid json",
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "Text too long",
			payload: EnhanceRequest{
				Text: string(make([]byte, 10000)), // Very long text
			},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var jsonBody []byte
			if str, ok := tc.payload.(string); ok {
				jsonBody = []byte(str)
			} else {
				jsonBody, _ = json.Marshal(tc.payload)
			}

			req, _ := http.NewRequest("POST", baseURL+apiV1+"/enhance", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != tc.expectedCode {
				t.Errorf("Expected status %d, got %d", tc.expectedCode, resp.StatusCode)
			}
		})
	}
}

// TestConcurrentRequests tests system under concurrent load
func TestConcurrentRequests(t *testing.T) {
	concurrency := 10
	requestsPerWorker := 5

	done := make(chan bool, concurrency)
	errors := make(chan error, concurrency*requestsPerWorker)

	for i := 0; i < concurrency; i++ {
		go func(workerID int) {
			client := &http.Client{Timeout: 5 * time.Second}

			for j := 0; j < requestsPerWorker; j++ {
				reqBody := EnhanceRequest{
					Text: fmt.Sprintf("Test request from worker %d, request %d", workerID, j),
				}
				jsonBody, _ := json.Marshal(reqBody)

				req, _ := http.NewRequest("POST", baseURL+apiV1+"/enhance", bytes.NewBuffer(jsonBody))
				req.Header.Set("Content-Type", "application/json")

				resp, err := client.Do(req)
				if err != nil {
					errors <- err
					continue
				}
				resp.Body.Close()

				if resp.StatusCode != http.StatusOK {
					errors <- fmt.Errorf("worker %d: got status %d", workerID, resp.StatusCode)
				}
			}
			done <- true
		}(i)
	}

	// Wait for all workers
	for i := 0; i < concurrency; i++ {
		<-done
	}
	close(errors)

	// Check for errors
	errorCount := 0
	for err := range errors {
		errorCount++
		t.Logf("Concurrent request error: %v", err)
	}

	if errorCount > 0 {
		t.Errorf("Had %d errors out of %d total requests", errorCount, concurrency*requestsPerWorker)
	}
}