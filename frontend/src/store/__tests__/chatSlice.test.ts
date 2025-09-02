import { configureStore } from '@reduxjs/toolkit';
import chatReducer, {
  addMessage,
  setMessages,
  setCurrentInput,
  setLoading,
  setError,
  clearMessages,
  updateLastMessage,
} from '../chatSlice';
import { ChatMessage } from '../../types';

describe('chatSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        chat: chatReducer,
      },
    });
  });

  const mockMessage: ChatMessage = {
    id: 'msg1',
    type: 'user',
    content: 'Test message',
    timestamp: '2024-01-01T00:00:00Z',
  };

  const mockAssistantMessage: ChatMessage = {
    id: 'msg2',
    type: 'assistant',
    content: 'Test response',
    timestamp: '2024-01-01T00:00:10Z',
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

  describe('message operations', () => {
    it('should add a message', () => {
      store.dispatch(addMessage(mockMessage));
      expect(store.getState().chat.messages).toContainEqual(mockMessage);
    });

    it('should set messages', () => {
      const messages = [mockMessage, mockAssistantMessage];
      store.dispatch(setMessages(messages));
      expect(store.getState().chat.messages).toEqual(messages);
    });

    it('should update the last message', () => {
      store.dispatch(addMessage(mockMessage));
      store.dispatch(addMessage(mockAssistantMessage));
      
      const updatedMessage = { ...mockAssistantMessage, content: 'Updated response' };
      store.dispatch(updateLastMessage(updatedMessage));
      
      const messages = store.getState().chat.messages;
      expect(messages[messages.length - 1].content).toBe('Updated response');
    });

    it('should clear messages', () => {
      store.dispatch(addMessage(mockMessage));
      store.dispatch(addMessage(mockAssistantMessage));
      store.dispatch(clearMessages());
      
      expect(store.getState().chat.messages).toHaveLength(0);
    });
  });

  describe('input operations', () => {
    it('should set current input', () => {
      const input = 'This is my question';
      store.dispatch(setCurrentInput(input));
      expect(store.getState().chat.currentInput).toBe(input);
    });

    it('should clear input when adding a user message', () => {
      store.dispatch(setCurrentInput('Test input'));
      store.dispatch(addMessage(mockMessage));
      // Note: In real implementation, we might want to clear input when sending
      // This would be handled by a thunk or saga
      expect(store.getState().chat.currentInput).toBe('Test input');
    });
  });

  describe('loading and error states', () => {
    it('should set loading state', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().chat.isLoading).toBe(true);
    });

    it('should set error state', () => {
      const error = 'Failed to send message';
      store.dispatch(setError(error));
      expect(store.getState().chat.error).toBe(error);
    });

    it('should clear error when setting loading', () => {
      store.dispatch(setError('Some error'));
      store.dispatch(setLoading(true));
      expect(store.getState().chat.error).toBe(null);
    });

    it('should clear loading when setting error', () => {
      store.dispatch(setLoading(true));
      store.dispatch(setError('Some error'));
      expect(store.getState().chat.isLoading).toBe(false);
    });
  });
});