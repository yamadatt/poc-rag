# システムアーキテクチャ設計書

## 1. システム概要

本システムは、AWS のサーバーレステクノロジーを活用した RAG（Retrieval-Augmented Generation）システムです。ドキュメントをアップロードし、その内容に基づいて質問応答を行うことができます。

### 1.1 主要コンポーネント

- **フロントエンド**: React + TypeScript によるSPA
- **バックエンド**: Go言語による AWS Lambda 関数群
- **ストレージ**: Amazon S3（ドキュメント保存）、DynamoDB（メタデータ）
- **検索エンジン**: Amazon OpenSearch（ベクトル検索）
- **AI/ML**: Amazon Bedrock（埋め込み生成、回答生成）

## 2. アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                         クライアント層                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    React フロントエンド                    │  │
│  │  ・チャットインターフェース                                 │  │
│  │  ・ドキュメント管理画面                                    │  │
│  │  ・ダッシュボード                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Gateway                            │
│                    (RESTful API エンドポイント)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Upload       │       │ Query        │       │ Management   │
│ Lambda       │       │ Lambda       │       │ Lambdas      │
│              │       │              │       │ ・Status     │
│ ドキュメント  │       │ 質問応答     │       │ ・Delete     │
│ アップロード  │       │ 処理         │       │ ・Dashboard  │
└──────────────┘       └──────────────┘       └──────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         データ層                                 │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │    S3    │  │   DynamoDB   │  │     OpenSearch         │ │
│  │          │  │              │  │                         │ │
│  │ ドキュメント│  │ メタデータ    │  │ ベクトルインデックス      │ │
│  │ ストレージ │  │ 管理         │  │ ・埋め込みベクトル       │ │
│  └──────────┘  └──────────────┘  │ ・チャンク情報          │ │
│                                   └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      処理 Lambda 層                              │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Document Processing Lambda                 │   │
│  │                                                         │   │
│  │  1. テキスト抽出（PDF/DOCX/PPTX/TXT）                    │   │
│  │  2. チャンク分割（500文字単位）                           │   │
│  │  3. 埋め込み生成（Titan Embeddings）                     │   │
│  │  4. OpenSearch へのインデックス                          │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI/ML 層                                 │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                  Amazon Bedrock                         │   │
│  │                                                         │   │
│  │  ・Titan Embeddings G1 - Text                          │   │
│  │    - テキスト埋め込み生成                                │   │
│  │    - 1536次元のベクトル                                 │   │
│  │                                                         │   │
│  │  ・Claude 3 Sonnet                                     │   │
│  │    - 質問応答生成                                       │   │
│  │    - コンテキスト理解                                   │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 3. データフロー

### 3.1 ドキュメントアップロードフロー

```
1. ユーザーがドキュメントをアップロード
   ↓
2. Upload Lambda が S3 にファイルを保存
   ↓
3. DynamoDB にメタデータを記録
   ↓
4. Processing Lambda をトリガー
   ↓
5. テキスト抽出とチャンク分割
   ↓
6. 各チャンクの埋め込みベクトル生成（Bedrock）
   ↓
7. OpenSearch にインデックス作成
   ↓
8. ステータスを "completed" に更新
```

### 3.2 質問応答フロー

```
1. ユーザーが質問を入力
   ↓
2. Query Lambda が質問を受信
   ↓
3. 質問の埋め込みベクトル生成（Bedrock）
   ↓
4. OpenSearch でベクトル類似検索
   ↓
5. 関連チャンクを取得（上位5件）
   ↓
6. Claude 3 でコンテキストベースの回答生成
   ↓
7. 回答と参照元をユーザーに返却
```

## 4. Lambda 関数設計

### 4.1 関数一覧

| 関数名 | 役割 | トリガー | メモリ | タイムアウト |
|--------|------|----------|--------|--------------|
| DocumentUploadFunction | ファイルアップロード処理 | API Gateway | 512MB | 30秒 |
| DocumentProcessingFunction | ドキュメント処理・インデックス作成 | 直接呼び出し | 1024MB | 300秒 |
| QueryFunction | 質問応答処理 | API Gateway | 512MB | 30秒 |
| DashboardFunction | ダッシュボード情報取得 | API Gateway | 256MB | 10秒 |
| DocumentStatusFunction | ステータス確認 | API Gateway | 256MB | 10秒 |
| DocumentDeleteFunction | ドキュメント削除 | API Gateway | 256MB | 30秒 |

### 4.2 共通設計パターン

