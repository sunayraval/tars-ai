'use client';

import React, { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import GlowButton from '@/components/ui/GlowButton';
import { motion, AnimatePresence } from 'framer-motion';

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, userPreferences, loading, refreshPreferences } = useAuthContext();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  
  // New Preferences
  const [workingHours, setWorkingHours] = useState('9 AM - 5 PM');
  const [breakPreference, setBreakPreference] = useState('10 mins every hour');
  const [focusStyle, setFocusStyle] = useState('Pomodoro (25m work / 5m break)');
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && userPreferences) {
      if (!userPreferences.onboardingCompleted) {
        setNeedsOnboarding(true);
      }
    }
  }, [user, userPreferences, loading]);

  const handleComplete = () => {
    if (!user) return;
    setIsSaving(true);
    
    const saveToCloud = async () => {
      try {
        if (apiKey.trim()) {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, apiKey: apiKey.trim() }),
          });
        }
        
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          'preferences.workingHours': workingHours,
          'preferences.breakPreference': breakPreference,
          'preferences.focusStyle': focusStyle,
          'preferences.onboardingCompleted': true
        });
        
        await refreshPreferences();
      } catch (err) {
        console.error("Failed to save onboarding settings", err);
      }
    };

    saveToCloud();

    // Instantly proceed for Optimistic UI
    setIsSaving(false);
    setNeedsOnboarding(false);
  };

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center text-white/50 bg-black">Loading...</div>;
  }

  if (needsOnboarding) {
    return (
      <div className="h-screen w-full flex items-center justify-center relative overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-emerald-600/20 blur-[100px]" />
        </div>
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-3xl max-w-lg w-full text-center z-10 border border-white/20"
            >
              <div className="text-6xl mb-6">👋</div>
              <h1 className="text-3xl font-bold text-white mb-4">Welcome to TARS-AI</h1>
              <p className="text-white/60 mb-8 leading-relaxed">
                Your intelligent personal time manager. TARS-AI uses advanced language models to organize your day, adapt to your energy levels, and keep you on track.
              </p>
              <GlowButton onClick={() => setStep(2)} className="w-full justify-center py-3 text-lg">
                Let's Get Started
              </GlowButton>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-3xl max-w-lg w-full z-10 border border-white/20"
            >
              <h2 className="text-2xl font-bold text-white mb-2">Time Management Profile</h2>
              <p className="text-white/50 text-sm mb-6">
                Tell me how you like to work so I can generate the perfect schedules for you.
              </p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Typical Working Hours</label>
                  <input
                    type="text"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="e.g., 9 AM - 5 PM"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Focus Style</label>
                  <input
                    type="text"
                    value={focusStyle}
                    onChange={(e) => setFocusStyle(e.target.value)}
                    placeholder="e.g., Pomodoro, Deep Work sprints"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Break Preference</label>
                  <input
                    type="text"
                    value={breakPreference}
                    onChange={(e) => setBreakPreference(e.target.value)}
                    placeholder="e.g., 10 mins every hour"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors">
                  Back
                </button>
                <GlowButton onClick={() => setStep(3)} className="flex-1 justify-center py-3 text-lg">
                  Next Step
                </GlowButton>
              </div>
            </motion.div>
          )}
          
          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-3xl max-w-lg w-full z-10 border border-white/20"
            >
              <h2 className="text-2xl font-bold text-white mb-2">Connect AI Engine</h2>
              <p className="text-white/50 text-sm mb-6">
                To generate your schedules, TARS-AI requires an OpenRouter API key. 
                Don't worry, your key is AES-256 encrypted before being stored.
              </p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">OpenRouter API Key (Optional for now)</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors">
                  Back
                </button>
                <GlowButton onClick={handleComplete} disabled={isSaving} className="flex-1 justify-center py-3 text-lg">
                  {isSaving ? 'Saving...' : 'Finish Setup'}
                </GlowButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return <>{children}</>;
}
