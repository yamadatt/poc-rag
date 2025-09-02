export interface SystemStats {
  totalDocuments: number;
  totalQueries: number;
  avgResponseTime: number;
  successRate: number;
  storageUsed: number;
  storageLimit: number;
}

export interface RecentQuery {
  id: string;
  question: string;
  timestamp: string;
  responseTime: number;
  resultCount: number;
}

export interface DocumentTypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

export interface DashboardState {
  stats: SystemStats | null;
  recentQueries: RecentQuery[];
  recentDocuments: import('./document').Document[];
  documentDistribution: DocumentTypeDistribution[];
  loading: boolean;
  error: string | null;
}