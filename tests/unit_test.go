package tests

import (
	"context"
	"testing"
	"time"

	"aws-serverless-rag/internal/models"
	"aws-serverless-rag/internal/performance"
	"aws-serverless-rag/internal/reliability"
	"aws-serverless-rag/internal/utils"
)

// Unit tests for individual components
// These tests don't require external dependencies and can run quickly

func TestPerformanceTextChunking(t *testing.T) {
	tests := []struct {
		name         string
		text         string
		expectChunks int
		expectError  bool
	}{
		{
			name:         "simple text chunking",
			text:         "This is a test document with multiple sentences. It should be split into appropriate chunks for processing.",
			expectChunks: 1,
			expectError:  false,
		},
		{
			name:         "empty text",
			text:         "",
			expectChunks: 0,
			expectError:  true,
		},
		{
			name:         "large text requiring multiple chunks",
			text:         generateLargeText(2000), // 2KB text
			expectChunks: 2,
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chunks, err := performance.ProcessTextIntoChunks(tt.text)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if len(chunks) < tt.expectChunks {
				t.Errorf("Expected at least %d chunks, got %d", tt.expectChunks, len(chunks))
			}

			// Validate chunk structure
			for i, chunk := range chunks {
				if chunk.ID == "" {
					t.Errorf("Chunk %d missing ID", i)
				}
				if chunk.Content == "" {
					t.Errorf("Chunk %d missing content", i)
				}
				if len(chunk.Content) > 1100 { // Allow some flexibility for chunk boundaries
					t.Errorf("Chunk %d exceeds reasonable size limit: %d chars", i, len(chunk.Content))
				}
			}
		})
	}
}

func TestConcurrentEmbeddingGeneration(t *testing.T) {
	chunks := []models.Chunk{
		{ID: "1", Content: "First test chunk"},
		{ID: "2", Content: "Second test chunk"},
		{ID: "3", Content: "Third test chunk"},
	}

	ctx := context.Background()
	embeddings, err := performance.GenerateEmbeddingsConcurrently(ctx, chunks)

	if err != nil {
		t.Fatalf("Embedding generation failed: %v", err)
	}

	if len(embeddings) != len(chunks) {
		t.Errorf("Expected %d embeddings, got %d", len(chunks), len(embeddings))
	}

	for i, embedding := range embeddings {
		if len(embedding) == 0 {
			t.Errorf("Embedding %d is empty", i)
		}

		// Mock embeddings should have 1536 dimensions
		if len(embedding) != 1536 {
			t.Errorf("Embedding %d has wrong dimensions: expected 1536, got %d", i, len(embedding))
		}
	}
}

func TestRetryMechanism(t *testing.T) {
	logger := utils.NewLogger()
	config := reliability.DefaultRetryConfig()
	config.MaxRetries = 2
	config.BaseDelay = 10 * time.Millisecond

	tests := []struct {
		name             string
		failureCount     int
		expectSuccess    bool
		expectedAttempts int
	}{
		{
			name:             "success on first try",
			failureCount:     0,
			expectSuccess:    true,
			expectedAttempts: 1,
		},
		{
			name:             "success after 2 failures",
			failureCount:     2,
			expectSuccess:    true,
			expectedAttempts: 3,
		},
		{
			name:             "failure after exhausting retries",
			failureCount:     5,
			expectSuccess:    false,
			expectedAttempts: 3, // Original + 2 retries
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attempts := 0
			operation := func() error {
				attempts++
				if attempts <= tt.failureCount {
					return models.ErrEmbeddingFailed
				}
				return nil
			}

			err := reliability.ExecuteWithRetry(context.Background(), config, operation, logger)

			if tt.expectSuccess && err != nil {
				t.Errorf("Expected success but got error: %v", err)
			}

			if !tt.expectSuccess && err == nil {
				t.Error("Expected failure but got success")
			}

			if attempts != tt.expectedAttempts {
				t.Errorf("Expected %d attempts, got %d", tt.expectedAttempts, attempts)
			}
		})
	}
}

