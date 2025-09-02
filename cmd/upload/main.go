package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type UploadResponse struct {
	Message    string `json:"message"`
	DocumentID string `json:"document_id"`
	Status     string `json:"status"`
	FileName   string `json:"file_name"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Upload handler called")

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

	// Parse multipart form data
	fileName, fileContent, err := parseMultipartForm(request)
	if err != nil {
		fmt.Printf("Parse error: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Failed to parse file: %s"}`, err.Error()),
		}, nil
	}

	// Upload to S3
	documentID, err := uploadToS3(fileName, fileContent)
	if err != nil {
		fmt.Printf("S3 upload error: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Failed to upload file: %s"}`, err.Error()),
		}, nil
	}

	// Return success response
	response := UploadResponse{
		Message:    "File uploaded successfully",
		DocumentID: documentID,
		Status:     "completed",
		FileName:   fileName,
	}

	responseBody, err := json.Marshal(response)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to marshal response"}`,
		}, nil
	}

	fmt.Printf("Upload successful: %s -> %s\n", fileName, documentID)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func parseMultipartForm(request events.APIGatewayProxyRequest) (string, []byte, error) {
	// Get content type header
	contentType := request.Headers["content-type"]
	if contentType == "" {
		contentType = request.Headers["Content-Type"]
	}

	if !strings.HasPrefix(contentType, "multipart/form-data") {
		return "", nil, fmt.Errorf("invalid content type: %s", contentType)
	}

	// Decode base64 body if needed
	var bodyReader io.Reader
	if request.IsBase64Encoded {
		decodedBody, err := base64.StdEncoding.DecodeString(request.Body)
		if err != nil {
			return "", nil, fmt.Errorf("failed to decode base64 body: %w", err)
		}
		bodyReader = strings.NewReader(string(decodedBody))
	} else {
		bodyReader = strings.NewReader(request.Body)
	}

	// Extract boundary from content type
	boundary := extractBoundary(contentType)
	if boundary == "" {
		return "", nil, fmt.Errorf("no boundary found in content type")
	}

	// Parse multipart form
	reader := multipart.NewReader(bodyReader, boundary)

	var fileName string
	var fileContent []byte

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", nil, fmt.Errorf("failed to read multipart form: %w", err)
		}

		if part.FormName() == "file" {
			fileName = part.FileName()
			if fileName == "" {
				part.Close()
				return "", nil, fmt.Errorf("file name is empty")
			}

			// Read file content
			fileContent, err = io.ReadAll(part)
			if err != nil {
				part.Close()
				return "", nil, fmt.Errorf("failed to read file content: %w", err)
			}
		}
		part.Close()
	}

	if fileName == "" || len(fileContent) == 0 {
		return "", nil, fmt.Errorf("no file found in multipart form")
	}

	return fileName, fileContent, nil
}

func extractBoundary(contentType string) string {
	parts := strings.Split(contentType, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "boundary=") {
			return strings.TrimPrefix(part, "boundary=")
		}
	}
	return ""
}

func uploadToS3(fileName string, fileContent []byte) (string, error) {
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String("ap-northeast-1"),
	})
	if err != nil {
		return "", fmt.Errorf("failed to create AWS session: %w", err)
	}

	// Create S3 service client
	svc := s3.New(sess)

	// Get bucket name from environment variable
	bucketName := os.Getenv("S3_BUCKET_NAME")
	if bucketName == "" {
		bucketName = "aws-serverless-rag-prod-documents-prod" // fallback
	}

	// Generate unique document ID using nanosecond timestamp (ASCII-safe)
	now := time.Now()
	documentID := fmt.Sprintf("doc-%d", now.UnixNano())

	// Create S3 key
	s3Key := fmt.Sprintf("documents/prod/%s", fileName)

	// Upload to S3
	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(s3Key),
		Body:        strings.NewReader(string(fileContent)),
		ContentType: aws.String(detectContentType(fileName)),
		Metadata: map[string]*string{
			"document-id":   aws.String(documentID),
			"original-name": aws.String(fileName),
			"uploaded-at":   aws.String(time.Now().Format(time.RFC3339)),
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to upload file to S3: %w", err)
	}

	return documentID, nil
}

func detectContentType(fileName string) string {
	ext := strings.ToLower(fileName[strings.LastIndex(fileName, ".")+1:])
	switch ext {
	case "pdf":
		return "application/pdf"
	case "md":
		return "text/markdown"
	case "txt":
		return "text/plain"
	case "json":
		return "application/json"
	case "html":
		return "text/html"
	case "css":
		return "text/css"
	case "js":
		return "application/javascript"
	default:
		return "application/octet-stream"
	}
}

func main() {
	lambda.Start(handler)
}
