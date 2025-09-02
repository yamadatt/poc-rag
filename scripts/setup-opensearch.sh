#!/bin/bash

# OpenSearch cluster endpoint
OPENSEARCH_ENDPOINT="search-rag-prod-search-dae2plhddn3kqzecgv47aalwba.ap-northeast-1.es.amazonaws.com"
INDEX_NAME="rag-documents-prod"

# Check if index already exists
echo "Checking if index exists..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X HEAD "https://${OPENSEARCH_ENDPOINT}/${INDEX_NAME}")

if [ "$STATUS" -eq 200 ]; then
    echo "Index already exists. Deleting old index..."
    curl -X DELETE "https://${OPENSEARCH_ENDPOINT}/${INDEX_NAME}"
fi

# Create new index with proper mapping
echo "Creating index with mapping..."
curl -X PUT "https://${OPENSEARCH_ENDPOINT}/${INDEX_NAME}" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "index": {
        "knn": true,
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
  }'

echo ""
echo "Index setup complete!"

# Verify index creation
echo "Verifying index..."
curl -X GET "https://${OPENSEARCH_ENDPOINT}/${INDEX_NAME}/_settings?pretty"