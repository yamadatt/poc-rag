package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"
)

// LogLevel represents the log level
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

// String returns the string representation of the log level
func (l LogLevel) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// Logger provides structured logging for Lambda functions
type Logger struct {
	level        LogLevel
	requestID    string
	functionName string
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp    time.Time              `json:"timestamp"`
	Level        string                 `json:"level"`
	Message      string                 `json:"message"`
	RequestID    string                 `json:"request_id,omitempty"`
	FunctionName string                 `json:"function_name,omitempty"`
	Fields       map[string]interface{} `json:"fields,omitempty"`
}

// NewLogger creates a new logger instance
func NewLogger() *Logger {
	level := INFO
	if os.Getenv("LOG_LEVEL") == "DEBUG" {
		level = DEBUG
	}

	return &Logger{
		level:        level,
		functionName: os.Getenv("AWS_LAMBDA_FUNCTION_NAME"),
	}
}

// WithRequestID adds request ID to the logger
func (l *Logger) WithRequestID(requestID string) *Logger {
	newLogger := *l
	newLogger.requestID = requestID
	return &newLogger
}

// Debug logs a debug message
func (l *Logger) Debug(message string, fields ...map[string]interface{}) {
	l.log(DEBUG, message, fields...)
}

// Info logs an info message
func (l *Logger) Info(message string, fields ...map[string]interface{}) {
	l.log(INFO, message, fields...)
}

// Warn logs a warning message
func (l *Logger) Warn(message string, fields ...map[string]interface{}) {
	l.log(WARN, message, fields...)
}

// Error logs an error message
func (l *Logger) Error(message string, fields ...map[string]interface{}) {
	l.log(ERROR, message, fields...)
}

// ErrorWithErr logs an error with error details
func (l *Logger) ErrorWithErr(message string, err error, fields ...map[string]interface{}) {
	mergedFields := make(map[string]interface{})
	if len(fields) > 0 {
		for k, v := range fields[0] {
			mergedFields[k] = v
		}
	}
	mergedFields["error"] = err.Error()
	l.log(ERROR, message, mergedFields)
}

// log writes the log entry
func (l *Logger) log(level LogLevel, message string, fields ...map[string]interface{}) {
	if level < l.level {
		return
	}

	entry := LogEntry{
		Timestamp:    time.Now(),
		Level:        level.String(),
		Message:      message,
		RequestID:    l.requestID,
		FunctionName: l.functionName,
	}

	if len(fields) > 0 {
		entry.Fields = fields[0]
	}

	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Failed to marshal log entry: %v", err)
		return
	}

	fmt.Println(string(jsonBytes))
}

// GetLoggerFromContext extracts logger from context or creates a new one
func GetLoggerFromContext(ctx context.Context) *Logger {
	if logger, ok := ctx.Value("logger").(*Logger); ok {
		return logger
	}
	return NewLogger()
}

// WithLogger adds logger to context
func WithLogger(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, "logger", logger)
}
