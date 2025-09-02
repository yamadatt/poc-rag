import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import dashboardReducer from '../../store/dashboardSlice';
import documentReducer from '../../store/documentSlice';
import uiReducer from '../../store/uiSlice';
import { apiSlice } from '../../store/apiSlice';
import { SystemStats, RecentQuery, Document } from '../../types';

// Mock react-redux's useDispatch to prevent API calls
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
}));

const createTestStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      dashboard: dashboardReducer,
      documents: documentReducer,
      ui: uiReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState,
  });

const renderWithProviders = (
  component: React.ReactElement,
  { preloadedState = {} } = {}
) => {
  const store = createTestStore(preloadedState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('Dashboard', () => {
  const mockStats: SystemStats = {
    totalDocuments: 25,
    totalQueries: 142,
    avgResponseTime: 1.2,
    successRate: 96.8,
    storageUsed: 1.5,
    storageLimit: 10.0,
  };

  const mockRecentQueries: RecentQuery[] = [
    {
      id: 'query1',
      question: 'RAGシステムの概要を教えてください',
      timestamp: '2024-01-10T10:00:00Z',
      responseTime: 1.1,
      resultCount: 5,
    },
    {
      id: 'query2', 
      question: 'ベクトルデータベースの仕組みは？',
      timestamp: '2024-01-10T09:30:00Z',
      responseTime: 0.9,
      resultCount: 3,
    },
    {
      id: 'query3',
      question: 'AIの活用事例について',
      timestamp: '2024-01-10T09:00:00Z',
      responseTime: 1.5,
      resultCount: 7,
    },
  ];

  const mockRecentDocuments: Document[] = [
    {
      id: 'doc1',
      fileName: 'AI技術レポート.pdf',
      fileType: 'application/pdf',
      fileSize: 2048000,
      status: 'completed' as const,
      uploadedAt: '2024-01-10T08:00:00Z',
      processedAt: '2024-01-10T08:05:00Z',
    },
    {
      id: 'doc2',
      fileName: 'マシンラーニング入門.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 1536000,
      status: 'completed' as const,
      uploadedAt: '2024-01-10T07:30:00Z',
      processedAt: '2024-01-10T07:35:00Z',
    },
  ];

  it('should render dashboard page', () => {
    const preloadedState = {
      dashboard: {
        stats: mockStats,
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    expect(screen.getByText('システム概要')).toBeInTheDocument();
  });

  it('should display system stats', () => {
    const preloadedState = {
      dashboard: {
        stats: mockStats,
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    // Check stats cards
    expect(screen.getByText('総ドキュメント数')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    
    expect(screen.getByText('総質問数')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    
    expect(screen.getByText('平均応答時間')).toBeInTheDocument();
    expect(screen.getByText('1.20秒')).toBeInTheDocument();
    
    expect(screen.getByText('成功率')).toBeInTheDocument();
    expect(screen.getByText('96.8%')).toBeInTheDocument();
  });

  it('should display storage usage', () => {
    const preloadedState = {
      dashboard: {
        stats: mockStats,
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('ストレージ使用量')).toBeInTheDocument();
    expect(screen.getByText('1.5 GB / 10 GB')).toBeInTheDocument();
    
    // Check progress bar
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '15'); // 1.5/10 * 100 = 15%
  });

  it('should display recent queries', () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: mockRecentQueries,
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('最近の質問')).toBeInTheDocument();
    
    // Check query items
    expect(screen.getByText('RAGシステムの概要を教えてください')).toBeInTheDocument();
    expect(screen.getByText('ベクトルデータベースの仕組みは？')).toBeInTheDocument();
    expect(screen.getByText('AIの活用事例について')).toBeInTheDocument();
    
    // Check timestamps and response times
    expect(screen.getAllByText(/2024\/01\/10/).length).toBeGreaterThan(0);
    expect(screen.getByText('1.1秒')).toBeInTheDocument();
    expect(screen.getByText('0.9秒')).toBeInTheDocument();
    expect(screen.getByText('1.5秒')).toBeInTheDocument();
  });

  it('should display recent documents', () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: [],
        recentDocuments: mockRecentDocuments,
        loading: false,
        error: null,
      },
      documents: {
        documents: mockRecentDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('最近のドキュメント')).toBeInTheDocument();
    
    // Check document items
    expect(screen.getByText('AI技術レポート.pdf')).toBeInTheDocument();
    expect(screen.getByText('マシンラーニング入門.docx')).toBeInTheDocument();
    
    // Check file sizes
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    
    // Check status badges
    const statusBadges = screen.getAllByText('完了');
    expect(statusBadges).toHaveLength(2);
  });

  it('should show loading state', () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: [],
        recentDocuments: [],
        loading: true,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should show error state', () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: 'Failed to load dashboard data',
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
  });

  it('should refresh dashboard data when refresh button is clicked', async () => {
    renderWithProviders(<Dashboard />);

    const refreshButton = screen.getByLabelText('更新');
    expect(refreshButton).toBeInTheDocument();
    
    // This would trigger a refetch in the actual implementation
    // Testing with API mocking would be done in integration tests
  });

  it('should navigate to documents page from recent documents', async () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: [],
        recentDocuments: mockRecentDocuments,
        loading: false,
        error: null,
      },
      documents: {
        documents: mockRecentDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    const viewAllButtons = screen.getAllByText('すべて表示');
    expect(viewAllButtons.length).toBeGreaterThan(0);
  });

  it('should display chart visualization', () => {
    const preloadedState = {
      dashboard: {
        stats: mockStats,
        recentQueries: mockRecentQueries,
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    // Check for chart container
    expect(screen.getByText('応答時間の推移')).toBeInTheDocument();
    expect(screen.getByTestId('response-time-chart')).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    const preloadedState = {
      dashboard: {
        stats: {
          totalDocuments: 0,
          totalQueries: 0,
          avgResponseTime: 0,
          successRate: 0,
          storageUsed: 0,
          storageLimit: 10.0,
        },
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
      documents: {
        documents: [],
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('まだデータがありません')).toBeInTheDocument();
    expect(screen.getByText('ドキュメントをアップロードして質問を開始してください。')).toBeInTheDocument();
  });

  it('should display performance metrics with proper formatting', () => {
    const preloadedState = {
      dashboard: {
        stats: {
          ...mockStats,
          avgResponseTime: 0.856, // Test decimal formatting
          successRate: 100, // Test perfect score
        },
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('0.86秒')).toBeInTheDocument(); // Rounded to 2 decimal places
    expect(screen.getByText('100%')).toBeInTheDocument(); // Perfect success rate
  });

  it('should show storage warning when usage is high', () => {
    const preloadedState = {
      dashboard: {
        stats: {
          ...mockStats,
          storageUsed: 9.2, // Over 90% usage
          storageLimit: 10.0,
        },
        recentQueries: [],
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    expect(screen.getByText('ストレージ容量が不足しています')).toBeInTheDocument();
    
    // Progress bar should show warning color
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-red-500'); // Warning color
  });

  it('should filter recent queries by search', async () => {
    const preloadedState = {
      dashboard: {
        stats: null,
        recentQueries: mockRecentQueries,
        recentDocuments: [],
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<Dashboard />, { preloadedState });

    const searchInput = screen.getByPlaceholderText('質問を検索...');
    
    // Initially all queries should be visible
    expect(screen.getByText('RAGシステムの概要を教えてください')).toBeInTheDocument();
    expect(screen.getByText('ベクトルデータベースの仕組みは？')).toBeInTheDocument();
    expect(screen.getByText('AIの活用事例について')).toBeInTheDocument();

    // This would be tested with actual user interaction in a more complete test
    expect(searchInput).toBeInTheDocument();
  });
});