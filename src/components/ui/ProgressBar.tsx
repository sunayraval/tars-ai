'use client';
import { motion } from 'framer-motion';
import type { DailySchedule } from '@/lib/scheduling/types';

interface ProgressBarProps {
  schedule: DailySchedule;
}

export default function ProgressBar({ schedule }: ProgressBarProps) {
  const { blocks } = schedule;
  const total = blocks.length;
  const completed = blocks.filter(b => b.status === 'completed' || b.status === 'skipped').length;
  const activeBlock = blocks.find(b => b.status === 'active');
  const nextBlock = blocks.find(b => b.status === 'upcoming');
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mx-4 mb-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-4">
      {/* Percentage */}
      <div className="flex-shrink-0 text-center">
        <motion.span
          key={percent}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold text-white tabular-nums"
        >
          {percent}%
        </motion.span>
        <p className="text-[10px] text-white/40 mt-0.5">Done</p>
      </div>

      {/* Progress bar + labels */}
      <div className="flex-1 min-w-0">
        <div className="relative h-2 rounded-full bg-white/10 overflow-hidden mb-2">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ left: ['-80px', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Active task */}
          <div className="min-w-0">
            {activeBlock ? (
              <p className="text-xs text-white/70 truncate">
                <span className="text-violet-400 font-medium mr-1">▶</span>
                {activeBlock.title}
              </p>
            ) : (
              <p className="text-xs text-white/30">No active task</p>
            )}
          </div>

          {/* Next task */}
          {nextBlock && (
            <div className="flex-shrink-0">
              <p className="text-xs text-white/40 truncate max-w-[140px]">
                <span className="mr-1">⟶</span>
                {nextBlock.title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Blocks counter */}
      <div className="flex-shrink-0 text-center">
        <span className="text-sm font-semibold text-white">{completed}</span>
        <span className="text-white/30 text-sm">/{total}</span>
        <p className="text-[10px] text-white/40 mt-0.5">Tasks</p>
      </div>
    </div>
  );
}
