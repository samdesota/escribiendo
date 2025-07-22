import { Component, createSignal, For, createEffect, onMount } from 'solid-js';
import { TranslationChatService, type ChatMessage as ChatMessageType, type ChatState } from '~/services/translation';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface TranslationChatInterfaceProps {
  editorContent?: string;
  class?: string;
}

const TranslationChatInterface: Component<TranslationChatInterfaceProps> = (props) => {
  const [chatState, setChatState] = createSignal<ChatState>({
    messages: [],
    isLoading: false,
    error: undefined
  });

  // Streaming state for real-time text updates
  const [streamingMessage, setStreamingMessage] = createSignal<string>('');
  const [isStreaming, setIsStreaming] = createSignal(false);

  const translationService = new TranslationChatService();
  let messagesContainerRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom when new messages are added or when streaming
  createEffect(() => {
    const messages = chatState().messages;
    const streaming = isStreaming();
    if ((messages.length > 0 || streaming) && messagesContainerRef) {
      setTimeout(() => {
        messagesContainerRef!.scrollTop = messagesContainerRef!.scrollHeight;
      }, 50);
    }
  });

  // Add welcome message on mount
  onMount(() => {
    const welcomeMessage = translationService.createMessage(
      'assistant',
      'Hello! I\'m your translation assistant. Type any word or phrase to get a Spanish translation, or ask me questions about Spanish. I can see your current document for context.'
    );

    setChatState(prev => ({
      ...prev,
      messages: [welcomeMessage]
    }));
  });

  const handleSendMessage = async (message: string) => {
    // Create user message
    const userMessage = translationService.createMessage('user', message);

    // Add user message and prepare for streaming
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: false,
      error: undefined
    }));

    // Clear previous streaming state
    setStreamingMessage('');
    setIsStreaming(true);

    try {
      // Get streaming translation response
      await translationService.getTranslationStreaming({
        message,
        editorContext: props.editorContent,
        chatHistory: chatState().messages
      }, {
        onTextChunk: (chunk: string) => {
          // Append each chunk to the streaming message
          setStreamingMessage(prev => prev + chunk);
        },
        onComplete: (finalMessage: string) => {
          // Create final assistant message
          const assistantMessage = translationService.createMessage('assistant', finalMessage);

          // Add to chat history and clear streaming state
          setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            isLoading: false
          }));

          setIsStreaming(false);
          setStreamingMessage('');
        },
        onError: (error: string) => {
          // Handle streaming error
          const errorMessage = translationService.createMessage(
            'assistant',
            'Sorry, I encountered an error. Please try again.'
          );

          setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, errorMessage],
            isLoading: false,
            error: error
          }));

          setIsStreaming(false);
          setStreamingMessage('');
        }
      });

    } catch (error) {
      // Handle connection error
      const errorMessage = translationService.createMessage(
        'assistant',
        'Sorry, I encountered an error. Please try again.'
      );

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));

      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  const clearChat = () => {
    setChatState({
      messages: [],
      isLoading: false,
      error: undefined
    });
    setIsStreaming(false);
    setStreamingMessage('');
  };

  return (
    <div class={`flex flex-col bg-white border border-gray-200 rounded-lg ${props.class || ''}`}>
      {/* Header */}
      <div class="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 class="text-sm font-medium text-gray-700">Translation Assistant</h3>
        <button
          onClick={clearChat}
          class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-200 rounded"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]"
      >
        <For each={chatState().messages}>
          {(message) => <ChatMessage message={message} />}
        </For>

        {/* Streaming message display */}
        {isStreaming() && (
          <div class="flex justify-start mb-3">
            <div class="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-800 mr-12">
              <div class="whitespace-pre-wrap">{streamingMessage()}</div>
              <div class="flex items-center gap-1 mt-1">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div class="text-xs text-gray-500">typing...</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {chatState().isLoading && (
          <div class="flex justify-start mb-3">
            <div class="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
                Thinking...
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {chatState().error && (
          <div class="text-xs text-red-600 bg-red-50 rounded p-2">
            Error: {chatState().error}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={chatState().isLoading || isStreaming()}
        placeholder="Type 'race' or ask 'How do you say hello?'..."
      />
    </div>
  );
};

export default TranslationChatInterface;
