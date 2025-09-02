package models

// TestHelpers provides test utilities for external packages

// NewTestQueryRequest creates a QueryRequest for testing
func NewTestQueryRequest(question string, maxResults int) *QueryRequest {
	return &QueryRequest{
		Question:   question,
		MaxResults: maxResults,
	}
}

// NewTestSource creates a Source for testing
func NewTestSource(documentID, chunkID, content string, score float64) Source {
	return Source{
		DocumentID: documentID,
		ChunkID:    chunkID,
		Content:    content,
		Score:      score,
	}
}
