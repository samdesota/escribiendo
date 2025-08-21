import { createSignal } from 'solid-js';
import { createAtom } from '~/utils/signal';
import { LLMService, type LLMBatchResponse, type LLMSuggestion, type LLMCombinedRequest } from '~/services/llm';
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
  private currentLLMSuggestions: LLMSuggestion[] = []; // Keep track of raw LLM suggestions
  private options: LLMSuggestionManagerOptions;
  private autoTriggerTimer: NodeJS.Timeout | null = null;
  private lastTextForSuggestions: string = '';
  private lastSuggestionTime: number = 0;
  private isAutoTriggerEnabled: boolean = true;
  private currentText = '';

  // Color mapping for different suggestion types
  private readonly colors = {
    grammar: '#ef4444',      // Red for grammar errors
    'natural-phrases': '#f59e0b', // Amber for natural phrases
    'english-words': '#3b82f6'    // Blue for English words
  };

  constructor(options: LLMSuggestionManagerOptions = {}) {
    this.llmService = new LLMService();
    this.options = options;
    this.startAutoTrigger();
  }

  /**
   * Get suggestions for the given text using all three analysis types (public API)
   */
  async getSuggestionsForText(text: string): Promise<void> {
    await this.getSuggestionsForTextInternal(text, false);
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

  /**
   * Start auto-triggering suggestions every 5 seconds
   */
  private startAutoTrigger(): void {
    this.autoTriggerTimer = setInterval(() => {
      this.checkAndTriggerSuggestions();
    }, 5000); // 5 seconds
  }

  /**
   * Stop auto-triggering
   */
  stopAutoTrigger(): void {
    if (this.autoTriggerTimer) {
      clearInterval(this.autoTriggerTimer);
      this.autoTriggerTimer = null;
    }
  }

  /**
   * Enable or disable auto-triggering
   */
  setAutoTriggerEnabled(enabled: boolean): void {
    this.isAutoTriggerEnabled = enabled;
  }

  /**
   * Update text for auto-trigger tracking (call this when text changes)
   */
  updateText(newText: string): void {
    this.currentText = newText;
  }

  /**
   * Check if we should trigger suggestions and do so if needed
   */
  private async checkAndTriggerSuggestions(): Promise<void> {
    if (!this.isAutoTriggerEnabled || !this.currentText) {
      return;
    }
    
    if (this.currentText.length < 15) {
      return;
    }

    
    if (this.currentText !== this.lastTextForSuggestions) { 
      await this.getSuggestionsForTextInternal(this.currentText, true);
    }
  }

  /**
   * Internal method to get suggestions with auto-trigger support
   */
  private async getSuggestionsForTextInternal(text: string, isAutoTriggered: boolean = false): Promise<void> {
    if (!text.trim()) {
      this.updateAnnotations([]);
      this.currentLLMSuggestions = [];
      return;
    }

    // Set loading state
    this.updateLoadingState({
      grammar: true,
      naturalPhrases: true,
      englishWords: true,
      isAnyLoading: true
    });

    this.lastTextForSuggestions = text;

    try {
      // Use the new combined method with previous suggestions for stability
      const request: LLMCombinedRequest = {
        text,
        targetLanguage: 'colombian-spanish',
        previousSuggestions: this.currentLLMSuggestions
      };

      const combinedResponse = await this.llmService.getCombinedSuggestions(request);
      
      // Update our current suggestions tracking
      this.currentLLMSuggestions = combinedResponse.suggestions;
      this.lastSuggestionTime = Date.now();

      const annotations = this.convertCombinedSuggestionsToAnnotations(text, combinedResponse.suggestions);
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
   * Convert combined LLM suggestions to ExternalAnnotation format
   */
  private convertCombinedSuggestionsToAnnotations(text: string, suggestions: LLMSuggestion[]): ExternalAnnotation[] {
    return suggestions.map((suggestion, index) => {
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

      return annotation;
    });
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy(): void {
    this.stopAutoTrigger();
  }
}
