import { For, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

export interface Chat {
  id: string;
  title: string;
  model?: string;
  createdAt: number;
}

export interface ChatSidebarProps {
  chats: Chat[];
  onCreateNewChat: () => void;
  onDeleteChat?: (chatId: string) => void;
  isLoading?: boolean;
}

export default function ChatSidebar(props: ChatSidebarProps) {
  const navigate = useNavigate();
  const params = useParams();

  return (
    <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div class="p-4 border-b border-gray-200">
        <h1 class="text-lg font-semibold text-gray-900">Chat Experiment</h1>
        <button
          onClick={props.onCreateNewChat}
          class="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + New Chat
        </button>
      </div>

      {/* Chat list */}
      <div class="flex-1 overflow-y-auto p-2">
        {props.isLoading ? (
          <div class="p-4 text-center text-gray-500">
            Loading chats...
          </div>
        ) : (
          <>
            <For each={props.chats}>
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
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                  
                  {/* Delete button - only show if onDeleteChat is provided */}
                  {props.onDeleteChat && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onDeleteChat!(chat.id);
                      }}
                      class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete chat"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </For>
            
            {props.chats.length === 0 && !props.isLoading && (
              <div class="text-center text-gray-500 mt-8">
                <p class="text-sm">No chats yet</p>
                <p class="text-xs mt-1">Create a new chat to get started</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}