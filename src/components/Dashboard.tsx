import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { FoodLog, WorkoutLog, WaterLog } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Utensils, Dumbbell, Droplets, Flame, Target, TrendingUp, Sparkles, Trophy, ChevronRight, X, Plus } from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const foodQuery = query(
      collection(db, `users/${user.uid}/foodLogs`),
      orderBy('timestamp', 'desc')
    );
    const workoutQuery = query(
      collection(db, `users/${user.uid}/workoutLogs`),
      orderBy('timestamp', 'desc')
    );
    const waterQuery = query(
      collection(db, `users/${user.uid}/waterLogs`),
      orderBy('timestamp', 'desc')
    );

    const unsubFood = onSnapshot(foodQuery, (snapshot) => {
      setFoodLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog)));
    });
    const unsubWorkout = onSnapshot(workoutQuery, (snapshot) => {
      setWorkoutLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutLog)));
    });
    const unsubWater = onSnapshot(waterQuery, (snapshot) => {
      setWaterLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaterLog)));
    });

    return () => {
      unsubFood();
      unsubWorkout();
      unsubWater();
    };
  }, [user]);

  const today = new Date();
  const todayFood = foodLogs.filter(log => isSameDay(new Date(log.timestamp), today));
  const todayWorkout = workoutLogs.filter(log => isSameDay(new Date(log.timestamp), today));
  const todayWater = waterLogs.filter(log => isSameDay(new Date(log.timestamp), today));

  const consumedCalories = todayFood.reduce((sum, log) => sum + log.calories, 0);
  const totalProtein = todayFood.reduce((sum, log) => sum + (log.protein || 0), 0);
  const totalCarbs = todayFood.reduce((sum, log) => sum + (log.carbs || 0), 0);
  const totalFats = todayFood.reduce((sum, log) => sum + (log.fats || 0), 0);
  
  const burnedCalories = todayWorkout.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const workoutMinutes = todayWorkout.reduce((sum, log) => sum + (log.duration || 0), 0);
  const totalWater = todayWater.reduce((sum, log) => sum + log.amount, 0);
  
  const netCalories = consumedCalories - burnedCalories;
  const calorieGoal = profile?.dailyCalorieGoal || 2000;
  const waterGoal = profile?.dailyWaterGoal || 2000;
  const workoutGoal = 45; // Daily athletic target in minutes

  // Calculated Ring Percentages (Capped at 100 for SVG offsets)
  const calPercent = Math.min(100, Math.max(0, Math.round((consumedCalories / calorieGoal) * 100)));
  const waterPercent = Math.min(100, Math.max(0, Math.round((totalWater / waterGoal) * 100)));
  const workoutPercent = Math.min(100, Math.max(0, Math.round((workoutMinutes / workoutGoal) * 100)));
  const avgActivityScore = Math.round((calPercent + waterPercent + workoutPercent) / 3);

  // Quick Water Logging helper
  const addWaterQuick = async (amount: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/waterLogs`), {
        uid: user.uid,
        amount,
        timestamp: new Date().toISOString()
      });
      toast.success(`+${amount}ml Logged!`, { icon: '💧' });
      if (totalWater + amount >= waterGoal && totalWater < waterGoal) {
        triggerGoalCelebration('🎉 Hydration Goal Achieved! (2,000ml Reached)');
      }
    } catch (e) {
      toast.error('Failed to log water');
    }
  };

  // Goal Celebration Trigger with Neon Particle Blast
  const triggerGoalCelebration = (msg: string) => {
    setCelebrationMessage(msg);
    confetti({
      particleCount: 110,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#CCFF00', '#00F5FF', '#FF3B30', '#A855F7', '#FFFFFF']
    });
    toast.success(msg, { icon: '🏆', duration: 4000 });
    setTimeout(() => {
      setCelebrationMessage(null);
    }, 4500);
  };

  // 7-day trend chart data
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(today, 6 - i);
    const dayFood = foodLogs.filter(log => isSameDay(new Date(log.timestamp), date));
    const dayWorkout = workoutLogs.filter(log => isSameDay(new Date(log.timestamp), date));
    
    return {
      name: format(date, 'EEE'),
      consumed: dayFood.reduce((sum, log) => sum + log.calories, 0),
      burned: dayWorkout.reduce((sum, log) => sum + log.caloriesBurned, 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* Floating Milestone Celebration Banner */}
      <AnimatePresence>
        {celebrationMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="p-4 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white shadow-2xl shadow-orange-500/30 border border-white/30 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                <Trophy className="w-5 h-5 text-yellow-200 animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-100">Milestone Unlocked!</p>
                <p className="text-sm font-black">{celebrationMessage}</p>
              </div>
            </div>
            <button onClick={() => setCelebrationMessage(null)} className="p-1 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Greeting & Athletic Streak Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#CCFF00] uppercase tracking-widest font-bold">ATHLETIC DASHBOARD</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
            Welcome back, {profile?.displayName || 'Champion'}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">Here is your high-performance telemetry for today.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <Flame className="w-4 h-4 text-orange-400 fill-orange-400 animate-pulse" />
            <span className="text-xs font-black text-white">7 DAYS ACTIVE</span>
          </div>
          <button 
            onClick={() => triggerGoalCelebration('⚡ Daily Athletic Target Smashed!')}
            className="px-3 py-1.5 rounded-2xl bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 text-[#CCFF00] border border-[#CCFF00]/30 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all"
            title="Test Celebration"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Celebrate</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. HERO ATHLETIC ACTIVITY RINGS (SPACIOUS & UNMASKED)     */}
      {/* ========================================================= */}
      <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden relative">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Concentric Activity Rings with Spacious Center */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                {/* Outer Ring: Calories / Move (Red #FF3B30) */}
                {/* Circumference = 2 * PI * 82 ≈ 515.22 */}
                <circle cx="100" cy="100" r="82" stroke="#331010" strokeWidth="11" fill="none" />
                <motion.circle 
                  cx="100" cy="100" r="82" 
                  stroke="#FF3B30" strokeWidth="11" strokeDasharray="515.22" 
                  animate={{ strokeDashoffset: 515.22 - (515.22 * (calPercent / 100)) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                  strokeLinecap="round" fill="none" 
                />

                {/* Middle Ring: Hydration (Cyan #00F5FF) */}
                {/* Circumference = 2 * PI * 64 ≈ 402.12 */}
                <circle cx="100" cy="100" r="64" stroke="#05283D" strokeWidth="11" fill="none" />
                <motion.circle 
                  cx="100" cy="100" r="64" 
                  stroke="#00F5FF" strokeWidth="11" strokeDasharray="402.12" 
                  animate={{ strokeDashoffset: 402.12 - (402.12 * (waterPercent / 100)) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                  strokeLinecap="round" fill="none" 
                />

                {/* Inner Ring: Workout / Burn (Lime #CCFF00) */}
                {/* Circumference = 2 * PI * 46 ≈ 289.03 */}
                <circle cx="100" cy="100" r="46" stroke="#1A3305" strokeWidth="11" fill="none" />
                <motion.circle 
                  cx="100" cy="100" r="46" 
                  stroke="#CCFF00" strokeWidth="11" strokeDasharray="289.03" 
                  animate={{ strokeDashoffset: 289.03 - (289.03 * (workoutPercent / 100)) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                  strokeLinecap="round" fill="none" 
                />
              </svg>

              {/* Crystal Clear, Unmasked Center Label Area (82px Clear Core) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-10">
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none">
                  {avgActivityScore}%
                </span>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                  AVG SCORE
                </span>
              </div>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              {/* Calories Metric Card */}
              <div 
                onClick={() => setIsNutritionOpen(true)}
                className="p-4 rounded-2xl bg-zinc-900/90 border border-red-500/20 hover:border-red-500/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-red-400">Calories</span>
                  <Flame className="w-4 h-4 text-red-400" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-black text-white">{consumedCalories}</span>
                  <span className="text-xs text-zinc-500 ml-1">/ {calorieGoal} kcal</span>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#FF3B30] h-full rounded-full" style={{ width: `${calPercent}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-zinc-400 flex items-center gap-1 group-hover:text-red-300">
                  {Math.max(0, calorieGoal - netCalories)} kcal left <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              {/* Hydration Metric Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Hydration</span>
                  <Droplets className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-black text-white">{totalWater}</span>
                  <span className="text-xs text-zinc-500 ml-1">/ {waterGoal} ml</span>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#00F5FF] h-full rounded-full" style={{ width: `${waterPercent}%` }} />
                  </div>
                </div>
                <div className="flex gap-1.5 mt-1">
                  <button 
                    onClick={() => addWaterQuick(250)}
                    className="flex-1 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[10px] font-black border border-cyan-500/30 active:scale-95 transition-all"
                  >
                    +250ml
                  </button>
                  <button 
                    onClick={() => addWaterQuick(500)}
                    className="flex-1 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[10px] font-black border border-cyan-500/30 active:scale-95 transition-all"
                  >
                    +500ml
                  </button>
                </div>
              </div>

              {/* Workouts Metric Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-[#CCFF00]/20 hover:border-[#CCFF00]/50 transition-all shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#CCFF00]">Workout</span>
                  <Dumbbell className="w-4 h-4 text-[#CCFF00]" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-black text-white">{workoutMinutes}</span>
                  <span className="text-xs text-zinc-500 ml-1">/ {workoutGoal} mins</span>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#CCFF00] h-full rounded-full" style={{ width: `${workoutPercent}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-zinc-400">
                  {todayWorkout.length} sessions • {burnedCalories} kcal burned
                </span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ========================================================= */}
      {/* 2. STATS & LIQUID CYLINDER GRID                           */}
      {/* ========================================================= */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Net Calorie HUD */}
        <Card 
          className="rounded-3xl border-zinc-800 bg-zinc-900/90 cursor-pointer hover:border-[#FF3B30]/50 transition-all group"
          onClick={() => setIsNutritionOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-400">Net Calories</CardTitle>
            <Flame className="h-4 w-4 text-[#FF3B30]" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black text-white">{netCalories} kcal</div>
              <ChevronRight className="h-4 w-4 text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {consumedCalories} in / {burnedCalories} out
            </p>
            <Progress value={(netCalories / calorieGoal) * 100} className="mt-3 h-2 bg-zinc-950 [&>div]:bg-[#FF3B30]" />
          </CardContent>
        </Card>

        {/* Liquid Wave Cylinder Card */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900/90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-400">Hydration Chamber</CardTitle>
            <Droplets className="h-4 w-4 text-[#00F5FF]" />
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-black text-cyan-400">{totalWater} ml</div>
              <p className="text-xs text-zinc-400">Goal: {waterGoal} ml ({waterPercent}%)</p>
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => addWaterQuick(250)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30"
                >
                  +250ml
                </button>
                <button 
                  onClick={() => addWaterQuick(500)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30"
                >
                  +500ml
                </button>
              </div>
            </div>

            {/* Cylinder Visual */}
            <div className="w-10 h-16 rounded-2xl bg-zinc-950 border-2 border-cyan-500/40 overflow-hidden relative flex flex-col justify-end p-0.5 shadow-[0_0_15px_rgba(0,245,255,0.2)]">
              <motion.div 
                animate={{ height: `${waterPercent}%` }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-full bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-300 rounded-xl relative"
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse" />
              </motion.div>
            </div>
          </CardContent>
        </Card>

        {/* Workout Sessions */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900/90">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-400">Athletic Training</CardTitle>
            <Dumbbell className="h-4 w-4 text-[#CCFF00]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{todayWorkout.length} sessions</div>
            <p className="text-xs text-zinc-400 mt-1">
              {burnedCalories} kcal incinerated today
            </p>
            <Progress value={workoutPercent} className="mt-3 h-2 bg-zinc-950 [&>div]:bg-[#CCFF00]" />
          </CardContent>
        </Card>

        {/* Macro Summary Pill */}
        <Card 
          className="rounded-3xl border-zinc-800 bg-zinc-900/90 cursor-pointer hover:border-purple-500/50 transition-all group"
          onClick={() => setIsNutritionOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-zinc-400">Macro Fuel</CardTitle>
            <Target className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black text-white">{totalProtein}g <span className="text-xs text-zinc-400 font-normal">protein</span></div>
              <ChevronRight className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {totalCarbs}g carbs • {totalFats}g fats
            </p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden mt-3 bg-zinc-950">
              <div className="bg-[#FF3B30] w-[35%]" />
              <div className="bg-[#00F5FF] w-[45%]" />
              <div className="bg-[#CCFF00] w-[20%]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================= */}
      {/* 3. NUTRITION SUMMARY DIALOG                               */}
      {/* ========================================================= */}
      <Dialog open={isNutritionOpen} onOpenChange={setIsNutritionOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#CCFF00]" />
              Daily Nutrition Summary
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Detailed macro breakdown for {format(today, 'MMMM do, yyyy')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            {/* Macro Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                <span className="text-[10px] font-black uppercase text-blue-400 mb-1">Protein</span>
                <span className="text-xl font-black text-white">{totalProtein}g</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-[10px] font-black uppercase text-emerald-400 mb-1">Carbs</span>
                <span className="text-xl font-black text-white">{totalCarbs}g</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30">
                <span className="text-[10px] font-black uppercase text-orange-400 mb-1">Fats</span>
                <span className="text-xl font-black text-white">{totalFats}g</span>
              </div>
            </div>

            {/* Food Wise Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                Logged Foods Today ({todayFood.length})
              </h4>
              <ScrollArea className="h-[280px] pr-2">
                <div className="space-y-2.5">
                  {todayFood.length === 0 ? (
                    <p className="text-center py-8 text-zinc-500 text-xs italic">
                      No foods logged today yet.
                    </p>
                  ) : (
                    todayFood.map((log) => (
                      <div key={log.id} className="p-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-xs text-white">{log.name}</p>
                            <p className="text-[10px] text-zinc-400 capitalize">{log.mealType}</p>
                          </div>
                          <span className="text-xs font-black text-[#CCFF00]">{log.calories} kcal</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-zinc-800/80">
                          <span className="text-zinc-400">P: <strong className="text-white">{log.protein || 0}g</strong></span>
                          <span className="text-zinc-400">C: <strong className="text-white">{log.carbs || 0}g</strong></span>
                          <span className="text-zinc-400">F: <strong className="text-white">{log.fats || 0}g</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 4. PERFORMANCE CHARTS (NEON ATHLETIC THEME)               */}
      {/* ========================================================= */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white">Calorie Velocity</CardTitle>
            <CardDescription className="text-xs text-zinc-400">Intake vs Expenditure over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" opacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#71717A" fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} stroke="#71717A" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: '#FFF' }}
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  />
                  <Bar dataKey="consumed" fill="#CCFF00" radius={[6, 6, 0, 0]} name="Consumed" />
                  <Bar dataKey="burned" fill="#FF3B30" radius={[6, 6, 0, 0]} name="Burned" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white">Net Energy Balance</CardTitle>
            <CardDescription className="text-xs text-zinc-400">Daily net deficit / surplus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNetAthletic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" opacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#71717A" fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} stroke="#71717A" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: '#FFF' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={(d) => d.consumed - d.burned} 
                    stroke="#00F5FF" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorNetAthletic)" 
                    name="Net Balance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
