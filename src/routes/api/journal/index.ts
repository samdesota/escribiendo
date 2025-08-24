import type { APIEvent } from "@solidjs/start/server";
import { 
  getJournalEntries, 
  createJournalEntry, 
  extractPlainText, 
  calculateWordCount,
  type NewJournalEntry 
} from "~/server/db/journal-queries";

export const GET = async (event: APIEvent) => {
  try {
    // Get userId from query params (later replace with auth)
    const url = new URL(event.request.url);
    const userId = url.searchParams.get('userId') || 'user-123';
    
    const entries = await getJournalEntries(userId);
    
    return new Response(JSON.stringify(entries), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch journal entries' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.id || !payload.userId || !payload.content) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: id, userId, content' 
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Extract plain text and calculate word count
    const plainText = extractPlainText(payload.content);
    const wordCount = calculateWordCount(plainText);

    const newEntry: NewJournalEntry = {
      id: payload.id,
      userId: payload.userId,
      title: payload.title || 'Untitled',
      content: payload.content,
      plainText,
      wordCount,
    };

    const entry = await createJournalEntry(newEntry);

    return new Response(JSON.stringify(entry), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create journal entry' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};