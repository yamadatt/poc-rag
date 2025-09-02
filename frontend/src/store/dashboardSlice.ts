import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DashboardState, SystemStats, RecentQuery, DocumentTypeDistribution } from '../types/dashboard';
import type { Document } from './documentSlice';
import APIService from '../services/api';

const initialState: DashboardState = {
  stats: null,
  recentQueries: [],
  recentDocuments: [],
  documentDistribution: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchStats = createAsyncThunk(
  'dashboard/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      console.log('📡 Fetching stats from API...');
      const apiService = new APIService(import.meta.env.VITE_API_URL || 'http://localhost:8000');
      const stats = await apiService.getSystemStats();
      console.log('📈 Stats received:', stats);
      return stats;
    } catch (error: any) {
      console.error('❌ Failed to fetch stats:', error);
      return rejectWithValue(error.message || 'Failed to fetch stats');
    }
  }
);

export const fetchRecentQueries = createAsyncThunk(
  'dashboard/fetchRecentQueries',
  async (_, { rejectWithValue }) => {
    try {
      const apiService = new APIService(import.meta.env.VITE_API_URL || 'http://localhost:8000');
      const queries = await apiService.getRecentQueries();
      return queries;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch recent queries');
    }
  }
);

export const fetchRecentDocuments = createAsyncThunk(
  'dashboard/fetchRecentDocuments',
  async (_, { rejectWithValue }) => {
    try {
      const apiService = new APIService(import.meta.env.VITE_API_URL || 'http://localhost:8000');
      const documents = await apiService.getDocuments();
      // Return only the 5 most recent documents
      const sortedDocs = documents.sort((a: Document, b: Document) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ).slice(0, 5);
      return sortedDocs;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch recent documents');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    // Stats operations
    setStats: (state, action: PayloadAction<SystemStats>) => {
      state.stats = action.payload;
      state.error = null;
    },
    
    // Recent queries operations
    setRecentQueries: (state, action: PayloadAction<RecentQuery[]>) => {
      state.recentQueries = action.payload;
    },
    
    addRecentQuery: (state, action: PayloadAction<RecentQuery>) => {
      state.recentQueries = [action.payload, ...state.recentQueries].slice(0, 10);
    },

    // Recent documents operations
    setRecentDocuments: (state, action: PayloadAction<Document[]>) => {
      state.recentDocuments = action.payload;
    },
    
    // Document distribution operations
    setDocumentDistribution: (state, action: PayloadAction<DocumentTypeDistribution[]>) => {
      state.documentDistribution = action.payload;
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
    
    // Reset dashboard
    resetDashboard: (state) => {
      state.stats = null;
      state.recentQueries = [];
      state.recentDocuments = [];
      state.documentDistribution = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch stats
    builder
      .addCase(fetchStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch recent queries
      .addCase(fetchRecentQueries.pending, (state) => {
        // Don't show loading for individual requests if stats are loading
        state.error = null;
      })
      .addCase(fetchRecentQueries.fulfilled, (state, action) => {
        state.recentQueries = action.payload;
      })
      .addCase(fetchRecentQueries.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Fetch recent documents
      .addCase(fetchRecentDocuments.pending, (state) => {
        // Don't show loading for individual requests if stats are loading
        state.error = null;
      })
      .addCase(fetchRecentDocuments.fulfilled, (state, action) => {
        state.recentDocuments = action.payload;
      })
      .addCase(fetchRecentDocuments.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setStats,
  setRecentQueries,
  addRecentQuery,
  setRecentDocuments,
  setDocumentDistribution,
  setLoading,
  setError,
  resetDashboard,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;