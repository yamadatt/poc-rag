# フロントエンドアーキテクチャ設計書

## 1. 技術スタック

### 1.1 コア技術
- **フレームワーク**: React 18.3
- **言語**: TypeScript 5.6
- **ビルドツール**: Vite 7.1
- **スタイリング**: Tailwind CSS 3.4
- **状態管理**: Redux Toolkit 2.5
- **ルーティング**: React Router 7.0
- **HTTPクライアント**: Axios 1.7

### 1.2 開発ツール
- **リンター**: ESLint 9.17
- **フォーマッター**: Prettier 3.4
- **テストフレームワーク**: 
  - Jest 29.7（ユニットテスト）
  - React Testing Library 16.1
  - Playwright 1.49（E2Eテスト）

## 2. ディレクトリ構造

```
frontend/
├── src/
│   ├── components/          # 再利用可能なUIコンポーネント
│   │   ├── ErrorBoundary.tsx
│   │   ├── FileUploader.tsx
│   │   ├── Layout.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Modal.tsx
│   │   ├── Navigation.tsx
│   │   ├── Notification.tsx
│   │   └── __tests__/
│   │
│   ├── pages/               # ページコンポーネント
│   │   ├── ChatInterface.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DocumentManager.tsx
│   │   └── __tests__/
│   │
│   ├── services/            # API通信サービス
│   │   ├── api.ts          # APIクライアント
│   │   └── __tests__/
│   │
│   ├── store/              # Redux Store
│   │   ├── index.ts
│   │   ├── apiSlice.ts
│   │   ├── chatSlice.ts
│   │   ├── dashboardSlice.ts
│   │   ├── documentSlice.ts
│   │   ├── uiSlice.ts
│   │   └── __tests__/
│   │
│   ├── types/              # TypeScript型定義
│   │   ├── api.ts
│   │   ├── chat.ts
│   │   ├── dashboard.ts
│   │   ├── document.ts
│   │   ├── index.ts
│   │   └── ui.ts
│   │
│   ├── utils/              # ユーティリティ関数
│   │   ├── api.ts
│   │   ├── errorHandler.ts
│   │   ├── formatters.ts
│   │   ├── helpers.ts
│   │   └── validation.ts
│   │
│   ├── App.tsx            # ルートコンポーネント
│   ├── main.tsx           # エントリーポイント
│   └── index.css          # グローバルスタイル
│
├── tests/                  # テストファイル
│   ├── e2e/               # E2Eテスト
│   └── integration/       # 統合テスト
│
├── public/                # 静的ファイル
├── package.json          # 依存関係
├── tsconfig.json         # TypeScript設定
├── vite.config.ts        # Vite設定
└── tailwind.config.js    # Tailwind設定
```

## 3. コンポーネント設計

### 3.1 コンポーネント階層

```
App
├── Layout
│   ├── Navigation
│   └── NotificationContainer
│
├── Routes
│   ├── Dashboard
│   │   ├── StatsCard
│   │   ├── ActivityFeed
│   │   └── SystemHealth
│   │
│   ├── DocumentManager
│   │   ├── FileUploader
│   │   ├── DocumentList
│   │   │   └── DocumentItem
│   │   └── DocumentDetail
│   │
│   └── ChatInterface
│       ├── MessageList
│       │   ├── UserMessage
│       │   └── AssistantMessage
│       │       └── SourceReference
│       ├── InputArea
│       └── CopyButton
│
└── ErrorBoundary
```

### 3.2 コンポーネント設計原則

```typescript
// 1. 関数コンポーネント + Hooks
const Component: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<StateType>(initialState);
  
  useEffect(() => {
    // 副作用処理
  }, [dependencies]);
  
  return <div>{/* JSX */}</div>;
};

// 2. カスタムフックによるロジック分離
const useDocumentUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const upload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await apiClient.uploadDocument(file);
      return result;
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsUploading(false);
    }
  };
  
  return { upload, isUploading, error };
};

// 3. Props型定義
interface ComponentProps {
  required: string;
  optional?: number;
  children?: React.ReactNode;
  onEvent?: (data: EventData) => void;
}
```

## 4. 状態管理

### 4.1 Redux Store構造

```typescript
interface RootState {
  // API通信状態
  api: {
    loading: Record<string, boolean>;
    errors: Record<string, Error | null>;
  };
  
  // チャット状態
  chat: {
    messages: Message[];
    isLoading: boolean;
    currentInput: string;
  };
  
  // ドキュメント管理
  documents: {
    list: Document[];
    selected: Document | null;
    uploadProgress: number;
    filters: DocumentFilters;
  };
  
  // ダッシュボード
  dashboard: {
    stats: SystemStats | null;
    activities: Activity[];
    lastUpdated: string;
  };
  
  // UI状態
  ui: {
    notifications: Notification[];
    modals: ModalState;
    theme: 'light' | 'dark';
  };
}
```

### 4.2 Slice設計パターン

```typescript
const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    // 同期アクション
    setDocuments: (state, action) => {
      state.list = action.payload;
    },
    selectDocument: (state, action) => {
      state.selected = action.payload;
    },
  },
  extraReducers: (builder) => {
    // 非同期アクション
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
```

