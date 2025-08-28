import type { APIEvent } from '@solidjs/start/server';
import * as crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getBooksWithProgress, createBook } from '~/server/db/book-queries';

export const GET = async (event: APIEvent) => {
  try {
    // TODO: Get actual user ID from authentication
    const userId = 'user-1'; // Placeholder for now

    const books = await getBooksWithProgress(userId);

    return new Response(JSON.stringify(books), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch books' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export const POST = async (event: APIEvent) => {
  try {
    const formData = await event.request.formData();

    // TODO: Get actual user ID from authentication
    const userId = 'user-1'; // Placeholder for now

    const epubFile = formData.get('epub') as File;
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const language = (formData.get('language') as string) || 'es';

    if (!epubFile || !title) {
      return new Response(
        JSON.stringify({ error: 'EPUB file and title are required' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Validate file type
    if (!epubFile.name.toLowerCase().endsWith('.epub')) {
      return new Response(
        JSON.stringify({ error: 'File must be an EPUB file' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Save file to uploads directory
    const uploadsDir = './uploads/books';
    const fileName = `${crypto.randomUUID()}.epub`;
    const filePath = path.join(uploadsDir, fileName);

    // Create uploads directory if it doesn't exist
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }

    // Save file
    const buffer = await epubFile.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buffer));

    // Create book record
    const book = await createBook({
      id: crypto.randomUUID(),
      userId,
      title,
      author: author || null,
      language,
      filePath,
      fileSize: epubFile.size,
    });

    return new Response(JSON.stringify(book), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Error uploading book:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload book' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
