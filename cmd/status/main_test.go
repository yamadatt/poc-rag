package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"aws-serverless-rag/internal/models"
)

func TestStatusHandler_ValidRequest(t *testing.T) {
	tests := []struct {
		name           string
		httpMethod     string
		documentID     string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "valid document ID",
			httpMethod:     "GET",
			documentID:     "doc-123",
			expectedStatus: 200,
			expectError:    false,
		},
		{
			name:           "missing document ID",
			httpMethod:     "GET",
			documentID:     "",
			expectedStatus: 400,
			expectError:    true,
		},
		{
			name:           "invalid HTTP method",
			httpMethod:     "POST",
			documentID:     "doc-123",
			expectedStatus: 400,
			expectError:    true,
		},
		{
			name:           "OPTIONS request for CORS",
			httpMethod:     "OPTIONS",
			documentID:     "doc-123",
			expectedStatus: 200,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create handler
			handler, err := NewHandler()
			if err != nil {
				t.Fatalf("Failed to create handler: %v", err)
			}

			// Create mock request
			pathParams := map[string]string{}
			if tt.documentID != "" {
				pathParams["document_id"] = tt.documentID
			}

			request := events.APIGatewayProxyRequest{
				HTTPMethod:     tt.httpMethod,
				PathParameters: pathParams,
				RequestContext: events.APIGatewayProxyRequestContext{
					RequestID: "test-request-id",
				},
			}

			// Call handler
			response, err := handler.HandleRequest(context.Background(), request)
			if err != nil {
				t.Fatalf("Handler returned error: %v", err)
			}

			// Check status code
			if response.StatusCode != tt.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tt.expectedStatus, response.StatusCode)
			}

			// For successful requests, validate response structure
			if !tt.expectError && response.StatusCode == 200 && tt.httpMethod != "OPTIONS" {
				var statusResponse models.StatusResponse
				err := json.Unmarshal([]byte(response.Body), &statusResponse)
				if err != nil {
					t.Errorf("Failed to parse response JSON: %v", err)
					return
				}

				// Validate response fields
				if statusResponse.DocumentID == "" {
					t.Error("Expected DocumentID to be set")
				}
				if statusResponse.Status == "" {
					t.Error("Expected Status to be set")
				}
				if statusResponse.UploadedAt == "" {
					t.Error("Expected UploadedAt to be set")
				}
			}
		})
	}
}

func TestStatusResponse_Structure(t *testing.T) {
	// Test StatusResponse model structure
	statusResponse := models.StatusResponse{
		DocumentID:           "doc-123",
		Filename:             "test.pdf",
		Status:               models.StatusCompleted,
		UploadedAt:           "2023-12-01T10:00:00Z",
		ProcessedAt:          &[]string{"2023-12-01T10:05:00Z"}[0],
		TotalChunks:          5,
		ChunksWithEmbeddings: 5,
		LastError:            "",
	}

	// Test JSON marshaling
	jsonData, err := json.Marshal(statusResponse)
	if err != nil {
		t.Errorf("Failed to marshal StatusResponse: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshaled models.StatusResponse
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Errorf("Failed to unmarshal StatusResponse: %v", err)
	}

	// Validate fields
	if unmarshaled.DocumentID != statusResponse.DocumentID {
		t.Errorf("Expected DocumentID %s, got %s", statusResponse.DocumentID, unmarshaled.DocumentID)
	}
	if unmarshaled.Status != statusResponse.Status {
		t.Errorf("Expected Status %s, got %s", statusResponse.Status, unmarshaled.Status)
	}
	if unmarshaled.TotalChunks != statusResponse.TotalChunks {
		t.Errorf("Expected TotalChunks %d, got %d", statusResponse.TotalChunks, unmarshaled.TotalChunks)
	}
}
