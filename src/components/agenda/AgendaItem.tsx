'use client';

import React from 'react';
import type { TimeBlock } from '@/lib/scheduling/types';
import { motion } from 'framer-motion';

interface AgendaItemProps {
  entry: TimeBlock;
  onComplete?: () => void;
  onDelete?: () => void;
  dragHandleProps?: any;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-blue-400',
  study: 'bg-violet-400',
  personal: 'bg-emerald-400',
  health: 'bg-rose-400',
  errand: 'bg-amber-400',
  other: 'bg-slate-400',
};

export default function AgendaItem({ entry, onComplete, onDelete, dragHandleProps }: AgendaItemProps) {
  const isTask = !entry.isCalendarEvent;
  const isCalendar = entry.isCalendarEvent;
  const isCompleted = isTask && entry.status === 'completed';

  const startTime = new Date(entry.startTime);
  const endTime = new Date(entry.endTime);

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative pl-12 py-2 group"
    >
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
          
          <div className="flex flex-1 items-start gap-2 min-w-0">
            {/* Drag Handle */}
            <div 
              {...dragHandleProps}
              className="mt-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white transition-opacity"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="8" cy="4" r="1.5" />
                <circle cx="16" cy="4" r="1.5" />
                <circle cx="8" cy="12" r="1.5" />
                <circle cx="16" cy="12" r="1.5" />
                <circle cx="8" cy="20" r="1.5" />
                <circle cx="16" cy="20" r="1.5" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {entry.category && CATEGORY_COLORS[entry.category] && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_COLORS[entry.category]}`} />
                )}
                <h4 
                  className={`text-sm font-semibold truncate hover:underline cursor-text transition-all ${isCompleted ? 'text-white/50 line-through' : 'text-white'}`}
                  title="Click to edit title"
                >
                  {entry.title}
                </h4>
              </div>
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
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
            {/* Delete Button */}
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
              title="Delete item"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            {/* Action Checkbox (if task) */}
            {isTask && (
              <button 
                onClick={onComplete}
                className={`
                flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-all
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
    </motion.div>
  );
}
