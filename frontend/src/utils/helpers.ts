// Helper functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
};

export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getFileTypeIcon = (fileType: string): string => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('docx')) return '📝';
  if (fileType.includes('presentation') || fileType.includes('pptx')) return '📊';
  if (fileType.includes('text')) return '📃';
  return '📎';
};

export const getStatusBadgeConfig = (status: string) => {
  const config = {
    uploading: { text: 'アップロード中', color: 'bg-blue-100 text-blue-800' },
    processing: { text: '処理中', color: 'bg-yellow-100 text-yellow-800' },
    completed: { text: '完了', color: 'bg-green-100 text-green-800' },
    failed: { text: '失敗', color: 'bg-red-100 text-red-800' },
  }[status] || { text: '不明', color: 'bg-gray-100 text-gray-800' };

  return config;
};