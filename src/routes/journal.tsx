import { Suspense, createSignal, createResource, Show, onMount } from "solid-js";
import { createAsync, query, RouteDefinition, action, redirect, revalidate } from "@solidjs/router";
import { ClientLLMService } from "~/services/llm";
import JournalEditor from "~/components/JournalEditor";
import { getJournalEntries, getJournalEntry } from "~/server/db/journal-queries";
import type { journalEntries } from "~/server/db/schema";

// Mock user ID for now - replace with actual auth later
const MOCK_USER_ID = "user-123";

// Server queries
const journalEntriesQuery = query(async () => {
  "use server";
  return await getJournalEntries(MOCK_USER_ID);
}, "journal-entries");

export const route = { 
  preload: () => journalEntriesQuery() 
} satisfies RouteDefinition;

export default function JournalPage() {
  const journalEntries = createAsync(() => journalEntriesQuery());
  const [selectedEntryId, setSelectedEntryId] = createSignal<string | null>(null);
  const [llmService] = createSignal(new ClientLLMService());

  // Create new journal entry
  const createNewEntry = async () => {
    const newEntryId = `journal-${Date.now()}`;
    setSelectedEntryId(newEntryId);
    // The JournalEditor will handle creation when content is first saved
  };

  // Load existing entry
  const loadEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
  };

  return (
    <div class="flex h-screen bg-gray-50">
      {/* Journal Entries Sidebar */}
      <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-xl font-semibold text-gray-900">
              Diario en Español
            </h1>
            <button
              onClick={createNewEntry}
              class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Nueva Entrada
            </button>
          </div>
          <p class="text-sm text-gray-600">
            Práctica escribiendo en español con correcciones inteligentes
          </p>
        </div>

        {/* Entries List */}
        <div class="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div class="p-4">
              <div class="animate-pulse space-y-3">
                {Array.from({length: 5}).map((_, i) => (
                  <div class="h-16 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          }>
            <Show when={journalEntries()}>
              {(entries) => (
                <div class="p-2">
                  {entries().length === 0 ? (
                    <div class="p-4 text-center text-gray-500">
                      <p class="mb-2">No hay entradas aún</p>
                      <p class="text-sm">Crea tu primera entrada para empezar</p>
                    </div>
                  ) : (
                    <div class="space-y-2">
                      {entries().map((entry) => (
                        <button
                          onClick={() => loadEntry(entry.id)}
                          class={`w-full p-3 text-left rounded-lg transition-colors ${
                            selectedEntryId() === entry.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div class="font-medium text-gray-900 mb-1 truncate">
                            {entry.title}
                          </div>
                          <div class="text-sm text-gray-500 mb-1">
                            {new Date(entry.updatedAt).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </div>
                          <div class="text-xs text-gray-400">
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

      {/* Main Editor Area */}
      <div class="flex-1 flex flex-col">
        <Show 
          when={selectedEntryId()} 
          fallback={
            <div class="flex-1 flex items-center justify-center text-gray-500">
              <div class="text-center max-w-md">
                <h2 class="text-2xl font-semibold mb-4">
                  Bienvenido a tu Diario en Español
                </h2>
                <p class="mb-6 text-gray-600">
                  Selecciona una entrada existente o crea una nueva para empezar a escribir.
                  Usa <kbd class="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Tab</kbd> para obtener correcciones
                  y <kbd class="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Shift+Enter</kbd> para ayuda gramatical.
                </p>
                <button
                  onClick={createNewEntry}
                  class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Primera Entrada
                </button>
              </div>
            </div>
          }
        >
          {(entryId) => (
            <JournalEditor
              entryId={entryId()}
              llmService={llmService()}
              onTitleChange={(title: string) => {
                // Update title in sidebar if needed
                revalidate(journalEntriesQuery.key);
              }}
            />
          )}
        </Show>
      </div>
    </div>
  );
}