# OpenSearchインデックス再作成ガイド

## 🚨 重要な注意事項
- インデックス再作成中は検索機能が一時的に利用できなくなります
- 既存のドキュメントデータは再処理が必要です
- 本番環境では必ずメンテナンス時間を設けて実施してください

## 📋 事前確認

### 1. 現在のインデックス設定を確認
```bash
# 現在のインデックス設定を確認
curl -X GET "https://<your-opensearch-endpoint>/rag-documents-<environment>/_mapping" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY"

# インデックス一覧を確認
curl -X GET "https://<your-opensearch-endpoint>/_cat/indices/rag-documents-*?v" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY"
```

### 2. 現在のドキュメント数を確認
```bash
curl -X GET "https://<your-opensearch-endpoint>/rag-documents-<environment>/_count" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY"
```

## 🔄 インデックス再作成手順

### Option A: ゼロダウンタイム移行（推奨）

#### 1. 新しいインデックスを作成
```bash
# 新しいインデックス名で作成（例: rag-documents-dev-v2）
curl -X PUT "https://<your-opensearch-endpoint>/rag-documents-<environment>-v2" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "document_id": {
          "type": "keyword"
        },
        "chunk_id": {
          "type": "keyword"
        },
        "content": {
          "type": "text"
        },
        "embedding": {
          "type": "knn_vector",
          "dimension": 1536,
          "method": {
            "name": "hnsw",
            "space_type": "cosinesimilarity",
            "engine": "nmslib",
            "parameters": {
              "ef_construction": 512,
              "m": 32
            }
          }
        },
        "metadata": {
          "properties": {
            "file_name": {
              "type": "text"
            },
            "file_type": {
              "type": "keyword"
            },
            "chunk_index": {
              "type": "integer"
            },
            "total_chunks": {
              "type": "integer"
            },
            "word_count": {
              "type": "integer"
            },
            "char_count": {
              "type": "integer"
            },
            "created_at": {
              "type": "date"
            }
          }
        },
        "created_at": {
          "type": "date"
        }
      }
    },
    "settings": {
      "index": {
        "knn": true,
        "knn.algo_param.ef_search": 512
      }
    }
  }'
```

#### 2. 環境変数を一時的に更新
```bash
# Lambda環境変数でインデックス名を新しいものに変更
# または、コードで新旧両方のインデックスを並行利用
```

#### 3. 全ドキュメントを再処理
```python
# 再処理スクリプト例
import boto3
import json

def reprocess_all_documents():
    s3 = boto3.client('s3')
    lambda_client = boto3.client('lambda')
    
    # S3からドキュメント一覧を取得
    bucket_name = 'your-document-bucket'
    paginator = s3.get_paginator('list_objects_v2')
    
    for page in paginator.paginate(Bucket=bucket_name, Prefix='documents/prod/'):
        for obj in page.get('Contents', []):
            if obj['Key'].endswith('/'):
                continue
                
            # ドキュメントIDを抽出
            document_id = obj['Key'].split('/')[-1]
            
            # 処理Lambda関数を呼び出し
            lambda_client.invoke(
                FunctionName='aws-serverless-rag-prod-process-document',
                InvocationType='Event',  # 非同期実行
                Payload=json.dumps({
                    'document_id': document_id
                })
            )
            
            print(f"Queued reprocessing for: {document_id}")

if __name__ == "__main__":
    reprocess_all_documents()
```

#### 4. エイリアスを使った切り替え
```bash
# 旧インデックスにエイリアスが設定されていない場合は作成
curl -X POST "https://<your-opensearch-endpoint>/_aliases" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "add": {
          "index": "rag-documents-<environment>-v2",
          "alias": "rag-documents-<environment>"
        }
      },
      {
        "remove": {
          "index": "rag-documents-<environment>-v1",
          "alias": "rag-documents-<environment>"
        }
      }
    ]
  }'
```

#### 5. 旧インデックスの削除
```bash
# データ移行完了後、旧インデックスを削除
curl -X DELETE "https://<your-opensearch-endpoint>/rag-documents-<environment>-v1" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY"
```

### Option B: 直接削除・再作成（シンプルだがダウンタイムあり）

⚠️ **注意**: この方法は検索機能が一時的に停止します

#### 1. 既存インデックスをバックアップ（オプション）
```bash
# スナップショットを作成
curl -X PUT "https://<your-opensearch-endpoint>/_snapshot/backup-repo/backup-$(date +%Y%m%d)" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "rag-documents-<environment>",
    "ignore_unavailable": true,
    "include_global_state": false
  }'
```

#### 2. 既存インデックスを削除
```bash
curl -X DELETE "https://<your-opensearch-endpoint>/rag-documents-<environment>" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY"
```

