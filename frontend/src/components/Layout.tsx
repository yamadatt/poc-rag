import React from 'react';
import type { ReactNode } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import type { RootState } from '../store';
import { toggleSidebar, toggleTheme, removeNotification } from '../store/uiSlice';
import LoadingSpinner from './LoadingSpinner';
import Notification from './Notification';

interface LayoutProps {
  children: ReactNode;
  isLoading?: boolean;
  showBreadcrumbs?: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'ダッシュボード', href: '/', icon: HomeIcon },
  { name: 'ドキュメント', href: '/documents', icon: DocumentTextIcon },
  { name: '質問応答', href: '/chat', icon: ChatBubbleLeftRightIcon },
];

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  isLoading = false,
  showBreadcrumbs = false 
}) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { sidebarOpen, theme, notifications } = useSelector(
    (state: RootState) => state.ui
  );

  const handleSidebarToggle = () => {
    dispatch(toggleSidebar());
  };

  const handleThemeToggle = () => {
    dispatch(toggleTheme());
  };

  const handleNotificationClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'ホーム', href: '/' }];
    
    if (paths.length > 0) {
      if (paths[0] === 'documents') {
        breadcrumbs.push({ name: 'ドキュメント', href: '/documents' });
      } else if (paths[0] === 'chat') {
        breadcrumbs.push({ name: '質問応答', href: '/chat' });
      }
    }
    
    return breadcrumbs;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
        >
          <nav 
            className="flex flex-col h-full"
            aria-label="メインナビゲーション"
          >
            <div className="flex items-center justify-between h-16 px-4 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">RAG Web UI</h2>
              <button
                onClick={handleSidebarToggle}
                className="text-gray-400 hover:text-white lg:hidden"
                aria-label="サイドバーを閉じる"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                      ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="mr-3 h-6 w-6" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <p className="text-xs text-gray-400">© 2024 RAG Web UI</p>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <button
                  onClick={handleSidebarToggle}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
                  aria-label="メニューを開く"
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>
                
                {showBreadcrumbs && (
                  <nav className="hidden ml-6 sm:flex" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-2">
                      {getBreadcrumbs().map((crumb, index) => (
                        <li key={crumb.href} className="flex items-center">
                          {index > 0 && (
                            <svg
                              className="flex-shrink-0 w-5 h-5 text-gray-400 mx-2"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          <Link
                            to={crumb.href}
                            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {crumb.name}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Theme Toggle */}
                <button
                  onClick={handleThemeToggle}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="テーマ切り替え"
                >
                  {theme === 'light' ? (
                    <MoonIcon className="h-5 w-5" />
                  ) : (
                    <SunIcon className="h-5 w-5" />
                  )}
                </button>
                
                {/* Notifications */}
                <button
                  className="relative text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="通知"
                >
                  <BellIcon className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
                  )}
                </button>
                
                {/* User Menu */}
                <button
                  className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="ユーザーメニュー"
                >
                  <UserCircleIcon className="h-8 w-8" />
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner size="large" message="読み込み中..." />
                </div>
              ) : (
                children
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                © 2024 RAG Web UI. All rights reserved.
              </p>
            </div>
          </footer>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
            onClick={handleSidebarToggle}
          />
        )}
      </div>

      {/* Notifications Container */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={handleNotificationClose}
          />
        ))}
      </div>
    </div>
  );
};

export default Layout;