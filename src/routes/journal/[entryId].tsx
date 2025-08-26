import { createAsync, query, RouteDefinition } from '@solidjs/router';
import { Show, createSignal } from 'solid-js';
import { ClientLLMService } from '~/services/llm';
import JournalEditor from '~/components/JournalEditor';
import { getJournalEntry } from '~/server/db/journal-queries';
import type { RouteSectionProps } from '@solidjs/router';
import { Rerun } from '@solid-primitives/keyed';

// Server query for individual entry
const journalEntryQuery = query(async (entryId: string) => {
  'use server';
  return await getJournalEntry(entryId);
}, 'journal-entry');

export const route = {
  preload: ({ params }) => journalEntryQuery(params.entryId),
} satisfies RouteDefinition;

export default function JournalEntryPage(props: RouteSectionProps) {
  const entry = createAsync(() => journalEntryQuery(props.params.entryId));
  const [llmService] = createSignal(new ClientLLMService());

  return (
    <Show
      when={entry()}
      fallback={
        <div class='flex-1 flex items-center justify-center text-gray-500'>
          <div class='text-center max-w-md'>
            <h2 class='text-2xl font-semibold mb-4'>Entrada no encontrada</h2>
            <p class='mb-6 text-gray-600'>
              La entrada que buscas no existe o ha sido eliminada.
            </p>
          </div>
        </div>
      }
    >
      {entryData => (
        <Rerun on={() => entryData().id}>
          <JournalEditor
            entryId={entryData().id}
            llmService={llmService()}
            onTitleChange={(title: string) => {
              // Title changes will be handled by the editor's auto-save
            }}
          />
        </Rerun>
      )}
    </Show>
  );
}
