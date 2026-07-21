import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

/**
 * There is no submission backend yet, so a message is only queued locally
 * with status 'pending'. Once a server endpoint exists, a sync routine can
 * POST rows still 'pending' and flip them to 'sent' — this table and status
 * column already model that lifecycle so no schema change will be needed.
 */
export async function submitFeedbackMessage(db: SQLiteDatabase, message: string): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }
  await db.runAsync(
    'INSERT INTO feedback_messages (id, message, created_at, status) VALUES (?, ?, ?, ?)',
    Crypto.randomUUID(),
    trimmed,
    Date.now(),
    'pending',
  );
}
