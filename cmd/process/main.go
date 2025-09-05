package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/aws/aws-sdk-go/service/bedrockruntime"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/aws/aws-sdk-go/service/s3"
)

type Document struct {
	ID          string    `json:"document_id"`
	FileName    string    `json:"file_name"`
	FileType    string    `json:"file_type"`
	S3Key       string    `json:"s3_key"`
	Status      string    `json:"status"`
	ProcessedAt time.Time `json:"processed_at"`
	ChunkCount  int       `json:"chunk_count"`
	TextLength  int       `json:"text_length"`
}

type Chunk struct {
	ChunkID    string    `json:"chunk_id"`
	DocumentID string    `json:"document_id"`
	Content    string    `json:"content"`
	ChunkIndex int       `json:"chunk_index"`
	CreatedAt  time.Time `json:"created_at"`
	Vector     []float64 `json:"vector,omitempty"`
}

type BedrockEmbeddingRequest struct {
	InputText string `json:"inputText"`
}

type BedrockEmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
}

type OpenSearchDocument struct {
	DocumentID string    `json:"document_id"`
	ChunkID    string    `json:"chunk_id"`
	Content    string    `json:"content"`
	ChunkIndex int       `json:"chunk_index"`
	Vector     []float64 `json:"vector"`
	CreatedAt  time.Time `json:"created_at"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Document processing handler called")

	headers := map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Methods": "*",
		"Access-Control-Allow-Headers": "*",
	}

	// Handle OPTIONS request for CORS
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
			Body:       `{"message": "OK"}`,
		}, nil
	}

	if request.HTTPMethod != "POST" {
		return events.APIGatewayProxyResponse{
			StatusCode: 405,
			Headers:    headers,
			Body:       `{"error": "Method not allowed"}`,
		}, nil
	}

	// Parse request body to get document ID
	var requestBody struct {
		DocumentID string `json:"document_id"`
	}

	if err := json.Unmarshal([]byte(request.Body), &requestBody); err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Invalid request body: %s"}`, err.Error()),
		}, nil
	}

	if requestBody.DocumentID == "" {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "document_id is required"}`,
		}, nil
	}

	// Process the document
	result, err := processDocument(requestBody.DocumentID)
	if err != nil {
		fmt.Printf("Processing error: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Processing failed: %s"}`, err.Error()),
		}, nil
	}

	responseBody, err := json.Marshal(result)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to marshal response"}`,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func processDocument(documentID string) (*Document, error) {
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String("ap-northeast-1"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS session: %w", err)
	}

	s3Client := s3.New(sess)

	// Get bucket name from environment variable
	bucketName := os.Getenv("DOCUMENT_BUCKET")
	if bucketName == "" {
		bucketName = "aws-serverless-rag-prod-documents-prod" // fallback
	}

	// Find the document in S3 by metadata
	s3Key, metadata, err := findDocumentInS3(s3Client, bucketName, documentID)
	if err != nil {
		return nil, fmt.Errorf("failed to find document: %w", err)
	}

	// Extract metadata
	fileName := getStringFromMetadata(metadata, "original-name", strings.Split(s3Key, "/")[len(strings.Split(s3Key, "/"))-1])
	fileType := detectFileType(fileName)

	// Check if file type is supported (only .txt and .md)
	if !isSupportedFileType(fileType) {
		return nil, fmt.Errorf("unsupported file type: %s (only .txt and .md files are supported)", fileType)
	}

	fmt.Printf("Processing document: %s (%s)\n", fileName, fileType)

	// Download file content from S3
	content, err := downloadFileFromS3(s3Client, bucketName, s3Key)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}

	// Extract text (for .txt and .md, this is just the raw content)
	text := string(content)
	if !utf8.Valid(content) {
		return nil, fmt.Errorf("file content is not valid UTF-8")
	}

	fmt.Printf("Extracted text length: %d characters\n", len(text))

	// Split text into chunks
	chunks := chunkText(text, 1000) // 1000 character chunks
	fmt.Printf("Created %d chunks\n", len(chunks))

	// Generate embeddings for chunks using Bedrock
	bedrockClient := bedrockruntime.New(sess)
	processedChunks, err := generateEmbeddings(bedrockClient, documentID, chunks)
	if err != nil {
		fmt.Printf("Warning: Failed to generate embeddings: %v\n", err)
		// Continue without embeddings for now
		processedChunks = chunks
	}

	// Store vectors in OpenSearch if embeddings were generated
	if len(processedChunks) > 0 && len(processedChunks[0].Vector) > 0 {
		err = storeVectorsInOpenSearch(sess, processedChunks)
		if err != nil {
			fmt.Printf("Warning: Failed to store vectors in OpenSearch: %v\n", err)
			// Continue without failing the entire process
		}
	}

	// Create document record
	document := &Document{
		ID:          documentID,
		FileName:    fileName,
		FileType:    fileType,
		S3Key:       s3Key,
		Status:      "processed",
		ProcessedAt: time.Now(),
		ChunkCount:  len(processedChunks),
		TextLength:  len(text),
	}

	// Save document metadata to DynamoDB
	err = saveToDynamoDB(sess, document)
	if err != nil {
		fmt.Printf("Warning: Failed to save to DynamoDB: %v\n", err)
		// Don't fail the entire process, just log the warning
	}

	// For now, we just return the document info
	// In Phase 2, we will add vector storage to OpenSearch
	fmt.Printf("Document processed successfully: %s\n", documentID)

	return document, nil
}

