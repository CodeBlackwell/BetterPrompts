package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntentClassifierClient tests the intent classifier client integration
func TestIntentClassifierClient_Integration(t *testing.T) {
	tests := []struct {
		name           string
		inputText      string
		serverResponse services.IntentClassificationResult
		serverStatus   int
		expectError    bool
		validateResult func(t *testing.T, result *services.IntentClassificationResult)
	}{
		{
			name:      "Successful classification",
			inputText: "Write a function to sort an array",
			serverResponse: services.IntentClassificationResult{
				Intent:     "code_generation",
				Confidence: 0.92,
				Complexity: "moderate",
				IntentScores: map[string]float64{
					"code_generation":    0.92,
					"question_answering": 0.05,
					"explanation":        0.03,
				},
				SuggestedTechniques: []string{"chain_of_thought", "few_shot"},
				Metadata: map[string]interface{}{
					"programming_language": "unspecified",
					"algorithm_type":      "sorting",
				},
			},
			serverStatus: http.StatusOK,
			expectError:  false,
			validateResult: func(t *testing.T, result *services.IntentClassificationResult) {
				assert.Equal(t, "code_generation", result.Intent)
				assert.Equal(t, 0.92, result.Confidence)
				assert.Equal(t, "moderate", result.Complexity)
				assert.Len(t, result.SuggestedTechniques, 2)
			},
		},
		{
			name:      "Complex query classification",
			inputText: "Analyze the performance implications of using microservices vs monolithic architecture",
			serverResponse: services.IntentClassificationResult{
				Intent:              "analysis",
				Confidence:          0.88,
				Complexity:          "complex",
				SuggestedTechniques: []string{"chain_of_thought", "structured_output", "comparison"},
			},
			serverStatus: http.StatusOK,
			expectError:  false,
			validateResult: func(t *testing.T, result *services.IntentClassificationResult) {
				assert.Equal(t, "complex", result.Complexity)
				assert.Contains(t, result.SuggestedTechniques, "structured_output")
			},
		},
		{
			name:         "Server error",
			inputText:    "Test error",
			serverStatus: http.StatusInternalServerError,
			expectError:  true,
		},
		{
			name:      "Invalid complexity normalization",
			inputText: "Simple task",
			serverResponse: services.IntentClassificationResult{
				Intent:              "task",
				Confidence:          0.9,
				Complexity:          "invalid_complexity", // Should be normalized
				SuggestedTechniques: []string{},
			},
			serverStatus: http.StatusOK,
			expectError:  false,
			validateResult: func(t *testing.T, result *services.IntentClassificationResult) {
				assert.Equal(t, "moderate", result.Complexity) // Should default to moderate
				assert.NotEmpty(t, result.SuggestedTechniques) // Should have default techniques
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				assert.Equal(t, "POST", r.Method)
				assert.Equal(t, "/api/v1/intents/classify", r.URL.Path)
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

				var req map[string]string
				err := json.NewDecoder(r.Body).Decode(&req)
				require.NoError(t, err)
				assert.Equal(t, tt.inputText, req["text"])

				// Send response
				w.WriteHeader(tt.serverStatus)
				if tt.serverStatus == http.StatusOK {
					json.NewEncoder(w).Encode(tt.serverResponse)
				} else {
					json.NewEncoder(w).Encode(map[string]string{"error": "server error"})
				}
			}))
			defer server.Close()

			// Create client
			client := &services.IntentClassifierClient{
				BaseURL: server.URL,
				Client:  &http.Client{Timeout: 5 * time.Second},
			}

			// Test classification
			ctx := context.Background()
			result, err := client.ClassifyIntent(ctx, tt.inputText)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, result)
				if tt.validateResult != nil {
					tt.validateResult(t, result)
				}
			}
		})
	}
}

// TestTechniqueSelectorClient tests the technique selector client integration
func TestTechniqueSelectorClient_Integration(t *testing.T) {
	logger := logrus.New()
	
	tests := []struct {
		name           string
		request        models.TechniqueSelectionRequest
		serverResponse services.TechniqueSelectionResponse
		serverStatus   int
		expectError    bool
		expectedCount  int
	}{
		{
			name: "Code generation techniques",
			request: models.TechniqueSelectionRequest{
				Text:       "Create a REST API",
				Intent:     "code_generation",
				Complexity: "moderate",
			},
			serverResponse: services.TechniqueSelectionResponse{
				Techniques: []services.SelectedTechnique{
					{
						ID:         "chain_of_thought",
						Name:       "Chain of Thought",
						Priority:   1,
						Score:      0.95,
						Confidence: 0.9,
					},
					{
						ID:         "step_by_step",
						Name:       "Step by Step",
						Priority:   2,
						Score:      0.85,
						Confidence: 0.85,
					},
				},
				PrimaryTechnique: "chain_of_thought",
				Confidence:       0.9,
			},
			serverStatus:  http.StatusOK,
			expectError:   false,
			expectedCount: 2,
		},
		{
			name: "Complexity normalization test",
			request: models.TechniqueSelectionRequest{
				Text:       "Explain this",
				Intent:     "explanation",
				Complexity: "HARD", // Should be normalized to "complex"
			},
			serverResponse: services.TechniqueSelectionResponse{
				Techniques: []services.SelectedTechnique{
					{
						ID:   "simplified_explanation",
						Name: "Simplified Explanation",
					},
				},
			},
			serverStatus:  http.StatusOK,
			expectError:   false,
			expectedCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				assert.Equal(t, "POST", r.Method)
				assert.Equal(t, "/api/v1/select", r.URL.Path)

				var req services.TechniqueSelectionRequest
				err := json.NewDecoder(r.Body).Decode(&req)
				require.NoError(t, err)
				
				// Verify complexity was normalized
				validComplexities := []string{"simple", "moderate", "complex"}
				assert.Contains(t, validComplexities, req.Complexity)

				// Send response
				w.WriteHeader(tt.serverStatus)
				if tt.serverStatus == http.StatusOK {
					json.NewEncoder(w).Encode(tt.serverResponse)
				}
			}))
			defer server.Close()

			// Create client
			client := &services.TechniqueSelectorClient{
				BaseURL: server.URL,
				Client:  &http.Client{Timeout: 5 * time.Second},
				Logger:  logger,
			}

			// Test selection
			ctx := context.Background()
			techniques, err := client.SelectTechniques(ctx, tt.request)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Len(t, techniques, tt.expectedCount)
			}
		})
	}
}

