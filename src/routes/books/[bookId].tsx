import {
  createAsync,
  query,
  useParams,
  type RouteDefinition,
} from '@solidjs/router';
import { createSignal, Show, Suspense } from 'solid-js';
import { Title } from '@solidjs/meta';
import EpubReader from '~/components/EpubReader';
import SideChat from '~/components/SideChat';
import { ClientLLMService } from '~/services/llm/ClientLLMService';
import { ChatSuggestionService } from '~/services/llm/ChatSuggestionService';
import type { SideChatState } from '~/components/types';
import { getBookWithProgress } from '~/server/db/book-queries';

const bookQuery = query(async (bookId: string) => {
  'use server';
  // TODO: Get actual user ID from authentication
  const userId = 'user-1'; // Placeholder for now
  return getBookWithProgress(userId, bookId);
}, 'book');

export const route = {
  preload: ({ params }) => bookQuery(params.bookId),
} satisfies RouteDefinition;

export default function BookReaderPage() {
  const params = useParams();
  const book = createAsync(() => bookQuery(params.bookId));

  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: [],
  });

  // Initialize services
  const llmService = new ClientLLMService('gpt-4o');
  const chatSuggestionService = new ChatSuggestionService();

  const handleProgressUpdate = async (location: string, percentage: number) => {
    try {
      await fetch(`/api/books/${params.bookId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentLocation: location,
          progressPercentage: percentage,
        }),
      });
    } catch (error) {
      console.error('Failed to update reading progress:', error);
    }
  };

  const handleBookmarkAdd = async (location: string, text?: string) => {
    try {
      // TODO: Implement bookmark API endpoint
      console.log('Adding bookmark:', { location, text });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  };

  const handleOpenSideChat = (
    selectedText: string,
    translation: string,
    context: string
  ) => {
    setSideChatState({
      isOpen: true,
      context: `The user is reading "${book()?.title}" by ${book()?.author || 'Unknown Author'}. ${context}`,
      suggestion: `Spanish: "${selectedText}" → English: "${translation}"`,
      messages: [],
    });
  };

  const handleSideChatClose = () => {
    setSideChatState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSideChatMessage = (message: any) => {
    setSideChatState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  return (
    <div class='h-screen flex flex-col'>
      <Suspense
        fallback={
          <div class='flex-1 flex items-center justify-center'>
            <div class='text-center'>
              <div class='w-8 h-8 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin mx-auto mb-4'></div>
              <p class='text-gray-600'>Loading book...</p>
            </div>
          </div>
        }
      >
        <Show when={book()}>
          <Title>{book()!.title} - Escribiendo</Title>

          {/* Header */}
          <div class='bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between'>
            <div class='flex items-center gap-4'>
              <a
                href='/books'
                class='text-gray-600 hover:text-gray-900 flex items-center gap-2'
              >
                <svg
                  class='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width={2}
                    d='M15 19l-7-7 7-7'
                  />
                </svg>
                Back to Library
              </a>
              <div class='border-l border-gray-300 pl-4'>
                <h1 class='font-medium text-gray-900'>{book()!.title}</h1>
                <p class='text-sm text-gray-600'>
                  {book()!.author || 'Unknown Author'}
                </p>
              </div>
            </div>

            <div class='flex items-center gap-2'>
              <Show when={book()!.progress}>
                <div class='text-sm text-gray-600'>
                  {book()!.progress?.progressPercentage || 0}% complete
                </div>
              </Show>
            </div>
          </div>

          {/* Reader Container */}
          <div class='flex-1 flex relative'>
            <div
              class={`transition-all duration-300 ${
                sideChatState().isOpen ? 'w-2/3' : 'w-full'
              }`}
            >
              <EpubReader
                book={book()!}
                onProgressUpdate={handleProgressUpdate}
                onBookmarkAdd={handleBookmarkAdd}
                onOpenSideChat={handleOpenSideChat}
              />
            </div>

            {/* Side Chat */}
            <Show when={sideChatState().isOpen}>
              <div class='w-1/3 border-l border-gray-200 bg-white'>
                <SideChat
                  isOpen={sideChatState().isOpen}
                  context={sideChatState().context}
                  suggestion={sideChatState().suggestion}
                  messages={sideChatState().messages}
                  onClose={handleSideChatClose}
                  onSendMessage={handleSideChatMessage}
                  chatSuggestionService={llmService}
                />
              </div>
            </Show>
          </div>
        </Show>
      </Suspense>
    </div>
  );
}
