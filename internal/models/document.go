package models

import (
	"time"

	"github.com/google/uuid"
)

// Document represents a document in the RAG system
type Document struct {
	ID          string     `json:"document_id"`
	FileName    string     `json:"file_name"`
	FileType    string     `json:"file_type"`
	FileSize    int64      `json:"file_size"`
	S3Key       string     `json:"s3_key"`
	Status      string     `json:"status"` // uploaded, processing, completed, failed
	UploadedAt  time.Time  `json:"uploaded_at"`
	ProcessedAt *time.Time `json:"processed_at,omitempty"`
	ErrorMsg    string     `json:"error_msg,omitempty"`
}

// DocumentStatus constants
const (
	StatusUploaded   = "uploaded"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusFailed     = "failed"
)

// SupportedFileTypes defines the file types supported by the system
var SupportedFileTypes = map[string]bool{
	"application/pdf":    true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   true,
	"application/vnd.ms-powerpoint":                                             true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
	"text/plain":    true,
	"text/markdown": true,
}

// NewDocument creates a new document instance
func NewDocument(fileName, fileType, s3Key string, fileSize int64) *Document {
	return &Document{
		ID:         uuid.New().String(),
		FileName:   fileName,
		FileType:   fileType,
		FileSize:   fileSize,
		S3Key:      s3Key,
		Status:     StatusUploaded,
		UploadedAt: time.Now(),
	}
}

// IsValidFileType checks if the given file type is supported
func IsValidFileType(fileType string) bool {
	return SupportedFileTypes[fileType]
}

// MarkAsProcessing updates the document status to processing
func (d *Document) MarkAsProcessing() {
	d.Status = StatusProcessing
}

// MarkAsCompleted updates the document status to completed
func (d *Document) MarkAsCompleted() {
	now := time.Now()
	d.Status = StatusCompleted
	d.ProcessedAt = &now
}

// MarkAsFailed updates the document status to failed with error message
func (d *Document) MarkAsFailed(errorMsg string) {
	d.Status = StatusFailed
	d.ErrorMsg = errorMsg
}

// StatusResponse represents the response structure for document status API
type StatusResponse struct {
	DocumentID           string  `json:"document_id"`
	Filename             string  `json:"filename"`
	Status               string  `json:"status"`
	UploadedAt           string  `json:"uploaded_at"`
	ProcessedAt          *string `json:"processed_at,omitempty"`
	TotalChunks          int     `json:"total_chunks"`
	ChunksWithEmbeddings int     `json:"chunks_with_embeddings"`
	LastError            string  `json:"last_error,omitempty"`
}
