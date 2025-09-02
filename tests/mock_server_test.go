package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"aws-serverless-rag/internal/models"
)

// MockRAGServer creates a mock HTTP server for testing integration scenarios
type MockRAGServer struct {
	server    *httptest.Server
	documents map[string]*MockDocument
}

type MockDocument struct {
	ID          string
	Status      string
	TotalChunks int
	LastError   string
	UploadedAt  time.Time
	ProcessedAt *time.Time
}

func NewMockRAGServer() *MockRAGServer {
	mock := &MockRAGServer{
		documents: make(map[string]*MockDocument),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/documents", mock.handleDocumentUpload)
	mux.HandleFunc("/documents/", mock.handleDocumentStatus)
	mux.HandleFunc("/query", mock.handleQuery)

	mock.server = httptest.NewServer(mux)
	return mock
}

func (m *MockRAGServer) Close() {
	m.server.Close()
}

func (m *MockRAGServer) URL() string {
	return m.server.URL
}

func (m *MockRAGServer) handleDocumentUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File not found", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Check for unsupported file types
	if strings.HasSuffix(header.Filename, ".exe") {
		http.Error(w, "Unsupported file type", http.StatusBadRequest)
		return
	}

	// Create mock document
	docID := fmt.Sprintf("doc-%d", time.Now().Unix())
	mockDoc := &MockDocument{
		ID:          docID,
		Status:      models.StatusUploaded,
		TotalChunks: 0,
		UploadedAt:  time.Now(),
	}

	// Simulate processing based on file size
	if len(content) > 100 {
		mockDoc.TotalChunks = len(content) / 100 // Rough chunk estimation
	} else {
		mockDoc.TotalChunks = 1
	}

	// Simulate processing time
	go m.simulateProcessing(docID)

	m.documents[docID] = mockDoc

	response := map[string]string{
		"document_id": docID,
		"message":     "Document uploaded successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MockRAGServer) handleDocumentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract document ID from path
	path := strings.TrimPrefix(r.URL.Path, "/documents/")
	docID := strings.TrimSuffix(path, "/status")

	doc, exists := m.documents[docID]
	if !exists {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	var processedAtStr *string
	if doc.ProcessedAt != nil {
		str := doc.ProcessedAt.Format(time.RFC3339)
		processedAtStr = &str
	}

	response := models.StatusResponse{
		DocumentID:  doc.ID,
		Filename:    "mock_file.txt",
		Status:      doc.Status,
		UploadedAt:  doc.UploadedAt.Format(time.RFC3339),
		ProcessedAt: processedAtStr,
		TotalChunks: doc.TotalChunks,
		ChunksWithEmbeddings: func() int {
			if doc.Status == models.StatusCompleted {
				return doc.TotalChunks
			}
			return 0
		}(),
		LastError: doc.LastError,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MockRAGServer) handleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request models.QueryRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	err = request.Validate()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate mock response based on question
	sources := []models.Source{}
	answer := ""

	if strings.Contains(strings.ToLower(request.Question), "weather") {
		// Question unlikely to have results
		answer = "I couldn't find relevant information about weather in the knowledge base."
	} else {
		// Generate mock sources
		for i := 0; i < min(request.MaxResults, 3); i++ {
			sources = append(sources, models.Source{
				DocumentID: fmt.Sprintf("doc-%d", i+1),
				ChunkID:    fmt.Sprintf("chunk-%d", i+1),
				Content:    fmt.Sprintf("This is mock content chunk %d that relates to your question about %s", i+1, request.Question),
				Score:      float64(95-i*5) / 100.0, // Decreasing relevance scores
			})
		}

		answer = fmt.Sprintf("Based on the available information, here's what I found regarding your question about %s: %s",
			request.Question, "This is a comprehensive answer generated from the mock knowledge base.")
	}

	response := models.QueryResponse{
		Answer:  answer,
		Sources: sources,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MockRAGServer) simulateProcessing(docID string) {
	// Simulate processing delay
	time.Sleep(100 * time.Millisecond)

	doc := m.documents[docID]
	doc.Status = models.StatusProcessing

	// Simulate additional processing time
	time.Sleep(200 * time.Millisecond)

	// Mark as completed
	now := time.Now()
	doc.Status = models.StatusCompleted
	doc.ProcessedAt = &now
}

// TestWithMockServer tests the integration scenarios using mock server
func TestWithMockServer(t *testing.T) {
	mockServer := NewMockRAGServer()
	defer mockServer.Close()

	// Mock server test doesn't need external API endpoint
	// TestAPIEndpoint is only available when integration tag is used

	t.Run("document upload and processing", func(t *testing.T) {
		// Upload document
		docID, err := uploadDocumentToMock(mockServer.URL(), "test.txt", []byte("Test content for mock server"), "text/plain")
		if err != nil {
			t.Fatalf("Failed to upload document: %v", err)
		}

		// Wait for processing
		err = waitForProcessingCompleteMock(mockServer.URL(), docID, 5*time.Second)
		if err != nil {
			t.Fatalf("Processing failed: %v", err)
		}

		// Verify status
		status, err := getDocumentStatusMock(mockServer.URL(), docID)
		if err != nil {
			t.Fatalf("Failed to get status: %v", err)
		}

		if status.Status != models.StatusCompleted {
			t.Errorf("Expected status %s, got %s", models.StatusCompleted, status.Status)
		}
	})

	t.Run("query processing", func(t *testing.T) {
		response, err := queryDocumentsMock(mockServer.URL(), "What is artificial intelligence?", 5)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}

		if response.Answer == "" {
			t.Error("Expected answer but got empty string")
		}

		if len(response.Sources) == 0 {
			t.Error("Expected sources but got none")
		}
	})

	t.Run("unsupported file type", func(t *testing.T) {
		_, err := uploadDocumentToMock(mockServer.URL(), "malware.exe", []byte("bad content"), "application/octet-stream")
		if err == nil {
			t.Error("Expected error for unsupported file type")
		}
	})
}

// Helper functions for mock server

func uploadDocumentToMock(baseURL, fileName string, content []byte, contentType string) (string, error) {
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

	resp, err := http.Post(baseURL+"/documents", writer.FormDataContentType(), &buf)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

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

func waitForProcessingCompleteMock(baseURL, documentID string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		status, err := getDocumentStatusMock(baseURL, documentID)
		if err != nil {
			return err
		}

		switch status.Status {
		case models.StatusCompleted:
			return nil
		case models.StatusFailed:
			return fmt.Errorf("processing failed: %s", status.LastError)
		default:
			time.Sleep(50 * time.Millisecond)
		}
	}

	return fmt.Errorf("processing timeout")
}

func getDocumentStatusMock(baseURL, documentID string) (*models.StatusResponse, error) {
	url := fmt.Sprintf("%s/documents/%s/status", baseURL, documentID)

	resp, err := http.Get(url)
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

func queryDocumentsMock(baseURL, question string, maxResults int) (*models.QueryResponse, error) {
	requestBody := models.QueryRequest{
		Question:   question,
		MaxResults: maxResults,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(baseURL+"/query", "application/json", bytes.NewBuffer(jsonData))
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
