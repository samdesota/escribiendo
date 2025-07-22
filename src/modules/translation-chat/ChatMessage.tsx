import { Component } from 'solid-js';
import type { ChatMessage as ChatMessageType } from '~/services/translation';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: Component<ChatMessageProps> = (props) => {
  const isUser = () => props.message.type === 'user';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div class={`flex ${isUser() ? 'justify-end' : 'justify-start'} mb-3`}>
      <div class={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isUser()
          ? 'bg-blue-600 text-white ml-12'
          : 'bg-gray-100 text-gray-800 mr-12'
        }`}>
        <div class="whitespace-pre-wrap">{props.message.content}</div>
        <div class={`text-xs mt-1 opacity-70 ${isUser() ? 'text-blue-100' : 'text-gray-500'
          }`}>
          {formatTime(props.message.timestamp)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
