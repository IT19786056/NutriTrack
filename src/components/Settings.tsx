import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Target, Scale, Ruler, ShieldCheck, Flame, Droplets, Check, Loader2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    dailyCalorieGoal: profile?.dailyCalorieGoal || 2000,
    dailyWaterGoal: profile?.dailyWaterGoal || 2000,
    weight: profile?.weight || '',
    height: profile?.height || '',
  });

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        dailyCalorieGoal: Number(formData.dailyCalorieGoal),
        dailyWaterGoal: Number(formData.dailyWaterGoal),
        weight: Number(formData.weight),
        height: Number(formData.height),
      });
      toast.success('Athletic telemetry & profile targets calibrated!');
    } catch (error) {
      toast.error('Failed to update athletic profile.');
    } finally {
      setLoading(false);
    }
  };

  const adjustCalorieGoal = (delta: number) => {
    const next = Math.max(1000, Number(formData.dailyCalorieGoal) + delta);
    setFormData({ ...formData, dailyCalorieGoal: next });
  };

  const adjustWaterGoal = (delta: number) => {
    const next = Math.max(1000, Number(formData.dailyWaterGoal) + delta);
    setFormData({ ...formData, dailyWaterGoal: next });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#CCFF00] uppercase tracking-widest font-bold">SYSTEM CALIBRATION</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">Profile & Goal Targets</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Calibrate your athletic profile and daily macro/hydration benchmarks.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Biometrics & Profile Card */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-zinc-800/80 pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#CCFF00]" />
              Athletic Biometrics
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">Your physical credentials and public telemetry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-zinc-300">Display Name / Athlete Alias</Label>
              <Input 
                id="name" 
                value={formData.displayName} 
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-zinc-500" /> Body Weight (kg)
                </Label>
                <Input 
                  id="weight" 
                  type="number" 
                  placeholder="75"
                  value={formData.weight} 
                  onChange={e => setFormData({...formData, weight: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="height" className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-zinc-500" /> Stature / Height (cm)
                </Label>
                <Input 
                  id="height" 
                  type="number" 
                  placeholder="180"
                  value={formData.height} 
                  onChange={e => setFormData({...formData, height: e.target.value})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#CCFF00]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-[#CCFF00] shrink-0" />
              <span>Telemetry data is secured and encrypted with Firestore security rules.</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Goal Benchmarks Card */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-zinc-800/80 pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-[#CCFF00]" />
              Telemetry Benchmarks
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">Adjust baseline calorie and hydration ring targets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {/* Calorie Goal Stepper */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <Label htmlFor="calorieGoal" className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#FF3B30]" /> Daily Calorie Target (kcal)
                </Label>
                <span className="font-mono text-[#CCFF00] font-bold">{formData.dailyCalorieGoal} kcal</span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => adjustCalorieGoal(-100)} 
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  -100
                </button>
                <Input 
                  id="calorieGoal" 
                  type="number" 
                  value={formData.dailyCalorieGoal} 
                  onChange={e => setFormData({...formData, dailyCalorieGoal: Number(e.target.value)})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white text-center font-mono font-bold"
                />
                <button 
                  type="button" 
                  onClick={() => adjustCalorieGoal(100)} 
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  +100
                </button>
              </div>
            </div>

            {/* Hydration Goal Stepper */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <Label htmlFor="waterGoal" className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-[#00F5FF]" /> Daily Hydration Target (ml)
                </Label>
                <span className="font-mono text-[#00F5FF] font-bold">{formData.dailyWaterGoal} ml</span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => adjustWaterGoal(-250)} 
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  -250
                </button>
                <Input 
                  id="waterGoal" 
                  type="number" 
                  value={formData.dailyWaterGoal} 
                  onChange={e => setFormData({...formData, dailyWaterGoal: Number(e.target.value)})}
                  className="rounded-xl bg-zinc-900 border-zinc-800 text-white text-center font-mono font-bold"
                />
                <button 
                  type="button" 
                  onClick={() => adjustWaterGoal(250)} 
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  +250
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSave} 
          disabled={loading} 
          className="h-11 px-8 rounded-2xl bg-[#CCFF00] text-black hover:bg-[#b8e600] font-black text-xs shadow-[0_0_20px_rgba(204,255,0,0.35)] active:scale-95 transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Calibrating...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5 stroke-[3]" /> Save Calibration
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
