import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Droplets, Plus, GlassWater, Trophy, Sparkles, Flame, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { WaterLog } from '@/src/types';
import { isSameDay } from 'date-fns';

export const WaterTracker: React.FC = () => {
  const { user, profile } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [todayLogs, setTodayLogs] = useState<WaterLog[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/waterLogs`),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaterLog));
      const today = new Date();
      setTodayLogs(logs.filter(l => isSameDay(new Date(l.timestamp), today)));
    });
    return () => unsub();
  }, [user]);

  const waterGoal = profile?.dailyWaterGoal || 2000;
  const totalWaterToday = todayLogs.reduce((sum, l) => sum + l.amount, 0);
  const percentComplete = Math.min(100, Math.round((totalWaterToday / waterGoal) * 100));

  const triggerCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#00F5FF', '#CCFF00', '#00D2FF', '#FFFFFF']
    });
    toast.success(`🎉 Hydration Goal Smashed! (${totalWaterToday}ml logged)`, {
      icon: '🏆',
      duration: 4000
    });
  };

  const addWater = async (amount: number) => {
    if (!user) return;
    setIsAdding(true);
    const path = `users/${user.uid}/waterLogs`;
    try {
      await addDoc(collection(db, path), {
        uid: user.uid,
        amount,
        timestamp: new Date().toISOString()
      });
      toast.success(`+${amount}ml Logged!`, { icon: '💧' });
      if (totalWaterToday + amount >= waterGoal && totalWaterToday < waterGoal) {
        triggerCelebration();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsAdding(false);
    }
  };

  const presets = [
    { label: 'Standard Glass', amount: 250, icon: GlassWater, tag: 'Quick Sip' },
    { label: 'Sport Bottle', amount: 500, icon: Droplets, tag: 'Hydrate' },
    { label: 'Athletic Hydro Flask', amount: 1000, icon: Droplets, tag: 'Power Load' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#00F5FF] uppercase tracking-widest font-bold">HYDRATION REACTOR</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">Hydration Telemetry</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Keep cellular hydration high for maximum athletic output.</p>
        </div>

        {percentComplete >= 100 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>DAILY TARGET MET</span>
          </div>
        )}
      </div>

      {/* Main Hydration Cylinder Hero Card */}
      <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center sm:text-left">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">Today's Fluid Status</span>
              <div className="flex items-baseline justify-center sm:justify-start gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">{totalWaterToday}</span>
                <span className="text-base text-zinc-400 font-bold">/ {waterGoal} ml</span>
              </div>
              <p className="text-xs text-zinc-400">
                {Math.max(0, waterGoal - totalWaterToday)} ml remaining to hit target ({percentComplete}% complete)
              </p>
              
              <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                <button 
                  onClick={() => addWater(250)}
                  disabled={isAdding}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold border border-cyan-500/30 active:scale-95 transition-all"
                >
                  +250ml Fast Log
                </button>
                <button 
                  onClick={() => triggerCelebration()}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold border border-zinc-800 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Test Burst
                </button>
              </div>
            </div>

            {/* Cylinder Animation */}
            <div className="w-20 h-36 rounded-3xl bg-zinc-900 border-2 border-cyan-500/40 p-1 flex flex-col justify-end overflow-hidden shadow-[0_0_25px_rgba(0,245,255,0.25)] relative">
              <motion.div 
                animate={{ height: `${percentComplete}%` }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-full bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-300 rounded-2xl relative"
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </motion.div>
              <div className="absolute top-2 left-0 right-0 text-center pointer-events-none">
                <span className="text-[10px] font-black text-white/70 font-mono">{percentComplete}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preset Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {presets.map((p) => (
          <motion.div key={p.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Card 
              className="cursor-pointer rounded-3xl border-zinc-800 bg-zinc-900/90 hover:border-cyan-500/50 transition-all shadow-xl group" 
              onClick={() => addWater(p.amount)}
            >
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <p.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold">{p.tag}</span>
                  <h3 className="font-extrabold text-white text-base mt-0.5">{p.label}</h3>
                  <p className="text-xl font-black text-cyan-400 mt-0.5">{p.amount} ml</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl border-cyan-500/30 text-cyan-300 hover:bg-cyan-500 hover:text-black font-extrabold text-xs h-9" 
                  disabled={isAdding}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" /> Log Intake
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Athletic Hydration Tip */}
      <Card className="rounded-3xl bg-zinc-950/80 border-zinc-800/80 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-400" />
            Athletic Hydration Protocol
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Maintaining plasma volume through steady water intake supports thermoregulation and prevents muscular fatigue. Aim for 500ml upon waking and 250ml every 2 hours throughout your active training window.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
