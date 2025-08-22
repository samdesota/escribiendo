import { createSignal, For, createEffect, Show } from 'solid-js';
import { ClientLLMService } from '~/services/llm';
import { type ChatMessage, type SideChatState } from './types';
import ChatInput from './ChatInput';

export interface SideChatProps {
  isOpen: boolean;
  context: string;
  suggestion: string;
  messages: ChatMessage[];
  chatSuggestionService: ClientLLMService;
  onClose: () => void;
  onSendMessage: (message: ChatMessage) => void;
}

export default function SideChat(props: SideChatProps) {
  const [input, setInput] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [streamingMessage, setStreamingMessage] = createSignal<string>('');

  const handleSend = async () => {
    const message = input().trim();
    if (!message || isLoading()) return;

    const userMessage: ChatMessage = {
      id: props.chatSuggestionService.generateMessageId(),
      type: 'user',
      content: message,
      timestamp: Date.now(),
      isComplete: true
    };

    // Notify parent to add user message
    props.onSendMessage(userMessage);
    setInput('');

    // Start loading state
    setIsLoading(true);
    setStreamingMessage('');

    try {
      // Get streaming response from LLM
      await props.chatSuggestionService.getSideChatResponseStreaming({
        originalContext: props.context,
        spanishSuggestion: props.suggestion,
        studentMessage: message
      }, {
        onTextChunk: (chunk: string) => {
          // Append each chunk to the streaming message
          setStreamingMessage(prev => prev + chunk);
        },
        onComplete: (finalMessage: string) => {
          // Create final assistant message
          const assistantMessage: ChatMessage = {
            id: props.chatSuggestionService.generateMessageId(),
            type: 'assistant',
            content: finalMessage,
            timestamp: Date.now(),
            isComplete: true
          };

          // Notify parent to add assistant message
          props.onSendMessage(assistantMessage);
          setIsLoading(false);
          setStreamingMessage('');
        },
        onError: (error: string) => {
          console.error('Side chat error:', error);
          const errorMessage: ChatMessage = {
            id: props.chatSuggestionService.generateMessageId(),
            type: 'assistant',
            content: 'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
            timestamp: Date.now(),
            isComplete: true
          };

          // Notify parent to add error message
          props.onSendMessage(errorMessage);
          setIsLoading(false);
          setStreamingMessage('');
        }
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      
      const errorMessage: ChatMessage = {
        id: props.chatSuggestionService.generateMessageId(),
        type: 'assistant',
        content: 'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
        timestamp: Date.now(),
        isComplete: true
      };

      // Notify parent to add error message
      props.onSendMessage(errorMessage);
      setIsLoading(false);
      setStreamingMessage('');
    }
  };

  // Auto-scroll to bottom when new messages are added or when streaming
  createEffect(() => {
    const messages = props.messages || [];
    const streaming = streamingMessage();
    
    if ((messages.length > 0 || streaming) && typeof window !== 'undefined') {
      setTimeout(() => {
        const container = document.getElementById('sidechat-messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    }
  });

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
        {/* Side chat header */}
        <div class="p-4 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-gray-900">Grammar Chat</h3>
            <button
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div class="mt-2 text-sm text-gray-600">
            <div class="font-medium">Discussing:</div>
            <div class="bg-amber-100 px-2 py-1 rounded mt-1 text-amber-800">
              "{props.suggestion}"
            </div>
          </div>
        </div>

        {/* Side chat messages */}
        <div class="flex-1 overflow-y-auto p-4 space-y-3" id="sidechat-messages-container">
          <Show when={props.messages.length === 0 && !isLoading() && !streamingMessage()}>
            <div class="text-center text-gray-500 mt-8">
              <p class="text-sm">Ask me about the Spanish suggestion!</p>
              <p class="text-xs mt-1">
                Try: "Why did you use this word?" or "Can you explain the grammar?"
              </p>
            </div>
          </Show>
          
          <For each={props.messages}>
            {(message) => (
              <div class={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div class={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div class="whitespace-pre-wrap">{message.content}</div>
                  <div class="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </For>

          {/* Streaming message display */}
          <Show when={isLoading() && streamingMessage()}>
            <div class="flex justify-start">
              <div class="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-800">
                <div class="whitespace-pre-wrap">{streamingMessage()}</div>
                <div class="flex items-center gap-1 mt-1">
                  <div class="flex gap-1">
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                  </div>
                  <div class="text-xs text-gray-500 ml-2">escribiendo...</div>
                </div>
              </div>
            </div>
          </Show>

          {/* Loading indicator when starting response */}
          <Show when={isLoading() && !streamingMessage()}>
            <div class="flex justify-start">
              <div class="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-800">
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
                  Pensando...
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Side chat input */}
        <div class="p-3 border-t border-gray-200">
          <ChatInput
            value={input()}
            onInput={setInput}
            onSend={handleSend}
            placeholder="Ask about the grammar..."
            showSendButton={true}
            size="sm"
            disabled={isLoading()}
            isLoading={isLoading()}
          />
        </div>
      </div>
    </Show>
  );
}