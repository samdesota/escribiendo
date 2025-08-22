import { createSignal, createEffect } from 'solid-js';
import { useParams, useNavigate, createAsync, type RouteDefinition, revalidate } from '@solidjs/router';
import { ClientLLMService } from '~/services/llm';
import { createChatAPI, updateChatAPI, deleteChatAPI, createMessageAPI, type MessageData } from '~/lib/api';
import { chatsQuery, chatQuery } from '~/lib/queries';
import ChatSidebar, { type Chat as SidebarChat } from '~/components/ChatSidebar';
import ChatConversation from '~/components/ChatConversation';
import { Chat, ChatMessage } from '~/components/types';

export const route = { 
  preload: ({ params }) => {
    // Preload both the chat list and the specific chat if we have an ID
    const chatsPromise = chatsQuery();
    if (params.chatId) {
      const chatPromise = chatQuery(params.chatId);
      return { chats: chatsPromise, chat: chatPromise };
    }
    return { chats: chatsPromise };
  }
} satisfies RouteDefinition;

export default function ChatExperiment() {
  // Initialize services
  const [llmService, setLlmService] = createSignal(new ClientLLMService());
  const params = useParams();
  const navigate = useNavigate();

  // Main state - now loaded from server
  const chatsData = createAsync(() => chatsQuery());
  const currentChatData = createAsync(async () => {
    const chatId = params.chatId;
    if (!chatId) return null;
    return await chatQuery(chatId);
  });
  const [chats, setChats] = createSignal<Chat[]>([]);
  const [currentChat, setCurrentChat] = createSignal<Chat | null>(null);

  // Sync server data with local state
  createEffect(() => {
    const serverChats = chatsData();
    if (serverChats) {
      // Convert server data to local Chat interface format for sidebar
      const formattedChats: Chat[] = serverChats.map(chat => ({
        id: chat.id,
        title: chat.title,
        model: (chat as any).model || 'gpt-4o',
        messages: [], // Messages will be loaded separately per chat
        createdAt: chat.createdAt
      }));
      setChats(formattedChats);
    }
  });

  // Sync current chat data with local state
  createEffect(() => {
    const serverChat = currentChatData();
    const chatId = params.chatId;
    
    if (serverChat && chatId) {
      // Update the current chat with its messages
      const chatWithMessages: Chat = {
        id: serverChat.id,
        title: serverChat.title,
        model: serverChat.model || 'claude-3.5-sonnet',
        messages: serverChat.messages.map(msg => ({
          id: msg.id,
          type: msg.type as 'user' | 'assistant' | 'suggestion',
          content: msg.content,
          timestamp: msg.timestamp,
          isComplete: msg.isComplete ?? true
        })),
        createdAt: serverChat.createdAt
      };
      
      console.log('serverChat', serverChat);
      // Switch LLM service to use the chat's model
      const chatModel = (serverChat as any).model || 'gpt-4o';
      const service = new ClientLLMService(chatModel);
      setLlmService(service);
      setCurrentChat(chatWithMessages);
      
      // Also update the chats list for sidebar
      setChats(prev => {
        const updated = prev.map(chat => 
          chat.id === chatId ? { ...chat, title: serverChat.title } : chat
        );
        
        // If chat doesn't exist in local state, add it
        const chatExists = prev.some(c => c.id === chatId);
        if (!chatExists) {
          const sidebarChat: Chat = {
            id: serverChat.id,
            title: serverChat.title,
            model: serverChat.model || 'claude-3.5-sonnet',
            messages: [],
            createdAt: serverChat.createdAt
          };
          return [sidebarChat, ...updated];
        }
        
        return updated;
      });
    }
  });

  // Save message to database
  const saveMessageToDatabase = async (message: ChatMessage) => {
    try {
      const chat = currentChat();
      if (!chat) {
        console.warn('No current chat found when saving message');
        return;
      }
      
      await createMessageAPI({
        id: message.id,
        chatId: chat.id,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        isComplete: message.isComplete
      });
      
      // Update local state immediately
      setCurrentChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message]
      } : null);
      
      // Revalidate server data for the specific chat
      revalidate([chatQuery.key, chat.id]);
    } catch (error) {
      console.warn('Failed to save message:', error);
    }
  };

  // Create a new chat
  const createNewChat = async (modelId?: string) => {
    // Create new chat without welcome message - conversation starters will be shown instead
    const newChatData = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Chat ${chats().length + 1}`,
              model: modelId || 'gpt-4o',
      createdAt: Date.now()
    };

    try {
      const createdChat = await createChatAPI(newChatData);
      const newChat: Chat = {
        ...createdChat,
        model: createdChat.model || 'gpt-4o',
        messages: []
      };
      
      setChats(prev => [newChat, ...prev]);
      
      // Revalidate server data
      revalidate(chatsQuery.key);
      
      // Navigate to the new chat
      navigate(`/chat/${newChat.id}`);
      return newChat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      // Fallback to local creation for now
      const newChat: Chat = {
        ...newChatData,
        model: newChatData.model || 'gpt-4o',
        messages: []
      };
      setChats(prev => [newChat, ...prev]);
      navigate(`/chat/${newChat.id}`);
      return newChat;
    }
  };

  // Create a new chat with the current URL's chatId if it doesn't exist
  const createChatWithId = async (chatId: string) => {
    // Create new chat without welcome message - conversation starters will be shown instead
    const newChatData = {
      id: chatId,
      title: `Chat ${chats().length + 1}`,
      model: 'gpt-4o',
      createdAt: Date.now()
    };

    try {
      const createdChat = await createChatAPI(newChatData);
      const newChat: Chat = {
        ...createdChat,
        model: createdChat.model || 'gpt-4o',
        messages: []
      };
      
      setChats(prev => [newChat, ...prev]);
      
      // Revalidate server data
      revalidate(chatsQuery.key);
      
      return newChat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      // Fallback to local creation
      const newChat: Chat = {
        ...newChatData,
        model: newChatData.model || 'gpt-4o',
        messages: []
      };
      setChats(prev => [newChat, ...prev]);
      return newChat;
    }
  };

  // Delete a chat
  const deleteChat = async (chatId: string) => {
    try {
      await deleteChatAPI(chatId);
      
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
    } catch (error) {
      console.error('Failed to delete chat:', error);
      // Still remove from local state on error
      setChats(prev => prev.filter(chat => chat.id !== chatId));
    }
  };

  // Update chat title based on first message
  const updateChatTitle = async (chatId: string, firstMessage: string) => {
    const title = firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + '...'
      : firstMessage;
    
    try {
      await updateChatAPI(chatId, { title });
      
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, title: title || `Chat ${prev.indexOf(c) + 1}` }
          : c
      ));
      
      // Also update current chat if it's the same
      setCurrentChat(prev => prev && prev.id === chatId
        ? { ...prev, title: title || `Chat` }
        : prev
      );
    } catch (error) {
      console.error('Failed to update chat title:', error);
      // Still update locally on error
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, title: title || `Chat ${prev.indexOf(c) + 1}` }
          : c
      ));
      
      setCurrentChat(prev => prev && prev.id === chatId
        ? { ...prev, title: title || `Chat` }
        : prev
      );
    }
  };

  // Switch chat model
  const switchChatModel = async (chatId: string, modelId: string) => {
    try {
      await updateChatAPI(chatId, { model: modelId });
      
      // Update local state
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, model: modelId } : chat
      ));
      
      setCurrentChat(prev => prev ? { ...prev, model: modelId } : null);
      
      // Switch the LLM service to use the new model
      const newService = new ClientLLMService(modelId);
      setLlmService(newService);
      
      // Revalidate server data
      revalidate([chatQuery.key, chatId]);
    } catch (error) {
      console.error('Failed to update chat model:', error);
    }
  };

  // Handle case where chat doesn't exist - create it
  createEffect(() => {
    const chatId = params.chatId;
    const serverChat = currentChatData();
    
    // If we have a chatId but no server data (chat doesn't exist), create it
    if (chatId && serverChat === null && typeof window !== 'undefined') {
      createChatWithId(chatId);
    }
  });

  return (
    <div class="h-screen flex bg-gray-50">
      {/* Sidebar with chat list */}
      <ChatSidebar
        chats={chats().map(chat => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt
        }))}
        onCreateNewChat={() => createNewChat()}
        onDeleteChat={deleteChat}
        isLoading={false}
      />

      {/* Main chat area */}
      <div class="flex-1 flex flex-col relative">
        {params.chatId ? (
          currentChat() ? (
            <ChatConversation
              chat={currentChat()}
              chatSuggestionService={llmService()}
              onSaveMessage={saveMessageToDatabase}
              onUpdateChatTitle={updateChatTitle}
              onSwitchModel={switchChatModel}
            />
          ) : (
            // Chat ID exists but chat not found - show loading
            <div class="flex-1 flex items-center justify-center text-gray-500">
              <div class="text-center">
                <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p>Loading chat...</p>
              </div>
            </div>
          )
        ) : (
          <div class="flex-1 flex items-center justify-center text-gray-500">
            <div class="text-center">
              <h3 class="text-lg font-medium mb-2">Welcome to Chat Experiment</h3>
              <p class="mb-4">Create a new chat to start experimenting with Spanish suggestions</p>
              <button
                onClick={() => createNewChat()}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}