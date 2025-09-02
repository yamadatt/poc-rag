import { configureStore } from '@reduxjs/toolkit';
import documentReducer, {
  setDocuments,
  addDocument,
  updateDocument,
  removeDocument,
  setFilters,
  setLoading,
  setError,
  addToUploadQueue,
  updateUploadProgress,
  removeFromUploadQueue,
  selectDocument,
  deselectDocument,
  clearSelection,
} from '../documentSlice';
import { Document, DocumentStatus } from '../../types';

describe('documentSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        documents: documentReducer,
      },
    });
  });

  const mockDocument: Document = {
    id: 'doc1',
    fileName: 'test.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    status: 'completed' as DocumentStatus,
    uploadedAt: '2024-01-01T00:00:00Z',
    processedAt: '2024-01-01T00:10:00Z',
  };

  describe('document operations', () => {
    it('should set documents', () => {
      const documents = [mockDocument];
      store.dispatch(setDocuments(documents));
      expect(store.getState().documents.documents).toEqual(documents);
    });

    it('should add a document', () => {
      store.dispatch(addDocument(mockDocument));
      expect(store.getState().documents.documents).toContainEqual(mockDocument);
    });

    it('should update a document', () => {
      store.dispatch(addDocument(mockDocument));
      const updatedDocument = { ...mockDocument, status: 'processing' as DocumentStatus };
      store.dispatch(updateDocument(updatedDocument));
      
      const doc = store.getState().documents.documents.find(d => d.id === mockDocument.id);
      expect(doc?.status).toBe('processing');
    });

    it('should remove a document', () => {
      store.dispatch(addDocument(mockDocument));
      store.dispatch(removeDocument(mockDocument.id));
      expect(store.getState().documents.documents).not.toContainEqual(mockDocument);
    });
  });

  describe('filter operations', () => {
    it('should set filters', () => {
      const filters = { status: 'completed' as DocumentStatus, searchQuery: 'test' };
      store.dispatch(setFilters(filters));
      expect(store.getState().documents.filters).toEqual(filters);
    });
  });

  describe('loading and error states', () => {
    it('should set loading state', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().documents.loading).toBe(true);
    });

    it('should set error state', () => {
      const error = 'Failed to load documents';
      store.dispatch(setError(error));
      expect(store.getState().documents.error).toBe(error);
    });

    it('should clear error when setting loading', () => {
      store.dispatch(setError('Some error'));
      store.dispatch(setLoading(true));
      expect(store.getState().documents.error).toBe(null);
    });
  });

  describe('upload queue operations', () => {
    it('should add to upload queue', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      store.dispatch(addToUploadQueue(file));
      
      const queue = store.getState().documents.uploadQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0].file).toBe(file);
      expect(queue[0].status).toBe('pending');
    });

    it('should update upload progress', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      store.dispatch(addToUploadQueue(file));
      
      const queue = store.getState().documents.uploadQueue;
      const uploadId = queue[0].file.name;
      
      store.dispatch(updateUploadProgress({ fileName: uploadId, progress: 50 }));
      
      const updatedQueue = store.getState().documents.uploadQueue;
      expect(updatedQueue[0].progress).toBe(50);
      expect(updatedQueue[0].status).toBe('uploading');
    });

    it('should remove from upload queue', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      store.dispatch(addToUploadQueue(file));
      store.dispatch(removeFromUploadQueue('test.pdf'));
      
      expect(store.getState().documents.uploadQueue).toHaveLength(0);
    });
  });

  describe('selection operations', () => {
    it('should select a document', () => {
      store.dispatch(selectDocument('doc1'));
      expect(store.getState().documents.selectedDocuments).toContain('doc1');
    });

    it('should deselect a document', () => {
      store.dispatch(selectDocument('doc1'));
      store.dispatch(selectDocument('doc2'));
      store.dispatch(deselectDocument('doc1'));
      
      const selected = store.getState().documents.selectedDocuments;
      expect(selected).not.toContain('doc1');
      expect(selected).toContain('doc2');
    });

    it('should clear selection', () => {
      store.dispatch(selectDocument('doc1'));
      store.dispatch(selectDocument('doc2'));
      store.dispatch(clearSelection());
      
      expect(store.getState().documents.selectedDocuments).toHaveLength(0);
    });
  });
});