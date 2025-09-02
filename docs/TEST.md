# テスト実行ガイド

## 単体テスト

プロジェクトの全ての単体テストを実行：

```bash
go test ./...
```

## 統合テスト

統合テストは外部リソース（API Gateway、AWS サービス）が必要です。
統合テストのみ実行する場合：

```bash
go test -tags=integration ./tests
```

全テスト（単体テスト + 統合テスト）を実行する場合：

```bash
go test -tags=integration ./...
```

## テスト種類

### 単体テスト
- `./cmd/query/` - クエリ機能の単体テスト
- `./cmd/status/` - ステータス機能の単体テスト
- `./cmd/query/test/` - クエリロジックのモックテスト
- `./internal/models/` - データモデルのテスト
- `./internal/performance/` - パフォーマンステスト
- `./internal/reliability/` - リライアビリティテスト
- `./internal/services/test/` - サービス層のテスト
- `./tests/unit_test.go` - その他の単体テスト
- `./tests/mock_server_test.go` - モックサーバーテスト

### 統合テスト（`integration`タグ必要）
- `./tests/integration_test.go` - E2Eワークフローテスト

## CI/CD での使用方法

### GitHub Actions
```yaml
- name: Run unit tests
  run: go test ./...

- name: Run integration tests
  run: go test -tags=integration ./tests
  env:
    TEST_API_ENDPOINT: ${{ secrets.API_ENDPOINT }}
```

### GitLab CI
```yaml
unit_tests:
  script:
    - go test ./...

integration_tests:
  script:
    - go test -tags=integration ./tests
  variables:
    TEST_API_ENDPOINT: $CI_API_ENDPOINT
```

## 注意事項

- 統合テストは実際のAWSリソースが必要です
- 環境変数 `TEST_API_ENDPOINT` を設定してください
- 統合テストは費用が発生する可能性があります