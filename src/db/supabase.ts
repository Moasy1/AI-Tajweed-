/**
 * src/db/supabase.ts
 * Supabase client singleton.
 * Works in both local dev and Vercel serverless (HTTP-based, no persistent connection).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── TypeScript types matching our PostgreSQL tables ────────────────────────

export interface RecitationSession {
  id?: string;
  surah: string;
  ayah?: string;
  score: number;
  words: WordAnalysis[];
  mode: 'tajweed' | 'interactive' | 'kids';
  created_at?: string;
}

export interface WordAnalysis {
  text: string;
  status: 'correct' | 'error';
  rule: string;
  suggestion: string;
  accuracy: number;
}

export interface IjazahApplication {
  id?: string;
  surah: string;
  accuracy: number;
  status: 'pending' | 'ai_approved' | 'sheikh_review' | 'approved' | 'rejected';
  sheikh_notes?: string;
  reviewed_at?: string;
  created_at?: string;
}

export interface User {
  id?: string;
  name: string;
  avatar?: string;
  points?: number;
  badges?: string[];
  streak?: number;
  total_verses?: number;
  tajweed_accuracy?: number;
  created_at?: string;
}

// ─── Client Singleton ────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key || url === 'YOUR_SUPABASE_URL' || key === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Running without database.');
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false }, // No session storage needed for server-side
  });

  console.log('[Supabase] Client initialized.');
  return _client;
}

export function isSupabaseConnected(): boolean {
  return getSupabase() !== null;
}
