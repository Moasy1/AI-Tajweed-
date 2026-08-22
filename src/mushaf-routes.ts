import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

export const mushafRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، يرجى الانتظار قليلاً.' },
});

// Memory cache to accelerate responses
const memoryCache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCached(key: string, data: any, ttlMs: number = 3600000) { // 1 hour default
  memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export const RECITERS = [
  { id: 'hudhaify', name: 'الشيخ علي الحذيفي (إمام المسجد النبوي)', urlPrefix: 'https://everyayah.com/data/Hudhaify_128kbps' },
  { id: 'husary', name: 'الشيخ محمود خليل الحصري (مرتل)', urlPrefix: 'https://everyayah.com/data/Husary_128kbps' },
  { id: 'minshawy', name: 'الشيخ محمد صديق المنشاوي (مرتل)', urlPrefix: 'https://everyayah.com/data/Minshawy_Murattal_128kbps' },
  { id: 'afasy', name: 'الشيخ مشاري راشد العفاسي', urlPrefix: 'https://everyayah.com/data/Alafasy_128kbps' },
  { id: 'abdulbasit', name: 'الشيخ عبد الباسط عبد الصمد', urlPrefix: 'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps' },
];

function getAudioUrl(surahNum: number, ayahNum: number, reciterId: string = 'hudhaify') {
  const reciter = RECITERS.find(r => r.id === reciterId) || RECITERS[0];
  const sStr = String(surahNum).padStart(3, '0');
  const aStr = String(ayahNum).padStart(3, '0');
  return `${reciter.urlPrefix}/${sStr}${aStr}.mp3`;
}

// 1. Get all chapters (Surahs list)
mushafRouter.get('/chapters', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'quran_chapters';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await fetch('https://api.quran.com/api/v4/chapters?language=ar');
    if (!response.ok) throw new Error('Failed to fetch chapters from Quran.com');
    const data = await response.json();

    const chapters = data.chapters.map((ch: any) => ({
      id: ch.id,
      revelation_place: ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية',
      revelation_order: ch.revelation_order,
      bismillah_pre: ch.bismillah_pre,
      name_simple: ch.name_simple,
      name_complex: ch.name_complex,
      name_arabic: ch.name_arabic,
      verses_count: ch.verses_count,
      pages: ch.pages, // [startPage, endPage]
    }));

    setCached(cacheKey, { chapters, reciters: RECITERS }, 86400000); // 24 hours
    res.json({ chapters, reciters: RECITERS });
  } catch (error: any) {
    console.error('Fetch chapters error:', error);
    res.status(500).json({ error: 'فشل في تحميل قائمة السور', details: String(error) });
  }
});

// 2. Get chapter verses with Tafsir of Madinah (التفسير الميسر - مجمع الملك فهد)
mushafRouter.get('/chapter/:id', async (req: Request, res: Response) => {
  try {
    const chapterId = parseInt(req.params.id);
    if (isNaN(chapterId) || chapterId < 1 || chapterId > 114) {
      return res.status(400).json({ error: 'رقم السورة غير صحيح' });
    }

    const cacheKey = `quran_chapter_${chapterId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // Fetch Chapter Details, Verses in Uthmani Script, and Tafsir 16 (Tafsir Muyassar)
    const [chapRes, uthmaniRes, tafsirRes] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/chapters/${chapterId}?language=ar`).then(r => r.json()),
      fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${chapterId}`).then(r => r.json()),
      fetch(`https://api.quran.com/api/v4/tafsirs/16/by_chapter/${chapterId}?per_page=300`).then(r => r.json()),
    ]);

    const chapterInfo = chapRes.chapter;
    const tafsirMap = new Map<string, string>();
    if (tafsirRes.tafsirs) {
      for (const t of tafsirRes.tafsirs) {
        tafsirMap.set(t.verse_key, t.text);
      }
    }

    const verses = (uthmaniRes.verses || []).map((v: any) => {
      const [sStr, aStr] = v.verse_key.split(':');
      const sNum = parseInt(sStr);
      const aNum = parseInt(aStr);

      return {
        id: v.id,
        verse_key: v.verse_key,
        verse_number: aNum,
        chapter_number: sNum,
        text_uthmani: v.text_uthmani,
        tafsir_madinah: tafsirMap.get(v.verse_key) || 'جاري تحديث التفسير...',
        tafsir_source: 'التفسير الميسر - مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة',
        audio_url: getAudioUrl(sNum, aNum, 'hudhaify'),
      };
    });

    const result = {
      chapter: {
        id: chapterInfo.id,
        name_arabic: chapterInfo.name_arabic,
        name_simple: chapterInfo.name_simple,
        verses_count: chapterInfo.verses_count,
        revelation_place: chapterInfo.revelation_place === 'makkah' ? 'مكية' : 'مدنية',
        bismillah_pre: chapterInfo.bismillah_pre,
        pages: chapterInfo.pages,
      },
      verses,
      reciters: RECITERS,
    };

    setCached(cacheKey, result, 86400000);
    res.json(result);
  } catch (error: any) {
    console.error('Fetch chapter details error:', error);
    res.status(500).json({ error: 'فشل في تحميل السورة والتفسير', details: String(error) });
  }
});

