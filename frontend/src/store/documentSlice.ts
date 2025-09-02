import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

// Document types - defined locally to avoid module resolution issues
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

const initialState: DocumentState = {
  documents: [],
  uploadQueue: [],
  selectedDocuments: [],
  filters: {},
  loading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    // Document operations
    setDocuments: (state, action: PayloadAction<Document[]>) => {
      state.documents = action.payload;
      state.error = null;
    },
    
    addDocument: (state, action: PayloadAction<Document>) => {
      state.documents.push(action.payload);
    },
    
    updateDocument: (state, action: PayloadAction<Document>) => {
      const index = state.documents.findIndex(doc => doc.id === action.payload.id);
      if (index !== -1) {
        state.documents[index] = action.payload;
      }
    },
    
    removeDocument: (state, action: PayloadAction<string>) => {
      state.documents = state.documents.filter(doc => doc.id !== action.payload);
      state.selectedDocuments = state.selectedDocuments.filter(id => id !== action.payload);
    },
    
    // Filter operations
    setFilters: (state, action: PayloadAction<DocumentFilters>) => {
      state.filters = action.payload;
    },
    
    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // Upload queue operations
    addToUploadQueue: (state, action: PayloadAction<File>) => {
      const uploadItem: UploadItem = {
        file: action.payload,
        progress: 0,
        status: 'pending',
      };
      state.uploadQueue.push(uploadItem);
    },
    
    updateUploadProgress: (state, action: PayloadAction<{ fileName: string; progress: number }>) => {
      const item = state.uploadQueue.find(item => item.file.name === action.payload.fileName);
      if (item) {
        item.progress = action.payload.progress;
        if (item.progress > 0 && item.progress < 100) {
          item.status = 'uploading';
        } else if (item.progress === 100) {
          item.status = 'completed';
        }
      }
    },
    
    updateUploadStatus: (state, action: PayloadAction<{ fileName: string; status: UploadItem['status']; error?: string }>) => {
      const item = state.uploadQueue.find(item => item.file.name === action.payload.fileName);
      if (item) {
        item.status = action.payload.status;
        if (action.payload.error) {
          item.error = action.payload.error;
        }
      }
    },
    
    removeFromUploadQueue: (state, action: PayloadAction<string>) => {
      state.uploadQueue = state.uploadQueue.filter(item => item.file.name !== action.payload);
    },
    
    clearUploadQueue: (state) => {
      state.uploadQueue = [];
    },
    
    // Selection operations
    selectDocument: (state, action: PayloadAction<string>) => {
      if (!state.selectedDocuments.includes(action.payload)) {
        state.selectedDocuments.push(action.payload);
      }
    },
    
    deselectDocument: (state, action: PayloadAction<string>) => {
      state.selectedDocuments = state.selectedDocuments.filter(id => id !== action.payload);
    },
    
    clearSelection: (state) => {
      state.selectedDocuments = [];
    },
    
    toggleDocumentSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedDocuments.indexOf(action.payload);
      if (index === -1) {
        state.selectedDocuments.push(action.payload);
      } else {
        state.selectedDocuments.splice(index, 1);
      }
    },
  },
});

export const {
  setDocuments,
  addDocument,
  updateDocument,
  removeDocument,
  setFilters,
  setLoading,
  setError,
  addToUploadQueue,
  updateUploadProgress,
  updateUploadStatus,
  removeFromUploadQueue,
  clearUploadQueue,
  selectDocument,
  deselectDocument,
  clearSelection,
  toggleDocumentSelection,
} = documentSlice.actions;

export default documentSlice.reducer;