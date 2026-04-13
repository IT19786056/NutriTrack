import React, { useState, useEffect } from 'react';
import { Sun, Moon, LogOut, LayoutDashboard, Utensils, Dumbbell, Droplets, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
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
  const { user, isAdmin } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Sidebar / Bottom Nav */}
      <aside className="fixed bottom-0 left-0 z-50 w-full border-t bg-card/80 backdrop-blur-md md:top-0 md:bottom-auto md:h-screen md:w-64 md:border-r md:border-t-0 p-4">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="hidden md:flex items-center gap-2 mb-8 px-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">N</div>
              <h1 className="text-xl font-bold tracking-tight">NutriTrack AI</h1>
            </div>
            
            <nav className="flex md:flex-col justify-around md:gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col md:flex-row items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    activeTab === item.id 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="justify-start gap-2">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={logout} className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pb-24 md:pb-8 md:pl-72 min-h-screen">
        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md p-4 md:px-8 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">N</div>
            <h1 className="text-lg font-bold">NutriTrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            {user && (
              <Button variant="ghost" size="icon" onClick={logout} className="text-destructive">
                <LogOut className="w-5 h-5" />
              </Button>
            )}
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
