package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type DeleteRequest struct {
	DocumentID string `json:"document_id"`
}

type DeleteResponse struct {
	Message    string `json:"message"`
	DocumentID string `json:"document_id"`
	Success    bool   `json:"success"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Document delete handler called")

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

	if request.HTTPMethod != "DELETE" {
		return events.APIGatewayProxyResponse{
			StatusCode: 405,
			Headers:    headers,
			Body:       `{"error": "Method not allowed"}`,
		}, nil
	}

	// Parse document ID from path parameters
	documentID, exists := request.PathParameters["document_id"]
	if !exists || documentID == "" {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "document_id is required"}`,
		}, nil
	}

	// URL decode the document ID to handle Japanese characters and special chars
	decodedDocumentID, err := url.QueryUnescape(documentID)
	if err != nil {
		log.Printf("Failed to URL decode document ID: %v", err)
		// Use original if decode fails
		decodedDocumentID = documentID
	}

	fmt.Printf("Deleting document ID: %s (decoded: %s)\n", documentID, decodedDocumentID)

	// Initialize AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(os.Getenv("AWS_REGION")),
	})
	if err != nil {
		log.Printf("Failed to create AWS session: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to initialize AWS session"}`,
		}, nil
	}

	s3Client := s3.New(sess)

	// Get bucket name from environment
	bucketName := os.Getenv("S3_BUCKET_NAME")

	if bucketName == "" {
		bucketName = "aws-serverless-rag-prod-documents-prod" // fallback
	}

	// Find document in S3 by searching for files with matching document-id metadata or filename
	listInput := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String("documents/prod/"),
	}

	listResult, err := s3Client.ListObjectsV2(listInput)
	if err != nil {
		log.Printf("Failed to list S3 objects: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to list documents"}`,
		}, nil
	}

	var s3Key string
	var found bool

	// Search for matching document
	for _, item := range listResult.Contents {
		// Skip directory markers
		if strings.HasSuffix(*item.Key, "/") {
			continue
		}

		// Extract filename from key
		keyParts := strings.Split(*item.Key, "/")
		filename := keyParts[len(keyParts)-1]

		// Get object metadata
		headInput := &s3.HeadObjectInput{
			Bucket: aws.String(bucketName),
			Key:    item.Key,
		}

		headResult, err := s3Client.HeadObject(headInput)
		if err != nil {
			continue // Skip files we can't access
		}

		// Check if this is the document we're looking for
		docID := filename // fallback to filename
		if headResult.Metadata["document-id"] != nil {
			docID = *headResult.Metadata["document-id"]
		}

		// Check exact match first, then partial match
		if docID == documentID || docID == decodedDocumentID ||
			strings.Contains(docID, documentID) || strings.Contains(docID, decodedDocumentID) ||
			strings.Contains(filename, documentID) || strings.Contains(filename, decodedDocumentID) {
			s3Key = *item.Key
			found = true
			break
		}
	}

	if !found {
		log.Printf("Document not found in S3: %s", documentID)
		return events.APIGatewayProxyResponse{
			StatusCode: 404,
			Headers:    headers,
			Body:       `{"error": "Document not found"}`,
		}, nil
	}

	fmt.Printf("Deleting S3 object: bucket=%s, key=%s\n", bucketName, s3Key)

	// Delete from S3
	deleteObjectInput := &s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(s3Key),
	}

	_, err = s3Client.DeleteObject(deleteObjectInput)
	if err != nil {
		log.Printf("Failed to delete S3 object: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to delete file from S3"}`,
		}, nil
	}

	fmt.Printf("Successfully deleted S3 object: %s\n", s3Key)

	// TODO: Also delete from OpenSearch if needed
	// For now, we'll leave vectors in OpenSearch as they won't interfere

	response := DeleteResponse{
		Message:    "Document deleted successfully",
		DocumentID: documentID,
		Success:    true,
	}

	responseBody, err := json.Marshal(response)
	if err != nil {
		log.Printf("Failed to marshal response: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       `{"error": "Failed to create response"}`,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    headers,
		Body:       string(responseBody),
	}, nil
}

func main() {
	lambda.Start(handler)
}
