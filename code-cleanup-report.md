# 🧹 Go コードクリーンアップ推奨事項

**分析日時**: 2025-09-02  
**対象**: Go バックエンドコード（6,720行）  
**削減目標**: 800-1,200行（12-18%減）

---

## 📊 削減可能なコード分析

### 🔴 最優先削除対象（推定削減: 600-800行）

#### 1. **重複テストファイル（311行削除可能）**
```
cmd/query/main_test.go     - 302行（保持）
cmd/query/test/main_test.go - 311行（🗑️ 削除推奨）
```
**理由**: 同じディレクトリに2つのテストファイルが存在し、内容がほぼ同一

#### 2. **未実装プレースホルダー機能（推定150行削除可能）**

**internal/services/text_extractor.go**
```go
// 🗑️ 削除対象
func (te *TextExtractor) extractFromDOC(content []byte) (string, error) {
    // TODO: Implement DOC text extraction
    return fmt.Sprintf("DOC_CONTENT_PLACEHOLDER_%d_BYTES", len(content)), 
           fmt.Errorf("DOC text extraction not implemented in this demo")
}

func (te *TextExtractor) extractFromPPT(content []byte) (string, error) {
    // TODO: Implement PPT text extraction  
    return fmt.Sprintf("PPT_CONTENT_PLACEHOLDER_%d_BYTES", len(content)), 
           fmt.Errorf("PPT text extraction not implemented in this demo")
}
```

**cmd/process/main.go** での対応する処理
```go
// 🗑️ 削除対象（isSupportedFileType関数で既に無効化されている）
case "application/msword":
    return te.extractFromDOC(content)
case "application/vnd.ms-powerpoint":  
    return te.extractFromPPT(content)
```

#### 3. **モック・デバッグコード（推定200行削除可能）**

**internal/performance/performance.go**
```go
// 🗑️ 削除対象：本番で不要
func mockGenerateEmbedding(text string) ([]float32, error) {
    time.Sleep(100 * time.Millisecond)
    embedding := make([]float32, 1536) 
    for i := range embedding {
        embedding[i] = 0.1 // Mock value
    }
    return embedding, nil
}
```

#### 4. **過剰なデバッグログ（推定100-150行削除可能）**

**cmd/process/main.go** で削除可能なログ
```go
// 🗑️ 本番不要なデバッグログ
fmt.Printf("Searching for document ID: %s in bucket: %s\n", documentID, bucketName)
fmt.Printf("Found %d objects with prefix 'documents/prod/'\n", len(result.Contents))
fmt.Printf("Checking object: %s\n", *item.Key)
fmt.Printf("Metadata for %s:\n", *item.Key)
for k, v := range headResult.Metadata {
    if v != nil {
        fmt.Printf("  %s: %s\n", k, *v)
    }
}
fmt.Printf("Comparing:\n  Searching for: '%s' (len=%d)\n...", ...)
fmt.Printf("Generated embedding for chunk %d (dimension: %d)\n", i, len(response.Embedding))
```

### 🟡 中優先削除対象（推定削減: 200-400行）

#### 5. **office_extractorの簡略化（推定100-150行）**
```go
// internal/services/office_extractor.go
// "For demo purposes" コメント付きの簡易実装を最適化
```

#### 6. **未使用のヘルパー関数（推定50-100行）**

#### 7. **重複エラーハンドリング（推定50-150行）**

### 🟢 低優先最適化（推定削減: 100-200行）

#### 8. **冗長なコメント・空行の整理**
#### 9. **インライン化可能な小関数**
#### 10. **構造体フィールドの最適化**

---

## 🛠️ 具体的なクリーンアップ手順

### Phase 1: 即座に削除可能（30分）

#### 1. 重複テストファイルの削除
```bash
rm cmd/query/test/main_test.go
```
**削減**: 311行

#### 2. 未実装機能の削除
```go
// internal/services/text_extractor.go から削除
- extractFromDOC() 関数
- extractFromPPT() 関数
```

#### 3. 対応するcase文の削除
```go  
// internal/services/text_extractor.go ExtractText()から削除
- case "application/msword":
- case "application/vnd.ms-powerpoint":
```

### Phase 2: デバッグログの整理（1時間）