func TestCircuitBreakerFunctionality(t *testing.T) {
	logger := utils.NewLogger()
	config := reliability.CircuitBreakerConfig{
		MaxFailures:  3,
		ResetTimeout: 50 * time.Millisecond,
	}

	cb := reliability.NewCircuitBreaker(config, logger)

	// Test initial state (closed)
	err := cb.Execute(func() error { return nil })
	if err != nil {
		t.Errorf("Expected success in closed state, got: %v", err)
	}

	// Trigger failures to open circuit
	for i := 0; i < 3; i++ {
		cb.Execute(func() error { return models.ErrVectorSearchFailed })
	}

	// Circuit should be open now
	err = cb.Execute(func() error { return nil })
	if err == nil || err.Error() != "circuit breaker is open" {
		t.Errorf("Expected circuit breaker open error, got: %v", err)
	}

	// Wait for reset timeout
	time.Sleep(60 * time.Millisecond)

	// Should transition to half-open and then close on success
	err = cb.Execute(func() error { return nil })
	if err != nil {
		t.Errorf("Expected success after reset timeout, got: %v", err)
	}
}

func TestQueryRequestValidation(t *testing.T) {
	tests := []struct {
		name        string
		request     models.QueryRequest
		expectError bool
	}{
		{
			name: "valid request",
			request: models.QueryRequest{
				Question:   "What is AI?",
				MaxResults: 5,
			},
			expectError: false,
		},
		{
			name: "empty question",
			request: models.QueryRequest{
				Question:   "",
				MaxResults: 5,
			},
			expectError: true,
		},
		{
			name: "whitespace only question",
			request: models.QueryRequest{
				Question:   "   ",
				MaxResults: 5,
			},
			expectError: true,
		},
		{
			name: "zero max results should normalize",
			request: models.QueryRequest{
				Question:   "Valid question",
				MaxResults: 0,
			},
			expectError: false,
		},
		{
			name: "negative max results should normalize",
			request: models.QueryRequest{
				Question:   "Valid question",
				MaxResults: -1,
			},
			expectError: false,
		},
		{
			name: "too high max results should cap",
			request: models.QueryRequest{
				Question:   "Valid question",
				MaxResults: 25,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()

			if tt.expectError && err == nil {
				t.Errorf("Expected validation error but got none")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected validation error: %v", err)
			}

			// Check normalization
			if !tt.expectError {
				if tt.request.MaxResults <= 0 {
					if tt.request.MaxResults != 5 { // Should default to 5
						t.Errorf("Expected MaxResults to be normalized to 5, got %d", tt.request.MaxResults)
					}
				}
				if tt.request.MaxResults > 20 {
					if tt.request.MaxResults != 20 { // Should cap at 20
						t.Errorf("Expected MaxResults to be capped at 20, got %d", tt.request.MaxResults)
					}
				}
			}
		})
	}
}

func TestDocumentModelLifecycle(t *testing.T) {
	document := models.NewDocument("test.pdf", "application/pdf", "documents/test.pdf", 1024)

	// Initial state
	if document.Status != models.StatusUploaded {
		t.Errorf("Expected initial status %s, got %s", models.StatusUploaded, document.Status)
	}

	// Mark as processing
	document.MarkAsProcessing()
	if document.Status != models.StatusProcessing {
		t.Errorf("Expected processing status %s, got %s", models.StatusProcessing, document.Status)
	}

	// Mark as completed
	document.MarkAsCompleted()
	if document.Status != models.StatusCompleted {
		t.Errorf("Expected completed status %s, got %s", models.StatusCompleted, document.Status)
	}

	if document.ProcessedAt == nil {
		t.Error("Expected ProcessedAt to be set when marking as completed")
	}

	// Test failure path
	document2 := models.NewDocument("test2.pdf", "application/pdf", "documents/test2.pdf", 2048)
	document2.MarkAsFailed("Test error")

	if document2.Status != models.StatusFailed {
		t.Errorf("Expected failed status %s, got %s", models.StatusFailed, document2.Status)
	}

	if document2.ErrorMsg != "Test error" {
		t.Errorf("Expected error message 'Test error', got '%s'", document2.ErrorMsg)
	}
}

// Helper functions

func generateLargeText(size int) string {
	text := ""
	pattern := "This is test content for large document processing. It contains multiple sentences and should be chunked appropriately. "

	for len(text) < size {
		text += pattern
	}

	return text[:size]
}
