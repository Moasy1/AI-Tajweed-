import mongoose from 'mongoose';

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    console.log('[MongoDB] Already connected.');
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[MongoDB] MONGODB_URI not set. Running without database — data will not persist.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'quran_ai_assistant',
      serverSelectionTimeoutMS: 3000, // Fail fast instead of waiting 30s
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully.');

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected.');
      isConnected = false;
    });
  } catch (error) {
    console.error('[MongoDB] Failed to connect:', error);
    // Don't crash the server if DB is unavailable — fall back to in-memory
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
