import type { APIEvent } from '@solidjs/start/server';
import {
  getBookWithProgress,
  updateBook,
  deleteBook,
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

    const book = await getBookWithProgress(userId, bookId);

    if (!book) {
      return new Response(JSON.stringify({ error: 'Book not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(book), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch book' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const PUT = async (event: APIEvent) => {
  try {
    const bookId = event.params.id;
    const updates = await event.request.json();

    if (!bookId) {
      return new Response(JSON.stringify({ error: 'Book ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const updatedBook = await updateBook(bookId, updates);

    if (!updatedBook) {
      return new Response(JSON.stringify({ error: 'Book not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(updatedBook), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating book:', error);
    return new Response(JSON.stringify({ error: 'Failed to update book' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const DELETE = async (event: APIEvent) => {
  try {
    const bookId = event.params.id;

    if (!bookId) {
      return new Response(JSON.stringify({ error: 'Book ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const deleted = await deleteBook(bookId);

    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Book not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ message: 'Book deleted successfully' }),
      {
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error deleting book:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete book' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
