import { Link, useLocation } from 'react-router-dom';
import { Home, Mic, Award, Smile, BookOpen, BookMarked } from 'lucide-react';

export default function MobileNav() {
  const location = useLocation();
  const links = [
    { name: 'المتابعة', path: '/', icon: Home },
    { name: 'المصحف', path: '/mushaf', icon: BookMarked },
    { name: 'التجويد', path: '/tajweed', icon: Mic },
    { name: 'المعلم', path: '/teacher', icon: BookOpen },
    { name: 'الإجازة', path: '/ijazah', icon: Award },
    { name: 'الأطفال', path: '/kids', icon: Smile },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-1 py-1 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]" dir="rtl">
      <nav className="flex justify-around items-center">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 rounded-lg mb-0.5 transition-all duration-300 ${isActive ? 'bg-emerald-500/20 translate-y-0' : 'bg-transparent translate-y-0.5'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'fill-emerald-500/10 text-emerald-400' : ''}`} />
              </div>
              <span className={`text-[9px] font-bold transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
