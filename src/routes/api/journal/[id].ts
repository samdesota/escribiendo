import type { APIEvent } from "@solidjs/start/server";
import { 
  getJournalEntry, 
  updateJournalEntry, 
  deleteJournalEntry,
  extractPlainText,
  calculateWordCount,
  type NewJournalEntry 
} from "~/server/db/journal-queries";

export const GET = async (event: APIEvent) => {
  try {
    const entryId = event.params.id;
    
    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'Entry ID is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const entry = await getJournalEntry(entryId);
    
    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Journal entry not found' }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(entry), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch journal entry' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const PUT = async (event: APIEvent) => {
  try {
    const entryId = event.params.id;
    const payload = await event.request.json();
    
    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'Entry ID is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Prepare update data
    const updateData: Partial<NewJournalEntry> = {};
    
    if (payload.title !== undefined) {
      updateData.title = payload.title;
    }
    
    if (payload.content !== undefined) {
      updateData.content = payload.content;
      updateData.plainText = extractPlainText(payload.content);
      updateData.wordCount = calculateWordCount(updateData.plainText);
    }

    const updatedEntry = await updateJournalEntry(entryId, updateData);
    
    if (!updatedEntry) {
      return new Response(
        JSON.stringify({ error: 'Journal entry not found' }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(updatedEntry), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update journal entry' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const DELETE = async (event: APIEvent) => {
  try {
    const entryId = event.params.id;
    
    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'Entry ID is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const deleted = await deleteJournalEntry(entryId);
    
    if (!deleted) {
      return new Response(
        JSON.stringify({ error: 'Journal entry not found' }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete journal entry' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};