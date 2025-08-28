import type { APIEvent } from '@solidjs/start/server';
import { stat, readFile } from 'node:fs/promises';
import { getBookById } from '~/server/db/book-queries';

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

    const book = await getBookById(bookId);

    if (!book || book.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Book not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Check if file exists
    try {
      const fileStats = await stat(book.filePath);
      if (!fileStats.isFile()) {
        throw new Error('File not found');
      }
    } catch (error) {
      console.error('Book file not found:', book.filePath, error);
      return new Response(JSON.stringify({ error: 'Book file not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Serve the EPUB file
    const file = await readFile(book.filePath);

    return new Response(file, {
      headers: {
        'content-type': 'application/epub+zip',
        'content-disposition': `inline; filename="${book.title}.epub"`,
        'cache-control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving book content:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to serve book content' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};