// 3. Get Madinah Mushaf Page (1 to 604) with Tafsir
mushafRouter.get('/page/:pageNumber', async (req: Request, res: Response) => {
  try {
    const pageNum = parseInt(req.params.pageNumber);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
      return res.status(400).json({ error: 'رقم صفحة المصحف يجب أن يكون بين 1 و 604' });
    }

    const cacheKey = `quran_page_${pageNum}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const [uthmaniRes, tafsirRes] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?page_number=${pageNum}`).then(r => r.json()),
      fetch(`https://api.quran.com/api/v4/tafsirs/16/by_page/${pageNum}?per_page=50`).then(r => r.json()),
    ]);

    const tafsirMap = new Map<string, string>();
    if (tafsirRes.tafsirs) {
      for (const t of tafsirRes.tafsirs) {
        tafsirMap.set(t.verse_key, t.text);
      }
    }

    const verses = (uthmaniRes.verses || []).map((v: any) => {
      const [sStr, aStr] = v.verse_key.split(':');
      const sNum = parseInt(sStr);
      const aNum = parseInt(aStr);

      return {
        id: v.id,
        verse_key: v.verse_key,
        verse_number: aNum,
        chapter_number: sNum,
        text_uthmani: v.text_uthmani,
        page_number: pageNum,
        tafsir_madinah: tafsirMap.get(v.verse_key) || 'جاري تحديث التفسير...',
        tafsir_source: 'التفسير الميسر - مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة',
        audio_url: getAudioUrl(sNum, aNum, 'hudhaify'),
      };
    });

    const result = {
      page_number: pageNum,
      verses_count: verses.length,
      verses,
      reciters: RECITERS,
    };

    setCached(cacheKey, result, 86400000);
    res.json(result);
  } catch (error: any) {
    console.error('Fetch page error:', error);
    res.status(500).json({ error: 'فشل في تحميل صفحة المصحف', details: String(error) });
  }
});

// 4. Get single verse Tafsir
mushafRouter.get('/tafsir/:surah/:ayah', async (req: Request, res: Response) => {
  try {
    const surah = parseInt(req.params.surah);
    const ayah = parseInt(req.params.ayah);
    if (isNaN(surah) || isNaN(ayah)) {
      return res.status(400).json({ error: 'رقم السورة والآية غير صحيح' });
    }

    const verseKey = `${surah}:${ayah}`;
    const cacheKey = `tafsir_${verseKey}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const [verseRes, tafsirRes] = await Promise.all([
      fetch(`https://api.quran.com/api/v4/verses/by_key/${verseKey}?words=false`).then(r => r.json()),
      fetch(`https://api.quran.com/api/v4/tafsirs/16/by_ayah/${verseKey}`).then(r => r.json()),
    ]);

    const result = {
      verse_key: verseKey,
      surah,
      ayah,
      verse: verseRes.verse,
      tafsir: tafsirRes.tafsir?.text || '',
      tafsir_name: 'التفسير الميسر - مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة',
      audio_url: getAudioUrl(surah, ayah, 'hudhaify'),
    };

    setCached(cacheKey, result, 86400000);
    res.json(result);
  } catch (error: any) {
    console.error('Fetch single ayah tafsir error:', error);
    res.status(500).json({ error: 'فشل في جلب تفسير الآية', details: String(error) });
  }
});

// 5. Search in Quran & Tafsir
mushafRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'كلمة البحث يجب أن تكون حرفين على الأقل' });
    }

    const cacheKey = `search_${query}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(query)}&size=20&language=ar`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();

    const results = (data.search?.results || []).map((r: any) => ({
      verse_key: r.verse_key,
      text: r.text,
      translations: r.translations,
    }));

    const result = { query, total_results: data.search?.total_results || 0, results };
    setCached(cacheKey, result, 1800000); // 30 mins
    res.json(result);
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'فشل في البحث', details: String(error) });
  }
});

// 6. AI Deep Tadabbur & Explanation based on Madinah Tafsir
mushafRouter.post('/ai-explain', aiLimiter, async (req: Request, res: Response) => {
  try {
    const { verse_key, text_uthmani, tafsir_madinah, question } = req.body;
    if (!verse_key || !text_uthmani) {
      return res.status(400).json({ error: 'verse_key و text_uthmani مطلوبان' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `أنت عالم وباحث قرآني ومربٍ إيماني معتمد.
إليك الآية الكريمة وتفسيرها من "تفسير مصحف المدينة النبوية (التفسير الميسر الصادر عن مجمع الملك فهد لطباعة المصحف الشريف)":

- الآية [${verse_key}]: "${text_uthmani}"
- نص التفسير الميسر لمصحف المدينة: "${tafsir_madinah || ''}"
${question ? `- سؤال المستخدم الإضافي: "${question}"` : ''}

المطلوب:
قدم شرحاً وتدبراً إيمانياً وتطبيقياً وافياً باللغة العربية الفصحى الجميلة يشتمل على النقاط التالية بصيغة منسقة ومرتبة:
1. **المعنى العام والبيان القرآني**: تبسيط المعنى بأسلوب إيماني رصين يستند لتفسير مصحف المدينة.
2. **معاني الكلمات وغريب الآية**: توضيح الألفاظ الدقيقة إن وجدت.
3. **الفوائد الإيمانية والتربوية (التدبر)**: استخراج 3 إلى 4 فوائد إيمانية وتربوية عميقة مستنبطة من الآية.
4. **كيف أعمل بهذه الآية؟ (التطبيق العملي)**: خطوات ووصايا عملية يطبقها القارئ في حياته اليومية.
${question ? `5. **الإجابة عن سؤال المستخدم**: إجابة واضحة وموثقة على سؤال المستخدم.` : ''}

اجعل الأسلوب محفزاً يلامس القلب، مع الالتزام التام بالمنهج الصحيح والاعتماد على تفسير مصحف المدينة النبوية.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    const explanation = response.text || 'عذراً، لم نتمكن من استخراج التدبر حالياً.';
    res.json({ verse_key, explanation });
  } catch (error: any) {
    console.error('AI Explain error:', error);
    res.status(500).json({ error: 'فشل في استخراج التدبر بالذكاء الاصطناعي', details: String(error) });
  }
});
