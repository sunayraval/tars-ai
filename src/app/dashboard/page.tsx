'use client';

import React, { useState } from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import ScheduleBuilder from '@/components/schedule/ScheduleBuilder';
import ScheduleView from '@/components/schedule/ScheduleView';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import { useAuthContext } from '@/contexts/AuthContext';
import ProgressBar from '@/components/ui/ProgressBar';
import DraggablePanel from '@/components/ui/DraggablePanel';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import AgendaItem from '@/components/agenda/AgendaItem';

const PANEL_IDS = ['agenda', 'schedule', 'chat'] as const;
type PanelId = typeof PANEL_IDS[number];

function getGreeting(name: string | null) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `Good ${timeOfDay}, ${name?.split(' ')[0] ?? 'there'}!`;
}

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { state, schedule, startSetup } = useScheduleContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(['agenda', 'schedule', 'chat']);

  let SettingsModal: React.ComponentType<{ isOpen: boolean; onClose: () => void; uid: string }> | null = null;
  try {
    SettingsModal = require('@/components/settings/SettingsModal').default;
  } catch {}

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as PanelId);
        const newIndex = items.indexOf(over.id as PanelId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const panels: Record<PanelId, React.ReactNode> = {
    agenda: (
      <DraggablePanel id="agenda" className="h-full min-h-[400px]">
        <SmartAgendaLoader uid={user?.uid ?? ''} state={state} />
      </DraggablePanel>
    ),
    schedule: (
      <DraggablePanel id="schedule" className="h-full min-h-[400px]">
        <div className="h-full space-y-4">
          {(state === 'SETUP_QA' || state === 'GENERATING') && <ScheduleBuilder />}
          {state === 'ACTIVE' && <ScheduleView />}
          {state === 'IDLE' && (
            <div className="glass h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="text-4xl mb-4">🌅</div>
              <h3 className="text-lg font-semibold text-white mb-2">Ready to plan your day?</h3>
              <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
                Click &quot;Plan My Day&quot; to answer a few questions and generate an AI-optimized schedule tailored to your tasks, calendar, and energy level.
              </p>
              <button
                onClick={startSetup}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all glow-violet"
              >
                ✨ Plan My Day
              </button>
            </div>
          )}
        </div>
      </DraggablePanel>
    ),
    chat: (
      <DraggablePanel id="chat" className="h-full min-h-[400px]">
        <ChatPanel />
      </DraggablePanel>
    )
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 h-48 w-48 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-sm flex-shrink-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-white">{getGreeting(user?.displayName ?? null)}</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state === 'IDLE' && (
            <button
              onClick={startSetup}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium transition-all glow-violet flex items-center gap-2"
            >
              <span>✨</span> Plan My Day
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-white/50 hover:text-white glass-hover bg-white/5 border border-transparent hover:border-white/20 transition-all"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {state === 'ACTIVE' && schedule && (
        <div className="mt-4 z-10">
          <ProgressBar schedule={schedule} />
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 z-10 scrollbar-glass">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-full">
              <div className="lg:col-span-3 flex flex-col gap-4">
                {panelOrder.filter(id => id === 'agenda' || id === 'schedule').map(id => (
                  <div key={id} className={id === 'schedule' ? 'flex-1' : ''}>{panels[id]}</div>
                ))}
              </div>
              <div className="lg:col-span-2 flex flex-col gap-4">
                {panelOrder.filter(id => id === 'chat').map(id => (
                  <div key={id} className="flex-1">{panels[id]}</div>
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {SettingsModal && (
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} uid={user?.uid ?? ''} />
      )}
    </div>
  );
}

function SmartAgendaLoader({ uid, state }: { uid: string, state: string }) {
  try {
    const SmartAgenda = require('@/components/agenda/SmartAgenda').default;
    return <SmartAgenda uid={uid} />;
  } catch {
    if (state === 'IDLE') {
      return <DummyAgenda />;
    }
    return null;
  }
}

function DummyAgenda() {
  const dummyEntries = [
    { id: '1', taskId: 'dummy1', title: 'ASPIRE Internship Block', startTime: new Date(new Date().setHours(9, 0, 0, 0)), endTime: new Date(new Date().setHours(11, 30, 0, 0)), isCalendarEvent: true, estimatedDuration: 150, status: 'upcoming' },
    { id: '2', taskId: 'dummy2', title: 'SAT Practice Test', startTime: new Date(new Date().setHours(12, 0, 0, 0)), endTime: new Date(new Date().setHours(14, 0, 0, 0)), isCalendarEvent: false, estimatedDuration: 120, status: 'upcoming' },
    { id: '3', taskId: 'dummy3', title: 'Review Math Formulas', startTime: new Date(new Date().setHours(14, 30, 0, 0)), endTime: new Date(new Date().setHours(16, 0, 0, 0)), isCalendarEvent: false, estimatedDuration: 90, status: 'upcoming' }
  ];
  return (
    <div className="w-full glass p-4 h-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Today&apos;s Agenda</h2>
      </div>
      <div className="relative space-y-1">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-white/20" />
        {dummyEntries.map(e => <AgendaItem key={e.id} entry={e as any} />)}
      </div>
    </div>
  );
}
