import { createSignal, For, onCleanup, onMount, createEffect } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { ChatSuggestionService, type ChatSuggestionRequest } from '~/services/llm/ChatSuggestionService';

interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: number;
  isComplete?: boolean;
}

interface SuggestionState {
  isActive: boolean;
  partialText: string;
  debounceTimeout?: ReturnType<typeof setTimeout>;
  isLoading: boolean;
  currentSuggestion: string;
}

interface SideChatState {
  isOpen: boolean;
  context: string;
  suggestion: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'chat-experiment-chats';

export default function ChatExperiment() {
  // Initialize services
  const chatSuggestionService = new ChatSuggestionService();
  const params = useParams();
  const navigate = useNavigate();

  // Main state
  const [chats, setChats] = createSignal<Chat[]>([]);
  const [currentInput, setCurrentInput] = createSignal('');
  const [isGettingResponse, setIsGettingResponse] = createSignal(false);
  const [streamingMessage, setStreamingMessage] = createSignal<string>('');
  
  // Suggestion mode state
  const [suggestionState, setSuggestionState] = createSignal<SuggestionState>({
    isActive: false,
    partialText: '',
    isLoading: false,
    currentSuggestion: ''
  });
  
  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: []
  });

  // Load chats from localStorage (client-side only)
  const loadChatsFromStorage = () => {
    if (typeof window === 'undefined') return; // Skip on server
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedChats = JSON.parse(saved);
        setChats(savedChats);
      }
    } catch (error) {
      console.warn('Failed to load chat data:', error);
    }
  };

  // Save chats to localStorage (client-side only)
  const saveChatsToStorage = () => {
    if (typeof window === 'undefined') return; // Skip on server
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats()));
    } catch (error) {
      console.warn('Failed to save chat data:', error);
    }
  };

  // Create a new chat
  const createNewChat = () => {
    const welcomeMessage: ChatMessage = {
      id: chatSuggestionService.generateMessageId(),
      type: 'assistant',
      content: '¡Hola! ¡Bienvenido al experimento de chat en español! 🌟\n\nPrueba escribir algo como "quiero algo con cool socks" y luego pulsa Tab para obtener una sugerencia en español.\n\n¡O simplemente chatea normalmente - estoy aquí para ayudarte!',
      timestamp: Date.now(),
      isComplete: true
    };

    const newChat: Chat = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Chat ${chats().length + 1}`,
      messages: [welcomeMessage],
      createdAt: Date.now()
    };

    setChats(prev => [newChat, ...prev]);
    saveChatsToStorage();
    
    // Navigate to the new chat
    navigate(`/chat/${newChat.id}`);
    return newChat;
  };

  // Get current active chat from URL params
  const getCurrentChat = () => {
    const chatId = params.chatId;
    if (!chatId) return null;
    return chats().find(chat => chat.id === chatId) || null;
  };

  // Create a new chat with the current URL's chatId if it doesn't exist
  const createChatWithId = (chatId: string) => {
    const welcomeMessage: ChatMessage = {
      id: chatSuggestionService.generateMessageId(),
      type: 'assistant',
      content: '¡Hola! ¡Bienvenido al experimento de chat en español! 🌟\n\nPrueba escribir algo como "quiero algo con cool socks" y luego pulsa Tab para obtener una sugerencia en español.\n\n¡O simplemente chatea normalmente - estoy aquí para ayudarte!',
      timestamp: Date.now(),
      isComplete: true
    };

    const newChat: Chat = {
      id: chatId,
      title: `Chat ${chats().length + 1}`,
      messages: [welcomeMessage],
      createdAt: Date.now()
    };

    setChats(prev => [newChat, ...prev]);
    saveChatsToStorage();
    return newChat;
  };

  // Delete a chat
  const deleteChat = (chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    
    // If deleting active chat, navigate to chat list or first chat
    if (params.chatId === chatId) {
      const remaining = chats().filter(chat => chat.id !== chatId);
      if (remaining.length > 0) {
        navigate(`/chat/${remaining[0].id}`);
      } else {
        navigate('/chat');
      }
    }
    
    saveChatsToStorage();
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
          currentSuggestion: ''
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
          currentSuggestion: ''
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
        currentSuggestion: ''
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
        partialText: value
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
        debounceTimeout: newTimeout
      }));
    }
  };

  // Request a suggestion from LLM
  const requestSuggestion = async (text: string) => {
    if (!text.trim()) return;
    
    setSuggestionState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const chat = getCurrentChat();
      const chatContext = chat ? chatSuggestionService.buildChatContext(chat.messages, 3) : '';
      
      const response = await chatSuggestionService.getSuggestion({
        userInput: text,
        chatContext
      });
      
      if (response.error) {
        console.error('Suggestion error:', response.error);
        setSuggestionState(prev => ({ 
          ...prev, 
          isLoading: false,
          currentSuggestion: ''
        }));
      } else {
        setSuggestionState(prev => ({ 
          ...prev, 
          isLoading: false,
          currentSuggestion: response.suggestion
        }));
      }
      
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      setSuggestionState(prev => ({ 
        ...prev, 
        isLoading: false,
        currentSuggestion: ''
      }));
    }
  };

  // Update chat title based on first message
  const updateChatTitle = (chatId: string, firstMessage: string) => {
    const title = firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + '...'
      : firstMessage;
    
    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { ...c, title: title || `Chat ${prev.indexOf(c) + 1}` }
        : c
    ));
    saveChatsToStorage();
  };

  // Handle sending regular messages
  const handleSendMessage = async () => {
    const text = currentInput().trim();
    if (!text) return;

    let chat = getCurrentChat();
    if (!chat) {
      chat = createNewChat();
    }

    const userMessage: ChatMessage = {
      id: chatSuggestionService.generateMessageId(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
      isComplete: true
    };

    // Add user message to chat
    setChats(prev => prev.map(c => 
      c.id === chat!.id 
        ? { ...c, messages: [...c.messages, userMessage] }
        : c
    ));

    // Update chat title if this is the first message
    if (chat.messages.length === 0) {
      updateChatTitle(chat.id, text);
    }

    setCurrentInput('');
    saveChatsToStorage();

    // Get AI response with streaming
    setIsGettingResponse(true);
    setStreamingMessage('');
    
    try {
      // Build context from recent messages (including the user message we just added)
      const updatedChat = getCurrentChat();
      const recentMessages = updatedChat ? updatedChat.messages.slice(-5) : [userMessage]; // Get last 5 messages for context
      const chatHistory = recentMessages
        .filter(msg => msg.type === 'user' || msg.type === 'assistant') // Only include user and assistant messages for context
        .map(msg => `${msg.type}: ${msg.content}`)
        .join('\n');

      await chatSuggestionService.getRegularChatResponseStreaming({
        userMessage: text,
        chatHistory: chatHistory
      }, {
        onTextChunk: (chunk: string) => {
          // Append each chunk to the streaming message
          setStreamingMessage(prev => prev + chunk);
        },
        onComplete: (finalMessage: string) => {
          // Create final assistant message
          const assistantMessage: ChatMessage = {
            id: chatSuggestionService.generateMessageId(),
            type: 'assistant',
            content: finalMessage,
            timestamp: Date.now(),
            isComplete: true
          };

          // Add assistant response to chat
          setChats(prev => prev.map(c => 
            c.id === chat!.id 
              ? { ...c, messages: [...c.messages, assistantMessage] }
              : c
          ));

          saveChatsToStorage();
          setIsGettingResponse(false);
          setStreamingMessage('');
        },
        onError: (error: string) => {
          console.error('Failed to get AI response:', error);
          
          const errorMessage: ChatMessage = {
            id: chatSuggestionService.generateMessageId(),
            type: 'assistant',
            content: 'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
            timestamp: Date.now(),
            isComplete: true
          };

          setChats(prev => prev.map(c => 
            c.id === chat!.id 
              ? { ...c, messages: [...c.messages, errorMessage] }
              : c
          ));

          saveChatsToStorage();
          setIsGettingResponse(false);
          setStreamingMessage('');
        }
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      
      const errorMessage: ChatMessage = {
        id: chatSuggestionService.generateMessageId(),
        type: 'assistant',
        content: 'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
        timestamp: Date.now(),
        isComplete: true
      };

      setChats(prev => prev.map(c => 
        c.id === chat!.id 
          ? { ...c, messages: [...c.messages, errorMessage] }
          : c
      ));

      saveChatsToStorage();
      setIsGettingResponse(false);
      setStreamingMessage('');
    }
  };

  // Open side chat for grammar discussion
  const openSideChat = () => {
    const chat = getCurrentChat();
    if (!chat) return;

    // Use the current suggestion if available, otherwise use the most recent suggestion from state
    const suggestion = suggestionState().currentSuggestion;

    if (!suggestion) {
      console.log('No current suggestion for side chat');
      return;
    }

    // Get some context from recent messages
    const context = chat ? chatSuggestionService.buildChatContext(chat.messages, 2) : '';

    setSideChatState({
      isOpen: true,
      context,
      suggestion: suggestion,
      messages: []
    });
  };

  // Close side chat
  const closeSideChat = () => {
    setSideChatState(prev => ({ ...prev, isOpen: false }));
  };

  // Send message in side chat
  const sendSideChatMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: chatSuggestionService.generateMessageId(),
      type: 'user',
      content: message,
      timestamp: Date.now(),
      isComplete: true
    };

    // Add user message to side chat
    setSideChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }));

    try {
      // Get response from LLM
      const response = await chatSuggestionService.getSideChatResponse({
        originalContext: sideChatState().context,
        spanishSuggestion: sideChatState().suggestion,
        studentMessage: message
      });

      const assistantMessage: ChatMessage = {
        id: chatSuggestionService.generateMessageId(),
        type: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        isComplete: true
      };

      // Add assistant response
      setSideChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage]
      }));

    } catch (error) {
      console.error('Side chat error:', error);
      const errorMessage: ChatMessage = {
        id: chatSuggestionService.generateMessageId(),
        type: 'assistant',
        content: 'Lo siento, he tenido un error. Por favor, inténtalo de nuevo.',
        timestamp: Date.now(),
        isComplete: true
      };

      setSideChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage]
      }));
    }
  };

  // Auto-scroll to bottom when new messages are added or when streaming
  createEffect(() => {
    const messages = getCurrentChat()?.messages || [];
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

  // Initialize on mount (client-side only)
  onMount(() => {
    loadChatsFromStorage();
  });

  // Cleanup timeouts
  onCleanup(() => {
    const timeout = suggestionState().debounceTimeout;
    if (timeout) {
      clearTimeout(timeout);
    }
  });

  return (
    <div class="h-screen flex bg-gray-50">
      {/* Sidebar with chat list */}
      <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div class="p-4 border-b border-gray-200">
          <h1 class="text-lg font-semibold text-gray-900">Chat Experiment</h1>
          <button
            onClick={createNewChat}
            class="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + New Chat
          </button>
        </div>

        {/* Chat list */}
        <div class="flex-1 overflow-y-auto p-2">
          <For each={chats()}>
            {(chat) => (
              <div class={`relative group rounded-lg mb-2 transition-colors ${
                params.chatId === chat.id
                  ? 'bg-blue-100 border border-blue-200'
                  : 'hover:bg-gray-100'
              }`}>
                <button
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  class="w-full text-left p-3 pr-8"
                >
                  <div class="font-medium text-gray-900 truncate">{chat.title}</div>
                  <div class="text-sm text-gray-500">
                    {chat.messages.length} messages
                  </div>
                </button>
                
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete chat"
                >
                  ✕
                </button>
              </div>
            )}
          </For>
          
          {chats().length === 0 && (
            <div class="text-center text-gray-500 mt-8">
              <p class="text-sm">No chats yet</p>
              <p class="text-xs mt-1">Create a new chat to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div class="flex-1 flex flex-col relative">
        {params.chatId ? (
          getCurrentChat() ? (
          <>
            {/* Chat header */}
            <div class="p-4 border-b border-gray-200 bg-white">
              <h2 class="font-medium text-gray-900">
                {getCurrentChat()?.title || 'Chat'}
              </h2>
              <div class="text-sm text-gray-500 mt-1">
                {suggestionState().isActive ? (
                  <span class="text-amber-600 font-medium animate-pulse">
                    🌟 Suggestion Mode Active
                  </span>
                ) : suggestionState().isLoading ? (
                  <span class="text-blue-600 font-medium">
                    🤔 Getting your Spanish suggestion...
                  </span>
                ) : (
                  'Press Tab to get Spanish suggestions • Shift+Enter for grammar help'
                )}
              </div>
            </div>

            {/* Messages */}
            <div class="flex-1 overflow-y-auto p-4 space-y-4" id="messages-container">
              <For each={getCurrentChat()?.messages || []}>
                {(message) => (
                  <div class={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div class={`max-w-[70%] rounded-lg px-4 py-2 ${
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
              {isGettingResponse() && streamingMessage() && (
                <div class="flex justify-start">
                  <div class="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 text-gray-800">
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
              )}

              {/* Loading indicator when starting response */}
              {isGettingResponse() && !streamingMessage() && (
                <div class="flex justify-start">
                  <div class="bg-gray-100 rounded-lg px-4 py-2 text-gray-800">
                    <div class="flex items-center gap-2">
                      <div class="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
                      Pensando...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div class="p-4 border-t border-gray-200 bg-white">
              <div class="flex gap-2">
                <input
                  type="text"
                  value={currentInput()}
                  onInput={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={suggestionState().isActive 
                    ? "Suggestion mode active..."
                    : "Type your message... (Tab for Spanish suggestions)"
                  }
                  class={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    suggestionState().isActive ? 'ring-2 ring-amber-400 border-amber-400' : ''
                  }`}
                  disabled={suggestionState().isLoading || isGettingResponse()}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!currentInput().trim() || suggestionState().isLoading || isGettingResponse()}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                <span class="font-medium">Tips:</span> Tab → get suggestions | Shift+Enter → grammar chat | Enter → send
              </div>

              {/* Suggestion display */}
              {suggestionState().isActive && (
                <div class="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  {suggestionState().isLoading ? (
                    <div class="flex items-center gap-2 text-amber-700">
                      <div class="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      <span class="text-sm">Obteniendo sugerencia...</span>
                    </div>
                  ) : suggestionState().currentSuggestion ? (
                    <div class="space-y-1">
                      <div class="text-sm text-amber-700 font-medium">Sugerencia:</div>
                      <div class="text-gray-800 bg-white px-2 py-1 rounded border">
                        {suggestionState().currentSuggestion}
                      </div>
                      <div class="text-xs text-amber-600">
                        Presiona <kbd class="px-1 py-0.5 bg-amber-100 rounded text-xs font-mono">Tab</kbd> para aceptar o <kbd class="px-1 py-0.5 bg-amber-100 rounded text-xs font-mono">Esc</kbd> para cancelar
                      </div>
                    </div>
                  ) : suggestionState().partialText ? (
                    <div class="text-sm text-amber-700">
                      Escribe lo que quieres decir y esperaré tu sugerencia...
                    </div>
                  ) : (
                    <div class="text-sm text-amber-700">
                      🌟 Modo sugerencia activado - Obteniendo sugerencia para: "{suggestionState().partialText}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
          ) : (
            // Chat ID exists but chat not found - create it
            (() => {
              createChatWithId(params.chatId!);
              return (
                <div class="flex-1 flex items-center justify-center text-gray-500">
                  <div class="text-center">
                    <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Creating new chat...</p>
                  </div>
                </div>
              );
            })()
          )
        ) : (
          <div class="flex-1 flex items-center justify-center text-gray-500">
            <div class="text-center">
              <h3 class="text-lg font-medium mb-2">Welcome to Chat Experiment</h3>
              <p class="mb-4">Create a new chat to start experimenting with Spanish suggestions</p>
              <button
                onClick={createNewChat}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Chat Panel */}
      {sideChatState().isOpen && (
        <div class="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
          {/* Side chat header */}
          <div class="p-4 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between">
              <h3 class="font-medium text-gray-900">Grammar Chat</h3>
              <button
                onClick={closeSideChat}
                class="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div class="mt-2 text-sm text-gray-600">
              <div class="font-medium">Discussing:</div>
              <div class="bg-amber-100 px-2 py-1 rounded mt-1 text-amber-800">
                "{sideChatState().suggestion}"
              </div>
            </div>
          </div>

          {/* Side chat messages */}
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            {sideChatState().messages.length === 0 && (
              <div class="text-center text-gray-500 mt-8">
                <p class="text-sm">Ask me about the Spanish suggestion!</p>
                <p class="text-xs mt-1">
                  Try: "Why did you use this word?" or "Can you explain the grammar?"
                </p>
              </div>
            )}
            
            <For each={sideChatState().messages}>
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
          </div>

          {/* Side chat input */}
          <SideChatInput onSendMessage={sendSideChatMessage} />
        </div>
      )}
    </div>
  );
}

// Side Chat Input Component
interface SideChatInputProps {
  onSendMessage: (message: string) => void;
}

function SideChatInput(props: SideChatInputProps) {
  const [input, setInput] = createSignal('');

  const handleSend = () => {
    const message = input().trim();
    if (message) {
      props.onSendMessage(message);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="p-3 border-t border-gray-200">
      <div class="flex gap-2">
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the grammar..."
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input().trim()}
          class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}