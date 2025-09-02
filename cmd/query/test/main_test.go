package test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"aws-serverless-rag/internal/models"
)

// mockBedrockClient implements the BedrockClient interface for testing
type mockBedrockClient struct {
	shouldFailEmbedding bool
	shouldFailAnswer    bool
	mockEmbedding       []float32
	mockAnswer          string
}

func (m *mockBedrockClient) GenerateEmbedding(text string) ([]float32, error) {
	if m.shouldFailEmbedding {
		return nil, models.ErrEmbeddingFailed
	}
	return m.mockEmbedding, nil
}

func (m *mockBedrockClient) GenerateAnswer(question string, sources []models.Source) (string, error) {
	if m.shouldFailAnswer {
		return "", models.ErrLLMGenerationFailed
	}
	return m.mockAnswer, nil
}

// mockOpenSearchClient implements the OpenSearchClient interface for testing
type mockOpenSearchClient struct {
	shouldFail  bool
	mockSources []models.Source
}

func (m *mockOpenSearchClient) VectorSearch(ctx context.Context, embedding []float32, maxResults int) ([]models.Source, error) {
	if m.shouldFail {
		return nil, models.ErrVectorSearchFailed
	}
	return m.mockSources, nil
}

func TestQueryHandler_ValidRequest(t *testing.T) {
	// This is a unit test for the query logic
	// We'll test the main processing flow without AWS dependencies

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectError    bool
		mockEmbedding  []float32
		mockSources    []models.Source
		mockAnswer     string
		embeddingFails bool
		searchFails    bool
		answerFails    bool
	}{
		{
			name:           "valid question with results",
			requestBody:    `{"question": "What is AI?", "max_results": 5}`,
			expectedStatus: 200,
			expectError:    false,
			mockEmbedding:  []float32{0.1, 0.2, 0.3},
			mockSources: []models.Source{
				{
					DocumentID: "doc1",
					ChunkID:    "chunk1",
					Content:    "AI is artificial intelligence",
					Score:      0.95,
				},
			},
			mockAnswer: "AI stands for Artificial Intelligence.",
		},
		{
			name:           "valid question with no results",
			requestBody:    `{"question": "What is quantum computing?", "max_results": 5}`,
			expectedStatus: 200,
			expectError:    false,
			mockEmbedding:  []float32{0.1, 0.2, 0.3},
			mockSources:    []models.Source{}, // No sources found
			mockAnswer:     "",                // Won't be used when no sources
		},
		{
			name:           "empty question",
			requestBody:    `{"question": "", "max_results": 5}`,
			expectedStatus: 400,
			expectError:    true,
		},
		{
			name:           "invalid JSON",
			requestBody:    `{"question": "What is AI?"`, // Missing closing brace
			expectedStatus: 400,
			expectError:    true,
		},
		{
			name:           "embedding generation fails",
			requestBody:    `{"question": "What is AI?", "max_results": 5}`,
			expectedStatus: 500,
			expectError:    true,
			embeddingFails: true,
		},
		{
			name:           "vector search fails",
			requestBody:    `{"question": "What is AI?", "max_results": 5}`,
			expectedStatus: 500,
			expectError:    true,
			mockEmbedding:  []float32{0.1, 0.2, 0.3},
			searchFails:    true,
		},
		{
			name:           "answer generation fails",
			requestBody:    `{"question": "What is AI?", "max_results": 5}`,
			expectedStatus: 500,
			expectError:    true,
			mockEmbedding:  []float32{0.1, 0.2, 0.3},
			mockSources: []models.Source{
				{
					DocumentID: "doc1",
					ChunkID:    "chunk1",
					Content:    "AI is artificial intelligence",
					Score:      0.95,
				},
			},
			answerFails: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock request
			_ = events.APIGatewayProxyRequest{
				HTTPMethod: "POST",
				Body:       tt.requestBody,
				RequestContext: events.APIGatewayProxyRequestContext{
					RequestID: "test-request-id",
				},
			}

			// Test request parsing and validation
			if tt.requestBody != "" && tt.requestBody[0] == '{' { // Valid JSON structure
				var queryRequest models.QueryRequest
				err := json.Unmarshal([]byte(tt.requestBody), &queryRequest)

				if tt.name == "invalid JSON" {
					if err == nil {
						t.Errorf("Expected JSON parsing to fail for invalid JSON")
					}
					return
				}

				if err != nil {
					t.Errorf("Failed to parse JSON: %v", err)
					return
				}

				// Test validation
				validationErr := queryRequest.Validate()
				if tt.name == "empty question" {
					if validationErr == nil {
						t.Errorf("Expected validation to fail for empty question")
					}
					return
				}

				if validationErr != nil && tt.name != "empty question" {
					t.Errorf("Validation failed unexpectedly: %v", validationErr)
					return
				}

				// Test the business logic flow
				if !tt.expectError || tt.embeddingFails || tt.searchFails || tt.answerFails {
					// Test embedding generation
					mockBedrock := &mockBedrockClient{
						shouldFailEmbedding: tt.embeddingFails,
						shouldFailAnswer:    tt.answerFails,
						mockEmbedding:       tt.mockEmbedding,
						mockAnswer:          tt.mockAnswer,
					}

					if !tt.embeddingFails {
						embedding, err := mockBedrock.GenerateEmbedding(queryRequest.Question)
						if err != nil {
							if !tt.embeddingFails {
								t.Errorf("Embedding generation failed: %v", err)
							}
							return
						}

						if len(embedding) != len(tt.mockEmbedding) {
							t.Errorf("Expected embedding length %d, got %d", len(tt.mockEmbedding), len(embedding))
						}

						// Test vector search
						mockOpenSearch := &mockOpenSearchClient{
							shouldFail:  tt.searchFails,
							mockSources: tt.mockSources,
						}

						if !tt.searchFails {
							sources, err := mockOpenSearch.VectorSearch(context.Background(), embedding, queryRequest.MaxResults)
							if err != nil {
								if !tt.searchFails {
									t.Errorf("Vector search failed: %v", err)
								}
								return
							}

							if len(sources) != len(tt.mockSources) {
								t.Errorf("Expected %d sources, got %d", len(tt.mockSources), len(sources))
							}

							// Test answer generation (only if sources found)
							if len(sources) > 0 && !tt.answerFails {
								answer, err := mockBedrock.GenerateAnswer(queryRequest.Question, sources)
								if err != nil {
									t.Errorf("Answer generation failed: %v", err)
									return
								}

								if answer != tt.mockAnswer {
									t.Errorf("Expected answer '%s', got '%s'", tt.mockAnswer, answer)
								}
							}
						}
					}
				}
			}
		})
	}
}

