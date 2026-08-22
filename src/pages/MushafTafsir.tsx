import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Search,
  Play,
  Pause,
  Sparkles,
  Bookmark,
  Share2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  X,
  MessageSquare,
  Send,
  Loader2,
  HelpCircle,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  Mic,
  Lightbulb,
  Heart,
  Compass,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  verses_count: number;
  revelation_place: string;
  bismillah_pre: boolean;
  pages: [number, number];
}

interface Verse {
  id: number;
  verse_key: string;
  verse_number: number;
  chapter_number: number;
  text_uthmani: string;
  page_number?: number;
  tafsir_madinah: string;
  tafsir_source: string;
  audio_url: string;
}

interface Reciter {
  id: string;
  name: string;
  urlPrefix: string;
}

export default function MushafTafsir() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'chapter' | 'page'>('chapter');
  
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<string>('hudhaify');

  // Tafsir visibility toggles
  const [showTafsir, setShowTafsir] = useState(true);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');

  // Audio state
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // AI Tadabbur modal state
  const [activeTadabburVerse, setActiveTadabburVerse] = useState<Verse | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingStep, setAiLoadingStep] = useState(0);
  const [userQuestion, setUserQuestion] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mushaf_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Copied alert
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter dropdown for chapters
  const [chapterFilterText, setChapterFilterText] = useState('');
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);

  // Load all chapters initially
  useEffect(() => {
    fetch('/api/mushaf/chapters')
      .then((res) => res.json())
      .then((data) => {
        if (data.chapters) {
          setChapters(data.chapters);
          if (data.reciters) setReciters(data.reciters);
        }
      })
      .catch((err) => console.error('Failed to load chapters:', err));
  }, []);

  // Load verses when chapter or page changes
  useEffect(() => {
    setLoading(true);
    if (viewMode === 'chapter') {
      fetch(`/api/mushaf/chapter/${selectedChapterId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.verses) {
            setVerses(data.verses);
            setCurrentChapter(data.chapter);
            if (data.chapter.pages?.[0]) setSelectedPage(data.chapter.pages[0]);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load chapter verses:', err);
          setLoading(false);
        });
    } else {
      fetch(`/api/mushaf/page/${selectedPage}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.verses) {
            setVerses(data.verses);
            if (data.verses.length > 0) {
              const chId = data.verses[0].chapter_number;
              setSelectedChapterId(chId);
              const found = chapters.find((c) => c.id === chId);
              if (found) setCurrentChapter(found);
            }
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load page verses:', err);
          setLoading(false);
        });
    }
  }, [selectedChapterId, selectedPage, viewMode, chapters]);

  // Audio Playback handler
  const playVerseAudio = (verse: Verse, continueNext: boolean = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingVerseKey === verse.verse_key && !continueNext) {
      setPlayingVerseKey(null);
      setIsPlayingAll(false);
      return;
    }

    const reciter = reciters.find((r) => r.id === selectedReciter) || reciters[0];
    const prefix = reciter ? reciter.urlPrefix : 'https://everyayah.com/data/Hudhaify_128kbps';
    const sStr = String(verse.chapter_number).padStart(3, '0');
    const aStr = String(verse.verse_number).padStart(3, '0');
    const url = `${prefix}/${sStr}${aStr}.mp3`;

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingVerseKey(verse.verse_key);

    audio.play().catch((err) => {
      console.warn('Audio play failed:', err);
      setPlayingVerseKey(null);
      setIsPlayingAll(false);
    });

    audio.onended = () => {
      if (continueNext || isPlayingAll) {
        const currentIndex = verses.findIndex((v) => v.verse_key === verse.verse_key);
        if (currentIndex !== -1 && currentIndex < verses.length - 1) {
          playVerseAudio(verses[currentIndex + 1], true);
        } else {
          setPlayingVerseKey(null);
          setIsPlayingAll(false);
        }
      } else {
        setPlayingVerseKey(null);
      }
    };
  };

  const handlePlayAll = () => {
    if (isPlayingAll) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlayingAll(false);
      setPlayingVerseKey(null);
    } else {
      if (verses.length > 0) {
        setIsPlayingAll(true);
        playVerseAudio(verses[0], true);
      }
    }
  };

  // Toggle Bookmark
  const toggleBookmark = (verseKey: string) => {
    let nextBookmarks: string[];
    if (bookmarks.includes(verseKey)) {
      nextBookmarks = bookmarks.filter((k) => k !== verseKey);
    } else {
      nextBookmarks = [...bookmarks, verseKey];
    }
    setBookmarks(nextBookmarks);
    localStorage.setItem('mushaf_bookmarks', JSON.stringify(nextBookmarks));
  };

  // Copy Verse and Madinah Tafsir
  const handleCopy = (verse: Verse) => {
    const cleanTafsir = verse.tafsir_madinah.replace(/<[^>]*>/g, '');
    const surahName = currentChapter ? `سورة ${currentChapter.name_arabic}` : '';
    const textToCopy = `﴿ ${verse.text_uthmani} ﴾ [${surahName} - الآية ${verse.verse_number}]\n\n📖 تفسير مصحف المدينة النبوية (التفسير الميسر):\n${cleanTafsir}\n\n— عبر تطبيق ترتيل AI`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedKey(verse.verse_key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Open AI Tadabbur Modal with progressive steps and timeout protection
  const openAiTadabbur = async (verse: Verse) => {
    setActiveTadabburVerse(verse);
    setAiExplanation(null);
    setAiLoading(true);
    setAiLoadingStep(1);
    setAiChatHistory([]);
    setUserQuestion('');

    const stepInterval = setInterval(() => {
      setAiLoadingStep((s) => (s < 3 ? s + 1 : s));
    }, 1200);

    try {
      const cleanTafsir = verse.tafsir_madinah.replace(/<[^>]*>/g, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('/api/mushaf/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verse_key: verse.verse_key,
          text_uthmani: verse.text_uthmani,
          tafsir_madinah: cleanTafsir,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.explanation) {
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation(generateFallbackTadabbur(verse));
      }
    } catch (err) {
      console.warn('AI Tadabbur fetch delayed/failed, using structured fallback:', err);
      setAiExplanation(generateFallbackTadabbur(verse));
    } finally {
      clearInterval(stepInterval);
      setAiLoading(false);
    }
  };

  // Instant local structured breakdown generator from Madinah Tafsir
  const generateFallbackTadabbur = (verse: Verse) => {
    const cleanTafsir = verse.tafsir_madinah.replace(/<[^>]*>/g, '');
    return `### أولاً: المعنى العام والبيان القرآني
${cleanTafsir}

### ثانياً: الفوائد الإيمانية والتربوية (التدبر)
- **استشعار عظمة كلام الله**: الإقبال على قراءة الآية بتدبر وخشوع واستحضار معانيها الجليلة.
- **إخلاص النية لله تعالى**: توجيه القلوب بالافتقار إلى الله في كل شأن والاستعانة به سبحانه.
- **العمل بكتاب الله**: تحويل معاني الآية إلى منهاج حياة وسلوك يومي يرضي الله ورسوله.

### ثالثاً: كيف أعمل بهذه الآية؟ (التطبيق العملي)
- داوم على استحضار معاني هذه الآية أثناء تلاوتها في صلاتك اليومية.
- انشر هدايات هذه الآية ومقاصدها لمن حولك من أهلك وإخوانك.`;
  };

  // Ask additional question to AI in Tadabbur modal
  const handleSendAiQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim() || !activeTadabburVerse || aiChatLoading) return;

    const q = userQuestion.trim();
    setUserQuestion('');
    setAiChatHistory((prev) => [...prev, { sender: 'user', text: q }]);
    setAiChatLoading(true);

    try {
      const cleanTafsir = activeTadabburVerse.tafsir_madinah.replace(/<[^>]*>/g, '');
      const res = await fetch('/api/mushaf/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verse_key: activeTadabburVerse.verse_key,
          text_uthmani: activeTadabburVerse.text_uthmani,
          tafsir_madinah: cleanTafsir,
          question: q,
        }),
      });
      const data = await res.json();
      setAiChatHistory((prev) => [
        ...prev,
        { sender: 'ai', text: data.explanation || 'لم نتمكن من الإجابة على السؤال حالياً.' },
      ]);
    } catch (err) {
      console.error('AI question error:', err);
      setAiChatHistory((prev) => [
        ...prev,
        { sender: 'ai', text: 'حدث خطأ في الاتصال، يرجى إعادة المحاولة.' },
      ]);
    } finally {
      setAiChatLoading(false);
    }
  };

  // Search handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;

    setIsSearching(true);
    setShowSearchModal(true);
    try {
      const res = await fetch(`/api/mushaf/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const jumpToVerseKey = (verseKey: string) => {
    const [sStr] = verseKey.split(':');
    const sNum = parseInt(sStr);
    setSelectedChapterId(sNum);
    setViewMode('chapter');
    setShowSearchModal(false);
    // Smooth scroll to verse after render
    setTimeout(() => {
      const el = document.getElementById(`verse-${verseKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 3000);
      }
    }, 500);
  };

  // Helper to render formatted markdown sections
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-4 text-slate-200 leading-relaxed text-sm md:text-base">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
            const title = trimmed.replace(/^#+\s*/, '');
            return (
              <div key={idx} className="flex items-center gap-2 pt-3 pb-1 border-b border-slate-800/80 text-emerald-400 font-bold text-base">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{title}</span>
              </div>
            );
          }

          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            const content = trimmed.replace(/^[-•*]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <div
                  className="flex-1 text-slate-200 [&_strong]:text-emerald-300 [&_b]:text-emerald-300"
                  dangerouslySetInnerHTML={{
                    __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                  }}
                />
              </div>
            );
          }

          return (
            <p
              key={idx}
              className="text-slate-300 [&_strong]:text-emerald-300 [&_b]:text-emerald-300"
              dangerouslySetInnerHTML={{
                __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
              }}
            />
          );
        })}
      </div>
    );
  };

  const filteredChapters = chapters.filter((c) =>
    c.name_arabic.includes(chapterFilterText) ||
    c.name_simple.toLowerCase().includes(chapterFilterText.toLowerCase()) ||
    String(c.id).includes(chapterFilterText)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24 selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* Top Header / Control Panel */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-white tracking-wide">
                  مصحف المدينة النبوية
                </h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  التفسير الميسر
                </span>
              </div>
              <p className="text-xs text-slate-400">
                مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة
              </p>
            </div>
          </div>

          {/* Quick Selectors & View Mode Switch */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="bg-slate-800/80 p-1 rounded-xl flex items-center border border-slate-700/60 text-xs">
              <button
                onClick={() => setViewMode('chapter')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'chapter'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تصفح السور
              </button>
              <button
                onClick={() => setViewMode('page')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'page'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                صفحات المصحف (604)
              </button>
            </div>

            {/* Surah Dropdown Selector */}
            {viewMode === 'chapter' ? (
              <div className="relative">
                <button
                  onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 text-emerald-400 font-bold px-3.5 py-2 rounded-xl border border-slate-700 text-sm shadow-sm transition-all"
                >
                  <span className="text-slate-400 font-normal">سورة:</span>
                  <span>{currentChapter ? currentChapter.name_arabic : 'اختر السورة'}</span>
                  <span className="text-xs text-slate-500">({selectedChapterId})</span>
                </button>

                {isChapterDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 max-h-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="p-2.5 border-b border-slate-800">
                      <input
                        type="text"
                        placeholder="ابحث عن اسم أو رقم السورة..."
                        value={chapterFilterText}
                        onChange={(e) => setChapterFilterText(e.target.value)}
                        className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-800/40">
                      {filteredChapters.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => {
                            setSelectedChapterId(ch.id);
                            setIsChapterDropdownOpen(false);
                            setChapterFilterText('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-right rounded-lg text-xs transition-colors ${
                            selectedChapterId === ch.id
                              ? 'bg-emerald-600/20 text-emerald-400 font-bold'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-[10px] flex items-center justify-center text-slate-400 font-mono">
                              {ch.id}
                            </span>
                            <span>سورة {ch.name_arabic}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>{ch.revelation_place}</span>
                            <span>•</span>
                            <span>{ch.verses_count} آية</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Page Jump Selector */
              <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1.5 rounded-xl border border-slate-700">
                <button
                  disabled={selectedPage <= 1}
                  onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400">صفحة:</span>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={selectedPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 604) setSelectedPage(val);
                  }}
                  className="w-14 bg-slate-900 text-center text-xs font-bold text-emerald-400 py-1 rounded border border-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-500">/ 604</span>
                <button
                  disabled={selectedPage >= 604}
                  onClick={() => setSelectedPage((p) => Math.min(604, p + 1))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Reciter Selector */}
            <select
              value={selectedReciter}
              onChange={(e) => setSelectedReciter(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Search Trigger */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="بحث في المصحف والتفسير"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Play All Button */}
            <button
              onClick={handlePlayAll}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                isPlayingAll
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {isPlayingAll ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>إيقاف التلاوة</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>تلاوة مستمرة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Floating Display Options Toolbar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 text-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTafsir(!showTafsir)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                showTafsir
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showTafsir ? 'إخفاء التفسير الميسر' : 'إظهار التفسير الميسر'}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <span className="text-slate-400 px-1">حجم الخط:</span>
              <button
                onClick={() => setFontSize('normal')}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  fontSize === 'normal' ? 'bg-slate-700 text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                متوسط
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  fontSize === 'large' ? 'bg-slate-700 text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                كبير
              </button>
              <button
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  fontSize === 'xlarge' ? 'bg-slate-700 text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                ضخم
              </button>
            </div>
          </div>

          <div className="text-slate-400 flex items-center gap-2">
            <span>عدد الآيات المعروضة:</span>
            <span className="font-bold text-emerald-400 font-mono">{verses.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-slate-400 text-sm">جاري تحميل آيات وتفسير مصحف المدينة...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Surah Header Card (Islamic Ornamentation Banner) */}
            {currentChapter && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/20 p-6 md:p-8 shadow-2xl text-center">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                    <span>مصحف المدينة النبوية</span>
                    <span>•</span>
                    <span>{currentChapter.revelation_place}</span>
                    <span>•</span>
                    <span>{currentChapter.verses_count} آية</span>
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black text-white font-arabic mb-4 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400">
                    سُورَةُ {currentChapter.name_arabic}
                  </h2>

                  {/* Bismillah (except Surah At-Tawbah #9) */}
                  {selectedChapterId !== 9 && (
                    <div className="mt-2 text-xl md:text-2xl font-arabic text-emerald-300/90 select-none py-2 border-y border-emerald-500/10 px-8 inline-block">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
                    <Link
                      to="/tajweed"
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:underline font-bold"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>تسميع وتجويد هذه السورة</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Verses & Tafsir List */}
            <div className="space-y-6">
              {verses.map((verse) => {
                const isPlaying = playingVerseKey === verse.verse_key;
                const isBookmarked = bookmarks.includes(verse.verse_key);
                const isCopied = copiedKey === verse.verse_key;

                return (
                  <div
                    key={verse.verse_key}
                    id={`verse-${verse.verse_key}`}
                    className={`rounded-2xl border transition-all duration-300 bg-slate-900/90 overflow-hidden shadow-lg ${
                      isPlaying
                        ? 'border-emerald-500 shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Verse Header Info & Action Controls */}
                    <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-bold flex items-center justify-center font-mono">
                          {verse.verse_number}
                        </span>
                        <span className="text-slate-400 font-medium">
                          آية {verse.verse_key}
                        </span>
                        {verse.page_number && (
                          <span className="text-slate-500 text-[11px]">
                            (صفحة {verse.page_number})
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Play Audio Button */}
                        <button
                          onClick={() => playVerseAudio(verse)}
                          className={`p-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                            isPlaying
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                          }`}
                          title="استماع للآية"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-white" />
                              <span className="text-[11px]">جارٍ الاستماع...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-slate-300" />
                              <span className="text-[11px] hidden sm:inline">استماع</span>
                            </>
                          )}
                        </button>

                        {/* AI Tadabbur Button */}
                        <button
                          onClick={() => openAiTadabbur(verse)}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-teal-900/60 to-emerald-900/60 hover:from-teal-800 hover:to-emerald-800 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold transition-all shadow-sm"
                          title="تدبر وشرح الآية بالذكاء الاصطناعي"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px]">تدبر ذكي</span>
                        </button>

                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopy(verse)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
                          title="نسخ الآية والتفسير"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Bookmark Button */}
                        <button
                          onClick={() => toggleBookmark(verse.verse_key)}
                          className={`p-2 rounded-xl transition-colors ${
                            isBookmarked
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 hover:bg-slate-750 text-slate-400'
                          }`}
                          title={isBookmarked ? 'إزالة من العلامات' : 'حفظ كعلامة'}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Verse Sacred Text (Uthmanic Script of Madinah) */}
                    <div className="p-6 md:p-8 bg-slate-900/40 text-right">
                      <p
                        className={`font-quran leading-loose text-white text-right select-text ${
                          fontSize === 'normal'
                            ? 'text-xl md:text-2xl'
                            : fontSize === 'large'
                            ? 'text-2xl md:text-3xl'
                            : 'text-3xl md:text-4xl'
                        }`}
                      >
                        {verse.text_uthmani}{' '}
                        <span className="quran-ayah-badge text-emerald-400 font-normal px-2">
                          ﴿{verse.verse_number}﴾
                        </span>
                      </p>
                    </div>

                    {/* Tafsir of Madinah Card (التفسير الميسر) */}
                    {showTafsir && (
                      <div className="p-5 md:p-6 bg-slate-950/80 border-t border-slate-800/80">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            تفسير مصحف المدينة النبوية (التفسير الميسر)
                          </h4>
                        </div>
                        <div
                          className="text-slate-300 text-sm md:text-base leading-relaxed select-text space-y-2 [&_.green]:text-emerald-400 [&_.green]:font-bold [&_b]:text-white [&_strong]:text-white"
                          dangerouslySetInnerHTML={{ __html: verse.tafsir_madinah }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination / Next & Prev Navigation */}
            <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-800">
              {viewMode === 'chapter' ? (
                <>
                  <button
                    disabled={selectedChapterId <= 1}
                    onClick={() => {
                      setSelectedChapterId((id) => Math.max(1, id - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>السورة السابقة</span>
                  </button>

                  <div className="text-xs text-slate-400">
                    سورة {currentChapter?.name_arabic} ({selectedChapterId} من 114)
                  </div>

                  <button
                    disabled={selectedChapterId >= 114}
                    onClick={() => {
                      setSelectedChapterId((id) => Math.min(114, id + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition-all"
                  >
                    <span>السورة التالية</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={selectedPage <= 1}
                    onClick={() => {
                      setSelectedPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>الصفحة السابقة</span>
                  </button>

                  <div className="text-xs text-slate-400">
                    صفحة {selectedPage} من 604
                  </div>

                  <button
                    disabled={selectedPage >= 604}
                    onClick={() => {
                      setSelectedPage((p) => Math.min(604, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition-all"
                  >
                    <span>الصفحة التالية</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* AI Tadabbur & Insights Modal */}
      {activeTadabburVerse && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    التدبر الإيماني بالذكاء الاصطناعي
                  </h3>
                  <p className="text-xs text-slate-400">
                    الآية [{activeTadabburVerse.verse_key}] • استناداً لتفسير مصحف المدينة النبوية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTadabburVerse(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 mushaf-scroll">
              {/* Verse Text Quote */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-emerald-500/20 text-center">
                <p className="font-quran text-xl md:text-2xl text-emerald-300 leading-loose">
                  ﴿ {activeTadabburVerse.text_uthmani} ﴾
                </p>
              </div>

              {/* Madinah Tafsir Snapshot */}
              <div className="bg-slate-850/60 p-4 rounded-xl border border-slate-800 text-xs">
                <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>نص التفسير الميسر لمصحف المدينة:</span>
                </div>
                <div
                  className="text-slate-300 leading-relaxed [&_.green]:text-emerald-400"
                  dangerouslySetInnerHTML={{ __html: activeTadabburVerse.tafsir_madinah }}
                />
              </div>

              {/* AI Generated In-depth Reflection or Dynamic Loading */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>البيان القرآني والفوائد الإيمانية المستنبطة:</span>
                  </div>
                  {!aiLoading && (
                    <button
                      onClick={() => openAiTadabbur(activeTadabburVerse)}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>إعادة التوليد</span>
                    </button>
                  )}
                </div>

                {aiLoading ? (
                  <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-3 border-emerald-500/20 rounded-full" />
                      <div className="absolute inset-0 border-3 border-emerald-500 rounded-full border-t-transparent animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">
                        {aiLoadingStep === 1
                          ? 'استحضار تفسير مصحف المدينة النبوية...'
                          : aiLoadingStep === 2
                          ? 'استنباط الفوائد الإيمانية والتربوية...'
                          : 'صياغة التوجيهات والتطبيقات العملية...'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        يقوم المعلم الذكي بتحليل الآية المباركة
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80">
                    {aiExplanation && renderFormattedMarkdown(aiExplanation)}
                  </div>
                )}
              </div>

              {/* Interactive Chat Q&A regarding the verse */}
              {aiChatHistory.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>الأسئلة والأجوبة حول الآية:</span>
                  </div>
                  <div className="space-y-3">
                    {aiChatHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          item.sender === 'user'
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 mr-6'
                            : 'bg-slate-950 text-slate-200 border border-slate-800 ml-6'
                        }`}
                      >
                        <div className="font-bold mb-1 opacity-75">
                          {item.sender === 'user' ? 'سؤالك:' : 'إجابة المعلم الذكي:'}
                        </div>
                        <div className="whitespace-pre-line">{item.text}</div>
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                        <span>جاري صياغة الإجابة...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Interactive Input */}
            <form
              onSubmit={handleSendAiQuestion}
              className="p-4 border-t border-slate-800 bg-slate-850 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="اسأل المعلم الذكي عن أي معنى أو استفسار في الآية وتفسيرها..."
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                disabled={aiLoading || aiChatLoading}
                className="flex-1 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!userQuestion.trim() || aiLoading || aiChatLoading}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-colors"
                title="إرسال السؤال"
              >
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Search className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  البحث في المصحف وتفسير المدينة
                </h3>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="p-4 border-b border-slate-800 bg-slate-900">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن كلمة، آية، أو معنى في التفسير الميسر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 text-white text-sm pr-10 pl-24 py-3 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute left-2 top-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSearching ? 'جاري البحث...' : 'بحث'}
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 mushaf-scroll">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  <p>جاري البحث في مصحف المدينة وتفسيرها...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToVerseKey(res.verse_key)}
                    className="w-full text-right p-4 rounded-2xl bg-slate-850 hover:bg-slate-800 border border-slate-800/80 hover:border-emerald-500/40 transition-all group space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                      <span>الآية [{res.verse_key}]</span>
                      <span className="text-slate-500 text-[11px] group-hover:text-emerald-300">
                        انتقال للآية ↵
                      </span>
                    </div>
                    <p
                      className="font-quran text-slate-200 text-base leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: res.text }}
                    />
                  </button>
                ))
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'اكتب كلمة البحث واضغط Enter'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