// TestPromptGeneratorClient tests the prompt generator client integration
func TestPromptGeneratorClient_Integration(t *testing.T) {
	tests := []struct {
		name           string
		request        models.PromptGenerationRequest
		serverResponse models.PromptGenerationResponse
		serverStatus   int
		expectError    bool
	}{
		{
			name: "Successful generation",
			request: models.PromptGenerationRequest{
				Text:       "Explain recursion",
				Intent:     "explanation",
				Complexity: "moderate",
				Techniques: []string{"chain_of_thought", "examples"},
				Context: map[string]interface{}{
					"audience": "beginners",
				},
			},
			serverResponse: models.PromptGenerationResponse{
				Text:         "Let me explain recursion step by step with examples...",
				ModelVersion: "gpt-4",
				TokensUsed:   150,
			},
			serverStatus: http.StatusOK,
			expectError:  false,
		},
		{
			name: "Generation with multiple techniques",
			request: models.PromptGenerationRequest{
				Text:       "Design a distributed system",
				Intent:     "system_design",
				Complexity: "complex",
				Techniques: []string{"structured_output", "tree_of_thoughts", "chain_of_thought"},
			},
			serverResponse: models.PromptGenerationResponse{
				Text:         "I'll design a distributed system using a structured approach...",
				ModelVersion: "gpt-4-turbo",
				TokensUsed:   500,
			},
			serverStatus: http.StatusOK,
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				assert.Equal(t, "POST", r.Method)
				assert.Equal(t, "/api/v1/generate", r.URL.Path)

				var req models.PromptGenerationRequest
				err := json.NewDecoder(r.Body).Decode(&req)
				require.NoError(t, err)
				assert.Equal(t, tt.request.Text, req.Text)
				assert.Equal(t, tt.request.Techniques, req.Techniques)

				// Send response
				w.WriteHeader(tt.serverStatus)
				if tt.serverStatus == http.StatusOK {
					json.NewEncoder(w).Encode(tt.serverResponse)
				}
			}))
			defer server.Close()

			// Create client
			client := &services.PromptGeneratorClient{
				BaseURL: server.URL,
				Client:  &http.Client{Timeout: 5 * time.Second},
			}

			// Test generation
			ctx := context.Background()
			result, err := client.GeneratePrompt(ctx, tt.request)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, result)
				assert.Equal(t, tt.serverResponse.Text, result.Text)
				assert.Equal(t, tt.serverResponse.TokensUsed, result.TokensUsed)
			}
		})
	}
}

// TestServiceClientTimeout tests timeout handling for all clients
func TestServiceClientTimeout(t *testing.T) {
	// Create a slow server
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second) // Longer than client timeout
		w.WriteHeader(http.StatusOK)
	}))
	defer slowServer.Close()

	t.Run("IntentClassifier timeout", func(t *testing.T) {
		client := &services.IntentClassifierClient{
			BaseURL: slowServer.URL,
			Client:  &http.Client{Timeout: 100 * time.Millisecond},
		}

		ctx := context.Background()
		_, err := client.ClassifyIntent(ctx, "test")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Client.Timeout")
	})

	t.Run("TechniqueSelector timeout", func(t *testing.T) {
		client := &services.TechniqueSelectorClient{
			BaseURL: slowServer.URL,
			Client:  &http.Client{Timeout: 100 * time.Millisecond},
			Logger:  logrus.New(),
		}

		ctx := context.Background()
		req := models.TechniqueSelectionRequest{
			Text:       "test",
			Intent:     "test",
			Complexity: "simple",
		}
		_, err := client.SelectTechniques(ctx, req)
		assert.Error(t, err)
	})

	t.Run("PromptGenerator timeout", func(t *testing.T) {
		client := &services.PromptGeneratorClient{
			BaseURL: slowServer.URL,
			Client:  &http.Client{Timeout: 100 * time.Millisecond},
		}

		ctx := context.Background()
		req := models.PromptGenerationRequest{
			Text:       "test",
			Intent:     "test",
			Complexity: "simple",
			Techniques: []string{"test"},
		}
		_, err := client.GeneratePrompt(ctx, req)
		assert.Error(t, err)
	})
}

// TestServiceClientContextCancellation tests context cancellation
func TestServiceClientContextCancellation(t *testing.T) {
	// Create a server that waits
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(5 * time.Second):
			w.WriteHeader(http.StatusOK)
		case <-r.Context().Done():
			return
		}
	}))
	defer server.Close()

	t.Run("Context cancellation", func(t *testing.T) {
		client := &services.IntentClassifierClient{
			BaseURL: server.URL,
			Client:  &http.Client{Timeout: 10 * time.Second},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		_, err := client.ClassifyIntent(ctx, "test")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "context deadline exceeded")
	})
}