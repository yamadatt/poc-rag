package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/aws/aws-sdk-go/service/bedrockruntime"
)

type QueryRequest struct {
	Question   string `json:"question"`
	MaxResults int    `json:"max_results,omitempty"`
}

type QueryResponse struct {
	Answer    string   `json:"answer"`
	Sources   []Source `json:"sources"`
	QueryTime string   `json:"query_time"`
}

type Source struct {
	DocumentID string  `json:"document_id"`
	ChunkID    string  `json:"chunk_id"`
	Content    string  `json:"content"`
	Score      float64 `json:"score"`
}

type BedrockEmbeddingRequest struct {
	InputText string `json:"inputText"`
}

type BedrockEmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
}

type BedrockLLMRequest struct {
	InputText            string                    `json:"inputText"`
	TextGenerationConfig TitanTextGenerationConfig `json:"textGenerationConfig"`
}

type TitanTextGenerationConfig struct {
	MaxTokenCount int      `json:"maxTokenCount"`
	Temperature   float64  `json:"temperature"`
	TopP          float64  `json:"topP"`
	StopSequences []string `json:"stopSequences"`
}

type BedrockLLMResponse struct {
	Results []TitanResult `json:"results"`
}

type TitanResult struct {
	OutputText string `json:"outputText"`
}

type OpenSearchKNNQuery struct {
	Size  int                    `json:"size"`
	Query map[string]interface{} `json:"query"`
}

type OpenSearchHit struct {
	Index  string                 `json:"_index"`
	ID     string                 `json:"_id"`
	Score  float64                `json:"_score"`
	Source map[string]interface{} `json:"_source"`
}

type OpenSearchResponse struct {
	Hits struct {
		Total struct {
			Value int `json:"value"`
		} `json:"total"`
		Hits []OpenSearchHit `json:"hits"`
	} `json:"hits"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Println("Query handler called")

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

	// Parse request body
	var queryRequest QueryRequest
	if err := json.Unmarshal([]byte(request.Body), &queryRequest); err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Invalid request body: %s"}`, err.Error()),
		}, nil
	}

	if queryRequest.Question == "" {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    headers,
			Body:       `{"error": "question is required"}`,
		}, nil
	}

	// Set default max results
	if queryRequest.MaxResults == 0 {
		queryRequest.MaxResults = 5
	}

	fmt.Printf("Processing query: %s (max_results: %d)\n", queryRequest.Question, queryRequest.MaxResults)

	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String("ap-northeast-1"),
	})
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Failed to create AWS session: %s"}`, err.Error()),
		}, nil
	}

	// Generate embedding for the question
	bedrockClient := bedrockruntime.New(sess)
	questionEmbedding, err := generateQuestionEmbedding(bedrockClient, queryRequest.Question)
	if err != nil {
		fmt.Printf("Failed to generate embedding: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Failed to generate question embedding: %s"}`, err.Error()),
		}, nil
	}

	fmt.Printf("Generated question embedding (dimension: %d)\n", len(questionEmbedding))

	// Search for similar documents in OpenSearch
	sources, err := searchSimilarDocuments(sess, questionEmbedding, queryRequest.MaxResults)
	if err != nil {
		fmt.Printf("Vector search failed: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Vector search failed: %s"}`, err.Error()),
		}, nil
	}

	fmt.Printf("Found %d relevant sources\n", len(sources))

	// Generate answer using LLM
	answer, err := generateAnswerWithLLM(bedrockClient, queryRequest.Question, sources)
	if err != nil {
		fmt.Printf("Failed to generate answer: %v\n", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    headers,
			Body:       fmt.Sprintf(`{"error": "Failed to generate answer: %s"}`, err.Error()),
		}, nil
	}

	// Create response
	response := QueryResponse{
		Answer:    answer,
		Sources:   sources,
		QueryTime: time.Now().Format(time.RFC3339),
	}

	responseBody, err := json.Marshal(response)
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