func findDocumentInS3(s3Client *s3.S3, bucketName, documentID string) (string, map[string]*string, error) {
	fmt.Printf("Searching for document ID: %s in bucket: %s\n", documentID, bucketName)

	// List objects in the documents folder
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String("documents/prod/"),
	}

	result, err := s3Client.ListObjectsV2(input)
	if err != nil {
		return "", nil, fmt.Errorf("failed to list S3 objects: %w", err)
	}

	fmt.Printf("Found %d objects with prefix 'documents/prod/'\n", len(result.Contents))

	// Find object with matching document ID in metadata
	for _, item := range result.Contents {
		if strings.HasSuffix(*item.Key, "/") {
			continue // Skip directory markers
		}

		fmt.Printf("Checking object: %s\n", *item.Key)

		// Get object metadata
		headInput := &s3.HeadObjectInput{
			Bucket: aws.String(bucketName),
			Key:    item.Key,
		}

		headResult, err := s3Client.HeadObject(headInput)
		if err != nil {
			fmt.Printf("Failed to get metadata for %s: %v\n", *item.Key, err)
			continue // Skip if can't get metadata
		}

		// Log all metadata for debugging
		fmt.Printf("Metadata for %s:\n", *item.Key)
		for k, v := range headResult.Metadata {
			if v != nil {
				fmt.Printf("  %s: %s\n", k, *v)
			}
		}

		// Check if document ID matches (try both formats)
		var docID *string
		if id := headResult.Metadata["Document-Id"]; id != nil {
			docID = id
		} else if id := headResult.Metadata["document-id"]; id != nil {
			docID = id
		}

		// Extract filename from key for comparison
		keyParts := strings.Split(*item.Key, "/")
		filename := keyParts[len(keyParts)-1]

		fmt.Printf("Comparing:\n  Searching for: '%s' (len=%d)\n  DocID: '%s'\n  Filename: '%s' (len=%d)\n",
			documentID, len(documentID),
			func() string {
				if docID != nil {
					return *docID
				} else {
					return "nil"
				}
			}(),
			filename, len(filename))

		// Debug: Check if strings match
		filenameMatch := filename == documentID
		fmt.Printf("  Filename match: %t\n", filenameMatch)
		if !filenameMatch && len(filename) == len(documentID) {
			for i, r := range documentID {
				if i < len(filename) && rune(filename[i]) != r {
					fmt.Printf("  Diff at pos %d: got %q, want %q\n", i, filename[i], r)
					break
				}
			}
		}

		// Match by document ID or filename
		if (docID != nil && *docID == documentID) || filenameMatch {
			fmt.Printf("Found matching document: %s\n", *item.Key)
			return *item.Key, headResult.Metadata, nil
		}
	}

	return "", nil, fmt.Errorf("document with ID %s not found", documentID)
}

func downloadFileFromS3(s3Client *s3.S3, bucketName, s3Key string) ([]byte, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(s3Key),
	}

	result, err := s3Client.GetObject(input)
	if err != nil {
		return nil, fmt.Errorf("failed to get object from S3: %w", err)
	}
	defer result.Body.Close()

	content, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read object content: %w", err)
	}

	return content, nil
}

func getStringFromMetadata(metadata map[string]*string, key, defaultValue string) string {
	if value, exists := metadata[key]; exists && value != nil {
		return *value
	}
	return defaultValue
}

func detectFileType(fileName string) string {
	ext := strings.ToLower(fileName[strings.LastIndex(fileName, ".")+1:])
	switch ext {
	case "md":
		return "text/markdown"
	case "txt":
		return "text/plain"
	default:
		return "unknown"
	}
}

