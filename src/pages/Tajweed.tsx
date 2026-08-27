import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle2, 
  Volume2, 
  Loader2, 
  Sparkles,
  ChevronDown
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
  rule: string;
  suggestion: string;
  accuracy: number;
}

interface TajweedAnalysis {
  surah: string;
  ayah: string;
  score: number;
  words: TajweedWord[];
}

export default function Tajweed() {
  const [allSurahs, setAllSurahs] = useState<{number: number, name: string}[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(1); // Surah Al-Fatiha by default
  const [surah, setSurah] = useState<Surah | null>(null);
  const [selectedAyahNumber, setSelectedAyahNumber] = useState<number>(1);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [resultsAvailable, setResultsAvailable] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TajweedAnalysis | null>(null);

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

  // Fetch Surah list
  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setAllSurahs(data.data);
        }
      })
      .catch(err => console.error("Error fetching surahs:", err));
  }, []);

  // Fetch selected Surah details
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
      if (reciterAudioRef.current) {
        reciterAudioRef.current.pause();
      }
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

      // Audio level analyser
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
    setAnalysisStep('جاري رفع التلاوة وفحص الصوت...');
    
    const currentAyah = getCurrentAyah();
    const surahName = surah ? surah.name : 'الفاتحة';
    const referenceText = currentAyah ? currentAyah.text : '';

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recitation.webm');
      formData.append('surah', surahName);
      formData.append('ayah', String(selectedAyahNumber));
      formData.append('reference_text', referenceText);

      setAnalysisStep('جاري فحص أحكام التجويد ومخارج الحروف مع النص القرآني المعتمد...');
      
      const response = await fetch('/api/analyze-tajweed', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Server error');
      }
      
      setAnalysisResult(data);
      setAnalysisStep('جاري تجهيز تقرير التجويد الموثق...');
      setTimeout(() => {
        setAnalyzing(false);
        setResultsAvailable(true);
      }, 400);

    } catch (error: any) {
      console.error('Error during analysis:', error);
      setAnalyzing(false);
      alert('حدث خطأ أثناء تحليل التجويد: ' + (error.message || 'يرجى المحاولة مجدداً'));
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto font-sans pb-28">
      {/* Header */}
      <header className="mb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>المطابقة الصوتية الموثقة بأحكام التجويد</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">محرك فحص التسميع والتجويد</h2>
        <p className="text-slate-500 mt-2 text-sm md:text-base">تحليل تلاوتك ومطابقتها كلمة بكلمة مع المصحف الشريف لاكتشاف أحكام التجويد واللحن بدقة فائقة.</p>
      </header>

      {/* Selector Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <span className="text-xs font-bold text-slate-600 shrink-0">اختر السورة:</span>
          <select 
            value={selectedSurahNumber} 
            onChange={(e) => setSelectedSurahNumber(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {allSurahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. سورة {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600 shrink-0">اختر الآية:</span>
          <select
            value={selectedAyahNumber}
            onChange={(e) => {
              setSelectedAyahNumber(Number(e.target.value));
              resetState();
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[100px]"
          >
            {surah?.ayahs.map((a) => (
              <option key={a.numberInSurah} value={a.numberInSurah}>
                آية {a.numberInSurah}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={playReciterAudio}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors shadow-sm"
        >
          <Volume2 className="w-4 h-4 text-emerald-600" />
          <span>{playingReciter ? 'إيقاف صوت الشيخ' : 'استمع لتلاوة الشيخ مشاري'}</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Main Display Box */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 overflow-hidden relative min-h-[460px] flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            
            <div className="p-6 md:p-10 flex flex-col items-center">
              
              {/* Surah Header Card */}
              <div className="w-full flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    سورة {surah?.name || 'الفاتحة'}
                  </h3>
                  <Link
                    to="/mushaf"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>مصحف المدينة</span>
                  </Link>
                </div>
                <span className="px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  آية رقم {selectedAyahNumber}
                </span>
              </div>
              
              {/* Quran Ayah Text View */}
              <div 
                className="text-2xl md:text-4xl leading-loose md:leading-[2.6] font-arabic text-slate-800 flex flex-wrap justify-center gap-x-2 md:gap-x-3 gap-y-3 md:gap-y-4 mb-8 text-center max-w-3xl select-none"
                dir="rtl"
                style={{ fontFamily: '"Amiri", "Traditional Arabic", serif' }}
              >
                {resultsAvailable && analysisResult?.words ? (
                  analysisResult.words.map((word, idx) => (
                    <span 
                      key={idx} 
                      className={`
                        relative px-2 py-1 transition-all duration-300 rounded-xl cursor-pointer group
                        ${word.status === 'error' 
                          ? 'text-red-700 bg-red-50 border-b-2 border-red-500 hover:bg-red-100 shadow-sm' 
                          : 'text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100'}
                      `}
                    >
                      {word.text}
                      
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl whitespace-nowrap z-30 pointer-events-none shadow-2xl flex flex-col items-center gap-1 font-sans">
                        <span className={`font-bold ${word.status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                          {word.status === 'error' ? `خطأ: ${word.rule}` : `حكم سليم: ${word.rule || 'نطق متقن'}`}
                        </span>
                        <span className="text-[11px] text-slate-300 max-w-[220px] whitespace-normal text-center">
                          {word.suggestion}
                        </span>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </span>
                  ))
                ) : (
                  <span className="text-slate-800 font-medium">
                    {currentAyah ? currentAyah.text : 'جاري التحميل...'}
                  </span>
                )}
              </div>

              {/* Recording Controls & Visualizer */}
              <div className="flex flex-col items-center gap-5 w-full max-w-md mt-4">
                
                {/* Idle / Ready */}
                {!isRecording && !audioUrl && !analyzing && (
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={handleStartRecording}
                      className="group relative flex items-center justify-center"
                    >
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full scale-150 group-hover:scale-175 transition-transform duration-500 opacity-0 group-hover:opacity-100" />
                      <div className="relative w-20 h-20 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all active:scale-95 z-10">
                        <Mic className="w-9 h-9" />
                      </div>
                    </button>
                    <span className="text-xs font-bold text-slate-500">اضغط على الميكروفون لبدء التسميع</span>
                  </div>
                )}

                {/* Live Recording */}
                {isRecording && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="relative flex items-center justify-center">
                      <div 
                        className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-100"
                        style={{ transform: `scale(${1 + audioLevel / 80})` }}
                      />
                      <button 
                        onClick={handleStopRecording}
                        className="relative w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-red-600/30 transition-transform active:scale-95 z-10"
                      >
                        <Square className="w-8 h-8 fill-current" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-red-600 font-bold text-sm animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      <span>جاري التسجيل: {formatTimer(recordingSeconds)} (اضغط المربع عند الانتهاء)</span>
                    </div>
                  </div>
                )}
                
                {/* Analysis in Progress */}
                {analyzing && (
                  <div className="flex flex-col items-center gap-3 text-emerald-700 py-4">
                    <div className="relative w-14 h-14">
                      <Loader2 className="w-14 h-14 animate-spin text-emerald-500" />
                    </div>
                    <span className="font-bold text-sm text-center leading-relaxed">{analysisStep}</span>
                  </div>
                )}

                {/* Finished Recitation Result Controls */}
                {audioUrl && !analyzing && (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <audio src={audioUrl} controls className="w-full h-10 rounded-xl" />
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={resetState}
                        className="flex-1 flex items-center justify-center gap-2 text-slate-700 font-bold text-xs bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" /> إعادة التسجيل
                      </button>
                      {selectedAyahNumber < (surah?.numberOfAyahs || 1) && (
                        <button
                          onClick={() => {
                            setSelectedAyahNumber(prev => prev + 1);
                            resetState();
                          }}
                          className="flex-1 flex items-center justify-center gap-2 text-white font-bold text-xs bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl transition-colors shadow-sm"
                        >
                          <span>الآية التالية</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-400">
              💡 اضغط على أي كلمة في الآية بعد انتهاء التحليل لعرض حكم التجويد ونطقها الصحيح.
            </div>
          </div>
        </div>

        {/* Left Side: Accurate Results Panel */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6 sticky top-8 flex flex-col h-full min-h-[460px]">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                تقرير المطابقة وأحكام التجويد
              </h3>
            </div>
            
            {resultsAvailable && analysisResult?.words ? (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1">
                
                {/* Score Banner */}
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 block">نسبة الإتقان والتجويد</span>
                    <span className="text-xs text-emerald-600">وفق رواية حفص عن عاصم</span>
                  </div>
                  <span className="text-3xl font-extrabold text-emerald-700">
                    {analysisResult.score}%
                  </span>
                </div>

                {/* Words Details Breakdown */}
                {analysisResult.words.map((word, idx) => {
                  if (word.status === 'error') {
                    return (
                      <div key={idx} className="p-3.5 rounded-2xl bg-red-50/80 border border-red-200/70 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-arabic font-bold text-xl text-red-950">{word.text}</span>
                          <span className="px-2 py-0.5 rounded-md bg-red-200/70 text-red-800 text-[11px] font-bold">
                            {word.rule}
                          </span>
                        </div>
                        <p className="text-xs text-red-900/90 leading-relaxed font-medium">{word.suggestion}</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={idx} className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                      <div>
                        <span className="font-arabic font-bold text-lg text-emerald-950 block">{word.text}</span>
                        <span className="text-[11px] text-emerald-700">{word.rule || 'نطق متقن'}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {word.accuracy}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Mic className="w-7 h-7 text-slate-300" />
                </div>
                <p className="font-bold text-sm text-slate-600">بانتظار تلاوتك</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">سجّل الآية وسيقوم الذكاء الاصطناعي بمطابقتها كلمة بكلمة مع أحكام التجويد</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
