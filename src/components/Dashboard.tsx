import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { FoodLog, WorkoutLog, WaterLog } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Utensils, Dumbbell, Droplets, Flame, Target, TrendingUp, Info, ChevronRight } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);
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
  const totalProtein = todayFood.reduce((sum, log) => sum + (log.protein || 0), 0);
  const totalCarbs = todayFood.reduce((sum, log) => sum + (log.carbs || 0), 0);
  const totalFats = todayFood.reduce((sum, log) => sum + (log.fats || 0), 0);
  
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
        <Card 
          className="relative overflow-hidden border-none bg-primary/10 cursor-pointer hover:bg-primary/15 transition-colors group"
          onClick={() => setIsNutritionOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Calories</CardTitle>
            <Flame className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{netCalories} kcal</div>
              <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
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

        <Card 
          className="border-none bg-orange-500/10 dark:bg-orange-500/20 cursor-pointer hover:bg-orange-500/15 transition-colors group"
          onClick={() => setIsNutritionOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calorie Goal</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{calorieGoal} kcal</div>
              <ChevronRight className="h-4 w-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, calorieGoal - netCalories)} kcal remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Nutrition Summary Dialog */}
      <Dialog open={isNutritionOpen} onOpenChange={setIsNutritionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Daily Nutrition Summary</DialogTitle>
            <DialogDescription>
              Detailed breakdown for {format(today, 'MMMM do, yyyy')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Macro Totals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] font-bold uppercase text-blue-500 mb-1">Protein</span>
                <span className="text-xl font-bold">{totalProtein}g</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                <span className="text-[10px] font-bold uppercase text-green-500 mb-1">Carbs</span>
                <span className="text-xl font-bold">{totalCarbs}g</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <span className="text-[10px] font-bold uppercase text-orange-500 mb-1">Fats</span>
                <span className="text-xl font-bold">{totalFats}g</span>
              </div>
            </div>

            {/* Food Wise Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Utensils className="w-4 h-4 text-primary" />
                Logged Foods
              </h4>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {todayFood.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm italic">
                      No foods logged today yet.
                    </p>
                  ) : (
                    todayFood.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl border bg-card/50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm">{log.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{log.mealType}</p>
                          </div>
                          <span className="text-sm font-bold text-primary">{log.calories} kcal</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="flex justify-between border-r pr-2">
                            <span className="text-muted-foreground">P:</span>
                            <span className="font-medium">{log.protein}g</span>
                          </div>
                          <div className="flex justify-between border-r px-2">
                            <span className="text-muted-foreground">C:</span>
                            <span className="font-medium">{log.carbs}g</span>
                          </div>
                          <div className="flex justify-between pl-2">
                            <span className="text-muted-foreground">F:</span>
                            <span className="font-medium">{log.fats}g</span>
                          </div>
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
