/**
 * express-app.ts
 * Pure Express app — routes only, no server.listen(), no WebSocket.
 * Shared between:
 *   - server.ts (local dev with Vite + WebSocket)
 *   - api/index.ts (Vercel serverless functions)
 */
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { connectToDatabase, isDatabaseConnected } from './db/connection.js';
import { RecitationSession } from './db/models/RecitationSession.js';
import { IjazahApplication } from './db/models/IjazahApplication.js';

export const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/webm', 'audio/ogg', 'audio/mp4',
      'audio/mpeg', 'audio/wav', 'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

app.use(express.json());

// Rate limiter — 10 AI requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// ────────────────────────────────────────────────
// Health check
// ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ────────────────────────────────────────────────
// 1. Dashboard Stats
// ────────────────────────────────────────────────
app.get('/api/dashboard/stats', async (_req, res) => {
  try {
    if (isDatabaseConnected()) {
      const [totalSessions, avgAccuracyResult, latestSessions] = await Promise.all([
        RecitationSession.countDocuments(),
        RecitationSession.aggregate([{ $group: { _id: null, avg: { $avg: '$score' } } }]),
        RecitationSession.find().sort({ createdAt: -1 }).limit(5).select('surah score createdAt'),
      ]);
      const avgAccuracy = avgAccuracyResult[0]?.avg ?? 0;
      res.json({
        stats: [
          { label: 'الآيات المحفوظة', value: String(totalSessions), iconName: 'Book', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'ساعات التلاوة', value: (totalSessions * 0.5).toFixed(1), iconName: 'Clock', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'دقة التجويد', value: `${avgAccuracy.toFixed(0)}%`, iconName: 'Activity', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'جلسات التلاوة', value: String(totalSessions), iconName: 'Flame', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        ],
        dailyTarget: { surah: latestSessions[0]?.surah || 'سورة الكهف', verses: 'الآيات 1 - 10', progress: Math.min(100, totalSessions * 10) },
        recentSessions: latestSessions,
        alerts: [{ type: 'success', title: 'البيانات محفوظة', description: 'يتم الآن حفظ جميع جلسات التلاوة في قاعدة البيانات.' }],
      });
    } else {
      res.json({
        stats: [
          { label: 'الآيات المحفوظة', value: '—', iconName: 'Book', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'ساعات التلاوة', value: '—', iconName: 'Clock', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'دقة التجويد', value: '—', iconName: 'Activity', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'أيام متتالية', value: '—', iconName: 'Flame', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        ],
        dailyTarget: { surah: 'سورة الكهف', verses: 'الآيات 1 - 10', progress: 0 },
        recentSessions: [],
        alerts: [{ type: 'warning', title: 'قاعدة البيانات غير متصلة', description: 'يرجى إعداد MONGODB_URI لحفظ بياناتك.' }],
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// ────────────────────────────────────────────────
// 2. Tajweed Analysis (Audio → AI → Save to DB)
// ────────────────────────────────────────────────
app.post('/api/analyze-tajweed', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const mimeType = req.file.mimetype === 'application/octet-stream' ? 'audio/webm' : req.file.mimetype || 'audio/webm';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: req.file.buffer.toString('base64') } },
          {
            text: `You are an expert Quran Tajweed teacher. Listen to the provided audio recitation.
1. Identify the Surah and Ayah if possible.
2. Analyze the recitation for Tajweed rules.
3. Provide a word-by-word breakdown.
4. For each word, indicate if Tajweed is 'correct' or 'error'.
5. If error, specify the 'rule' and give a 'suggestion' in Arabic.
6. Provide an overall score out of 100.
7. Return the response in Arabic.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surah: { type: Type.STRING },
            ayah: { type: Type.STRING },
            score: { type: Type.NUMBER },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  status: { type: Type.STRING },
                  rule: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  accuracy: { type: Type.NUMBER },
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

    // Persist to MongoDB
    if (isDatabaseConnected()) {
      try {
        await RecitationSession.create({ surah: resultJson.surah, ayah: resultJson.ayah, score: resultJson.score, words: resultJson.words, mode: 'tajweed' });
      } catch (dbErr) {
        console.warn('[MongoDB] Failed to save session:', dbErr);
      }
    }

    res.json(resultJson);
  } catch (error: any) {
    console.error('Audio analysis error:', error);
    res.status(500).json({ error: 'Failed to process audio', details: String(error) });
  }
});

// ────────────────────────────────────────────────
// 3. Interactive Teacher (Audio → AI Text + TTS)
// ────────────────────────────────────────────────
app.post('/api/interactive-teacher', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const mimeType = req.file.mimetype === 'application/octet-stream' ? 'audio/webm' : req.file.mimetype || 'audio/webm';

    const analyzeResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: req.file.buffer.toString('base64') } },
          {
            text: `أنت معلم تجويد وتلاوة للقرآن الكريم متفاعل. استمع إلى تلاوة المستخدم.
قم بالرد بطريقة تشجيعية، وصحح الأخطاء بلطف شديد وبشكل محفز.
اجعل ردك حوارياً وبطول مناسب. تحدث باللغة العربية الفصحى الواضحة.`,
          },
        ],
      },
    });

    const responseText = analyzeResponse.text;
    if (!responseText) throw new Error('No text response from Gemini');

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: responseText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      },
    });

    const base64AudioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    let base64Wav = null;

    if (base64AudioData) {
      const pcmBuffer = Buffer.from(base64AudioData, 'base64');
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
      base64Wav = Buffer.concat([header, pcmBuffer]).toString('base64');
    }

    res.json({ text: responseText, audio: base64Wav });
  } catch (error: any) {
    console.error('Interactive teacher error:', error);
    res.status(500).json({ error: 'Failed to process audio', details: String(error) });
  }
});

// ────────────────────────────────────────────────
// 4. Session History
// ────────────────────────────────────────────────
app.get('/api/sessions/history', async (req, res) => {
  try {
    if (!isDatabaseConnected()) return res.json({ sessions: [], message: 'Database not connected' });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      RecitationSession.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('surah ayah score mode createdAt'),
      RecitationSession.countDocuments(),
    ]);
    res.json({ sessions, total, page, limit });
  } catch (error) {
    console.error('Sessions history error:', error);
    res.status(500).json({ error: 'Failed to load session history' });
  }
});

// ────────────────────────────────────────────────
// 5. Ijazah Applications
// ────────────────────────────────────────────────
app.get('/api/ijazah', async (_req, res) => {
  try {
    if (!isDatabaseConnected()) return res.json({ applications: [] });
    const applications = await IjazahApplication.find().sort({ createdAt: -1 });
    res.json({ applications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Ijazah applications' });
  }
});

app.post('/api/ijazah', async (req, res) => {
  try {
    if (!isDatabaseConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { surah, accuracy } = req.body;
    if (!surah || accuracy === undefined) return res.status(400).json({ error: 'surah and accuracy are required' });
    const status = accuracy >= 95 ? 'ai_approved' : accuracy >= 80 ? 'sheikh_review' : 'pending';
    const application = await IjazahApplication.create({ surah, accuracy, status });
    res.status(201).json({ application });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Ijazah application' });
  }
});

// ────────────────────────────────────────────────
// Global error handler
// ────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', details: String(err) });
});

// DB connect function — called once per process (local dev or cold Vercel start)
let dbInitialized = false;
export async function initDatabase() {
  if (dbInitialized) return;
  dbInitialized = true;
  await connectToDatabase();
}
