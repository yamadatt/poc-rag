# AWS サーバーレス RAG システム

AWS のサーバーレス技術を活用した本番環境対応の RAG（Retrieval-Augmented Generation）システム。モダンな React フロントエンドと包括的なテストを備えています。

## 🚀 主な機能

- **ドキュメント処理**: PDF、Word（.docx）、PowerPoint（.pptx）、テキストファイルをサポート
- **ベクトル検索**: Amazon OpenSearch Service による意味的類似性検索
- **LLM 統合**: Amazon Bedrock（Claude 3）を使用した回答生成
- **サーバーレスアーキテクチャ**: AWS Lambda、API Gateway、S3 で構築
- **モダンなフロントエンド**: React + TypeScript + Tailwind CSS
- **パフォーマンス最適化**: 並行処理とリトライ機構
- **包括的なテスト**: ユニット、統合、E2E テストを完備
- **本番環境対応**: エラーハンドリング、ロギング、モニタリング機能

## 📁 プロジェクト構成

```
poc-rag/
├── cmd/                      # Lambda 関数ハンドラー
│   ├── delete-document/      # ドキュメント削除
│   ├── list-documents/       # ドキュメント一覧
│   ├── process-document/     # ドキュメント処理
│   ├── query/               # クエリ処理
│   ├── status/              # ステータス確認
│   └── upload/              # アップロード処理
├── frontend/                 # React フロントエンド
│   ├── src/
│   │   ├── components/      # 再利用可能な UI コンポーネント
│   │   ├── pages/          # ページコンポーネント
│   │   ├── services/       # API サービス
│   │   ├── store/          # Redux ストア
│   │   └── types/          # TypeScript 型定義
│   ├── tests/              # フロントエンドテスト
│   └── package.json
├── internal/                 # Go 内部パッケージ
│   ├── bedrock/            # Bedrock クライアント
│   ├── config/             # 設定管理
│   ├── opensearch/         # OpenSearch クライアント
│   ├── s3client/           # S3 操作
│   └── types/              # 共有型定義
├── scripts/                  # デプロイスクリプト
├── tests/                    # バックエンドテスト
├── docs/                     # ドキュメント
├── template.yaml            # SAM テンプレート
└── Makefile                 # ビルドコマンド
```

## 📋 前提条件

- AWS CLI（適切な権限で設定済み）
- AWS SAM CLI
- Go 1.21 以上
- Node.js 18 以上と npm
- Bedrock アクセスが有効な AWS アカウント

### 必要な AWS サービスアクセス
- Amazon Bedrock（Claude 3 Sonnet、Titan Embeddings）
- Amazon OpenSearch Service
- AWS Lambda
- Amazon API Gateway
- Amazon S3
- AWS CloudFormation
- AWS IAM

## 🏗️ システムアーキテクチャ

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  クライアント  │───▶│ API Gateway  │───▶│ Upload Lambda   │
└─────────────┘    └──────────────┘    └─────────────────┘
                            │                    │
                            │                    ▼
                            │           ┌─────────────────┐
                            │           │       S3        │
                            │           └─────────────────┘
                            │                    │
                            │                    ▼
                            │           ┌─────────────────┐
                            │           │ Process Lambda  │
                            │           └─────────────────┘
                            │                    │
                            │                    ▼
                            │           ┌─────────────────┐
                            │           │   Bedrock API   │
                            │           └─────────────────┘
                            │                    │
                            │                    ▼
                            │           ┌─────────────────┐
                            └──────────▶│ Query Lambda    │
                                       └─────────────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │   OpenSearch    │
                                       └─────────────────┘
```

## 🚀 クイックスタート

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd poc-rag
```

### 2. 依存関係のインストール

#### バックエンド
```bash
go mod download
```

#### フロントエンド
```bash
cd frontend
npm install
```

### 3. システムのデプロイ

#### バックエンドのデプロイ
```bash
# デフォルト設定でデプロイ（dev 環境）
./scripts/deploy.sh

# 本番環境へのデプロイ
./scripts/deploy.sh -e prod -r us-west-2

# カスタムスタック名でのデプロイ
./scripts/deploy.sh -s my-rag-system -e staging
```

#### フロントエンドの開発
```bash
cd frontend

# 開発サーバーの起動
npm run dev

# 本番用ビルド
npm run build

# テストの実行
npm test

# E2E テストの実行
npm run test:e2e
```

### 4. デプロイのテスト
デプロイスクリプトは自動的にデプロイ後のテストを実行します。手動でテストすることも可能です：

