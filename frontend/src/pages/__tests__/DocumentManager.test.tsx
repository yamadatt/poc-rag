import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import DocumentManager from '../DocumentManager';
import documentReducer from '../../store/documentSlice';
import uiReducer from '../../store/uiSlice';
import { apiSlice } from '../../store/apiSlice';

// Mock components
jest.mock('../../components/FileUploader', () => {
  return function MockFileUploader({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
    return (
      <div data-testid="file-uploader">
        <button onClick={() => onFilesSelected([new File(['content'], 'test.pdf')])}>
          Upload File
        </button>
      </div>
    );
  };
});

const createTestStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      documents: documentReducer,
      ui: uiReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['documents/addToUploadQueue'],
          ignoredActionPaths: ['payload.file'],
          ignoredPaths: ['documents.uploadQueue'],
        },
      }).concat(apiSlice.middleware),
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

describe('DocumentManager', () => {
  const mockDocuments = [
    {
      id: 'doc1',
      fileName: 'document1.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      status: 'completed' as const,
      uploadedAt: '2024-01-01T00:00:00Z',
      processedAt: '2024-01-01T00:05:00Z',
    },
    {
      id: 'doc2',
      fileName: 'document2.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 2048000,
      status: 'processing' as const,
      uploadedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'doc3',
      fileName: 'document3.txt',
      fileType: 'text/plain',
      fileSize: 512000,
      status: 'failed' as const,
      uploadedAt: '2024-01-03T00:00:00Z',
    },
  ];

  it('should render document manager page', () => {
    renderWithProviders(<DocumentManager />);

    expect(screen.getByText('ドキュメント管理')).toBeInTheDocument();
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
  });

  it('should display documents in table format', () => {
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Check table headers
    expect(screen.getByText('ファイル名')).toBeInTheDocument();
    expect(screen.getByText('タイプ')).toBeInTheDocument();
    expect(screen.getByText('サイズ')).toBeInTheDocument();
    expect(screen.getByText('ステータス')).toBeInTheDocument();
    expect(screen.getByText('アップロード日時')).toBeInTheDocument();
    expect(screen.getByText('アクション')).toBeInTheDocument();

    // Check document rows
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.getByText('document2.docx')).toBeInTheDocument();
    expect(screen.getByText('document3.txt')).toBeInTheDocument();

    // Check file sizes
    expect(screen.getByText('1000 KB')).toBeInTheDocument();
    expect(screen.getByText('2000 KB')).toBeInTheDocument();
    expect(screen.getByText('500 KB')).toBeInTheDocument();

    // Check statuses
    expect(screen.getByText('完了')).toBeInTheDocument();
    expect(screen.getByText('処理中')).toBeInTheDocument();
    expect(screen.getByText('失敗')).toBeInTheDocument();
  });

  it('should filter documents by status', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Initially all documents should be visible
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.getByText('document2.docx')).toBeInTheDocument();
    expect(screen.getByText('document3.txt')).toBeInTheDocument();

    // Filter by completed status
    const statusFilter = screen.getByDisplayValue('all');
    await user.selectOptions(statusFilter, 'completed');

    // Only completed document should be visible
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('document2.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('document3.txt')).not.toBeInTheDocument();
  });

  it('should filter documents by search query', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    const searchInput = screen.getByPlaceholderText('ファイル名で検索...');
    await user.type(searchInput, 'document1');

    // Only matching document should be visible
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('document2.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('document3.txt')).not.toBeInTheDocument();
  });

  it('should sort documents by different columns', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Click on file size header to sort
    const sizeHeader = screen.getByText('サイズ');
    await user.click(sizeHeader);

    // Documents should be reordered by size
    const rows = screen.getAllByRole('row');
    // First row is header, so check data rows
    expect(rows[1]).toHaveTextContent('document3.txt'); // smallest file
    expect(rows[3]).toHaveTextContent('document2.docx'); // largest file
  });

  it('should handle document selection', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Select first document
    const checkbox = screen.getAllByRole('checkbox')[1]; // First is select all
    await user.click(checkbox);

    expect(checkbox).toBeChecked();

    // Bulk actions should be visible
    expect(screen.getByText('選択したアイテムを削除')).toBeInTheDocument();
  });

  it('should handle select all documents', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Click select all checkbox
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    await user.click(selectAllCheckbox);

    // All document checkboxes should be checked
    const documentCheckboxes = screen.getAllByRole('checkbox').slice(1);
    documentCheckboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });

    // Bulk actions should show count
    expect(screen.getByText('選択したアイテムを削除 (3)')).toBeInTheDocument();
  });

  it('should show delete confirmation modal', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      documents: {
        documents: mockDocuments,
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    // Click delete button for first document
    const deleteButtons = screen.getAllByLabelText('削除');
    await user.click(deleteButtons[0]);

    // Confirmation modal should appear
    expect(screen.getByText('ドキュメントの削除')).toBeInTheDocument();
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
    expect(screen.getByText('削除')).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentManager />);

    // Click upload button from mocked FileUploader
    const uploadButton = screen.getByText('Upload File');
    await user.click(uploadButton);

    // Upload should trigger state updates
    // This would be tested with actual API calls in integration tests
  });

  it('should show loading state', () => {
    const preloadedState = {
      documents: {
        documents: [],
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: true,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should show error state', () => {
    const preloadedState = {
      documents: {
        documents: [],
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: 'Failed to load documents',
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
  });

  it('should show empty state when no documents', () => {
    const preloadedState = {
      documents: {
        documents: [],
        uploadQueue: [],
        selectedDocuments: [],
        filters: {},
        loading: false,
        error: null,
      },
    };

    renderWithProviders(<DocumentManager />, { preloadedState });

    expect(screen.getByText('アップロードされたドキュメントがありません')).toBeInTheDocument();
    expect(screen.getByText('上記のアップロード機能を使用して、最初のドキュメントをアップロードしてください。')).toBeInTheDocument();
  });

  it('should refresh documents when refresh button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentManager />);

    const refreshButton = screen.getByLabelText('更新');
    await user.click(refreshButton);

    // This would trigger a refetch in the actual implementation
    // Testing with API mocking would be done in integration tests
  });
});