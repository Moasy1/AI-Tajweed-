import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Copy,
  ChevronDown,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Loader2,
  Compass,
  Radio,
  GraduationCap,
  Sliders,
  ExternalLink,
  Search,
  CheckCircle2
} from 'lucide-react';

interface ChatAction {
  label: string;
  type: 'navigate' | 'radio' | 'copy';
  path?: string;
  icon?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  audio?: string | null;
  actions?: ChatAction[];
  timestamp: string;
}

export default function GlobalAIAssistant() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Determine current page context
  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case '/mushaf':
        return {
          title: 'مصحف المدينة والتفسير',
          tagline: 'مساعدك القرآني: أستطيع فتح أي سورة، تفسير الآيات، والبحث الموضوعي 📖',
          quickPrompts: [
            'ما هي السور والآيات التي تتحدث عن السكينة والاطمئنان؟',
            'افتح لي سورة الكهف الآية 10 مع التفسير الميسر',
            'ما المعنى الدقيق لكلمة (الصمد) في سورة الإخلاص؟',
          ],
        };
      case '/tajweed':
        return {
          title: 'معمل التجويد والمطابقة',
          tagline: 'جاهز لمساعدتك في فحص أحكام التجويد ومخارج الحروف والمقارنة مع القراء 🔬',
          quickPrompts: [
            'كيف أضبط مخرج حرف القاف والضاد بدقة؟',
            'ما الفرق بين المد المتصل والمنفصل وكم عدد حركاته؟',
            'ما هي مراتب الغنة في أحكام النون والميم المشددتين؟',
          ],
        };
      case '/teacher':
        return {
          title: 'حلقة التسميع الغيبي',
          tagline: 'معك لتثبيت الحفظ، مراجعة الورد الغيبي، وتوجيهك خطوة بخطوة 🎓',
          quickPrompts: [
            'كيف أثبت حفظي لسورة الملك بدون نسيان؟',
            'ما هو أفضل وقت لمراجعة الورد اليومي؟',
            'شجعني بحديث شريف عن أجر حافظ القرآن',
          ],
        };
      default:
        return {
          title: 'الموجه والمنسق القرآني الشامل',
          tagline: 'أنا هنا لمساعدتك في التوجيه السريع لأي سورة، خدمة، أو حكم قرآني 🌟',
          quickPrompts: [
            'افتح لي حلقة التسميع الغيبي لسورة الملك',
            'أريد فحص تلاوتي وتجويدي لسورة الفاتحة',
            'ما هي الآيات التي تتحدث عن بر الوالدين؟',
          ],
        };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  useEffect(() => {
    // Initial welcome message
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `السلام عليكم ورحمة الله وبركاته! أنا "الموجه القرآني الذكي" (Quranic Co-Pilot).
أستطيع مساعدتك في:
• الانتقال الفوري وتوجيهك لأي سورة أو آية في المصحف.
• فتح حلقة التسميع الغيبي أو معمل فحص التجويد مباشرة.
• البحث الموضوعي في آيات القرآن وتفسيرها الميسر.

كيف يمكنني خدمتك في وردك اليوم؟`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: '📖 فتح مصحف المدينة', type: 'navigate', path: '/mushaf' },
            { label: '🎓 بدء التسميع الغيبي', type: 'navigate', path: '/teacher' },
            { label: '🔬 فحص أحكام التجويد', type: 'navigate', path: '/tajweed' }
          ]
        },
      ]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Speech Recognition setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsRecording(false);
        handleSendMessage(transcript);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('التعرف على الصوت غير مدعوم في متصفحك الحالي، يرجى استخدام متصفح حديث.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        setIsRecording(false);
      }
    }
  };

  // Smart Intent & Action Parser
  const parseSmartActions = (userQuery: string): ChatAction[] => {
    const q = userQuery.toLowerCase();
    const actions: ChatAction[] = [];

    if (q.includes('تسميع') || q.includes('حفظ') || q.includes('معلم') || q.includes('غيبي') || q.includes('الملك')) {
      actions.push({ label: '🎓 انتقال لحلقة التسميع الغيبي', type: 'navigate', path: '/teacher' });
    }
    if (q.includes('تجويد') || q.includes('مخرج') || q.includes('حكم') || q.includes('مد') || q.includes('غنة') || q.includes('قلقلة') || q.includes('فحص')) {
      actions.push({ label: '🔬 انتقال لمعمل التجويد', type: 'navigate', path: '/tajweed' });
    }
    if (q.includes('مصحف') || q.includes('تفسير') || q.includes('آية') || q.includes('سورة') || q.includes('قراءة') || q.includes('الكهف')) {
      actions.push({ label: '📖 فتح مصحف المدينة والتفسير', type: 'navigate', path: '/mushaf' });
    }
    if (q.includes('إجازة') || q.includes('سند') || q.includes('مقرئ')) {
      actions.push({ label: '📜 طلب الإجازة القرآنية', type: 'navigate', path: '/ijazah' });
    }
    if (q.includes('راديو') || q.includes('إذاعة') || q.includes('صوت') || q.includes('الشيخ')) {
      actions.push({ label: '📻 تشغيل إذاعة القرآن الكريم', type: 'radio' });
    }

    return actions;
  };

  const handleActionClick = (action: ChatAction) => {
    if (action.type === 'navigate' && action.path) {
      navigate(action.path);
      setIsOpen(false);
    } else if (action.type === 'radio') {
      const radioBtn = document.querySelector('[data-quran-radio-toggle]') as HTMLElement;
      if (radioBtn) {
        radioBtn.click();
      } else {
        alert('تم تفعيل مشغل القرآن الكريم في الشريط الجانبي.');
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          pageContext: location.pathname,
          pageTitle: pageInfo.title,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await res.json();
      const responseText = data.text || 'أهلاً بك، كيف يمكنني إعانتك في تلاوتك وتدبرك؟';
      const actions = parseSmartActions(query);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        actions: actions.length > 0 ? actions : undefined,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Voice Audio Response
      if (voiceEnabled) {
        fetch('/api/assistant/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: responseText, voice: 'Charon' }),
        })
          .then((r) => r.json())
          .then((ttsData) => {
            if (ttsData.audio) {
              const audioSrc = `data:audio/wav;base64,${ttsData.audio}`;
              if (audioPlayerRef.current) {
                audioPlayerRef.current.src = audioSrc;
                audioPlayerRef.current.play().catch(() => {});
              }
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: 'عذراً، حدث انقطاع بسيط في الشبكة. يرجى المحاولة مرة أخرى.',
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Floating Trigger Button in Bottom Left */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-full shadow-2xl shadow-teal-700/40 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white/30"
          aria-label="الموجه القرآني الذكي"
        >
          <div className="relative">
            <Compass className="w-5 h-5 animate-spin text-teal-100" style={{ animationDuration: '12s' }} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs font-extrabold leading-none">الموجه القرآني الذكي</span>
            <span className="text-[10px] text-teal-100/90 font-medium mt-0.5">أوامر سريعة وتدبر شامل</span>
          </div>
        </button>
      )}

      {/* Main Chatbot / Copilot Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col font-sans ${
            isMinimized
              ? 'bottom-6 left-6 w-80 h-16 bg-white rounded-2xl shadow-2xl border border-slate-200'
              : 'bottom-4 left-4 right-4 sm:right-auto sm:left-6 sm:w-[440px] h-[600px] max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white p-4 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                  <span>الموجه القرآني الذكي</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/20 rounded-full">Co-Pilot</span>
                </h3>
                <p className="text-[11px] text-teal-100/90 truncate max-w-[200px]">
                  {pageInfo.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-1.5 rounded-lg transition-colors ${voiceEnabled ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                title={voiceEnabled ? 'كتم الصوت التلقائي' : 'تفعيل الصوت التلقائي'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isMinimized ? 'تكبير' : 'تصغير'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Quick Navigation Action Strip */}
              <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold shrink-0 no-scrollbar">
                <span className="text-slate-400 shrink-0 text-[10px]">انتقال سريع:</span>
                <button
                  onClick={() => handleActionClick({ label: '', type: 'navigate', path: '/teacher' })}
                  className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                  <span>حلقة التسميع</span>
                </button>
                <button
                  onClick={() => handleActionClick({ label: '', type: 'navigate', path: '/tajweed' })}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>معمل التجويد</span>
                </button>
                <button
                  onClick={() => handleActionClick({ label: '', type: 'navigate', path: '/mushaf' })}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>المصحف</span>
                </button>
                <button
                  onClick={() => handleActionClick({ label: '', type: 'radio' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors"
                >
                  <Radio className="w-3.5 h-3.5 text-amber-600" />
                  <span>الإذاعة</span>
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-start gap-2 max-w-[90%]">
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-teal-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                        }`}
                        dir="rtl"
                      >
                        <div className="whitespace-pre-line font-medium">{msg.text}</div>

                        {/* Interactive Action Buttons if available */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                            {msg.actions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => handleActionClick(act)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition-all border border-teal-200/70 shadow-sm active:scale-95"
                              >
                                <span>{act.label}</span>
                                <ExternalLink className="w-3 h-3 text-teal-600" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-1">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-9">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50/80 p-3 rounded-2xl border border-teal-100 w-fit">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    <span>الموجه الذكي يفكر ويستخرج التوجيه القرآني...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Carousel */}
              {pageInfo.quickPrompts && pageInfo.quickPrompts.length > 0 && (
                <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  {pageInfo.quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-800 text-[11px] font-bold rounded-lg border border-slate-200/80 whitespace-nowrap transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleRecording}
                  className={`p-2.5 rounded-xl transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  title={isRecording ? 'إيقاف التسجيل الصوتي' : 'تحدث بالصوت'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="اطلب أي خدمة، سورة، تفسير، أو حكم تجويد..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  dir="rtl"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-sm"
                  title="إرسال"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
