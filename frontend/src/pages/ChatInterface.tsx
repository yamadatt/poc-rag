import React, { useState, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../utils/api';

// Simple types
interface Source {
  chunkId: string;
  documentName: string;
  content: string;
  score: number;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

// Mock data
const mockMessages: Message[] = [
  {
    id: '1',
    type: 'user',
    content: 'TypeScriptの型定義について教えてください',
    timestamp: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    type: 'assistant',
    content: 'TypeScriptの型定義について説明します。\n\nTypeScriptでは以下のような型定義が可能です：\n\n1. 基本型（string, number, boolean）\n2. オブジェクト型とinterface\n3. 配列型とタプル\n4. 関数型\n5. ユニオン型と交差型\n\n詳細については、参考文献をご確認ください。',
    timestamp: '2024-01-15T10:30:05Z',
    sources: [
      {
        chunkId: 'chunk-1',
        documentName: 'typescript-guide.pdf',
        content: 'TypeScriptは静的型付け言語であり、JavaScriptに型システムを追加します。基本型としてstring、number、boolean、undefinedなどがあります...',
        score: 0.95,
      },
      {
        chunkId: 'chunk-2',
        documentName: 'typescript-advanced.pdf',
        content: 'interfaceを使用してオブジェクトの形状を定義できます。例：interface User { name: string; age: number; }',
        score: 0.87,
      },
    ],
  },
  {
    id: '3',
    type: 'user',
    content: 'Reactのパフォーマンス最適化についても教えてください',
    timestamp: '2024-01-15T10:32:00Z',
  },
];

// Helper functions
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('ja-JP');
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [currentInput, setCurrentInput] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Ref for message container to enable auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Effect to scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Show notification helper
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        // Fallback method for older browsers or non-HTTPS contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            showNotification('✅ クリップボードにコピーしました');
            // Text copied successfully
          } else {
            throw new Error('Copy command failed');
          }
        } catch (error) {
          document.body.removeChild(textArea);
          throw error;
        }
      } else {
        // Modern clipboard API
        await navigator.clipboard.writeText(text);
        showNotification('✅ クリップボードにコピーしました');
      }
    } catch {
      // Failed to copy text
      showNotification('❌ コピーに失敗しました', 'error');
      
      // Alternative: Alert the user
      alert('コピーに失敗しました。手動でテキストを選択してコピーしてください。');
    }
  };

  const toggleSourceExpansion = (sourceId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading) return;

    const userQuestion = currentInput;
    // Sending message
    setMessageCount(prev => prev + 1);
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userQuestion,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');

    try {
      // Call actual API
      const response = await apiClient.queryDocuments({
        question: userQuestion,
        max_results: 5,
      });

      if (response.success && response.data) {
        // Create AI response from API data
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.data.answer,
          timestamp: new Date().toISOString(),
          sources: response.data.sources.map(source => ({
            chunkId: source.chunk_id,
            documentName: source.document_id, // Using document_id as document name for now
            content: source.content,
            score: source.score,
          })),
        };

        setMessages(prev => [...prev, aiMessage]);
        // AI response received from API
      } else {
        // Fallback response on API error
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `申し訳ございません。現在システムに問題が発生しており、質問にお答えできません。\n\nエラー: ${response.error || '不明なエラー'}`,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, errorMessage]);
        // API query failed
      }
    } catch (error) {
      // Fallback response on network error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `ネットワークエラーが発生しました。接続を確認してから再度お試しください。\n\nエラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
      // Network error occurred
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    // Clearing chat history
    setMessages([]);
    setExpandedSources({});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white relative">
      {/* Notification */}
      {notification && (
        <div
          className={`absolute top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">質問応答</h1>
        <button
          onClick={handleClearChat}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
          title="チャット履歴をクリア"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Debug Info */}
      <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="text-sm space-y-1">
          <p><strong>デバッグ情報:</strong></p>
          <p>API エンドポイント: <span className="font-mono text-xs break-all">{import.meta.env.VITE_API_URL}</span></p>
          <p>総メッセージ数: <span className="font-bold text-blue-600">{messages.length}</span></p>
          <p>送信回数: <span className="font-bold text-blue-600">{messageCount}</span></p>
          <p>状態: {isLoading ? '応答生成中' : 'アイドル'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">まだメッセージがありません</h3>
            <p className="mt-1 text-sm text-gray-500">質問を入力して会話を開始してください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl ${
                  message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                } rounded-lg p-4 shadow-sm`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-sm font-semibold text-gray-600">参考文献:</h4>
                          {message.sources.map((source) => (
                            <div key={source.chunkId} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                              <button
                                onClick={() => toggleSourceExpansion(source.chunkId)}
                                className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-gray-900">{source.documentName}</span>
                                  <span className="ml-2 text-sm text-gray-500">{Math.round(source.score * 100)}%</span>
                                </div>
                                {expandedSources[source.chunkId] ? 
                                  <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : 
                                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                }
                              </button>
                              {expandedSources[source.chunkId] && (
                                <div className="p-3 border-t border-gray-200 bg-gray-50">
                                  <p className="text-sm text-gray-700">{source.content}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className={`ml-2 p-1 rounded hover:bg-gray-200 transition-colors ${
                        message.type === 'user' ? 'hover:bg-blue-700 text-blue-200' : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="クリップボードにコピー"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className={`text-xs mt-2 ${
                    message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">回答を生成中...</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Scroll anchor - invisible element at the bottom */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="質問を入力してください..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!currentInput.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title="送信"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;