#### 4. 本番不要なログの削除
```bash
# 削除対象パターン
- fmt.Printf("Searching for...")
- fmt.Printf("Found %d objects...")  
- fmt.Printf("Checking object...")
- fmt.Printf("Metadata for...")
- メタデータ詳細出力のループ
- fmt.Printf("Comparing...")
- fmt.Printf("Generated embedding...")
```

**保持すべきログ**：
```go
✅ fmt.Printf("Processing document: %s (%s)\n", fileName, fileType)
✅ fmt.Printf("Document processed successfully: %s\n", documentID)
✅ エラーログ全般
```

### Phase 3: モック・テストコードの削除（30分）

#### 5. 本番コードからのモック関数削除
```go
// internal/performance/performance.go から削除
- mockGenerateEmbedding()
- mockAPICall() (テストファイルに移動)
```

---

## 📋 クリーンアップスクリプト

### 自動化スクリプト
```bash
#!/bin/bash
echo "🧹 Starting Go code cleanup..."

# 1. 重複テストファイル削除
if [ -f "cmd/query/test/main_test.go" ]; then
    echo "Removing duplicate test file..."
    rm cmd/query/test/main_test.go
    echo "✅ Removed cmd/query/test/main_test.go (311 lines)"
fi

# 2. デバッグログの削除（手動確認推奨）
echo "⚠️  Manual review required for debug logs in:"
echo "   - cmd/process/main.go"
echo "   - cmd/query/main.go" 
echo "   - cmd/dashboard/main.go"

# 3. 未実装機能の削除（手動実施）
echo "⚠️  Manual removal required for unimplemented features in:"
echo "   - internal/services/text_extractor.go"

echo "🎯 Estimated cleanup: 600-800 lines"
echo "📊 Size reduction: 12-18%"
```

---

## 🎯 期待される効果

### コードサイズ削減
| 対象 | 削減行数 | 削減率 |
|------|---------|--------|
| **重複テスト** | 311行 | 4.6% |
| **未実装機能** | 150行 | 2.2% |
| **デバッグログ** | 150行 | 2.2% |
| **モック関数** | 100行 | 1.5% |
| **その他最適化** | 200行 | 3.0% |
| **合計削減** | **911行** | **13.5%** |

### 品質向上効果
- 📈 **可読性向上**: 不要コード除去で本質的な処理が明確化
- 🚀 **ビルド時間短縮**: コード量減少でコンパイル高速化
- 🛡️ **保守性向上**: 技術的負債の削減
- 📊 **テスト効率**: 重複テスト除去で実行時間短縮

---

## ⚠️ 削除時の注意点

### 絶対に削除してはいけないもの
- ✅ **エラーハンドリング**
- ✅ **重要な業務ログ**
- ✅ **設定関連コード**
- ✅ **セキュリティ関連処理**

### 削除前の確認事項
1. **影響範囲の調査**: 関数・変数の参照状況
2. **テストの実行**: 削除後の動作確認
3. **バックアップ**: Git コミット後に実施

### 段階的削除の推奨
```
Phase 1 (リスクなし) → Phase 2 (低リスク) → Phase 3 (要注意)
```

---

## 📈 実施優先度

### 🔴 今すぐ実施（リスクなし）
1. **cmd/query/test/main_test.go** 削除 → **311行削減**
2. **未実装DOC/PPT関数** 削除 → **150行削減**

### 🟡 慎重に実施（1週間以内）
3. **デバッグログ** 整理 → **150行削減**
4. **モック関数** 削除 → **100行削減**

### 🟢 計画的に実施（1ヶ月以内）  
5. **office_extractor** 最適化 → **100-200行削減**

---

## 🏁 まとめ

**即座に実施可能な削減**: **461行（6.9%）**  
**計画的削除での総削減**: **911行（13.5%）**

この削減により、6,720行 → **5,809行** への最適化が可能です。コードの可読性と保守性が向上し、ビルド時間の短縮も期待できます。

**推奨実施順序**:
1. 重複テストファイル削除（即座）
2. 未実装機能削除（即座）  
3. デバッグログ整理（1週間以内）
4. 段階的な最適化（1ヶ月以内）

---
**クリーンアップ計画作成完了**: 2025-09-02