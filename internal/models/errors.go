package models

import (
	"errors"
	"fmt"
)

// Application errors
var (
	ErrInvalidFileType     = errors.New("unsupported file type")
	ErrFileNotFound        = errors.New("file not found")
	ErrProcessingFailed    = errors.New("document processing failed")
	ErrEmbeddingFailed     = errors.New("embedding generation failed")
	ErrVectorSearchFailed  = errors.New("vector search failed")
	ErrLLMGenerationFailed = errors.New("LLM response generation failed")
	ErrInvalidQuestion     = errors.New("question cannot be empty")
	ErrDocumentNotFound    = errors.New("document not found")
	ErrInvalidRequest      = errors.New("invalid request")
	ErrServiceUnavailable  = errors.New("service temporarily unavailable")
)

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains detailed error information
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Error codes
const (
	ErrCodeInvalidFileType     = "INVALID_FILE_TYPE"
	ErrCodeFileNotFound        = "FILE_NOT_FOUND"
	ErrCodeProcessingFailed    = "PROCESSING_FAILED"
	ErrCodeEmbeddingFailed     = "EMBEDDING_FAILED"
	ErrCodeVectorSearchFailed  = "VECTOR_SEARCH_FAILED"
	ErrCodeLLMGenerationFailed = "LLM_GENERATION_FAILED"
	ErrCodeInvalidQuestion     = "INVALID_QUESTION"
	ErrCodeDocumentNotFound    = "DOCUMENT_NOT_FOUND"
	ErrCodeInvalidRequest      = "INVALID_REQUEST"
	ErrCodeServiceUnavailable  = "SERVICE_UNAVAILABLE"
	ErrCodeInternalError       = "INTERNAL_ERROR"
)

// NewErrorResponse creates a new error response
func NewErrorResponse(code, message, details string) *ErrorResponse {
	return &ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// NewErrorResponseFromError creates an error response from a Go error
func NewErrorResponseFromError(err error) *ErrorResponse {
	switch err {
	case ErrInvalidFileType:
		return NewErrorResponse(ErrCodeInvalidFileType, err.Error(), "")
	case ErrFileNotFound:
		return NewErrorResponse(ErrCodeFileNotFound, err.Error(), "")
	case ErrProcessingFailed:
		return NewErrorResponse(ErrCodeProcessingFailed, err.Error(), "")
	case ErrEmbeddingFailed:
		return NewErrorResponse(ErrCodeEmbeddingFailed, err.Error(), "")
	case ErrVectorSearchFailed:
		return NewErrorResponse(ErrCodeVectorSearchFailed, err.Error(), "")
	case ErrLLMGenerationFailed:
		return NewErrorResponse(ErrCodeLLMGenerationFailed, err.Error(), "")
	case ErrInvalidQuestion:
		return NewErrorResponse(ErrCodeInvalidQuestion, err.Error(), "")
	case ErrDocumentNotFound:
		return NewErrorResponse(ErrCodeDocumentNotFound, err.Error(), "")
	case ErrInvalidRequest:
		return NewErrorResponse(ErrCodeInvalidRequest, err.Error(), "")
	case ErrServiceUnavailable:
		return NewErrorResponse(ErrCodeServiceUnavailable, err.Error(), "")
	default:
		return NewErrorResponse(ErrCodeInternalError, "Internal server error", err.Error())
	}
}

// ProcessingError wraps processing errors with additional context
type ProcessingError struct {
	DocumentID string
	Stage      string
	Err        error
}

func (e *ProcessingError) Error() string {
	return fmt.Sprintf("processing error for document %s at stage %s: %v", e.DocumentID, e.Stage, e.Err)
}

func (e *ProcessingError) Unwrap() error {
	return e.Err
}

// NewProcessingError creates a new processing error
func NewProcessingError(documentID, stage string, err error) *ProcessingError {
	return &ProcessingError{
		DocumentID: documentID,
		Stage:      stage,
		Err:        err,
	}
}
