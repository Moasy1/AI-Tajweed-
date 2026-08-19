import { useState, useRef } from 'react';
import { Radio, Play, Square } from 'lucide-react';

export default function QuranRadio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleRadio = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 relative overflow-hidden">
      {isPlaying && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
      )}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isPlaying ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
            <Radio className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-slate-200">إذاعة القرآن</span>
        </div>
        <div className="flex items-center gap-1">
           <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? 'bg-emerald-400 block' : 'hidden'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
          </span>
        </div>
      </div>
      
      <button 
        onClick={toggleRadio}
        className={`w-full py-2.5 transition-all duration-300 rounded-xl flex items-center justify-center gap-2 text-sm font-bold relative z-10 ${
          isPlaying 
            ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' 
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900'
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="w-4 h-4" /> إيقاف البث
          </>
        ) : (
          <>
            <Play className="w-4 h-4" /> تشغيل (القاهرة)
          </>
        )}
      </button>

      <audio 
        ref={audioRef} 
        src="https://n0a.radiojar.com/8s5u5tpdtwzuv" 
        preload="none"
      />
    </div>
  );
}
