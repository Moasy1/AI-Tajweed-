import { Activity, Book, Clock, Award, ChevronLeft, Bell, Flame } from 'lucide-react';
import { useState, useEffect } from 'react';

type Stat = { label: string; value: string; iconName: string; color: string; bg: string; border: string; };
type Alert = { type: string; title: string; description: string; };
type DailyTarget = { surah: string; verses: string; progress: number; };

type DashboardData = {
  stats: Stat[];
  dailyTarget: DailyTarget;
  alerts: Alert[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stats:', err);
        setLoading(false);
      });
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Book': return Book;
      case 'Clock': return Clock;
      case 'Activity': return Activity;
      case 'Flame': return Flame;
      default: return Book;
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex justify-center items-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
            <Book className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-slate-400 font-bold">جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">مرحباً بعودتك، أحمد 👋</h2>
          <p className="text-slate-500 mt-1 md:mt-2 text-base md:text-lg">لقد أتممت {data.dailyTarget.progress}% من حفظ {data.dailyTarget.surah}. واصل تقدمك!</p>
        </div>
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors self-end md:self-auto">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-50" />
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-10">
        {data.stats.map((stat, idx) => {
          const Icon = getIcon(stat.iconName);
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} ${stat.border} border group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-slate-900">{stat.value}</p>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">الورد اليومي</h3>
              <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                عرض الكل <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-emerald-500/20">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start justify-between text-center md:text-right">
                <div className="flex-1 w-full">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs md:text-sm font-medium text-emerald-50 mb-4 mx-auto md:mx-0">
                    <Book className="w-4 h-4" /> حفظ جديد
                  </div>
                  <h4 className="font-extrabold text-2xl md:text-3xl mb-2">{data.dailyTarget.surah}</h4>
                  <p className="text-emerald-100 font-medium text-base md:text-lg mb-6">{data.dailyTarget.verses}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium text-emerald-100">
                      <span>التقدم الإجمالي</span>
                      <span>{data.dailyTarget.progress}%</span>
                    </div>
                    <div className="w-full bg-emerald-900/40 rounded-full h-3 backdrop-blur-sm p-0.5">
                      <div className="bg-white h-2 rounded-full relative transition-all duration-1000 ease-out" style={{ width: `${data.dailyTarget.progress}%` }}>
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 bg-white rounded-full shadow" />
                      </div>
                    </div>
                  </div>
                </div>
                <button className="w-full md:w-auto whitespace-nowrap px-8 py-4 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors shadow-sm">
                  متابعة الحفظ
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          {/* New Mushaf & Tafsir Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 border border-slate-700/60 shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Book className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  جديد
                </span>
                <h4 className="font-bold text-sm text-white">تفسير مصحف المدينة</h4>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              تصفح القرآن الكريم بالرسم العثماني مع التفسير الميسر المعتمد ومساعد التدبر الذكي.
            </p>
            <a
              href="/mushaf"
              className="inline-flex items-center justify-center w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
            >
              فتح مصحف المدينة وتفسيره ←
            </a>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 md:p-8">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-6">الملاحظات التجويدية</h3>
            <div className="space-y-4">
              {data.alerts.map((alert, idx) => (
                <div key={idx} className={`group relative p-5 rounded-2xl ${alert.type === 'warning' ? 'bg-orange-50/50 border-orange-100 hover:bg-orange-50' : 'bg-blue-50/50 border-blue-100 hover:bg-blue-50'} border transition-colors cursor-pointer`}>
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full ${alert.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center shrink-0`}>
                      {alert.type === 'warning' ? <Activity className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                    </div>
                    <div>
                      <h5 className={`font-bold ${alert.type === 'warning' ? 'text-orange-900' : 'text-blue-900'} mb-1`}>{alert.title}</h5>
                      <p className={`text-sm ${alert.type === 'warning' ? 'text-orange-700/80' : 'text-blue-700/80'} leading-relaxed`}>{alert.description}</p>
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
