'use client';

import React from 'react';
import type { TimeBlock as TimeBlockType } from '@/lib/scheduling/types';

interface TimeBlockProps {
  entry: TimeBlockType;
  className?: string;
}

export default function TimeBlock({ entry, className = '' }: TimeBlockProps) {
  const isTask = !entry.isCalendarEvent;
  const isCalendar = entry.isCalendarEvent;
  const isCompleted = isTask && entry.status === 'completed';

  const startTime = new Date(entry.startTime);
  const endTime = new Date(entry.endTime);

  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMins = Math.round(durationMs / 60000);

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Calculate height proportional to duration (e.g., 1 min = 1.5px)
  const minHeight = Math.max(durationMins * 1.5, 60);

  return (
    <div 
      className={`glass rounded-xl p-3 border-l-4 transition-all duration-300 group ${className} ${
        isCompleted
          ? 'border-l-emerald-500/50 bg-white/5'
          : isCalendar
            ? 'border-l-blue-500/80 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20'
            : 'border-l-violet-500/80 bg-gradient-to-r from-violet-500/10 to-transparent hover:from-violet-500/20'
      }`}
      style={{ minHeight: `${minHeight}px` }}
    >
      <div className="flex justify-between items-start">
        <h4 className={`text-sm font-semibold ${isCompleted ? 'text-white/40 line-through' : 'text-white'}`}>
          {entry.title}
        </h4>
        <span className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded text-white/70">
          {formatTime(startTime)}
        </span>
      </div>
      
      {entry.description && (
        <p className="mt-1 text-xs text-white/50 line-clamp-2">
          {entry.description}
        </p>
      )}

      <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-white/40">
        <span>{durationMins}m</span>
        {isCalendar && <span className="text-blue-300/70">Event</span>}
        {isTask && <span className="text-violet-300/70">Task</span>}
      </div>
    </div>
  );
}
