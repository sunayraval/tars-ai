'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthContext } from './AuthContext';
import { getPlanningBacklogs, PlanningBacklog } from '@/lib/firebase/firestore';

interface HistoryContextValue {
  backlogs: PlanningBacklog[];
  loading: boolean;
  refreshHistory: () => Promise<void>;
}

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [backlogs, setBacklogs] = useState<PlanningBacklog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user?.uid) {
      setBacklogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const fetchedBacklogs = await getPlanningBacklogs(user.uid);
      setBacklogs(fetchedBacklogs);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <HistoryContext.Provider
      value={{
        backlogs,
        loading,
        refreshHistory: fetchHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryContext() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return ctx;
}
