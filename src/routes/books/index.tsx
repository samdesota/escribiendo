import { createAsync, query, type RouteDefinition } from '@solidjs/router';
import { For, createSignal, Show, Suspense } from 'solid-js';
import { Title } from '@solidjs/meta';
import { getBooksWithProgress } from '~/server/db/book-queries';

const booksQuery = query(async () => {
  'use server';
  // TODO: Get actual user ID from authentication
  const userId = 'user-1'; // Placeholder for now
  return getBooksWithProgress(userId);
}, 'books');

export const route = { preload: () => booksQuery() } satisfies RouteDefinition;

export default function BooksPage() {
  const books = createAsync(() => booksQuery());
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('epub', file);
      formData.append('title', file.name.replace('.epub', ''));
      formData.append('language', 'es'); // Default to Spanish

      const response = await fetch('/api/books', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Refresh the books list
      window.location.reload();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      target.value = ''; // Reset input
    }
  };

  return (
    <div class='container mx-auto px-4 py-8'>
      <Title>Books - Escribiendo</Title>

      <div class='max-w-6xl mx-auto'>
        <div class='flex justify-between items-center mb-8'>
          <h1 class='text-3xl font-bold text-gray-900'>My Library</h1>

          {/* Upload Button */}
          <div class='relative'>
            <input
              type='file'
              accept='.epub'
              onChange={handleFileUpload}
              disabled={isUploading()}
              class='absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed'
              id='epub-upload'
            />
            <label
              for='epub-upload'
              class={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isUploading()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {isUploading() ? (
                <>
                  <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2'></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg
                    class='w-4 h-4 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width={2}
                      d='M12 4v16m8-8H4'
                    />
                  </svg>
                  Add Book
                </>
              )}
            </label>
          </div>
        </div>

        {/* Upload Error */}
        <Show when={uploadError()}>
          <div class='mb-4 p-4 bg-red-50 border border-red-200 rounded-md'>
            <p class='text-red-800'>{uploadError()}</p>
          </div>
        </Show>

        {/* Books Grid */}
        <Suspense
          fallback={
            <div class='flex justify-center items-center h-64'>
              <div class='text-center'>
                <div class='w-8 h-8 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin mx-auto mb-4'></div>
                <p class='text-gray-600'>Loading your library...</p>
              </div>
            </div>
          }
        >
          <Show
            when={books() && books()!.length > 0}
            fallback={
              <div class='text-center py-12'>
                <svg
                  class='w-16 h-16 mx-auto text-gray-400 mb-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width={2}
                    d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                  />
                </svg>
                <h3 class='text-lg font-medium text-gray-900 mb-2'>
                  No books yet
                </h3>
                <p class='text-gray-600 mb-4'>
                  Upload your first EPUB to start reading
                </p>
              </div>
            }
          >
            <div class='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'>
              <For each={books()}>
                {book => (
                  <div class='group relative'>
                    <a
                      href={`/books/${book.id}`}
                      class='block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4'
                    >
                      {/* Book Cover Placeholder */}
                      <div class='aspect-[3/4] bg-gradient-to-br from-blue-500 to-purple-600 rounded-md mb-3 flex items-center justify-center'>
                        {book.coverImageUrl ? (
                          <img
                            src={book.coverImageUrl}
                            alt={book.title}
                            class='w-full h-full object-cover rounded-md'
                          />
                        ) : (
                          <svg
                            class='w-12 h-12 text-white'
                            fill='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path d='M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z' />
                          </svg>
                        )}
                      </div>

                      {/* Book Info */}
                      <h3 class='font-medium text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-blue-600'>
                        {book.title}
                      </h3>
                      <p class='text-xs text-gray-600 mb-2 line-clamp-1'>
                        {book.author || 'Unknown Author'}
                      </p>

                      {/* Reading Progress */}
                      <Show when={book.progress}>
                        <div class='w-full bg-gray-200 rounded-full h-1.5 mb-2'>
                          <div
                            class='bg-blue-600 h-1.5 rounded-full transition-all'
                            style={{
                              width: `${book.progress?.progressPercentage || 0}%`,
                            }}
                          ></div>
                        </div>
                        <p class='text-xs text-gray-500'>
                          {book.progress?.progressPercentage || 0}% complete
                        </p>
                      </Show>
                    </a>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Suspense>
      </div>
    </div>
  );
}
