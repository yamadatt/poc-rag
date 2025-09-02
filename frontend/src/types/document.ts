export type DocumentStatus = 'uploading' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: string;
  processedAt?: string;
  progress?: number;
}

export interface DocumentFilters {
  status?: DocumentStatus;
  fileType?: string;
  searchQuery?: string;
}

export interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface DocumentState {
  documents: Document[];
  uploadQueue: UploadItem[];
  selectedDocuments: string[];
  filters: DocumentFilters;
  loading: boolean;
  error: string | null;
}