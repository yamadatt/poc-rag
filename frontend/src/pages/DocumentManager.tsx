import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../utils/api';

// Simple types
interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'deleting';
  uploadedAt: string;
  progress?: number;
}

// Mock data
const mockDocuments: Document[] = [
  {
    id: '1',
    fileName: 'typescript-guide.pdf',
    fileType: 'application/pdf',
    fileSize: 1024000,
    status: 'completed',
    uploadedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: '2',
    fileName: 'react-docs.md',
    fileType: 'text/markdown',
    fileSize: 512000,
    status: 'completed',
    uploadedAt: '2024-01-15T07:30:00Z',
  },
  {
    id: '3',
    fileName: 'api-specification.txt',
    fileType: 'text/plain',
    fileSize: 256000,
    status: 'completed',
    uploadedAt: '2024-01-15T09:00:00Z',
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

const getFileTypeIcon = (fileType: string): string => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('text')) return '📝';
  if (fileType.includes('markdown')) return '📋';
  return '📁';
};

const getStatusBadge = (status: string, progress?: number) => {
  switch (status) {
    case 'completed':
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">完了</span>;
    case 'processing':
      return (
        <div className="flex items-center space-x-2">
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">処理中</span>
          {progress && <span className="text-xs text-gray-500">{progress}%</span>}
        </div>
      );
    case 'uploading':
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">アップロード中</span>;
    case 'deleting':
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">削除中</span>;
    case 'failed':
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">失敗</span>;
    default:
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">不明</span>;
  }
};

const DocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [dragActive, setDragActive] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // DocumentManager render

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // File upload initiated
    setUploadCount(prev => prev + 1);

    Array.from(files).forEach(async (file) => {
      // Uploading file
      
      // Create temporary document for UI
      const tempId = Date.now().toString() + Math.random().toString();
      const newDocument: Document = {
        id: tempId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        status: 'uploading',
        uploadedAt: new Date().toISOString(),
        progress: 0,
      };

      // Add to state immediately to show in the list
      setDocuments(prev => [...prev, newDocument]);
      // Document added to list

      try {
        // Call actual API
        const response = await apiClient.uploadDocument(file);
        
        if (response.success && response.data) {
          const documentId = response.data.document_id;
          
          // Update with real document ID and status
          setDocuments(prev => prev.map(doc => 
            doc.id === tempId 
              ? { 
                  ...doc, 
                  id: documentId,
                  status: 'processing',
                  progress: undefined
                }
              : doc
          ));
          
          // Automatically trigger document processing
          try {
            const processResponse = await apiClient.processDocument(documentId);
            
            setDocuments(prev => prev.map(doc => 
              doc.id === documentId 
                ? { 
                    ...doc, 
                    status: processResponse.success ? 'completed' : 'failed'
                  }
                : doc
            ));
          } catch (error) {
            // Processing failed
            setDocuments(prev => prev.map(doc => 
              doc.id === documentId 
                ? { ...doc, status: 'failed' }
                : doc
            ));
          }
          
          // Upload completed
        } else {
          // Handle upload error
          // Upload failed
          setDocuments(prev => prev.map(doc => 
            doc.id === tempId 
              ? { ...doc, status: 'failed', progress: undefined }
              : doc
          ));
        }
      } catch {
        // Upload error occurred
        setDocuments(prev => prev.map(doc => 
          doc.id === tempId 
            ? { ...doc, status: 'failed', progress: undefined }
            : doc
        ));
      }
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteDocument = async (id: string, fileName: string) => {
    // Confirmation dialog
    if (!window.confirm(`「${fileName}」を削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    // Deleting document

    // Temporarily mark document as being deleted (UI feedback)
    setDocuments(prev => prev.map(doc => 
      doc.id === id 
        ? { ...doc, status: 'deleting' as const }
        : doc
    ));

    try {
      // Call delete API
      const response = await apiClient.deleteDocument(id);
      
      if (response.success && response.data) {
        // Remove from UI on successful deletion
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        // Document deleted successfully
        
        // Refresh the list to ensure consistency
        setTimeout(() => {
          handleRefresh();
        }, 1000);
      } else {
        // Failed to delete document
        // Restore original status on error
        setDocuments(prev => prev.map(doc => 
          doc.id === id 
            ? { ...doc, status: 'completed' as const } // Assume it was completed
            : doc
        ));
        alert(`削除に失敗しました: ${response.error}`);
      }
    } catch {
      // Delete error occurred
      // Restore original status on error
      setDocuments(prev => prev.map(doc => 
        doc.id === id 
          ? { ...doc, status: 'completed' as const }
          : doc
      ));
      alert(`削除中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleRefresh = useCallback(async () => {
    // Document refresh button clicked
    setIsRefreshing(true);
    setRefreshCount(prev => prev + 1);
    setLastRefreshTime(new Date());
    
    try {
      // Fetch documents from API
      const response = await apiClient.getDocuments();
      // API Response received
      
      if (response.success && response.data) {
        // Raw documents data received
        
        // Transform API response to match our interface
        // APIが返すフィールド名が異なるため、正しくマッピング
        // API Response fields analyzed
        const apiDocuments = response.data.map((doc: any) => {
          // Processing document
          const mapped = {
            id: doc.id || doc.document_id || 'unknown',
            fileName: doc.name || doc.file_name || 'Unknown File',
            fileType: doc.type || doc.file_type || 'application/octet-stream',
            fileSize: doc.size || doc.file_size || 0,
            status: doc.status || 'completed',
            uploadedAt: doc.uploaded_at || new Date().toISOString(),
          };
          // Mapped document
          return mapped;
        });
        
        // Transformed documents
        setDocuments(apiDocuments);
        setError(null); // Clear any previous errors
        // Document refresh completed
      } else {
        // Failed to refresh documents
        // Keep existing documents on error
      }
    } catch {
      // Refresh error occurred
      setError(`API接続エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
      // Keep existing documents on error
    }
    
    setIsRefreshing(false);
  }, []);

  // Load documents on component mount and debug
  useEffect(() => {
    // DocumentManager mounting
    // API Base URL configured
    // Documents state before refresh
    handleRefresh();
  }, [handleRefresh]);

  // Debug effect to track documents changes
  useEffect(() => {
    // Documents state changed
    // Documents count updated
    if (documents.length > 0) {
      // First document available
    }
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-800">
            <strong>エラー:</strong> {error}
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ドキュメント管理</h1>
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
          <p>総ドキュメント数: <span className="font-bold text-blue-600">{documents.length}</span></p>
          <p>アップロード回数: <span className="font-bold text-blue-600">{uploadCount}</span></p>
          <p>更新回数: <span className="font-bold text-blue-600">{refreshCount}</span></p>
          <p>最終更新: {lastRefreshTime ? lastRefreshTime.toLocaleTimeString() : 'なし'}</p>
          <p>状態: {isRefreshing ? '更新中' : 'アイドル'}</p>
          <p>表示中: {filteredDocuments.length}件</p>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">ファイルアップロード</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-2">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-sm text-gray-600">
                ファイルをドラッグ&ドロップまたは
                <span className="text-blue-600 hover:text-blue-500"> クリックしてアップロード</span>
              </span>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              PDF、DOCX、TXT、MD（最大10MB）
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="ファイル名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">すべてのステータス</option>
              <option value="completed">完了</option>
              <option value="processing">処理中</option>
              <option value="uploading">アップロード中</option>
              <option value="deleting">削除中</option>
              <option value="failed">失敗</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  ファイル名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  タイプ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  サイズ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  アップロード日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((document) => (
                <tr key={document.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getFileTypeIcon(document.fileType)}</span>
                      <div className="text-sm font-medium text-gray-900 truncate" title={document.fileName}>
                        {document.fileName}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {document.fileType.split('/').pop()?.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFileSize(document.fileSize)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(document.status, document.progress)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(document.uploadedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDeleteDocument(document.id, document.fileName)}
                      className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50"
                      title="削除"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">ドキュメントがありません</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' 
                ? '検索条件に一致するドキュメントがありません' 
                : 'ファイルをアップロードしてください'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentManager;