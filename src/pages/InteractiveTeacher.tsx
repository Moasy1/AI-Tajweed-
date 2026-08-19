import React, { useState, useRef, useEffect } from 'react';
import { MicOff, Loader2, MessageCircleHeart, Waves, PhoneOff, PhoneCall, BookOpen, Calendar, Target, Clock, Mic, Square, RotateCcw, Activity } from 'lucide-react';

type CallState = 'idle' | 'connecting' | 'connected' | 'error';

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface Surah {
  number: number;
  name: string;
  ayahs: Ayah[];
}

export default function InteractiveTeacher() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState<string>('مستعد للبدء في القراءة؟');
  
  const [surah, setSurah] = useState<Surah | null>(null);
  const [allSurahs, setAllSurahs] = useState<{number: number, name: string}[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(67);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [schedule, setSchedule] = useState([
    { day: 'اليوم', task: 'سورة الملك - الآيات 1 إلى 5', status: 'current' }
  ]);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(5);
  const [scheduleDay, setScheduleDay] = useState<string>('غداً');
  
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const [analysisState, setAnalysisState] = useState<'idle' | 'recording' | 'analyzing' | 'completed'>('idle');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startAnalysis = async () => {
    setAnalysisState('recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setAnalysisState('analyzing');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'user_audio.webm');
        
        try {
          const response = await fetch('/api/analyze-tajweed', {
            method: 'POST',
            body: formData,
          });
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error('Failed to parse JSON:', text.substring(0, 100));
            throw new Error(response.ok ? 'Invalid JSON response' : 'Server error');
          }
          if (data.error) {
            throw new Error(data.error);
          }
          setAnalysisResult(data);
          setAnalysisState('completed');
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             const score = data.score || 0;
             const mistakes = (data.words || []).filter((w: any) => w.status !== 'correct').map((w: any) => w.text).join(', ');
             const textToSend = `الطالب قام للتو باختبار قراءته وحصل على تقييم ${score}% في الدقة.${mistakes ? ` الكلمات التي تحتاج تحسين: ${mistakes}.` : ' التلاوة ممتازة.'} شجعه أو قدم له نصيحة قصيرة.`;
             wsRef.current.send(JSON.stringify({ text: textToSend }));
          }
        } catch (error: any) {
          console.error('Error analyzing:', error);
          alert('حدث خطأ أثناء التحليل: ' + error.message);
          setAnalysisState('idle');
        }
      };

      mediaRecorder.start();
    } catch (e) {
      alert("الرجاء السماح بالوصول للميكروفون");
      setAnalysisState('idle');
    }
  };

  const stopAnalysis = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  const resetAnalysis = () => {
    setAnalysisState('idle');
    setAnalysisResult(null);
  };
  
  const getAccuracyColor = (accuracy: string) => {
    switch(accuracy) {
      case 'correct': return 'text-blue-600 bg-blue-50/50';
      case 'good': return 'text-green-600 bg-green-50/50';
      case 'close': return 'text-yellow-600 bg-yellow-50/50 underline decoration-yellow-300 decoration-wavy';
      case 'error': return 'text-red-600 bg-red-50/50 underline decoration-red-300 decoration-wavy';
      default: return 'text-slate-800';
    }
  };

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => {
        setAllSurahs(data.data);
      })
      .catch(err => console.error("Error fetching all surahs", err));
  }, []);

  useEffect(() => {
    setSurah(null);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurahNumber}`)
      .then(res => res.json())
      .then(data => {
        setSurah(data.data);
      })
      .catch(err => console.error("Error fetching surah details", err));
  }, [selectedSurahNumber]);

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

  const cleanup = () => {
    if (processorRef.current && inputAudioCtxRef.current) {
      processorRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(console.error);
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(console.error);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    wsRef.current = null;
    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
    streamRef.current = null;
    processorRef.current = null;
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const pcmToBase64 = (f32Array: Float32Array) => {
    let l = f32Array.length;
    let i16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        let s = Math.max(-1, Math.min(1, f32Array[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const bytes = new Uint8Array(i16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const [teacherAudioUrl, setTeacherAudioUrl] = useState<string | null>(null);
  const teacherAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);

  // Function to play text using browser speech synthesis if audio buffer not available
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Direct Voice Recording Mode (Universal — works on Vercel, Mobile, iOS, Desktop)
  const startVoiceRecording = async () => {
    setCallState('connecting');
    setTranscript('جاري الاستماع لتلاوتك... تفضل بالقراءة');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      voiceRecorderRef.current = mediaRecorder;
      voiceChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setCallState('connecting');
        setTranscript('المعلم يستمع ويجهز الملاحظات والتوجيه الصوتي...');
        
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'teacher_voice.webm');

        try {
          const res = await fetch('/api/interactive-teacher', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (data.error) {
            throw new Error(data.error);
          }

          setCallState('connected');
          setTranscript(data.text || 'أحسنت بارك الله فيك.');

          if (data.audio) {
            const audioSrc = `data:audio/wav;base64,${data.audio}`;
            setTeacherAudioUrl(audioSrc);
            const audio = new Audio(audioSrc);
            teacherAudioRef.current = audio;
            audio.play().catch(() => {
              speakText(data.text);
            });
          } else if (data.text) {
            speakText(data.text);
          }
        } catch (err: any) {
          console.error('Teacher response error:', err);
          setCallState('error');
          setTranscript('حدث خطأ أثناء التواصل مع المعلم. يرجى المحاولة مرة أخرى.');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Mic access error', err);
      alert('الرجاء السماح بالوصول للميكروفون للتحدث مع المعلم');
      setCallState('idle');
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state === 'recording') {
      voiceRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const startCall = async () => {
    // Check if WebSocket is available, otherwise seamlessly use Voice Recording
    if (window.location.hostname.includes('vercel.app')) {
      await startVoiceRecording();
      return;
    }

    setCallState('connecting');
    setTranscript('جاري الاتصال بالمعلم...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const planStr = schedule.map(s => `${s.day}: ${s.task}`).join(' | ');
      const focusStr = surah ? `سورة ${surah.name}` : '';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live?plan=${encodeURIComponent(planStr)}&focus=${encodeURIComponent(focusStr)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputAudioCtx;
      
      const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputAudioCtx;

      ws.onopen = () => {
        setCallState('connected');
        setTranscript('المكالمة متصلة. يمكنك البدء في القراءة والتحدث مع المعلم براحة.');
        
        const source = inputAudioCtx.createMediaStreamSource(stream);
        const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(inputAudioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.interrupted) {
          nextStartTimeRef.current = 0;
        }
        if (msg.audio) {
          const binaryString = atob(msg.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          const buffer = bytes.buffer;
          const view = new Int16Array(buffer);
          
          if (!outputAudioCtxRef.current) return;
          const audioBuffer = outputAudioCtxRef.current.createBuffer(1, view.length, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < view.length; i++) {
              channelData[i] = view[i] / 32768;
          }
          const source = outputAudioCtxRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputAudioCtxRef.current.destination);
          
          const currentTime = outputAudioCtxRef.current.currentTime;
          if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
          }
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
        }
      };

      ws.onerror = () => {
        console.warn("WebSocket unavailable, switching to Voice Recording mode.");
        cleanup();
        // Fallback to voice recording mode
        startVoiceRecording();
      };
      
      ws.onclose = () => {
        if (callState === 'connected') {
           setCallState('idle');
           setTranscript('تم إنهاء المكالمة.');
        }
        cleanup();
      };

    } catch (e) {
      console.error("Call setup failed", e);
      // Fallback
      startVoiceRecording();
    }
  };

  const endCall = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state === 'recording') {
      stopVoiceRecording();
      return;
    }
    if (teacherAudioRef.current) {
      teacherAudioRef.current.pause();
    }
    setCallState('idle');
    setTranscript('مستعد لجلسة تسميع جديدة.');
    cleanup();
  };

  const addToSchedule = () => {
    if (!surah) return;
    setSchedule(prev => [...prev, {
      day: scheduleDay,
      task: `سورة ${surah.name} - الآيات ${startAyah} إلى ${endAyah}`,
      status: 'upcoming'
    }]);
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8 rounded-tl-3xl relative overflow-hidden font-sans pb-24">
      {/* Background decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-y-1/3 -translate-x-1/3"></div>

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col h-full">
        
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-teal-600" />
              مساعد التحفيظ الذكي
            </h2>
            <p className="text-slate-500 mt-2 text-lg">خطتك المخصصة للحفظ والتسميع مع المعلم الذكي</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Right Column: Quran Viewer (col-span-2) */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-12 relative overflow-hidden flex flex-col min-h-[500px]">
            {/* Decorative pattern */}
            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-teal-400 to-emerald-500 opacity-20"></div>
            
            <div className="text-center mb-10 flex flex-col items-center">
              <select 
                value={selectedSurahNumber} 
                onChange={(e) => {
                  setSelectedSurahNumber(Number(e.target.value));
                  setStartAyah(1);
                  setEndAyah(5);
                }}
                className="text-2xl md:text-3xl font-bold text-teal-800 font-arabic bg-transparent border-b-2 border-teal-200 focus:outline-none focus:border-teal-500 pb-1 mb-2 text-center cursor-pointer appearance-none px-4"
                dir="rtl"
              >
                {allSurahs.length === 0 && <option value={selectedSurahNumber}>{surah?.name || 'جاري التحميل...'}</option>}
                {allSurahs.map(s => (
                  <option key={s.number} value={s.number}>{s.name}</option>
                ))}
              </select>
              <p className="text-slate-500 mt-2">اضغط على أي آية للاستماع للتلاوة الصحيحة</p>
              
              {surah && (
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-center gap-3">
                  <span className="text-slate-600 text-sm font-bold">إضافة لجدول الحفظ:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">من آية</span>
                    <input type="number" min="1" max={surah.ayahs.length} value={startAyah} onChange={e => setStartAyah(Number(e.target.value))} className="w-16 rounded-md border-slate-300 text-center text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">إلى آية</span>
                    <input type="number" min={startAyah} max={surah.ayahs.length} value={endAyah} onChange={e => setEndAyah(Number(e.target.value))} className="w-16 rounded-md border-slate-300 text-center text-sm" />
                  </div>
                  <select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} className="rounded-md border-slate-300 text-sm px-2 py-1">
                    <option>اليوم</option>
                    <option>غداً</option>
                    <option>بعد غد</option>
                  </select>
                  <button onClick={addToSchedule} className="bg-teal-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-teal-400 transition-colors">
                    إضافة
                  </button>
                </div>
              )}
            </div>

            <div className="font-arabic text-2xl md:text-3xl leading-[3.5rem] md:leading-[4.5rem] text-justify flex-1 overflow-y-auto max-h-[50vh] pr-4" dir="rtl" style={{ fontFamily: '"Amiri", "Traditional Arabic", serif' }}>
              {!surah ? (
                <div className="flex justify-center items-center h-full min-h-[200px]">
                  <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                </div>
              ) : (
                surah.ayahs.map(ayah => (
                  <span 
                    key={ayah.number} 
                    onClick={() => playAyah(ayah.number)}
                    className={`inline cursor-pointer transition-all rounded-lg px-1 md:px-2 ${playingAyah === ayah.number ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200' : 'text-slate-800 hover:bg-slate-50 hover:text-teal-600'}`}
                  >
                    {ayah.text}
                    <span className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border border-teal-300 text-sm md:text-base mx-2 md:mx-3 text-teal-600 bg-teal-50/50">
                      {ayah.numberInSurah}
                    </span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Left Column: Call & Schedule (col-span-1) */}
          <div className="space-y-6">
            
            {/* AI Call Card */}
            <div className={`rounded-3xl shadow-sm border p-6 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 ${
              callState === 'connected' ? 'bg-teal-50 border-teal-200' : 'bg-white border-slate-100'
            }`}>
              <div className="w-full text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                  <MessageCircleHeart className="w-6 h-6 text-teal-500" />
                  المعلم التفاعلي
                </h3>
                <p className="text-sm text-slate-500 mt-2">تسميع وتصحيح مباشر بالصوت</p>
              </div>
              
              <div className="w-full mb-6">
                {callState === 'idle' && (
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-sm transition-transform hover:scale-105">
                      <MicOff className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium min-h-[2.5rem]">
                      {transcript}
                    </p>
                  </div>
                )}

                {callState === 'connecting' && (
                  <div className="text-center space-y-4">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 bg-teal-200 rounded-full animate-ping opacity-50"></div>
                      <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border-2 border-teal-100 shadow-sm">
                        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                      </div>
                    </div>
                    <p className="text-teal-700 text-sm font-bold min-h-[2.5rem]">{transcript}</p>
                  </div>
                )}

                {callState === 'connected' && (
                  <div className="text-center space-y-4 animate-in fade-in duration-700">
                    <div className="relative w-28 h-28 mx-auto">
                      <div className="absolute inset-0 bg-teal-300 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                      <div className="absolute inset-2 bg-teal-300 rounded-full animate-ping opacity-30" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                      
                      <div className="relative w-full h-full bg-teal-500 rounded-full flex items-center justify-center shadow-md border-4 border-white/50 z-10 overflow-hidden">
                        <Waves className="w-10 h-10 text-white animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="min-h-[2.5rem]">
                      <p className="text-teal-800 font-bold">المعلم معك الآن</p>
                      <p className="text-teal-700 text-sm mt-2 leading-relaxed bg-teal-100/50 p-3 rounded-xl border border-teal-200/50">{transcript}</p>
                      {teacherAudioUrl && (
                        <button
                          onClick={() => {
                            if (teacherAudioRef.current) {
                              teacherAudioRef.current.currentTime = 0;
                              teacherAudioRef.current.play().catch(console.error);
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-500 transition-colors shadow-sm"
                        >
                          <Waves className="w-3.5 h-3.5" />
                          إعادة سماع التوجيه الصوتي
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {callState === 'error' && (
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-sm">
                      <PhoneOff className="w-10 h-10 text-red-500" />
                    </div>
                    <p className="text-red-600 text-sm font-bold min-h-[2.5rem]">
                      {transcript}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full">
                {(callState === 'idle' || callState === 'error') ? (
                  <button
                    onClick={startCall}
                    className="w-full group relative flex items-center justify-center gap-3 py-4 bg-teal-500 rounded-xl shadow-[0_4px_0_#0D9488] active:shadow-[0_0px_0_#0D9488] active:translate-y-[4px] transition-all hover:bg-teal-400"
                  >
                    <PhoneCall className="w-6 h-6 text-white" />
                    <span className="font-bold text-white text-lg">ابدأ التسميع مع المعلم</span>
                  </button>
                ) : (
                  <button
                    onClick={endCall}
                    className="w-full group relative flex items-center justify-center gap-3 py-4 bg-red-500 rounded-xl shadow-[0_4px_0_#C53030] active:shadow-[0_0px_0_#C53030] active:translate-y-[4px] transition-all hover:bg-red-400"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                    <span className="font-bold text-white text-lg">
                      {voiceRecorderRef.current?.state === 'recording' ? 'إرسال التسميع للمعلم' : 'إنهاء التسميع'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Analysis Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center">
              <div className="w-full text-center mb-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                  <Activity className="w-6 h-6 text-blue-500" />
                  تحليل المطابقة الصوتية
                </h3>
                <p className="text-sm text-slate-500 mt-2">اختبر تلاوتك للآية وسجل للحصول على تحليل دقيق</p>
              </div>

              {analysisState === 'idle' && (
                <button
                  onClick={startAnalysis}
                  className="group relative flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 rounded-2xl w-full border-2 border-blue-100 hover:border-blue-300 transition-colors"
                >
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_4px_0_#2563EB] group-active:shadow-[0_0px_0_#2563EB] group-active:translate-y-[4px] transition-all">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  <span className="font-bold text-blue-800 mt-2">ابدأ التسجيل للتحليل</span>
                </button>
              )}

              {analysisState === 'recording' && (
                <button
                  onClick={stopAnalysis}
                  className="group relative flex flex-col items-center justify-center gap-2 p-4 bg-red-50 rounded-2xl w-full border-2 border-red-100 transition-colors"
                >
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-[0_4px_0_#DC2626] group-active:shadow-[0_0px_0_#DC2626] group-active:translate-y-[4px] transition-all relative">
                    <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-60"></div>
                    <Square className="w-8 h-8 text-white relative z-10 fill-white" />
                  </div>
                  <span className="font-bold text-red-600 animate-pulse mt-2">أوقف التسجيل</span>
                </button>
              )}

              {analysisState === 'analyzing' && (
                <div className="flex flex-col items-center justify-center gap-4 py-8 w-full">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-blue-800 font-bold">جاري تحليل تلاوتك...</span>
                </div>
              )}

              {analysisState === 'completed' && analysisResult && (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border w-full flex flex-col items-center">
                    <span className="text-sm font-bold text-slate-500 mb-1">دقة التلاوة</span>
                    <span className="text-3xl font-extrabold text-blue-600 flex items-center gap-1">
                      {analysisResult.score || 0}<span className="text-xl">%</span>
                    </span>
                  </div>
                  
                  {analysisResult.words && analysisResult.words.length > 0 && (
                    <div className="w-full bg-slate-50 rounded-2xl p-4 border overflow-hidden">
                      <p className="text-right font-arabic text-xl leading-loose" dir="rtl" style={{ fontFamily: '"Amiri", serif' }}>
                        {analysisResult.words.map((word: any, i: number) => (
                          <span key={i} className={`inline-block px-1 rounded mx-0.5 ${getAccuracyColor(word.status)}`} title={word.status !== 'correct' ? word.suggestion : ''}>
                            {word.text}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={resetAnalysis}
                    className="flex items-center justify-center gap-2 py-2 px-6 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition-colors w-full"
                  >
                    <RotateCcw className="w-5 h-5" />
                    حاول مرة أخرى
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">جدول الحفظ</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                {schedule.map((item, idx) => (
                  <div key={idx} className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${item.status === 'current' ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                    <div className="mt-1">
                      {item.status === 'current' ? (
                        <Target className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className={`text-xs font-bold mb-1 ${item.status === 'current' ? 'text-orange-600' : 'text-slate-500'}`}>
                        {item.day}
                      </div>
                      <div className={`font-semibold ${item.status === 'current' ? 'text-slate-800' : 'text-slate-600'}`}>
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
