#!/bin/bash
set -e

# AWS Serverless RAG System Deployment Script
# This script deploys the RAG system using AWS SAM

# Configuration
STACK_NAME=${STACK_NAME:-"aws-serverless-rag"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
S3_BUCKET=${S3_BUCKET:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation functions
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if SAM CLI is installed
    if ! command -v sam &> /dev/null; then
        log_error "SAM CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        log_error "Go is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log_success "All prerequisites are satisfied."
}

validate_template() {
    log_info "Validating SAM template..."
    
    if sam validate; then
        log_success "SAM template is valid."
    else
        log_error "SAM template validation failed."
        exit 1
    fi
}

build_application() {
    log_info "Building the application..."
    
    # Build Go binaries for Lambda
    if sam build; then
        log_success "Application built successfully."
    else
        log_error "Build failed."
        exit 1
    fi
}

create_s3_bucket() {
    if [ -z "$S3_BUCKET" ]; then
        # Generate a unique bucket name
        S3_BUCKET="${STACK_NAME}-deployment-$(date +%s)-${AWS_REGION}"
        log_info "Generated S3 bucket name: $S3_BUCKET"
    fi
    
    log_info "Creating S3 bucket for deployment artifacts..."
    
    # Check if bucket already exists
    if aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
        log_warning "S3 bucket $S3_BUCKET already exists."
    else
        if [ "$AWS_REGION" = "us-east-1" ]; then
            # us-east-1 doesn't need LocationConstraint
            aws s3 mb "s3://$S3_BUCKET"
        else
            aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
        fi
        log_success "S3 bucket created: $S3_BUCKET"
    fi
}

deploy_stack() {
    log_info "Deploying the stack..."
    
    sam deploy \
        --stack-name "$STACK_NAME" \
        --s3-bucket "$S3_BUCKET" \
        --parameter-overrides Environment="$ENVIRONMENT" \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" \
        --confirm-changeset \
        --on-failure ROLLBACK
    
    if [ $? -eq 0 ]; then
        log_success "Stack deployed successfully!"
    else
        log_error "Deployment failed."
        exit 1
    fi
}

get_outputs() {
    log_info "Retrieving stack outputs..."
    
    # Get API Gateway endpoint
    API_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
        --output text)
    
    # Get S3 bucket name
    DOCUMENT_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' \
        --output text)
    
    # Get OpenSearch endpoint
    OPENSEARCH_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`OpenSearchEndpoint`].OutputValue' \
        --output text)
    
    echo ""
    log_success "=== Deployment Complete ==="
    echo -e "${GREEN}API Endpoint:${NC} $API_ENDPOINT"
    echo -e "${GREEN}Document Bucket:${NC} $DOCUMENT_BUCKET"
    echo -e "${GREEN}OpenSearch Endpoint:${NC} $OPENSEARCH_ENDPOINT"
    echo ""
    
    # Save outputs to file
    cat > deployment-outputs.json << EOF
{
    "ApiEndpoint": "$API_ENDPOINT",
    "DocumentBucket": "$DOCUMENT_BUCKET",
    "OpenSearchEndpoint": "$OPENSEARCH_ENDPOINT",
    "StackName": "$STACK_NAME",
    "Environment": "$ENVIRONMENT",
    "Region": "$AWS_REGION"
}
EOF
    
    log_success "Deployment outputs saved to deployment-outputs.json"
}

run_post_deployment_tests() {
    log_info "Running post-deployment tests..."
    
    # Check if API endpoint is accessible
    if [ ! -z "$API_ENDPOINT" ]; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_ENDPOINT/documents" -X OPTIONS)
        if [ "$HTTP_STATUS" = "200" ]; then
            log_success "API endpoint is accessible."
        else
            log_warning "API endpoint returned status: $HTTP_STATUS"
        fi
    fi
    
    # Run unit tests
    if go test ./tests/unit_test.go -v; then
        log_success "Unit tests passed."
    else
        log_warning "Some unit tests failed."
    fi
}

cleanup_on_failure() {
    log_error "Deployment failed. Cleaning up..."
    
    # Delete the stack if it was partially created
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &> /dev/null; then
        log_info "Deleting failed stack..."
        aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$AWS_REGION"
    fi
}

# Main deployment function
main() {
    log_info "Starting deployment of AWS Serverless RAG system..."
    echo -e "${BLUE}Stack Name:${NC} $STACK_NAME"
    echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
    echo -e "${BLUE}Region:${NC} $AWS_REGION"
    echo ""
    
    # Set trap for cleanup on failure
    trap cleanup_on_failure ERR
    
    check_prerequisites
    validate_template
    build_application
    create_s3_bucket
    deploy_stack
    get_outputs
    run_post_deployment_tests
    
    log_success "Deployment completed successfully!"
}

# Help function
show_help() {
    echo "AWS Serverless RAG Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -s, --stack-name NAME   CloudFormation stack name (default: aws-serverless-rag)"
    echo "  -e, --environment ENV   Environment (dev/staging/prod) (default: dev)"
    echo "  -r, --region REGION     AWS region (default: us-east-1)"
    echo "  -b, --bucket BUCKET     S3 bucket for deployment artifacts (auto-generated if not specified)"
    echo ""
    echo "Environment Variables:"
    echo "  STACK_NAME              CloudFormation stack name"
    echo "  ENVIRONMENT             Environment (dev/staging/prod)"
    echo "  AWS_REGION              AWS region"
    echo "  S3_BUCKET               S3 bucket for deployment artifacts"
    echo ""
    echo "Examples:"
    echo "  $0                      # Deploy with default settings"
    echo "  $0 -e prod -r us-west-2 # Deploy to production in us-west-2"
    echo "  $0 -s my-rag-stack -e dev # Deploy with custom stack name"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -b|--bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main