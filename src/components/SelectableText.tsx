import { createSignal, createEffect, onMount, onCleanup, children } from 'solid-js';
import { ClientLLMService, type TranslationRequest, type TranslationResponse } from '~/services/llm';

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
  onDiscussTranslation?: (selectedText: string, translation: string, context: string) => void;
  enableDiscussion?: boolean;
}

export default function SelectableText(props: SelectableTextProps) {
  const c = children(() => props.children);
  
  // Text selection state
  const [textSelectionState, setTextSelectionState] = createSignal<TextSelectionState>({
    isActive: false,
    selectedText: '',
    elementId: '',
    elementContent: '',
    selectionRect: null,
    translation: '',
    isLoading: false
  });

  // Generate unique element ID for this instance
  const elementId = `selectable-text-${Math.random().toString(36).substr(2, 9)}`;

  // Handle text selection for translation
  const handleTextSelection = async () => {
    if (typeof window === 'undefined') return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Clear selection state if no text is selected
      setTextSelectionState(prev => ({ ...prev, isActive: false }));
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setTextSelectionState(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Find the selectable element that contains the selection
    const range = selection.getRangeAt(0);
    const selectableElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement?.closest(`[data-selectable-id="${elementId}"]`)
      : range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer.closest(`[data-selectable-id="${elementId}"]`)
        : null;

    if (!selectableElement) {
      setTextSelectionState(prev => ({ ...prev, isActive: false }));
      return;
    }

    const elementContent = selectableElement.textContent || '';
    
    // Get selection bounding rect for tooltip positioning
    const selectionRect = range.getBoundingClientRect();

    // Update selection state
    setTextSelectionState(prev => ({
      ...prev,
      isActive: true,
      selectedText,
      elementId,
      elementContent,
      selectionRect,
      translation: '',
      isLoading: false
    }));

    // Clear existing debounce timeout
    const timeout = textSelectionState().debounceTimeout;
    if (timeout) {
      clearTimeout(timeout);
    }

    // Debounce the translation request (500ms)
    const newTimeout = setTimeout(async () => {
      await requestTranslation(selectedText, elementContent);
    }, 500);

    setTextSelectionState(prev => ({
      ...prev,
      debounceTimeout: newTimeout
    }));
  };

  // Request translation from LLM
  const requestTranslation = async (selectedText: string, elementContent: string) => {
    if (!selectedText.trim()) return;
    
    setTextSelectionState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const request: TranslationRequest = {
        selectedText,
        contextMessage: elementContent,
        chatContext: props.additionalContext || ''
      };
      
      const response = await props.translationService.getTranslation(request);
      
      if (response.error) {
        console.error('Translation error:', response.error);
        setTextSelectionState(prev => ({ 
          ...prev, 
          isLoading: false,
          translation: 'Translation failed'
        }));
      } else {
        setTextSelectionState(prev => ({ 
          ...prev, 
          isLoading: false,
          translation: response.translation
        }));

        // Call callback if provided
        if (props.onTranslationReady) {
          props.onTranslationReady(selectedText, response.translation);
        }
      }
      
    } catch (error) {
      console.error('Failed to get translation:', error);
      setTextSelectionState(prev => ({ 
        ...prev, 
        isLoading: false,
        translation: 'Translation failed'
      }));
    }
  };

  // Handle discussion button click
  const handleDiscussTranslation = () => {
    const state = textSelectionState();
    if (props.onDiscussTranslation && state.selectedText && state.translation) {
      props.onDiscussTranslation(
        state.selectedText, 
        state.translation, 
        props.additionalContext || state.elementContent
      );
    }
    // Clear the selection state
    setTextSelectionState(prev => ({ ...prev, isActive: false }));
  };

  // Handle clicking outside to clear selection
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest(`[data-selectable-id="${elementId}"]`) && 
        !target.closest('.translation-tooltip')) {
      setTextSelectionState(prev => ({ ...prev, isActive: false }));
    }
  };

  // Initialize on mount (client-side only)
  onMount(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('selectionchange', handleTextSelection);
      document.addEventListener('click', handleClickOutside);
    }
  });

  // Cleanup timeouts and event listeners
  onCleanup(() => {
    const selectionTimeout = textSelectionState().debounceTimeout;
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    
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
      {textSelectionState().isActive && textSelectionState().selectionRect && (
        <TranslationTooltip
          selectedText={textSelectionState().selectedText}
          translation={textSelectionState().translation}
          isLoading={textSelectionState().isLoading}
          selectionRect={textSelectionState().selectionRect!}
          onDiscussTranslation={props.enableDiscussion ? handleDiscussTranslation : undefined}
        />
      )}
    </>
  );
}

// Translation Tooltip Component
interface TranslationTooltipProps {
  selectedText: string;
  translation: string;
  isLoading: boolean;
  selectionRect: DOMRect;
  onDiscussTranslation?: () => void;
}

function TranslationTooltip(props: TranslationTooltipProps) {
  // Calculate position based on selection rect
  const getTooltipStyle = () => {
    const rect = props.selectionRect;
    const tooltipWidth = 300;
    const tooltipHeight = 120;
    
    // Position below the selection by default
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.bottom + 8;
    
    // Adjust if going off screen
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    // If tooltip goes below viewport, position above selection
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = rect.top - tooltipHeight - 8;
    }
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      'z-index': '1000',
      width: `${tooltipWidth}px`
    };
  };

  return (
    <div 
      style={getTooltipStyle()}
      class="translation-tooltip bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <div class="space-y-2">
        <div class="text-xs text-gray-500 font-medium">
          Selected: "{props.selectedText}"
        </div>
        
        <div class="text-sm">
          {props.isLoading ? (
            <div class="flex items-center gap-2 text-gray-600">
              <div class="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
              <span>Translating...</span>
            </div>
          ) : props.translation ? (
            <div>
              <div class="text-xs text-gray-500 mb-1">Translation:</div>
              <div class="text-gray-800 font-medium">"{props.translation}"</div>
            </div>
          ) : (
            <div class="text-gray-500 text-xs">
              Translation will appear shortly...
            </div>
          )}
        </div>
        
        {props.translation && !props.isLoading && props.onDiscussTranslation && (
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={props.onDiscussTranslation}
              class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Discuss Translation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}