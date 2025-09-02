package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/bedrockruntime"

	"aws-serverless-rag/internal/models"
	"aws-serverless-rag/internal/utils"
)

// BedrockClient handles interactions with Amazon Bedrock
type BedrockClient struct {
	client *bedrockruntime.BedrockRuntime
	logger *utils.Logger
}

// TitanEmbeddingRequest represents the request structure for Titan embedding model
type TitanEmbeddingRequest struct {
	InputText string `json:"inputText"`
}

// TitanEmbeddingResponse represents the response structure from Titan embedding model
type TitanEmbeddingResponse struct {
	Embedding []float32 `json:"embedding"`
}

// ClaudeRequest represents the request structure for Claude models
type ClaudeRequest struct {
	Messages  []ClaudeMessage `json:"messages"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system,omitempty"`
}

// ClaudeMessage represents a message in Claude conversation
type ClaudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ClaudeResponse represents the response structure from Claude models
type ClaudeResponse struct {
	Content []ClaudeContent `json:"content"`
	Usage   ClaudeUsage     `json:"usage"`
}

// ClaudeContent represents content in Claude response
type ClaudeContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// ClaudeUsage represents token usage in Claude response
type ClaudeUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Model constants
const (
	TitanEmbeddingModelID = "amazon.titan-embed-text-v1"
	ClaudeModelID         = "anthropic.claude-3-sonnet-20240229-v1:0"
)

// NewBedrockClient creates a new Bedrock client
func NewBedrockClient(awsConfig *utils.AWSConfig, logger *utils.Logger) *BedrockClient {
	return &BedrockClient{
		client: awsConfig.BedrockClient,
		logger: logger,
	}
}

// GenerateEmbedding generates embeddings for the given text using Titan
func (bc *BedrockClient) GenerateEmbedding(text string) ([]float32, error) {
	if strings.TrimSpace(text) == "" {
		return nil, models.ErrInvalidRequest
	}

	// Prepare the request
	request := TitanEmbeddingRequest{
		InputText: text,
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to marshal embedding request", err)
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call Bedrock
	input := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(TitanEmbeddingModelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        requestBody,
	}

	bc.logger.Debug("Calling Bedrock for embedding generation", map[string]interface{}{
		"model_id":    TitanEmbeddingModelID,
		"text_length": len(text),
	})

	result, err := bc.client.InvokeModel(input)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to invoke Bedrock embedding model", err)
		return nil, fmt.Errorf("failed to invoke embedding model: %w", err)
	}

	// Parse the response
	var response TitanEmbeddingResponse
	err = json.Unmarshal(result.Body, &response)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to unmarshal embedding response", err)
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(response.Embedding) == 0 {
		return nil, models.ErrEmbeddingFailed
	}

	bc.logger.Debug("Successfully generated embedding", map[string]interface{}{
		"embedding_dimension": len(response.Embedding),
	})

	return response.Embedding, nil
}

// GenerateAnswer generates an answer using Claude based on the context and question
func (bc *BedrockClient) GenerateAnswer(question string, context []models.Source) (string, error) {
	if strings.TrimSpace(question) == "" {
		return "", models.ErrInvalidQuestion
	}

	// Build context from sources
	contextText := bc.buildContextFromSources(context)

	// Prepare the system prompt
	systemPrompt := `You are a helpful assistant that answers questions based on the provided context. 
Follow these guidelines:
1. Answer based ONLY on the information provided in the context
2. If the context doesn't contain enough information to answer the question, say so
3. Be concise but comprehensive
4. Cite relevant parts of the context when appropriate
5. If the question cannot be answered from the context, explain what information is missing`

	// Prepare the user message
	userMessage := fmt.Sprintf(`Context:
%s

Question: %s

Please provide a helpful answer based on the context above.`, contextText, question)

	// Prepare the request
	request := ClaudeRequest{
		Messages: []ClaudeMessage{
			{
				Role:    "user",
				Content: userMessage,
			},
		},
		MaxTokens: 1000,
		System:    systemPrompt,
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to marshal Claude request", err)
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call Bedrock
	input := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(ClaudeModelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        requestBody,
	}

	bc.logger.Debug("Calling Bedrock for answer generation", map[string]interface{}{
		"model_id":        ClaudeModelID,
		"question_length": len(question),
		"context_sources": len(context),
	})

	result, err := bc.client.InvokeModel(input)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to invoke Bedrock Claude model", err)
		return "", fmt.Errorf("failed to invoke Claude model: %w", err)
	}

	// Parse the response
	var response ClaudeResponse
	err = json.Unmarshal(result.Body, &response)
	if err != nil {
		bc.logger.ErrorWithErr("Failed to unmarshal Claude response", err)
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(response.Content) == 0 {
		return "", models.ErrLLMGenerationFailed
	}

	answer := response.Content[0].Text
	if strings.TrimSpace(answer) == "" {
		return "", models.ErrLLMGenerationFailed
	}

	bc.logger.Debug("Successfully generated answer", map[string]interface{}{
		"answer_length": len(answer),
		"input_tokens":  response.Usage.InputTokens,
		"output_tokens": response.Usage.OutputTokens,
	})

	return answer, nil
}

// buildContextFromSources builds a context string from the provided sources
func (bc *BedrockClient) buildContextFromSources(sources []models.Source) string {
	if len(sources) == 0 {
		return "No relevant context found."
	}

	var contextBuilder strings.Builder

	for i, source := range sources {
		contextBuilder.WriteString(fmt.Sprintf("Source %d (Score: %.3f):\n", i+1, source.Score))
		contextBuilder.WriteString(source.Content)
		contextBuilder.WriteString("\n\n")
	}

	return contextBuilder.String()
}

// GenerateEmbeddings generates embeddings for multiple texts in batch
func (bc *BedrockClient) GenerateEmbeddings(texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, models.ErrInvalidRequest
	}

	embeddings := make([][]float32, len(texts))

	for i, text := range texts {
		embedding, err := bc.GenerateEmbedding(text)
		if err != nil {
			bc.logger.ErrorWithErr("Failed to generate embedding for text", err, map[string]interface{}{
				"index":       i,
				"text_length": len(text),
			})
			return nil, fmt.Errorf("failed to generate embedding for text %d: %w", i, err)
		}
		embeddings[i] = embedding
	}

	bc.logger.Debug("Successfully generated batch embeddings", map[string]interface{}{
		"batch_size": len(texts),
	})

	return embeddings, nil
}