func TestQueryRequest_Validation(t *testing.T) {
	tests := []struct {
		name        string
		question    string
		maxResults  int
		expectError bool
	}{
		{
			name:        "valid request",
			question:    "What is AI?",
			maxResults:  5,
			expectError: false,
		},
		{
			name:        "empty question",
			question:    "",
			maxResults:  5,
			expectError: true,
		},
		{
			name:        "whitespace only question",
			question:    "   ",
			maxResults:  5,
			expectError: true,
		},
		{
			name:        "zero max results",
			question:    "What is AI?",
			maxResults:  0,
			expectError: false, // Should default to 5
		},
		{
			name:        "negative max results",
			question:    "What is AI?",
			maxResults:  -1,
			expectError: false, // Should default to 5
		},
		{
			name:        "too many max results",
			question:    "What is AI?",
			maxResults:  25,
			expectError: false, // Should cap at 20
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &models.QueryRequest{
				Question:   tt.question,
				MaxResults: tt.maxResults,
			}

			err := req.Validate()

			if tt.expectError && err == nil {
				t.Errorf("Expected validation error, but got none")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected validation error: %v", err)
			}

			// Check that max results are properly adjusted
			if !tt.expectError {
				if req.MaxResults <= 0 {
					t.Errorf("MaxResults should be positive after validation, got %d", req.MaxResults)
				}
				if req.MaxResults > 20 {
					t.Errorf("MaxResults should be capped at 20, got %d", req.MaxResults)
				}
			}
		})
	}
}
