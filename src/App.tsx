/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import Tajweed from './pages/Tajweed';
import Ijazah from './pages/Ijazah';
import KidsMode from './pages/KidsMode';
import InteractiveTeacher from './pages/InteractiveTeacher';

export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden" dir="rtl">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 h-full relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tajweed" element={<Tajweed />} />
            <Route path="/ijazah" element={<Ijazah />} />
            <Route path="/kids" element={<KidsMode />} />
            <Route path="/teacher" element={<InteractiveTeacher />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </Router>
  );
}
