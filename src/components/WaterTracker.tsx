import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Droplets, Plus, GlassWater } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export const WaterTracker: React.FC = () => {
  const { user, profile } = useAuth();
  const [isAdding, setIsAdding] = useState(false);

  const addWater = async (amount: number) => {
    if (!user) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/waterLogs`), {
        uid: user.uid,
        amount,
        timestamp: new Date().toISOString()
      });
      toast.success(`Logged ${amount}ml of water!`);
    } catch (error) {
      toast.error('Failed to log water.');
    } finally {
      setIsAdding(false);
    }
  };

  const presets = [
    { label: 'Glass', amount: 250, icon: GlassWater },
    { label: 'Small Bottle', amount: 500, icon: Droplets },
    { label: 'Large Bottle', amount: 1000, icon: Droplets },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Hydration</h2>
        <p className="text-muted-foreground">Stay hydrated to maintain peak performance.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {presets.map((p) => (
          <motion.div key={p.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => addWater(p.amount)}>
              <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <p.icon className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{p.label}</h3>
                  <p className="text-2xl font-bold text-blue-500">{p.amount} ml</p>
                </div>
                <Button variant="outline" className="w-full rounded-full border-blue-500/20 hover:bg-blue-500 hover:text-white" disabled={isAdding}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            Hydration Tip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Drinking water before meals can help with weight management and digestion. Aim for at least {profile?.dailyWaterGoal || 2000}ml daily.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
