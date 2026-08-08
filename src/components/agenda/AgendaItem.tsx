'use client';

import React from 'react';
import type { TimeBlock } from '@/lib/scheduling/types';

interface AgendaItemProps {
  entry: TimeBlock;
  onComplete?: () => void;
}

export default function AgendaItem({ entry, onComplete }: AgendaItemProps) {
  const isTask = !entry.isCalendarEvent;
  const isCalendar = entry.isCalendarEvent;
  const isCompleted = isTask && entry.status === 'completed';

  const startTime = new Date(entry.startTime);
  const endTime = new Date(entry.endTime);

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="relative pl-12 py-2 group">
      {/* Timeline Node */}
      <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 transition-all ${
        isCompleted 
          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
          : isCalendar 
            ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'
            : 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]'
      }`} />

      {/* Card */}
      <div className={`
        glass p-3 rounded-xl border border-white/5 
        transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10
        ${isCompleted ? 'opacity-60' : 'opacity-100'}
      `}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className={`text-sm font-semibold truncate ${isCompleted ? 'text-white/50 line-through' : 'text-white'}`}>
              {entry.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
              <span className="flex items-center gap-1 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                🕒 {formatTime(startTime)} - {formatTime(endTime)}
              </span>
              {isCalendar && (
                <span className="flex items-center gap-1 bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                  📅 Event
                </span>
              )}
            </div>
            {entry.description && (
              <p className="mt-2 text-xs text-white/60 line-clamp-2">
                {entry.description}
              </p>
            )}
          </div>

          {/* Action Checkbox (if task) */}
          {isTask && (
            <button 
              onClick={onComplete}
              className={`
              mt-0.5 flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-all
              ${isCompleted 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-white/5 border-white/20 text-transparent hover:border-violet-400 hover:text-white/20'}
            `}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
