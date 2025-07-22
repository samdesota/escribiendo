// Translation Chat Service Types

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TranslationRequest {
  message: string;
  editorContext?: string; // Current editor content for context
  chatHistory?: ChatMessage[]; // Previous conversation for context
}

export interface TranslationResponse {
  message: string;
  processingTime?: number;
  error?: string;
}

export interface StreamingTranslationResponse {
  onTextChunk: (chunk: string) => void;
  onComplete: (finalMessage: string) => void;
  onError: (error: string) => void;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
}

// For quick translation detection
export interface QuickTranslationResult {
  isQuickTranslation: boolean;
  translation?: string;
  explanation?: string;
}
