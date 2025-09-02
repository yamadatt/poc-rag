import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';
import uiReducer from '../../store/uiSlice';
import dashboardReducer from '../../store/dashboardSlice';
import documentReducer from '../../store/documentSlice';
import chatReducer from '../../store/chatSlice';
import { apiSlice } from '../../store/apiSlice';

// Mock useDispatch to prevent API calls
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
}));

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
  { preloadedState = {}, initialRoute = '/' } = {}
) => {
  const store = createTestStore(preloadedState);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {component}
      </MemoryRouter>
    </Provider>
  );
};

describe('Layout', () => {
  it('should render layout with header, sidebar, and content', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    // Check header
    expect(screen.getByText('RAG Web UI')).toBeInTheDocument();
    
    // Check navigation items
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    expect(screen.getByText('ドキュメント')).toBeInTheDocument();
    expect(screen.getByText('質問応答')).toBeInTheDocument();
    
    // Check content
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should toggle sidebar when menu button is clicked', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      ui: {
        currentPage: '/',
        sidebarOpen: true,
        theme: 'light',
        notifications: [],
      },
    };

    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { preloadedState }
    );

    // Sidebar should be visible initially
    const sidebar = screen.getByRole('navigation', { name: /メインナビゲーション/i });
    expect(sidebar).toBeInTheDocument();

    // Click menu button to toggle sidebar
    const menuButton = screen.getByLabelText('メニューを開く');
    await user.click(menuButton);

    // Check if dispatch was called to toggle sidebar
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should highlight active navigation item based on current route', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { initialRoute: '/documents' }
    );

    // Check if Documents nav item is highlighted
    const documentsNavItem = screen.getByRole('link', { name: /ドキュメント/i });
    expect(documentsNavItem).toHaveClass('bg-gray-900');
  });

  it('should display notifications', () => {
    const preloadedState = {
      ui: {
        currentPage: '/',
        sidebarOpen: true,
        theme: 'light',
        notifications: [
          {
            id: '1',
            type: 'success',
            title: 'アップロード成功',
            message: 'ドキュメントがアップロードされました',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };

    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { preloadedState }
    );

    expect(screen.getByText('アップロード成功')).toBeInTheDocument();
    expect(screen.getByText('ドキュメントがアップロードされました')).toBeInTheDocument();
  });

  it('should render children content in main area', () => {
    renderWithProviders(
      <Layout>
        <div data-testid="child-content">
          <h1>Page Title</h1>
          <p>Page content goes here</p>
        </div>
      </Layout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Page Title')).toBeInTheDocument();
    expect(screen.getByText('Page content goes here')).toBeInTheDocument();
  });

  it('should navigate when nav items are clicked', async () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    const documentsLink = screen.getByRole('link', { name: /ドキュメント/i });
    expect(documentsLink).toHaveAttribute('href', '/documents');

    const chatLink = screen.getByRole('link', { name: /質問応答/i });
    expect(chatLink).toHaveAttribute('href', '/chat');

    const dashboardLink = screen.getByRole('link', { name: /ダッシュボード/i });
    expect(dashboardLink).toHaveAttribute('href', '/');
  });

  it('should show user menu in header', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    // Check for user menu button
    const userMenuButton = screen.getByLabelText('ユーザーメニュー');
    expect(userMenuButton).toBeInTheDocument();
  });

  it('should be responsive on mobile', () => {
    // Set viewport to mobile size
    global.innerWidth = 375;
    global.innerHeight = 667;

    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    // Menu button should be visible on mobile
    const menuButton = screen.getByLabelText('メニューを開く');
    expect(menuButton).toBeInTheDocument();
  });

  it('should show breadcrumbs for nested routes', () => {
    renderWithProviders(
      <Layout showBreadcrumbs>
        <div>Test Content</div>
      </Layout>,
      { initialRoute: '/documents/upload' }
    );

    // Check for breadcrumb navigation
    expect(screen.getByText('ホーム')).toBeInTheDocument();
    // Check that we have multiple ドキュメント elements (sidebar + breadcrumb)
    const documentElements = screen.getAllByText('ドキュメント');
    expect(documentElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should display footer with copyright', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('© 2024 RAG Web UI. All rights reserved.')).toBeInTheDocument();
  });

  it('should handle dark mode toggle', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      ui: {
        currentPage: '/',
        sidebarOpen: true,
        theme: 'light',
        notifications: [],
      },
    };

    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { preloadedState }
    );

    // Find theme toggle button
    const themeToggle = screen.getByLabelText('テーマ切り替え');
    await user.click(themeToggle);

    // Check if dispatch was called to toggle theme
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should show loading overlay when specified', () => {
    renderWithProviders(
      <Layout isLoading>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});