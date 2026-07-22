import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * `null` when the app is built without Supabase configured (e.g. a fresh
 * clone with no `.env` yet) — every call site must treat the global
 * ranking/feedback-sync features as optional and degrade gracefully rather
 * than crash, since this is a secondary feature layered on top of the fully
 * local-first app.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
        },
      })
    : null;
