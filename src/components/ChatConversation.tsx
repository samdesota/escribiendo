import { createSignal, For, onCleanup, onMount, createEffect } from 'solid-js';
import {
  ClientLLMService,
  type ChatSuggestionRequest,
  type TranslationRequest,
  type TranslationResponse,
  AVAILABLE_MODELS,
} from '~/services/llm';
import {
  type ChatMessage,
  type Chat,
  type SuggestionState,
  type SideChatState,
} from './types';
import { createDebouncedTranslation } from '~/lib/translation-utils';
import ChatInput from './ChatInput';
import SideChat from './SideChat';
import TranslationTooltip from './TranslationTooltip';

export interface ChatConversationProps {
  chat: Chat | null;
  chatSuggestionService: ClientLLMService;
  onSaveMessage: (message: ChatMessage) => Promise<void>;
  onUpdateChatTitle: (chatId: string, title: string) => Promise<void>;
  onSwitchModel?: (chatId: string, modelId: string) => Promise<void>;
}

export default function ChatConversation(props: ChatConversationProps) {
  const [currentInput, setCurrentInput] = createSignal('');
  const [isGettingResponse, setIsGettingResponse] = createSignal(false);
  const [streamingMessage, setStreamingMessage] = createSignal<string>('');

  // Suggestion mode state
  const [suggestionState, setSuggestionState] = createSignal<SuggestionState>({
    isActive: false,
    partialText: '',
    isLoading: false,
    currentSuggestion: '',
  });

  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: [],
  });

  // Use shared debounced translation utility
  const { translationState, requestTranslation, clearTranslation } =
    createDebouncedTranslation(props.chatSuggestionService);

  // Conversation starters state
  const [assistantQuestions, setAssistantQuestions] = createSignal<string[]>(
    []
  );
  const [userQuestions, setUserQuestions] = createSignal<string[]>([]);
  const [isLoadingStarters, setIsLoadingStarters] = createSignal(false);

  // Track previous starters to avoid repetition
  const [previousAssistantQuestions, setPreviousAssistantQuestions] =
    createSignal<string[]>([]);
  const [previousUserQuestions, setPreviousUserQuestions] = createSignal<
    string[]
  >([]);

  // Model selection state
  const [isModelSelectorOpen, setIsModelSelectorOpen] = createSignal(false);
  const availableModels = Object.entries(AVAILABLE_MODELS).map(
    ([id, config]) => ({
      id,
      displayName: config.displayName,
      provider: config.provider,
    })
  );

  // Load conversation starters
  const loadConversationStarters = async () => {
    setIsLoadingStarters(true);
    try {
      // Store current starters as previous before generating new ones
      const currentAssistant = assistantQuestions();
      const currentUser = userQuestions();

      if (currentAssistant.length > 0) {
        setPreviousAssistantQuestions(currentAssistant);
      }
      if (currentUser.length > 0) {
        setPreviousUserQuestions(currentUser);
      }

      const response =
        await props.chatSuggestionService.getConversationStarters(
          currentAssistant.length > 0 ? currentAssistant : [],
          currentUser.length > 0 ? currentUser : []
        );
      if (response.error) {
        console.error('Error loading conversation starters:', response.error);
      }
      setAssistantQuestions(response.assistantQuestions);
      setUserQuestions(response.userQuestions);
    } catch (error) {
      console.error('Failed to load conversation starters:', error);
      // Set fallback starters
      setAssistantQuestions([
        'Cuéntame sobre tu día típico',
        '¿Qué es lo que más te gusta de tu ciudad?',
        'Háblame de tu comida favorita',
      ]);
      setUserQuestions([
        '¿Cuál es la tradición española más importante?',
        '¿Qué consejos tienes para mejorar mi pronunciación?',
        '¿Cómo es la vida en España comparada con otros países?',
      ]);
    } finally {
      setIsLoadingStarters(false);
    }
  };

  // Handle clicking on an assistant question (assistant asks the user)
  const handleAssistantQuestionClick = async (question: string) => {
    if (!props.chat) return;

    // Create assistant message with the question
    const assistantMessage: ChatMessage = {
      id: props.chatSuggestionService.generateMessageId(),
      type: 'assistant',
      content: question,
      timestamp: Date.now(),
      isComplete: true,
    };

    // Save assistant message to database
    await props.onSaveMessage(assistantMessage);

    // Focus the input for user response
    setTimeout(() => {
      const input = document.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  };

  // Handle clicking on a user question (user asks the assistant)
  const handleUserQuestionClick = (question: string) => {
    // Set the question in the input and send it
    setCurrentInput(question);
    handleSendMessage();
  };

  // Handle keyboard input
  const handleKeyDown = (e: KeyboardEvent) => {
    // Tab to trigger suggestion mode or accept suggestion
    if (e.key === 'Tab') {
      if (suggestionState().isActive && suggestionState().currentSuggestion) {
        // Accept the current suggestion
        e.preventDefault();
        setCurrentInput(suggestionState().currentSuggestion);
        setSuggestionState(prev => ({
          ...prev,
          isActive: false,
          partialText: '',
          currentSuggestion: '',
        }));
        return;
      } else if (!suggestionState().isActive && currentInput().trim()) {
        // Enter suggestion mode and request suggestion immediately
        e.preventDefault();
        const inputText = currentInput().trim();
        setSuggestionState(prev => ({
          ...prev,
          isActive: true,
          partialText: inputText,
          currentSuggestion: '',
        }));
        // Request suggestion immediately
        requestSuggestion(inputText);
        return;
      } else if (!suggestionState().isActive && !currentInput().trim()) {
        // Don't allow Tab on empty input
        e.preventDefault();
        return;
      }
    }

    // Handle Shift+Enter for side chat
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      openSideChat();
      return;
    }

    // Regular Enter to send message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
      return;
    }

    // Escape to exit suggestion mode
    if (e.key === 'Escape' && suggestionState().isActive) {
      setSuggestionState(prev => ({
        ...prev,
        isActive: false,
        partialText: '',
        currentSuggestion: '',
      }));
    }
  };

  // Handle input changes during suggestion mode
  const handleInputChange = (value: string) => {
    setCurrentInput(value);

    if (suggestionState().isActive) {
      // Update partial text for suggestion
      setSuggestionState(prev => ({
        ...prev,
        partialText: value,
      }));

      // Debounce the suggestion request
      const timeout = suggestionState().debounceTimeout;
      if (timeout) {
        clearTimeout(timeout);
      }

      const newTimeout = setTimeout(() => {
        if (value.trim()) {
          requestSuggestion(value);
        }
      }, 500);

      setSuggestionState(prev => ({
        ...prev,
        debounceTimeout: newTimeout,
      }));
    }
  };

  // Request a suggestion from LLM
  const requestSuggestion = async (text: string) => {
    if (!text.trim()) return;

    setSuggestionState(prev => ({ ...prev, isLoading: true }));

    try {
      const chatContext = props.chat
        ? props.chatSuggestionService.buildChatContext(props.chat.messages, 3)
        : '';

      const response = await props.chatSuggestionService.getSuggestion({
        userInput: text,
        chatContext,
      });

      if (response.error) {
        console.error('Suggestion error:', response.error);
        setSuggestionState(prev => ({
          ...prev,
          isLoading: false,
          currentSuggestion: '',
        }));
      } else {
        setSuggestionState(prev => ({
          ...prev,
          isLoading: false,
          currentSuggestion: response.suggestion,
        }));
      }
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      setSuggestionState(prev => ({
        ...prev,
        isLoading: false,
        currentSuggestion: '',
      }));
    }
  };

  // Handle sending regular messages
  const handleSendMessage = async () => {
    const text = currentInput().trim();
    if (!text || !props.chat) return;

    const userMessage: ChatMessage = {
      id: props.chatSuggestionService.generateMessageId(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
      isComplete: true,
    };

    // Save user message to database
    await props.onSaveMessage(userMessage);

    // Update chat title if this is the first message
    if (props.chat.messages.length === 0) {
      await props.onUpdateChatTitle(props.chat.id, text);
    }

    setCurrentInput('');

    // Get AI response with streaming
    setIsGettingResponse(true);
    setStreamingMessage('');

    try {
      // Build context from recent messages (including the user message we just added)
      const recentMessages = props.chat.messages.slice(-5); // Get last 5 messages for context
      const chatHistory = recentMessages
        .filter(msg => msg.type === 'user' || msg.type === 'assistant') // Only include user and assistant messages for context
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');

      await props.chatSuggestionService.getRegularChatResponseStreaming(
        {
          userMessage: text,
          chatHistory: chatHistory,
        },
        {
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
              isComplete: true,
            };

            // Save assistant message to database
            props.onSaveMessage(assistantMessage);
            setIsGettingResponse(false);
            setStreamingMessage('');
          },
          onError: (error: string) => {
            console.error('Failed to get AI response:', error);

            const errorMessage: ChatMessage = {
              id: props.chatSuggestionService.generateMessageId(),
              type: 'assistant',
              content:
                'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
              timestamp: Date.now(),
              isComplete: true,
            };

            // Save error message to database
            props.onSaveMessage(errorMessage);
            setIsGettingResponse(false);
            setStreamingMessage('');
          },
        }
      );
    } catch (error) {
      console.error('Failed to start streaming:', error);

      const errorMessage: ChatMessage = {
        id: props.chatSuggestionService.generateMessageId(),
        type: 'assistant',
        content:
          'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
        timestamp: Date.now(),
        isComplete: true,
      };

      // Save error message to database
      props.onSaveMessage(errorMessage);
      setIsGettingResponse(false);
      setStreamingMessage('');
    }
  };

  // Open side chat for grammar discussion
  const openSideChat = () => {
    if (!props.chat) return;

    debugger;
    // Use the current suggestion if available, otherwise use the most recent suggestion from state
    const suggestion = suggestionState().currentSuggestion;

    if (!suggestion) {
      console.log('No current suggestion for side chat');
      return;
    }

    // Get some context from recent messages
    const context = props.chat
      ? props.chatSuggestionService.buildChatContext(props.chat.messages, 2)
      : '';

    setSideChatState({
      isOpen: true,
      context,
      suggestion: suggestion,
      messages: [],
    });
  };

  // Close side chat
  const closeSideChat = () => {
    setSideChatState(prev => ({ ...prev, isOpen: false }));
  };

  // Handle side chat message from SideChat component
  const handleSideChatMessage = (message: ChatMessage) => {
    setSideChatState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  // Handle clicking outside to close model selector
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.model-selector-container')) {
      setIsModelSelectorOpen(false);
    }
  };

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

    // Find the message element that contains the selection
    const range = selection.getRangeAt(0);
    const messageElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement?.closest(
            '[data-message-id]'
          )
        : range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer.closest('[data-message-id]')
          : null;

    if (!messageElement) {
      clearTranslation();
      return;
    }

    const messageId = messageElement.getAttribute('data-message-id');
    const messageContent = messageElement.textContent || '';

    if (!messageId) {
      clearTranslation();
      return;
    }

    // Get selection bounding rect for tooltip positioning
    const selectionRect = range.getBoundingClientRect();

    // Use shared translation utility with debouncing
    await requestTranslation(
      selectedText,
      messageContent,
      props.chat
        ? props.chatSuggestionService.buildChatContext(props.chat.messages, 3)
        : '',
      selectionRect
    );
  };

  // Open side chat for translation discussion
  const openTranslationSideChat = () => {
    if (!props.chat) return;

    const selectedText = translationState().selectedText;
    const translation = translationState().translation;

    if (!selectedText || !translation) {
      console.log('No selected text or translation for side chat');
      return;
    }

    // Get context from recent messages
    const context = props.chatSuggestionService.buildChatContext(
      props.chat.messages,
      2
    );

    setSideChatState({
      isOpen: true,
      context,
      suggestion: `Spanish: "${selectedText}" → English: "${translation}"`,
      messages: [],
    });

    // Clear the selection state
    clearTranslation();
  };

  // Auto-scroll to bottom when new messages are added or when streaming
  createEffect(() => {
    const messages = props.chat?.messages || [];
    const streaming = streamingMessage();

    if ((messages.length > 0 || streaming) && typeof window !== 'undefined') {
      setTimeout(() => {
        const container = document.getElementById('messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    }
  });

  // Load conversation starters when chat has no messages
  createEffect(() => {
    if (
      props.chat &&
      props.chat.messages.length === 0 &&
      assistantQuestions().length === 0 &&
      userQuestions().length === 0 &&
      !isLoadingStarters()
    ) {
      loadConversationStarters();
    }
  });

  // Initialize on mount (client-side only)
  onMount(() => {
    // Add text selection event listeners
    if (typeof window !== 'undefined') {
      document.addEventListener('selectionchange', handleTextSelection);
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('click', e => {
        // Clear selection if clicking outside of message area
        const target = e.target as Element;
        if (!target.closest('[data-message-id]')) {
          clearTranslation();
        }
      });
    }
  });

  // Cleanup timeouts and event listeners
  onCleanup(() => {
    const suggestionTimeout = suggestionState().debounceTimeout;
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      document.removeEventListener('selectionchange', handleTextSelection);
      document.removeEventListener('click', handleClickOutside);
    }
  });

  if (!props.chat) {
    return (
      <div class='flex-1 flex items-center justify-center text-gray-500'>
        <div class='text-center'>
          <h3 class='text-lg font-medium mb-2'>Welcome to Chat Experiment</h3>
          <p class='mb-4'>
            Create a new chat to start experimenting with Spanish suggestions
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Chat header */}
      <div class='p-4 border-b border-gray-200 bg-white'>
        <div class='flex items-center justify-between'>
          <h2 class='font-medium text-gray-900'>
            {props.chat?.title || 'Chat'}
          </h2>

          {/* Model selector */}
          <div class='relative model-selector-container'>
            <button
              onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen())}
              class='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center gap-2 transition-colors'
            >
              <span class='text-xs opacity-60'>Model:</span>
              <span class='font-medium'>
                {availableModels.find(
                  m => m.id === (props.chat?.model || 'gpt-4o')
                )?.displayName || 'GPT-4o'}
              </span>
              <svg
                class={`w-4 h-4 transition-transform ${isModelSelectorOpen() ? 'rotate-180' : ''}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M19 9l-7 7-7-7'
                ></path>
              </svg>
            </button>

            {/* Model dropdown */}
            {isModelSelectorOpen() && (
              <div class='absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48'>
                <div class='py-1'>
                  <For each={availableModels}>
                    {model => (
                      <button
                        onClick={async () => {
                          if (props.chat && props.onSwitchModel) {
                            await props.onSwitchModel(props.chat.id, model.id);
                          }
                          setIsModelSelectorOpen(false);
                        }}
                        class={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between
                          ${(props.chat?.model || 'gpt-4o') === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      >
                        <div>
                          <div class='font-medium'>{model.displayName}</div>
                          <div class='text-xs opacity-60 capitalize'>
                            {model.provider}
                          </div>
                        </div>
                        {(props.chat?.model || 'gpt-4o') === model.id && (
                          <svg
                            class='w-4 h-4 text-blue-600'
                            fill='currentColor'
                            viewBox='0 0 20 20'
                          >
                            <path
                              fill-rule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clip-rule='evenodd'
                            ></path>
                          </svg>
                        )}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )}
          </div>
        </div>

        <div class='text-sm text-gray-500 mt-1'>
          {suggestionState().isActive ? (
            <span class='text-amber-600 font-medium animate-pulse'>
              🌟 Suggestion Mode Active
            </span>
          ) : suggestionState().isLoading ? (
            <span class='text-blue-600 font-medium'>
              🤔 Getting your Spanish suggestion...
            </span>
          ) : (
            'Press Tab to get Spanish suggestions • Shift+Enter for grammar help'
          )}
        </div>
      </div>

      {/* Messages or Conversation Starters */}
      {props.chat?.messages.length === 0 ? (
        /* Show conversation starters for new chat */
        <ConversationStarters
          assistantQuestions={assistantQuestions()}
          userQuestions={userQuestions()}
          isLoading={isLoadingStarters()}
          onAssistantQuestionClick={handleAssistantQuestionClick}
          onUserQuestionClick={handleUserQuestionClick}
          onGenerateMore={loadConversationStarters}
        />
      ) : (
        /* Show messages for existing chat */
        <div
          class='flex-1 overflow-y-auto p-4 space-y-4'
          id='messages-container'
        >
          <For each={props.chat?.messages || []}>
            {message => (
              <div
                class={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  class={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  data-message-id={message.id}
                >
                  <div class='whitespace-pre-wrap'>{message.content}</div>
                  <div class='text-xs opacity-70 mt-1'>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </For>

          {/* Streaming message display */}
          {isGettingResponse() && streamingMessage() && (
            <div class='flex justify-start'>
              <div class='max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 text-gray-800'>
                <div class='whitespace-pre-wrap'>{streamingMessage()}</div>
                <div class='flex items-center gap-1 mt-1'>
                  <div class='flex gap-1'>
                    <div
                      class='w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce'
                      style='animation-delay: 0ms'
                    ></div>
                    <div
                      class='w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce'
                      style='animation-delay: 150ms'
                    ></div>
                    <div
                      class='w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce'
                      style='animation-delay: 300ms'
                    ></div>
                  </div>
                  <div class='text-xs text-gray-500 ml-2'>escribiendo...</div>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator when starting response */}
          {isGettingResponse() && !streamingMessage() && (
            <div class='flex justify-start'>
              <div class='bg-gray-100 rounded-lg px-4 py-2 text-gray-800'>
                <div class='flex items-center gap-2'>
                  <div class='w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin'></div>
                  Pensando...
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div class='p-4 border-t border-gray-200 bg-white'>
        <ChatInput
          value={currentInput()}
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          onSend={handleSendMessage}
          placeholder={
            suggestionState().isActive
              ? 'Suggestion mode active...'
              : 'Type your message... (Tab for Spanish suggestions)'
          }
          showSendButton={true}
          isLoading={isGettingResponse()}
          isActive={suggestionState().isActive}
          tips='Tips: Tab → get suggestions | Shift+Enter → grammar chat | Enter → send'
        />

        {/* Suggestion display */}
        {suggestionState().isActive && (
          <div class='mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg'>
            {suggestionState().isLoading ? (
              <div class='flex items-center gap-2 text-amber-700'>
                <div class='w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin'></div>
                <span class='text-sm'>Obteniendo sugerencia...</span>
              </div>
            ) : suggestionState().currentSuggestion ? (
              <div class='space-y-1'>
                <div class='text-sm text-amber-700 font-medium'>
                  Sugerencia:
                </div>
                <div class='text-gray-800 bg-white px-2 py-1 rounded border'>
                  {suggestionState().currentSuggestion}
                </div>
                <div class='text-xs text-amber-600'>
                  Presiona{' '}
                  <kbd class='px-1 py-0.5 bg-amber-100 rounded text-xs font-mono'>
                    Tab
                  </kbd>{' '}
                  para aceptar o{' '}
                  <kbd class='px-1 py-0.5 bg-amber-100 rounded text-xs font-mono'>
                    Esc
                  </kbd>{' '}
                  para cancelar
                </div>
              </div>
            ) : suggestionState().partialText ? (
              <div class='text-sm text-amber-700'>
                Escribe lo que quieres decir y esperaré tu sugerencia...
              </div>
            ) : (
              <div class='text-sm text-amber-700'>
                🌟 Modo sugerencia activado - Obteniendo sugerencia para: "
                {suggestionState().partialText}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Translation Tooltip */}
      {translationState().isActive && translationState().selectionRect && (
        <TranslationTooltip
          selectedText={translationState().selectedText}
          translation={translationState().translation}
          isLoading={translationState().isLoading}
          selectionRect={translationState().selectionRect!}
          onOpenSideChat={openTranslationSideChat}
        />
      )}

      {/* Side Chat Panel */}
      <SideChat
        isOpen={sideChatState().isOpen}
        context={sideChatState().context}
        suggestion={sideChatState().suggestion}
        messages={sideChatState().messages}
        chatSuggestionService={props.chatSuggestionService}
        onClose={closeSideChat}
        onSendMessage={handleSideChatMessage}
      />
    </>
  );
}

// Conversation Starters Component
interface ConversationStartersProps {
  assistantQuestions: string[];
  userQuestions: string[];
  isLoading: boolean;
  onAssistantQuestionClick: (question: string) => void;
  onUserQuestionClick: (question: string) => void;
  onGenerateMore: () => void;
}

function ConversationStarters(props: ConversationStartersProps) {
  return (
    <div class='flex-1 flex items-center justify-center p-8'>
      <div class='max-w-3xl w-full'>
        <div class='text-center mb-8'>
          <h2 class='text-2xl font-semibold text-gray-800 mb-2'>
            ¡Bienvenido! 🇪🇸
          </h2>
          <p class='text-gray-600'>
            Elige cómo quieres empezar la conversación
          </p>
        </div>

        {props.isLoading ? (
          <div class='space-y-6'>
            <div class='flex items-center justify-center gap-2 text-gray-600'>
              <div class='w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
              <span>Generando ideas de conversación...</span>
            </div>
            {/* Show skeleton placeholders for both sections */}
            <div class='grid md:grid-cols-2 gap-6'>
              <div class='space-y-3'>
                <div class='h-6 bg-gray-300 rounded animate-pulse'></div>
                <For each={Array(3)}>
                  {() => (
                    <div class='h-12 bg-gray-200 rounded-lg animate-pulse'></div>
                  )}
                </For>
              </div>
              <div class='space-y-3'>
                <div class='h-6 bg-gray-300 rounded animate-pulse'></div>
                <For each={Array(3)}>
                  {() => (
                    <div class='h-12 bg-gray-200 rounded-lg animate-pulse'></div>
                  )}
                </For>
              </div>
            </div>
          </div>
        ) : (
          <div class='space-y-6'>
            <div class='grid md:grid-cols-2 gap-6'>
              {/* Assistant Questions Section */}
              <div class='space-y-4'>
                <div class='text-center'>
                  <h3 class='text-lg font-medium text-gray-800 mb-2'>
                    Te pregunto sobre ti
                  </h3>
                  <p class='text-sm text-gray-600'>
                    Te haré una pregunta personal
                  </p>
                </div>
                <div class='space-y-3'>
                  <For each={props.assistantQuestions}>
                    {question => (
                      <button
                        onClick={() => props.onAssistantQuestionClick(question)}
                        class='w-full p-4 text-left bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all duration-200 group'
                      >
                        <div class='flex items-center justify-between'>
                          <span class='text-gray-800 group-hover:text-green-700 font-medium'>
                            {question}
                          </span>
                          <svg
                            class='w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              stroke-linecap='round'
                              stroke-linejoin='round'
                              stroke-width='2'
                              d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                            ></path>
                          </svg>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* User Questions Section */}
              <div class='space-y-4'>
                <div class='text-center'>
                  <h3 class='text-lg font-medium text-gray-800 mb-2'>
                    Pregúntame a mí
                  </h3>
                  <p class='text-sm text-gray-600'>
                    Hazme una pregunta sobre español
                  </p>
                </div>
                <div class='space-y-3'>
                  <For each={props.userQuestions}>
                    {question => (
                      <button
                        onClick={() => props.onUserQuestionClick(question)}
                        class='w-full p-4 text-left bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group'
                      >
                        <div class='flex items-center justify-between'>
                          <span class='text-gray-800 group-hover:text-blue-700 font-medium'>
                            {question}
                          </span>
                          <svg
                            class='w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              stroke-linecap='round'
                              stroke-linejoin='round'
                              stroke-width='2'
                              d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                            ></path>
                          </svg>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            <div class='text-center pt-4 border-t border-gray-200'>
              <button
                onClick={props.onGenerateMore}
                class='px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors'
              >
                🎲 Generar más ideas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
