// Source type definition
export interface Source {
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  score: number;
}

// API Request Types
export interface UploadDocumentRequest {
  file: File;
}

export interface QueryRequest {
  question: string;
  max_results?: number;
}

// API Response Types
export interface UploadDocumentResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
}

export interface DocumentStatusResponse {
  document_id: string;
  status: 'processing' | 'completed' | 'failed';
  processed_at?: string;
}

// API Error Types
export interface APIError {
  code: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}