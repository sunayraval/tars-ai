'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthContext } from './AuthContext';
import { Task, getUserTasks, addTask as firestoreAddTask } from '@/lib/firebase/firestore';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.uid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fetched = await getUserTasks(user.uid);
      setTasks(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user?.uid) throw new Error('No user ID provided');
      
      const tempId = `temp-${Date.now()}`;
      const tempTask: Task = {
        ...task,
        id: tempId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Optimistic update: instantly show the task
      setTasks((prev) => [tempTask, ...prev]);
      
      // Fire-and-forget to Firestore (background sync)
      firestoreAddTask(user.uid, task).then((realTask) => {
        // Swap temp task with the real database task
        setTasks((prev) => prev.map((t) => t.id === tempId ? realTask : t));
      }).catch((e) => {
        console.error("Failed to save task to database", e);
        // Rollback on failure
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
      });
      
      return tempTask;
    },
    [user?.uid]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      if (!user?.uid) throw new Error('No user ID provided');
      
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date() as any } : t
        )
      );
      
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
        await updateDoc(taskRef, { ...updates, updatedAt: new Date() });
      } catch (e) {
        console.error("Failed to update task", e);
        // Could revert optimistic update here on failure
      }
    },
    [user?.uid]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user?.uid) throw new Error('No user ID provided');
      
      // Optimistic delete
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
        await deleteDoc(taskRef);
      } catch (e) {
        console.error("Failed to delete task", e);
        // Could revert here on failure
      }
    },
    [user?.uid]
  );

  return (
    <TasksContext.Provider
      value={{
        tasks,
        loading,
        error,
        addTask,
        updateTask,
        deleteTask,
        refreshTasks: fetchTasks,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasksContext() {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error('useTasksContext must be used within a TasksProvider');
  }
  return ctx;
}
