'use client';

import React from 'react';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import TimeBlock from '@/components/agenda/TimeBlock';
import GlowButton from '@/components/ui/GlowButton';
import { AnimatedListContainer, AnimatedListItem } from '@/components/ui/AnimatedList';

export default function ScheduleView() {
  const { schedule, startSetup } = useScheduleContext();

  if (!schedule) return null;

  return (
    <div className="glass h-full flex flex-col p-4 border border-white/20">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white">Active Schedule</h2>
          <p className="text-xs text-white/50 mt-1">
            Generated on {new Date(schedule.createdAt).toLocaleDateString()}
          </p>
        </div>
        <GlowButton variant="ghost" size="sm" onClick={startSetup}>
          Regenerate
        </GlowButton>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass space-y-3">
        <AnimatedListContainer className="space-y-3">
          {schedule.blocks.map((entry) => (
            <AnimatedListItem key={entry.id}>
              <TimeBlock entry={entry} />
            </AnimatedListItem>
          ))}
        </AnimatedListContainer>
      </div>
    </div>
  );
}
