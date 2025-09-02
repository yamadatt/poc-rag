//go:build integration
// +build integration

package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"testing"
	"time"

	"aws-serverless-rag/internal/models"
)

// Integration tests for the RAG system
// These tests validate the complete workflow from document upload to query processing

const (
	// Test configuration - these should be set via environment variables in actual testing
	TestAPIEndpoint = "https://your-api-gateway-endpoint.execute-api.region.amazonaws.com/dev"
	TestTimeout     = 60 * time.Second
)

// TestDocumentUploadFlow tests the complete document upload and processing flow
func TestDocumentUploadFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	tests := []struct {
		name        string
		fileName    string
		content     []byte
		contentType string
		expectError bool
	}{
		{
			name:        "upload PDF document",
			fileName:    "test_document.pdf",
			content:     generateMockPDFContent(),
			contentType: "application/pdf",
			expectError: false,
		},
		{
			name:        "upload text document",
			fileName:    "test_document.txt",
			content:     []byte("This is a test document with sample content for RAG testing."),
			contentType: "text/plain",
			expectError: false,
		},
		{
			name:        "upload unsupported format",
			fileName:    "test_document.exe",
			content:     []byte("executable content"),
			contentType: "application/octet-stream",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Step 1: Upload document
			documentID, err := uploadDocument(tt.fileName, tt.content, tt.contentType)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for unsupported file type, but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Failed to upload document: %v", err)
			}

			if documentID == "" {
				t.Fatal("Expected document ID but got empty string")
			}

			t.Logf("Document uploaded successfully with ID: %s", documentID)

			// Step 2: Wait for processing to complete
			err = waitForProcessingComplete(documentID, TestTimeout)
			if err != nil {
				t.Fatalf("Document processing failed or timed out: %v", err)
			}

			// Step 3: Verify document status
			status, err := getDocumentStatus(documentID)
			if err != nil {
				t.Fatalf("Failed to get document status: %v", err)
			}

			if status.Status != models.StatusCompleted {
				t.Errorf("Expected status %s, got %s. Error: %s",
					models.StatusCompleted, status.Status, status.LastError)
			}

			if status.TotalChunks <= 0 {
				t.Error("Expected chunks to be created, but got 0")
			}

			if status.ChunksWithEmbeddings != status.TotalChunks {
				t.Errorf("Expected all chunks to have embeddings. Total: %d, With embeddings: %d",
					status.TotalChunks, status.ChunksWithEmbeddings)
			}

			t.Logf("Document processed successfully. Chunks: %d, Status: %s",
				status.TotalChunks, status.Status)
		})
	}
}

// TestQueryFlow tests the complete query processing flow
func TestQueryFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Prerequisites: Assume we have at least one processed document
	// In a real test suite, this would be set up in TestMain or a setup function

	tests := []struct {
		name          string
		question      string
		maxResults    int
		expectResults bool
		expectError   bool
	}{
		{
			name:          "valid question with results expected",
			question:      "What is the main topic discussed in the document?",
			maxResults:    5,
			expectResults: true,
			expectError:   false,
		},
		{
			name:          "question about specific details",
			question:      "Can you explain the key features mentioned?",
			maxResults:    3,
			expectResults: true,
			expectError:   false,
		},
		{
			name:          "question unlikely to find results",
			question:      "What is the weather forecast for next week?",
			maxResults:    5,
			expectResults: false,
			expectError:   false,
		},
		{
			name:          "empty question",
			question:      "",
			maxResults:    5,
			expectResults: false,
			expectError:   true,
		},
		{
			name:          "question with invalid max results",
			question:      "Valid question",
			maxResults:    -1,
			expectResults: false,
			expectError:   false, // Should be normalized to default
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, err := queryDocuments(tt.question, tt.maxResults)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Query failed: %v", err)
			}

			if response.Answer == "" {
				t.Error("Expected answer but got empty string")
			}

			if tt.expectResults {
				if len(response.Sources) == 0 {
					t.Error("Expected sources but got none")
				} else {
					// Validate source structure
					for i, source := range response.Sources {
						if source.DocumentID == "" {
							t.Errorf("Source %d missing document ID", i)
						}
						if source.ChunkID == "" {
							t.Errorf("Source %d missing chunk ID", i)
						}
						if source.Content == "" {
							t.Errorf("Source %d missing content", i)
						}
						if source.Score <= 0 {
							t.Errorf("Source %d has invalid score: %f", i, source.Score)
						}
					}
				}
			}

			t.Logf("Query successful. Answer length: %d chars, Sources: %d",
				len(response.Answer), len(response.Sources))
		})
	}
}

