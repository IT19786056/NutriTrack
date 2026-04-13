import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { FoodLog, WorkoutLog, WaterLog } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Utensils, Dumbbell, Droplets, Flame, Target, TrendingUp } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);

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
  const burnedCalories = todayWorkout.reduce((sum, log) => sum + log.caloriesBurned, 0);
  const totalWater = todayWater.reduce((sum, log) => sum + log.amount, 0);
  
  const netCalories = consumedCalories - burnedCalories;
  const calorieGoal = profile?.dailyCalorieGoal || 2000;
  const waterGoal = profile?.dailyWaterGoal || 2000;

  // Chart Data (Last 7 days)
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
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Welcome back, {profile?.displayName}</h2>
        <p className="text-muted-foreground">Here's your health summary for today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-none bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Calories</CardTitle>
            <Flame className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{netCalories} kcal</div>
            <p className="text-xs text-muted-foreground">
              {consumedCalories} in / {burnedCalories} out
            </p>
            <Progress value={(netCalories / calorieGoal) * 100} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="border-none bg-blue-500/10 dark:bg-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hydration</CardTitle>
            <Droplets className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWater} ml</div>
            <p className="text-xs text-muted-foreground">
              Goal: {waterGoal} ml
            </p>
            <Progress value={(totalWater / waterGoal) * 100} className="mt-3 h-2 bg-blue-500/20" />
          </CardContent>
        </Card>

        <Card className="border-none bg-green-500/10 dark:bg-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workouts</CardTitle>
            <Dumbbell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayWorkout.length} sessions</div>
            <p className="text-xs text-muted-foreground">
              {burnedCalories} kcal burned today
            </p>
          </CardContent>
        </Card>

        <Card className="border-none bg-orange-500/10 dark:bg-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calorie Goal</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calorieGoal} kcal</div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, calorieGoal - netCalories)} kcal remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Calorie Trends</CardTitle>
            <CardDescription>Intake vs Expenditure over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                  />
                  <Bar dataKey="consumed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Consumed" />
                  <Bar dataKey="burned" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Burned" opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
            <CardDescription>Net calorie balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={(d) => d.consumed - d.burned} 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorNet)" 
                    name="Net Calories"
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
