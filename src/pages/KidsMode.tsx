import { useState, useRef, useEffect } from 'react';
import { Star, Award, Heart, PlayCircle, Zap, Square, Mic, RotateCcw } from 'lucide-react';
import { AccuracyThreshold } from '../services/AudioService';

type Accuracy = AccuracyThreshold;

interface Word {
  text: string;
  accuracy: Accuracy;
}

export default function KidsMode() {
  const [isPlayingReciter, setIsPlayingReciter] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'analyzing' | 'completed'>('idle');
  const [words, setWords] = useState<Word[]>([
    { text: 'قُلْ', accuracy: 'idle' },
    { text: 'هُوَ', accuracy: 'idle' },
    { text: 'اللَّهُ', accuracy: 'idle' },
    { text: 'أَحَدٌ', accuracy: 'idle' },
  ]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const toggleReciter = () => {
    if (!audioRef.current) return;
    
    if (isPlayingReciter) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingReciter(false);
    } else {
      audioRef.current.play();
      setIsPlayingReciter(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingReciter(false);
  };

  const startReading = async () => {
    setWords(words.map(w => ({ ...w, accuracy: 'idle' })));
    setRecordingState('recording');
    setAnalysisResult(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setRecordingState('analyzing');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'kids_recitation.webm');

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
            throw new Error(data.error + ': ' + (data.details || ''));
          }
          
          setAnalysisResult(data);
          
          // Map Gemini results to the words
          if (data.words && data.words.length > 0) {
            setWords(prevWords => {
              return prevWords.map((w, index) => {
                const apiWord = data.words[index] || data.words[0];
                let accuracy: Accuracy = 'weak';
                if (apiWord.accuracy > 90) accuracy = 'excellent';
                else if (apiWord.accuracy > 70) accuracy = 'good';
                else if (apiWord.accuracy > 50) accuracy = 'close';
                return { ...w, accuracy };
              });
            });
          }
          
          setRecordingState('completed');
        } catch (error) {
          console.error('Error analyzing audio:', error);
          alert('حدث خطأ أثناء تحليل الصوت.');
          setRecordingState('idle');
        }
      };

      mediaRecorder.start();
    } catch (e) {
      alert("الرجاء السماح بالوصول للميكروفون");
      setRecordingState('idle');
    }
  };

  const stopReading = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resetReading = () => {
    stopReading();
    setWords(words.map(w => ({ ...w, accuracy: 'idle' })));
    setRecordingState('idle');
  };

  const getAccuracyColor = (accuracy: Accuracy) => {
    switch (accuracy) {
      case 'weak': return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'; // احمر ضعيف
      case 'close': return 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]'; // اصفر قريب
      case 'good': return 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]'; // اخضر جيد
      case 'excellent': return 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'; // ازرق ممتاز
      default: return 'text-[#2D3748]'; // لون افتراضي
    }
  };

  return (
    <div className="min-h-full bg-[#F0F9FF] p-4 md:p-8 pb-8 relative overflow-hidden font-sans rounded-tl-3xl lg:min-h-screen">
      {/* Decorative background shapes */}
      <div className="absolute top-4 left-4 w-16 h-16 md:w-24 md:h-24 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-10 right-10 md:right-20 w-20 h-20 md:w-24 md:h-24 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-10 md:left-20 w-24 h-24 md:w-32 md:h-32 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <header className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 mb-8 md:mb-12 text-center md:text-right">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#2D3748] tracking-tight">أهلاً يا بطل! 🌟</h2>
          <p className="text-lg md:text-xl text-[#4A5568] mt-2 font-medium">مستعد لجمع المزيد من النجوم اليوم؟</p>
        </div>
        <div className="bg-white px-5 py-2 md:px-6 md:py-3 rounded-full shadow-lg shadow-blue-100 flex items-center gap-3 border-4 border-yellow-400 w-fit">
          <Star className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 fill-yellow-400" />
          <span className="text-xl md:text-2xl font-bold text-[#2D3748]">125</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 relative z-10">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Main interactive block */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-blue-100/50 border-4 border-[#E2E8F0] transform transition-transform hover:-translate-y-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h3 className="text-2xl md:text-3xl font-extrabold text-[#2D3748]">التكرار التفاعلي</h3>
              <div className="bg-purple-100 text-purple-600 px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 self-start sm:self-auto">
                <Zap className="w-4 h-4" />
                تحدي اليوم
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-3xl p-6 md:p-8 text-center border-2 border-blue-100">
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-8">
                {words.map((word, idx) => (
                  <div key={idx} className="relative group">
                    <span 
                      className={`text-3xl md:text-5xl leading-loose font-arabic font-bold transition-all duration-700 ease-bounce block ${getAccuracyColor(word.accuracy)} ${word.accuracy !== 'idle' ? 'scale-110' : ''}`}
                    >
                      {word.text}
                    </span>
                    {recordingState === 'completed' && word.accuracy === 'weak' && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[120px] bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center animate-bounce">
                        يحتاج توضيح أكثر
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-500" />
                      </div>
                    )}
                    {recordingState === 'completed' && word.accuracy === 'close' && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[120px] bg-yellow-500 text-white text-[10px] md:text-xs font-bold px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 text-center animate-bounce">
                        قربت جداً، ركز!
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {recordingState === 'analyzing' && (
                <div className="mb-8 flex flex-col items-center gap-3 animate-pulse">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-blue-800 font-bold">المعلم الذكي يستمع لتلاوتك...</span>
                </div>
              )}

              {recordingState === 'completed' && (
                <div className="mb-8 flex flex-col items-center gap-4">
                  <div className="bg-white/80 p-4 rounded-3xl border-2 border-green-200 shadow-sm inline-flex flex-col items-center">
                    <span className="text-sm font-bold text-slate-500 mb-1">دقة التلاوة</span>
                    <span className="text-3xl font-extrabold text-green-500 flex items-center gap-1">
                      85<span className="text-xl">%</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-sm font-bold bg-white/60 p-4 rounded-2xl w-full">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> ممتاز</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> جيد</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" /> قريب (مرر للسبب)</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> يحتاج تدريب (مرر للسبب)</div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center gap-4 md:gap-6">
                <button 
                  onClick={toggleReciter}
                  disabled={recordingState === 'recording' || recordingState === 'analyzing'}
                  className="flex flex-col items-center gap-2 md:gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className={`w-16 h-16 md:w-20 md:h-20 ${isPlayingReciter ? 'bg-[#38B2AC]' : 'bg-[#4FD1C5]'} rounded-full flex items-center justify-center shadow-[0_6px_0_#38B2AC] md:shadow-[0_8px_0_#38B2AC] group-active:shadow-[0_0px_0_#38B2AC] group-active:translate-y-2 transition-all`}>
                    {isPlayingReciter ? (
                      <Square className="w-8 h-8 md:w-10 md:h-10 text-white fill-white" />
                    ) : (
                      <PlayCircle className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    )}
                  </div>
                  <span className="font-bold text-[#2D3748] text-sm md:text-base">استمع للمقرئ</span>
                </button>
                
                {recordingState === 'idle' && (
                  <button 
                    onClick={startReading}
                    disabled={isPlayingReciter}
                    className="flex flex-col items-center gap-2 md:gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-[#F6AD55] rounded-full flex items-center justify-center shadow-[0_6px_0_#DD6B20] md:shadow-[0_8px_0_#DD6B20] group-active:shadow-[0_0px_0_#DD6B20] group-active:translate-y-2 transition-all">
                      <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <span className="font-bold text-[#2D3748] text-sm md:text-base">اقرأ بنفسك</span>
                  </button>
                )}

                {recordingState === 'recording' && (
                  <button 
                    onClick={stopReading}
                    className="flex flex-col items-center gap-2 md:gap-3 group"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500 rounded-full flex items-center justify-center shadow-[0_6px_0_#C53030] md:shadow-[0_8px_0_#C53030] group-active:shadow-[0_0px_0_#C53030] group-active:translate-y-2 transition-all relative">
                      <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-60"></div>
                      <Square className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10 fill-white" />
                    </div>
                    <span className="font-bold text-red-600 animate-pulse text-sm md:text-base">توقف عن القراءة</span>
                  </button>
                )}

                {recordingState === 'completed' && (
                  <button 
                    onClick={resetReading}
                    className="flex flex-col items-center gap-2 md:gap-3 group"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_6px_0_#2B6CB0] md:shadow-[0_8px_0_#2B6CB0] group-active:shadow-[0_0px_0_#2B6CB0] group-active:translate-y-2 transition-all">
                      <RotateCcw className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <span className="font-bold text-[#2D3748] text-sm md:text-base">حاول مرة أخرى</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          {/* Badges block */}
          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-blue-100/50 border-4 border-[#E2E8F0]">
            <h3 className="text-xl md:text-2xl font-extrabold text-[#2D3748] mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 md:w-8 md:h-8 text-[#ED8936]" />
              أوسمتي
            </h3>
            
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-yellow-50 p-3 md:p-4 rounded-2xl flex flex-col items-center text-center border-2 border-yellow-200">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-200 rounded-full flex items-center justify-center mb-2 md:mb-3">
                  <Star className="w-6 h-6 md:w-8 md:h-8 text-yellow-600 fill-yellow-500" />
                </div>
                <span className="font-bold text-[#2D3748] text-xs md:text-sm">بطل الفاتحة</span>
              </div>
              <div className="bg-purple-50 p-3 md:p-4 rounded-2xl flex flex-col items-center text-center border-2 border-purple-200">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-200 rounded-full flex items-center justify-center mb-2 md:mb-3">
                  <Zap className="w-6 h-6 md:w-8 md:h-8 text-purple-600 fill-purple-500" />
                </div>
                <span className="font-bold text-[#2D3748] text-xs md:text-sm">سريع الحفظ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Audio element for the reciter */}
      <audio 
        ref={audioRef} 
        src="https://everyayah.com/data/Alafasy_128kbps/112001.mp3" 
        onEnded={handleAudioEnded} 
        className="hidden" 
      />
    </div>
  );
}
