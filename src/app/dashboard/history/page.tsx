'use client';

import React from 'react';
import { useHistoryContext } from '@/contexts/HistoryContext';
import { AnimatedListContainer, AnimatedListItem } from '@/components/ui/AnimatedList';

export default function HistoryPage() {
  const { backlogs, loading } = useHistoryContext();

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-3xl">📜</span> Planning History
        </h1>
        <p className="text-sm text-white/50 mt-1">Review your past daily AI schedules and raw plans.</p>
      </header>

      <div className="flex-1 glass rounded-2xl border border-white/20 p-5 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass">
          {loading ? (
            <div className="flex justify-center items-center h-full text-white/50">
              <div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
              Loading history...
            </div>
          ) : backlogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <div className="text-4xl mb-3">🗄️</div>
              <p>No planning history yet.</p>
            </div>
          ) : (
            <AnimatedListContainer className="space-y-4">
              {backlogs.map((backlog) => (
                <AnimatedListItem key={backlog.id}>
                  <div className="p-5 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📅</span>
                        <h3 className="font-semibold text-white">{backlog.date}</h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${
                        backlog.status === 'processed' 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                          : backlog.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}>
                        {backlog.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Raw Plan</h4>
                      <pre className="bg-black/30 p-3 rounded-lg text-xs text-white/70 font-mono whitespace-pre-wrap overflow-x-auto">
                        {backlog.rawPlan}
                      </pre>
                    </div>
                  </div>
                </AnimatedListItem>
              ))}
            </AnimatedListContainer>
          )}
        </div>
      </div>
    </div>
  );
}
