import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Import components and store
import App from '../../src/App';
import uiReducer from '../../src/store/uiSlice';
import dashboardReducer from '../../src/store/dashboardSlice';
import documentReducer from '../../src/store/documentSlice';
import chatReducer from '../../src/store/chatSlice';
import { apiSlice } from '../../src/store/apiSlice';

// Setup MSW server
const server = setupServer();

// Create test store
const createTestStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      ui: uiReducer,
      dashboard: dashboardReducer,
      documents: documentReducer,
      chat: chatReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState,
  });

const renderWithProviders = (
  component: React.ReactElement,
  { preloadedState = {}, route = '/' } = {}
) => {
  const store = createTestStore(preloadedState);
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          {component}
        </MemoryRouter>
      </Provider>
    ),
    store,
  };
};

describe('Component Integration Tests', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('Dashboard Integration', () => {
    it('should load dashboard data from API and display it', async () => {
      // Mock API responses
      server.use(
        http.get('*/api/stats', () => {
          return HttpResponse.json({
            totalDocuments: 15,
            totalQueries: 89,
            avgResponseTime: 1.25,
            successRate: 96.8,
            storageUsed: 2.3,
            storageLimit: 10.0,
          });
        }),
        http.get('*/api/queries/recent', () => {
          return HttpResponse.json([
            {
              id: 'q1',
              question: 'RAGシステムについて教えて',
              timestamp: '2024-01-10T10:00:00Z',
              responseTime: 1.1,
              resultCount: 5,
            },
          ]);
        }),
        http.get('*/api/documents/recent', () => {
          return HttpResponse.json([
            {
              id: 'doc1',
              fileName: 'テストドキュメント.pdf',
              fileType: 'application/pdf',
              fileSize: 1024000,
              status: 'completed',
              uploadedAt: '2024-01-10T09:00:00Z',
              processedAt: '2024-01-10T09:05:00Z',
            },
          ]);
        })
      );

      renderWithProviders(<App />, { route: '/' });

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
      });

      // Verify all dashboard data is displayed
      expect(screen.getByText('89')).toBeInTheDocument();
      expect(screen.getByText('1.25秒')).toBeInTheDocument();
      expect(screen.getByText('96.8%')).toBeInTheDocument();
      expect(screen.getByText('RAGシステムについて教えて')).toBeInTheDocument();
      expect(screen.getByText('テストドキュメント.pdf')).toBeInTheDocument();
    });

    it('should handle dashboard API errors gracefully', async () => {
      server.use(
        http.get('*/api/stats', () => {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<App />, { route: '/' });

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Document Upload Integration', () => {
    it('should complete full document upload workflow', async () => {
      // Mock upload endpoint
      server.use(
        http.post('*/api/documents/upload', () => {
          return HttpResponse.json({
            id: 'upload-123',
            fileName: 'test-document.pdf',
            status: 'processing',
            uploadedAt: new Date().toISOString(),
          }, { status: 201 });
        }),
        http.get('*/api/documents/upload-123/status', () => {
          return HttpResponse.json({
            id: 'upload-123',
            status: 'completed',
            progress: 100,
            processedAt: new Date().toISOString(),
          });
        }),
        http.get('*/api/documents', () => {
          return HttpResponse.json([
            {
              id: 'upload-123',
              fileName: 'test-document.pdf',
              fileType: 'application/pdf',
              fileSize: 1024000,
              status: 'completed',
              uploadedAt: new Date().toISOString(),
              processedAt: new Date().toISOString(),
            },
          ]);
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<App />, { route: '/documents' });

      // Navigate to documents page
      await waitFor(() => {
        expect(screen.getByText('ドキュメント管理')).toBeInTheDocument();
      });

      // Create a mock file
      const file = new File(['test content'], 'test-document.pdf', {
        type: 'application/pdf',
      });

      // Find file input (it should be hidden in the dropzone)
      const fileInput = screen.getByTestId('file-input');
      
      // Upload file
      await user.upload(fileInput, file);

      // Wait for upload completion
      await waitFor(() => {
        expect(screen.getByText('アップロード完了')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify document appears in list
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('完了')).toBeInTheDocument();
    });

    it('should handle upload errors with user feedback', async () => {
      server.use(
        http.post('*/api/documents/upload', () => {
          return HttpResponse.json(
            { error: 'File too large' },
            { status: 400 }
          );
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<App />, { route: '/documents' });

      const file = new File(['large content'], 'large-file.pdf', {
        type: 'application/pdf',
      });

      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, file);

      // Should show error notification
      await waitFor(() => {
        expect(screen.getByText('File too large')).toBeInTheDocument();
      });
    });
  });

  describe('Chat Integration', () => {
    it('should send question and receive response', async () => {
      server.use(
        http.post('*/api/chat', async ({ request }) => {
          const body = await request.json() as any;
          return HttpResponse.json({
            id: 'response-456',
            question: body.question,
            answer: 'これはAIからの詳細な回答です。質問について詳しく説明いたします。',
            sources: [
              {
                id: 'doc1',
                fileName: '参照文書.pdf',
                relevanceScore: 0.95,
                excerpt: '関連するテキストの抜粋...',
              },
            ],
            responseTime: 1.2,
            timestamp: new Date().toISOString(),
          });
        }),
        http.get('*/api/chat/history', () => {
          return HttpResponse.json([]);
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<App />, { route: '/chat' });

      await waitFor(() => {
        expect(screen.getByText('質問応答')).toBeInTheDocument();
      });

      // Type a question
      const questionInput = screen.getByPlaceholderText(/質問を入力/);
      await user.type(questionInput, 'RAGについて教えてください');

      // Submit question
      const submitButton = screen.getByRole('button', { name: /送信|質問を送信/ });
      await user.click(submitButton);

      // Wait for response
      await waitFor(() => {
        expect(screen.getByText('これはAIからの詳細な回答です')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify sources are shown
      expect(screen.getByText('参照ソース')).toBeInTheDocument();
      expect(screen.getByText('参照文書.pdf')).toBeInTheDocument();

      // Verify question appears in history
      expect(screen.getByText('RAGについて教えてください')).toBeInTheDocument();
    });

    it('should handle chat errors gracefully', async () => {
      server.use(
        http.post('*/api/chat', () => {
          return HttpResponse.json(
            { error: 'Service temporarily unavailable' },
            { status: 503 }
          );
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<App />, { route: '/chat' });

      const questionInput = screen.getByPlaceholderText(/質問を入力/);
      await user.type(questionInput, 'テスト質問');

      const submitButton = screen.getByRole('button', { name: /送信|質問を送信/ });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Service temporarily unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Integration', () => {
    it('should navigate between all pages correctly', async () => {
      // Mock all required endpoints
      server.use(
        http.get('*/api/stats', () => HttpResponse.json({
          totalDocuments: 0, totalQueries: 0, avgResponseTime: 0, 
          successRate: 0, storageUsed: 0, storageLimit: 10
        })),
        http.get('*/api/queries/recent', () => HttpResponse.json([])),
        http.get('*/api/documents/recent', () => HttpResponse.json([])),
        http.get('*/api/documents', () => HttpResponse.json([])),
        http.get('*/api/chat/history', () => HttpResponse.json([]))
      );

      const user = userEvent.setup();
      renderWithProviders(<App />);

      // Start at dashboard
      await waitFor(() => {
        expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
      });

      // Navigate to documents
      await user.click(screen.getByText('ドキュメント'));
      await waitFor(() => {
        expect(screen.getByText('ドキュメント管理')).toBeInTheDocument();
      });

      // Navigate to chat
      await user.click(screen.getByText('質問応答'));
      await waitFor(() => {
        expect(screen.getByText('質問応答')).toBeInTheDocument();
      });

      // Navigate back to dashboard
      await user.click(screen.getByText('ダッシュボード'));
      await waitFor(() => {
        expect(screen.getByText('システム概要')).toBeInTheDocument();
      });
    });

    it('should maintain state across navigation', async () => {
      server.use(
        http.get('*/api/**', () => HttpResponse.json({}))
      );

      const user = userEvent.setup();
      const { store } = renderWithProviders(<App />);

      // Toggle theme
      const themeToggle = screen.getByLabelText('テーマ切り替え');
      await user.click(themeToggle);

      // Verify dark theme in store
      expect(store.getState().ui.theme).toBe('dark');

      // Navigate to different page
      await user.click(screen.getByText('ドキュメント'));

      // Theme should persist
      expect(store.getState().ui.theme).toBe('dark');

      // Navigate back
      await user.click(screen.getByText('ダッシュボード'));

      // Theme should still be dark
      expect(store.getState().ui.theme).toBe('dark');
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should update document status in real-time', async () => {
      let statusCallCount = 0;
      const statuses = ['processing', 'processing', 'completed'];

      server.use(
        http.post('*/api/documents/upload', () => {
          return HttpResponse.json({
            id: 'realtime-doc',
            fileName: 'realtime-test.pdf',
            status: 'processing',
            uploadedAt: new Date().toISOString(),
          }, { status: 201 });
        }),
        http.get('*/api/documents/realtime-doc/status', () => {
          const status = statuses[statusCallCount] || 'completed';
          statusCallCount++;
          
          return HttpResponse.json({
            id: 'realtime-doc',
            status,
            progress: statusCallCount * 33,
            processedAt: status === 'completed' ? new Date().toISOString() : null,
          });
        }),
        http.get('*/api/documents', () => {
          return HttpResponse.json([
            {
              id: 'realtime-doc',
              fileName: 'realtime-test.pdf',
              fileType: 'application/pdf',
              fileSize: 1024000,
              status: statuses[Math.min(statusCallCount, statuses.length - 1)],
              uploadedAt: new Date().toISOString(),
              processedAt: statuses[Math.min(statusCallCount, statuses.length - 1)] === 'completed' 
                ? new Date().toISOString() : null,
            },
          ]);
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<App />, { route: '/documents' });

      const file = new File(['test content'], 'realtime-test.pdf', {
        type: 'application/pdf',
      });

      const fileInput = screen.getByTestId('file-input');
      await user.upload(fileInput, file);

      // Should show processing initially
      await waitFor(() => {
        expect(screen.getByText('処理中')).toBeInTheDocument();
      });

      // Wait for completion through polling
      await waitFor(() => {
        expect(screen.getByText('完了')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Verify multiple status checks occurred
      expect(statusCallCount).toBeGreaterThan(1);
    });
  });

  describe('Error Boundary Integration', () => {
    it('should catch and display errors gracefully', async () => {
      const ErrorComponent = () => {
        throw new Error('Test error for error boundary');
      };

      // Mock console.error to avoid error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <Provider store={createTestStore()}>
          <BrowserRouter>
            <ErrorComponent />
          </BrowserRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain focus management across page transitions', async () => {
      server.use(
        http.get('*/api/**', () => HttpResponse.json({}))
      );

      const user = userEvent.setup();
      renderWithProviders(<App />);

      // Use keyboard navigation
      await user.keyboard('{Tab}'); // Focus first interactive element
      await user.keyboard('{Enter}'); // Activate it

      // Focus should be managed properly
      const focusedElement = screen.getByRole('button', { name: /テーマ切り替え/ });
      expect(focusedElement).toHaveFocus();
    });

    it('should announce page changes to screen readers', async () => {
      server.use(
        http.get('*/api/**', () => HttpResponse.json({}))
      );

      const user = userEvent.setup();
      renderWithProviders(<App />);

      await user.click(screen.getByText('ドキュメント'));

      // Page title should be updated for screen readers
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ドキュメント管理');
      });
    });
  });
});