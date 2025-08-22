// Client-side API helpers for chat and message operations

export interface ChatData {
  id: string;
  title: string;
  model?: string;
  createdAt: number;
  messages?: MessageData[];
}

export interface MessageData {
  id: string;
  chatId: string;
  type: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: number;
  isComplete?: boolean;
}

// Chat API functions
export async function createChatAPI(data: Omit<ChatData, 'updatedAt'>): Promise<ChatData> {
  const response = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create chat');
  }
  
  return response.json();
}

export async function updateChatAPI(id: string, data: Partial<ChatData>): Promise<ChatData> {
  const response = await fetch(`/api/chats/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update chat');
  }
  
  return response.json();
}

export async function deleteChatAPI(id: string): Promise<void> {
  const response = await fetch(`/api/chats/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete chat');
  }
}

// Message API functions
export async function createMessageAPI(data: MessageData): Promise<MessageData> {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create message');
  }
  
  return response.json();
}

export async function updateMessageAPI(id: string, data: Partial<MessageData>): Promise<MessageData> {
  const response = await fetch(`/api/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update message');
  }
  
  return response.json();
}