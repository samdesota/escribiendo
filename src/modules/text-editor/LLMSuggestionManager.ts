import { createSignal } from 'solid-js';
import { createAtom } from '~/utils/signal';
import { LLMService, type LLMBatchResponse, type LLMSuggestion } from '~/services/llm';
import type { ExternalAnnotation } from './TextEditorAnnotations';

export interface LLMSuggestionManagerOptions {
  onAnnotationsUpdate?: (annotations: ExternalAnnotation[]) => void;
  onLoadingStateChange?: (loading: LoadingState) => void;
}

export interface LoadingState {
  grammar: boolean;
  naturalPhrases: boolean;
  englishWords: boolean;
  isAnyLoading: boolean;
}

export class LLMSuggestionManager {
  private llmService: LLMService;
  private currentSuggestions = createAtom<ExternalAnnotation[]>([]);
  private options: LLMSuggestionManagerOptions;

  // Color mapping for different suggestion types
  private readonly colors = {
    grammar: '#ef4444',      // Red for grammar errors
    'natural-phrases': '#f59e0b', // Amber for natural phrases
    'english-words': '#3b82f6'    // Blue for English words
  };

  constructor(options: LLMSuggestionManagerOptions = {}) {
    this.llmService = new LLMService();
    this.options = options;
  }

  /**
   * Get suggestions for the given text using all three analysis types
   */
  async getSuggestionsForText(text: string): Promise<void> {
    if (!text.trim()) {
      this.updateAnnotations([]);
      return;
    }

    // Set loading state
    this.updateLoadingState({
      grammar: true,
      naturalPhrases: true,
      englishWords: true,
      isAnyLoading: true
    });

    try {
      const batchResponse = await this.llmService.getBatchSuggestions({
        text,
        requests: {
          grammar: true,
          naturalPhrases: true,
          englishWords: true
        }
      });

      const annotations = this.convertSuggestionsToAnnotations(text, batchResponse);
      this.updateAnnotations(annotations);

    } catch (error) {
      console.error('Error getting LLM suggestions:', error);
      this.updateAnnotations([]);
    } finally {
      // Clear loading state
      this.updateLoadingState({
        grammar: false,
        naturalPhrases: false,
        englishWords: false,
        isAnyLoading: false
      });
    }
  }

  /**
   * Convert LLM suggestions to ExternalAnnotation format
   */
  private convertSuggestionsToAnnotations(text: string, batchResponse: LLMBatchResponse): ExternalAnnotation[] {
    const annotations: ExternalAnnotation[] = [];

    // Process each type of suggestion
    const allSuggestions = [
      ...batchResponse.grammar.suggestions,
      ...batchResponse.naturalPhrases.suggestions,
      ...batchResponse.englishWords.suggestions
    ];

    allSuggestions.forEach((suggestion, index) => {
      const coordinates = LLMService.flatOffsetsToCoordinates(
        text,
        suggestion.startOffset,
        suggestion.endOffset
      );

      const annotation: ExternalAnnotation = {
        id: `${suggestion.type}-${index}-${Date.now()}`,
        startParagraph: coordinates.startParagraph,
        startOffset: coordinates.startOffset,
        endParagraph: coordinates.endParagraph,
        endOffset: coordinates.endOffset,
        color: this.colors[suggestion.type] || '#6b7280',
        description: this.formatSuggestionDescription(suggestion)
      };

      annotations.push(annotation);
    });

    return annotations;
  }

  /**
   * Format suggestion into a readable description
   */
  private formatSuggestionDescription(suggestion: LLMSuggestion): string {
    const typeLabel = {
      grammar: 'Grammar',
      'natural-phrases': 'Natural Phrase',
      'english-words': 'English Word'
    }[suggestion.type] || 'Suggestion';

    return `${typeLabel}: "${suggestion.originalText}" → "${suggestion.suggestedText}"\n${suggestion.explanation}`;
  }

  /**
   * Update annotations and notify subscribers
   */
  private updateAnnotations(annotations: ExternalAnnotation[]): void {
    this.currentSuggestions.set(annotations);
    if (this.options.onAnnotationsUpdate) {
      this.options.onAnnotationsUpdate(annotations);
    }
  }

  /**
   * Update loading state and notify subscribers
   */
  private updateLoadingState(loadingState: LoadingState): void {
    if (this.options.onLoadingStateChange) {
      this.options.onLoadingStateChange(loadingState);
    }
  }

  /**
   * Get current suggestions
   */
  getCurrentSuggestions(): ExternalAnnotation[] {
    return this.currentSuggestions();
  }

  /**
   * Clear all current suggestions
   */
  clearSuggestions(): void {
    this.updateAnnotations([]);
  }

  /**
   * Dismiss a specific suggestion by ID
   */
  dismissSuggestion(suggestionId: string): void {
    const currentSuggestions = this.currentSuggestions();
    const filteredSuggestions = currentSuggestions.filter(s => s.id !== suggestionId);
    this.updateAnnotations(filteredSuggestions);
  }

  /**
   * Get suggestions grouped by type for display
   */
  getSuggestionsByType(): {
    grammar: ExternalAnnotation[];
    naturalPhrases: ExternalAnnotation[];
    englishWords: ExternalAnnotation[]
  } {
    const suggestions = this.currentSuggestions();
    return {
      grammar: suggestions.filter(s => s.id.startsWith('grammar-')),
      naturalPhrases: suggestions.filter(s => s.id.startsWith('natural-phrases-')),
      englishWords: suggestions.filter(s => s.id.startsWith('english-words-'))
    };
  }
}
