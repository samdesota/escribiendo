import { Suspense, createSignal } from 'solid-js';
import {
  createAsync,
  query,
  RouteDefinition,
  A,
  useNavigate,
  useLocation,
  revalidate,
} from '@solidjs/router';
import {
  getJournalEntries,
  createJournalEntry,
} from '~/server/db/journal-queries';
import { Show } from 'solid-js';
import type { RouteSectionProps } from '@solidjs/router';

// Mock user ID for now - replace with actual auth later
const MOCK_USER_ID = 'user-123';

// Server queries
const journalEntriesQuery = query(async () => {
  'use server';
  return await getJournalEntries(MOCK_USER_ID);
}, 'journal-entries');

export const route = {
  preload: () => journalEntriesQuery(),
} satisfies RouteDefinition;

export default function JournalLayout(props: RouteSectionProps) {
  const journalEntries = createAsync(() => journalEntriesQuery());
  const navigate = useNavigate();
  const location = useLocation();

  // Create new journal entry and navigate to it
  const createNewEntry = async () => {
    try {
      const newEntryId = `${Date.now()}`;

      // Actually create the journal entry in the database
      await createJournalEntry({
        id: newEntryId,
        userId: MOCK_USER_ID,
        title: 'Nueva Entrada',
        content: { type: 'doc', content: [] }, // Empty ProseMirror document
        plainText: '',
        wordCount: 0,
      });

      // Revalidate the entries list to show the new entry
      revalidate(journalEntriesQuery.key);

      // Navigate to the new entry
      navigate(`/journal/${newEntryId}`);
    } catch (error) {
      console.error('Error creating new journal entry:', error);
      // TODO: Show user-friendly error message
    }
  };

  // Navigate to existing entry
  const openEntry = (entryId: string) => {
    navigate(`/journal/${entryId}`);
  };

  // Get current entry ID from URL
  const getCurrentEntryId = () => {
    const parts = location.pathname.split('/');
    return parts[2] || null;
  };

  return (
    <div class='flex h-full bg-gray-50'>
      {/* Journal Entries Sidebar */}
      <div class='w-80 bg-white border-r border-gray-200 flex flex-col h-full'>
        <div class='p-4 border-b border-gray-200 flex-shrink-0'>
          <div class='flex items-center justify-between mb-4'>
            <A href='/journal' class='text-decoration-none'>
              <h1 class='text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors'>
                Diario en Español
              </h1>
            </A>
            <button
              onClick={createNewEntry}
              class='px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm'
            >
              Nueva Entrada
            </button>
          </div>
          <p class='text-sm text-gray-600'>
            Práctica escribiendo en español con correcciones inteligentes
          </p>
        </div>

        {/* Entries List */}
        <div class='flex-1 overflow-y-auto min-h-0'>
          <Suspense
            fallback={
              <div class='p-4'>
                <div class='animate-pulse space-y-3'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div class='h-16 bg-gray-200 rounded-lg'></div>
                  ))}
                </div>
              </div>
            }
          >
            <Show when={journalEntries()}>
              {entries => (
                <div class='p-2'>
                  {entries().length === 0 ? (
                    <div class='p-4 text-center text-gray-500'>
                      <p class='mb-2'>No hay entradas aún</p>
                      <p class='text-sm'>
                        Crea tu primera entrada para empezar
                      </p>
                    </div>
                  ) : (
                    <div class='space-y-2'>
                      {entries().map(entry => (
                        <button
                          onClick={() => openEntry(entry.id)}
                          class={`w-full p-3 text-left rounded-lg transition-colors ${
                            getCurrentEntryId() === entry.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div class='font-medium text-gray-900 mb-1 truncate'>
                            {entry.title}
                          </div>
                          <div class='text-sm text-gray-500 mb-1'>
                            {new Date(entry.updatedAt).toLocaleDateString(
                              'es-ES',
                              {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }
                            )}
                          </div>
                          <div class='text-xs text-gray-400'>
                            {entry.wordCount} palabras
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Show>
          </Suspense>
        </div>
      </div>

      {/* Main Content Area */}
      <div class='flex-1 flex flex-col h-full overflow-hidden'>
        {props.children}
      </div>
    </div>
  );
}
