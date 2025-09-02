package models

import "strings"

// QueryRequest represents a query request
type QueryRequest struct {
	Question   string `json:"question" validate:"required,min=1"`
	MaxResults int    `json:"max_results,omitempty"`
}

// QueryResponse represents a query response
type QueryResponse struct {
	Answer  string   `json:"answer"`
	Sources []Source `json:"sources"`
}

// Source represents a source document chunk used in the response
type Source struct {
	DocumentID string                 `json:"document_id"`
	ChunkID    string                 `json:"chunk_id"`
	Content    string                 `json:"content"`
	Score      float64                `json:"score"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// DefaultMaxResults is the default maximum number of results to return
const DefaultMaxResults = 5

// NewQueryRequest creates a new query request with default values
func NewQueryRequest(question string) *QueryRequest {
	return &QueryRequest{
		Question:   question,
		MaxResults: DefaultMaxResults,
	}
}

// NewQueryResponse creates a new query response
func NewQueryResponse(answer string, sources []Source) *QueryResponse {
	return &QueryResponse{
		Answer:  answer,
		Sources: sources,
	}
}

// NewSource creates a new source
func NewSource(documentID, chunkID, content string, score float64, metadata map[string]interface{}) Source {
	return Source{
		DocumentID: documentID,
		ChunkID:    chunkID,
		Content:    content,
		Score:      score,
		Metadata:   metadata,
	}
}

// Validate validates the query request
func (q *QueryRequest) Validate() error {
	if strings.TrimSpace(q.Question) == "" {
		return ErrInvalidQuestion
	}

	if q.MaxResults <= 0 {
		q.MaxResults = DefaultMaxResults
	}

	if q.MaxResults > 20 {
		q.MaxResults = 20 // Cap at 20 for performance
	}

	return nil
}
