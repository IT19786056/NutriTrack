import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dumbbell, Clock, Flame, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';

export const WorkoutTracker: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [workout, setWorkout] = useState({
    exercise: '',
    duration: '',
    caloriesBurned: ''
  });

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
      toast.success('Workout logged!');
      setIsOpen(false);
      setWorkout({ exercise: '', duration: '', caloriesBurned: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const quickWorkouts = [
    { name: 'Running', icon: '🏃', calsPerMin: 10 },
    { name: 'Cycling', icon: '🚴', calsPerMin: 8 },
    { name: 'Weightlifting', icon: '🏋️', calsPerMin: 5 },
    { name: 'Swimming', icon: '🏊', calsPerMin: 12 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workouts</h2>
          <p className="text-muted-foreground">Track your physical activity and calories burned.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Log Workout
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickWorkouts.map((w) => (
          <Card key={w.name} className="hover:border-primary transition-colors cursor-pointer" onClick={() => {
            setWorkout({ ...workout, exercise: w.name });
            setIsOpen(true);
          }}>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <span className="text-4xl mb-2">{w.icon}</span>
              <h3 className="font-bold">{w.name}</h3>
              <p className="text-xs text-muted-foreground">~{w.calsPerMin} kcal/min</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Workout</DialogTitle>
            <DialogDescription>Enter the details of your exercise session.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="exercise">Exercise Name</Label>
              <Input id="exercise" placeholder="e.g. Morning Run" value={workout.exercise} onChange={e => setWorkout({...workout, exercise: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (mins)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="duration" type="number" className="pl-9" value={workout.duration} onChange={e => setWorkout({...workout, duration: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calories">Calories Burned</Label>
                <div className="relative">
                  <Flame className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="calories" type="number" className="pl-9" value={workout.caloriesBurned} onChange={e => setWorkout({...workout, caloriesBurned: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkout}>Log Workout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
