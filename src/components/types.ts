export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: number;
  isComplete?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  model?: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface SuggestionState {
  isActive: boolean;
  partialText: string;
  debounceTimeout?: ReturnType<typeof setTimeout>;
  isLoading: boolean;
  currentSuggestion: string;
}

export interface SideChatState {
  isOpen: boolean;
  context: string;
  suggestion: string;
  messages: ChatMessage[];
}

export interface TextSelectionState {
  isActive: boolean;
  selectedText: string;
  messageId: string;
  messageContent: string;
  selectionRect: DOMRect | null;
  translation: string;
  isLoading: boolean;
  debounceTimeout?: ReturnType<typeof setTimeout>;
}