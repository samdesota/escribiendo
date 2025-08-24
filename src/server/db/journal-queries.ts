import { eq, desc, and } from 'drizzle-orm';
import { db } from './index';
import { journalEntries, journalCorrections, type JournalEntry, type JournalCorrection } from './schema';

export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type NewJournalCorrection = typeof journalCorrections.$inferInsert;

/**
 * Get all journal entries for a user
 */
export async function getJournalEntries(userId: string): Promise<JournalEntry[]> {
  return await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.updatedAt));
}

/**
 * Get a specific journal entry
 */
export async function getJournalEntry(entryId: string): Promise<JournalEntry | null> {
  const results = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);
  
  return results[0] || null;
}

/**
 * Create a new journal entry
 */
export async function createJournalEntry(data: NewJournalEntry): Promise<JournalEntry> {
  const results = await db
    .insert(journalEntries)
    .values(data)
    .returning();
  
  return results[0];
}

/**
 * Update a journal entry
 */
export async function updateJournalEntry(
  entryId: string, 
  data: Partial<NewJournalEntry>
): Promise<JournalEntry | null> {
  const results = await db
    .update(journalEntries)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(eq(journalEntries.id, entryId))
    .returning();
  
  return results[0] || null;
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(entryId: string): Promise<boolean> {
  const results = await db
    .delete(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .returning({ id: journalEntries.id });
  
  return results.length > 0;
}

/**
 * Get pending corrections for an entry
 */
export async function getPendingCorrections(entryId: string): Promise<JournalCorrection[]> {
  return await db
    .select()
    .from(journalCorrections)
    .where(
      and(
        eq(journalCorrections.entryId, entryId),
        eq(journalCorrections.status, 'pending')
      )
    )
    .orderBy(journalCorrections.startPos);
}

/**
 * Create a new correction suggestion
 */
export async function createCorrection(data: NewJournalCorrection): Promise<JournalCorrection> {
  const results = await db
    .insert(journalCorrections)
    .values(data)
    .returning();
  
  return results[0];
}

/**
 * Update correction status (accept/reject)
 */
export async function updateCorrectionStatus(
  correctionId: string,
  status: 'accepted' | 'rejected'
): Promise<JournalCorrection | null> {
  const results = await db
    .update(journalCorrections)
    .set({ status })
    .where(eq(journalCorrections.id, correctionId))
    .returning();
  
  return results[0] || null;
}

/**
 * Clear all pending corrections for an entry
 */
export async function clearPendingCorrections(entryId: string): Promise<number> {
  const results = await db
    .delete(journalCorrections)
    .where(
      and(
        eq(journalCorrections.entryId, entryId),
        eq(journalCorrections.status, 'pending')
      )
    )
    .returning({ id: journalCorrections.id });
  
  return results.length;
}

/**
 * Get entry with corrections
 */
export async function getJournalEntryWithCorrections(entryId: string) {
  const entry = await getJournalEntry(entryId);
  if (!entry) return null;
  
  const corrections = await getPendingCorrections(entryId);
  
  return {
    entry,
    corrections
  };
}

/**
 * Calculate and update word count for an entry
 */
export function calculateWordCount(plainText: string): number {
  if (!plainText.trim()) return 0;
  
  // Split by whitespace and filter out empty strings
  return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract plain text from ProseMirror document
 */
export function extractPlainText(prosemirrorDoc: any): string {
  if (!prosemirrorDoc || !prosemirrorDoc.content) return '';
  
  let text = '';
  
  function extractFromNode(node: any): void {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        extractFromNode(child);
      }
      // Add space after block nodes (paragraphs, etc.)
      if (node.type === 'paragraph' || node.type === 'heading') {
        text += ' ';
      }
    }
  }
  
  extractFromNode(prosemirrorDoc);
  return text.trim();
}