// TestEndToEndWorkflow tests the complete workflow from upload to query
func TestEndToEndWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Upload a test document
	testContent := []byte(`
	This is a comprehensive test document for the RAG system.
	It contains information about artificial intelligence, machine learning,
	and natural language processing. The document discusses various AI techniques
	including neural networks, deep learning, and transformer architectures.
	It also covers applications of AI in different domains such as healthcare,
	finance, and autonomous vehicles.
	`)

	documentID, err := uploadDocument("e2e_test.txt", testContent, "text/plain")
	if err != nil {
		t.Fatalf("Failed to upload test document: %v", err)
	}

	// Wait for processing
	err = waitForProcessingComplete(documentID, TestTimeout)
	if err != nil {
		t.Fatalf("Document processing failed: %v", err)
	}

	// Test various queries
	queries := []string{
		"What does this document discuss about artificial intelligence?",
		"Tell me about machine learning applications",
		"What are the AI techniques mentioned?",
	}

	for _, query := range queries {
		t.Run(fmt.Sprintf("query: %s", query), func(t *testing.T) {
			response, err := queryDocuments(query, 5)
			if err != nil {
				t.Errorf("Query failed: %v", err)
				return
			}

			if response.Answer == "" {
				t.Error("Expected answer but got empty response")
			}

			if len(response.Sources) == 0 {
				t.Error("Expected sources but got none")
			}

			// Verify that the source contains the uploaded document
			found := false
			for _, source := range response.Sources {
				if source.DocumentID == documentID {
					found = true
					break
				}
			}

			if !found {
				t.Error("Expected to find the uploaded document in sources")
			}
		})
	}
}

// Helper functions

func uploadDocument(fileName string, content []byte, contentType string) (string, error) {
	// Create multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return "", err
	}

	_, err = part.Write(content)
	if err != nil {
		return "", err
	}

	err = writer.Close()
	if err != nil {
		return "", err
	}

	// Send request
	req, err := http.NewRequest("POST", TestAPIEndpoint+"/documents", &buf)
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: TestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response to get document ID
	var uploadResponse struct {
		DocumentID string `json:"document_id"`
		Message    string `json:"message"`
	}

	err = json.NewDecoder(resp.Body).Decode(&uploadResponse)
	if err != nil {
		return "", err
	}

	return uploadResponse.DocumentID, nil
}

func waitForProcessingComplete(documentID string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		status, err := getDocumentStatus(documentID)
		if err != nil {
			return fmt.Errorf("failed to check status: %w", err)
		}

		switch status.Status {
		case models.StatusCompleted:
			return nil
		case models.StatusFailed:
			return fmt.Errorf("processing failed: %s", status.LastError)
		default:
			// Still processing, wait and retry
			time.Sleep(2 * time.Second)
		}
	}

	return fmt.Errorf("processing timeout after %v", timeout)
}

func getDocumentStatus(documentID string) (*models.StatusResponse, error) {
	url := fmt.Sprintf("%s/documents/%s/status", TestAPIEndpoint, documentID)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var status models.StatusResponse
	err = json.NewDecoder(resp.Body).Decode(&status)
	if err != nil {
		return nil, err
	}

	return &status, nil
}

func queryDocuments(question string, maxResults int) (*models.QueryResponse, error) {
	requestBody := models.QueryRequest{
		Question:   question,
		MaxResults: maxResults,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", TestAPIEndpoint+"/query", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: TestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("query failed with status %d: %s", resp.StatusCode, string(body))
	}

	var queryResponse models.QueryResponse
	err = json.NewDecoder(resp.Body).Decode(&queryResponse)
	if err != nil {
		return nil, err
	}

	return &queryResponse, nil
}

func generateMockPDFContent() []byte {
	// This would generate a mock PDF for testing
	// For now, return a simple byte array that represents PDF structure
	return []byte("%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000174 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n268\n%%EOF")
}
