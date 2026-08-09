'use client';

import React, { useEffect, useState } from 'react';
import AgendaItem from './AgendaItem';
import type { TimeBlock } from '@/lib/scheduling/types';
import { useTasks } from '@/hooks/useTasks';
import { AnimatedListContainer, AnimatedListItem } from '@/components/ui/AnimatedList';
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  arrayMove, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X } from 'lucide-react';

type TaskCategory = 'work' | 'study' | 'personal' | 'health' | 'errand' | 'other';

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  work: 'bg-blue-500',
  study: 'bg-violet-500',
  personal: 'bg-emerald-500',
  health: 'bg-rose-500',
  errand: 'bg-amber-500',
  other: 'bg-slate-500',
};

function SortableAgendaItem({ entry, onComplete, onDelete }: { entry: TimeBlock, onComplete: () => void, onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <AgendaItem 
        entry={entry} 
        onComplete={onComplete}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }} 
      />
    </div>
  );
}

function InlineAddBlock({ onAdd }: { onAdd: (title: string, duration: number, category: TaskCategory) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState<TaskCategory>('work');

  const durations = [15, 30, 45, 60, 90, 120];
  const categories: TaskCategory[] = ['work', 'study', 'personal', 'health', 'errand', 'other'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title, duration, category);
      setTitle('');
      setDuration(30);
      setCategory('work');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex justify-center my-1 relative z-20 opacity-40 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-medium text-white/70 hover:text-white bg-white/10 hover:bg-violet-600 px-3 py-1 rounded-full border border-white/10 transition-all shadow-sm"
        >
          <Plus size={12} /> Add Block
        </button>
      </div>
    );
  }

  return (
    <div className="my-3 p-4 glass bg-white/5 border border-white/10 rounded-xl relative z-30 ml-8 shadow-xl">
      <button onClick={() => setIsOpen(false)} className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors">
        <X size={16} />
      </button>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input 
            type="text" 
            placeholder="Task title..." 
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
            autoFocus
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Duration (min)</label>
          <div className="flex flex-wrap gap-1.5">
            {durations.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${duration === d ? 'bg-violet-500/30 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${category === c ? 'bg-white/15 border-white/20 text-white shadow-sm' : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white/90'}`}
              >
                <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[c]}`} />
                <span className="capitalize">{c}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            type="submit"
            disabled={!title.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded-lg transition-all shadow-md"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

interface SmartAgendaProps {
  uid: string;
}

export default function SmartAgenda({ uid }: SmartAgendaProps) {
  const { tasks, loading, updateTask, addTask, deleteTask } = useTasks(uid);
  const [items, setItems] = useState<TimeBlock[]>([]);

  useEffect(() => {
    const newAgendaItems: TimeBlock[] = tasks.map(t => ({
      id: t.id,
      taskId: t.id,
      title: t.title,
      description: t.description,
      startTime: t.scheduledStart ? (t.scheduledStart as any).toDate?.() || new Date(t.scheduledStart as any) : new Date(),
      endTime: t.scheduledEnd ? (t.scheduledEnd as any).toDate?.() || new Date(t.scheduledEnd as any) : new Date(Date.now() + (t.estimatedDuration || 30) * 60000),
      status: t.status === 'done' ? 'completed' : 'upcoming',
      isCalendarEvent: false,
      estimatedDuration: t.estimatedDuration || 30,
      priority: 2,
      category: t.category as any,
    }));

    setItems(prev => {
      // Maintain order for existing items, append new ones
      const existing = prev.map(p => newAgendaItems.find(n => n.id === p.id)).filter(Boolean) as TimeBlock[];
      const added = newAgendaItems.filter(n => !prev.find(p => p.id === n.id));
      return [...existing, ...added];
    });
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      updateTask(taskId, { status: task.status === 'done' ? 'todo' : 'done' });
    }
  };

  const handleAddBlock = async (title: string, duration: number, category: TaskCategory) => {
    try {
      await addTask({
        title,
        status: 'todo',
        category,
        estimatedDuration: duration,
      });
    } catch (err) {
      console.error('Failed to add task', err);
    }
  };

  const handleDelete = (taskId: string) => {
    deleteTask(taskId);
  };

  if (loading && items.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50 glass rounded-2xl">
        <div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading agenda...
      </div>
    );
  }

  return (
    <div className="w-full glass p-4 h-full flex flex-col relative rounded-2xl">
      <div className="mb-4 flex items-center justify-between z-10 relative">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">📅</span> Today&apos;s Agenda
        </h2>
        <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full border border-white/10">
          {items.length} Items
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-glass relative z-0">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent pointer-events-none" />
        
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatedListContainer>
              <InlineAddBlock onAdd={handleAddBlock} />
              {items.map((e) => (
                <AnimatedListItem key={e.id}>
                  <SortableAgendaItem 
                    entry={e} 
                    onComplete={() => handleComplete(e.taskId || e.id)}
                    onDelete={() => handleDelete(e.taskId || e.id)}
                  />
                  <InlineAddBlock onAdd={handleAddBlock} />
                </AnimatedListItem>
              ))}
            </AnimatedListContainer>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
