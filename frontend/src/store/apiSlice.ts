import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  Document,
  UploadDocumentResponse,
  QueryRequest,
  QueryResponse,
  DocumentStatusResponse,
  SystemStats,
  RecentQuery,
} from '../types';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:3001',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Document', 'Query', 'Stats'],
  endpoints: (builder) => ({
    // Document endpoints
    getDocuments: builder.query<Document[], void>({
      query: () => '/documents',
      providesTags: ['Document'],
    }),
    
    uploadDocument: builder.mutation<UploadDocumentResponse, FormData>({
      query: (formData) => ({
        url: '/documents',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Document', 'Stats'],
    }),
    
    getDocumentStatus: builder.query<DocumentStatusResponse, string>({
      query: (documentId) => `/documents/${documentId}/status`,
      providesTags: (_result, _error, id) => [{ type: 'Document', id }],
    }),
    
    deleteDocument: builder.mutation<void, string>({
      query: (documentId) => ({
        url: `/documents/${documentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Document', 'Stats'],
    }),
    
    // Query endpoints
    sendQuery: builder.mutation<QueryResponse, QueryRequest>({
      query: (request) => ({
        url: '/query',
        method: 'POST',
        body: request,
      }),
      invalidatesTags: ['Query', 'Stats'],
    }),
    
    // Dashboard endpoints
    getSystemStats: builder.query<SystemStats, void>({
      query: () => '/stats',
      providesTags: ['Stats'],
    }),
    
    getRecentQueries: builder.query<RecentQuery[], void>({
      query: () => '/queries/recent',
      providesTags: ['Query'],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useGetDocumentStatusQuery,
  useDeleteDocumentMutation,
  useSendQueryMutation,
  useGetSystemStatsQuery,
  useGetRecentQueriesQuery,
} = apiSlice;