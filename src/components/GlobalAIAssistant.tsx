import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  Check,
  Copy,
  ChevronDown,
  Maximize2,
  Minimize2,
  Lightbulb,
  Bot,
  User,
  Loader2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  audio?: string | null;
  timestamp: string;
}

export default function GlobalAIAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasNewTip, setHasNewTip] = useState(false);
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
          tagline: 'أنا معك في المصحف لشرح وتدبر الآيات استناداً للتفسير الميسر 📖',
          quickPrompts: [
            'اشرح لي تفسير الآية بأسلوب مبسط',
            'ما هي الفوائد الإيمانية والتربوية المستنبطة؟',
            'وضح لي غريب الكلمات ومعانيها الدقيقة',
          ],
        };
      case '/tajweed':
        return {
          title: 'التسميع والتجويد',
          tagline: 'جاهز لمساعدتك في تصحيح الأحكام ومخارج وصفات الحروف 🎙️',
          quickPrompts: [
            'ما هو حكم الإخفاء الحقيقي مع مثال؟',
            'كيف أضبط مخرج حرف القاف أو الضاد بشكل صحيح؟',
            'ما الفرق بين المد المتصل والمد المنفصل وكم حركاته؟',
          ],
        };
      case '/teacher':
        return {
          title: 'المعلم التفاعلي',
          tagline: 'معك للاستماع والتسميع وتقديم التوجيهات القرآنية المباشرة 💡',
          quickPrompts: [
            'كيف أثبت حفظي لسورة الملك؟',
            'شجعني بحديث شريف عن فضل تلاوة القرآن',
            'ما هي أفضل أوقات المراجعة والحفظ؟',
          ],
        };
      case '/ijazah':
        return {
          title: 'طلب الإجازة القرآنية',
          tagline: 'أرشدك لشروط الإتقان ومتطلبات السند المتصل مع المشايخ 📜',
          quickPrompts: [
            'ما هي معايير القبول لنيل الإجازة القرآنية؟',
            'كيف أستعد لاختبار التلاوة بالسند المتصل؟',
            'ما الفرق بين القراءات والروايات المعتمدة؟',
          ],
        };
      case '/kids':
        return {
          title: 'واجهة الأطفال',
          tagline: 'مرحباً يا بطل القرآن! أنا صديقك الذكي لمساعدتك في حفظ الآيات 🌟',
          quickPrompts: [
            'احكِ لي قصة قصيرة وممتعة من القرآن الكريم',
            'شجعني بكلمات جميلة لأنني قرأت اليوم!',
            'كيف أحصل على نجوم وجوائز أكثر في التطبيق؟',
          ],
        };
      default:
        return {
          title: 'الرئيسية ولوحة المتابعة',
          tagline: 'مرحباً بك! أنا المعلم القرآني الذكي، كيف أساعدك في رحلتك اليوم؟ ✨',
          quickPrompts: [
            'اقترح لي خطة لمراجعة وردي اليومي بانتظام',
            'ما هي فضائل سورة الكهف أو تبارك؟',
            'كيف أبدأ حفظ القرآن الكريم خطوة بخطوة؟',
          ],
        };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  // Initialize welcoming message on first load or context switch
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          text: `السلام عليكم ورحمة الله وبركاته! 🌿\n\nأنا **المعلم القرآني الذكي** في منصة ترتيل AI. أنا متواجد معك في كافة أقسام التطبيق لمساعدتك في:\n- 📖 شرح وتدبر الآيات استناداً لتفسير مصحف المدينة النبوية.\n- 🎙️ توضيح أحكام التجويد ومخارج الحروف وتصحيح الأخطاء.\n- 🗓️ وضع خطط الحفظ والمراجعة ومتابعة الإجازة.\n\nتفضل بسؤالي كتابةً أو بالصوت في أي وقت!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
    setHasNewTip(true);
    const t = setTimeout(() => setHasNewTip(false), 5000);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Handle Speech Recognition (Web Speech API)
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('التعرف الصوتي المباشر غير مدعوم في متصفحك الحالي، يمكنك الكتابة في مربع الرسائل.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
          sendMessage(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Speech recognition init error:', err);
      setIsRecording(false);
    }
  };

  // Play audio response with native instant SpeechSynthesis
  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Clean markdown tags for natural speech
      const clean = text
        .replace(/<[^>]*>/g, '')
        .replace(/[*#_~`]/g, '')
        .replace(/﴿[^﴾]*﴾/g, '')
        .slice(0, 250);

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // Play audio response (TTS or Web Speech)
  const playAudio = (base64Audio?: string | null, rawText?: string) => {
    if (!voiceEnabled) return;
    if (base64Audio) {
      try {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audioPlayerRef.current = audio;
        audio.play().catch(() => {
          if (rawText) speakText(rawText);
        });
        return;
      } catch (e) {
        console.warn('TTS play error:', e);
      }
    }
    if (rawText) {
      speakText(rawText);
    }
  };

  // Send message to assistant (Ultra-Fast)
  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            pathname: location.pathname,
            pageTitle: pageInfo.title,
          },
          history: historyPayload,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const responseText = data.text || 'أنا معك، كيف يمكنني مساعدتك في رحلتك القرآنية؟';
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        audio: data.audio || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (voiceEnabled) {
        playAudio(data.audio, responseText);
      }
    } catch (err) {
      console.warn('Assistant chat response fallback:', err);
      const fallbackText = 'أهلاً بك! يرجى التأكد من اتصال الإنترنت وطرح سؤالك مرة أخرى وسأجيبك فوراً.';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  const clearChat = () => {
    setMessages([
      {
        id: 'new-chat-msg',
        role: 'assistant',
        text: `تم بدء جلسة محادثة جديدة. أنا المعلم القرآني الذكي معك في قسم **${pageInfo.title}**، كيف أساعدك؟`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Widget (Floating Action Button) */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-6 left-4 md:left-8 z-40 flex items-center gap-3 select-none animate-in fade-in slide-in-from-bottom-5 duration-300" dir="rtl">
          {/* Subtle Contextual Hint Tooltip */}
          {hasNewTip && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/95 text-white border border-emerald-500/40 text-xs px-3.5 py-2 rounded-2xl shadow-xl backdrop-blur-md animate-bounce">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{pageInfo.tagline}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setHasNewTip(false);
                }}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Floating Avatar / Button */}
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setHasNewTip(false);
            }}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3 rounded-full shadow-2xl shadow-emerald-600/40 border border-emerald-400/30 transition-all duration-300 active:scale-95"
            title="المعلم القرآني الذكي"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-300 rounded-full border-2 border-slate-900 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-xs font-black tracking-wide leading-none">المعلم الذكي</div>
              <div className="text-[10px] text-emerald-200/90 font-medium mt-0.5">مساعدك في {pageInfo.title}</div>
            </div>

            <Sparkles className="w-4 h-4 text-emerald-200 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      )}

      {/* Floating Assistant Modal / Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 select-text ${
            isMinimized
              ? 'bottom-20 md:bottom-6 left-4 md:left-8 w-80'
              : 'bottom-20 md:bottom-6 left-3 md:left-8 w-[95vw] sm:w-[440px] h-[580px] max-h-[85vh]'
          } bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200`}
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <Bot className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">المعلم القرآني الذكي</h3>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-bold">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>سياق:</span>
                  <span className="text-emerald-400 font-bold">{pageInfo.title}</span>
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-1.5 rounded-lg transition-colors ${
                  voiceEnabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
                }`}
                title={voiceEnabled ? 'الصوت مفعل' : 'الصوت معطل'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="محادثة جديدة"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMinimized ? 'تكبير' : 'تصغير'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Minimized View Header Pill */}
          {isMinimized && (
            <div className="p-3 bg-slate-900 text-xs text-slate-300 flex items-center justify-between">
              <span>انقر لتكبير نافذة المعلم الذكي</span>
              <button
                onClick={() => setIsMinimized(false)}
                className="text-emerald-400 font-bold text-xs hover:underline"
              >
                فتح المحادثة ←
              </button>
            </div>
          )}

          {/* Expanded Chat View */}
          {!isMinimized && (
            <>
              {/* Context Tagline Banner */}
              <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                <span className="truncate">{pageInfo.tagline}</span>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 mushaf-scroll bg-slate-950/40">
                {messages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  const isCopied = copiedId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} gap-1`}
                    >
                      <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-500">
                        {isAssistant ? (
                          <>
                            <Bot className="w-3 h-3 text-emerald-400" />
                            <span className="font-bold text-emerald-400">المعلم الذكي</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-slate-300">أنت</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div
                        className={`relative group max-w-[88%] p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                          isAssistant
                            ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                            : 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-600/20'
                        }`}
                      >
                        <div
                          className="whitespace-pre-line space-y-1.5 [&_strong]:text-emerald-300 [&_b]:text-emerald-300"
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^### (.*$)/gim, '<h4 class="font-bold text-emerald-400 text-sm mt-1">$1</h4>')
                              .replace(/^## (.*$)/gim, '<h4 class="font-bold text-emerald-400 text-sm mt-1">$1</h4>')
                              .replace(/^- (.*$)/gim, '<div class="flex items-start gap-1.5 my-0.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span><span>$1</span></div>'),
                          }}
                        />

                        {/* Actions for assistant messages */}
                        {isAssistant && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="opacity-70">ترتيل AI</span>
                            <div className="flex items-center gap-2">
                              {msg.audio && (
                                <button
                                  onClick={() => playAudio(msg.audio!)}
                                  className="text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                                  title="استماع للرد"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>استماع</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleCopy(msg.id, msg.text)}
                                className="text-slate-400 hover:text-emerald-400 flex items-center gap-1"
                                title="نسخ النص"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 w-fit">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>المعلم الذكي يكتب الإجابة...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Contextual Quick Prompts Chips */}
              <div className="px-3 py-2 bg-slate-900 border-t border-slate-800/80 shrink-0">
                <div className="text-[10px] text-slate-500 font-bold mb-1.5 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-amber-400" />
                  <span>اقتراحات سريعة لـ {pageInfo.title}:</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {pageInfo.quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      disabled={isLoading}
                      className="whitespace-nowrap text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-300 px-2.5 py-1 rounded-xl border border-slate-700/60 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="p-3 bg-slate-850 border-t border-slate-800 flex items-center gap-2 shrink-0"
              >
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`p-2.5 rounded-xl transition-all ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-emerald-400'
                  }`}
                  title={isRecording ? 'إيقاف التسجيل' : 'تحدث بالصوت'}
                >
                  {isRecording ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  placeholder="اسأل المعلم الذكي عن أي شيء في التفسير، التجويد، أو الحفظ..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs disabled:opacity-40 transition-colors shadow-sm"
                  title="إرسال"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
