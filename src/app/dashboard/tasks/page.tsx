'use client';

import React, { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import GlowButton from '@/components/ui/GlowButton';
import { AnimatedListContainer, AnimatedListItem } from '@/components/ui/AnimatedList';
import { Timestamp } from 'firebase/firestore';

export default function TasksPage() {
  const { user } = useAuthContext();
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks(user?.uid ?? null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEst, setNewTaskEst] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    try {
      setIsAdding(true);
      await addTask({
        title: newTaskTitle,
        status: 'todo',
        estimatedDuration: parseInt(newTaskEst) || 30,
      });
      setNewTaskTitle('');
      setNewTaskEst('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleStatus = (id: string, currentStatus: string) => {
    updateTask(id, { status: currentStatus === 'done' ? 'todo' : 'done' });
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-3xl">📝</span> My Tasks
        </h1>
        <p className="text-sm text-white/50 mt-1">Manage your backlog and upcoming action items.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Task Entry Form */}
        <div className="lg:col-span-1">
          <div className="glass p-5 rounded-2xl border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Task</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Task Title</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="E.g. Review pull requests..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Est. Duration (minutes)</label>
                <input
                  type="number"
                  value={newTaskEst}
                  onChange={(e) => setNewTaskEst(e.target.value)}
                  placeholder="30"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <GlowButton type="submit" disabled={!newTaskTitle.trim() || isAdding} className="w-full justify-center">
                {isAdding ? 'Adding...' : 'Add Task'}
              </GlowButton>
            </form>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 glass rounded-2xl border border-white/20 p-5 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-white mb-4">Task Backlog</h2>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass">
            {loading ? (
              <div className="flex justify-center items-center h-full text-white/50">
                <div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <div className="text-4xl mb-3">📭</div>
                <p>No tasks yet. Add one to get started!</p>
              </div>
            ) : (
              <AnimatedListContainer className="space-y-2">
                {tasks.map((task) => (
                  <AnimatedListItem key={task.id}>
                    <div className={`p-4 rounded-xl border transition-all duration-300 flex items-center gap-4 group ${
                      task.status === 'done' 
                        ? 'bg-white/5 border-white/5 opacity-50' 
                        : 'bg-white/10 border-white/10 hover:border-white/20 hover:bg-white/15'
                    }`}>
                      <button 
                        onClick={() => toggleStatus(task.id, task.status)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.status === 'done' 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-white/30 text-transparent hover:border-emerald-400'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${task.status === 'done' ? 'line-through text-white/50' : 'text-white'}`}>
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                          {task.estimatedDuration && (
                            <span className="flex items-center gap-1">
                              ⏱️ {task.estimatedDuration} min
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            📅 Added {task.createdAt instanceof Timestamp ? task.createdAt.toDate().toLocaleDateString() : new Date(task.createdAt as Date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete Task"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </AnimatedListItem>
                ))}
              </AnimatedListContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
