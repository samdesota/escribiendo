import { and, eq, desc } from 'drizzle-orm';
import { db } from './index';
import {
  books,
  readingProgress,
  bookmarks,
  bookAnnotations,
  type Book,
  type NewBook,
  type ReadingProgress,
  type NewReadingProgress,
  type Bookmark,
  type NewBookmark,
  type BookAnnotation,
  type NewBookAnnotation,
} from './schema';
import * as crypto from 'node:crypto';

// Book operations
export async function createBook(book: NewBook): Promise<Book> {
  const [newBook] = await db.insert(books).values(book).returning();
  return newBook;
}

export async function getBookById(id: string): Promise<Book | null> {
  const [book] = await db.select().from(books).where(eq(books.id, id));
  return book || null;
}

export async function getBooksByUserId(userId: string): Promise<Book[]> {
  return await db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(desc(books.updatedAt));
}

export async function updateBook(
  id: string,
  updates: Partial<NewBook>
): Promise<Book | null> {
  const [updatedBook] = await db
    .update(books)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(books.id, id))
    .returning();
  return updatedBook || null;
}

export async function deleteBook(id: string): Promise<boolean> {
  const result = await db.delete(books).where(eq(books.id, id));
  return result.length > 0;
}

// Reading Progress operations
export async function getReadingProgress(
  userId: string,
  bookId: string
): Promise<ReadingProgress | null> {
  const [progress] = await db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.bookId, bookId)
      )
    );
  return progress || null;
}

export async function updateReadingProgress(
  userId: string,
  bookId: string,
  updates: Partial<NewReadingProgress>
): Promise<ReadingProgress> {
  const existing = await getReadingProgress(userId, bookId);

  if (existing) {
    const [updated] = await db
      .update(readingProgress)
      .set({ ...updates, updatedAt: new Date(), lastReadAt: new Date() })
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        )
      )
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(readingProgress)
      .values({
        id: crypto.randomUUID(),
        userId,
        bookId,
        currentLocation: updates.currentLocation || '',
        progressPercentage: updates.progressPercentage || 0,
        readingTimeMs: updates.readingTimeMs || 0,
      })
      .returning();
    return created;
  }
}

// Bookmark operations
export async function createBookmark(bookmark: NewBookmark): Promise<Bookmark> {
  const [newBookmark] = await db.insert(bookmarks).values(bookmark).returning();
  return newBookmark;
}

export async function getBookmarksByBook(
  userId: string,
  bookId: string
): Promise<Bookmark[]> {
  return await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    .orderBy(desc(bookmarks.createdAt));
}

export async function deleteBookmark(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  return result.length > 0;
}

// Annotation operations
export async function createAnnotation(
  annotation: NewBookAnnotation
): Promise<BookAnnotation> {
  const [newAnnotation] = await db
    .insert(bookAnnotations)
    .values(annotation)
    .returning();
  return newAnnotation;
}

export async function getAnnotationsByBook(
  userId: string,
  bookId: string
): Promise<BookAnnotation[]> {
  return await db
    .select()
    .from(bookAnnotations)
    .where(
      and(
        eq(bookAnnotations.userId, userId),
        eq(bookAnnotations.bookId, bookId)
      )
    )
    .orderBy(desc(bookAnnotations.createdAt));
}

export async function updateAnnotation(
  id: string,
  userId: string,
  updates: Partial<NewBookAnnotation>
): Promise<BookAnnotation | null> {
  const [updated] = await db
    .update(bookAnnotations)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(bookAnnotations.id, id), eq(bookAnnotations.userId, userId)))
    .returning();
  return updated || null;
}

export async function deleteAnnotation(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(bookAnnotations)
    .where(and(eq(bookAnnotations.id, id), eq(bookAnnotations.userId, userId)));
  return result.length > 0;
}

// Complex queries
export async function getBookWithProgress(userId: string, bookId: string) {
  const book = await getBookById(bookId);
  if (!book) return null;

  const progress = await getReadingProgress(userId, bookId);
  const bookmarksCount = await db
    .select({ count: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)));

  return {
    ...book,
    progress,
    bookmarksCount: bookmarksCount.length,
  };
}

export async function getBooksWithProgress(userId: string) {
  const userBooks = await getBooksByUserId(userId);

  const booksWithProgress = await Promise.all(
    userBooks.map(async book => {
      const progress = await getReadingProgress(userId, book.id);
      return {
        ...book,
        progress,
      };
    })
  );

  return booksWithProgress;
}