## 5. API通信設計

### 5.1 APIクライアント

```typescript
class ApiClient {
  private axiosInstance: AxiosInstance;
  
  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // リクエストインターセプター
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // トークン付与など
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // レスポンスインターセプター
    this.axiosInstance.interceptors.response.use(
      (response) => response.data,
      (error) => {
        // エラーハンドリング
        return Promise.reject(this.handleError(error));
      }
    );
  }
  
  // API メソッド
  async uploadDocument(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.axiosInstance.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  
  async queryDocuments(question: string): Promise<QueryResponse> {
    return this.axiosInstance.post('/query', { question });
  }
}
```

### 5.2 エラーハンドリング

```typescript
// エラー型定義
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// グローバルエラーハンドラー
const handleApiError = (error: ApiError): void => {
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      showNotification('リクエスト制限に達しました', 'warning');
      break;
    case 'NETWORK_ERROR':
      showNotification('ネットワークエラーが発生しました', 'error');
      break;
    default:
      showNotification(error.message, 'error');
  }
};
```

## 6. パフォーマンス最適化

### 6.1 React最適化

```typescript
// 1. メモ化
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => 
    heavyProcessing(data), [data]
  );
  
  const handleClick = useCallback(() => {
    // イベントハンドラー
  }, [dependencies]);
  
  return <div>{/* JSX */}</div>;
});

// 2. 遅延ロード
const LazyComponent = lazy(() => import('./HeavyComponent'));

// 3. 仮想スクロール
const VirtualList = ({ items }) => {
  return (
    <VirtualScroller
      items={items}
      itemHeight={50}
      renderItem={(item) => <ItemComponent {...item} />}
    />
  );
};
```

### 6.2 バンドル最適化

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'redux'],
          'ui': ['@heroicons/react', 'tailwindcss'],
        },
      },
    },
    // ビルドサイズ分析
    chunkSizeWarningLimit: 500,
  },
  // 圧縮設定
  plugins: [
    compression({
      algorithm: 'gzip',
      threshold: 10240,
    }),
  ],
});
```

## 7. テスト戦略

### 7.1 ユニットテスト

```typescript
// コンポーネントテスト
describe('FileUploader', () => {
  it('should handle file upload', async () => {
    const onUpload = jest.fn();
    const { getByLabelText } = render(
      <FileUploader onUpload={onUpload} />
    );
    
    const file = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });
    
    const input = getByLabelText('ファイルを選択');
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file);
    });
  });
});

// Reduxテスト
describe('documentSlice', () => {
  it('should handle document fetch', () => {
    const initialState = { list: [], loading: false };
    const action = { type: 'documents/setDocuments', payload: [doc1] };
    
    const newState = documentReducer(initialState, action);
    expect(newState.list).toHaveLength(1);
  });
});
```

### 7.2 E2Eテスト

```typescript
// Playwright E2Eテスト
test('完全な質問応答フロー', async ({ page }) => {
  // 1. ページ訪問
  await page.goto('/');
  
  // 2. ドキュメントアップロード
  await page.click('text=ドキュメント管理');
  await page.setInputFiles('input[type="file"]', 'test.pdf');
  await expect(page.locator('.upload-success')).toBeVisible();
  
  // 3. チャットで質問
  await page.click('text=チャット');
  await page.fill('textarea', '主要なトピックは？');
  await page.press('textarea', 'Enter');
  
  // 4. 回答確認
  await expect(page.locator('.assistant-message')).toContainText('トピック');
});
```

## 8. セキュリティ対策

### 8.1 XSS対策

```typescript
// DOMPurifyによるサニタイズ
import DOMPurify from 'dompurify';

const SafeHTML: React.FC<{ html: string }> = ({ html }) => {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
};
```

### 8.2 CSP設定

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://api.example.com;">
```

## 9. アクセシビリティ

### 9.1 ARIA属性

```tsx
const AccessibleButton: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  disabled 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled}
      role="button"
      tabIndex={0}
    >
      {label}
    </button>
  );
};
```

### 9.2 キーボードナビゲーション

```typescript
const KeyboardNav: React.FC = () => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeModal();
          break;
        case 'Enter':
          if (e.ctrlKey) submitForm();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
};
```

## 10. デプロイメント

### 10.1 ビルド設定

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production",
    "preview": "vite preview",
    "test": "jest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write src/**/*.{ts,tsx}"
  }
}
```

### 10.2 環境設定

```typescript
// 環境変数
const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  WS_URL: import.meta.env.VITE_WS_URL,
  MAX_FILE_SIZE: import.meta.env.VITE_MAX_FILE_SIZE || 10485760,
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
};
```

## 11. モニタリング

### 11.1 エラートラッキング

```typescript
// Sentry統合
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1,
});
```

### 11.2 パフォーマンス計測

```typescript
// Web Vitals計測
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const reportWebVitals = (metric: Metric) => {
  // Google Analytics送信
  gtag('event', metric.name, {
    value: Math.round(metric.value),
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
  });
};
```