func generateQuestionEmbedding(bedrockClient *bedrockruntime.BedrockRuntime, question string) ([]float64, error) {
	// Use Titan Text Embeddings V2
	modelID := "amazon.titan-embed-text-v2:0"

	requestBody := BedrockEmbeddingRequest{
		InputText: question,
	}

	requestJSON, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal embedding request: %w", err)
	}

	input := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(modelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        requestJSON,
	}

	result, err := bedrockClient.InvokeModel(input)
	if err != nil {
		// Try V1 if V2 fails
		if modelID == "amazon.titan-embed-text-v2:0" {
			fmt.Println("V2 embeddings not available, trying V1...")
			modelID = "amazon.titan-embed-text-v1"
			input.ModelId = aws.String(modelID)
			result, err = bedrockClient.InvokeModel(input)
		}

		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding: %w", err)
		}
	}

	var response BedrockEmbeddingResponse
	if err := json.Unmarshal(result.Body, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal embedding response: %w", err)
	}

	return response.Embedding, nil
}

func searchSimilarDocuments(sess *session.Session, embedding []float64, maxResults int) ([]Source, error) {
	opensearchEndpoint := os.Getenv("OPENSEARCH_ENDPOINT")
	if opensearchEndpoint == "" {
		return nil, fmt.Errorf("OPENSEARCH_ENDPOINT environment variable not set")
	}

	// Create KNN query
	query := OpenSearchKNNQuery{
		Size: maxResults,
		Query: map[string]interface{}{
			"knn": map[string]interface{}{
				"vector": map[string]interface{}{
					"vector": embedding,
					"k":      maxResults,
				},
			},
		},
	}

	queryJSON, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("https://%s/rag-documents-prod/_search", opensearchEndpoint)
	req, err := http.NewRequest("POST", url, bytes.NewReader(queryJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Sign the request
	signer := v4.NewSigner(sess.Config.Credentials)
	_, err = signer.Sign(req, bytes.NewReader(queryJSON), "es", *sess.Config.Region, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}

	// Execute request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("search failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var searchResult OpenSearchResponse
	if err := json.Unmarshal(respBody, &searchResult); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %w", err)
	}

	// Convert to sources
	sources := make([]Source, 0, len(searchResult.Hits.Hits))
	for _, hit := range searchResult.Hits.Hits {
		source := Source{
			ChunkID: hit.ID,
			Score:   hit.Score,
		}

		if docID, ok := hit.Source["document_id"].(string); ok {
			source.DocumentID = docID
		}
		if content, ok := hit.Source["content"].(string); ok {
			source.Content = content
		}

		sources = append(sources, source)
	}

	return sources, nil
}

func generateAnswerWithLLM(bedrockClient *bedrockruntime.BedrockRuntime, question string, sources []Source) (string, error) {
	// Build context from sources
	context := ""
	for i, source := range sources {
		context += fmt.Sprintf("Context %d:\n%s\n\n", i+1, source.Content)
	}

	// Create prompt
	prompt := fmt.Sprintf(`Based on the following context, please answer the question. If the context doesn't contain enough information to answer the question, say so.

Context:
%s

Question: %s

Answer: 

`, context, question)

	// Use Titan Text G1 Express for answer generation
	modelID := "amazon.titan-text-express-v1"

	requestBody := BedrockLLMRequest{
		InputText: prompt,
		TextGenerationConfig: TitanTextGenerationConfig{
			MaxTokenCount: 1000,
			Temperature:   0.1,
			TopP:          0.9,
			StopSequences: []string{"User:"},
		},
	}

	requestJSON, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal LLM request: %w", err)
	}

	input := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(modelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        requestJSON,
	}

	result, err := bedrockClient.InvokeModel(input)
	if err != nil {
		return "", fmt.Errorf("failed to generate answer: %w", err)
	}

	var response BedrockLLMResponse
	if err := json.Unmarshal(result.Body, &response); err != nil {
		return "", fmt.Errorf("failed to unmarshal LLM response: %w", err)
	}

	if len(response.Results) == 0 {
		return "No answer generated from the context provided.", nil
	}

	return response.Results[0].OutputText, nil
}

func main() {
	lambda.Start(handler)
}