```bash
# ユニットテスト
go test ./tests/unit_test.go -v

# モックサーバーでの統合テスト
go test ./tests/mock_server_test.go -v

# 完全な統合テスト（デプロイ済みスタックが必要）
export TEST_API_ENDPOINT="<your-api-endpoint>"
go test ./tests/integration_test.go -v
```

## 📖 API の使用方法

### ドキュメントのアップロード
```bash
curl -X POST \
  https://your-api-endpoint.amazonaws.com/dev/documents \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@document.pdf'
```

レスポンス：
```json
{
  "document_id": "doc-1234567890",
  "message": "Document uploaded successfully"
}
```

### ドキュメントステータスの確認
```bash
curl https://your-api-endpoint.amazonaws.com/dev/documents/doc-1234567890/status
```

レスポンス：
```json
{
  "document_id": "doc-1234567890",
  "filename": "document.pdf",
  "status": "completed",
  "uploaded_at": "2023-12-01T10:00:00Z",
  "processed_at": "2023-12-01T10:05:00Z",
  "total_chunks": 5,
  "chunks_with_embeddings": 5,
  "last_error": ""
}
```

### ドキュメントへのクエリ
```bash
curl -X POST \
  https://your-api-endpoint.amazonaws.com/dev/query \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "ドキュメントの主要なトピックは何ですか？",
    "max_results": 5
  }'
```

レスポンス：
```json
{
  "answer": "アップロードされたドキュメントに基づくと、主要なトピックは...",
  "sources": [
    {
      "document_id": "doc-1234567890",
      "chunk_id": "chunk-1",
      "content": "回答を裏付ける関連テキストチャンク...",
      "score": 0.95
    }
  ]
}
```

## 🧪 テスト

このプロジェクトは t.wada のメソドロジーに触発されたテスト駆動開発（TDD）の原則に従っています。

### テスト構造
```
tests/
├── unit_test.go           # 個別コンポーネントのユニットテスト
├── integration_test.go    # エンドツーエンド統合テスト
└── mock_server_test.go    # モック HTTP サーバーでのテスト
```

### テストの実行

```bash
# 全ユニットテストの実行
go test ./tests/unit_test.go -v

# モックサーバーでの統合テスト
go test ./tests/mock_server_test.go -v

# 完全な統合テスト（デプロイ済みシステムが必要）
go test ./tests/integration_test.go -v

# カバレッジ付きテスト
go test ./... -cover

# 高速テストのみ実行
go test ./... -short
```

## 🔧 設定

### 環境変数
- `ENVIRONMENT`: デプロイ環境（dev/staging/prod）
- `AWS_REGION`: デプロイ用 AWS リージョン
- `STACK_NAME`: CloudFormation スタック名
- `S3_BUCKET`: デプロイアーティファクト用 S3 バケット

### SAM パラメータ
`template.yaml` の SAM パラメータでシステムを設定できます：

```yaml
Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
```

### パフォーマンス設定
- **Lambda メモリ**: SAM テンプレートで関数ごとに設定可能
- **OpenSearch インスタンス**: 環境に応じてスケール（dev は t3.small、prod は m6g.medium）
- **並行処理**: 最大 5 つの並行埋め込み生成
- **リトライ設定**: 指数バックオフで 3 回リトライ

## 📊 モニタリングとロギング

### CloudWatch ログ
すべての Lambda 関数は構造化 JSON ロギングで CloudWatch にログを出力：
- リクエスト/レスポンスの詳細
- 処理メトリクス
- コンテキスト付きエラー詳細

### メトリクス
- Lambda 関数の実行時間
- API Gateway のレスポンスタイム
- OpenSearch クエリパフォーマンス
- S3 アップロード/ダウンロード速度

## 🔒 セキュリティ

- **IAM ロール**: 最小権限の原則
- **API キー**: API Gateway での認証
- **データ暗号化**: 保存時と転送時の暗号化
- **VPC 分離**: OpenSearch は VPC 内に配置

## 🤝 コントリビューション

プルリクエストを歓迎します。大きな変更の場合は、まず issue を開いて変更内容を議論してください。

## 📝 ライセンス

[MIT](https://choosealicense.com/licenses/mit/)

## 👥 作者

- [@your-github-username](https://github.com/your-github-username)

## 🙏 謝辞

- AWS サーバーレスチーム
- OpenSearch プロジェクト
- Anthropic Claude チーム