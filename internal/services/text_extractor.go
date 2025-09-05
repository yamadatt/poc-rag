package services

import (
	"strings"

	"aws-serverless-rag/internal/models"
)

// TextExtractor handles text extraction from different file formats
type TextExtractor struct {
	officeExtractor *OfficeExtractor
}

// NewTextExtractor creates a new text extractor instance
func NewTextExtractor() *TextExtractor {
	return &TextExtractor{
		officeExtractor: NewOfficeExtractor(),
	}
}

// ExtractText extracts text from a file based on its content type
func (te *TextExtractor) ExtractText(content []byte, contentType, fileName string) (string, error) {
	switch contentType {
	case "text/plain", "text/markdown":
		return string(content), nil
	case "application/pdf":
		return te.extractFromPDF(content)
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return te.extractFromDOCX(content)
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		return te.extractFromPPTX(content)
	default:
		return "", models.ErrInvalidFileType
	}
}

// extractFromPDF extracts text from PDF files
func (te *TextExtractor) extractFromPDF(content []byte) (string, error) {
	return te.officeExtractor.ExtractFromPDF(content)
}



// extractFromDOCX extracts text from Word documents
func (te *TextExtractor) extractFromDOCX(content []byte) (string, error) {
	return te.officeExtractor.ExtractFromDOCX(content)
}



// extractFromPPTX extracts text from PowerPoint presentations
func (te *TextExtractor) extractFromPPTX(content []byte) (string, error) {
	return te.officeExtractor.ExtractFromPPTX(content)
}

// ChunkText splits text into chunks suitable for embedding
func (te *TextExtractor) ChunkText(text string, maxChunkSize int) []string {
	if maxChunkSize <= 0 {
		maxChunkSize = 1000 // Default chunk size
	}

	// Simple sentence-based chunking
	sentences := te.splitIntoSentences(text)
	var chunks []string
	var currentChunk strings.Builder

	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if sentence == "" {
			continue
		}

		// If adding this sentence would exceed max size, start a new chunk
		if currentChunk.Len() > 0 && currentChunk.Len()+len(sentence)+1 > maxChunkSize {
			chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
			currentChunk.Reset()
		}

		if currentChunk.Len() > 0 {
			currentChunk.WriteString(" ")
		}
		currentChunk.WriteString(sentence)
	}

	// Add the last chunk if it has content
	if currentChunk.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
	}

	return chunks
}

// splitIntoSentences splits text into sentences
func (te *TextExtractor) splitIntoSentences(text string) []string {
	// Simple sentence splitting based on common sentence endings
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.ReplaceAll(text, "\r", " ")

	// Split on sentence endings
	sentences := []string{}
	current := ""

	for i, char := range text {
		current += string(char)

		if char == '.' || char == '!' || char == '?' {
			// Look ahead to see if this is actually the end of a sentence
			if i+1 < len(text) && (text[i+1] == ' ' || text[i+1] == '\n' || text[i+1] == '\t') {
				sentences = append(sentences, strings.TrimSpace(current))
				current = ""
			}
		}
	}

	// Add any remaining text
	if strings.TrimSpace(current) != "" {
		sentences = append(sentences, strings.TrimSpace(current))
	}

	return sentences
}

// GetMetadata extracts metadata from the text and file
func (te *TextExtractor) GetMetadata(text, fileName, fileType string, fileContent []byte) map[string]interface{} {
	wordCount := len(strings.Fields(text))
	charCount := len(text)

	metadata := map[string]interface{}{
		"file_name":  fileName,
		"file_type":  fileType,
		"word_count": wordCount,
		"char_count": charCount,
	}

	// Add file-specific metadata based on type
	switch fileType {
	case "application/pdf":
		if pdfMetadata, err := te.officeExtractor.ExtractMetadataFromPDF(fileContent); err == nil {
			for k, v := range pdfMetadata {
				metadata[k] = v
			}
		}
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		if docxMetadata, err := te.officeExtractor.ExtractMetadataFromDOCX(fileContent); err == nil {
			for k, v := range docxMetadata {
				metadata[k] = v
			}
		}
	case "application/msword":
		metadata["document_type"] = "word_document"
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		if pptxMetadata, err := te.officeExtractor.ExtractMetadataFromPPTX(fileContent); err == nil {
			for k, v := range pptxMetadata {
				metadata[k] = v
			}
		}
	case "application/vnd.ms-powerpoint":
		metadata["document_type"] = "presentation"
	}

	return metadata
}
