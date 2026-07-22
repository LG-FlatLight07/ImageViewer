import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { supabase } from '../services/supabaseClient';

/**
 * Always queued locally first (so nothing is lost if the device is
 * offline or Supabase isn't configured), then best-effort forwarded to the
 * server. The local `status` column reflects the outcome ('sent' vs
 * 'failed') rather than tracking a separate sync pass — there is nothing
 * else to re-send, since Supabase doesn't need to read this table back.
 */
export async function submitFeedbackMessage(db: SQLiteDatabase, message: string): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }

  let status: 'sent' | 'failed' = 'failed';
  if (supabase) {
    try {
      const { error } = await supabase.from('feedback_messages').insert({ message: trimmed });
      if (error) {
        throw error;
      }
      status = 'sent';
    } catch (err) {
      console.warn(
        '[feedbackRepository] failed to send feedback message to server',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await db.runAsync(
    'INSERT INTO feedback_messages (id, message, created_at, status) VALUES (?, ?, ?, ?)',
    Crypto.randomUUID(),
    trimmed,
    Date.now(),
    status,
  );
}
