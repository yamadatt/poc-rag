export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface DocumentUploadResponse {
  document_id: string;
  status: string;
  message: string;
  file_name: string;
}

export interface DocumentStatus {
  document_id: string;
  file_name: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface DocumentDeleteResponse {
  message: string;
  document_id: string;
  success: boolean;
}

export interface QueryRequest {
  question: string;
  max_results?: number;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    document_id: string;
    chunk_id: string;
    content: string;
    score: number;
  }>;
  query_time: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://roa26dlwl9.execute-api.ap-northeast-1.amazonaws.com/prod';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // File upload
  async uploadDocument(file: File): Promise<ApiResponse<DocumentUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async processDocument(documentId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Document processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  // Get document status
  async getDocumentStatus(documentId: string): Promise<ApiResponse<DocumentStatus>> {
    return this.request<DocumentStatus>(`/documents/${documentId}/status`);
  }

  // Delete document
  async deleteDocument(documentId: string): Promise<ApiResponse<DocumentDeleteResponse>> {
    console.log('🗑️ API: Deleting document', documentId);
    return this.request<DocumentDeleteResponse>(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  // Query documents
  async queryDocuments(request: QueryRequest): Promise<ApiResponse<QueryResponse>> {
    return this.request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Get all documents
  async getDocuments(): Promise<ApiResponse<any[]>> {
    console.log('🌐 API: Getting documents from', `${this.baseUrl}/documents`);
    return this.request<any[]>('/documents');
  }

  // Get system stats
  async getStats(): Promise<ApiResponse<any>> {
    return this.request<any>('/stats');
  }

  // Get recent queries
  async getRecentQueries(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/queries/recent');
  }
}

export const apiClient = new ApiClient();