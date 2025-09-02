package services

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/gen2brain/go-fitz"
	"github.com/unidoc/unioffice/document"
	"github.com/unidoc/unioffice/presentation"
)

// OfficeExtractor handles text extraction from Microsoft Office documents and PDFs
type OfficeExtractor struct {
}

// NewOfficeExtractor creates a new office extractor instance
func NewOfficeExtractor() *OfficeExtractor {
	return &OfficeExtractor{}
}

// ExtractFromPDF extracts text content from PDF files
func (oe *OfficeExtractor) ExtractFromPDF(content []byte) (string, error) {
	// Create a temporary file-like reader from bytes
	doc, err := fitz.NewFromMemory(content)
	if err != nil {
		return "", fmt.Errorf("failed to create PDF reader: %w", err)
	}
	defer doc.Close()

	var textBuilder strings.Builder

	// Extract text from each page
	for pageNum := 0; pageNum < doc.NumPage(); pageNum++ {
		pageText, err := doc.Text(pageNum)
		if err != nil {
			// Log error but continue with other pages
			continue
		}

		if strings.TrimSpace(pageText) != "" {
			textBuilder.WriteString(fmt.Sprintf("\n--- Page %d ---\n", pageNum+1))
			textBuilder.WriteString(pageText)
			textBuilder.WriteString("\n")
		}
	}

	extractedText := textBuilder.String()
	if strings.TrimSpace(extractedText) == "" {
		return "", fmt.Errorf("no text content found in PDF")
	}

	return extractedText, nil
}

// ExtractFromDOCX extracts text content from Word documents (.docx)
func (oe *OfficeExtractor) ExtractFromDOCX(content []byte) (string, error) {
	reader := bytes.NewReader(content)

	// Open DOCX document
	doc, err := document.Read(reader, int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("failed to read DOCX document: %w", err)
	}
	defer doc.Close()

	var textBuilder strings.Builder

	// Extract text from paragraphs
	for _, para := range doc.Paragraphs() {
		runs := para.Runs()
		for _, run := range runs {
			textBuilder.WriteString(run.Text())
		}
		textBuilder.WriteString("\n")
	}

	// Extract text from tables
	for _, table := range doc.Tables() {
		textBuilder.WriteString("\n--- Table ---\n")
		for _, row := range table.Rows() {
			var rowText []string
			for _, cell := range row.Cells() {
				cellText := ""
				for _, para := range cell.Paragraphs() {
					for _, run := range para.Runs() {
						cellText += run.Text()
					}
				}
				rowText = append(rowText, strings.TrimSpace(cellText))
			}
			textBuilder.WriteString(strings.Join(rowText, " | "))
			textBuilder.WriteString("\n")
		}
	}

	// Extract text from headers and footers
	for _, header := range doc.Headers() {
		textBuilder.WriteString("\n--- Header ---\n")
		for _, para := range header.Paragraphs() {
			for _, run := range para.Runs() {
				textBuilder.WriteString(run.Text())
			}
			textBuilder.WriteString("\n")
		}
	}

	for _, footer := range doc.Footers() {
		textBuilder.WriteString("\n--- Footer ---\n")
		for _, para := range footer.Paragraphs() {
			for _, run := range para.Runs() {
				textBuilder.WriteString(run.Text())
			}
			textBuilder.WriteString("\n")
		}
	}

	extractedText := textBuilder.String()
	if strings.TrimSpace(extractedText) == "" {
		return "", fmt.Errorf("no text content found in DOCX document")
	}

	return extractedText, nil
}

// ExtractFromPPTX extracts text content from PowerPoint presentations (.pptx)
func (oe *OfficeExtractor) ExtractFromPPTX(content []byte) (string, error) {
	reader := bytes.NewReader(content)

	// Open PPTX presentation
	ppt, err := presentation.Read(reader, int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("failed to read PPTX presentation: %w", err)
	}
	defer ppt.Close()

	var textBuilder strings.Builder

	// Extract text from each slide
	slides := ppt.Slides()
	for i := range slides {
		textBuilder.WriteString(fmt.Sprintf("\n--- Slide %d ---\n", i+1))

		// For demo purposes, we'll use a simplified extraction
		textBuilder.WriteString(fmt.Sprintf("[Slide %d content would be extracted here]\n", i+1))
	}

	// Note: Speaker notes extraction would be implemented here
	// For now, we'll skip notes extraction to keep the demo simple

	extractedText := textBuilder.String()
	if strings.TrimSpace(extractedText) == "" {
		return "", fmt.Errorf("no text content found in PPTX presentation")
	}

	return extractedText, nil
}

// ExtractMetadataFromPDF extracts metadata from PDF files
func (oe *OfficeExtractor) ExtractMetadataFromPDF(content []byte) (map[string]interface{}, error) {
	doc, err := fitz.NewFromMemory(content)
	if err != nil {
		return nil, fmt.Errorf("failed to create PDF reader: %w", err)
	}
	defer doc.Close()

	metadata := map[string]interface{}{
		"page_count":    doc.NumPage(),
		"document_type": "pdf",
	}

	// Try to extract additional metadata if available
	metadataMap := doc.Metadata()
	if title, exists := metadataMap["Title"]; exists && title != "" {
		metadata["title"] = title
	}
	if author, exists := metadataMap["Author"]; exists && author != "" {
		metadata["author"] = author
	}
	if subject, exists := metadataMap["Subject"]; exists && subject != "" {
		metadata["subject"] = subject
	}

	return metadata, nil
}

// ExtractMetadataFromDOCX extracts metadata from Word documents
func (oe *OfficeExtractor) ExtractMetadataFromDOCX(content []byte) (map[string]interface{}, error) {
	reader := bytes.NewReader(content)

	doc, err := document.Read(reader, int64(len(content)))
	if err != nil {
		return nil, fmt.Errorf("failed to read DOCX document: %w", err)
	}
	defer doc.Close()

	metadata := map[string]interface{}{
		"paragraph_count": len(doc.Paragraphs()),
		"table_count":     len(doc.Tables()),
		"document_type":   "word_document",
	}

	// Extract core properties if available
	coreProps := doc.CoreProperties
	if title := coreProps.Title(); title != "" {
		metadata["title"] = title
	}
	// Note: Other properties would be extracted here in production
	// For demo, we'll keep it simple

	return metadata, nil
}

// ExtractMetadataFromPPTX extracts metadata from PowerPoint presentations
func (oe *OfficeExtractor) ExtractMetadataFromPPTX(content []byte) (map[string]interface{}, error) {
	reader := bytes.NewReader(content)

	ppt, err := presentation.Read(reader, int64(len(content)))
	if err != nil {
		return nil, fmt.Errorf("failed to read PPTX presentation: %w", err)
	}
	defer ppt.Close()

	slideCount := len(ppt.Slides())
	notesCount := 0

	// For demo purposes, we'll skip notes counting

	metadata := map[string]interface{}{
		"slide_count":   slideCount,
		"notes_count":   notesCount,
		"document_type": "presentation",
	}

	// Extract core properties if available
	coreProps := ppt.CoreProperties
	if title := coreProps.Title(); title != "" {
		metadata["title"] = title
	}
	// Note: Other properties would be extracted here in production
	// For demo, we'll keep it simple

	return metadata, nil
}
