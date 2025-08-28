import type { APIEvent } from '@solidjs/start/server';
import {
  updateReadingProgress,
  getReadingProgress,
} from '~/server/db/book-queries';

export const GET = async (event: APIEvent) => {
  try {
    const bookId = event.params.id;
    // TODO: Get actual user ID from authentication
    const userId = 'user-1'; // Placeholder for now

    if (!bookId) {
      return new Response(JSON.stringify({ error: 'Book ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const progress = await getReadingProgress(userId, bookId);

    return new Response(JSON.stringify(progress), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching reading progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch reading progress' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};

export const PUT = async (event: APIEvent) => {
  try {
    const bookId = event.params.id;
    const progressData = await event.request.json();
    // TODO: Get actual user ID from authentication
    const userId = 'user-1'; // Placeholder for now

    if (!bookId) {
      return new Response(JSON.stringify({ error: 'Book ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { currentLocation, progressPercentage, readingTimeMs } = progressData;

    if (!currentLocation) {
      return new Response(
        JSON.stringify({ error: 'Current location is required' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    const updatedProgress = await updateReadingProgress(userId, bookId, {
      currentLocation,
      progressPercentage: progressPercentage || 0,
      readingTimeMs: readingTimeMs || 0,
    });

    return new Response(JSON.stringify(updatedProgress), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating reading progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update reading progress' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};
