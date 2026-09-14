/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { FoodTracker } from './components/FoodTracker';
import { WorkoutTracker } from './components/WorkoutTracker';
import { WaterTracker } from './components/WaterTracker';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from './lib/firebase';
import { registerSW } from 'virtual:pwa-register';
import { AdminPanel } from './components/AdminPanel';

registerSW({ immediate: true });

const AppContent = () => {
  const { user, loading, isAuthorized, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090E] text-zinc-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-[#CCFF00] animate-spin stroke-[2.5]" />
            <div className="absolute inset-0 blur-lg bg-[#CCFF00]/30 -z-10 animate-pulse" />
          </div>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#CCFF00] animate-pulse">
            CALIBRATING ATHLETIC TELEMETRY...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#08090E] text-zinc-100">
        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Access Restricted</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your email (<strong className="text-white">{user.email}</strong>) is not on the VIP athletic whitelist. 
              Please contact an administrator to request an authorization invite.
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => auth.signOut()} 
            className="rounded-xl border-zinc-700 text-zinc-200 hover:bg-zinc-900 font-bold text-xs px-6"
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'food': return <FoodTracker />;
      case 'workouts': return <WorkoutTracker />;
      case 'water': return <WaterTracker />;
      case 'settings': return <Settings />;
      case 'admin': return <AdminPanel />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-center" richColors theme="dark" />
      </AuthProvider>
    </ErrorBoundary>
  );
}
