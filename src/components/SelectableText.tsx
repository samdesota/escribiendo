import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  children,
} from 'solid-js';
import {
  ClientLLMService,
  type TranslationRequest,
  type TranslationResponse,
} from '~/services/llm';
import {
  createDebouncedTranslation,
  type TranslationState,
} from '~/lib/translation-utils';
import TranslationTooltip from './TranslationTooltip';

export interface TextSelectionState {
  isActive: boolean;
  selectedText: string;
  elementId: string;
  elementContent: string;
  selectionRect: DOMRect | null;
  translation: string;
  isLoading: boolean;
  debounceTimeout?: ReturnType<typeof setTimeout>;
}

export interface SelectableTextProps {
  children: any;
  translationService: ClientLLMService;
  additionalContext?: string;
  className?: string;
  onTranslationReady?: (selectedText: string, translation: string) => void;
  onDiscussTranslation?: (
    selectedText: string,
    translation: string,
    context: string
  ) => void;
  enableDiscussion?: boolean;
}

export default function SelectableText(props: SelectableTextProps) {
  const c = children(() => props.children);

  // Use shared debounced translation utility
  const { translationState, requestTranslation, clearTranslation } =
    createDebouncedTranslation(props.translationService, {
      onTranslationReady: props.onTranslationReady,
    });

  // Generate unique element ID for this instance
  const elementId = `selectable-text-${Math.random().toString(36).substr(2, 9)}`;

  // Handle text selection for translation
  const handleTextSelection = async () => {
    if (typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Clear selection state if no text is selected
      clearTranslation();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      clearTranslation();
      return;
    }

    // Find the selectable element that contains the selection
    const range = selection.getRangeAt(0);
    const selectableElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement?.closest(
            `[data-selectable-id="${elementId}"]`
          )
        : range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer.closest(
              `[data-selectable-id="${elementId}"]`
            )
          : null;

    if (!selectableElement) {
      clearTranslation();
      return;
    }

    const elementContent = selectableElement.textContent || '';

    // Get selection bounding rect for tooltip positioning
    const selectionRect = range.getBoundingClientRect();

    // Use shared translation utility with debouncing
    await requestTranslation(
      selectedText,
      elementContent,
      props.additionalContext || '',
      selectionRect
    );
  };

  // Handle discussion button click
  const handleDiscussTranslation = () => {
    const state = translationState();
    if (props.onDiscussTranslation && state.selectedText && state.translation) {
      props.onDiscussTranslation(
        state.selectedText,
        state.translation,
        props.additionalContext || ''
      );
    }
    // Clear the selection state
    clearTranslation();
  };

  // Handle clicking outside to clear selection
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (
      !target.closest(`[data-selectable-id="${elementId}"]`) &&
      !target.closest('.translation-tooltip')
    ) {
      clearTranslation();
    }
  };

  // Initialize on mount (client-side only)
  onMount(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('selectionchange', handleTextSelection);
      document.addEventListener('click', handleClickOutside);
    }
  });

  // Cleanup event listeners
  onCleanup(() => {
    // Remove event listeners
    if (typeof window !== 'undefined') {
      document.removeEventListener('selectionchange', handleTextSelection);
      document.removeEventListener('click', handleClickOutside);
    }
  });

  return (
    <>
      {/* Wrapped content with selectable attribute */}
      <div
        data-selectable-id={elementId}
        class={props.className || ''}
        style={{ 'user-select': 'text' }}
      >
        {c()}
      </div>

      {/* Translation Tooltip */}
      {translationState().isActive && translationState().selectionRect && (
        <TranslationTooltip
          selectedText={translationState().selectedText}
          translation={translationState().translation}
          isLoading={translationState().isLoading}
          selectionRect={translationState().selectionRect!}
          onDiscussTranslation={
            props.enableDiscussion ? handleDiscussTranslation : undefined
          }
        />
      )}
    </>
  );
}
