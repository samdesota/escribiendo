import { createSignal, onMount, onCleanup, Show, createEffect } from 'solid-js';
import ePub from 'epubjs';
import type { Book as EpubBook, Rendition, Contents } from 'epubjs';
import { ClientLLMService } from '~/services/llm/ClientLLMService';
import SelectableText from './SelectableText';
import type { Book } from '~/server/db/schema';
// @ts-ignore
import InlineView from 'epubjs/lib/managers/views/inline';

export interface EpubReaderProps {
  book: Book;
  onProgressUpdate?: (location: string, percentage: number) => void;
  onBookmarkAdd?: (location: string, text?: string) => void;
  onOpenSideChat?: (
    selectedText: string,
    translation: string,
    context: string
  ) => void;
}

export default function EpubReader(props: EpubReaderProps) {
  let viewerRef: HTMLDivElement | undefined;
  const [epubBook, setEpubBook] = createSignal<EpubBook | null>(null);
  const [rendition, setRendition] = createSignal<Rendition | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(1);
  const [currentChapter, setCurrentChapter] = createSignal('');
  const [isBookmarkDialogOpen, setIsBookmarkDialogOpen] = createSignal(false);
  const [bookmarkNote, setBookmarkNote] = createSignal('');

  // Translation functionality
  const llmService = new ClientLLMService('gpt-4o');

  const initializeReader = async () => {
    if (!viewerRef) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load the EPUB from our API endpoint
      const book = ePub(
        `http://localhost:3000/api/books/${props.book.id}/content.epub`
      );
      setEpubBook(book);

      // Set up the rendition
      const rendition = book.renderTo(viewerRef, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        view: InlineView,
      });
      setRendition(rendition);

      // Display the book
      await rendition.display();

      // Set up navigation and progress tracking
      book.ready
        .then(() => {
          const spine = book.spine as any;
          setTotalPages(spine.length);
        })
        .catch(error => {
          console.error('Error:', error);
        });

      // Track location changes for progress
      rendition.on('relocated', (location: any) => {
        const percentage = Math.round(location.start.percentage * 100);
        setCurrentPage(location.start.index + 1);

        // Update chapter title
        const currentSection = book.spine.get(location.start.cfi);
        if (currentSection) {
          setCurrentChapter(currentSection.href);
        }

        // Call progress update callback
        props.onProgressUpdate?.(location.start.cfi, percentage);
      });

      // Log when sections are rendered
      rendition.on('rendered', (section: any) => {
        const contents = section.contents as Contents;
        console.log('Contents:', contents);
      });

      rendition.on('error', (error: any) => {
        console.error('Error:', error);
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load EPUB:', err);
      setError('Failed to load book. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDiscussTranslation = (
    selectedText: string,
    translation: string,
    context: string
  ) => {
    if (props.onOpenSideChat) {
      props.onOpenSideChat(
        selectedText,
        translation,
        `Reading "${props.book.title}"`
      );
    }
  };

  const nextPage = () => {
    const rend = rendition();
    if (rend) {
      rend.next();
    }
  };

  const prevPage = () => {
    const rend = rendition();
    if (rend) {
      rend.prev();
    }
  };

  const addBookmark = () => {
    const rend = rendition();
    if (!rend) return;

    const location = rend.currentLocation();
    if (location) {
      // Get selected text if any
      const iframe = viewerRef?.querySelector('iframe');
      const selectedText = iframe?.contentDocument
        ?.getSelection()
        ?.toString()
        .trim();

      // The currentLocation() method returns an object with start and end properties
      // Each has a cfi property containing the CFI string
      const cfi = (location as any)?.start?.cfi || '';
      props.onBookmarkAdd?.(cfi, selectedText);
      setIsBookmarkDialogOpen(false);
      setBookmarkNote('');
    }
  };

  // Handle keyboard navigation
  const handleKeyPress = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        prevPage();
        break;
      case 'ArrowRight':
        nextPage();
        break;
      case 'b':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setIsBookmarkDialogOpen(true);
        }
        break;
    }
  };

  onMount(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('keydown', handleKeyPress);
      initializeReader();
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      document.removeEventListener('keydown', handleKeyPress);
    }

    const rend = rendition();
    if (rend) {
      rend.destroy();
    }
  });

  return (
    <div class='flex flex-col h-full'>
      {/* Header Controls */}
      <div class='flex items-center justify-between p-4 border-b border-gray-200 bg-white'>
        <div class='flex items-center gap-4'>
          <button
            onClick={prevPage}
            disabled={currentPage() <= 1}
            class='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded'
          >
            ← Previous
          </button>
          <span class='text-sm text-gray-600'>
            Page {currentPage()} of {totalPages()}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage() >= totalPages()}
            class='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded'
          >
            Next →
          </button>
        </div>

        <div class='flex items-center gap-2'>
          <button
            onClick={() => setIsBookmarkDialogOpen(true)}
            class='px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded'
            title='Add Bookmark (Ctrl+B)'
          >
            📖 Bookmark
          </button>
        </div>
      </div>

      {/* Reader Container */}
      <div class='flex-1 relative bg-white'>
        <Show when={isLoading()}>
          <div class='absolute inset-0 flex items-center justify-center bg-white'>
            <div class='text-center'>
              <div class='w-8 h-8 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin mx-auto mb-4'></div>
              <p class='text-gray-600'>Loading "{props.book.title}"...</p>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div class='absolute inset-0 flex items-center justify-center bg-white'>
            <div class='text-center'>
              <p class='text-red-600 mb-4'>{error()}</p>
              <button
                onClick={initializeReader}
                class='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
              >
                Try Again
              </button>
            </div>
          </div>
        </Show>

        <SelectableText
          translationService={llmService}
          additionalContext={`Reading "${props.book.title}" by ${props.book.author || 'Unknown Author'}`}
          onDiscussTranslation={handleDiscussTranslation}
          enableDiscussion={true}
          className='w-full h-full'
        >
          <div
            ref={viewerRef}
            style={{
              display: isLoading() || error() ? 'none' : 'block',
              width: '100%',
              height: '100%',
              'max-width': '800px',
            }}
          />
        </SelectableText>
      </div>

      {/* Bookmark Dialog */}
      <Show when={isBookmarkDialogOpen()}>
        <div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div class='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <h3 class='text-lg font-medium mb-4'>Add Bookmark</h3>
            <textarea
              value={bookmarkNote()}
              onInput={e => setBookmarkNote(e.target.value)}
              placeholder='Add a note (optional)'
              class='w-full p-3 border border-gray-300 rounded-md resize-none'
              rows='3'
            />
            <div class='flex gap-3 mt-4'>
              <button
                onClick={addBookmark}
                class='flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
              >
                Save Bookmark
              </button>
              <button
                onClick={() => setIsBookmarkDialogOpen(false)}
                class='px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
