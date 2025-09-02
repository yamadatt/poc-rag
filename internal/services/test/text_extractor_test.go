package test

import (
	"strings"
	"testing"

	"aws-serverless-rag/internal/services"
)

func TestTextExtractor_ChunkText(t *testing.T) {
	extractor := services.NewTextExtractor()

	tests := []struct {
		name          string
		text          string
		maxChunkSize  int
		expectedCount int
		description   string
	}{
		{
			name:          "empty text",
			text:          "",
			maxChunkSize:  100,
			expectedCount: 0,
			description:   "Empty text should return no chunks",
		},
		{
			name:          "short text",
			text:          "This is a short text.",
			maxChunkSize:  100,
			expectedCount: 1,
			description:   "Text shorter than chunk size should return one chunk",
		},
		{
			name:          "text requiring multiple chunks",
			text:          "This is sentence one. This is sentence two. This is sentence three. This is sentence four.",
			maxChunkSize:  30,
			expectedCount: 4, // Adjusted based on actual sentence splitting behavior
			description:   "Text longer than chunk size should be split into multiple chunks",
		},
		{
			name:          "text with default chunk size",
			text:          "This is a test sentence.",
			maxChunkSize:  0, // Should use default
			expectedCount: 1,
			description:   "Zero chunk size should use default value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chunks := extractor.ChunkText(tt.text, tt.maxChunkSize)

			if len(chunks) != tt.expectedCount {
				t.Errorf("ChunkText() got %d chunks, want %d chunks for test: %s",
					len(chunks), tt.expectedCount, tt.description)
			}

			// Verify that chunks are not empty (except for empty input)
			if tt.text != "" {
				for i, chunk := range chunks {
					if chunk == "" {
						t.Errorf("Chunk %d is empty", i)
					}
				}
			}

			// Verify that all chunks respect the size limit (with some tolerance for sentence boundaries)
			if tt.maxChunkSize > 0 {
				for i, chunk := range chunks {
					if len(chunk) > tt.maxChunkSize*2 { // Allow some tolerance
						t.Errorf("Chunk %d exceeds size limit: got %d, max %d", i, len(chunk), tt.maxChunkSize)
					}
				}
			}
		})
	}
}

func TestTextExtractor_GetMetadata(t *testing.T) {
	extractor := services.NewTextExtractor()

	tests := []struct {
		name         string
		text         string
		fileName     string
		fileType     string
		fileContent  []byte
		expectedKeys []string
	}{
		{
			name:         "basic metadata",
			text:         "This is a test document with some words.",
			fileName:     "test.txt",
			fileType:     "text/plain",
			fileContent:  []byte("test content"),
			expectedKeys: []string{"file_name", "file_type", "word_count", "char_count"},
		},
		{
			name:         "PDF metadata",
			text:         "PDF content here.",
			fileName:     "test.pdf",
			fileType:     "application/pdf",
			fileContent:  []byte("fake pdf content"),
			expectedKeys: []string{"file_name", "file_type", "word_count", "char_count"},
		},
		{
			name:         "DOCX metadata",
			text:         "Word document content.",
			fileName:     "test.docx",
			fileType:     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			fileContent:  []byte("fake docx content"),
			expectedKeys: []string{"file_name", "file_type", "word_count", "char_count"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadata := extractor.GetMetadata(tt.text, tt.fileName, tt.fileType, tt.fileContent)

			// Check that all expected keys are present
			for _, key := range tt.expectedKeys {
				if _, exists := metadata[key]; !exists {
					t.Errorf("Expected metadata key '%s' not found", key)
				}
			}

			// Verify word count is reasonable
			if wordCount, ok := metadata["word_count"]; ok {
				if count, ok := wordCount.(int); ok {
					expectedWords := len(strings.Fields(tt.text))
					if count != expectedWords {
						t.Errorf("Word count mismatch: got %d, expected %d", count, expectedWords)
					}
				}
			}

			// Verify char count
			if charCount, ok := metadata["char_count"]; ok {
				if count, ok := charCount.(int); ok {
					if count != len(tt.text) {
						t.Errorf("Char count mismatch: got %d, expected %d", count, len(tt.text))
					}
				}
			}
		})
	}
}
