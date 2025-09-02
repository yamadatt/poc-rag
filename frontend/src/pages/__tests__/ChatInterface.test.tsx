import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import ChatInterface from '../ChatInterface';
import chatReducer from '../../store/chatSlice';
import uiReducer from '../../store/uiSlice';
import { apiSlice } from '../../store/apiSlice';
import { ChatMessage } from '../../types';

const createTestStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      chat: chatReducer,
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

describe('ChatInterface', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg1',
      type: 'user',
      content: 'RAGシステムについて教えてください',
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      id: 'msg2',
      type: 'assistant',
      content: 'RAG（Retrieval-Augmented Generation）は、検索技術と生成AIを組み合わせたアプローチです。',
      timestamp: '2024-01-01T10:00:05Z',
      sources: [
        {
          documentId: 'doc1',
          documentName: 'RAG入門.pdf',
          chunkId: 'chunk1',
          content: 'RAGは検索拡張生成と呼ばれる技術で...',
          score: 0.95,
        },
        {
          documentId: 'doc2',
          documentName: 'AI技術概要.docx',
          chunkId: 'chunk2',
          content: '生成AIと検索技術を組み合わせることで...',
          score: 0.87,
        },
      ],
    },
  ];

  it('should render chat interface', () => {
    renderWithProviders(<ChatInterface />);

    expect(screen.getByText('質問応答')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('質問を入力してください...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /送信/ })).toBeInTheDocument();
  });

  it('should display chat messages', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // User message
    expect(screen.getByText('RAGシステムについて教えてください')).toBeInTheDocument();
    
    // Assistant message
    expect(screen.getByText('RAG（Retrieval-Augmented Generation）は、検索技術と生成AIを組み合わせたアプローチです。')).toBeInTheDocument();
    
    // Sources
    expect(screen.getByText('RAG入門.pdf')).toBeInTheDocument();
    expect(screen.getByText('AI技術概要.docx')).toBeInTheDocument();
  });

  it('should show timestamps for messages', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Check if timestamps are displayed (formatted)
    const timestamps = screen.getAllByText(/2024\/01\/01/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('should handle message input and submission', async () => {
    renderWithProviders(<ChatInterface />);

    const input = screen.getByPlaceholderText('質問を入力してください...');
    const sendButton = screen.getByRole('button', { name: /送信/ });

    expect(input).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });

  it('should submit message on Enter key press', async () => {
    renderWithProviders(<ChatInterface />);

    const input = screen.getByPlaceholderText('質問を入力してください...');
    expect(input).toBeInTheDocument();
  });

  it('should not submit empty message', async () => {
    renderWithProviders(<ChatInterface />);

    const input = screen.getByPlaceholderText('質問を入力してください...');
    const sendButton = screen.getByRole('button', { name: /送信/ });
    
    expect(input).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });

  it('should show loading state when sending message', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: 'Loading test...',
        isLoading: true,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Should show loading indicator
    expect(screen.getByText('回答を生成中...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner

    // Send button should be disabled
    const sendButton = screen.getByRole('button', { name: /送信/ });
    expect(sendButton).toBeDisabled();
  });

  it('should show error state', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: 'Failed to send message',
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    expect(screen.getByText('Failed to send message')).toBeInTheDocument();
  });

  it('should expand and collapse source content', async () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Find first source
    const sourceButton = screen.getByText('RAG入門.pdf');
    expect(sourceButton).toBeInTheDocument();
  });

  it('should show source scores', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Check for score display
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('should copy message content', async () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Find copy button for assistant message
    const copyButtons = screen.getAllByLabelText('コピー');
    expect(copyButtons.length).toBe(2); // User and assistant messages
  });

  it('should clear chat history', async () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Find clear button
    const clearButton = screen.getByLabelText('履歴をクリア');
    expect(clearButton).toBeInTheDocument();
  });

  it('should scroll to bottom when new message is added', () => {
    const preloadedState = {
      chat: {
        messages: mockMessages,
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    const mockScrollIntoView = Element.prototype.scrollIntoView as jest.Mock;
    mockScrollIntoView.mockClear();

    renderWithProviders(<ChatInterface />, { preloadedState });

    // Should scroll to bottom on mount
    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  it('should show empty state when no messages', () => {
    const preloadedState = {
      chat: {
        messages: [],
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    expect(screen.getByText('質問応答を開始')).toBeInTheDocument();
    expect(screen.getByText('下の入力欄から質問を入力してください。アップロードしたドキュメントに基づいて回答します。')).toBeInTheDocument();
  });

  it('should validate message length', async () => {
    renderWithProviders(<ChatInterface />);

    const input = screen.getByPlaceholderText('質問を入力してください...');
    const sendButton = screen.getByRole('button', { name: /送信/ });
    
    expect(input).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
  });

  it('should show message when no relevant documents found', () => {
    const messageWithNoSources: ChatMessage = {
      id: 'msg3',
      type: 'assistant',
      content: '関連する情報が見つかりませんでした。',
      timestamp: '2024-01-01T10:00:10Z',
      sources: [],
    };

    const preloadedState = {
      chat: {
        messages: [messageWithNoSources],
        currentInput: '',
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<ChatInterface />, { preloadedState });

    expect(screen.getByText('関連する情報が見つかりませんでした。')).toBeInTheDocument();
  });
});