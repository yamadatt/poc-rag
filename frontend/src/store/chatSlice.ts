import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ChatState, ChatMessage } from '../types/chat';
import APIService from '../services/api';

const initialState: ChatState = {
  messages: [],
  currentInput: '',
  isLoading: false,
  error: null,
};

// Async thunk for sending messages
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (message: string, { rejectWithValue }) => {
    try {
      const apiService = new APIService(import.meta.env.VITE_API_URL || 'http://localhost:8000');
      const response = await apiService.sendQuery({ question: message });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to send message');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Message operations
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      state.error = null;
    },
    
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload;
      state.error = null;
    },
    
    updateLastMessage: (state, action: PayloadAction<ChatMessage>) => {
      if (state.messages.length > 0) {
        state.messages[state.messages.length - 1] = action.payload;
      }
    },
    
    clearMessages: (state) => {
      state.messages = [];
      state.currentInput = '';
      state.error = null;
    },
    
    // Input operations
    setCurrentInput: (state, action: PayloadAction<string>) => {
      state.currentInput = action.payload;
    },
    
    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: action.meta.arg,
          timestamp: new Date().toISOString(),
        };
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: action.payload.answer,
          sources: action.payload.sources,
          timestamp: new Date().toISOString(),
        };
        state.messages.push(userMessage, assistantMessage);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addMessage,
  setMessages,
  updateLastMessage,
  clearMessages,
  setCurrentInput,
  setLoading,
  setError,
  clearError,
} = chatSlice.actions;

export default chatSlice.reducer;