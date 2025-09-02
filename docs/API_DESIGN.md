# API 設計書

## 1. API 概要

本システムの API は RESTful 設計に基づき、AWS API Gateway を通じて提供されます。すべてのエンドポイントは JSON 形式でデータを送受信します。

## 2. ベース URL

```
開発環境: https://api-dev.example.com/dev
ステージング環境: https://api-staging.example.com/staging
本番環境: https://api.example.com/prod
```

## 3. 認証

現在の実装では認証は実装されていませんが、将来的に以下の方式を検討：
- API キー認証
- JWT トークン認証
- AWS IAM 認証

## 4. 共通レスポンス形式

### 成功レスポンス

```json
{
  "success": true,
  "data": {
    // レスポンスデータ
  },
  "message": "操作が成功しました"
}
```

### エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {
      // 追加のエラー情報
    }
  }
}
```

## 5. API エンドポイント

### 5.1 ドキュメント管理 API

#### POST /documents/upload
**説明**: ドキュメントをアップロードする

**リクエスト**:
- Content-Type: `multipart/form-data`
- Body:
  - `file`: アップロードファイル（必須）
  - 対応形式: PDF, DOCX, PPTX, TXT
  - 最大サイズ: 10MB

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "document_id": "doc-1234567890abcdef",
    "filename": "sample.pdf",
    "file_size": 1048576,
    "content_type": "application/pdf",
    "uploaded_at": "2024-01-15T10:30:00Z",
    "status": "pending"
  },
  "message": "ドキュメントが正常にアップロードされました"
}
```

**エラーコード**:
- `400`: ファイル形式が不正
- `413`: ファイルサイズが大きすぎる
- `500`: サーバーエラー

---

#### GET /documents
**説明**: アップロード済みドキュメントの一覧を取得

**リクエストパラメータ**:
- `limit` (integer, optional): 取得件数（デフォルト: 20、最大: 100）
- `offset` (integer, optional): オフセット（デフォルト: 0）
- `status` (string, optional): フィルタするステータス (pending/processing/completed/failed)

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "document_id": "doc-1234567890abcdef",
        "filename": "sample.pdf",
        "file_size": 1048576,
        "status": "completed",
        "uploaded_at": "2024-01-15T10:30:00Z",
        "processed_at": "2024-01-15T10:35:00Z",
        "total_chunks": 10,
        "chunks_with_embeddings": 10
      }
    ],
    "total": 25,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### GET /documents/{document_id}/status
**説明**: 特定ドキュメントの処理ステータスを取得

