export interface Source {
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

export interface ChatState {
  messages: ChatMessage[];
  currentInput: string;
  isLoading: boolean;
  error: string | null;
}