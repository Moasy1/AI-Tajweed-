/**
 * server.ts — Local development server.
 * Adds Vite middleware (HMR) and WebSocket (Live AI) on top of
 * the shared Express app from src/express-app.ts.
 *
 * For production on Vercel, see api/index.ts instead.
 */
import 'dotenv/config';
import path from 'path';
import { app, initDatabase } from './src/express-app.js';
import { isSupabaseConnected } from './src/db/supabase.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Connect to MongoDB
  await initDatabase();

  if (process.env.NODE_ENV !== 'production') {
    // Vite dev middleware (HMR, fast refresh)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve Vite production build
    const distPath = path.join(process.cwd(), 'dist');
    const { default: express } = await import('express');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Database: ${isSupabaseConnected() ? '✅ Supabase connected' : '⚠️  Not connected (add SUPABASE_URL + SUPABASE_ANON_KEY to .env)'}`);
    console.log(`[Server] Open http://localhost:${PORT} in your browser`);
  });

  // ── WebSocket: Real-time Live AI Teacher ─────────────────────────────────
  // NOTE: This is only available in local dev / Railway.
  //       Vercel serverless does NOT support WebSockets.
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/api/live')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs, request) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const plan = url.searchParams.get('plan') || '';
      const focus = url.searchParams.get('focus') || '';

      let systemInstruction = `أنت معلم تجويد وتلاوة للقرآن الكريم متفاعل. 
استمع إلى تلاوة المستخدم وتفاعل معها صوتيًا.
قم بالرد بطريقة تشجيعية، وصحح الأخطاء بلطف شديد وبشكل محفز. إذا كان هناك أخطاء في التلاوة أو التجويد، اذكرها بشكل مبسط، ثم انطق الآية أو الكلمة بالنطق الصحيح لتكون نموذجاً له.
اجعل ردك حوارياً، كأنك تتحدث معه مباشرة عبر الهاتف، وبطول مناسب (ليس طويلاً جداً). تحدث باللغة العربية الفصحى الواضحة.`;

      if (plan || focus) {
        systemInstruction += `\n\nمعلومات إضافية عن المستخدم الحالي:\n`;
        if (focus) systemInstruction += `- يركز الآن على: ${focus}\n`;
        if (plan) systemInstruction += `- جدول الحفظ الخاص به: ${plan}\n`;
        systemInstruction += `بناءً على هذا، شجعه على ورده الحالي.`;
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-preview-native-audio-dialog',
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) clientWs.send(JSON.stringify({ audio }));
            if (message.serverContent?.interrupted) clientWs.send(JSON.stringify({ interrupted: true }));
          },
        },
        config: {
          // @ts-ignore
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction,
        },
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({ audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' } });
          }
          if (parsed.text) {
            session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: parsed.text }] }], turnComplete: true });
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      });

      clientWs.on('close', () => session.close());
    } catch (error) {
      console.error('Live API connection error:', error);
      clientWs.close();
    }
  });
}

startServer();
