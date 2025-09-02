package models

import (
	"time"

	"github.com/google/uuid"
)

// Chunk represents a text chunk with its embedding
type Chunk struct {
	ID         string                 `json:"chunk_id"`
	DocumentID string                 `json:"document_id"`
	Content    string                 `json:"content"`
	Embedding  []float32              `json:"embedding"`
	Metadata   map[string]interface{} `json:"metadata"`
	ChunkIndex int                    `json:"chunk_index"`
	CreatedAt  time.Time              `json:"created_at"`
}

// ChunkMetadata contains additional information about the chunk
type ChunkMetadata struct {
	FileName    string `json:"file_name"`
	FileType    string `json:"file_type"`
	ChunkIndex  int    `json:"chunk_index"`
	TotalChunks int    `json:"total_chunks"`
	PageNumber  *int   `json:"page_number,omitempty"`
	SlideNumber *int   `json:"slide_number,omitempty"`
	WordCount   int    `json:"word_count"`
	CharCount   int    `json:"char_count"`
}

// NewChunk creates a new chunk instance
func NewChunk(documentID, content string, chunkIndex int, metadata map[string]interface{}) *Chunk {
	return &Chunk{
		ID:         uuid.New().String(),
		DocumentID: documentID,
		Content:    content,
		Metadata:   metadata,
		ChunkIndex: chunkIndex,
		CreatedAt:  time.Now(),
	}
}

// SetEmbedding sets the embedding vector for the chunk
func (c *Chunk) SetEmbedding(embedding []float32) {
	c.Embedding = embedding
}

// GetWordCount returns the word count of the chunk content
func (c *Chunk) GetWordCount() int {
	if wordCount, ok := c.Metadata["word_count"].(int); ok {
		return wordCount
	}
	return 0
}

// GetCharCount returns the character count of the chunk content
func (c *Chunk) GetCharCount() int {
	if charCount, ok := c.Metadata["char_count"].(int); ok {
		return charCount
	}
	return len(c.Content)
}

// HasEmbedding checks if the chunk has an embedding vector
func (c *Chunk) HasEmbedding() bool {
	return len(c.Embedding) > 0
}
