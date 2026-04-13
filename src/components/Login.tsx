import React from 'react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/src/lib/firebase';
import { motion } from 'motion/react';
import { Flame, Utensils, Dumbbell, Droplets } from 'lucide-react';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 text-center"
      >
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/20">
            <Flame className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            NutriTrack <span className="text-primary">AI</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Your intelligent companion for a healthier lifestyle. Track calories, workouts, and hydration with ease.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 py-8">
          {[
            { icon: Utensils, label: 'AI Nutrition', color: 'text-orange-500' },
            { icon: Dumbbell, label: 'Workouts', color: 'text-green-500' },
            { icon: Droplets, label: 'Hydration', color: 'text-blue-500' },
            { icon: Flame, label: 'Calorie Tracking', color: 'text-primary' },
          ].map((item, i) => (
            <motion.div 
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border shadow-sm"
            >
              <item.icon className={`w-6 h-6 ${item.color}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </motion.div>
          ))}
        </div>

        <Button 
          onClick={signInWithGoogle} 
          size="lg" 
          className="w-full h-14 rounded-full text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          Get Started with Google
        </Button>

        <p className="text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};
