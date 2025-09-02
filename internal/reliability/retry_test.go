package reliability

import (
	"context"
	"errors"
	"testing"
	"time"

	"aws-serverless-rag/internal/utils"
)

func TestExecuteWithRetry_Success(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxRetries = 2
	config.BaseDelay = 10 * time.Millisecond

	logger := utils.NewLogger()

	callCount := 0
	operation := func() error {
		callCount++
		if callCount <= 2 {
			return errors.New("temporary failure")
		}
		return nil // Success on third attempt
	}

	err := ExecuteWithRetry(context.Background(), config, operation, logger)

	if err != nil {
		t.Errorf("Expected success but got error: %v", err)
	}

	if callCount != 3 {
		t.Errorf("Expected 3 calls, got %d", callCount)
	}
}

func TestExecuteWithRetry_Failure(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxRetries = 2
	config.BaseDelay = 10 * time.Millisecond

	logger := utils.NewLogger()

	operation := func() error {
		return errors.New("persistent failure")
	}

	err := ExecuteWithRetry(context.Background(), config, operation, logger)

	if err == nil {
		t.Error("Expected error but got success")
	}
}

func TestExecuteWithRetry_ContextCancellation(t *testing.T) {
	config := DefaultRetryConfig()
	config.MaxRetries = 5
	config.BaseDelay = 100 * time.Millisecond

	logger := utils.NewLogger()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	operation := func() error {
		return errors.New("failure")
	}

	err := ExecuteWithRetry(ctx, config, operation, logger)

	if err != context.DeadlineExceeded {
		t.Errorf("Expected context deadline exceeded, got %v", err)
	}
}

func TestCircuitBreaker_Open(t *testing.T) {
	config := CircuitBreakerConfig{
		MaxFailures:  3,
		ResetTimeout: 100 * time.Millisecond,
	}

	logger := utils.NewLogger()
	cb := NewCircuitBreaker(config, logger)

	failingOperation := func() error {
		return errors.New("operation failed")
	}

	// Trigger failures to open the circuit breaker
	for i := 0; i < 3; i++ {
		err := cb.Execute(failingOperation)
		if err == nil {
			t.Errorf("Expected error on attempt %d", i+1)
		}
	}

	// Next call should be rejected due to open circuit
	err := cb.Execute(failingOperation)
	if err == nil || err.Error() != "circuit breaker is open" {
		t.Errorf("Expected circuit breaker open error, got %v", err)
	}
}

func TestCircuitBreaker_Recovery(t *testing.T) {
	config := CircuitBreakerConfig{
		MaxFailures:  2,
		ResetTimeout: 50 * time.Millisecond,
	}

	logger := utils.NewLogger()
	cb := NewCircuitBreaker(config, logger)

	// Trigger failures to open circuit breaker
	for i := 0; i < 2; i++ {
		cb.Execute(func() error {
			return errors.New("failure")
		})
	}

	// Wait for reset timeout
	time.Sleep(60 * time.Millisecond)

	// Should transition to half-open and then succeed
	successOperation := func() error {
		return nil
	}

	err := cb.Execute(successOperation)
	if err != nil {
		t.Errorf("Expected success after recovery, got %v", err)
	}

	// Should be closed now
	if cb.state != StateClosed {
		t.Errorf("Expected closed state, got %v", cb.state)
	}
}

func TestCalculateBackoff(t *testing.T) {
	config := RetryConfig{
		BaseDelay:     time.Second,
		MaxDelay:      10 * time.Second,
		BackoffFactor: 2.0,
	}

	tests := []struct {
		attempt     int
		expectedMin time.Duration
		expectedMax time.Duration
	}{
		{0, time.Second, 3 * time.Second},
		{1, 3 * time.Second, 5 * time.Second},
		{2, 5 * time.Second, 10 * time.Second},
		{10, 10 * time.Second, 10 * time.Second}, // Should be capped at MaxDelay
	}

	for _, tt := range tests {
		delay := calculateBackoff(tt.attempt, config)

		if delay < tt.expectedMin || delay > tt.expectedMax {
			t.Errorf("Attempt %d: expected delay between %v and %v, got %v",
				tt.attempt, tt.expectedMin, tt.expectedMax, delay)
		}
	}
}
