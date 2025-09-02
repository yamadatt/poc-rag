# データベース設計書

## 1. データベース概要

本システムでは、以下のデータストレージを使用してデータを管理します：

- **DynamoDB**: ドキュメントメタデータの管理
- **Amazon S3**: 元ファイルの保存
- **Amazon OpenSearch**: ベクトルインデックスとテキスト検索

## 2. DynamoDB テーブル設計

### 2.1 DocumentTable

**テーブル概要**
- テーブル名: `rag-documents-${Environment}`
- パーティションキー: `document_id`
- 読み取り/書き込みキャパシティ: オンデマンド

**属性定義**

| 属性名 | 型 | 説明 | 必須 | インデックス |
|--------|----|----|------|-------------|
| `document_id` | String (S) | ドキュメントの一意識別子 | ✓ | Primary Key |
| `filename` | String (S) | 元ファイル名 | ✓ | - |
| `original_filename` | String (S) | ユーザーが指定した元ファイル名 | ✓ | - |
| `file_size` | Number (N) | ファイルサイズ（バイト） | ✓ | - |
| `content_type` | String (S) | MIMEタイプ | ✓ | - |
| `status` | String (S) | 処理ステータス | ✓ | GSI |
| `uploaded_at` | String (S) | アップロード日時（ISO 8601） | ✓ | GSI |
| `processed_at` | String (S) | 処理完了日時（ISO 8601） | - | - |
| `total_chunks` | Number (N) | 総チャンク数 | - | - |
| `chunks_with_embeddings` | Number (N) | 埋め込み済みチャンク数 | - | - |
| `processing_progress` | Number (N) | 処理進捗（0-100） | - | - |
| `last_error` | String (S) | 最後に発生したエラー | - | - |
| `s3_bucket` | String (S) | S3バケット名 | ✓ | - |
| `s3_key` | String (S) | S3オブジェクトキー | ✓ | - |
| `created_by` | String (S) | 作成者ID | - | - |
| `tags` | List (L) | タグリスト | - | - |
| `metadata` | Map (M) | 追加メタデータ | - | - |

**サンプルアイテム**

```json
{
  "document_id": "doc-1234567890abcdef",
  "filename": "machine_learning_guide.pdf",
  "original_filename": "機械学習ガイド.pdf",
  "file_size": 2048576,
  "content_type": "application/pdf",
  "status": "completed",
  "uploaded_at": "2024-01-15T10:30:00Z",
  "processed_at": "2024-01-15T10:35:30Z",
  "total_chunks": 45,
  "chunks_with_embeddings": 45,
  "processing_progress": 100,
  "last_error": null,
  "s3_bucket": "rag-documents-prod",
  "s3_key": "documents/doc-1234567890abcdef/machine_learning_guide.pdf",
  "created_by": "user-123",
  "tags": ["AI", "機械学習", "技術文書"],
  "metadata": {
    "pages": 120,
    "language": "ja",
    "extracted_text_length": 450000
  }
}
```

### 2.2 Global Secondary Index (GSI)

#### StatusIndex
- **目的**: ステータス別のドキュメント検索
- **パーティションキー**: `status`
- **ソートキー**: `uploaded_at`
- **プロジェクション**: ALL

**使用例**
```javascript
// 処理中のドキュメント一覧
const params = {
  TableName: 'rag-documents',
  IndexName: 'StatusIndex',
  KeyConditionExpression: '#status = :status',
  ExpressionAttributeNames: {
    '#status': 'status'
  },
  ExpressionAttributeValues: {
    ':status': 'processing'
  }
};
```

#### UploadTimeIndex
- **目的**: 時系列でのドキュメント検索
- **パーティションキー**: `status`
- **ソートキー**: `uploaded_at`
- **プロジェクション**: KEYS_ONLY + filename

**使用例**
```javascript
// 最新のドキュメント一覧
const params = {
  TableName: 'rag-documents',
  IndexName: 'UploadTimeIndex',
  KeyConditionExpression: '#status = :status',
  ScanIndexForward: false,  // 降順
  Limit: 20
};
```

## 3. Amazon S3 ストレージ設計

### 3.1 バケット構造

