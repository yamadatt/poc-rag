package utils

import (
	"mime"
	"path/filepath"
	"strings"

	"aws-serverless-rag/internal/models"
)

// ValidateFileUpload validates file upload parameters
func ValidateFileUpload(filename, contentType string, fileSize int64) error {
	// Check file name
	if filename == "" {
		return models.ErrInvalidRequest
	}

	// Check file extension
	ext := strings.ToLower(filepath.Ext(filename))
	if !isValidFileExtension(ext) {
		return models.ErrInvalidFileType
	}

	// Check content type
	if contentType != "" && !models.IsValidFileType(contentType) {
		return models.ErrInvalidFileType
	}

	// Check file size (max 50MB)
	const maxFileSize = 50 * 1024 * 1024 // 50MB
	if fileSize > maxFileSize {
		return models.ErrInvalidRequest
	}

	return nil
}

// isValidFileExtension checks if the file extension is supported
func isValidFileExtension(ext string) bool {
	validExtensions := map[string]bool{
		".pdf":  true,
		".doc":  true,
		".docx": true,
		".ppt":  true,
		".pptx": true,
		".txt":  true,
		".md":   true,
	}
	return validExtensions[ext]
}

// DetectContentType detects content type from file extension
func DetectContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))

	contentTypes := map[string]string{
		".pdf":  "application/pdf",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".ppt":  "application/vnd.ms-powerpoint",
		".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		".txt":  "text/plain",
		".md":   "text/markdown",
	}

	if contentType, exists := contentTypes[ext]; exists {
		return contentType
	}

	// Fallback to mime detection
	return mime.TypeByExtension(ext)
}

// SanitizeFilename sanitizes the filename for safe storage
func SanitizeFilename(filename string) string {
	// Remove path components
	filename = filepath.Base(filename)

	// Replace spaces with underscores
	filename = strings.ReplaceAll(filename, " ", "_")

	// Remove any potentially dangerous characters
	filename = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
			return r
		}
		return '_'
	}, filename)

	return filename
}

// ValidateQuery validates query parameters
func ValidateQuery(question string, maxResults int) error {
	if strings.TrimSpace(question) == "" {
		return models.ErrInvalidQuestion
	}

	if len(question) > 1000 {
		return models.ErrInvalidRequest
	}

	if maxResults < 1 || maxResults > 20 {
		return models.ErrInvalidRequest
	}

	return nil
}
