export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  autoClose?: boolean;
}

export interface UIState {
  currentPage: string;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
}