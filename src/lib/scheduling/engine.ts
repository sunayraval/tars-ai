/**
 * Scheduling Engine
 *
 * Orchestrates AI-powered schedule generation, check-ins, and block lifecycle
 * management. All AI calls go through the /api/chat proxy route.
 */

import type { Task } from '@/lib/firebase/firestore';
import type {
  SetupQuestion,
  SetupAnswers,
  DailySchedule,
  TimeBlock,
} from './types';
import {
  SYSTEM_PROMPT,
  buildGenerationPrompt,
  buildCheckInPrompt,
} from './prompts';

// ---------------------------------------------------------------------------
// Setup Questions (deterministic, context-aware)
// ---------------------------------------------------------------------------

/**
 * Returns 3–4 structured questions that gather context before schedule
 * generation. The questions are fixed but their options adapt to the tasks.
 */
export function generateSetupQuestions(
  tasks: Task[],
  calendarEvents?: Array<{ title: string; start: string; end: string }>
): SetupQuestion[] {
  const questions: SetupQuestion[] = [
    {
      id: 'work_hours',
      question: 'What time do you want to start and end your workday today?',
      type: 'time',
    },
    {
      id: 'priorities',
      question: 'Which tasks are most important today? (select all that apply)',
      type: 'multiselect',
      options: tasks.length > 0 ? tasks.map((t) => t.title) : ['No tasks yet — I\'ll add some later'],
    },
    {
      id: 'energy',
      question: 'How is your energy level today?',
      type: 'choice',
      options: ['High — ready to crush it', 'Medium — steady pace', 'Low — keep it light'],
    },
    {
      id: 'preferences',
      question: 'Any special constraints or preferences for today?',
      type: 'text',
    },
  ];

  // If there are calendar events, add a confirmation question
  if (calendarEvents && calendarEvents.length > 0) {
    questions.splice(1, 0, {
      id: 'calendar_confirm',
      question: `I see ${calendarEvents.length} calendar event(s) today. Should I schedule around all of them?`,
      type: 'choice',
      options: ['Yes, keep them all', 'Let me review — some may be optional'],
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// AI Schedule Generation
// ---------------------------------------------------------------------------

/**
 * Calls the AI via /api/chat to produce a full daily schedule. Parses the
 * JSON response into a `DailySchedule`.
 *
 * @throws {Error} If the AI response is not valid JSON or doesn't match schema.
 */
export async function buildScheduleFromAI(
  answers: SetupAnswers,
  tasks: Task[],
  calendarEvents: Array<{ title: string; start: string; end: string }>,
  uid: string
): Promise<DailySchedule> {
  const userPrompt = buildGenerationPrompt(answers, tasks, calendarEvents);

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      uid,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Schedule generation failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? data.content ?? '';

  // Extract JSON from the response (handle possible markdown fences)
  const jsonStr = extractJSON(content);
  const parsed = JSON.parse(jsonStr);

  // The AI may return a raw array or an object with a "blocks" key
  const rawBlocks: unknown[] = Array.isArray(parsed) ? parsed : parsed.blocks;

  if (!Array.isArray(rawBlocks)) {
    throw new Error('AI response did not contain a valid blocks array.');
  }

  const blocks: TimeBlock[] = rawBlocks.map((raw: any) => ({
    id: raw.id ?? crypto.randomUUID(),
    taskId: raw.taskId ?? '',
    title: raw.title ?? 'Untitled',
    description: raw.description,
    startTime: new Date(raw.startTime),
    endTime: new Date(raw.endTime),
    status: raw.status ?? 'upcoming',
    isCalendarEvent: raw.isCalendarEvent ?? false,
    estimatedDuration: raw.estimatedDuration ?? 30,
    priority: raw.priority,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return {
    date: today,
    blocks,
    state: 'ACTIVE',
    currentBlockIndex: 0,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Block Accessors
// ---------------------------------------------------------------------------

/** Returns the currently active time block, or null. */
export function getCurrentBlock(schedule: DailySchedule): TimeBlock | null {
  if (schedule.currentBlockIndex < 0 || schedule.currentBlockIndex >= schedule.blocks.length) {
    return null;
  }
  return schedule.blocks[schedule.currentBlockIndex] ?? null;
}

/** Returns the next upcoming block after the current one, or null. */
export function getNextBlock(schedule: DailySchedule): TimeBlock | null {
  const nextIdx = schedule.currentBlockIndex + 1;
  if (nextIdx >= schedule.blocks.length) return null;
  return schedule.blocks[nextIdx] ?? null;
}

// ---------------------------------------------------------------------------
// Check-In Logic
// ---------------------------------------------------------------------------

/**
 * Determines if a check-in should be triggered. Returns true when:
 * - The current time is past the estimated end of the active block, OR
 * - It has been more than 30 minutes since the last recalculation / creation.
 */
export function shouldCheckIn(schedule: DailySchedule, currentTime: Date): boolean {
  const block = getCurrentBlock(schedule);
  if (!block) return false;

  const blockEnd = new Date(block.endTime);
  if (currentTime > blockEnd) return true;

  const lastTouch = schedule.lastRecalculatedAt
    ? new Date(schedule.lastRecalculatedAt)
    : new Date(schedule.createdAt);
  const minutesSinceTouch = (currentTime.getTime() - lastTouch.getTime()) / 60_000;
  return minutesSinceTouch >= 30;
}

/**
 * Generates a contextual check-in message via AI.
 */
export async function generateCheckIn(
  schedule: DailySchedule,
  currentTime: Date,
  uid: string
): Promise<string> {
  const block = getCurrentBlock(schedule);
  if (!block) return 'No active block to check in on.';

  const checkInPrompt = buildCheckInPrompt(block, currentTime, schedule);

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: checkInPrompt },
      ],
      uid,
      stream: false,
    }),
  });

  if (!response.ok) {
    return '⏰ Quick check-in: How\'s the current task going? Let me know if you need to adjust the schedule.';
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? data.content ?? 'Check-in time! How are things going?';
}

// ---------------------------------------------------------------------------
// Block Lifecycle Mutations (pure — return new schedules)
// ---------------------------------------------------------------------------

/** Marks a block as completed and advances currentBlockIndex. */
export function markBlockComplete(schedule: DailySchedule, blockId: string): DailySchedule {
  const blocks = schedule.blocks.map((b) =>
    b.id === blockId ? { ...b, status: 'completed' as const } : b
  );

  let nextIndex = schedule.currentBlockIndex;
  // Advance past completed / skipped blocks
  while (
    nextIndex < blocks.length &&
    (blocks[nextIndex].status === 'completed' || blocks[nextIndex].status === 'skipped')
  ) {
    nextIndex++;
  }

  const allDone = nextIndex >= blocks.length;

  return {
    ...schedule,
    blocks,
    currentBlockIndex: nextIndex,
    state: allDone ? 'COMPLETED' : schedule.state,
  };
}

/** Marks a block as skipped and advances currentBlockIndex. */
export function markBlockSkipped(schedule: DailySchedule, blockId: string): DailySchedule {
  const blocks = schedule.blocks.map((b) =>
    b.id === blockId ? { ...b, status: 'skipped' as const } : b
  );

  let nextIndex = schedule.currentBlockIndex;
  while (
    nextIndex < blocks.length &&
    (blocks[nextIndex].status === 'completed' || blocks[nextIndex].status === 'skipped')
  ) {
    nextIndex++;
  }

  const allDone = nextIndex >= blocks.length;

  return {
    ...schedule,
    blocks,
    currentBlockIndex: nextIndex,
    state: allDone ? 'COMPLETED' : schedule.state,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts JSON from an AI response that may contain markdown fences. */
function extractJSON(text: string): string {
  // Try to extract from ```json ... ``` fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a raw JSON array or object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();

  // Return as-is and hope for the best
  return text.trim();
}
