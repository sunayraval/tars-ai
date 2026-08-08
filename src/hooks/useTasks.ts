"use client";

import { useTasksContext } from '@/contexts/TasksContext';

export function useTasks(uid: string | null) {
  // We ignore uid here because the context already handles authentication internally
  return useTasksContext();
}
