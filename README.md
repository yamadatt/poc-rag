# AWS サーバーレス RAG システム

AWS のサーバーレス技術を活用した RAG（Retrieval-Augmented Generation）システム。ドキュメントをベクトル化して意味的な検索を可能にし、Amazon Bedrock (Claude 3) を使用して回答を生成します。

⚠️ **注意**: 現在、検索精度の改善作業を計画中です。詳細は [plan.md](./plan.md) を参照してください。

## 🚀 主な機能

- **ドキュメント処理**: 
  - ✅ 対応済み: テキストファイル（.txt）、Markdown（.md）
  - ⚠️ 実装済みだが無効化中: PDF、Word（.docx）、PowerPoint（.pptx）
  - ❌ 未実装: Excel（.xlsx）、旧Word（.doc）、旧PowerPoint（.ppt）
- **ベクトル検索**: Amazon OpenSearch Service による KNN 検索（改善予定）
- **LLM 統合**: Amazon Bedrock（Claude 3 Sonnet）を使用した回答生成
- **サーバーレスアーキテクチャ**: AWS Lambda、API Gateway、S3 で構築
- **モダンなフロントエンド**: React + TypeScript + Tailwind CSS
- **埋め込み生成**: Amazon Titan Embeddings V1 を使用（1536次元）
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
- Amazon Bedrock（Claude 3 Sonnet、Titan Embeddings V1）
- Amazon OpenSearch Service（KNNプラグイン有効）
- AWS Lambda
- Amazon API Gateway
- Amazon S3
- AWS CloudFormation
- AWS IAM

## 🏗️ システムアーキテクチャ

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   React     │───▶│ API Gateway  │───▶│ Upload Lambda   │
│  Frontend   │    └──────────────┘    └─────────────────┘
└─────────────┘            │                    │
                           │                    ▼
                           │           ┌─────────────────┐
                           │           │   S3 Bucket     │
                           │           │  (Documents)    │
                           │           └─────────────────┘
                           │                    │
                           │                    ▼
                           │           ┌─────────────────┐
                           │           │ Process Lambda  │
                           │           └─────────────────┘
                           │                    │
                           │                    ▼
                           │           ┌─────────────────┐
                           │           │ Bedrock (Titan) │
                           │           │   Embeddings    │
                           │           └─────────────────┘
                           │                    │
                           │                    ▼
                           │           ┌─────────────────┐
                           └──────────▶│ Query Lambda    │
                                       └─────────────────┘
                                                │
                                        ┌───────┴────────┐
                                        ▼                ▼
                               ┌─────────────┐  ┌─────────────┐
                               │ OpenSearch  │  │   Bedrock   │
                               │   (KNN)     │  │  (Claude 3) │
                               └─────────────┘  └─────────────┘
```

## 📋 現在の制限事項

### ファイル形式の制限
現在、システムは**テキストファイル（.txt）とMarkdownファイル（.md）のみ**を処理できます。PDF、Word、PowerPointの処理コードは実装されていますが、安全性の観点から無効化されています。

### 検索精度の課題
- **単純なチャンキング**: 文ベースの分割により、コンテキストが失われやすい
- **設定の不整合**: OpenSearchとLambda間で埋め込み次元が異なる（1536 vs 1024）
- **基本的なKNN検索のみ**: ハイブリッド検索や再ランキングが未実装

詳細な改善計画は [plan.md](./plan.md) を参照してください。

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
# テキストファイルのアップロード
curl -X POST \
  https://your-api-endpoint.amazonaws.com/dev/documents \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@document.txt'

# Markdownファイルのアップロード  
curl -X POST \
  https://your-api-endpoint.amazonaws.com/dev/documents \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@document.md'
```

⚠️ **注意**: 現在は .txt と .md ファイルのみ対応しています。

レスポンス：
```json
{
  "document_id": "doc-1234567890",
  "message": "Document uploaded successfully",
  "file_type": "text/plain"
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
  "filename": "document.txt",
  "status": "completed",
  "uploaded_at": "2023-12-01T10:00:00Z",
  "processed_at": "2023-12-01T10:05:00Z",
  "total_chunks": 5,
  "chunks_with_embeddings": 5,
  "embedding_dimension": 1536,
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
  ],
  "search_method": "knn_vector",
  "model_used": "anthropic.claude-3-sonnet-20240229-v1:0"
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
  
  OpenSearchInstanceType:
    Type: String
    Default: t3.small.search  # 開発環境
    # prod では m6g.medium.search を推奨
```

### 技術仕様
- **Lambda メモリ**: 
  - Upload/Query: 512MB
  - Process: 1024MB（埋め込み生成のため）
- **OpenSearch インスタンス**: 
  - 開発: t3.small.search
  - 本番: m6g.medium.search 推奨
- **埋め込みモデル**: 
  - Amazon Titan Embeddings V1（1536次元）
  - チャンクサイズ: 1000文字（改善予定）
- **LLMモデル**: 
  - Claude 3 Sonnet (anthropic.claude-3-sonnet-20240229-v1:0)
  - 最大トークン: 4096
- **ベクトル検索設定**:
  - アルゴリズム: HNSW (Hierarchical Navigable Small World)
  - 距離関数: コサイン類似度
  - k値: デフォルト5（最大20）

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

- **IAM ロール**: 最小権限の原則に基づく設定
- **API Gateway**: CORS設定済み
- **データ暗号化**: S3での保存時暗号化
- **VPC設定**: OpenSearchはVPC内に配置可能

## 🐛 既知の問題

1. **ファイル形式の制限**: PDF、Word、PowerPointのコードは存在するが無効化中
2. **埋め込み次元の不整合**: サービス間で1536と1024が混在
3. **検索精度**: 基本的なKNN検索のみで精度が低い
4. **チャンキング**: 単純な文字数分割でコンテキストが失われる

これらの問題の詳細と改善計画は [plan.md](./plan.md) を参照してください。

## 🚀 今後の改善予定

### 短期（1-2週間）
- [ ] OpenSearch設定の統一（埋め込み次元の修正）
- [ ] PDF、Word、PowerPointのサポート有効化
- [ ] 基本的なチャンキング改善

### 中期（1ヶ月）
- [ ] ハイブリッド検索（ベクトル + キーワード）の実装
- [ ] チャンクオーバーラップの追加
- [ ] クエリ拡張機能

### 長期（2-3ヶ月）
- [ ] 再ランキング機能の実装
- [ ] セマンティックチャンキング
- [ ] A/Bテストフレームワーク

## 🤝 コントリビューション

プルリクエストを歓迎します。大きな変更の場合は、まず issue を開いて変更内容を議論してください。

## 📝 ライセンス

[MIT](https://choosealicense.com/licenses/mit/)

## 👥 作者

- [@your-github-username](https://github.com/your-github-username)

## 📚 関連ドキュメント

- [改善計画書](./plan.md) - 検索精度向上のための詳細な改善計画
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [OpenSearch k-NN Documentation](https://opensearch.org/docs/latest/search-plugins/knn/)

## 🙏 謝辞

- AWS サーバーレスチーム
- OpenSearch プロジェクト
- Anthropic Claude チーム