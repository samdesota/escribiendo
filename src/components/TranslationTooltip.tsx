export interface TranslationTooltipProps {
  selectedText: string;
  translation: string;
  isLoading: boolean;
  // Support both positioning methods
  selectionRect?: DOMRect;
  position?: { x: number; y: number };
  // Support different callback names for backwards compatibility
  onDiscussTranslation?: () => void;
  onOpenSideChat?: () => void;
}

export default function TranslationTooltip(props: TranslationTooltipProps) {
  // Calculate position based on either selectionRect or position
  const getTooltipStyle = () => {
    const tooltipWidth = 300;
    const tooltipHeight = 120;
    
    let left: number;
    let top: number;
    
    if (props.selectionRect) {
      // Position based on selection rect (SelectableText and ChatConversation)
      const rect = props.selectionRect;
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      top = rect.bottom + 8;
      
      // Adjust if going off screen
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      // If tooltip goes below viewport, position above selection
      if (top + tooltipHeight > window.innerHeight - 10) {
        top = rect.top - tooltipHeight - 8;
      }
    } else if (props.position) {
      // Position based on x,y coordinates (JournalEditor)
      left = props.position.x - (tooltipWidth / 2);
      top = props.position.y + 20;
      
      // Adjust if going off screen
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      // If tooltip goes below viewport, position above
      if (top + tooltipHeight > window.innerHeight - 10) {
        top = props.position.y - tooltipHeight - 10;
      }
    } else {
      // Fallback to center of screen
      left = (window.innerWidth - tooltipWidth) / 2;
      top = (window.innerHeight - tooltipHeight) / 2;
    }
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      'z-index': '1000',
      width: `${tooltipWidth}px`
    };
  };

  // Determine which callback to use
  const handleDiscussClick = () => {
    if (props.onDiscussTranslation) {
      props.onDiscussTranslation();
    } else if (props.onOpenSideChat) {
      props.onOpenSideChat();
    }
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
        
        {props.translation && !props.isLoading && (props.onDiscussTranslation || props.onOpenSideChat) && (
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleDiscussClick}
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