"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Task,
  getUserTasks,
  addTask as firestoreAddTask,
} from "@/lib/firebase/firestore";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

/**
 * Custom hook for managing Firestore tasks with local state.
 */
export function useTasks(uid: string | null): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fetched = await getUserTasks(uid);
      setTasks(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tasks";
      setError(message);
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      if (!uid) throw new Error("No user ID provided");
      const newTask = await firestoreAddTask(uid, task);
      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [uid]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      if (!uid) throw new Error("No user ID provided");
      const taskRef = doc(db, "users", uid, "tasks", taskId);
      await updateDoc(taskRef, { ...updates, updatedAt: new Date() });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date() } : t
        )
      );
    },
    [uid]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!uid) throw new Error("No user ID provided");
      const taskRef = doc(db, "users", uid, "tasks", taskId);
      await deleteDoc(taskRef);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [uid]
  );

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    refreshTasks: fetchTasks,
  };
}
