import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import APIService from '../api';
import { UploadDocumentResponse, QueryResponse, DocumentStatusResponse } from '../../types';

const API_BASE_URL = 'http://localhost:3001';

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('APIService', () => {
  let apiService: APIService;

  beforeEach(() => {
    apiService = new APIService(API_BASE_URL);
  });

  describe('uploadDocument', () => {
    it('should upload a document successfully', async () => {
      const mockResponse: UploadDocumentResponse = {
        document_id: 'doc123',
        status: 'uploaded',
        message: 'Document uploaded successfully',
      };

      server.use(
        http.post(`${API_BASE_URL}/documents`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const result = await apiService.uploadDocument(file);

      expect(result).toEqual(mockResponse);
    });

    it('should handle upload errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/documents`, () => {
          return HttpResponse.json({
            error: {
              code: 'UPLOAD_FAILED',
              message: 'Failed to upload document',
            },
          }, { status: 500 });
        })
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      
      await expect(apiService.uploadDocument(file)).rejects.toThrow('Failed to upload document');
    });

    it('should track upload progress', async () => {
      const mockProgress = jest.fn();
      
      server.use(
        http.post(`${API_BASE_URL}/documents`, () => {
          return HttpResponse.json({
            document_id: 'doc123',
            status: 'uploaded',
            message: 'Success',
          });
        })
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await apiService.uploadDocument(file, mockProgress);

      // Progress callback should be called
      expect(mockProgress).toHaveBeenCalled();
    });
  });

  describe('getDocuments', () => {
    it('should fetch documents list', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          fileName: 'test1.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          status: 'completed',
          uploadedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'doc2',
          fileName: 'test2.docx',
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 2048,
          status: 'processing',
          uploadedAt: '2024-01-02T00:00:00Z',
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/documents`, () => {
          return HttpResponse.json(mockDocuments);
        })
      );

      const result = await apiService.getDocuments();
      expect(result).toEqual(mockDocuments);
    });

    it('should handle fetch errors', async () => {
      server.use(
        http.get(`${API_BASE_URL}/documents`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(apiService.getDocuments()).rejects.toThrow();
    });
  });

  describe('getDocumentStatus', () => {
    it('should fetch document status', async () => {
      const mockStatus: DocumentStatusResponse = {
        document_id: 'doc123',
        status: 'completed',
        processed_at: '2024-01-01T00:00:00Z',
      };

      server.use(
        http.get(`${API_BASE_URL}/documents/doc123/status`, () => {
          return HttpResponse.json(mockStatus);
        })
      );

      const result = await apiService.getDocumentStatus('doc123');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/documents/doc123`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(apiService.deleteDocument('doc123')).resolves.not.toThrow();
    });

    it('should handle delete errors', async () => {
      server.use(
        http.delete(`${API_BASE_URL}/documents/doc123`, () => {
          return HttpResponse.json({
            error: {
              code: 'NOT_FOUND',
              message: 'Document not found',
            },
          }, { status: 404 });
        })
      );

      await expect(apiService.deleteDocument('doc123')).rejects.toThrow('Document not found');
    });
  });

  describe('sendQuery', () => {
    it('should send a query and receive a response', async () => {
      const mockResponse: QueryResponse = {
        answer: 'This is the answer to your question.',
        sources: [
          {
            documentId: 'doc1',
            documentName: 'test.pdf',
            chunkId: 'chunk1',
            content: 'Relevant content',
            score: 0.95,
          },
        ],
      };

      server.use(
        http.post(`${API_BASE_URL}/query`, () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const result = await apiService.sendQuery({ question: 'What is the answer?' });
      expect(result).toEqual(mockResponse);
    });

    it('should handle query errors', async () => {
      server.use(
        http.post(`${API_BASE_URL}/query`, () => {
          return HttpResponse.json({
            error: {
              code: 'INVALID_QUERY',
              message: 'Query cannot be empty',
            },
          }, { status: 400 });
        })
      );

      await expect(apiService.sendQuery({ question: '' })).rejects.toThrow('Query cannot be empty');
    });
  });

  describe('getSystemStats', () => {
    it('should fetch system statistics', async () => {
      const mockStats = {
        totalDocuments: 10,
        todayQueries: 5,
        processingDocuments: 2,
        totalStorage: '100MB',
      };

      server.use(
        http.get(`${API_BASE_URL}/stats`, () => {
          return HttpResponse.json(mockStats);
        })
      );

      const result = await apiService.getSystemStats();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getRecentQueries', () => {
    it('should fetch recent queries', async () => {
      const mockQueries = [
        {
          id: 'q1',
          question: 'What is RAG?',
          timestamp: '2024-01-01T00:00:00Z',
          responseTime: 1500,
        },
      ];

      server.use(
        http.get(`${API_BASE_URL}/queries/recent`, () => {
          return HttpResponse.json(mockQueries);
        })
      );

      const result = await apiService.getRecentQueries();
      expect(result).toEqual(mockQueries);
    });
  });
});