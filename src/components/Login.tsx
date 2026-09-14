import React from 'react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/src/lib/firebase';
import { motion } from 'motion/react';
import { Flame, Utensils, Dumbbell, Droplets, MailCheck, Zap, Activity } from 'lucide-react';

export const Login: React.FC = () => {
  const [invitedEmail, setInvitedEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const email = params.get('email');
      if (email && params.get('accept') === 'true') {
        setInvitedEmail(email.toLowerCase().trim());
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#08090E] text-zinc-100 overflow-hidden relative">
      {/* Bioluminescent Ambient Neon Mesh Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-[#CCFF00]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] bg-[#00F5FF]/10 rounded-full blur-[140px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full space-y-7 text-center"
      >
        {/* Brand Crest */}
        <div className="space-y-3">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-[#CCFF00] flex items-center justify-center text-black font-black text-3xl shadow-[0_0_35px_rgba(204,255,0,0.4)]">
            N
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
              NutriTrack <span className="text-[#CCFF00]">PRO</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
            High-performance AI telemetry for your daily nutrition, kinetic exertion, and cellular hydration.
          </p>
        </div>

        {/* Invitation Feedback Banner */}
        {invitedEmail && (
          <div className="p-4 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-left flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-extrabold text-white">VIP Invitation Detected</p>
              <p className="text-zinc-400">
                Sign in with <span className="font-bold text-[#CCFF00]">{invitedEmail}</span> to claim your authorized access.
              </p>
            </div>
          </div>
        )}

        {/* Telemetry Feature Chips */}
        <div className="grid grid-cols-2 gap-3 py-2">
          {[
            { icon: Utensils, label: 'AI Optical Vision', tag: 'Gemini 2.5', color: 'text-orange-400', border: 'border-orange-500/20' },
            { icon: Dumbbell, label: 'Kinetic Workouts', tag: 'Burn Telemetry', color: 'text-[#CCFF00]', border: 'border-[#CCFF00]/20' },
            { icon: Droplets, label: 'Fluid Reactor', tag: 'Wave Hydration', color: 'text-[#00F5FF]', border: 'border-cyan-500/20' },
            { icon: Flame, label: 'Activity Rings', tag: '100% Score', color: 'text-[#FF3B30]', border: 'border-red-500/20' },
          ].map((item, i) => (
            <motion.div 
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl bg-zinc-900/80 border ${item.border} shadow-lg`}
            >
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-xs font-black text-white">{item.label}</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">{item.tag}</span>
            </motion.div>
          ))}
        </div>

        {/* Action Button */}
        <Button 
          onClick={signInWithGoogle} 
          size="lg" 
          className="w-full h-14 rounded-2xl text-base font-black bg-[#CCFF00] text-black hover:bg-[#b8e600] shadow-[0_0_25px_rgba(204,255,0,0.35)] active:scale-[0.98] transition-transform"
        >
          <Zap className="w-5 h-5 mr-2 fill-black" />
          Enter with Google
        </Button>

        <p className="text-[11px] text-zinc-500">
          Encrypted with Firebase Auth & Security Protocols.
        </p>
      </motion.div>
    </div>
  );
};
