# 設計ドキュメント

このディレクトリには、AWS サーバーレス RAG システムの設計ドキュメントが含まれています。

## ドキュメント一覧

### [ARCHITECTURE.md](./ARCHITECTURE.md)
- システム全体のアーキテクチャ設計
- データフローの詳細
- Lambda 関数の設計パターン
- セキュリティ設計
- パフォーマンス最適化戦略

### [API_DESIGN.md](./API_DESIGN.md)
- RESTful API の設計仕様
- エンドポイント詳細
- リクエスト/レスポンス形式
- エラーハンドリング
- 認証・レート制限

### [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- React フロントエンドの設計
- コンポーネント階層
- 状態管理（Redux）
- パフォーマンス最適化
- テスト戦略

### [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)
- DynamoDB テーブル設計
- S3 ストレージ構造
- OpenSearch インデックス設計
- データ移行・バックアップ戦略
- セキュリティ・モニタリング

## 閲覧順序

初めて本システムを理解する場合は、以下の順序で読むことを推奨します：

1. **ARCHITECTURE.md** - システム全体の概要を把握
2. **DATABASE_DESIGN.md** - データ構造とストレージを理解
3. **API_DESIGN.md** - API 仕様を確認
4. **FRONTEND_ARCHITECTURE.md** - フロントエンドの実装詳細

## 更新ルール

設計ドキュメントは以下のルールに従って更新してください：

- 機能追加時は関連するすべてのドキュメントを更新
- 変更履歴をコミットメッセージに明記
- 重要な設計変更は事前にレビューを実施
- ドキュメントの整合性を定期的に確認

## 関連リソース

- [プロジェクト README](../README.md)
- [API テスト結果](../test-outputs/)
- [デプロイスクリプト](../scripts/)
- [Lambda 関数](../cmd/)
- [フロントエンド](../frontend/)