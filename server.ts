import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { connectToDatabase, isDatabaseConnected } from './src/db/connection.js';
import { RecitationSession } from './src/db/models/RecitationSession.js';
import { IjazahApplication } from './src/db/models/IjazahApplication.js';

const app = express();
const PORT = 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'application/octet-stream'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

app.use(express.json());

// --- Rate Limiting ---
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                    // 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// --- API Routes ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// 1. Dashboard Stats API — real data from DB with hardcoded fallback
app.get('/api/dashboard/stats', async (_req, res) => {
  try {
    if (isDatabaseConnected()) {
      const [totalSessions, avgAccuracyResult, latestSessions] = await Promise.all([
        RecitationSession.countDocuments(),
        RecitationSession.aggregate([
          { $group: { _id: null, avg: { $avg: '$score' } } },
        ]),
        RecitationSession.find().sort({ createdAt: -1 }).limit(5).select('surah score createdAt'),
      ]);

      const avgAccuracy = avgAccuracyResult[0]?.avg ?? 0;

      res.json({
        stats: [
          {
            label: 'الآيات المحفوظة',
            value: String(totalSessions),
            iconName: 'Book',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
          },
          {
            label: 'ساعات التلاوة',
            value: (totalSessions * 0.5).toFixed(1),
            iconName: 'Clock',
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            border: 'border-orange-100',
          },
          {
            label: 'دقة التجويد',
            value: `${avgAccuracy.toFixed(0)}%`,
            iconName: 'Activity',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
          },
          {
            label: 'جلسات التلاوة',
            value: String(totalSessions),
            iconName: 'Flame',
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            border: 'border-rose-100',
          },
        ],
        dailyTarget: {
          surah: latestSessions[0]?.surah || 'سورة الكهف',
          verses: 'الآيات 1 - 10',
          progress: Math.min(100, totalSessions * 10),
        },
        recentSessions: latestSessions,
        alerts: [
          {
            type: 'success',
            title: 'البيانات محفوظة',
            description: 'يتم الآن حفظ جميع جلسات التلاوة في قاعدة البيانات.',
          },
        ],
      });
    } else {
      // Graceful fallback when DB is not connected
      res.json({
        stats: [
          { label: 'الآيات المحفوظة', value: '—', iconName: 'Book', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'ساعات التلاوة', value: '—', iconName: 'Clock', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'دقة التجويد', value: '—', iconName: 'Activity', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'أيام متتالية', value: '—', iconName: 'Flame', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        ],
        dailyTarget: { surah: 'سورة الكهف', verses: 'الآيات 1 - 10', progress: 0 },
        recentSessions: [],
        alerts: [
          {
            type: 'warning',
            title: 'قاعدة البيانات غير متصلة',
            description: 'يرجى إعداد MONGODB_URI في ملف .env لحفظ بياناتك.',
          },
        ],
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// 2. Audio Analysis API (Tajweed Engine)
app.post('/api/analyze-tajweed', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const mimeType =
      req.file.mimetype === 'application/octet-stream' ? 'audio/webm' : req.file.mimetype || 'audio/webm';

    const audioPart = {
      inlineData: {
        mimeType,
        data: req.file.buffer.toString('base64'),
      },
    };

    const textPart = {
      text: `You are an expert Quran Tajweed teacher. Listen to the provided audio recitation.
1. Identify the Surah and Ayah if possible (e.g., Al-Naba). 
2. Analyze the recitation for Tajweed rules.
3. Provide a word-by-word (or phrase-by-phrase) breakdown of the recitation.
4. For each word/phrase, indicate if the Tajweed is 'correct' or 'error'.
5. If there is an error, specify the 'rule' (e.g., Ghunna, Madd, Qalqalah) and give a 'suggestion' on how to fix it in Arabic.
6. Provide an overall score out of 100.
7. Return the response in Arabic.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surah: { type: Type.STRING, description: 'Name of the Surah' },
            ayah: { type: Type.STRING, description: 'Number of the Ayah' },
            score: { type: Type.NUMBER, description: 'Overall score out of 100' },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: 'The word or phrase' },
                  status: { type: Type.STRING, description: "'correct' or 'error'" },
                  rule: { type: Type.STRING, description: 'The Tajweed rule applied or violated' },
                  suggestion: { type: Type.STRING, description: 'Suggestion for improvement' },
                  accuracy: { type: Type.NUMBER, description: 'Accuracy percentage for this word' },
                },
                required: ['text', 'status', 'rule', 'suggestion', 'accuracy'],
              },
            },
          },
          required: ['surah', 'ayah', 'score', 'words'],
        },
      },
    });

    let resultText = response.text;
    if (!resultText) throw new Error('No response from Gemini');

    resultText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const resultJson = JSON.parse(resultText);

    // Persist the session to MongoDB
    if (isDatabaseConnected()) {
      try {
        await RecitationSession.create({
          surah: resultJson.surah,
          ayah: resultJson.ayah,
          score: resultJson.score,
          words: resultJson.words,
          mode: 'tajweed',
        });
      } catch (dbErr) {
        console.warn('[MongoDB] Failed to save recitation session:', dbErr);
      }
    }

    res.json(resultJson);
  } catch (error: any) {
    console.error('Audio analysis error:', error);
    res.status(500).json({ error: 'Failed to process audio', details: String(error) });
  }
});

// 3. Interactive Teacher API (Analysis + TTS)
app.post('/api/interactive-teacher', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const mimeType =
      req.file.mimetype === 'application/octet-stream' ? 'audio/webm' : req.file.mimetype || 'audio/webm';

    const audioPart = {
      inlineData: { mimeType, data: req.file.buffer.toString('base64') },
    };

    const textPart = {
      text: `أنت معلم تجويد وتلاوة للقرآن الكريم متفاعل. استمع إلى تلاوة المستخدم.
قم بالرد بطريقة تشجيعية، وصحح الأخطاء بلطف شديد وبشكل محفز. إذا كان هناك أخطاء في التلاوة أو التجويد، اذكرها بشكل مبسط، ثم انطق الآية أو الكلمة بالنطق الصحيح لتكون نموذجاً له.
اجعل ردك حوارياً، كأنك تتحدث معه مباشرة، وبطول مناسب (ليس طويلاً جداً). تحدث باللغة العربية الفصحى الواضحة.`,
    };

    const analyzeResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
    });

    const responseText = analyzeResponse.text;
    if (!responseText) throw new Error('No text response from Gemini');

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: responseText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const base64AudioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    let base64Wav = null;

    if (base64AudioData) {
      const pcmBuffer = Buffer.from(base64AudioData, 'base64');

      // Build WAV header for PCM audio/l16; rate=24000; channels=1
      const sampleRate = 24000;
      const channels = 1;
      const bitsPerSample = 16;
      const dataLength = pcmBuffer.length;

      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + dataLength, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
      header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(dataLength, 40);

      const wavBuffer = Buffer.concat([header, pcmBuffer]);
      base64Wav = wavBuffer.toString('base64');
    }

    res.json({ text: responseText, audio: base64Wav });
  } catch (error: any) {
    console.error('Interactive teacher error:', error);
    res.status(500).json({ error: 'Failed to process audio in teacher mode', details: String(error) });
  }
});

// 4. Recitation History API
app.get('/api/sessions/history', async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ sessions: [], message: 'Database not connected' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      RecitationSession.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('surah ayah score mode createdAt'),
      RecitationSession.countDocuments(),
    ]);

    res.json({ sessions, total, page, limit });
  } catch (error) {
    console.error('Sessions history error:', error);
    res.status(500).json({ error: 'Failed to load session history' });
  }
});

// 5. Ijazah Applications API
app.get('/api/ijazah', async (_req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ applications: [] });
    }
    const applications = await IjazahApplication.find().sort({ createdAt: -1 });
    res.json({ applications });
  } catch (error) {
    console.error('Ijazah fetch error:', error);
    res.status(500).json({ error: 'Failed to load Ijazah applications' });
  }
});

app.post('/api/ijazah', async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { surah, accuracy } = req.body;
    if (!surah || accuracy === undefined) {
      return res.status(400).json({ error: 'surah and accuracy are required' });
    }

    const status = accuracy >= 95 ? 'ai_approved' : accuracy >= 80 ? 'sheikh_review' : 'pending';
    const application = await IjazahApplication.create({ surah, accuracy, status });
    res.status(201).json({ application });
  } catch (error) {
    console.error('Ijazah creation error:', error);
    res.status(500).json({ error: 'Failed to create Ijazah application' });
  }
});

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: 'Internal server error', details: String(err) });
  } else {
    res.status(500).send('Internal server error');
  }
});

// --- Vite Middleware (Development) & Static Serving (Production) ---
async function startServer() {
  // Connect to MongoDB (non-blocking — server starts even if DB is unavailable)
  await connectToDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Database: ${isDatabaseConnected() ? '✅ Connected' : '⚠️  Not connected (MONGODB_URI not set)'}`);
  });

  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url && request.url.startsWith('/api/live')) {
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
        systemInstruction += `بناءً على هذا، شجعه على ورده الحالي، وإذا سألك عن خطته أو ورده، أخبره بما في جدوله.`;
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
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction,
        },
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
          if (parsed.text) {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: parsed.text }] }],
              turnComplete: true,
            });
          }
        } catch (err) {
          console.error('Error processing websocket message', err);
        }
      });

      clientWs.on('close', () => {
        session.close();
      });
    } catch (error) {
      console.error('Live API connection error:', error);
      clientWs.close();
    }
  });
}

startServer();
