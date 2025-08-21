import { createSignal, For, onCleanup, onMount } from 'solid-js';
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
  debounceTimeout?: number;
  isLoading: boolean;
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
  
  // Suggestion mode state
  const [suggestionState, setSuggestionState] = createSignal<SuggestionState>({
    isActive: false,
    partialText: '',
    isLoading: false
  });
  
  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: []
  });

  // Keyboard event tracking for double space detection
  let lastSpaceTime = 0;
  const DOUBLE_SPACE_THRESHOLD = 300; // ms

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
      content: '¡Hola! Welcome to the Spanish chat experiment! 🌟\n\nTry typing something like "quiero algo con cool socks" and then hit space twice quickly to get a Spanish suggestion.\n\nOr just chat normally - I\'m here to help!',
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

  // Handle keyboard input for double space detection
  const handleKeyDown = (e: KeyboardEvent) => {
    const now = Date.now();
    
    if (e.key === ' ') {
      if (now - lastSpaceTime < DOUBLE_SPACE_THRESHOLD && !suggestionState().isActive) {
        // Double space detected - enter suggestion mode
        e.preventDefault();
        setSuggestionState(prev => ({
          ...prev,
          isActive: true,
          partialText: ''
        }));
        // Remove the extra space that was just typed
        const input = e.target as HTMLInputElement;
        if (input.value.endsWith(' ')) {
          input.value = input.value.slice(0, -1);
          setCurrentInput(input.value);
        }
        return;
      }
      lastSpaceTime = now;
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
        partialText: ''
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
        addSuggestionMessage(`Error: ${response.error}`);
      } else {
        addSuggestionMessage(response.suggestion);
      }
      
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      addSuggestionMessage('Sorry, I couldn\'t process your suggestion right now.');
    } finally {
      setSuggestionState(prev => ({ 
        ...prev, 
        isLoading: false,
        isActive: false,
        partialText: ''
      }));
      setCurrentInput('');
    }
  };

  // Add a suggestion message to current chat
  const addSuggestionMessage = (suggestion: string) => {
    const chat = getCurrentChat();
    if (!chat) return;

    const suggestionMessage: ChatMessage = {
      id: chatSuggestionService.generateMessageId(),
      type: 'suggestion',
      content: suggestion,
      timestamp: Date.now(),
      isComplete: true
    };

    setChats(prev => prev.map(c => 
      c.id === chat.id 
        ? { ...c, messages: [...c.messages, suggestionMessage] }
        : c
    ));
    saveChatsToStorage();
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
  const handleSendMessage = () => {
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
  };

  // Open side chat for grammar discussion
  const openSideChat = () => {
    const chat = getCurrentChat();
    if (!chat) return;

    // Find the most recent suggestion message
    const recentSuggestion = [...chat.messages]
      .reverse()
      .find(msg => msg.type === 'suggestion');

    if (!recentSuggestion) {
      console.log('No recent suggestion found for side chat');
      return;
    }

    // Get some context from recent messages
    const context = chatSuggestionService.buildChatContext(chat.messages, 2);

    setSideChatState({
      isOpen: true,
      context,
      suggestion: recentSuggestion.content,
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
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
        isComplete: true
      };

      setSideChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage]
      }));
    }
  };

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
        {params.chatId && getCurrentChat() ? (
          <>
            {/* Chat header */}
            <div class="p-4 border-b border-gray-200 bg-white">
              <h2 class="font-medium text-gray-900">
                {getCurrentChat()?.title || 'Chat'}
              </h2>
              <div class="text-sm text-gray-500 mt-1">
                {suggestionState().isActive ? (
                  <span class="text-amber-600 font-medium animate-pulse">
                    🌟 Suggestion Mode Active - Type what you want to say
                  </span>
                ) : suggestionState().isLoading ? (
                  <span class="text-blue-600 font-medium">
                    🤔 Getting your Spanish suggestion...
                  </span>
                ) : (
                  'Press space twice quickly to enter suggestion mode • Shift+Enter for grammar help'
                )}
              </div>
            </div>

            {/* Messages */}
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              <For each={getCurrentChat()?.messages || []}>
                {(message) => (
                  <div class={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div class={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white'
                        : message.type === 'suggestion'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
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

              {suggestionState().isLoading && (
                <div class="flex justify-start">
                  <div class="bg-amber-100 border border-amber-200 rounded-lg px-4 py-2 text-amber-800">
                    <div class="flex items-center gap-2">
                      <div class="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      Getting suggestion...
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
                    ? "Type what you want to say in English or broken Spanish..."
                    : "Type your message... (space twice for suggestion mode)"
                  }
                  class={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    suggestionState().isActive ? 'ring-2 ring-amber-400 border-amber-400' : ''
                  }`}
                  disabled={suggestionState().isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!currentInput().trim() || suggestionState().isLoading}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                <span class="font-medium">Tips:</span> Space twice → suggestion mode | Shift+Enter → grammar chat | Enter → send
              </div>
            </div>
          </>
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