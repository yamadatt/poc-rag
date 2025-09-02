package main

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"aws-serverless-rag/internal/models"
	"aws-serverless-rag/internal/utils"
)

type Handler struct {
	logger *utils.Logger
	aws    *utils.AWSConfig
}

func NewHandler() (*Handler, error) {
	logger := utils.NewLogger()
	awsConfig, err := utils.NewAWSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize AWS config: %w", err)
	}

	return &Handler{
		logger: logger,
		aws:    awsConfig,
	}, nil
}

func (h *Handler) HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Add request ID to logger
	logger := h.logger.WithRequestID(request.RequestContext.RequestID)
	logger.Info("Processing status request")

	// Handle OPTIONS request for CORS
	if request.HTTPMethod == "OPTIONS" {
		return utils.SuccessResponse("OK").ToLambdaResponse()
	}

	if request.HTTPMethod != "GET" {
		logger.Warn("Invalid HTTP method", map[string]interface{}{
			"method": request.HTTPMethod,
		})
		return utils.BadRequestResponse("Method not allowed").ToLambdaResponse()
	}

	// Extract document ID from path parameters
	documentID := request.PathParameters["document_id"]
	if documentID == "" {
		logger.Warn("Missing document ID in path parameters")
		return utils.BadRequestResponse("Document ID is required").ToLambdaResponse()
	}

	logger.Info("Getting status for document", map[string]interface{}{
		"document_id": documentID,
	})

	// TODO: In a real implementation, retrieve document status from DynamoDB
	// For now, we'll create a mock document status
	document := &models.Document{
		ID:          documentID,
		FileName:    "sample.pdf",
		FileType:    "application/pdf",
		S3Key:       "documents/sample.pdf",
		Status:      models.StatusCompleted,
		UploadedAt:  time.Now().Add(-time.Hour),
		ProcessedAt: &[]time.Time{time.Now().Add(-time.Minute * 55)}[0],
		ErrorMsg:    "",
	}

	// Create status response
	uploadedAt := document.UploadedAt.Format(time.RFC3339)
	var processedAt *string
	if document.ProcessedAt != nil {
		processedAtStr := document.ProcessedAt.Format(time.RFC3339)
		processedAt = &processedAtStr
	}

	statusResponse := &models.StatusResponse{
		DocumentID:           document.ID,
		Filename:             document.FileName,
		Status:               document.Status,
		UploadedAt:           uploadedAt,
		ProcessedAt:          processedAt,
		TotalChunks:          5, // Mock value
		ChunksWithEmbeddings: 5, // Mock value
		LastError:            document.ErrorMsg,
	}

	logger.Info("Document status retrieved successfully", map[string]interface{}{
		"document_id": documentID,
		"status":      document.Status,
		"chunks":      5, // Mock value
	})

	return utils.SuccessResponse(statusResponse).ToLambdaResponse()
}

func main() {
	handler, err := NewHandler()
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize handler: %v", err))
	}

	lambda.Start(handler.HandleRequest)
}