```
rag-documents-${environment}/
├── documents/                    # 元ドキュメント
│   └── {document_id}/
│       └── {original_filename}
├── processed/                    # 処理済みファイル
│   └── {document_id}/
│       ├── extracted_text.txt
│       ├── chunks/
│       │   ├── chunk_001.json
│       │   ├── chunk_002.json
│       │   └── ...
│       └── metadata.json
└── temp/                         # 一時ファイル
    └── uploads/
        └── {upload_id}/
```

### 3.2 オブジェクト命名規則

- **元ドキュメント**: `documents/{document_id}/{sanitized_filename}`
- **抽出テキスト**: `processed/{document_id}/extracted_text.txt`
- **チャンクデータ**: `processed/{document_id}/chunks/chunk_{index:03d}.json`
- **メタデータ**: `processed/{document_id}/metadata.json`

### 3.3 バケットポリシー

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/rag-lambda-execution-role"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::rag-documents-*/*"
    }
  ]
}
```

### 3.4 ライフサイクルポリシー

```json
{
  "Rules": [
    {
      "Id": "TempFilesCleanup",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "ArchiveOldDocuments",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "documents/"
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

## 4. Amazon OpenSearch インデックス設計

### 4.1 インデックス名規則

- **インデックス名**: `rag-chunks-${environment}`
- **エイリアス**: `rag-chunks-active`

### 4.2 マッピング定義

```json
{
  "mappings": {
    "properties": {
      "document_id": {
        "type": "keyword",
        "index": true
      },
      "chunk_id": {
        "type": "keyword",
        "index": true
      },
      "content": {
        "type": "text",
        "analyzer": "kuromoji",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "content_length": {
        "type": "integer"
      },
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "space_type": "l2",
          "engine": "faiss",
          "parameters": {
            "ef_construction": 128,
            "m": 24
          }
        }
      },
      "metadata": {
        "properties": {
          "filename": {
            "type": "keyword"
          },
          "page_number": {
            "type": "integer"
          },
          "chunk_index": {
            "type": "integer"
          },
          "section_title": {
            "type": "text",
            "analyzer": "kuromoji"
          },
          "language": {
            "type": "keyword"
          },
          "content_type": {
            "type": "keyword"
          }
        }
      },
      "created_at": {
        "type": "date",
        "format": "strict_date_optional_time"
      },
      "updated_at": {
        "type": "date",
        "format": "strict_date_optional_time"
      }
    }
  },
  "settings": {
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 512,
      "number_of_shards": 2,
      "number_of_replicas": 1,
      "refresh_interval": "30s"
    },
    "analysis": {
      "analyzer": {
        "kuromoji": {
          "type": "custom",
          "tokenizer": "kuromoji_tokenizer",
          "filter": [
            "kuromoji_baseform",
            "kuromoji_part_of_speech",
            "cjk_width",
            "ja_stop",
            "kuromoji_stemmer",
            "lowercase"
          ]
        }
      }
    }
  }
}
```

### 4.3 サンプルドキュメント

```json
{
  "document_id": "doc-1234567890abcdef",
  "chunk_id": "chunk-001",
  "content": "機械学習は、コンピューターがデータから学習して予測や分類を行う技術です。深層学習は機械学習の一分野であり、ニューラルネットワークを使用します。",
  "content_length": 89,
  "embedding": [0.123, -0.456, 0.789, ...],  // 1536次元のベクトル
  "metadata": {
    "filename": "machine_learning_guide.pdf",
    "page_number": 15,
    "chunk_index": 1,
    "section_title": "機械学習の基礎",
    "language": "ja",
    "content_type": "application/pdf"
  },
  "created_at": "2024-01-15T10:35:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

### 4.4 クエリ例

#### ベクトル類似検索

```json
{
  "size": 5,
  "query": {
    "bool": {
      "must": [
        {
          "knn": {
            "embedding": {
              "vector": [0.123, -0.456, ...],
              "k": 10
            }
          }
        }
      ],
      "filter": [
        {
          "term": {
            "metadata.language": "ja"
          }
        }
      ]
    }
  },
  "_source": {
    "excludes": ["embedding"]
  }
}
```

#### ハイブリッド検索（テキスト + ベクトル）

```json
{
  "size": 10,
  "query": {
    "hybrid": {
      "queries": [
        {
          "multi_match": {
            "query": "機械学習 深層学習",
            "fields": ["content", "metadata.section_title"],
            "type": "best_fields"
          }
        },
        {
          "knn": {
            "embedding": {
              "vector": [0.123, -0.456, ...],
              "k": 20
            }
          }
        }
      ]
    }
  }
}
```

## 5. データ移行・バックアップ戦略

### 5.1 DynamoDB バックアップ

```yaml
# 継続バックアップ設定
BackupPolicy:
  PointInTimeRecoveryEnabled: true
  BackupRetentionPeriod: 35  # 日数

# 定期バックアップ（weekly）
ScheduledBackups:
  - Schedule: "cron(0 2 * * 0 *)"  # 毎週日曜日 2:00 AM
    RetentionPeriod: 90  # 日数
```

### 5.2 S3 バックアップ

```yaml
CrossRegionReplication:
  SourceBucket: rag-documents-prod
  DestinationBucket: rag-documents-backup-us-west-2
  ReplicationRole: arn:aws:iam::ACCOUNT:role/replication-role
```

### 5.3 OpenSearch スナップショット

```json
{
  "type": "s3",
  "settings": {
    "bucket": "opensearch-snapshots-prod",
    "region": "us-east-1",
    "role_arn": "arn:aws:iam::ACCOUNT:role/opensearch-snapshot-role"
  }
}
```

## 6. パフォーマンス最適化

### 6.1 DynamoDB 最適化

```javascript
// バッチ処理
const batchWrite = async (items) => {
  const chunks = chunk(items, 25);  // DynamoDBの制限
  
  for (const chunk of chunks) {
    const params = {
      RequestItems: {
        'rag-documents': chunk.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    };
    
    await dynamodb.batchWriteItem(params).promise();
  }
};

// 並列クエリ
const parallelQueries = await Promise.all([
  dynamodb.query(statusQuery).promise(),
  dynamodb.query(timeRangeQuery).promise()
]);
```

### 6.2 OpenSearch 最適化

```json
// インデックステンプレート
{
  "template": {
    "settings": {
      "index": {
        "refresh_interval": "30s",
        "translog": {
          "flush_threshold_size": "1gb",
          "sync_interval": "30s"
        }
      }
    }
  }
}

// バルクインデックス
POST /_bulk
{ "index": { "_index": "rag-chunks", "_id": "chunk-001" } }
{ "document_id": "doc-123", "content": "..." }
{ "index": { "_index": "rag-chunks", "_id": "chunk-002" } }
{ "document_id": "doc-123", "content": "..." }
```

## 7. セキュリティ設定

### 7.1 暗号化

```yaml
DynamoDB:
  Encryption:
    SSESpecification:
      SSEEnabled: true
      KMSMasterKeyId: alias/dynamodb-key

S3:
  Encryption:
    ServerSideEncryptionConfiguration:
      - ServerSideEncryptionByDefault:
          SSEAlgorithm: aws:kms
          KMSMasterKeyID: alias/s3-key

OpenSearch:
  Encryption:
    EncryptionAtRest:
      Enabled: true
      KmsKeyId: alias/opensearch-key
    NodeToNodeEncryption:
      Enabled: true
    DomainEndpointOptions:
      EnforceHTTPS: true
```

### 7.2 アクセス制御

```json
// DynamoDB リソースポリシー
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/rag-lambda-role"
      },
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:ACCOUNT:table/rag-documents*"
    }
  ]
}
```

## 8. モニタリング・アラート

### 8.1 CloudWatch メトリクス

```yaml
DynamoDBMetrics:
  - ConsumedReadCapacityUnits
  - ConsumedWriteCapacityUnits
  - ThrottledRequests
  - SystemErrors

S3Metrics:
  - BucketSizeBytes
  - NumberOfObjects
  - AllRequests
  - 4xxErrors
  - 5xxErrors

OpenSearchMetrics:
  - SearchLatency
  - IndexingLatency
  - ClusterStatus
  - CPUUtilization
  - StorageUtilization
```

### 8.2 アラート設定

```yaml
Alarms:
  - MetricName: ThrottledRequests
    Threshold: 0
    ComparisonOperator: GreaterThanThreshold
    AlarmAction: sns:arn:aws:sns:region:account:alerts
    
  - MetricName: ClusterStatus.red
    Threshold: 0
    ComparisonOperator: GreaterThanThreshold
    AlarmAction: sns:arn:aws:sns:region:account:critical-alerts
```