func isSupportedFileType(fileType string) bool {
	supportedTypes := []string{"text/markdown", "text/plain"}
	for _, supported := range supportedTypes {
		if fileType == supported {
			return true
		}
	}
	return false
}

func chunkText(text string, maxChunkSize int) []Chunk {
	var chunks []Chunk
	chunkIndex := 0

	// Simple chunking by character count with word boundary preservation
	for i := 0; i < len(text); i += maxChunkSize {
		end := i + maxChunkSize
		if end > len(text) {
			end = len(text)
		}

		chunkText := text[i:end]

		// Try to end at word boundary if not at the end of text
		if end < len(text) {
			if lastSpace := strings.LastIndex(chunkText, " "); lastSpace > maxChunkSize/2 {
				chunkText = chunkText[:lastSpace]
				end = i + lastSpace
			}
		}

		// Skip empty chunks
		if strings.TrimSpace(chunkText) == "" {
			continue
		}

		chunk := Chunk{
			ChunkID:    fmt.Sprintf("chunk_%d", chunkIndex),
			Content:    strings.TrimSpace(chunkText),
			ChunkIndex: chunkIndex,
			CreatedAt:  time.Now(),
		}

		chunks = append(chunks, chunk)
		chunkIndex++

		// Adjust loop counter for word boundary
		if end < len(text) && end != i+maxChunkSize {
			i = end - maxChunkSize
		}
	}

	return chunks
}

func generateEmbeddings(bedrockClient *bedrockruntime.BedrockRuntime, documentID string, chunks []Chunk) ([]Chunk, error) {
	// Use Titan Text Embeddings V2 (if available) or fallback to V1
	modelID := "amazon.titan-embed-text-v2:0"

	processedChunks := make([]Chunk, len(chunks))

	for i, chunk := range chunks {
		// Set document ID for chunk
		chunk.DocumentID = documentID

		// Create embedding request
		requestBody := BedrockEmbeddingRequest{
			InputText: chunk.Content,
		}

		requestJSON, err := json.Marshal(requestBody)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal embedding request: %w", err)
		}

		// Call Bedrock to generate embedding
		input := &bedrockruntime.InvokeModelInput{
			ModelId:     aws.String(modelID),
			ContentType: aws.String("application/json"),
			Accept:      aws.String("application/json"),
			Body:        requestJSON,
		}

		result, err := bedrockClient.InvokeModel(input)
		if err != nil {
			// If V2 fails, try V1
			if strings.Contains(err.Error(), "AccessDeniedException") && modelID == "amazon.titan-embed-text-v2:0" {
				fmt.Printf("V2 embeddings not available, trying V1...\n")
				modelID = "amazon.titan-embed-text-v1"
				input.ModelId = aws.String(modelID)
				result, err = bedrockClient.InvokeModel(input)
			}

			if err != nil {
				return nil, fmt.Errorf("failed to generate embedding for chunk %d: %w", i, err)
			}
		}

		// Parse embedding response
		var response BedrockEmbeddingResponse
		if err := json.Unmarshal(result.Body, &response); err != nil {
			return nil, fmt.Errorf("failed to unmarshal embedding response: %w", err)
		}

		// Add vector to chunk
		chunk.Vector = response.Embedding
		processedChunks[i] = chunk

		fmt.Printf("Generated embedding for chunk %d (dimension: %d)\n", i, len(response.Embedding))
	}

	fmt.Printf("Successfully generated embeddings for %d chunks\n", len(processedChunks))
	return processedChunks, nil
}

func storeVectorsInOpenSearch(sess *session.Session, chunks []Chunk) error {
	// Get OpenSearch endpoint from environment variable
	opensearchEndpoint := os.Getenv("OPENSEARCH_ENDPOINT")
	if opensearchEndpoint == "" {
		return fmt.Errorf("OPENSEARCH_ENDPOINT environment variable not set")
	}

	// Ensure index exists first
	err := ensureVectorIndexExists(sess, opensearchEndpoint)
	if err != nil {
		return fmt.Errorf("failed to ensure vector index exists: %w", err)
	}

	// Store each chunk as a document
	for i, chunk := range chunks {
		if len(chunk.Vector) == 0 {
			fmt.Printf("Skipping chunk %d: no vector data\n", i)
			continue
		}

		doc := OpenSearchDocument{
			DocumentID: chunk.DocumentID,
			ChunkID:    chunk.ChunkID,
			Content:    chunk.Content,
			ChunkIndex: chunk.ChunkIndex,
			Vector:     chunk.Vector,
			CreatedAt:  chunk.CreatedAt,
		}

		err := indexDocument(sess, opensearchEndpoint, doc)
		if err != nil {
			fmt.Printf("Failed to index chunk %d: %v\n", i, err)
			// Continue with other chunks
		} else {
			fmt.Printf("Successfully indexed chunk %d to OpenSearch\n", i)
		}
	}

	return nil
}

