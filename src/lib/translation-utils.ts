import { createSignal, createEffect, onCleanup } from 'solid-js';
import { ClientLLMService, type TranslationRequest } from '~/services/llm';

export interface TranslationState {
  isActive: boolean;
  selectedText: string;
  translation: string;
  isLoading: boolean;
  selectionRect?: DOMRect | null;
  position?: { x: number; y: number };
}

export interface DebouncedTranslationOptions {
  debounceMs?: number;
  onTranslationReady?: (selectedText: string, translation: string) => void;
  onError?: (error: string) => void;
}

export function createDebouncedTranslation(
  llmService: ClientLLMService,
  options: DebouncedTranslationOptions = {}
) {
  const { debounceMs = 500, onTranslationReady, onError } = options;

  const [translationState, setTranslationState] =
    createSignal<TranslationState>({
      isActive: false,
      selectedText: '',
      translation: '',
      isLoading: false,
    });

  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Clear any existing timeout
  const clearDebounce = () => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
  };

  // Request translation with debouncing
  const requestTranslation = async (
    selectedText: string,
    contextMessage: string,
    chatContext?: string,
    selectionRect?: DOMRect | null,
    position?: { x: number; y: number }
  ) => {
    if (!selectedText.trim()) return;

    // Clear existing timeout
    clearDebounce();

    // Set loading state immediately
    setTranslationState(prev => ({
      ...prev,
      isActive: true,
      selectedText: selectedText.trim(),
      translation: '',
      isLoading: true,
      selectionRect,
      position,
    }));

    // Set new debounced timeout
    debounceTimeout = setTimeout(async () => {
      try {
        const request: TranslationRequest = {
          selectedText: selectedText.trim(),
          contextMessage,
          chatContext: chatContext || '',
        };

        const response = await llmService.getTranslation(request);

        if (response.error) {
          console.error('Translation error:', response.error);
          const errorMsg = 'Translation failed';
          setTranslationState(prev => ({
            ...prev,
            isLoading: false,
            translation: errorMsg,
          }));
          onError?.(errorMsg);
        } else {
          setTranslationState(prev => ({
            ...prev,
            isLoading: false,
            translation: response.translation,
          }));
          onTranslationReady?.(selectedText.trim(), response.translation);
        }
      } catch (error) {
        console.error('Failed to get translation:', error);
        const errorMsg = 'Translation failed';
        setTranslationState(prev => ({
          ...prev,
          isLoading: false,
          translation: errorMsg,
        }));
        onError?.(errorMsg);
      }
    }, debounceMs);
  };

  // Clear translation state
  const clearTranslation = () => {
    setTranslationState(prev => ({ ...prev, isActive: false }));
  };

  // Cleanup function
  const cleanup = () => {
    clearDebounce();
  };

  // Auto-cleanup on component unmount
  onCleanup(cleanup);

  return {
    translationState,
    requestTranslation,
    clearTranslation,
    clearDebounce,
  };
}
