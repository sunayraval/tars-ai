'use client';

import React, { useEffect, useState } from 'react';
import AgendaItem from './AgendaItem';
import type { TimeBlock } from '@/lib/scheduling/types';
import { useTasks } from '@/hooks/useTasks';
import { AnimatedListContainer, AnimatedListItem } from '@/components/ui/AnimatedList';

interface SmartAgendaProps {
  uid: string;
}

export default function SmartAgenda({ uid }: SmartAgendaProps) {
  const { tasks, loading, updateTask } = useTasks(uid);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        <div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading agenda...
      </div>
    );
  }

  // Convert pure tasks to TimeBlocks for visual display on the timeline if they don't have scheduled times
  // We'll just display them as a list of tasks for the day for now
  const agendaItems: TimeBlock[] = tasks.map(t => ({
    id: t.id,
    taskId: t.id,
    title: t.title,
    description: t.description,
    startTime: t.scheduledStart ? (t.scheduledStart as any).toDate?.() || new Date(t.scheduledStart as any) : new Date(),
    endTime: t.scheduledEnd ? (t.scheduledEnd as any).toDate?.() || new Date(t.scheduledEnd as any) : new Date(Date.now() + (t.estimatedDuration || 30) * 60000),
    status: t.status === 'done' ? 'completed' : 'upcoming',
    isCalendarEvent: false,
    estimatedDuration: t.estimatedDuration || 30,
    priority: 2
  }));

  const handleComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      updateTask(taskId, { status: task.status === 'done' ? 'todo' : 'done' });
    }
  };

  return (
    <div className="w-full glass p-4 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">📅</span> Today&apos;s Agenda
        </h2>
        <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full border border-white/10">
          {agendaItems.length} Items
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass">
        <div className="relative space-y-1">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
          
          <AnimatedListContainer>
            {agendaItems.map(e => (
              <AnimatedListItem key={e.id}>
                <AgendaItem entry={e} onComplete={() => handleComplete(e.taskId || e.id)} />
              </AnimatedListItem>
            ))}
          </AnimatedListContainer>
        </div>
      </div>
    </div>
  );
}
