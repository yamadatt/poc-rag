#!/usr/bin/env python3
import json
import boto3
import sys
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

# AWS credentials
session = boto3.Session()
credentials = session.get_credentials()
region = 'ap-northeast-1'

# OpenSearch configuration
host = 'search-rag-prod-search-dae2plhddn3kqzecgv47aalwba.ap-northeast-1.es.amazonaws.com'
service = 'es'
awsauth = AWS4Auth(credentials.access_key, credentials.secret_key,
                   region, service, session_token=credentials.token)

# Create OpenSearch client
client = OpenSearch(
    hosts=[{'host': host, 'port': 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

index_name = 'rag-documents-prod'

# Index settings and mappings
index_body = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1,
        "index": {
            "knn": True,
            "knn.algo_param.ef_search": 512
        }
    },
    "mappings": {
        "properties": {
            "document_id": {
                "type": "keyword"
            },
            "content": {
                "type": "text",
                "analyzer": "standard"
            },
            "metadata": {
                "type": "object",
                "properties": {
                    "source": {
                        "type": "keyword"
                    },
                    "title": {
                        "type": "text"
                    },
                    "timestamp": {
                        "type": "date"
                    },
                    "page": {
                        "type": "integer"
                    },
                    "chunk_index": {
                        "type": "integer"
                    }
                }
            },
            "embedding": {
                "type": "knn_vector",
                "dimension": 1536,
                "method": {
                    "name": "hnsw",
                    "space_type": "l2",
                    "engine": "nmslib",
                    "parameters": {
                        "ef_construction": 512,
                        "m": 16
                    }
                }
            },
            "created_at": {
                "type": "date"
            },
            "updated_at": {
                "type": "date"
            }
        }
    }
}

try:
    # Check if index exists
    if client.indices.exists(index=index_name):
        print(f"Index {index_name} already exists. Deleting...")
        client.indices.delete(index=index_name)
        print(f"Index {index_name} deleted.")
    
    # Create index
    print(f"Creating index {index_name}...")
    response = client.indices.create(index=index_name, body=index_body)
    print(f"Index created successfully: {response}")
    
    # Verify index
    health = client.cluster.health(index=index_name)
    print(f"Index health: {health['status']}")
    
    # Get index info
    info = client.indices.get(index=index_name)
    print(f"Index settings verified.")
    
    print("\nOpenSearch index setup completed successfully!")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)