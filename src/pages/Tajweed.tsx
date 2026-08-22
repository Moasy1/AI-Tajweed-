import { useState, useRef } from 'react';
import { Mic, Square, Play, RotateCcw, AlertTriangle, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Tajweed() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [resultsAvailable, setResultsAvailable] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        simulateAnalysis();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResultsAvailable(false);
      setAnalysisResult(null);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('الرجاء السماح بالوصول إلى الميكروفون');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const simulateAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisStep('جاري رفع التسجيل للخادم...');
    
    try {
      // Create a dummy blob representing the audio if chunks are empty for simulation
      const blob = chunksRef.current.length > 0 
        ? new Blob(chunksRef.current, { type: 'audio/webm' })
        : new Blob(['dummy audio content'], { type: 'audio/webm' });
        
      const formData = new FormData();
      formData.append('audio', blob, 'recitation.webm');

      setAnalysisStep('جاري التحليل باستخدام محرك الذكاء الاصطناعي...');
      
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
        throw new Error(response.ok ? 'Invalid JSON response from server' : 'Server error');
      }
      
      if (!response.ok) throw new Error('Analysis failed: ' + (data.error || ''));
      
      if (data.error) {
        throw new Error(data.error + ': ' + (data.details || ''));
      }
      
      console.log('Analysis results:', data);
      
      setAnalysisResult(data);
      setAnalysisStep('جاري توليد تقرير التجويد...');
      setTimeout(() => {
        setAnalyzing(false);
        setResultsAvailable(true);
      }, 500);

    } catch (error) {
      console.error('Error during analysis:', error);
      setAnalyzing(false);
      alert('حدث خطأ أثناء تحليل الصوت. يرجى المحاولة مرة أخرى.');
    }
  };

  const reset = () => {
    setAudioUrl(null);
    setResultsAvailable(false);
    setAnalyzing(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 md:mb-10 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">محرك المطابقة الصوتية</h2>
        <p className="text-slate-500 mt-2 md:mt-3 text-sm md:text-lg">تحليل التلاوة ومطابقتها بأحكام التجويد لاكتشاف الأخطاء بدقة الفونيم.</p>
      </header>

      <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
            <div className="p-6 md:p-10 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-8 md:mb-12">
                <div className="flex items-center gap-3">
                  <h3 className="text-base md:text-lg font-bold text-slate-700">{analysisResult?.surah || 'التحليل غير متوفر'}</h3>
                  <Link
                    to="/mushaf"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>تفسير مصحف المدينة</span>
                  </Link>
                </div>
                <span className="px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs md:text-sm font-bold">{analysisResult?.ayah || ''}</span>
              </div>
              
              <div className="text-3xl md:text-5xl leading-loose md:leading-[2.5] font-arabic text-slate-800 flex flex-wrap justify-center gap-x-2 md:gap-x-4 gap-y-4 md:gap-y-6 mb-12 md:mb-16 text-center max-w-3xl">
                {analysisResult?.words ? analysisResult.words.map((word: any, idx: number) => (
                  <span 
                    key={idx} 
                    className={`
                      relative px-2 transition-all duration-500 rounded-lg
                      ${resultsAvailable ? 
                        (word.status === 'error' ? 'text-red-600 bg-red-50 pb-2 border-b-2 border-red-500 cursor-pointer group hover:bg-red-100' : 'text-slate-400') 
                        : ''}
                    `}
                  >
                    {word.text}
                    {resultsAvailable && word.status === 'error' && (
                      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 bg-slate-900 text-white text-sm px-4 py-2 rounded-xl whitespace-nowrap z-20 pointer-events-none shadow-xl flex flex-col items-center gap-1 font-sans">
                        <span className="font-bold text-red-300">خطأ: {word.rule}</span>
                        <span className="text-xs text-slate-300 max-w-[200px] whitespace-normal text-center">{word.suggestion}</span>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900" />
                      </div>
                    )}
                  </span>
                )) : (
                  <span className="text-slate-300">سجّل صوتك ليظهر التحليل هنا</span>
                )}
              </div>

              <div className="flex flex-col items-center gap-6">
                {!isRecording && !audioUrl && (
                  <button 
                    onClick={handleStartRecording}
                    className="group relative flex items-center justify-center"
                  >
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full scale-150 group-hover:scale-175 transition-transform duration-500 opacity-0 group-hover:opacity-100" />
                    <div className="relative w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-transform active:scale-95 z-10">
                      <Mic className="w-8 h-8" />
                    </div>
                  </button>
                )}
                {isRecording && (
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={handleStopRecording}
                      className="relative w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-red-500/30 transition-transform active:scale-95 z-10"
                    >
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                      <Square className="w-8 h-8 relative z-10" />
                    </button>
                    <span className="text-red-500 font-bold animate-pulse">جاري التسجيل...</span>
                  </div>
                )}
                
                {audioUrl && !analyzing && (
                  <div className="flex flex-col items-center gap-4 w-full max-w-md">
                    <audio src={audioUrl} controls className="w-full h-12" />
                    <button 
                      onClick={reset}
                      className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium transition-colors bg-slate-100 hover:bg-slate-200 px-6 py-2.5 rounded-full"
                    >
                      <RotateCcw className="w-4 h-4" /> إعادة المحاولة
                    </button>
                  </div>
                )}
                
                {analyzing && (
                  <div className="flex flex-col items-center gap-4 text-emerald-600">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-emerald-100 rounded-full" />
                      <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-emerald-500" />
                      </div>
                    </div>
                    <span className="font-bold">{analysisStep}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 sticky top-8 flex flex-col h-full min-h-[300px] md:min-h-[400px]">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                <AlertTriangle className="w-5 h-5 text-slate-700" />
              </div>
              نتيجة التحليل
            </h3>
            
            {resultsAvailable && analysisResult?.words ? (
              <div className="space-y-4 flex-1">
                {analysisResult.words.map((word: any, idx: number) => {
                  if (word.status === 'error') {
                    return (
                      <div key={idx} className="p-4 rounded-2xl bg-red-50 border border-red-100/60 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-arabic font-bold text-2xl text-red-900">{word.text}</span>
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold">{word.rule}</span>
                            <span className="text-[10px] font-bold text-red-500">الدقة: {word.accuracy}%</span>
                          </div>
                        </div>
                        <p className="text-sm text-red-800/80 leading-relaxed mb-4">{word.suggestion}</p>
                        <button className="w-full py-2.5 bg-white border border-red-200/60 text-red-700 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors font-medium text-sm shadow-sm">
                          <Play className="w-4 h-4 fill-current" /> استمع للشيخ
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={idx} className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/60">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-arabic font-bold text-lg text-emerald-900">{word.text}</span>
                        <span className="text-xs font-bold text-emerald-600">الدقة: {word.accuracy}%</span>
                      </div>
                      <p className="text-sm text-emerald-700/80">{word.suggestion}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <div className="w-20 h-20 mb-4 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-medium text-center max-w-[200px]">التقرير سيظهر هنا بعد انتهاء التلاوة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
