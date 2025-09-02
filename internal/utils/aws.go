package utils

import (
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/bedrockruntime"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/s3"
)

// AWSConfig holds AWS service clients
type AWSConfig struct {
	Session        *session.Session
	S3Client       *s3.S3
	DynamoDBClient *dynamodb.DynamoDB
	BedrockClient  *bedrockruntime.BedrockRuntime
}

// NewAWSConfig creates and initializes AWS service clients
func NewAWSConfig() (*AWSConfig, error) {
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(getRegion()),
	})
	if err != nil {
		return nil, err
	}

	// Create service clients
	s3Client := s3.New(sess)
	dynamoDBClient := dynamodb.New(sess)
	bedrockClient := bedrockruntime.New(sess, &aws.Config{
		Region: aws.String(getBedrockRegion()),
	})

	return &AWSConfig{
		Session:        sess,
		S3Client:       s3Client,
		DynamoDBClient: dynamoDBClient,
		BedrockClient:  bedrockClient,
	}, nil
}

// getRegion returns the AWS region from environment or defaults to us-east-1
func getRegion() string {
	if region := os.Getenv("AWS_REGION"); region != "" {
		return region
	}
	return "us-east-1"
}

// getBedrockRegion returns the Bedrock region from environment or defaults to AWS_REGION
func getBedrockRegion() string {
	if region := os.Getenv("BEDROCK_REGION"); region != "" {
		return region
	}
	return getRegion()
}

// GetS3BucketName returns the S3 bucket name from environment
func GetS3BucketName() string {
	return os.Getenv("S3_BUCKET_NAME")
}

// GetOpenSearchEndpoint returns the OpenSearch endpoint from environment
func GetOpenSearchEndpoint() string {
	return os.Getenv("OPENSEARCH_ENDPOINT")
}

// GetDynamoDBTableName returns the DynamoDB table name from environment
func GetDynamoDBTableName() string {
	return os.Getenv("DYNAMODB_TABLE_NAME")
}

// GetEnvironment returns the current environment (dev, staging, prod)
func GetEnvironment() string {
	if env := os.Getenv("ENVIRONMENT"); env != "" {
		return env
	}
	return "dev"
}
