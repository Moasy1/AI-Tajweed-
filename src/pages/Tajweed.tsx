import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  RotateCcw, 
  BookOpen, 
  CheckCircle2, 
  Volume2, 
  Loader2, 
  Sliders,
  Scale,
  Sparkles,
  Info,
  ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface Surah {
  number: number;
  name: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
}

interface TajweedWord {
  text: string;
  status: 'correct' | 'error';
  category: string;
  rule: string;
  suggestion: string;
  accuracy: number;
}

interface TajweedAnalysis {
  surah: string;
  ayah: string;
  score: number;
  summary?: string;
  words: TajweedWord[];
}

export default function Tajweed() {
  const [allSurahs, setAllSurahs] = useState<{number: number, name: string}[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(1);
  const [surah, setSurah] = useState<Surah | null>(null);
  const [selectedAyahNumber, setSelectedAyahNumber] = useState<number>(1);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [resultsAvailable, setResultsAvailable] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TajweedAnalysis | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [activeWordCard, setActiveWordCard] = useState<TajweedWord | null>(null);

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [playingReciter, setPlayingReciter] = useState(false);
  const reciterAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        if (data.data) setAllSurahs(data.data);
      })
      .catch(err => console.error("Error fetching surahs:", err));
  }, []);

  useEffect(() => {
    setSurah(null);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurahNumber}`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setSurah(data.data);
          setSelectedAyahNumber(1);
          resetState();
        }
      })
      .catch(err => console.error("Error fetching surah:", err));
  }, [selectedSurahNumber]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      if (reciterAudioRef.current) reciterAudioRef.current.pause();
    };
  }, []);

  const cleanupAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const getCurrentAyah = (): Ayah | null => {
    if (!surah || !surah.ayahs) return null;
    return surah.ayahs.find(a => a.numberInSurah === selectedAyahNumber) || surah.ayahs[0] || null;
  };

  const handleStartRecording = async () => {
    cleanupAudio();
    resetState();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round(avg * 2)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        cleanupAudio();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        analyzeAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('الرجاء السماح بالوصول إلى الميكروفون للبدء في تقييم التجويد.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzeAudio = async (blob: Blob) => {
    setAnalyzing(true);
    setAnalysisStep('جاري قراءة الإشارة الصوتية وتشريح التلاوة...');
    
    const currentAyah = getCurrentAyah();
    const surahName = surah ? surah.name : 'الفاتحة';
    const referenceText = currentAyah ? currentAyah.text : '';

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recitation.webm');
      formData.append('surah', surahName);
      formData.append('ayah', String(selectedAyahNumber));
      formData.append('reference_text', referenceText);

      setAnalysisStep('جاري الفحص التشريحي لأحكام النون والميم، المدود، القلقلة، ومخارج الحروف...');
      
      const response = await fetch('/api/analyze-tajweed', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Server error');
      }
      
      setAnalysisResult(data);
      if (data.words && data.words.length > 0) {
        setActiveWordCard(data.words[0]);
      }
      setAnalysisStep('اكتمل التقرير الصوتي المعتمد.');
      setTimeout(() => {
        setAnalyzing(false);
        setResultsAvailable(true);
      }, 400);

    } catch (error: any) {
      console.error('Error during analysis:', error);
      setAnalyzing(false);
      alert('حدث خطأ أثناء فحص التجويد: ' + (error.message || 'يرجى المحاولة مجدداً'));
    }
  };

  const playReciterAudio = () => {
    const currentAyah = getCurrentAyah();
    if (!currentAyah) return;

    if (playingReciter && reciterAudioRef.current) {
      reciterAudioRef.current.pause();
      setPlayingReciter(false);
      return;
    }

    const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${currentAyah.number}.mp3`;
    const audio = new Audio(audioUrl);
    reciterAudioRef.current = audio;
    setPlayingReciter(true);
    
    audio.play().catch(e => console.error('Audio play error:', e));
    audio.onended = () => setPlayingReciter(false);
    audio.onerror = () => setPlayingReciter(false);
  };

  const resetState = () => {
    setAudioUrl(null);
    setResultsAvailable(false);
    setAnalyzing(false);
    setAnalysisResult(null);
    setActiveWordCard(null);
    if (reciterAudioRef.current) {
      reciterAudioRef.current.pause();
      setPlayingReciter(false);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentAyah = getCurrentAyah();

  const filteredWords = analysisResult?.words.filter(w => {
    if (selectedCategoryFilter === 'all') return true;
    if (selectedCategoryFilter === 'errors') return w.status === 'error';
    return w.category?.includes(selectedCategoryFilter);
  }) || [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto font-sans pb-28">
      {/* Header */}
      <header className="mb-6 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold mb-3">
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>المعمل الصوتي الدقيق والتشريح الفني للتلاوة</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">معمل التجويد والمطابقة الصوتية</h2>
        <p className="text-slate-500 mt-2 text-sm md:text-base">فحص مخارج الحروف، قياس أزمنة المدود، مراتب الغنن، والتفخيم والترقيق مع مقارنة فورية مع كبار القراء.</p>
      </header>

      {/* Selector Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <span className="text-xs font-bold text-slate-600 shrink-0">السورة:</span>
          <select 
            value={selectedSurahNumber} 
            onChange={(e) => setSelectedSurahNumber(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {allSurahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. سورة {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 shrink-0">الآية:</span>
          <select
            value={selectedAyahNumber}
            onChange={(e) => {
              setSelectedAyahNumber(Number(e.target.value));
              resetState();
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[100px]"
          >
            {surah?.ayahs.map((a) => (
              <option key={a.numberInSurah} value={a.numberInSurah}>
                آية {a.numberInSurah}
              </option>
            ))}
          </select>
        </div>

        <Link
          to="/mushaf"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>تفسير مصحف المدينة</span>
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Main Display Box */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 overflow-hidden relative flex flex-col justify-between p-6 md:p-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-500" />
            
            <div className="flex flex-col items-center">
              
              <div className="w-full flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800">
                  سورة {surah?.name || 'الفاتحة'} - الآية {selectedAyahNumber}
                </h3>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                  فحص صوتي دقيق
                </span>
              </div>
              
              {/* Quran Ayah Display */}
              <div 
                className="text-2xl md:text-3xl leading-loose md:leading-[2.5] font-arabic text-slate-800 flex flex-wrap justify-center gap-x-2 md:gap-x-3 gap-y-3 mb-6 text-center max-w-2xl select-none"
                dir="rtl"
                style={{ fontFamily: '"Amiri", "Traditional Arabic", serif' }}
              >
                {resultsAvailable && analysisResult?.words ? (
                  analysisResult.words.map((word, idx) => {
                    const isSelected = activeWordCard?.text === word.text;
                    return (
                      <span 
                        key={idx} 
                        onClick={() => setActiveWordCard(word)}
                        className={`
                          relative px-2.5 py-1 transition-all duration-200 rounded-xl cursor-pointer
                          ${word.status === 'error' 
                            ? 'text-red-700 bg-red-50 border-b-2 border-red-500 hover:bg-red-100' 
                            : 'text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100'}
                          ${isSelected ? 'ring-2 ring-blue-600 shadow-md font-bold' : ''}
                        `}
                      >
                        {word.text}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-800 font-medium">
                    {currentAyah ? currentAyah.text : 'جاري التحميل...'}
                  </span>
                )}
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center gap-4 w-full max-w-md my-2">
                
                {!isRecording && !audioUrl && !analyzing && (
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={handleStartRecording}
                      className="w-18 h-18 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-600/30 transition-all active:scale-95 z-10"
                    >
                      <Mic className="w-8 h-8" />
                    </button>
                    <span className="text-xs font-bold text-slate-500">اضغط لبدء فحص التجويد والمخارج</span>
                  </div>
                )}

                {isRecording && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <button 
                      onClick={handleStopRecording}
                      className="w-18 h-18 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-red-600/30 transition-transform active:scale-95 animate-pulse"
                    >
                      <Square className="w-7 h-7 fill-current" />
                    </button>
                    <div className="text-red-600 font-bold text-xs">
                      جاري تسجيل التلاوة: {formatTimer(recordingSeconds)}
                    </div>
                  </div>
                )}
                
                {analyzing && (
                  <div className="flex flex-col items-center gap-3 text-blue-700 py-3">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <span className="font-bold text-xs text-center">{analysisStep}</span>
                  </div>
                )}

                {audioUrl && !analyzing && (
                  <div className="flex gap-2 w-full mt-2">
                    <button 
                      onClick={resetState}
                      className="flex-1 flex items-center justify-center gap-2 text-slate-700 font-bold text-xs bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> فحص تلاوة أخرى
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Audio Comparison Station: You vs Sheikh */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Scale className="w-4 h-4 text-blue-600" />
                <span>محطة المقارنة السمعية الفورية:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* User Recitation Audio */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>🎙️ تلاوتك المسجلة:</span>
                    {analysisResult && (
                      <span className="text-blue-600 font-extrabold">{analysisResult.score}%</span>
                    )}
                  </div>
                  {audioUrl ? (
                    <audio src={audioUrl} controls className="w-full h-8" />
                  ) : (
                    <span className="text-[11px] text-slate-400">سجّل تلاوتك لتظهر هنا</span>
                  )}
                </div>

                {/* Master Reciter Audio */}
                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/70 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>🌟 تلاوة الشيخ المعتمدة:</span>
                    <span className="text-[11px] font-normal text-emerald-600">رواية حفص</span>
                  </div>
                  <button
                    onClick={playReciterAudio}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{playingReciter ? 'إيقاف صوت الشيخ' : 'استمع لتلاوة الشيخ مشاري'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Left Side: Precision Diagnostic Breakdown & Rule Flashcard */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Active Word Rule Flashcard */}
          {activeWordCard ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  بطاقة الحكم التجويدي
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  activeWordCard.status === 'correct' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {activeWordCard.status === 'correct' ? 'نطق متقن' : 'يحتاج تصحيح'}
                </span>
              </div>

              <div className="text-center py-2 bg-slate-50 rounded-2xl mb-3 border border-slate-100">
                <span className="font-arabic text-3xl font-bold text-slate-900" dir="rtl">
                  {activeWordCard.text}
                </span>
                <div className="text-xs text-blue-700 font-bold mt-1">
                  الحكم: {activeWordCard.rule}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-slate-800 leading-relaxed">
                  <span className="font-bold text-blue-950 block mb-1">💡 التوجيه التطبيقي للنطق:</span>
                  {activeWordCard.suggestion}
                </div>

                <div className="flex justify-between items-center px-1 text-[11px] text-slate-500 font-medium">
                  <span>الصنف: {activeWordCard.category || 'أحكام التجويد'}</span>
                  <span>نسبة الإتقان: {activeWordCard.accuracy}%</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Detailed Diagnostic Categories List */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>التشريح الصوتي للكلمات</span>
              </h4>
              {analysisResult && (
                <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                  المعدل: {analysisResult.score}%
                </span>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4 text-[11px] font-bold">
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({analysisResult?.words.length || 0})
              </button>
              <button
                onClick={() => setSelectedCategoryFilter('errors')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  selectedCategoryFilter === 'errors'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                الملاحظات ({analysisResult?.words.filter(w => w.status === 'error').length || 0})
              </button>
            </div>

            {/* Words List */}
            {resultsAvailable && filteredWords.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredWords.map((word, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveWordCard(word)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      activeWordCard?.text === word.text
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : word.status === 'error'
                          ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                          : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-arabic font-bold text-lg text-slate-900">{word.text}</span>
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">{word.rule}</span>
                        <span className="text-[10px] text-slate-400">{word.category || 'تجويد'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-extrabold ${
                        word.status === 'correct' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {word.accuracy}%
                      </span>
                      <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">سجّل تلاوتك ليظهر التشريح الفني للأحكام هنا</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
