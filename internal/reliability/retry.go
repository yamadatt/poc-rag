package reliability

import (
	"context"
	"fmt"
	"time"

	"aws-serverless-rag/internal/utils"
)

// RetryConfig defines configuration for retry operations
type RetryConfig struct {
	MaxRetries      int
	BaseDelay       time.Duration
	MaxDelay        time.Duration
	BackoffFactor   float64
	RetryableErrors []error
}

// DefaultRetryConfig returns a default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:      3,
		BaseDelay:       time.Second,
		MaxDelay:        30 * time.Second,
		BackoffFactor:   2.0,
		RetryableErrors: []error{
			// Add common retryable errors
		},
	}
}

// RetryableOperation represents an operation that can be retried
type RetryableOperation func() error

// ExecuteWithRetry executes an operation with retry logic
func ExecuteWithRetry(ctx context.Context, config RetryConfig, operation RetryableOperation, logger *utils.Logger) error {
	var lastErr error

	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		// Check for context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Execute the operation
		err := operation()
		if err == nil {
			if attempt > 0 && logger != nil {
				logger.Info("Operation succeeded after retry", map[string]interface{}{
					"attempt": attempt + 1,
				})
			}
			return nil
		}

		lastErr = err

		// Check if error is retryable
		if !isRetryableError(err, config.RetryableErrors) {
			if logger != nil {
				logger.Warn("Non-retryable error encountered", map[string]interface{}{
					"error":   err.Error(),
					"attempt": attempt + 1,
				})
			}
			return err
		}

		// Don't sleep after the last attempt
		if attempt >= config.MaxRetries {
			break
		}

		// Calculate backoff delay
		delay := calculateBackoff(attempt, config)

		if logger != nil {
			logger.Warn("Operation failed, retrying", map[string]interface{}{
				"error":      err.Error(),
				"attempt":    attempt + 1,
				"next_retry": fmt.Sprintf("%.2fs", delay.Seconds()),
			})
		}

		// Wait before retrying
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// Continue to next retry
		}
	}

	if logger != nil {
		logger.Error("Operation failed after all retries", map[string]interface{}{
			"error":          lastErr.Error(),
			"total_attempts": config.MaxRetries + 1,
		})
	}

	return fmt.Errorf("operation failed after %d retries: %w", config.MaxRetries, lastErr)
}

// calculateBackoff calculates the backoff delay for a given attempt
func calculateBackoff(attempt int, config RetryConfig) time.Duration {
	delay := float64(config.BaseDelay) * float64(attempt+1) * config.BackoffFactor

	if time.Duration(delay) > config.MaxDelay {
		delay = float64(config.MaxDelay)
	}

	return time.Duration(delay)
}

// isRetryableError checks if an error is retryable based on the configuration
func isRetryableError(err error, retryableErrors []error) bool {
	if len(retryableErrors) == 0 {
		// If no specific retryable errors defined, retry all errors
		return true
	}

	for _, retryable := range retryableErrors {
		if err == retryable {
			return true
		}
	}

	return false
}

// Circuit breaker implementation for preventing cascading failures
type CircuitBreakerConfig struct {
	MaxFailures     int
	ResetTimeout    time.Duration
	MonitorInterval time.Duration
}

type CircuitBreakerState int

const (
	StateClosed CircuitBreakerState = iota
	StateOpen
	StateHalfOpen
)

type CircuitBreaker struct {
	config       CircuitBreakerConfig
	state        CircuitBreakerState
	failures     int
	lastFailTime time.Time
	logger       *utils.Logger
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(config CircuitBreakerConfig, logger *utils.Logger) *CircuitBreaker {
	return &CircuitBreaker{
		config: config,
		state:  StateClosed,
		logger: logger,
	}
}

// Execute executes an operation through the circuit breaker
func (cb *CircuitBreaker) Execute(operation RetryableOperation) error {
	if cb.state == StateOpen {
		if time.Since(cb.lastFailTime) < cb.config.ResetTimeout {
			return fmt.Errorf("circuit breaker is open")
		}
		// Transition to half-open
		cb.state = StateHalfOpen
		cb.logger.Info("Circuit breaker transitioning to half-open state")
	}

	err := operation()

	if err != nil {
		cb.failures++
		cb.lastFailTime = time.Now()

		if cb.failures >= cb.config.MaxFailures && cb.state != StateOpen {
			cb.state = StateOpen
			cb.logger.Warn("Circuit breaker opened due to failures", map[string]interface{}{
				"failures": cb.failures,
			})
		}

		return err
	}

	// Operation succeeded
	if cb.state == StateHalfOpen {
		cb.state = StateClosed
		cb.failures = 0
		cb.logger.Info("Circuit breaker closed after successful operation")
	}

	return nil
}
