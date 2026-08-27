import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, 
  MessageCircleHeart, 
  Waves, 
  PhoneOff, 
  PhoneCall, 
  BookOpen, 
  Calendar, 
  Target, 
  Clock, 
  Mic, 
  Square, 
  RotateCcw, 
  Volume2,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  ArrowRight,
  Sparkles
} from 'lucide-react';

type CallState = 'idle' | 'recording' | 'analyzing' | 'feedback' | 'error';

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

interface TajweedResult {
  surah: string;
  ayah: string;
  score: number;
  words: TajweedWord[];
}

export default function InteractiveTeacher() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState<string>('مستعد للبدء في التسميع معك. اختر السورة والآيات ثم اضغط "ابدأ التسميع".');
  
  const [surah, setSurah] = useState<Surah | null>(null);
  const [allSurahs, setAllSurahs] = useState<{number: number, name: string}[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(67); // Surah Al-Mulk by default
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(5);
  
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [schedule, setSchedule] = useState([
    { day: 'اليوم', task: 'سورة الملك - الآيات 1 إلى 5', status: 'current' },
    { day: 'غداً', task: 'سورة الملك - الآيات 6 إلى 10', status: 'upcoming' }
  ]);
  const [scheduleDay, setScheduleDay] = useState<string>('غداً');

  // Audio Recording & Analysis State
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
  const [tajweedResult, setTajweedResult] = useState<TajweedResult | null>(null);

  // Fetch Surah list
  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setAllSurahs(data.data);
        }
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
        }
      })
      .catch(err => console.error("Error fetching surah details:", err));
  }, [selectedSurahNumber]);

  // Clean up streams & audio nodes on unmount
  useEffect(() => {
    return () => {
      cleanupAudioNodes();
      if (teacherAudioRef.current) {
        teacherAudioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cleanupAudioNodes = () => {
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
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  };

  // Helper to get selected ayahs reference text
  const getSelectedAyahsText = () => {
    if (!surah || !surah.ayahs) return '';
    const sliceStart = Math.max(0, startAyah - 1);
    const sliceEnd = Math.min(surah.ayahs.length, endAyah);
    return surah.ayahs.slice(sliceStart, sliceEnd).map(a => a.text).join(' ');
  };

  // Speech synthesis fallback
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.92;
      utterance.onend = () => setIsTeacherAudioPlaying(false);
      utterance.onerror = () => setIsTeacherAudioPlaying(false);
      setIsTeacherAudioPlaying(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Start voice recitation session
  const startRecitation = async () => {
    cleanupAudioNodes();
    setTajweedResult(null);
    setTeacherAudioUrl(null);
    if (teacherAudioRef.current) {
      teacherAudioRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Audio visualizer setup
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

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round(avg * 2)));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        cleanupAudioNodes();
        setCallState('analyzing');
        setTranscript('المعلم يستمع لتسجيلك ويحلل التلاوة وأحكام التجويد...');

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const referenceText = getSelectedAyahsText();
        const surahName = surah ? surah.name : 'سورة الملك';
        const ayahRange = `${startAyah} إلى ${endAyah}`;

        // 1. Send to Interactive Teacher endpoint
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recitation.webm');
        formData.append('surah', surahName);
        formData.append('ayah', ayahRange);
        formData.append('reference_text', referenceText);

        try {
          // Parallel call: Interactive Teacher feedback + Tajweed analysis
          const [teacherRes, tajweedRes] = await Promise.allSettled([
            fetch('/api/interactive-teacher', { method: 'POST', body: formData }),
            fetch('/api/analyze-tajweed', { method: 'POST', body: formData })
          ]);

          let teacherText = 'ما شاء الله، بارك الله في تلاوتك وصوتك العذب.';
          let teacherAudioSrc: string | null = null;

          if (teacherRes.status === 'fulfilled' && teacherRes.value.ok) {
            const tData = await teacherRes.value.json();
            if (tData.text) teacherText = tData.text;
            if (tData.audio) {
              teacherAudioSrc = `data:audio/wav;base64,${tData.audio}`;
            }
          }

          if (tajweedRes.status === 'fulfilled' && tajweedRes.value.ok) {
            const tajData = await tajweedRes.value.json();
            if (!tajData.error) {
              setTajweedResult(tajData);
            }
          }

          setTranscript(teacherText);
          setTeacherAudioUrl(teacherAudioSrc);
          setCallState('feedback');

          // Play Audio Voice
          if (teacherAudioSrc) {
            const audio = new Audio(teacherAudioSrc);
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

        } catch (err: any) {
          console.error('Error contacting teacher:', err);
          setCallState('error');
          setTranscript('حدث خطأ أثناء التواصل مع المعلم. يرجى المحاولة مرة أخرى.');
        }
      };

      mediaRecorder.start();
      setCallState('recording');
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('الرجاء السماح بالوصول إلى الميكروفون لبدء التسميع مع المعلم');
      setCallState('idle');
    }
  };

  // Finish recitation & submit for grading
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
    setTranscript('مستعد للبدء في التسميع معك. اختر السورة والآيات ثم اضغط "ابدأ التسميع".');
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
        }).catch(() => {
          speakText(transcript);
        });
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
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayahNumber}.mp3`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(e => console.error('Audio play failed', e));
    setPlayingAyah(ayahNumber);
    
    audio.onended = () => {
      setPlayingAyah(null);
    };
  };

  const addToSchedule = () => {
    if (!surah) return;
    setSchedule(prev => [...prev, {
      day: scheduleDay,
      task: `سورة ${surah.name} - الآيات ${startAyah} إلى ${endAyah}`,
      status: 'upcoming'
    }]);
  };

  const nextAyahsRange = () => {
    if (!surah) return;
    const count = endAyah - startAyah + 1;
    const newStart = endAyah + 1;
    const newEnd = Math.min(surah.numberOfAyahs, newStart + count - 1);
    if (newStart <= surah.numberOfAyahs) {
      setStartAyah(newStart);
      setEndAyah(newEnd);
      setCallState('idle');
      setTajweedResult(null);
      setTranscript(`تم تحديد الآيات ${newStart} إلى ${newEnd}. اضغط "ابدأ التسميع" لتسميع المقطع الجديد.`);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8 rounded-tl-3xl relative overflow-hidden font-sans pb-28">
      {/* Background decor */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col h-full">
        
        {/* Page Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              المعلم التفاعلي الذكي
            </h2>
            <p className="text-slate-500 mt-1 text-sm md:text-base">تسميع صوتي مباشر وتصحيح فوري لأحكام التجويد ومخارج الحروف</p>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-2xl text-xs md:text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>محرك التجويد المتطور: اتصال مباشر وفحص دقيق للآيات</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
          
          {/* Right Column: Quran Text & Verses Range (col-span-2) */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200/70 p-5 md:p-8 relative overflow-hidden flex flex-col min-h-[520px]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-blue-500"></div>
            
            {/* Surah & Ayah Selectors */}
            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <label className="text-xs font-bold text-slate-600 shrink-0">السورة الكريمة:</label>
                <select 
                  value={selectedSurahNumber} 
                  onChange={(e) => {
                    setSelectedSurahNumber(Number(e.target.value));
                    setStartAyah(1);
                    setEndAyah(5);
                    setCallState('idle');
                    setTajweedResult(null);
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

            {/* Schedule Plan Adder */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 text-xs md:text-sm">
              <div className="text-slate-500">
                المقطع المحدد للتسميع: <span className="font-bold text-teal-700">سورة {surah?.name || '...'} (الآيات {startAyah} إلى {endAyah})</span>
              </div>
              <button
                onClick={addToSchedule}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-xl font-bold transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>إضافة لجدول الحفظ</span>
              </button>
            </div>

            {/* Quran Text View */}
            <div className="flex-1 flex flex-col justify-center">
              {!surah ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                  <span className="text-sm font-medium">جاري تحميل الآيات الكريمة...</span>
                </div>
              ) : (
                <div 
                  className="text-2xl md:text-3xl leading-[2.5] md:leading-[2.8] text-center font-arabic text-slate-800 selection:bg-teal-100 max-w-4xl mx-auto p-4 bg-teal-50/20 rounded-2xl border border-teal-100/60"
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
                        title="اضغط للاستماع للتلاوة بصوت الشيخ مشاري العفاسي"
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

            <div className="mt-6 text-center text-xs text-slate-400">
              💡 اضغط على أي آية للاستماع إليها بصوت الشيخ مشاري راشد العفاسي للتعلم قبل التسميع.
            </div>
          </div>

          {/* Left Column: The Interactive Teacher Console & Schedule (col-span-1) */}
          <div className="space-y-6">
            
            {/* Main Interactive Teacher Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6 flex flex-col items-center relative overflow-hidden transition-all duration-300">
              
              <div className="w-full flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                    <MessageCircleHeart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">جلسة التسميع مع المعلم</h3>
                    <p className="text-xs text-slate-500">سورة {surah?.name || 'الملك'} (آية {startAyah}-{endAyah})</p>
                  </div>
                </div>

                {callState === 'recording' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    <span>{formatTimer(recordingSeconds)}</span>
                  </span>
                )}
              </div>

              {/* Status & Visualizer Area */}
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

                    {/* Animated Volume Waveform Bars */}
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

                    <div className="bg-red-50 text-red-800 text-xs font-bold p-2.5 rounded-xl border border-red-200">
                      🎙️ المعلم يستمع لتلاوتك الآن بإنصات... اقرأ الآيات بهدوء، وعند الانتهاء اضغط الزر الأحمر أدناه.
                    </div>
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
                      <p className="text-teal-900 text-sm font-bold">جاري مراجعة التلاوة وتدقيق التجويد...</p>
                      <p className="text-slate-400 text-xs mt-1">يتم فحص مخارج الحروف وأحكام التجويد بدقة</p>
                    </div>
                  </div>
                )}

                {/* FEEDBACK STATE */}
                {callState === 'feedback' && (
                  <div className="w-full space-y-4 animate-in fade-in duration-500">
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-4 relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          توجيه المعلم الصوتي
                        </span>

                        <button
                          onClick={playTeacherAudio}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm"
                        >
                          {isTeacherAudioPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>إيقاف الصوت</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>استمع للتوجيه</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-slate-800 text-sm leading-relaxed mt-2 font-medium" dir="rtl">
                        {transcript}
                      </p>
                    </div>

                    {/* Word-by-word Tajweed accuracy breakdown */}
                    {tajweedResult && (
                      <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>دقة أحكام التجويد:</span>
                          <span className="text-teal-600 text-base font-extrabold">{tajweedResult.score}%</span>
                        </div>

                        {tajweedResult.words && tajweedResult.words.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1" dir="rtl">
                            {tajweedResult.words.map((w, idx) => (
                              <span
                                key={idx}
                                className={`text-xs px-2 py-1 rounded-md font-arabic font-bold transition-colors cursor-help ${
                                  w.status === 'correct'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                    : 'bg-red-100 text-red-900 border border-red-300 underline decoration-red-400'
                                }`}
                                title={`${w.rule ? `الحكم: ${w.rule}` : ''}${w.suggestion ? ` - ${w.suggestion}` : ''}`}
                              >
                                {w.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ERROR STATE */}
                {callState === 'error' && (
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border-2 border-red-100">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
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
                    <span>ابدأ التسميع الصوتي مع المعلم</span>
                  </button>
                )}

                {callState === 'recording' && (
                  <div className="flex gap-2">
                    <button
                      onClick={finishRecitation}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white rounded-2xl font-extrabold text-base shadow-lg shadow-red-600/30 transition-all animate-pulse"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      <span>إرسال التلاوة للتصحيح</span>
                    </button>
                    <button
                      onClick={cancelRecitation}
                      className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                      title="إلغاء التسجيل"
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
                    <span>المعلم يفحص التلاوة...</span>
                  </button>
                )}

                {(callState === 'feedback' || callState === 'error') && (
                  <div className="flex flex-col gap-2 w-full">
                    <button
                      onClick={startRecitation}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm shadow-md transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>إعادة تسميع هذا المقطع</span>
                    </button>

                    <button
                      onClick={nextAyahsRange}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                    >
                      <span>الانتقال للمقطع التالي</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">جدول الحفظ والمراجعة</h3>
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
    </div>
  );
}
