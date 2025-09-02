import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import {
  UploadDocumentResponse,
  QueryRequest,
  QueryResponse,
  DocumentStatusResponse,
  APIError,
  SystemStats,
  RecentQuery,
} from '../types/api';
import { Document } from '../store/documentSlice';

class APIService {
  private baseURL: string;
  private httpClient: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.httpClient = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError = this.handleError(error);
        return Promise.reject(new Error(apiError.message));
      }
    );
  }

  private handleError(error: AxiosError): APIError {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as any;
      return {
        code: data?.error?.code || 'SERVER_ERROR',
        message: data?.error?.message || 'サーバーエラーが発生しました',
        details: data?.error?.details,
      };
    } else if (error.request) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました。接続を確認してください。',
      };
    } else {
      // Other error
      return {
        code: 'UNKNOWN_ERROR',
        message: '予期しないエラーが発生しました。',
      };
    }
  }

  // Document operations
  async uploadDocument(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    };

    const response = await this.httpClient.post<UploadDocumentResponse>(
      '/documents',
      formData,
      config
    );
    return response.data;
  }

  async getDocuments(): Promise<Document[]> {
    const response = await this.httpClient.get<Document[]>('/documents');
    return response.data;
  }

  async getDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
    const response = await this.httpClient.get<DocumentStatusResponse>(
      `/documents/${documentId}/status`
    );
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.httpClient.delete(`/documents/${documentId}`);
  }

  // Query operations
  async sendQuery(request: QueryRequest): Promise<QueryResponse> {
    const response = await this.httpClient.post<QueryResponse>('/query', request);
    return response.data;
  }

  // Dashboard operations
  async getSystemStats(): Promise<SystemStats> {
    const response = await this.httpClient.get<SystemStats>('/stats');
    return response.data;
  }

  async getRecentQueries(): Promise<RecentQuery[]> {
    const response = await this.httpClient.get<RecentQuery[]>('/queries/recent');
    return response.data;
  }
}

export default APIService;