#### 3. 新しいインデックスを作成
```bash
# 上記のOption Aの手順1と同じインデックス作成コマンドを実行
# ただしインデックス名は元の名前を使用
```

## 🛠️ 自動化スクリプト

### 完全な再作成スクリプト
```bash
#!/bin/bash

# 設定
OPENSEARCH_ENDPOINT="your-opensearch-endpoint"
ENVIRONMENT="dev"  # dev, staging, prod
INDEX_NAME="rag-documents-${ENVIRONMENT}"
NEW_INDEX_NAME="${INDEX_NAME}-v2"

echo "🔍 Starting index recreation for ${INDEX_NAME}..."

# 1. 新しいインデックスを作成
echo "📝 Creating new index: ${NEW_INDEX_NAME}"
curl -X PUT "https://${OPENSEARCH_ENDPOINT}/${NEW_INDEX_NAME}" \
  --aws-sigv4 "aws:amz:ap-northeast-1:es" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "document_id": { "type": "keyword" },
        "chunk_id": { "type": "keyword" },
        "content": { "type": "text" },
        "embedding": {
          "type": "knn_vector",
          "dimension": 1536,
          "method": {
            "name": "hnsw",
            "space_type": "cosinesimilarity",
            "engine": "nmslib"
          }
        },
        "metadata": {
          "properties": {
            "file_name": { "type": "text" },
            "file_type": { "type": "keyword" },
            "chunk_index": { "type": "integer" },
            "created_at": { "type": "date" }
          }
        },
        "created_at": { "type": "date" }
      }
    },
    "settings": {
      "index": {
        "knn": true,
        "knn.algo_param.ef_search": 512
      }
    }
  }'

# 2. 環境変数の更新（手動で実施）
echo "⚠️  Lambda環境変数を更新してください:"
echo "   OPENSEARCH_INDEX_NAME=${NEW_INDEX_NAME}"

# 3. ドキュメント再処理のトリガー
echo "🔄 Document reprocessing needs to be triggered manually"
echo "   Use the reprocessing script or API calls"

echo "✅ Index recreation setup completed!"
echo "📋 Next steps:"
echo "   1. Update Lambda environment variables"
echo "   2. Run document reprocessing"
echo "   3. Verify search functionality"
echo "   4. Switch aliases if using them"
echo "   5. Delete old index after verification"
```

## 🧪 検証手順

### 1. インデックス設定の確認
```bash
# 新しいインデックスの設定確認
curl -X GET "https://<opensearch-endpoint>/rag-documents-<env>/_mapping" | jq '.["rag-documents-<env>"].mappings.properties.embedding'

# 期待される出力:
# {
#   "type": "knn_vector",
#   "dimension": 1536,
#   "method": {
#     "name": "hnsw",
#     "space_type": "cosinesimilarity",
#     "engine": "nmslib"
#   }
# }
```

### 2. ベクトル検索のテスト
```bash
# テスト用のクエリ実行
curl -X POST "https://<opensearch-endpoint>/rag-documents-<env>/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 5,
    "query": {
      "knn": {
        "embedding": {
          "vector": [0.1, 0.2, ..., /* 1536次元の配列 */],
          "k": 5
        }
      }
    }
  }'
```

### 3. アプリケーションレベルのテスト
```bash
# APIエンドポイントのテスト
curl -X POST "https://your-api-gateway-endpoint/dev/query" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "テストクエリ",
    "max_results": 5
  }'
```

## 🔄 ロールバック手順

万が一問題が発生した場合：

```bash
# 1. エイリアスを旧インデックスに戻す
curl -X POST "https://<opensearch-endpoint>/_aliases" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "remove": {
          "index": "rag-documents-<env>-v2",
          "alias": "rag-documents-<env>"
        }
      },
      {
        "add": {
          "index": "rag-documents-<env>-v1",
          "alias": "rag-documents-<env>"
        }
      }
    ]
  }'

# 2. Lambda環境変数を元に戻す
# 3. 新しいインデックスを削除（必要に応じて）
```

## 📈 進捗モニタリング

再処理の進捗を確認するクエリ：

```bash
# ドキュメント数の確認
curl -X GET "https://<opensearch-endpoint>/rag-documents-<env>/_count"

# 最新の処理時刻を確認
curl -X GET "https://<opensearch-endpoint>/rag-documents-<env>/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 1,
    "sort": [
      { "created_at": { "order": "desc" } }
    ],
    "_source": ["document_id", "created_at"]
  }'
```

## 🎯 まとめ

1. **推奨方法**: Option A（ゼロダウンタイム移行）
2. **所要時間**: ドキュメント数に依存（目安：100文書で30-60分）
3. **リスク**: 低（旧インデックスを保持しつつ移行）
4. **検証**: 各ステップで動作確認を実施

インデックス再作成後は、検索精度の大幅な改善が期待できます。