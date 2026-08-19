import { Link, useLocation } from 'react-router-dom';
import { Home, Mic, Award, Smile, BookOpen, Settings } from 'lucide-react';
import QuranRadio from './QuranRadio';

export default function Sidebar() {
  const location = useLocation();

  const links = [
    { name: 'لوحة المتابعة', path: '/', icon: Home },
    { name: 'التسميع والتجويد', path: '/tajweed', icon: Mic },
    { name: 'المعلم التفاعلي', path: '/teacher', icon: BookOpen },
    { name: 'طلب الإجازة', path: '/ijazah', icon: Award },
    { name: 'واجهة الأطفال', path: '/kids', icon: Smile },
  ];

  return (
    <div className="hidden md:flex w-72 h-screen bg-slate-900 text-slate-300 flex-col font-sans border-l border-slate-800 shrink-0" dir="rtl">
      <div className="p-8 flex items-center gap-4 border-b border-slate-800/50">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">ترتيل <span className="text-emerald-400 font-light">AI</span></h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-6">
        <nav className="space-y-1">
          <div className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">القائمة الرئيسية</div>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 font-bold' 
                    : 'hover:bg-slate-800/50 hover:text-white font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{link.name}</span>
                {isActive && (
                  <div className="mr-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <QuranRadio />
        </div>
      </div>

      <div className="p-4 border-t border-slate-800/50">
        <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-800/50 transition-colors text-right">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed&backgroundColor=10b981" alt="User" className="w-10 h-10 rounded-full bg-slate-800" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">أحمد محمود</p>
            <p className="text-xs text-slate-400">طالب قرآن</p>
          </div>
          <Settings className="w-5 h-5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
