import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dumbbell, Clock, Flame, Plus, Trash2, Calendar, Sparkles, Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { WorkoutLog } from '@/src/types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

export const WorkoutTracker: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [workout, setWorkout] = useState({
    exercise: '',
    duration: '',
    caloriesBurned: ''
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/workoutLogs`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWorkoutLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/workoutLogs`);
    });

    return () => unsubscribe();
  }, [user]);

  const triggerWorkoutCelebration = (exercise: string, cals: number) => {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#CCFF00', '#FF3B30', '#FFA500', '#FFFFFF']
    });
    toast.success(`⚡ ${exercise} Logged! (${cals} kcal incinerated)`, {
      icon: '🔥',
      duration: 3500
    });
  };

  const saveWorkout = async () => {
    if (!user || !workout.exercise || !workout.caloriesBurned) return;

    const path = `users/${user.uid}/workoutLogs`;
    try {
      await addDoc(collection(db, path), {
        uid: user.uid,
        exercise: workout.exercise,
        duration: Number(workout.duration || 0),
        caloriesBurned: Number(workout.caloriesBurned),
        timestamp: new Date().toISOString()
      });
      triggerWorkoutCelebration(workout.exercise, Number(workout.caloriesBurned));
      setIsOpen(false);
      setWorkout({ exercise: '', duration: '', caloriesBurned: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteWorkout = async (id: string) => {
    if (!user || !id) return;
    const path = `users/${user.uid}/workoutLogs/${id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success('Workout session removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const quickWorkouts = [
    { name: 'Running', icon: '🏃', calsPerMin: 11, tag: 'High Cardio' },
    { name: 'Cycling', icon: '🚴', calsPerMin: 9, tag: 'Endurance' },
    { name: 'Weightlifting', icon: '🏋️', calsPerMin: 6, tag: 'Hypertrophy' },
    { name: 'HIIT Circuit', icon: '⚡', calsPerMin: 14, tag: 'Peak Burn' },
  ];

  const handleQuickWorkoutSelect = (name: string, calsPerMin: number) => {
    setWorkout({
      exercise: name,
      duration: '30',
      caloriesBurned: (calsPerMin * 30).toString()
    });
    setIsOpen(true);
  };

  const totalBurnToday = workoutLogs.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const totalMinsToday = workoutLogs.reduce((sum, w) => sum + (w.duration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#CCFF00] uppercase tracking-widest font-bold">KINETIC TELEMETRY</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">Training Sessions</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Track exertion, duration, and metabolic burn.</p>
        </div>

        <Button 
          onClick={() => setIsOpen(true)} 
          className="rounded-2xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs h-10 px-5 shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 transition-all"
        >
          <Plus className="mr-2 h-4 w-4 stroke-[3]" />
          Log Workout Session
        </Button>
      </div>

      {/* Quick Workout Presets Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">Quick Presets (Tap to Pre-fill)</span>
          <span className="text-[11px] text-zinc-500">{workoutLogs.length} total logged</span>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {quickWorkouts.map((w) => (
            <motion.div key={w.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Card 
                className="hover:border-[#CCFF00]/50 transition-all cursor-pointer rounded-3xl bg-zinc-900/90 border-zinc-800 shadow-xl group p-4" 
                onClick={() => handleQuickWorkoutSelect(w.name, w.calsPerMin)}
              >
                <CardContent className="p-2 flex flex-col items-center text-center gap-2">
                  <span className="text-4xl group-hover:scale-110 transition-transform mb-1">{w.icon}</span>
                  <div>
                    <span className="text-[9px] font-mono uppercase text-[#CCFF00] font-bold">{w.tag}</span>
                    <h3 className="font-extrabold text-white text-base">{w.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">~{w.calsPerMin} kcal / min</p>
                  <span className="text-[10px] text-zinc-500">Tap to auto-estimate</span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Workouts History */}
      <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#CCFF00]" />
              Recent Training Telemetry
            </CardTitle>
            <span className="text-xs font-mono text-zinc-400">
              Total Logged: <strong className="text-white">{totalBurnToday} kcal</strong>
            </span>
          </div>
          <CardDescription className="text-xs text-zinc-400">Your physical exertion history</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {workoutLogs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20 text-[#CCFF00]" />
                <p className="text-sm font-bold text-zinc-400">No workout telemetry recorded yet.</p>
                <p className="text-xs text-zinc-500 mt-1">Tap one of the quick presets above or log a custom session.</p>
              </div>
            ) : (
              workoutLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/25 flex items-center justify-center text-[#CCFF00]">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{log.exercise}</h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {log.duration} mins
                        </span>
                        <span>•</span>
                        <span>{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-black text-[#FF3B30] flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-[#FF3B30]" />
                        {log.caloriesBurned} kcal
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {log.duration ? `${Math.round(log.caloriesBurned / log.duration)} kcal/min` : ''}
                      </span>
                    </div>

                    <button 
                      onClick={() => deleteWorkout(log.id)}
                      className="opacity-40 group-hover:opacity-100 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Workout Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#CCFF00]" />
              Record Workout Session
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Input exercise details to calibrate your net calorie burn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="exercise" className="text-xs font-bold text-zinc-300">Exercise Name</Label>
              <Input
                id="exercise"
                placeholder="e.g. HIIT Sprint, Bench Press, 5km Run"
                value={workout.exercise}
                onChange={(e) => setWorkout({ ...workout, exercise: e.target.value })}
                className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-xs font-bold text-zinc-300">Duration (Minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="30"
                  value={workout.duration}
                  onChange={(e) => {
                    const dur = e.target.value;
                    const cals = workout.caloriesBurned || (dur ? (Number(dur) * 8).toString() : '');
                    setWorkout({ ...workout, duration: dur, caloriesBurned: cals });
                  }}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="caloriesBurned" className="text-xs font-bold text-zinc-300">Calories Burned</Label>
                <Input
                  id="caloriesBurned"
                  type="number"
                  placeholder="250"
                  value={workout.caloriesBurned}
                  onChange={(e) => setWorkout({ ...workout, caloriesBurned: e.target.value })}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl text-zinc-400">
              Cancel
            </Button>
            <Button 
              onClick={saveWorkout} 
              className="rounded-xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_15px_rgba(204,255,0,0.3)]"
            >
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};