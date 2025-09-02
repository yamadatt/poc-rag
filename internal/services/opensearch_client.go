package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchapi"

	"aws-serverless-rag/internal/models"
	"aws-serverless-rag/internal/utils"
)

// OpenSearchClient handles interactions with OpenSearch
type OpenSearchClient struct {
	client    *opensearch.Client
	logger    *utils.Logger
	indexName string
}

// IndexMapping defines the structure of our vector index
type IndexMapping struct {
	Mappings IndexMappingProperties `json:"mappings"`
}

// IndexMappingProperties defines the properties mapping
type IndexMappingProperties struct {
	Properties map[string]interface{} `json:"properties"`
}

// SearchRequest represents a vector search request
type SearchRequest struct {
	Size  int                    `json:"size"`
	Query map[string]interface{} `json:"query"`
}

// SearchResponse represents the search response from OpenSearch
type SearchResponse struct {
	Hits SearchHits `json:"hits"`
}

// SearchHits represents the hits in search response
type SearchHits struct {
	Total SearchHitsTotal `json:"total"`
	Hits  []SearchHit     `json:"hits"`
}

// SearchHitsTotal represents total hits information
type SearchHitsTotal struct {
	Value int `json:"value"`
}

// SearchHit represents a single search result
type SearchHit struct {
	Index  string                 `json:"_index"`
	ID     string                 `json:"_id"`
	Score  float64                `json:"_score"`
	Source map[string]interface{} `json:"_source"`
}

// BulkOperation represents a bulk operation item
type BulkOperation struct {
	Index BulkOperationAction `json:"index"`
}

// BulkOperationAction represents a bulk operation action
type BulkOperationAction struct {
	Index string `json:"_index"`
	ID    string `json:"_id"`
}

// NewOpenSearchClient creates a new OpenSearch client
func NewOpenSearchClient(logger *utils.Logger) (*OpenSearchClient, error) {
	endpoint := utils.GetOpenSearchEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("OpenSearch endpoint not configured")
	}

	config := opensearch.Config{
		Addresses: []string{endpoint},
		// Note: In production, you would configure authentication properly
		// For AWS OpenSearch Service, you would use IAM authentication
	}

	client, err := opensearch.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenSearch client: %w", err)
	}

	indexName := fmt.Sprintf("rag-documents-%s", utils.GetEnvironment())

	return &OpenSearchClient{
		client:    client,
		logger:    logger,
		indexName: indexName,
	}, nil
}

// CreateIndex creates the vector index with proper mapping
func (osc *OpenSearchClient) CreateIndex(ctx context.Context) error {
	// Check if index already exists
	req := opensearchapi.IndicesExistsRequest{
		Index: []string{osc.indexName},
	}

	res, err := req.Do(ctx, osc.client)
	if err != nil {
		return fmt.Errorf("failed to check index existence: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		osc.logger.Info("Index already exists", map[string]interface{}{
			"index_name": osc.indexName,
		})
		return nil
	}

	// Create index with mapping
	mapping := IndexMapping{
		Mappings: IndexMappingProperties{
			Properties: map[string]interface{}{
				"document_id": map[string]interface{}{
					"type": "keyword",
				},
				"chunk_id": map[string]interface{}{
					"type": "keyword",
				},
				"content": map[string]interface{}{
					"type": "text",
				},
				"embedding": map[string]interface{}{
					"type":      "knn_vector",
					"dimension": 1536, // Titan embedding dimension
					"method": map[string]interface{}{
						"name":       "hnsw",
						"space_type": "cosinesimilarity",
						"engine":     "nmslib",
					},
				},
				"metadata": map[string]interface{}{
					"properties": map[string]interface{}{
						"file_name": map[string]interface{}{
							"type": "text",
						},
						"file_type": map[string]interface{}{
							"type": "keyword",
						},
						"chunk_index": map[string]interface{}{
							"type": "integer",
						},
						"total_chunks": map[string]interface{}{
							"type": "integer",
						},
						"word_count": map[string]interface{}{
							"type": "integer",
						},
						"char_count": map[string]interface{}{
							"type": "integer",
						},
						"created_at": map[string]interface{}{
							"type": "date",
						},
					},
				},
				"created_at": map[string]interface{}{
					"type": "date",
				},
			},
		},
	}

	mappingJSON, err := json.Marshal(mapping)
	if err != nil {
		return fmt.Errorf("failed to marshal index mapping: %w", err)
	}

	createReq := opensearchapi.IndicesCreateRequest{
		Index: osc.indexName,
		Body:  strings.NewReader(string(mappingJSON)),
	}

	createRes, err := createReq.Do(ctx, osc.client)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer createRes.Body.Close()

	if createRes.IsError() {
		return fmt.Errorf("failed to create index: %s", createRes.Status())
	}

	osc.logger.Info("Index created successfully", map[string]interface{}{
		"index_name": osc.indexName,
	})

	return nil
}