func ensureVectorIndexExists(sess *session.Session, endpoint string) error {
	indexMapping := map[string]interface{}{
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"document_id": map[string]interface{}{
					"type": "keyword",
				},
				"chunk_id": map[string]interface{}{
					"type": "keyword",
				},
				"content": map[string]interface{}{
					"type":     "text",
					"analyzer": "standard",
				},
				"chunk_index": map[string]interface{}{
					"type": "integer",
				},
				"vector": map[string]interface{}{
					"type":      "knn_vector",
					"dimension": 1536, // Titan embedding dimension - unified with services
					"method": map[string]interface{}{
						"name":       "hnsw",
						"space_type": "cosinesimilarity", // Unified with services
						"engine":     "nmslib",
						"parameters": map[string]interface{}{
							"ef_construction": 512,
							"m":               16,
						},
					},
				},
				"created_at": map[string]interface{}{
					"type":   "date",
					"format": "strict_date_optional_time||epoch_millis",
				},
			},
		},
		"settings": map[string]interface{}{
			"index": map[string]interface{}{
				"knn":                      true,
				"knn.algo_param.ef_search": 512,
			},
		},
	}

	// First check if index exists
	err := makeOpenSearchRequest(sess, "HEAD", endpoint, "/rag-documents-prod", nil)
	if err == nil {
		// Index exists, no need to create
		fmt.Println("Index rag-documents-prod already exists, skipping creation")
		return nil
	}

	// Index doesn't exist, create it
	fmt.Println("Creating index rag-documents-prod")
	return makeOpenSearchRequest(sess, "PUT", endpoint, "/rag-documents-prod", indexMapping)
}

func indexDocument(sess *session.Session, endpoint string, doc OpenSearchDocument) error {
	// Use chunk_id as document ID for OpenSearch
	path := fmt.Sprintf("/rag-documents-prod/_doc/%s", doc.ChunkID)
	return makeOpenSearchRequest(sess, "PUT", endpoint, path, doc)
}

func makeOpenSearchRequest(sess *session.Session, method, endpoint, path string, body interface{}) error {
	var reqBody []byte
	var err error

	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
	}

	// Create the request
	url := fmt.Sprintf("https://%s%s", endpoint, path)
	req, err := http.NewRequest(method, url, bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Sign the request using AWS Signature Version 4
	signer := v4.NewSigner(sess.Config.Credentials)
	_, err = signer.Sign(req, bytes.NewReader(reqBody), "es", *sess.Config.Region, time.Now())
	if err != nil {
		return fmt.Errorf("failed to sign request: %w", err)
	}

	// Make the request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Check for success status codes
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// For HEAD requests, don't print body as it's typically empty
		if method == "HEAD" {
			fmt.Printf("OpenSearch %s %s failed with status %d\n", method, path, resp.StatusCode)
		} else {
			fmt.Printf("OpenSearch request failed with status %d: %s\n", resp.StatusCode, string(respBody))
		}
		return fmt.Errorf("OpenSearch request failed with status %d", resp.StatusCode)
	}

	fmt.Printf("OpenSearch %s %s: %d\n", method, path, resp.StatusCode)
	return nil
}

func saveToDynamoDB(sess *session.Session, document *Document) error {
	// Get table name from environment variable
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")
	if tableName == "" {
		tableName = "aws-serverless-rag-prod-documents-prod" // fallback
	}

	// Create DynamoDB client
	dynamoClient := dynamodb.New(sess)

	// Convert struct to DynamoDB attribute values
	item, err := dynamodbattribute.MarshalMap(document)
	if err != nil {
		return fmt.Errorf("failed to marshal document: %w", err)
	}

	// Add additional fields for DynamoDB
	item["created_at"] = &dynamodb.AttributeValue{S: aws.String(document.ProcessedAt.Format(time.RFC3339))}
	item["updated_at"] = &dynamodb.AttributeValue{S: aws.String(document.ProcessedAt.Format(time.RFC3339))}

	// Put item to DynamoDB
	_, err = dynamoClient.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      item,
	})

	if err != nil {
		return fmt.Errorf("failed to put item to DynamoDB: %w", err)
	}

	fmt.Printf("Document metadata saved to DynamoDB: %s\n", document.ID)
	return nil
}

func main() {
	lambda.Start(handler)
}
