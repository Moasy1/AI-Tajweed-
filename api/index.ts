/**
 * api/index.ts — Vercel Serverless Function entry point.
 *
 * Wraps the shared Express app so all /api/* routes work as
 * Vercel serverless functions. The WebSocket /api/live route
 * is NOT available on Vercel (use Railway for that feature).
 */
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app, initDatabase } from '../src/express-app.js';

// Initialize DB once per cold start (connection is reused across invocations)
let ready = false;
async function ensureReady() {
  if (ready) return;
  ready = true;
  await initDatabase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureReady();
  // Delegate to the Express app
  return new Promise<void>((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