**パスパラメータ**:
- `document_id` (string, required): ドキュメントID

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "document_id": "doc-1234567890abcdef",
    "filename": "sample.pdf",
    "status": "processing",
    "uploaded_at": "2024-01-15T10:30:00Z",
    "progress": {
      "total_chunks": 10,
      "processed_chunks": 7,
      "percentage": 70
    },
    "last_error": null
  }
}
```

**ステータス値**:
- `pending`: アップロード完了、処理待ち
- `processing`: 処理中
- `completed`: 処理完了
- `failed`: 処理失敗

---

#### DELETE /documents/{document_id}
**説明**: ドキュメントを削除

**パスパラメータ**:
- `document_id` (string, required): ドキュメントID

**レスポンス**:
```json
{
  "success": true,
  "message": "ドキュメントが正常に削除されました"
}
```

**エラーコード**:
- `404`: ドキュメントが見つからない
- `500`: 削除処理エラー

---

### 5.2 クエリ API

#### POST /query
**説明**: アップロード済みドキュメントに対して質問を行う

**リクエスト**:
```json
{
  "question": "このドキュメントの主要なトピックは何ですか？",
  "max_results": 5,
  "document_ids": ["doc-123", "doc-456"],  // optional: 特定のドキュメントに限定
  "temperature": 0.7  // optional: 回答の創造性（0.0-1.0）
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "answer": "このドキュメントの主要なトピックは、機械学習における深層学習アーキテクチャの最適化手法についてです。特に、トランスフォーマーモデルの効率化と、計算リソースの削減に焦点を当てています。",
    "sources": [
      {
        "document_id": "doc-1234567890abcdef",
        "chunk_id": "chunk-001",
        "content": "深層学習モデルの最適化において、パラメータの削減は重要な課題です...",
        "score": 0.95,
        "metadata": {
          "filename": "ml_optimization.pdf",
          "page": 15,
          "chunk_index": 3
        }
      }
    ],
    "metadata": {
      "processing_time_ms": 1234,
      "tokens_used": 567,
      "model": "claude-3-sonnet"
    }
  }
}
```

**エラーコード**:
- `400`: 質問が空または不正
- `404`: 指定されたドキュメントが見つからない
- `429`: レート制限超過
- `500`: 処理エラー

---

### 5.3 処理 API（内部使用）

#### POST /process
**説明**: ドキュメント処理を開始（内部Lambda間通信用）

**リクエスト**:
```json
{
  "document_id": "doc-1234567890abcdef",
  "s3_bucket": "rag-documents-bucket",
  "s3_key": "uploads/doc-1234567890abcdef/sample.pdf"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "document_id": "doc-1234567890abcdef",
    "status": "processing_started",
    "estimated_time_seconds": 60
  }
}
```

---

### 5.4 ダッシュボード API

#### GET /dashboard/stats
**説明**: システム統計情報を取得

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "total_documents": 156,
    "total_chunks": 4523,
    "storage_used_bytes": 524288000,
    "queries_today": 234,
    "average_response_time_ms": 1456,
    "status_breakdown": {
      "completed": 150,
      "processing": 3,
      "failed": 3
    },
    "recent_activity": [
      {
        "type": "upload",
        "document_id": "doc-123",
        "filename": "report.pdf",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

## 6. エラーコード一覧

| コード | 説明 | 対処法 |
|--------|------|--------|
| `INVALID_FILE_FORMAT` | サポートされていないファイル形式 | PDF, DOCX, PPTX, TXT のいずれかを使用 |
| `FILE_TOO_LARGE` | ファイルサイズが制限を超過 | 10MB以下のファイルを使用 |
| `DOCUMENT_NOT_FOUND` | 指定されたドキュメントが存在しない | document_id を確認 |
| `PROCESSING_ERROR` | ドキュメント処理中のエラー | ログを確認し、再アップロード |
| `EMBEDDING_ERROR` | 埋め込みベクトル生成エラー | Bedrock の利用制限を確認 |
| `SEARCH_ERROR` | OpenSearch検索エラー | クエリ構文を確認 |
| `RATE_LIMIT_EXCEEDED` | API利用制限超過 | 時間をおいて再試行 |

## 7. レート制限

| エンドポイント | 制限 | 期間 |
|---------------|------|------|
| `/documents/upload` | 10回 | 1分 |
| `/query` | 30回 | 1分 |
| `/documents` | 100回 | 1分 |
| その他 | 1000回 | 1分 |

## 8. ペイロード制限

- リクエストボディ最大サイズ: 10MB
- クエリパラメータ最大長: 2048文字
- レスポンス最大サイズ: 6MB

## 9. CORS設定

```javascript
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
}
```

## 10. API バージョニング

将来的なバージョニング戦略：
- URLパス: `/v1/documents`, `/v2/documents`
- ヘッダー: `X-API-Version: 1.0`
- 後方互換性の維持期間: 6ヶ月

## 11. WebSocket API（将来実装予定）

リアルタイム通信用の WebSocket エンドポイント：

```javascript
// 接続
ws://api.example.com/ws

// メッセージ形式
{
  "action": "subscribe",
  "resource": "document_status",
  "document_id": "doc-123"
}

// 通知
{
  "type": "status_update",
  "document_id": "doc-123",
  "status": "completed",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## 12. SDKサポート

将来的に以下の言語用SDKを提供予定：
- JavaScript/TypeScript
- Python
- Go
- Java

## 13. テスト環境

開発者向けサンドボックス環境：
- URL: `https://sandbox-api.example.com`
- 制限: 1日100リクエストまで
- データ保持: 24時間
- テスト用ドキュメント提供