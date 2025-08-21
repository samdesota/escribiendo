import { useNavigate } from '@solidjs/router';

export default function ChatIndex() {
  const navigate = useNavigate();

  const createNewChat = () => {
    // Generate a new chat ID and navigate to it
    const chatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    navigate(`/chat/${chatId}`);
  };

  return (
    <div class="h-screen flex bg-gray-50">
      {/* Sidebar placeholder */}
      <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <h1 class="text-lg font-semibold text-gray-900">Chat Experiment</h1>
          <button
            onClick={createNewChat}
            class="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + New Chat
          </button>
        </div>
        <div class="flex-1 flex items-center justify-center text-gray-500">
          <div class="text-center">
            <p class="text-sm">No chats yet</p>
            <p class="text-xs mt-1">Create a new chat to get started</p>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div class="flex-1 flex items-center justify-center text-gray-500">
        <div class="text-center">
          <h2 class="text-2xl font-bold mb-4 text-gray-900">Welcome to Chat Experiment</h2>
          <p class="text-lg mb-6 text-gray-600">
            Practice Spanish with AI-powered suggestions
          </p>
          <div class="max-w-md mx-auto text-left bg-white p-6 rounded-lg shadow-sm border">
            <h3 class="font-medium mb-3 text-gray-900">How it works:</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start gap-2">
                <span class="text-blue-600 font-medium">1.</span>
                Type something like "quiero algo con cool socks"
              </li>
              <li class="flex items-start gap-2">
                <span class="text-amber-600 font-medium">2.</span>
                Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> to get a Spanish suggestion
              </li>
              <li class="flex items-start gap-2">
                <span class="text-green-600 font-medium">3.</span>
                Get instant Spanish suggestion
              </li>
              <li class="flex items-start gap-2">
                <span class="text-purple-600 font-medium">4.</span>
                Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> again to accept or <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to cancel
              </li>
              <li class="flex items-start gap-2">
                <span class="text-red-600 font-medium">5.</span>
                Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd> to discuss grammar
              </li>
            </ul>
          </div>
          <button
            onClick={createNewChat}
            class="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Start Your First Chat
          </button>
        </div>
      </div>
    </div>
  );
}