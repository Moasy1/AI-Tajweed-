import { CheckCircle2, ShieldCheck, Clock, FileText, Download } from 'lucide-react';

export default function Ijazah() {
  const steps = [
    { 
      title: 'التقييم الآلي المبدئي', 
      desc: 'قراءة السورة كاملة وتجاوز دقة 98%', 
      status: 'completed',
      icon: CheckCircle2,
      date: '10 أكتوبر 2026'
    },
    { 
      title: 'مراجعة الشيخ', 
      desc: 'يتم إرسال التسجيل لشيخ مجاز معتمد للمراجعة النهائية', 
      status: 'current',
      icon: Clock,
      date: 'قيد الانتظار'
    },
    { 
      title: 'إصدار الشهادة', 
      desc: 'استخراج شهادة رقمية موثقة برقم تسلسلي ورمز QR', 
      status: 'upcoming',
      icon: FileText,
      date: '-'
    }
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-8 md:mb-12 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 transform -rotate-6 hover:rotate-0 transition-transform">
          <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">مسار الإجازة الإلكترونية</h2>
        <p className="text-slate-500 mt-3 md:mt-4 max-w-2xl mx-auto text-sm md:text-lg leading-relaxed">
          نظام متكامل يجمع بين دقة الذكاء الاصطناعي في الفلترة الأولية واعتماد الشيوخ المجازين لضمان موثوقية الإجازة الشرعية.
        </p>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 md:p-12 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-emerald-50 rounded-full blur-3xl -mr-24 -mt-24 md:-mr-32 md:-mt-32 -z-0 opacity-50" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-12 border-b border-slate-100 pb-6 md:pb-8">
          <div>
            <h3 className="text-xl md:text-2xl font-extrabold text-slate-900">طلب إجازة: سورة البقرة</h3>
            <p className="text-slate-500 mt-1 font-medium text-sm md:text-base">الشيخ المراجع: عبد الرحمن مسعد</p>
          </div>
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100 flex items-center gap-2 mt-4 md:mt-0 shadow-sm text-sm">
            <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-emerald-500"></span>
            </span>
            قيد المراجعة
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 md:gap-12">
          {/* Timeline */}
          <div className="flex-1 space-y-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="flex gap-6 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-colors ${
                      step.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 
                      step.status === 'current' ? 'bg-white border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/10' :
                      'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <Icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    {idx !== steps.length - 1 && (
                      <div className={`w-0.5 h-full my-2 md:my-3 rounded-full ${step.status === 'completed' ? 'bg-emerald-500/30' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className="pb-8 md:pb-10 pt-1 md:pt-2">
                    <h4 className={`text-lg md:text-xl font-bold ${step.status === 'upcoming' ? 'text-slate-400' : 'text-slate-900'}`}>
                      {step.title}
                    </h4>
                    <p className={`text-sm md:text-base mt-1 md:mt-2 leading-relaxed ${step.status === 'upcoming' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {step.desc}
                    </p>
                    <div className={`text-sm mt-3 font-bold px-3 py-1 rounded-lg inline-block ${
                      step.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 
                      step.status === 'current' ? 'bg-orange-50 text-orange-700' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {step.date}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status Panel */}
          <div className="w-full md:w-96 bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center h-fit text-slate-300 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-inner border border-slate-700/50">
              <Clock className="w-12 h-12" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-3">المراجعة البشرية</h4>
            <p className="text-slate-400 leading-relaxed mb-8">
              تم إرسال تسجيلك بنجاح إلى الشيخ المعتمد. سيتم إبلاغك بالنتيجة قريباً عبر إشعار داخل التطبيق.
            </p>
            
            <div className="space-y-3">
              <button disabled className="w-full py-4 bg-slate-800 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                <Download className="w-5 h-5" />
                تنزيل الشهادة (مغلق)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
