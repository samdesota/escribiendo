// Core interfaces for LLM provider abstraction

export interface ChatSuggestionRequest {
  userInput: string;
  chatContext?: string;
}

export interface ChatSuggestionResponse {
  suggestion: string;
  processingTime?: number;
  error?: string;
}

export interface SideChatRequest {
  originalContext: string;
  spanishSuggestion: string;
  studentMessage: string;
}

export interface SideChatResponse {
  response: string;
  processingTime?: number;
  error?: string;
}

export interface RegularChatRequest {
  userMessage: string;
  chatHistory?: string;
}

export interface RegularChatResponse {
  response: string;
  processingTime?: number;
  error?: string;
}

export interface StreamingChatCallbacks {
  onTextChunk: (chunk: string) => void;
  onComplete: (finalText: string) => void;
  onError: (error: string) => void;
}

export interface TranslationRequest {
  selectedText: string;
  contextMessage: string;
  chatContext?: string;
}

export interface TranslationResponse {
  translation: string;
  processingTime?: number;
  error?: string;
}

export interface ConversationStartersResponse {
  assistantQuestions: string[];
  userQuestions: string[];
  processingTime?: number;
  error?: string;
}

export interface LLMModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  displayName: string;
  maxTokens: {
    suggestion: number;
    chat: number;
    sideChat: number;
    translation: number;
    conversationStarters: number;
  };
  temperature: {
    suggestion: number;
    chat: number;
    sideChat: number;
    translation: number;
    conversationStarters: number;
  };
}

export interface LLMProvider {
  getSuggestion(request: ChatSuggestionRequest): Promise<ChatSuggestionResponse>;
  getRegularChatResponseStreaming(request: RegularChatRequest, callbacks: StreamingChatCallbacks): Promise<void>;
  getRegularChatResponse(request: RegularChatRequest): Promise<RegularChatResponse>;
  getSideChatResponse(request: SideChatRequest): Promise<SideChatResponse>;
  getTranslation(request: TranslationRequest): Promise<TranslationResponse>;
  getConversationStarters(previousAssistantQuestions?: string[], previousUserQuestions?: string[]): Promise<ConversationStartersResponse>;
}

export const AVAILABLE_MODELS: Record<string, LLMModelConfig> = {
  'claude-3.5-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    maxTokens: {
      suggestion: 200,
      chat: 600,
      sideChat: 800,
      translation: 200,
      conversationStarters: 200
    },
    temperature: {
      suggestion: 0.3,
      chat: 0.7,
      sideChat: 0.4,
      translation: 0.2,
      conversationStarters: 0.8
    }
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    maxTokens: {
      suggestion: 200,
      chat: 600,
      sideChat: 800,
      translation: 200,
      conversationStarters: 200
    },
    temperature: {
      suggestion: 0.3,
      chat: 0.7,
      sideChat: 0.4,
      translation: 0.2,
      conversationStarters: 0.8
    }
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    maxTokens: {
      suggestion: 200,
      chat: 600,
      sideChat: 800,
      translation: 200,
      conversationStarters: 200
    },
    temperature: {
      suggestion: 0.3,
      chat: 0.7,
      sideChat: 0.4,
      translation: 0.2,
      conversationStarters: 0.8
    }
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    maxTokens: {
      suggestion: 200,
      chat: 600,
      sideChat: 800,
      translation: 200,
      conversationStarters: 200
    },
    temperature: {
      suggestion: 0.3,
      chat: 0.7,
      sideChat: 0.4,
      translation: 0.2,
      conversationStarters: 0.8
    }
  }
};