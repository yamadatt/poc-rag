package utils

import (
	"encoding/json"
	"net/http"

	"github.com/aws/aws-lambda-go/events"

	"aws-serverless-rag/internal/models"
)

// APIResponse represents a standard API response
type APIResponse struct {
	StatusCode int               `json:"-"`
	Headers    map[string]string `json:"-"`
	Body       interface{}       `json:"body"`
}

// NewAPIResponse creates a new API response
func NewAPIResponse(statusCode int, body interface{}) *APIResponse {
	return &APIResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: body,
	}
}

// ToLambdaResponse converts APIResponse to Lambda proxy response
func (r *APIResponse) ToLambdaResponse() (events.APIGatewayProxyResponse, error) {
	bodyBytes, err := json.Marshal(r.Body)
	if err != nil {
		return events.APIGatewayProxyResponse{}, err
	}

	return events.APIGatewayProxyResponse{
		StatusCode: r.StatusCode,
		Headers:    r.Headers,
		Body:       string(bodyBytes),
	}, nil
}

// Success responses
func SuccessResponse(data interface{}) *APIResponse {
	return NewAPIResponse(http.StatusOK, data)
}

func CreatedResponse(data interface{}) *APIResponse {
	return NewAPIResponse(http.StatusCreated, data)
}

// Error responses
func BadRequestResponse(message string) *APIResponse {
	return NewAPIResponse(http.StatusBadRequest,
		models.NewErrorResponse(models.ErrCodeInvalidRequest, message, ""))
}

func NotFoundResponse(message string) *APIResponse {
	return NewAPIResponse(http.StatusNotFound,
		models.NewErrorResponse(models.ErrCodeDocumentNotFound, message, ""))
}

func InternalErrorResponse(err error) *APIResponse {
	return NewAPIResponse(http.StatusInternalServerError,
		models.NewErrorResponseFromError(err))
}

func ServiceUnavailableResponse(message string) *APIResponse {
	return NewAPIResponse(http.StatusServiceUnavailable,
		models.NewErrorResponse(models.ErrCodeServiceUnavailable, message, ""))
}

// ErrorResponseFromError creates an error response based on the error type
func ErrorResponseFromError(err error) *APIResponse {
	switch err {
	case models.ErrInvalidFileType:
		return NewAPIResponse(http.StatusBadRequest, models.NewErrorResponseFromError(err))
	case models.ErrFileNotFound, models.ErrDocumentNotFound:
		return NewAPIResponse(http.StatusNotFound, models.NewErrorResponseFromError(err))
	case models.ErrInvalidQuestion, models.ErrInvalidRequest:
		return NewAPIResponse(http.StatusBadRequest, models.NewErrorResponseFromError(err))
	case models.ErrServiceUnavailable:
		return NewAPIResponse(http.StatusServiceUnavailable, models.NewErrorResponseFromError(err))
	default:
		return NewAPIResponse(http.StatusInternalServerError, models.NewErrorResponseFromError(err))
	}
}
