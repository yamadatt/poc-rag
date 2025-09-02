.PHONY: build clean deploy destroy test lint

# Default environment
ENV ?= dev

# Build all Lambda functions
build:
	sam build --parallel

# Clean build artifacts
clean:
	sam build --use-container --clean

# Deploy to specified environment
deploy:
	sam deploy --config-env $(ENV) --guided

# Deploy without confirmation
deploy-auto:
	sam deploy --config-env $(ENV) --no-confirm-changeset

# Destroy stack
destroy:
	aws cloudformation delete-stack --stack-name aws-serverless-rag-$(ENV)

# Run local API
local:
	sam local start-api --env-vars env.json

# Run tests
test:
	go test ./...

# Run tests with coverage
test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Lint Go code
lint:
	golangci-lint run

# Format Go code
fmt:
	go fmt ./...

# Install dependencies
deps:
	go mod download
	go mod tidy

# Initialize project
init: deps build

# Validate SAM template
validate:
	sam validate --lint

# Package for deployment
package:
	sam build
	sam package --s3-bucket aws-serverless-rag-artifacts-$(ENV)

# Sync changes quickly during development
sync:
	sam sync --stack-name aws-serverless-rag-$(ENV) --watch

# Show logs for specific function
logs-upload:
	sam logs --name DocumentUploadFunction --stack-name aws-serverless-rag-$(ENV) --tail

logs-process:
	sam logs --name DocumentProcessingFunction --stack-name aws-serverless-rag-$(ENV) --tail

logs-query:
	sam logs --name QueryFunction --stack-name aws-serverless-rag-$(ENV) --tail

logs-status:
	sam logs --name DocumentStatusFunction --stack-name aws-serverless-rag-$(ENV) --tail

logs-delete:
	sam logs --name DocumentDeleteFunction --stack-name aws-serverless-rag-$(ENV) --tail

# Show stack outputs
outputs:
	aws cloudformation describe-stacks --stack-name aws-serverless-rag-$(ENV) --query 'Stacks[0].Outputs'