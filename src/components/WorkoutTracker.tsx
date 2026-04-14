import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dumbbell, Clock, Flame, Plus, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { handleFirestoreError, OperationType } from '@/src/lib/firestore-errors';
import { WorkoutLog } from '@/src/types';

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

  const deleteWorkout = async (id: string) => {
    if (!user || !id) return;
    const path = `users/${user.uid}/workoutLogs/${id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success('Workout deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Workouts
          </CardTitle>
          <CardDescription>Your physical activity history.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workoutLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No workouts logged yet.</p>
              </div>
            ) : (
              workoutLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold">{log.exercise}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {log.duration} mins
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {log.caloriesBurned} kcal
                        </span>
                        <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => log.id && deleteWorkout(log.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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