package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type SystemStats struct {
	TotalDocuments int     `json:"total_documents"`
	TotalQueries   int     `json:"total_queries"`
	StorageUsed    float64 `json:"storage_used"`
	ActiveUsers    int     `json:"active_users"`
}

type RecentQuery struct {
	ID        string    `json:"id"`
	Question  string    `json:"question"`
	Timestamp time.Time `json:"timestamp"`
	UserID    string    `json:"user_id"`
}

type Document struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	Type       string    `json:"type"`
	UploadedAt time.Time `json:"uploaded_at"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Debug: log all requests to this function
	fmt.Printf("DASHBOARD: Path=%s Method=%s\n", request.Path, request.HTTPMethod)

	headers := map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Methods": "*",
		"Access-Control-Allow-Headers": "*",
	}

	// Handle different endpoints
	switch request.Path {
	case "/stats":
		// Get actual counts from S3
		documents, _ := getDocumentsFromS3()
		documentCount := len(documents)

		// Calculate total storage used
		var totalSize float64
		for _, doc := range documents {
			totalSize += float64(doc.Size)
		}
		storageUsedGB := totalSize / (1024 * 1024 * 1024) // Convert bytes to GB

		// For now, use reasonable default values for queries and users
		// These could be fetched from CloudWatch metrics or DynamoDB in the future
		stats := SystemStats{
			TotalDocuments: documentCount,
			TotalQueries:   157, // TODO: Fetch from CloudWatch metrics
			StorageUsed:    storageUsedGB,
			ActiveUsers:    3, // TODO: Fetch from session tracking
		}
		body, _ := json.Marshal(stats)
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
			Body:       string(body),
		}, nil

	case "/queries/recent":
		// TODO: In production, this would fetch from CloudWatch logs or DynamoDB
		// For now, return empty array since no real query tracking is implemented
		queries := []RecentQuery{}
		body, _ := json.Marshal(queries)
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers:    headers,
			Body:       string(body),
		}, nil

	case "/documents":
		if request.HTTPMethod == "GET" {
			documents, err := getDocumentsFromS3()
			if err != nil {
				fmt.Printf("Error getting documents from S3: %v\n", err)
				return events.APIGatewayProxyResponse{
					StatusCode: 500,
					Headers:    headers,
					Body:       fmt.Sprintf(`{"error": "Failed to get documents: %s"}`, err.Error()),
				}, nil
			}
			body, _ := json.Marshal(documents)
			return events.APIGatewayProxyResponse{
				StatusCode: 200,
				Headers:    headers,
				Body:       string(body),
			}, nil
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 404,
		Headers:    headers,
		Body:       `{"error": "Not Found"}`,
	}, nil
}

func getDocumentsFromS3() ([]Document, error) {
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String("ap-northeast-1"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS session: %w", err)
	}

	// Create S3 service client
	svc := s3.New(sess)

	// Get bucket name from environment variable
	bucketName := os.Getenv("DOCUMENT_BUCKET")
	if bucketName == "" {
		bucketName = "aws-serverless-rag-prod-documents-prod" // fallback
	}

	// List objects in the documents folder
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String("documents/prod/"),
	}

	result, err := svc.ListObjectsV2(input)
	if err != nil {
		return nil, fmt.Errorf("failed to list S3 objects: %w", err)
	}

	var documents []Document
	for _, item := range result.Contents {
		// Skip directory markers
		if strings.HasSuffix(*item.Key, "/") {
			continue
		}

		// Extract filename from key
		keyParts := strings.Split(*item.Key, "/")
		filename := keyParts[len(keyParts)-1]

		// Get object metadata to retrieve document ID
		headInput := &s3.HeadObjectInput{
			Bucket: aws.String(bucketName),
			Key:    item.Key,
		}

		headResult, err := svc.HeadObject(headInput)
		if err != nil {
			fmt.Printf("Warning: Failed to get metadata for %s: %v\n", *item.Key, err)
			continue
		}

		// Extract document ID from metadata
		docID := filename // fallback to filename
		if headResult.Metadata["document-id"] != nil {
			docID = *headResult.Metadata["document-id"]
		}

		// Determine content type
		contentType := "application/octet-stream" // default
		if headResult.ContentType != nil {
			contentType = *headResult.ContentType
		}

		documents = append(documents, Document{
			ID:         docID,
			Name:       filename,
			Size:       *item.Size,
			Type:       contentType,
			UploadedAt: *item.LastModified,
		})
	}

	return documents, nil
}

func main() {
	lambda.Start(handler)
}
