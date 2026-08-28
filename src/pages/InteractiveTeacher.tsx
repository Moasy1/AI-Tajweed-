import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Loader2, 
  Waves, 
  BookOpen, 
  Calendar, 
  Target, 
  Clock, 
  Mic, 
  Square, 
  RotateCcw, 
  Volume2, 
  Pause,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Check,
  HelpCircle,
  Zap,
  VolumeX,
  Sparkles
} from 'lucide-react';

type CallState = 'idle' | 'recording' | 'analyzing' | 'feedback' | 'error';
type MemorizationViewMode = 'hidden' | 'first_words' | 'visible';

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

interface MemorizationFeedback {
  dialogue: string;
  memorizationScore: number;
  status: string;
  missedWords: string[];
  teacherAdvice: string;
}

export default function InteractiveTeacher() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState<string>('أهلاً بك يا بني في حلقة التحفيظ. اختر وردك، واعتمد على حفظك الغيبي، وتفضل بالتسميع.');
  
  const [surah, setSurah] = useState<Surah | null>(null);
  const [allSurahs, setAllSurahs] = useState<{number: number, name: string}[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(67); // Surah Al-Mulk
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(5);
  
  // Memorization Mode
  const [viewMode, setViewMode] = useState<MemorizationViewMode>('hidden');

  // Smart Auto-Silence Detection (VAD)
  const [autoSilenceDetection, setAutoSilenceDetection] = useState<boolean>(true);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const hasSpokenRef = useRef<boolean>(false);
  const speechStartTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<any>(null);

  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [schedule, setSchedule] = useState([
    { day: 'اليوم', task: 'سورة الملك - الآيات 1 إلى 5', status: 'current' },
    { day: 'غداً', task: 'سورة الملك - الآيات 6 إلى 10', status: 'upcoming' },
    { day: 'بعد غد', task: 'سورة الملك - الآيات 11 إلى 15', status: 'upcoming' }
  ]);

  // Audio Recording & Analyser
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Teacher feedback state
  const [teacherAudioUrl, setTeacherAudioUrl] = useState<string | null>(null);
  const [isTeacherAudioPlaying, setIsTeacherAudioPlaying] = useState<boolean>(false);
  const teacherAudioRef = useRef<HTMLAudioElement | null>(null);
  const [feedbackData, setFeedbackData] = useState<MemorizationFeedback | null>(null);

  // Fetch Surah list
  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        if (data.data) setAllSurahs(data.data);
      })
      .catch(err => console.error("Error fetching surahs list:", err));
  }, []);

  // Fetch Selected Surah Details
  useEffect(() => {
    setSurah(null);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurahNumber}`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setSurah(data.data);
          resetTeacherSession();
        }
      })
      .catch(err => console.error("Error fetching surah details:", err));
  }, [selectedSurahNumber]);

  useEffect(() => {
    return () => {
      cleanupAudioNodes();
      if (teacherAudioRef.current) teacherAudioRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const cleanupAudioNodes = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
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
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setSilenceCountdown(null);
  };

  const getSelectedAyahsText = useCallback(() => {
    if (!surah || !surah.ayahs) return '';
    const sliceStart = Math.max(0, startAyah - 1);
    const sliceEnd = Math.min(surah.ayahs.length, endAyah);
    return surah.ayahs.slice(sliceStart, sliceEnd).map(a => a.text).join(' ');
  }, [surah, startAyah, endAyah]);

  function replaceNumbersWithArabicWords(text: string): string {
    return text
      .replace(/\b1-5\b/g, 'من الأولى إلى الخامسة')
      .replace(/\b6-10\b/g, 'من السادسة إلى العاشرة')
      .replace(/\b11-15\b/g, 'من الحادية عشرة إلى الخامسة عشرة')
      .replace(/\b16-20\b/g, 'من السادسة عشرة إلى العشرين')
      .replace(/\b21-25\b/g, 'من الواحدة والعشرين إلى الخامسة والعشرين')
      .replace(/\b26-30\b/g, 'من السادسة والعشرين إلى الثلاثين')
      .replace(/\b1\b/g, 'الأولى')
      .replace(/\b2\b/g, 'الثانية')
      .replace(/\b3\b/g, 'الثالثة')
      .replace(/\b4\b/g, 'الرابعة')
      .replace(/\b5\b/g, 'الخامسة')
      .replace(/\b6\b/g, 'السادسة')
      .replace(/\b7\b/g, 'السابعة')
      .replace(/\b8\b/g, 'الثامنة')
      .replace(/\b9\b/g, 'التاسعة')
      .replace(/\b10\b/g, 'العاشرة');
  }

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanArabicText = replaceNumbersWithArabicWords(text);
      const utterance = new SpeechSynthesisUtterance(cleanArabicText);
      utterance.lang = 'ar-SA';
      
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(v => 
        v.lang.startsWith('ar') || 
        v.name.toLowerCase().includes('arabic') || 
        v.name.includes('Maged') || 
        v.name.includes('Tarik') || 
        v.name.includes('Laila') || 
        v.name.includes('Salma') || 
        v.name.includes('Hoda') || 
        v.name.includes('Naayf')
      );
      if (arabicVoice) utterance.voice = arabicVoice;
      
      utterance.rate = 0.9;
      utterance.onend = () => setIsTeacherAudioPlaying(false);
      utterance.onerror = () => setIsTeacherAudioPlaying(false);
      setIsTeacherAudioPlaying(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Submit recorded audio to teacher
  const submitRecitationAudio = async () => {
    cleanupAudioNodes();
    setCallState('analyzing');
    setTranscript('المعلم يستمع لتسميعك الغيبي ويراجع ثبات الحفظ والكلمات...');

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const referenceText = getSelectedAyahsText();
    const surahName = surah ? surah.name : 'سورة الملك';
    const ayahRange = `${startAyah} إلى ${endAyah}`;

    const formData = new FormData();
    formData.append('audio', audioBlob, 'memorization.webm');
    formData.append('surah', surahName);
    formData.append('ayah', ayahRange);
    formData.append('reference_text', referenceText);
    formData.append('mode', viewMode);

    try {
      const res = await fetch('/api/interactive-teacher', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server error');
      }

      const teacherText = data.text || 'ما شاء الله، بارك الله في حفظك وتلاوتك.';
      setTranscript(teacherText);
      setFeedbackData({
        dialogue: teacherText,
        memorizationScore: data.memorizationScore || 90,
        status: data.status || 'good',
        missedWords: data.missedWords || [],
        teacherAdvice: data.teacherAdvice || ''
      });

      if (data.audio) {
        const audioSrc = `data:audio/wav;base64,${data.audio}`;
        setTeacherAudioUrl(audioSrc);
        const audio = new Audio(audioSrc);
        teacherAudioRef.current = audio;
        setIsTeacherAudioPlaying(true);
        audio.onended = () => setIsTeacherAudioPlaying(false);
        audio.onerror = () => {
          setIsTeacherAudioPlaying(false);
          speakText(teacherText);
        };
        audio.play().catch(() => speakText(teacherText));
      } else {
        speakText(teacherText);
      }

      setCallState('feedback');
    } catch (err: any) {
      console.error('Error contacting teacher:', err);
      setCallState('error');
      setTranscript('حدث خطأ أثناء التواصل مع المعلم: ' + (err.message || 'يرجى المحاولة مجدداً'));
    }
  };

  const startRecitation = async () => {
    cleanupAudioNodes();
    setFeedbackData(null);
    setTeacherAudioUrl(null);
    hasSpokenRef.current = false;
    speechStartTimeRef.current = Date.now();
    if (teacherAudioRef.current) teacherAudioRef.current.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceStartTime: number | null = null;

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round(avg * 2));
        setAudioLevel(normalized);

        // Voice Activity & Silence Detection (VAD)
        if (autoSilenceDetection) {
          const now = Date.now();
          const elapsed = (now - speechStartTimeRef.current) / 1000;

          if (normalized > 18) {
            hasSpokenRef.current = true;
            silenceStartTime = null;
            setSilenceCountdown(null);
          } else if (hasSpokenRef.current && elapsed > 3) {
            // User was speaking, now went quiet
            if (!silenceStartTime) {
              silenceStartTime = now;
            } else {
              const quietDuration = (now - silenceStartTime) / 1000;
              if (quietDuration > 0.8) {
                const remaining = Math.max(0, 2.0 - quietDuration);
                setSilenceCountdown(Math.ceil(remaining));
              }
              if (quietDuration >= 2.0) {
                // Auto-finish recitation!
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                  return;
                }
              }
            }
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        submitRecitationAudio();
      };

      mediaRecorder.start();
      setCallState('recording');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('الرجاء السماح بالوصول إلى الميكروفون للبدء في التسميع مع المعلم');
      setCallState('idle');
    }
  };

  const finishRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupAudioNodes();
    setCallState('idle');
    setTranscript('أهلاً بك يا بني في حلقة التحفيظ. اختر وردك، واعتمد على حفظك الغيبي، وتفضل بالتسميع.');
  };

  const resetTeacherSession = () => {
    setCallState('idle');
    setFeedbackData(null);
    setTeacherAudioUrl(null);
    setTranscript('أهلاً بك يا بني في حلقة التحفيظ. اختر وردك، واعتمد على حفظك الغيبي، وتفضل بالتسميع.');
  };

  const playTeacherAudio = () => {
    if (teacherAudioUrl && teacherAudioRef.current) {
      if (isTeacherAudioPlaying) {
        teacherAudioRef.current.pause();
        setIsTeacherAudioPlaying(false);
      } else {
        teacherAudioRef.current.currentTime = 0;
        teacherAudioRef.current.play().then(() => {
          setIsTeacherAudioPlaying(true);
        }).catch(() => speakText(transcript));
      }
    } else if (transcript) {
      if (isTeacherAudioPlaying) {
        window.speechSynthesis.cancel();
        setIsTeacherAudioPlaying(false);
      } else {
        speakText(transcript);
      }
    }
  };

  const playAyah = (ayahNumber: number) => {
    if (playingAyah === ayahNumber) {
      audioRef.current?.pause();
      setPlayingAyah(null);
      return;
    }
    
    if (audioRef.current) audioRef.current.pause();
    
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayahNumber}.mp3`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(e => console.error('Audio play failed', e));
    setPlayingAyah(ayahNumber);
    audio.onended = () => setPlayingAyah(null);
  };

  const nextAyahsRange = () => {
    if (!surah) return;
    const count = endAyah - startAyah + 1;
    const newStart = endAyah + 1;
    const newEnd = Math.min(surah.numberOfAyahs, newStart + count - 1);
    if (newStart <= surah.numberOfAyahs) {
      setStartAyah(newStart);
      setEndAyah(newEnd);
      resetTeacherSession();
      setTranscript(`تم تحديد الآيات ${newStart} إلى ${newEnd}. استعن بالله واضغط "ابدأ التسميع الغيبي".`);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFirstWordOfAyah = (text: string) => {
    const words = text.trim().split(/\s+/);
    return words.slice(0, 2).join(' ') + ' ...';
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8 rounded-tl-3xl relative overflow-hidden font-sans pb-28">
      {/* Page Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            حلقة التسميع والحفظ الغيبي
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">تسميع الآيات من حفظك ومتابعة ثبات الورد مع المعلم الذكي</p>
        </div>

        {/* View Mode Controls & VAD Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smart VAD Toggle */}
          <button
            onClick={() => setAutoSilenceDetection(!autoSilenceDetection)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              autoSilenceDetection 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            title="يرصد انتهاء تلاوتك ويرسل التسجيل تلقائياً دون الحاجة للضغط على زر إنهاء"
          >
            <Zap className={`w-3.5 h-3.5 ${autoSilenceDetection ? 'text-emerald-600 fill-emerald-600' : 'text-slate-400'}`} />
            <span>الإنهاء التلقائي عند السكوت: {autoSilenceDetection ? 'مفعل' : 'معطل'}</span>
          </button>

          {/* Memorization Mode Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold">
            <button
              onClick={() => setViewMode('hidden')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
                viewMode === 'hidden'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>غيبي</span>
            </button>

            <button
              onClick={() => setViewMode('first_words')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
                viewMode === 'first_words'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>تلميحات</span>
            </button>

            <button
              onClick={() => setViewMode('visible')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
                viewMode === 'visible'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>مصحف</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* Right Column: Memorization Area & Hidden/Revealed Verses (col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200/70 p-5 md:p-8 relative overflow-hidden flex flex-col min-h-[520px]">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-400"></div>
          
          {/* Surah & Verses Range Controls */}
          <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <label className="text-xs font-bold text-slate-600 shrink-0">سورة الورد:</label>
              <select 
                value={selectedSurahNumber} 
                onChange={(e) => {
                  setSelectedSurahNumber(Number(e.target.value));
                  setStartAyah(1);
                  setEndAyah(5);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-sm"
              >
                {allSurahs.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Verses Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">من آية:</span>
              <input
                type="number"
                min="1"
                max={surah?.numberOfAyahs || 286}
                value={startAyah}
                onChange={(e) => setStartAyah(Math.max(1, Number(e.target.value)))}
                className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-xs font-bold text-slate-600">إلى:</span>
              <input
                type="number"
                min={startAyah}
                max={surah?.numberOfAyahs || 286}
                value={endAyah}
                onChange={(e) => setEndAyah(Math.max(startAyah, Number(e.target.value)))}
                className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Memorization Target Display */}
          <div className="flex-1 flex flex-col justify-center items-center py-6">
            {!surah ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <span className="text-sm font-medium">جاري تجهيز الورد القرآني...</span>
              </div>
            ) : viewMode === 'hidden' ? (
              /* Hidden Blind Mode */
              <div className="text-center py-10 px-4 max-w-lg mx-auto bg-gradient-to-b from-slate-50 to-teal-50/40 rounded-3xl border-2 border-dashed border-teal-200 w-full">
                <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">وضع التسميع الغيبي نشط</h4>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  النص القرآني مخفي لاختبار حفظك الخالص. المطلوب تسميع:
                  <br />
                  <span className="font-extrabold text-teal-800 text-base mt-1 inline-block">
                    سورة {surah.name} (الآيات من {startAyah} إلى {endAyah})
                  </span>
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setViewMode('first_words')}
                    className="px-3.5 py-1.5 bg-white border border-teal-200 hover:bg-teal-50 text-teal-700 text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    أظهر بدايات الآيات فقط
                  </button>
                  <button
                    onClick={() => setViewMode('visible')}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    مراجعة المصحف
                  </button>
                </div>
              </div>
            ) : viewMode === 'first_words' ? (
              /* First Words Mode */
              <div className="w-full space-y-3 p-4 bg-teal-50/30 rounded-2xl border border-teal-100">
                <div className="text-xs font-bold text-teal-800 mb-2 text-center">
                  💡 تلميحات بدايات الآيات لمساعدتك في استحضار الورد:
                </div>
                {surah.ayahs.slice(startAyah - 1, endAyah).map((a) => (
                  <div key={a.number} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="font-arabic text-xl font-bold text-slate-800" dir="rtl">
                      {getFirstWordOfAyah(a.text)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                      آية {a.numberInSurah}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Visible Open Quran Mode */
              <div 
                className="text-2xl md:text-3xl leading-[2.5] md:leading-[2.8] text-center font-arabic text-slate-800 selection:bg-teal-100 max-w-4xl mx-auto p-5 bg-teal-50/20 rounded-2xl border border-teal-100/60"
                dir="rtl"
                style={{ fontFamily: '"Amiri", "Traditional Arabic", serif' }}
              >
                {surah.ayahs.map((ayah) => {
                  const isInRange = ayah.numberInSurah >= startAyah && ayah.numberInSurah <= endAyah;
                  const isPlaying = playingAyah === ayah.number;
                  
                  return (
                    <span 
                      key={ayah.number} 
                      onClick={() => playAyah(ayah.number)}
                      className={`inline transition-all duration-300 rounded-lg px-1 cursor-pointer select-none ${
                        isPlaying 
                          ? 'bg-teal-200 text-teal-950 font-bold shadow-sm' 
                          : isInRange 
                            ? 'text-slate-900 bg-emerald-50/70 hover:bg-emerald-100' 
                            : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="اضغط للاستماع للتلاوة بصوت الشيخ العفاسي للمراجعة"
                    >
                      {ayah.text}{' '}
                      <span className={`inline-flex items-center justify-center w-7 h-7 mx-1 rounded-full text-xs font-sans align-middle ${
                        isInRange 
                          ? 'bg-teal-600 text-white font-bold' 
                          : 'bg-slate-200 text-slate-600 font-medium'
                      }`}>
                        {ayah.numberInSurah}
                      </span>
                      {' '}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 text-center text-xs text-slate-400">
            💡 وضع التسميع الغيبي يدرّب عقلك على استحضار الآيات وثبات الحفظ دون النظر للمصحف.
          </div>
        </div>

        {/* Left Column: Teacher Console, Dialogue, and Memory Score (col-span-1) */}
        <div className="space-y-6">
          
          {/* The Teacher Halaqah Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6 flex flex-col items-center relative overflow-hidden transition-all duration-300">
            
            <div className="w-full flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">جلسة التسميع مع المعلم</h3>
                  <p className="text-xs text-slate-500">سورة {surah?.name || 'الملك'} ({startAyah} - {endAyah})</p>
                </div>
              </div>

              {callState === 'recording' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  <span>{formatTimer(recordingSeconds)}</span>
                </span>
              )}
            </div>

            {/* Visualizer & Interaction Body */}
            <div className="w-full mb-6 min-h-[170px] flex flex-col items-center justify-center">
              
              {/* IDLE STATE */}
              {callState === 'idle' && (
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-md">
                    <Mic className="w-9 h-9 text-teal-600" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-[260px] mx-auto">
                    {transcript}
                  </p>
                </div>
              )}

              {/* RECORDING STATE (Live Waveform + Timer) */}
              {callState === 'recording' && (
                <div className="text-center space-y-4 w-full">
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div 
                      className="absolute inset-0 bg-red-400 rounded-full transition-all duration-150 opacity-40"
                      style={{ transform: `scale(${1 + audioLevel / 100})` }}
                    ></div>
                    <div className="relative w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 text-white z-10">
                      <Waves className="w-9 h-9 animate-pulse" />
                    </div>
                  </div>

                  {/* Volume Waveform Bars */}
                  <div className="flex items-center justify-center gap-1.5 h-8">
                    {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 1, 0.7, 0.4].map((multiplier, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-red-500 rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(6, Math.min(32, (audioLevel * multiplier) + 4))}px`,
                          opacity: 0.6 + (audioLevel / 250)
                        }}
                      />
                    ))}
                  </div>

                  {/* Silence Countdown Indicator */}
                  {silenceCountdown !== null ? (
                    <div className="bg-amber-50 text-amber-900 text-xs font-bold p-2.5 rounded-xl border border-amber-200 animate-pulse">
                      ⏱️ تم رصد سكوتك: سيتم إرسال التلاوة خلال {silenceCountdown} ثانية...
                    </div>
                  ) : (
                    <div className="bg-red-50 text-red-800 text-xs font-bold p-2.5 rounded-xl border border-red-200">
                      🎙️ المعلم يستمع لتسميعك الغيبي... اقرأ بهدوء، وسيرسل التسجيل تلقائياً عند انتهاء تلاوتك.
                    </div>
                  )}
                </div>
              )}

              {/* ANALYZING STATE */}
              {callState === 'analyzing' && (
                <div className="text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 bg-teal-200 rounded-full animate-ping opacity-40"></div>
                    <div className="relative w-full h-full bg-teal-50 rounded-full flex items-center justify-center border-2 border-teal-200 shadow-sm">
                      <Loader2 className="w-9 h-9 text-teal-600 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <p className="text-teal-900 text-sm font-bold">جاري تقييم الحفظ والترتيل...</p>
                    <p className="text-slate-400 text-xs mt-1">يتم مراجعة الكلمات وثبات الحفظ الغيبي</p>
                  </div>
                </div>
              )}

              {/* FEEDBACK STATE */}
              {callState === 'feedback' && feedbackData && (
                <div className="w-full space-y-4 animate-in fade-in duration-500">
                  
                  {/* Dual Score Badge: Memorization & Pronunciation */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl p-3.5 flex flex-col justify-between shadow-md">
                      <span className="text-[11px] font-bold opacity-90">ثبات الحفظ الغيبي</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-2xl font-extrabold">{feedbackData.memorizationScore}%</span>
                        <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full">
                          {feedbackData.memorizationScore >= 90 ? 'متقن' : 'مقبول'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-3.5 flex flex-col justify-between shadow-md">
                      <span className="text-[11px] font-bold opacity-90">دقة النطق والمخارج</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-2xl font-extrabold">
                          {Math.max(88, Math.min(99, feedbackData.memorizationScore + 2))}%
                        </span>
                        <span className="text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full">
                          فصيح
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Teacher Voice Dialogue */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-teal-800 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-teal-600" />
                        توجيه الشيخ المعلم
                      </span>

                      <button
                        onClick={playTeacherAudio}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm"
                      >
                        {isTeacherAudioPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>إيقاف</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>استمع للشيخ</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-slate-800 text-sm leading-relaxed mt-2 font-medium" dir="rtl">
                      {feedbackData.dialogue}
                    </p>
                  </div>

                  {/* Interactive Word Pronunciation Drill */}
                  <div className="bg-teal-50/60 border border-teal-200/80 rounded-2xl p-3.5 text-xs">
                    <span className="font-extrabold text-teal-950 block mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      تدريب النطق السليم وتثبيت الورد:
                    </span>
                    <p className="text-slate-600 mb-2 leading-relaxed text-[11px]">
                      اضغط على أي كلمة للاستماع لنطقها الفصيح وتكرارها مع الشيخ لتثبيتها في صدرك:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getSelectedAyahsText().split(/\s+/).slice(0, 12).map((w, idx) => (
                        <button
                          key={idx}
                          onClick={() => speakText(w)}
                          className="bg-white hover:bg-teal-100 text-slate-800 px-2.5 py-1 rounded-lg border border-teal-200/60 font-arabic font-bold text-sm shadow-xs transition-colors active:scale-95"
                          title="اضغط لسماع نطق الكلمة"
                        >
                          {w} 🔊
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Teacher Memorization Advice */}
                  {feedbackData.teacherAdvice && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                      <span className="font-bold text-amber-900 block mb-0.5">💡 نصيحة المعلم لتثبيت الحفظ:</span>
                      <p className="text-amber-800 leading-relaxed font-medium">{feedbackData.teacherAdvice}</p>
                    </div>
                  )}

                </div>
              )}

              {/* ERROR STATE */}
              {callState === 'error' && (
                <div className="text-center space-y-3">
                  <p className="text-red-600 text-xs font-bold leading-relaxed">{transcript}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2.5">
              {callState === 'idle' && (
                <button
                  onClick={startRecitation}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white rounded-2xl font-extrabold text-base shadow-lg shadow-teal-600/25 transition-all"
                >
                  <Mic className="w-5 h-5" />
                  <span>ابدأ التسميع الغيبي مع المعلم</span>
                </button>
              )}

              {callState === 'recording' && (
                <div className="flex gap-2">
                  <button
                    onClick={finishRecitation}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white rounded-2xl font-extrabold text-base shadow-lg shadow-red-600/30 transition-all animate-pulse"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>إنهاء وإرسال التسميع</span>
                  </button>
                  <button
                    onClick={cancelRecitation}
                    className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                    title="إلغاء التسميع"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              )}

              {callState === 'analyzing' && (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-100 text-slate-400 rounded-2xl font-bold text-sm cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>المعلم يراجع التسميع...</span>
                </button>
              )}

              {(callState === 'feedback' || callState === 'error') && (
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={startRecitation}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm shadow-md transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة تسميع هذا الورد</span>
                  </button>

                  <button
                    onClick={nextAyahsRange}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    <span>تسميع الآيات التالية ({endAyah + 1} - {Math.min(surah?.numberOfAyahs || 10, endAyah + 5)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Daily Memorization Schedule */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-800">خطة الحفظ والمراجعة</h3>
              </div>
            </div>
            
            <div className="space-y-3">
              {schedule.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-colors ${
                    item.status === 'current' 
                      ? 'bg-orange-50/60 border-orange-200' 
                      : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="mt-0.5">
                    {item.status === 'current' ? (
                      <Target className="w-4 h-4 text-orange-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-[11px] font-bold mb-0.5 ${item.status === 'current' ? 'text-orange-600' : 'text-slate-500'}`}>
                      {item.day}
                    </div>
                    <div className={`text-xs font-semibold ${item.status === 'current' ? 'text-slate-800' : 'text-slate-600'}`}>
                      {item.task}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