// IndexChunks indexes document chunks with their embeddings
func (osc *OpenSearchClient) IndexChunks(ctx context.Context, chunks []*models.Chunk) error {
	if len(chunks) == 0 {
		return nil
	}

	osc.logger.Info("Indexing chunks", map[string]interface{}{
		"chunk_count": len(chunks),
		"index_name":  osc.indexName,
	})

	// Prepare bulk operations
	var bulkBody strings.Builder

	for _, chunk := range chunks {
		// Create bulk operation header
		operation := BulkOperation{
			Index: BulkOperationAction{
				Index: osc.indexName,
				ID:    chunk.ID,
			},
		}

		operationJSON, err := json.Marshal(operation)
		if err != nil {
			return fmt.Errorf("failed to marshal bulk operation: %w", err)
		}

		bulkBody.WriteString(string(operationJSON))
		bulkBody.WriteString("\n")

		// Create document
		doc := map[string]interface{}{
			"document_id": chunk.DocumentID,
			"chunk_id":    chunk.ID,
			"content":     chunk.Content,
			"embedding":   chunk.Embedding,
			"metadata":    chunk.Metadata,
			"created_at":  chunk.CreatedAt.Format(time.RFC3339),
		}

		docJSON, err := json.Marshal(doc)
		if err != nil {
			return fmt.Errorf("failed to marshal chunk document: %w", err)
		}

		bulkBody.WriteString(string(docJSON))
		bulkBody.WriteString("\n")
	}

	// Execute bulk request
	req := opensearchapi.BulkRequest{
		Index: osc.indexName,
		Body:  strings.NewReader(bulkBody.String()),
	}

	res, err := req.Do(ctx, osc.client)
	if err != nil {
		return fmt.Errorf("failed to execute bulk request: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("bulk request failed: %s", res.Status())
	}

	// Parse bulk response to check for individual errors
	var bulkRes map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&bulkRes); err != nil {
		return fmt.Errorf("failed to decode bulk response: %w", err)
	}

	if errors, exists := bulkRes["errors"].(bool); exists && errors {
		osc.logger.Warn("Some bulk operations failed", map[string]interface{}{
			"bulk_response": bulkRes,
		})
	}

	osc.logger.Info("Chunks indexed successfully", map[string]interface{}{
		"chunk_count": len(chunks),
		"index_name":  osc.indexName,
	})

	return nil
}

// VectorSearch performs a vector similarity search
func (osc *OpenSearchClient) VectorSearch(ctx context.Context, queryEmbedding []float32, maxResults int) ([]models.Source, error) {
	if len(queryEmbedding) == 0 {
		return nil, models.ErrInvalidRequest
	}

	if maxResults <= 0 {
		maxResults = 5
	}

	osc.logger.Debug("Performing vector search", map[string]interface{}{
		"embedding_dimension": len(queryEmbedding),
		"max_results":         maxResults,
		"index_name":          osc.indexName,
	})

	// Prepare KNN search query
	searchRequest := SearchRequest{
		Size: maxResults,
		Query: map[string]interface{}{
			"knn": map[string]interface{}{
				"embedding": map[string]interface{}{
					"vector": queryEmbedding,
					"k":      maxResults,
				},
			},
		},
	}

	requestBody, err := json.Marshal(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search request: %w", err)
	}

	// Execute search
	req := opensearchapi.SearchRequest{
		Index: []string{osc.indexName},
		Body:  strings.NewReader(string(requestBody)),
	}

	res, err := req.Do(ctx, osc.client)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search failed: %s", res.Status())
	}

	// Parse response
	var searchRes SearchResponse
	if err := json.NewDecoder(res.Body).Decode(&searchRes); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	// Convert hits to sources
	sources := make([]models.Source, 0, len(searchRes.Hits.Hits))
	for _, hit := range searchRes.Hits.Hits {
		source := models.Source{
			DocumentID: hit.Source["document_id"].(string),
			ChunkID:    hit.Source["chunk_id"].(string),
			Content:    hit.Source["content"].(string),
			Score:      hit.Score,
		}

		if metadata, exists := hit.Source["metadata"]; exists {
			if metadataMap, ok := metadata.(map[string]interface{}); ok {
				source.Metadata = metadataMap
			}
		}

		sources = append(sources, source)
	}

	osc.logger.Debug("Vector search completed", map[string]interface{}{
		"results_found": len(sources),
		"total_hits":    searchRes.Hits.Total.Value,
	})

	return sources, nil
}

// GetDocumentStatus retrieves the processing status of a document
func (osc *OpenSearchClient) GetDocumentStatus(ctx context.Context, documentID string) (*models.Document, error) {
	// Search for chunks with this document ID
	searchRequest := map[string]interface{}{
		"size": 1,
		"query": map[string]interface{}{
			"term": map[string]interface{}{
				"document_id": documentID,
			},
		},
	}

	requestBody, err := json.Marshal(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search request: %w", err)
	}

	req := opensearchapi.SearchRequest{
		Index: []string{osc.indexName},
		Body:  strings.NewReader(string(requestBody)),
	}

	res, err := req.Do(ctx, osc.client)
	if err != nil {
		return nil, fmt.Errorf("failed to execute search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("search failed: %s", res.Status())
	}

	var searchRes SearchResponse
	if err := json.NewDecoder(res.Body).Decode(&searchRes); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	if len(searchRes.Hits.Hits) == 0 {
		return nil, models.ErrDocumentNotFound
	}

	// Create document status from the first hit
	hit := searchRes.Hits.Hits[0]
	metadata := hit.Source["metadata"].(map[string]interface{})

	document := &models.Document{
		ID:       documentID,
		FileName: metadata["file_name"].(string),
		FileType: metadata["file_type"].(string),
		Status:   models.StatusCompleted, // If it's in the index, it's completed
	}

	if createdAtStr, ok := hit.Source["created_at"].(string); ok {
		if createdAt, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
			document.ProcessedAt = &createdAt
		}
	}

	return document, nil
}
