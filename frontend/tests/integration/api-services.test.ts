import { APIService } from '../../src/services/api';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Create MSW server for integration tests
const server = setupServer();

// Mock API base URL
const API_BASE_URL = 'http://localhost:8000';

describe('API Services Integration Tests', () => {
  let apiService: APIService;

  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    apiService = new APIService(API_BASE_URL);
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('Document Management', () => {
    it('should upload document successfully', async () => {
      const mockResponse = {
        id: 'doc-123',
        fileName: 'test-document.pdf',
        status: 'processing',
        uploadedAt: new Date().toISOString(),
      };

      server.use(
        http.post(`${API_BASE_URL}/documents/upload`, () => {
          return HttpResponse.json(mockResponse, { status: 201 });
        })
      );

      const file = new File(['test content'], 'test-document.pdf', {
        type: 'application/pdf',
      });

      const result = await apiService.uploadDocument(file);
      expect(result).toEqual(mockResponse);
    });

    it('should get documents list', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          fileName: 'document1.pdf',
          fileType: 'application/pdf',
          fileSize: 1024000,
          status: 'completed',
          uploadedAt: '2024-01-10T10:00:00Z',
          processedAt: '2024-01-10T10:05:00Z',
        },
        {
          id: 'doc2',
          fileName: 'document2.txt',
          fileType: 'text/plain',
          fileSize: 2048,
          status: 'completed',
          uploadedAt: '2024-01-10T11:00:00Z',
          processedAt: '2024-01-10T11:01:00Z',
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/documents`, () => {
          return HttpResponse.json(mockDocuments);
        })
      );

      const result = await apiService.getDocuments();
      expect(result).toEqual(mockDocuments);
      expect(result).toHaveLength(2);
    });

    it('should delete document', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/documents/doc-123`, () => {
          return HttpResponse.json({ success: true });
        })
      );

      const result = await apiService.deleteDocument('doc-123');
      expect(result).toEqual({ success: true });
    });

    it('should handle upload errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/documents/upload`, () => {
          return HttpResponse.json(
            { error: 'File too large' },
            { status: 400 }
          );
        })
      );

      const file = new File(['large content'], 'large-file.pdf', {
        type: 'application/pdf',
      });

      await expect(apiService.uploadDocument(file)).rejects.toThrow(
        'File too large'
      );
    });
  });

  describe('Chat Interface', () => {
    it('should send question and receive answer', async () => {
      const mockResponse = {
        id: 'response-456',
        question: 'RAGについて教えてください',
        answer: 'RAG（Retrieval-Augmented Generation）は...',
        sources: [
          {
            id: 'doc1',
            fileName: 'rag-guide.pdf',
            relevanceScore: 0.95,
            excerpt: 'RAGは情報検索と生成AIを組み合わせた技術です...',
          },
        ],
        responseTime: 1.2,
        timestamp: new Date().toISOString(),
      };

      server.use(
        http.post(`${API_BASE_URL}/chat`, async ({ request }) => {
          const body = await request.json() as any;
          expect(body.question).toBe('RAGについて教えてください');
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await apiService.sendQuestion('RAGについて教えてください');
      expect(result).toEqual(mockResponse);
      expect(result.sources).toHaveLength(1);
    });

    it('should get chat history', async () => {
      const mockHistory = [
        {
          id: 'msg1',
          question: '最初の質問',
          answer: '最初の回答',
          timestamp: '2024-01-10T10:00:00Z',
        },
        {
          id: 'msg2',
          question: '二番目の質問',
          answer: '二番目の回答',
          timestamp: '2024-01-10T10:05:00Z',
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/chat/history`, () => {
          return HttpResponse.json(mockHistory);
        })
      );

      const result = await apiService.getChatHistory();
      expect(result).toEqual(mockHistory);
      expect(result).toHaveLength(2);
    });

    it('should handle chat timeout', async () => {
      server.use(
        http.post(`${API_BASE_URL}/chat`, () => {
          // Simulate slow response
          return new Promise(resolve => 
            setTimeout(() => resolve(HttpResponse.json({ answer: 'timeout test' })), 35000)
          );
        })
      );

      await expect(
        apiService.sendQuestion('timeout question')
      ).rejects.toThrow('timeout');
    }, 40000);
  });

  describe('System Statistics', () => {
    it('should get system stats', async () => {
      const mockStats = {
        totalDocuments: 25,
        totalQueries: 150,
        avgResponseTime: 1.3,
        successRate: 97.5,
        storageUsed: 2.1,
        storageLimit: 10.0,
      };

      server.use(
        http.get(`${API_BASE_URL}/stats`, () => {
          return HttpResponse.json(mockStats);
        })
      );

      const result = await apiService.getSystemStats();
      expect(result).toEqual(mockStats);
      expect(result.totalDocuments).toBe(25);
      expect(result.successRate).toBe(97.5);
    });

    it('should get recent queries', async () => {
      const mockQueries = [
        {
          id: 'q1',
          question: '最近の質問1',
          timestamp: '2024-01-10T10:00:00Z',
          responseTime: 1.1,
          resultCount: 5,
        },
        {
          id: 'q2',
          question: '最近の質問2',
          timestamp: '2024-01-10T09:30:00Z',
          responseTime: 0.8,
          resultCount: 3,
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/queries/recent`, () => {
          return HttpResponse.json(mockQueries);
        })
      );

      const result = await apiService.getRecentQueries();
      expect(result).toEqual(mockQueries);
      expect(result).toHaveLength(2);
    });

    it('should get recent documents', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          fileName: '最近のドキュメント.pdf',
          fileType: 'application/pdf',
          fileSize: 1536000,
          status: 'completed',
          uploadedAt: '2024-01-10T08:00:00Z',
          processedAt: '2024-01-10T08:05:00Z',
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/documents/recent`, () => {
          return HttpResponse.json(mockDocuments);
        })
      );

      const result = await apiService.getRecentDocuments();
      expect(result).toEqual(mockDocuments);
      expect(result[0].fileName).toBe('最近のドキュメント.pdf');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/stats`, () => {
          return HttpResponse.error();
        })
      );

      await expect(apiService.getSystemStats()).rejects.toThrow();
    });

    it('should handle 404 errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/documents/non-existent`, () => {
          return HttpResponse.json(
            { error: 'Document not found' },
            { status: 404 }
          );
        })
      );

      await expect(
        apiService.getDocument('non-existent')
      ).rejects.toThrow('Document not found');
    });

    it('should handle 500 errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/chat`, () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      await expect(
        apiService.sendQuestion('test question')
      ).rejects.toThrow('Internal server error');
    });

    it('should retry failed requests', async () => {
      let attempts = 0;
      
      server.use(
        http.get(`${API_BASE_URL}/stats`, () => {
          attempts++;
          if (attempts < 3) {
            return HttpResponse.json(
              { error: 'Server temporarily unavailable' },
              { status: 503 }
            );
          }
          return HttpResponse.json({
            totalDocuments: 10,
            totalQueries: 20,
            avgResponseTime: 1.0,
            successRate: 100,
            storageUsed: 1.0,
            storageLimit: 10.0,
          });
        })
      );

      const result = await apiService.getSystemStats();
      expect(attempts).toBe(3);
      expect(result.totalDocuments).toBe(10);
    });
  });

  describe('Authentication', () => {
    it('should include auth headers when token provided', async () => {
      const apiServiceWithAuth = new APIService(API_BASE_URL, {
        authToken: 'test-token-123',
      });

      server.use(
        http.get(`${API_BASE_URL}/stats`, ({ request }) => {
          const authHeader = request.headers.get('authorization');
          expect(authHeader).toBe('Bearer test-token-123');
          
          return HttpResponse.json({
            totalDocuments: 5,
            totalQueries: 10,
            avgResponseTime: 0.5,
            successRate: 100,
            storageUsed: 0.5,
            storageLimit: 10.0,
          });
        })
      );

      const result = await apiServiceWithAuth.getSystemStats();
      expect(result.totalDocuments).toBe(5);
    });

    it('should handle 401 unauthorized errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/stats`, () => {
          return HttpResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        })
      );

      await expect(apiService.getSystemStats()).rejects.toThrow('Unauthorized');
    });
  });

  describe('File Processing Status', () => {
    it('should poll document processing status', async () => {
      let statusCalls = 0;
      const statuses = ['processing', 'processing', 'completed'];

      server.use(
        http.get(`${API_BASE_URL}/documents/doc-123/status`, () => {
          const status = statuses[statusCalls] || 'completed';
          statusCalls++;
          
          return HttpResponse.json({
            id: 'doc-123',
            status,
            progress: statusCalls * 33,
            processedAt: status === 'completed' ? new Date().toISOString() : null,
          });
        })
      );

      // First call - processing
      let result = await apiService.getDocumentStatus('doc-123');
      expect(result.status).toBe('processing');
      expect(result.progress).toBe(33);

      // Second call - still processing
      result = await apiService.getDocumentStatus('doc-123');
      expect(result.status).toBe('processing');
      expect(result.progress).toBe(66);

      // Third call - completed
      result = await apiService.getDocumentStatus('doc-123');
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(99);
      expect(result.processedAt).toBeTruthy();
    });
  });
});