```go
// エラーハンドリングパターン
func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    // 1. 入力検証
    if err := validateInput(request); err != nil {
        return utils.ErrorResponse(400, err.Error()), nil
    }
    
    // 2. ビジネスロジック実行
    result, err := processBusinessLogic(ctx, request)
    if err != nil {
        logger.Error("Processing failed", err)
        return utils.ErrorResponse(500, "Internal server error"), nil
    }
    
    // 3. 成功レスポンス
    return utils.SuccessResponse(result), nil
}
```

## 5. データモデル

### 5.1 DynamoDB スキーマ

```yaml
DocumentTable:
  PrimaryKey: document_id (String)
  Attributes:
    - filename: String
    - status: String (pending/processing/completed/failed)
    - uploaded_at: String (ISO 8601)
    - processed_at: String (ISO 8601)
    - file_size: Number
    - total_chunks: Number
    - chunks_with_embeddings: Number
    - last_error: String
    - content_type: String
```

### 5.2 OpenSearch インデックス構造

```json
{
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
          "space_type": "l2",
          "engine": "faiss"
        }
      },
      "metadata": {
        "properties": {
          "filename": { "type": "keyword" },
          "chunk_index": { "type": "integer" },
          "created_at": { "type": "date" }
        }
      }
    }
  }
}
```

## 6. セキュリティ設計

### 6.1 認証・認可

- API Gateway レベルでの CORS 設定
- Lambda 実行ロールによる最小権限の原則
- S3 バケットポリシーによるアクセス制御

### 6.2 データ保護

- S3: サーバーサイド暗号化（SSE-S3）
- DynamoDB: 保存時の暗号化
- OpenSearch: VPC 内配置、保存時・転送時の暗号化
- Lambda: 環境変数の暗号化

### 6.3 ネットワークセキュリティ

```yaml
VPC設定:
  - OpenSearch: プライベートサブネット配置
  - Lambda: VPC接続（OpenSearchアクセス用）
  - セキュリティグループ: 必要最小限のポート開放
```

## 7. パフォーマンス最適化

### 7.1 並行処理

```go
// チャンク埋め込みの並行生成
const maxConcurrent = 5
sem := make(chan struct{}, maxConcurrent)
var wg sync.WaitGroup

for _, chunk := range chunks {
    wg.Add(1)
    sem <- struct{}{}
    go func(c Chunk) {
        defer func() { <-sem; wg.Done() }()
        embedding := generateEmbedding(c)
        storeEmbedding(embedding)
    }(chunk)
}
wg.Wait()
```

### 7.2 キャッシング戦略

- Lambda コンテナの再利用によるコールドスタート削減
- OpenSearch クエリ結果のメモリキャッシュ
- Bedrock API レスポンスの一時キャッシュ

### 7.3 リソース最適化

| コンポーネント | 開発環境 | 本番環境 |
|---------------|----------|----------|
| OpenSearch | t3.small.search | m6g.medium.search |
| Lambda メモリ | 256-512MB | 512-1024MB |
| DynamoDB | オンデマンド | プロビジョンド |

## 8. エラーハンドリング

### 8.1 リトライ戦略

```go
// 指数バックオフによるリトライ
type RetryConfig struct {
    MaxRetries  int
    InitialDelay time.Duration
    MaxDelay    time.Duration
}

func withRetry(fn func() error, config RetryConfig) error {
    delay := config.InitialDelay
    for i := 0; i < config.MaxRetries; i++ {
        if err := fn(); err == nil {
            return nil
        }
        time.Sleep(delay)
        delay = min(delay*2, config.MaxDelay)
    }
    return fmt.Errorf("max retries exceeded")
}
```

### 8.2 エラー分類

| エラータイプ | HTTPステータス | 処理 |
|-------------|---------------|------|
| 検証エラー | 400 | 即座にエラーレスポンス |
| 認証エラー | 401 | 認証情報の確認を促す |
| リソース不足 | 429 | リトライまたはキューイング |
| 内部エラー | 500 | ログ記録、汎用エラーメッセージ |

## 9. モニタリング・ログ

### 9.1 CloudWatch メトリクス

- Lambda 実行時間、エラー率
- API Gateway レスポンスタイム、4xx/5xx エラー
- OpenSearch クエリレイテンシ
- DynamoDB 読み書きキャパシティ

### 9.2 構造化ログ

```go
logger.Info("Processing document",
    "document_id", docID,
    "file_size", fileSize,
    "chunks", chunkCount,
    "duration_ms", elapsed.Milliseconds(),
)
```

## 10. 今後の拡張計画

### 10.1 機能拡張

- マルチテナント対応
- ファイル形式の拡張（Excel、CSV）
- リアルタイムストリーミング回答
- 会話履歴の永続化

### 10.2 スケーラビリティ

- Lambda の予約済み同時実行数設定
- OpenSearch クラスターの自動スケーリング
- DynamoDB のオートスケーリング設定
- CloudFront による静的コンテンツ配信