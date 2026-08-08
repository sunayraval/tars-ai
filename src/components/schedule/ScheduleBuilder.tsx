'use client';

import React, { useState, useEffect } from 'react';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { useChatContext } from '@/contexts/ChatContext';
import GlowButton from '@/components/ui/GlowButton';

export default function ScheduleBuilder() {
  const { state, cancelSchedule, generateSchedule, submitAnswer } = useScheduleContext();
  
  const [goal, setGoal] = useState('');
  const [energy, setEnergy] = useState<'low' | 'medium' | 'high'>('medium');

  const handleGenerate = () => {
    if (!goal.trim()) return;
    submitAnswer('preferences', goal);
    submitAnswer('energy', energy);
    generateSchedule();
  };

  if (state === 'GENERATING') {
    return (
      <div className="glass h-full flex flex-col items-center justify-center p-8 text-center border border-white/20">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
            ✨
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Generating Your Perfect Day
        </h3>
        <p className="text-sm text-white/50">
          The AI engine is retrieving your tasks, checking your calendar, and optimizing time blocks…
        </p>
      </div>
    );
  }

  return (
    <div className="glass h-full flex flex-col p-6 border border-white/20">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Daily Alignment</h2>
        <p className="text-sm text-white/50">
          Tell me your main focus for today, and I&apos;ll weave it around your existing meetings and habits.
        </p>
      </div>

      <div className="space-y-6 flex-1">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            What&apos;s your main goal or theme today?
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Finish the design presentation and catch up on emails..."
            className="w-full h-24 resize-none rounded-xl glass bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 border border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all scrollbar-glass"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">
            Current Energy Level
          </label>
          <div className="flex gap-3">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setEnergy(level)}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  energy === level
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white glow-violet border-transparent'
                    : 'glass bg-white/5 text-white/60 hover:bg-white/10 border-white/10 hover:border-white/30'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <GlowButton variant="ghost" onClick={cancelSchedule}>
          Cancel
        </GlowButton>
        <GlowButton onClick={handleGenerate} disabled={!goal.trim()}>
          Generate Schedule ✨
        </GlowButton>
      </div>
    </div>
  );
}
