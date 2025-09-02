package models

import (
	"testing"
)

func TestQueryRequest_Validate(t *testing.T) {
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
			req := &QueryRequest{
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

func TestNewQueryResponse(t *testing.T) {
	answer := "Test answer"
	sources := []Source{
		NewTestSource("doc1", "chunk1", "Test content", 0.95),
	}

	response := NewQueryResponse(answer, sources)

	if response.Answer != answer {
		t.Errorf("Expected answer '%s', got '%s'", answer, response.Answer)
	}

	if len(response.Sources) != len(sources) {
		t.Errorf("Expected %d sources, got %d", len(sources), len(response.Sources))
	}

	if response.Sources[0].DocumentID != sources[0].DocumentID {
		t.Errorf("Expected document ID '%s', got '%s'", sources[0].DocumentID, response.Sources[0].DocumentID)
	}
}
