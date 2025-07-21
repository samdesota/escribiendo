// LLM Service Types for Colombian Spanish Language Learning

export type SuggestionType = 'grammar' | 'natural-phrases' | 'english-words';

export interface LLMSuggestionRequest {
  text: string;
  type: SuggestionType;
  targetLanguage: 'colombian-spanish';
}

export interface LLMSuggestion {
  startOffset: number;
  endOffset: number;
  originalText: string;
  suggestedText: string;
  explanation: string; // In English for learner understanding
  confidence: number;
  type: SuggestionType;
}

export interface LLMSuggestionResponse {
  suggestions: LLMSuggestion[];
  processingTime?: number;
  error?: string;
}

export interface LLMBatchRequest {
  text: string;
  requests: {
    grammar: boolean;
    naturalPhrases: boolean;
    englishWords: boolean;
  };
}

export interface LLMBatchResponse {
  grammar: LLMSuggestionResponse;
  naturalPhrases: LLMSuggestionResponse;
  englishWords: LLMSuggestionResponse;
}

// For integration with existing annotation system
export interface SuggestionAnnotation {
  id: string;
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  color: string;
  description: string;
  suggestion: LLMSuggestion;
}
