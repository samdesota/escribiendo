import { Component, createSignal } from 'solid-js';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: Component<ChatInputProps> = (props) => {
  const [inputValue, setInputValue] = createSignal('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const message = inputValue().trim();
    if (message && !props.disabled) {
      props.onSendMessage(message);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-2 p-3 border-t border-gray-200 bg-white">
      <input
        type="text"
        value={inputValue()}
        onInput={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={props.disabled}
        placeholder={props.placeholder || "Type a word or phrase to translate..."}
        class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
      />
      <button
        type="submit"
        disabled={props.disabled || !inputValue().trim()}
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        Send
      </button>
    </form>
  );
};

export default ChatInput;
