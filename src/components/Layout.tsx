import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, LogOut, LayoutDashboard, Utensils, Dumbbell, 
  Droplets, Settings as SettingsIcon, ShieldAlert, Flame, Plus, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/src/lib/AuthContext';
import { logout } from '@/src/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, profile, isAdmin } = useAuth();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Default to dark for the Neo-Athletic aesthetic
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'food', label: 'Nutrition', icon: Utensils },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'water', label: 'Hydration', icon: Droplets },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#08090E] text-zinc-100 selection:bg-[#CCFF00] selection:text-black">
      {/* ========================================================= */}
      {/* DESKTOP ATHLETIC SIDEBAR (Hidden on mobile)               */}
      {/* ========================================================= */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-72 border-r border-zinc-800/80 bg-zinc-950/90 backdrop-blur-2xl p-6 flex-col justify-between z-50 shadow-2xl">
        <div className="space-y-8">
          {/* Logo & Brand HUD */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-[#CCFF00] flex items-center justify-center text-black font-black text-xl shadow-[0_0_20px_rgba(204,255,0,0.4)]">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white uppercase">NutriTrack</span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">ATHLETIC HUD</p>
            </div>
          </div>

          {/* User Profile Quick Card */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 flex items-center gap-3 shadow-inner">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-white">
                {profile?.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{profile?.displayName || 'Athletic User'}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-bold">
                <Flame className="w-3 h-3 fill-orange-400" />
                <span>7d</span>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full relative flex items-center gap-3.5 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                    isActive 
                      ? 'text-black bg-[#CCFF00] shadow-[0_0_20px_rgba(204,255,0,0.35)]' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-black stroke-[2.5]' : 'text-zinc-400'}`} />
                  <span className="tracking-wide">{item.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="desktop-active-dot" 
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-black" 
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Footer Controls */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleTheme} 
            className="w-full justify-start gap-2.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/80 rounded-xl"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#CCFF00]" /> : <Moon className="w-4 h-4" />}
            {isDark ? 'OLED Athletic Dark' : 'Light Mode'}
          </Button>
          {user && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout} 
              className="w-full justify-start gap-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE TOP STATUS BAR                                     */}
      {/* ========================================================= */}
      <header className="md:hidden sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-2xl px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#CCFF00] flex items-center justify-center text-black font-black text-sm shadow-[0_0_15px_rgba(204,255,0,0.35)]">
            N
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white leading-tight">NutriTrack</h1>
            <span className="text-[9px] font-mono text-[#CCFF00] uppercase tracking-wider">PRO ATHLETIC</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-orange-400 animate-pulse" />
            <span>7d</span>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 rounded-xl text-zinc-400 hover:text-white">
            {isDark ? <Sun className="w-4 h-4 text-[#CCFF00]" /> : <Moon className="w-4 h-4" />}
          </Button>

          {user && (
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 rounded-xl text-red-400 hover:text-red-300">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA                                         */}
      {/* ========================================================= */}
      <main className="md:pl-72 pb-28 md:pb-8 min-h-screen">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MOBILE-FIRST FLOATING BOTTOM DOCK (NEO-ATHLETIC)           */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50">
        <div className="p-2 rounded-3xl bg-zinc-950/95 border border-zinc-800/90 shadow-[0_15px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative p-2.5 flex flex-col items-center gap-0.5 rounded-2xl transition-all"
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-active-dock"
                    className="absolute inset-0 rounded-2xl bg-[#CCFF00]/15 border border-[#CCFF00]/40"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}
                <item.icon className={`w-5 h-5 relative z-10 transition-colors ${
                  isActive ? 'text-[#CCFF00] stroke-[2.5]' : 'text-zinc-500'
                }`} />
                <span className={`text-[9px] relative z-10 font-extrabold tracking-tight transition-colors ${
                  isActive ? 'text-[#CCFF00]' : 'text-zinc-500'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Center Quick Action Trigger */}
          <button
            onClick={() => setActiveTab('food')}
            className="w-11 h-11 rounded-2xl bg-[#CCFF00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.4)] active:scale-90 transition-transform"
            title="Log Meal with AI"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
      </nav>
    </div>
  );
};
