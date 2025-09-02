// Mock data for development
export const mockStats = {
  totalDocuments: 15,
  totalQueries: 127,
  avgResponseTime: 1.3,
  successRate: 94,
  storageUsed: 2.1,
  storageLimit: 10.0,
};

export const mockRecentQueries = [
  {
    id: '1',
    question: 'プロジェクト管理のベストプラクティスについて教えて',
    timestamp: '2025-01-20T10:30:00Z',
    responseTime: 1.2,
    resultCount: 5,
  },
  {
    id: '2', 
    question: 'React Hooksの使い方について',
    timestamp: '2025-01-20T09:15:00Z',
    responseTime: 0.8,
    resultCount: 3,
  },
  {
    id: '3',
    question: 'データベース設計の原則は？',
    timestamp: '2025-01-19T16:45:00Z',
    responseTime: 2.1,
    resultCount: 7,
  },
];

export const mockRecentDocuments = [
  {
    id: '1',
    fileName: 'プロジェクト管理ガイド.pdf',
    fileSize: 2048576,
    uploadedAt: '2025-01-20T08:00:00Z',
    status: 'completed' as const,
  },
  {
    id: '2',
    fileName: 'React開発マニュアル.docx',
    fileSize: 1536000,
    uploadedAt: '2025-01-19T14:30:00Z',
    status: 'completed' as const,
  },
  {
    id: '3',
    fileName: 'データベース設計書.pdf',
    fileSize: 3072000,
    uploadedAt: '2025-01-19T12:15:00Z',
    status: 'processing' as const,
  },
];

export const mockMessages = [
  {
    id: '1',
    type: 'user' as const,
    content: 'プロジェクト管理のベストプラクティスについて教えてください',
    timestamp: '2025-01-20T10:30:00Z',
  },
  {
    id: '2',
    type: 'assistant' as const,
    content: 'プロジェクト管理のベストプラクティスとして、以下の点が重要です：\n\n1. 明確な目標設定\n2. 適切なリソース配分\n3. 定期的な進捗確認\n4. リスク管理\n5. チームコミュニケーション',
    timestamp: '2025-01-20T10:30:15Z',
    sources: [
      {
        chunkId: 'chunk-1',
        documentName: 'プロジェクト管理ガイド.pdf',
        content: 'プロジェクト管理における重要な要素は、明確な目標設定と適切なリソース配分です...',
        score: 0.95,
      }
    ],
  },
];

export const mockDocuments = [
  {
    id: '1',
    fileName: 'プロジェクト管理ガイド.pdf',
    fileType: 'application/pdf',
    fileSize: 2048576,
    status: 'completed' as const,
    uploadedAt: '2025-01-20T08:00:00Z',
    processedAt: '2025-01-20T08:05:00Z',
  },
  {
    id: '2',
    fileName: 'React開発マニュアル.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1536000,
    status: 'completed' as const,
    uploadedAt: '2025-01-19T14:30:00Z',
    processedAt: '2025-01-19T14:35:00Z',
  },
  {
    id: '3',
    fileName: 'データベース設計書.pdf',
    fileType: 'application/pdf',
    fileSize: 3072000,
    status: 'processing' as const,
    uploadedAt: '2025-01-19T12:15:00Z',
  },
  {
    id: '4',
    fileName: 'API仕様書.txt',
    fileType: 'text/plain',
    fileSize: 512000,
    status: 'failed' as const,
    uploadedAt: '2025-01-18T16:20:00Z',
  },
];