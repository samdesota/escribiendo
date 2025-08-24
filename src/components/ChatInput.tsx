import { createSignal, onMount } from 'solid-js';

export interface ChatInputProps {
  value: string;
  onInput: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onSend?: () => void;
  placeholder?: string;
  disabled?: boolean;
  showSendButton?: boolean;
  isLoading?: boolean;
  isActive?: boolean; // For suggestion mode styling
  tips?: string;
  size?: 'sm' | 'md'; // Size variants
}

export default function ChatInput(props: ChatInputProps) {
  let textareaRef: HTMLTextAreaElement | undefined;
  
  // Auto-resize functionality
  const adjustHeight = () => {
    if (textareaRef) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 150)}px`; // Max height of 150px
    }
  };

  // Adjust height when value changes
  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    props.onInput(target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle Enter key for sending
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.onSend?.();
    } else {
      props.onKeyDown?.(e);
    }
  };

  const handleSend = () => {
    props.onSend?.();
  };

  // Adjust height on mount and when value changes externally
  onMount(() => {
    adjustHeight();
  });

  // Watch for external value changes and adjust height
  const prevValue = createSignal(props.value);
  const [getValue, setValue] = prevValue;
  
  // Effect to adjust height when value changes externally
  const checkValueChange = () => {
    if (getValue() !== props.value) {
      setValue(props.value);
      setTimeout(adjustHeight, 0); // Use timeout to ensure DOM is updated
    }
  };
  
  // Check for value changes on each render
  checkValueChange();

  const sizeClasses = props.size === 'sm' 
    ? 'px-3 py-2 text-sm' 
    : 'px-3 py-2';

  const baseClasses = `flex-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto transition-all duration-200 ${sizeClasses}`;
  
  const activeClasses = props.isActive 
    ? 'ring-2 ring-amber-400 border-amber-400' 
    : '';

  const disabledClasses = props.disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : '';

  return (
    <div class="space-y-2">
      <div class="flex gap-2 items-end">
        <textarea
          ref={textareaRef!}
          value={props.value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          disabled={props.disabled}
          class={`${baseClasses} ${activeClasses} ${disabledClasses}`}
          rows="1"
          style={{ 
            'min-height': props.size === 'sm' ? '36px' : '40px',
            'max-height': '150px'
          }}
        />
        {props.showSendButton && (
          <button
            onClick={handleSend}
            disabled={!props.value.trim() || props.disabled || props.isLoading}
            class={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              props.size === 'sm' ? 'text-sm px-3 py-2' : ''
            }`}
          >
            {props.isLoading ? (
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span class="sr-only">Sending...</span>
              </div>
            ) : (
              'Send'
            )}
          </button>
        )}
      </div>
      
      {props.tips && (
        <div class={`text-gray-500 ${props.size === 'sm' ? 'text-xs' : 'text-xs'}`}>
          {props.tips}
        </div>
      )}
    </div>
  );
}