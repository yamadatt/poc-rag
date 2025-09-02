import React, { useState } from 'react';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../utils/api';

// Simple types for dashboard
interface Stats {
  totalDocuments: number;
  totalQueries: number;
  avgResponseTime: number;
  successRate: number;
  storageUsed: number;
  storageLimit: number;
}

interface RecentQuery {
  id: string;
  question: string;
  timestamp: string;
  responseTime: number;
  resultCount: number;
}

interface RecentDocument {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: string;
}

// Mock data
const mockStats: Stats = {
  totalDocuments: 15,
  totalQueries: 42,
  avgResponseTime: 1.2,
  successRate: 95,
  storageUsed: 2.3,
  storageLimit: 10.0,
};

const mockRecentQueries: RecentQuery[] = [
  {
    id: '1',
    question: 'TypeScriptの型定義について',
    timestamp: '2024-01-15T10:30:00Z',
    responseTime: 1.5,
    resultCount: 3,
  },
  {
    id: '2',
    question: 'Reactのパフォーマンス最適化',
    timestamp: '2024-01-15T09:45:00Z',
    responseTime: 0.8,
    resultCount: 5,
  },
];

const mockRecentDocuments: RecentDocument[] = [
  {
    id: '1',
    fileName: 'typescript-guide.pdf',
    fileSize: 1024000,
    uploadedAt: '2024-01-15T08:00:00Z',
    status: 'completed',
  },
  {
    id: '2',
    fileName: 'react-docs.md',
    fileSize: 512000,
    uploadedAt: '2024-01-15T07:30:00Z',
    status: 'completed',
  },
];

// Helper functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('ja-JP');
};

// Components
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
}> = ({ title, value, icon: Icon }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <Icon className="h-8 w-8 text-blue-500" />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const ProgressBar: React.FC<{
  value: number;
  max: number;
  label: string;
}> = ({ value, max, label }) => {
  const percentage = Math.round((value / max) * 100);
  const isWarning = percentage > 90;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-sm text-gray-700">{value} GB / {max} GB</p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div
          className={`h-2.5 rounded-full ${isWarning ? 'bg-red-500' : 'bg-blue-600'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">{percentage}% 使用中</p>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>(mockStats);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>(mockRecentQueries);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>(mockRecentDocuments);

  const handleRefresh = async () => {
    // Refresh button clicked
    setIsRefreshing(true);
    setRefreshCount(prev => prev + 1);
    setLastRefreshTime(new Date());
    
    try {
      // Fetch all data in parallel
      const [statsResponse, queriesResponse, documentsResponse] = await Promise.all([
        apiClient.getStats(),
        apiClient.getRecentQueries(),
        apiClient.getDocuments()
      ]);

      if (statsResponse.success && statsResponse.data) {
        // Stats response received
        setStats({
          totalDocuments: statsResponse.data.total_documents || 0,
          totalQueries: statsResponse.data.total_queries || 0,
          avgResponseTime: statsResponse.data.avg_response_time || 1.2, // Default if not provided
          successRate: statsResponse.data.success_rate || 95, // Default if not provided
          storageUsed: statsResponse.data.storage_used || 0,
          storageLimit: statsResponse.data.storage_limit || 10,
        });
        // Stats updated
      }

      if (queriesResponse.success && queriesResponse.data) {
        setRecentQueries(queriesResponse.data.map((query: any) => ({
          id: query.id,
          question: query.question,
          timestamp: query.timestamp,
          responseTime: query.response_time,
          resultCount: query.result_count,
        })));
      }

      if (documentsResponse.success && documentsResponse.data) {
        // Documents response received
        const recentDocs = documentsResponse.data
          .slice(-2) // Get last 2 documents
          .map((doc: any) => ({
            id: doc.id || doc.document_id || 'unknown',
            fileName: doc.name || doc.file_name || 'Unknown File',
            fileSize: doc.size || doc.file_size || 0,
            uploadedAt: doc.uploaded_at || new Date().toISOString(),
            status: doc.status || 'completed',
          }));
        // Recent documents mapped
        setRecentDocuments(recentDocs);
      }

      // Refresh completed
    } catch {
      // Refresh error occurred
      // Keep existing data on error
    }
    
    setIsRefreshing(false);
  };
  
  // Load data on mount
  React.useEffect(() => {
    // Dashboard mounted, loading data
    handleRefresh();
  }, []); // Empty dependency array means run once on mount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isRefreshing 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? '更新中...' : '更新'}
        </button>
      </div>

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="text-sm space-y-1">
          <p><strong>デバッグ情報:</strong></p>
          <p>更新回数: <span className="font-bold text-blue-600">{refreshCount}</span></p>
          <p>最終更新: {lastRefreshTime ? lastRefreshTime.toLocaleTimeString() : 'なし'}</p>
          <p>状態: {isRefreshing ? '更新中' : 'アイドル'}</p>
        </div>
      </div>

      {/* System Stats */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">システム概要</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="総ドキュメント数"
            value={stats.totalDocuments}
            icon={DocumentTextIcon}
          />
          <StatCard
            title="総質問数"
            value={stats.totalQueries}
            icon={ChatBubbleLeftRightIcon}
          />
          <StatCard
            title="平均応答時間"
            value={`${stats.avgResponseTime}秒`}
            icon={ClockIcon}
          />
          <StatCard
            title="成功率"
            value={`${stats.successRate}%`}
            icon={CheckCircleIcon}
          />
        </div>
        
        <div className="mt-6">
          <ProgressBar
            value={stats.storageUsed}
            max={stats.storageLimit}
            label="ストレージ使用量"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Queries */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">最近の質問</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              {recentQueries.map((query) => (
                <div key={query.id} className="flex items-start space-x-3">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{query.question}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500">{formatTimestamp(query.timestamp)}</p>
                      <p className="text-xs text-gray-500">{query.responseTime}秒</p>
                      <p className="text-xs text-gray-500">{query.resultCount}件の結果</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">最近のドキュメント</h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              {recentDocuments.map((document) => (
                <div key={document.id} className="flex items-center space-x-3">
                  <DocumentTextIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{document.fileName}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500">{formatFileSize(document.fileSize)}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(document.uploadedAt)}</p>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        完了
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;