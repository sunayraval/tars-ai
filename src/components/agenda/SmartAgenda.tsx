'use client';

import React, { useEffect, useState } from 'react';
import AgendaItem from './AgendaItem';
import type { TimeBlock } from '@/lib/scheduling/types';

interface SmartAgendaProps {
  uid: string;
}

export default function SmartAgenda({ uid }: SmartAgendaProps) {
  const [entries, setEntries] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We would fetch from Firestore here.
    // For now, load dummy data if none exists
    setEntries([
      { id: '1', taskId: 'dummy1', title: 'ASPIRE Internship Block', startTime: new Date(new Date().setHours(9, 0, 0, 0)), endTime: new Date(new Date().setHours(11, 30, 0, 0)), isCalendarEvent: true, estimatedDuration: 150, status: 'upcoming' },
      { id: '2', taskId: 'dummy2', title: 'SAT Practice Test', startTime: new Date(new Date().setHours(12, 0, 0, 0)), endTime: new Date(new Date().setHours(14, 0, 0, 0)), isCalendarEvent: false, estimatedDuration: 120, status: 'upcoming' },
      { id: '3', taskId: 'dummy3', title: 'Review Math Formulas', startTime: new Date(new Date().setHours(14, 30, 0, 0)), endTime: new Date(new Date().setHours(16, 0, 0, 0)), isCalendarEvent: false, estimatedDuration: 90, status: 'upcoming' }
    ]);
    setLoading(false);
  }, [uid]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        <div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading agenda...
      </div>
    );
  }

  return (
    <div className="w-full glass p-4 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">📅</span> Today&apos;s Agenda
        </h2>
        <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full border border-white/10">
          {entries.length} Items
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass">
        <div className="relative space-y-1">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
          
          {entries.map(e => (
            <AgendaItem key={e.id} entry={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
