package performance

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"aws-serverless-rag/internal/models"
)

// ProcessTextIntoChunks efficiently processes text into chunks with performance optimization
func ProcessTextIntoChunks(text string) ([]models.Chunk, error) {
	if len(text) == 0 {
		return nil, fmt.Errorf("empty text provided")
	}

	const maxChunkSize = 1000
	const overlap = 100

	var chunks []models.Chunk
	words := strings.Fields(text)

	if len(words) == 0 {
		return nil, fmt.Errorf("no words found in text")
	}

	currentChunk := ""
	wordCount := 0

	for i, word := range words {
		// Add word to current chunk
		if currentChunk == "" {
			currentChunk = word
		} else {
			currentChunk += " " + word
		}
		wordCount++

		// Check if we should create a new chunk
		if len(currentChunk) >= maxChunkSize || i == len(words)-1 {
			if len(currentChunk) > 0 {
				metadata := map[string]interface{}{
					"word_count": wordCount,
					"char_count": len(currentChunk),
				}
				chunk := models.Chunk{
					ID:         uuid.New().String(),
					DocumentID: "performance-test",
					Content:    currentChunk,
					Metadata:   metadata,
					ChunkIndex: len(chunks),
					CreatedAt:  time.Now(),
				}
				chunks = append(chunks, chunk)
			}

			// Prepare for next chunk with overlap
			if i < len(words)-1 && wordCount > overlap/10 {
				overlapWords := words[max(0, i-overlap/10) : i+1]
				currentChunk = strings.Join(overlapWords, " ")
				wordCount = len(overlapWords)
			} else {
				currentChunk = ""
				wordCount = 0
			}
		}
	}

	return chunks, nil
}

// GenerateEmbeddingsConcurrently processes multiple chunks concurrently for better performance
func GenerateEmbeddingsConcurrently(ctx context.Context, chunks []models.Chunk) ([][]float32, error) {
	if len(chunks) == 0 {
		return nil, fmt.Errorf("no chunks provided")
	}

	const maxConcurrency = 5
	semaphore := make(chan struct{}, maxConcurrency)

	type result struct {
		index     int
		embedding []float32
		err       error
	}

	results := make(chan result, len(chunks))
	var wg sync.WaitGroup

	// Process chunks concurrently
	for i, chunk := range chunks {
		wg.Add(1)
		go func(index int, c models.Chunk) {
			defer wg.Done()

			// Acquire semaphore
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				results <- result{index: index, err: ctx.Err()}
				return
			}

			// Mock embedding generation (replace with actual Bedrock call in real implementation)
			embedding, err := mockGenerateEmbedding(c.Content)

			results <- result{
				index:     index,
				embedding: embedding,
				err:       err,
			}
		}(i, chunk)
	}

	// Wait for all goroutines to complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	embeddings := make([][]float32, len(chunks))
	errorCount := 0

	for result := range results {
		if result.err != nil {
			errorCount++
			if errorCount > len(chunks)/2 { // Fail if more than half fail
				return nil, fmt.Errorf("too many embedding failures: %w", result.err)
			}
			continue
		}
		embeddings[result.index] = result.embedding
	}

	return embeddings, nil
}

// CallWithRetry implements retry mechanism with exponential backoff
func CallWithRetry(ctx context.Context, maxRetries int, operation func() error) error {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Execute operation
		err := operation()
		if err == nil {
			return nil // Success
		}

		lastErr = err

		// Don't wait after the last attempt
		if attempt >= maxRetries {
			break
		}

		// Exponential backoff with jitter
		backoff := time.Duration(attempt+1) * time.Second
		if backoff > 10*time.Second {
			backoff = 10 * time.Second
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
			// Continue to next retry
		}
	}

	return fmt.Errorf("operation failed after %d retries: %w", maxRetries, lastErr)
}

// Helper functions
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Mock function for testing - replace with actual Bedrock client call
func mockGenerateEmbedding(text string) ([]float32, error) {
	// Simulate some processing time
	time.Sleep(100 * time.Millisecond)

	// Generate mock embedding vector
	embedding := make([]float32, 1536) // Titan embedding dimension
	for i := range embedding {
		embedding[i] = 0.1 // Mock value
	}

	return embedding, nil
}
