'use client';

import React, { useEffect, useState } from 'react';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function StatusBar() {
  const { schedule } = useScheduleContext();
  const [activeBlock, setActiveBlock] = useState<any | null>(null);
  const [nextBlock, setNextBlock] = useState<any | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  useEffect(() => {
    if (!schedule || !schedule.blocks || schedule.blocks.length === 0) {
      setActiveBlock(null);
      setNextBlock(null);
      return;
    }

    const updateStatus = () => {
      const now = new Date();
      let current = null;
      let next = null;

      for (let i = 0; i < schedule.blocks.length; i++) {
        const block = schedule.blocks[i];
        const start = new Date(block.startTime);
        const end = new Date(block.endTime);
        
        if (now >= start && now < end) {
          current = block;
          if (i + 1 < schedule.blocks.length) {
            next = schedule.blocks[i + 1];
          }
          break;
        } else if (now < start && !current) {
          // If we haven't found a current block and this one is in the future
          next = block;
          break;
        }
      }

      setActiveBlock(current);
      setNextBlock(next);

      if (current) {
        const end = new Date(current.endTime);
        const diff = end.getTime() - now.getTime();
        
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          
          if (hours > 0) {
            setTimeRemaining(`${hours}h ${mins}m`);
          } else {
            setTimeRemaining(`${mins}m ${secs}s`);
          }
        } else {
          setTimeRemaining('Finishing...');
        }
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [schedule]);

  if (!schedule) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full glass bg-white/5 border-b border-white/10 px-6 py-2.5 flex items-center justify-between text-sm z-10"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {activeBlock ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/30"></span>
              )}
            </span>
            <span className="text-white/60 font-medium">Currently:</span>
            <span className="text-white font-semibold truncate max-w-[200px] md:max-w-[300px]">
              {activeBlock ? activeBlock.title : 'Free Time / Idle'}
            </span>
          </div>
          
          {activeBlock && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-300 font-mono text-xs">
              <span>⏱</span> {timeRemaining} remaining
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-white/50">
          <span className="hidden sm:inline">Up Next:</span>
          <span className="text-white/80 truncate max-w-[150px] md:max-w-[250px]">
            {nextBlock ? nextBlock.title : 'None'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
