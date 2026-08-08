/**
 * Scheduling Prompts
 *
 * Well-engineered prompt templates for every stage of the scheduling pipeline.
 * Each builder produces a string suitable for the system/user message in a
 * POST to /api/chat.
 */

import type { Task } from '@/lib/firebase/firestore';
import type { TimeBlock, SetupAnswers, DailySchedule, DisruptionReport } from './types';

// ---------------------------------------------------------------------------
// System Prompt (shared across all schedule-related AI calls)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are a personal schedule architect — an expert at designing productive, realistic daily plans. You balance focus time, breaks, and calendar commitments to maximise your user's effectiveness.

CORE RULES:
1. Calendar events are IMMOVABLE. Never suggest rescheduling them.
2. Add a 10-minute buffer between consecutive blocks to allow for transitions.
3. Place high-priority tasks in the morning when energy and focus are highest.
4. Include a short break (5–15 min) after every 90 minutes of focused work.
5. Respect the user's stated work-hours window — never schedule outside it.
6. Provide realistic time estimates — most tasks take longer than people think; add a 20 % buffer.
7. If there's more work than time, explicitly say so and recommend what to defer.
8. Always output valid JSON when asked for structured data — no markdown fences, no commentary outside the JSON.`;

// ---------------------------------------------------------------------------
// Setup Q&A Prompt
// ---------------------------------------------------------------------------

/**
 * Generates the prompt used during the SETUP_QA phase. The AI asks 3–4
 * clarifying questions about the user's day before generating a schedule.
 */
export function buildSetupPrompt(
  tasks: Task[],
  calendarEvents?: Array<{ title: string; start: string; end: string }>
): string {
  const taskList = tasks
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}"${t.estimatedDuration ? ` (~${t.estimatedDuration} min)` : ''}${t.status === 'in_progress' ? ' [in progress]' : ''}`
    )
    .join('\n');

  const calendarSection =
    calendarEvents && calendarEvents.length > 0
      ? `\nCALENDAR EVENTS (immovable):\n${calendarEvents.map((e) => `• ${e.title}: ${e.start} – ${e.end}`).join('\n')}`
      : '\nNo calendar events today.';

  return `The user wants to plan their day. Here is their context:

TASKS:
${taskList || '(no tasks yet)'}
${calendarSection}

Ask 3–4 brief, focused questions to understand:
1. What time they want to start and finish their work day.
2. Which tasks are most important / urgent today.
3. Any personal preferences (e.g., prefer deep work in morning, meetings in afternoon).
4. Energy level or special constraints for today.

Keep each question short and number them. Do NOT generate a schedule yet.`;
}

// ---------------------------------------------------------------------------
// Schedule Generation Prompt
// ---------------------------------------------------------------------------

/**
 * Produces the prompt that requests a full day schedule as a JSON array of
 * TimeBlock objects. The prompt embeds the exact schema so the model knows
 * what to return.
 */
export function buildGenerationPrompt(
  answers: SetupAnswers,
  tasks: Task[],
  calendarEvents?: Array<{ title: string; start: string; end: string }>
): string {
  const answersText = Object.entries(answers)
    .map(([key, value]) => `• ${key}: ${value}`)
    .join('\n');

  const taskList = tasks
    .map(
      (t, i) =>
        `${i + 1}. [id: "${t.id}"] "${t.title}"${t.description ? ` — ${t.description}` : ''}${t.estimatedDuration ? ` (~${t.estimatedDuration} min)` : ''}${t.status === 'in_progress' ? ' [in progress]' : ''}`
    )
    .join('\n');

  const calendarSection =
    calendarEvents && calendarEvents.length > 0
      ? `\nCALENDAR EVENTS (immovable — include them as blocks with isCalendarEvent: true):\n${calendarEvents.map((e) => `• "${e.title}": ${e.start} – ${e.end}`).join('\n')}`
      : '';

  const todayISO = new Date().toISOString().slice(0, 10);

  return `Generate a daily schedule for ${todayISO}.

USER PREFERENCES:
${answersText}

TASKS TO SCHEDULE:
${taskList || '(none — suggest a light day with focus on breaks and reflection)'}
${calendarSection}

RULES:
- Respect the user's start/end work hours from their answers.
- Calendar events are immovable; schedule tasks around them.
- Add 10-minute buffers between blocks.
- Place higher-priority tasks earlier.
- Include short breaks (5–15 min) after every 90 min of work.
- If tasks don't fit, note which ones were dropped and why.

Return ONLY a valid JSON array of objects matching this schema (no extra text):

[
  {
    "id": "<unique-string>",
    "taskId": "<matching task id or 'break' or 'buffer'>",
    "title": "<block title>",
    "description": "<optional details>",
    "startTime": "<ISO 8601 datetime>",
    "endTime": "<ISO 8601 datetime>",
    "status": "upcoming",
    "isCalendarEvent": false,
    "estimatedDuration": <minutes as number>,
    "priority": <1-10, 10 = highest>
  }
]

If there are tasks that do not fit, append a final object with taskId "overflow" listing dropped tasks in the description.`;
}

// ---------------------------------------------------------------------------
// Check-In Prompt
// ---------------------------------------------------------------------------

/**
 * Generates a contextual check-in message for the currently active block.
 * If the user is past the estimated end time the prompt nudges towards
 * wrapping up or extending.
 */
export function buildCheckInPrompt(
  currentBlock: TimeBlock,
  currentTime: Date,
  schedule: DailySchedule
): string {
  const endTime = new Date(currentBlock.endTime);
  const overrunMinutes = Math.max(
    0,
    Math.round((currentTime.getTime() - endTime.getTime()) / 60_000)
  );

  const completedCount = schedule.blocks.filter((b) => b.status === 'completed').length;
  const totalCount = schedule.blocks.filter((b) => !b.isCalendarEvent && b.taskId !== 'buffer' && b.taskId !== 'break').length;

  const overrunSection =
    overrunMinutes > 0
      ? `\n⚠️  The user is ${overrunMinutes} minute(s) past the planned end time for this block.`
      : '';

  return `Time for a check-in!

CURRENT BLOCK: "${currentBlock.title}"
Planned: ${new Date(currentBlock.startTime).toLocaleTimeString()} – ${endTime.toLocaleTimeString()}
Now: ${currentTime.toLocaleTimeString()}
${overrunSection}

Progress today: ${completedCount}/${totalCount} tasks completed.

Write a brief, encouraging check-in (2–3 sentences). If the user is overrunning:
- Ask if they need more time or want to wrap up.
- Mention that the rest of the schedule can be adjusted.
Otherwise, offer a quick motivational note and remind them of the next task.`;
}

// ---------------------------------------------------------------------------
// Recalculation Prompt
// ---------------------------------------------------------------------------

/**
 * Asks the AI to recalculate the remaining schedule after a disruption.
 * Returns both a new block list and a human-readable summary.
 */
export function buildRecalculationPrompt(
  disruption: DisruptionReport,
  remainingBlocks: TimeBlock[],
  currentTime: Date
): string {
  const blocksJSON = JSON.stringify(
    remainingBlocks.map((b) => ({
      id: b.id,
      taskId: b.taskId,
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
      isCalendarEvent: b.isCalendarEvent,
      estimatedDuration: b.estimatedDuration,
      priority: b.priority ?? 5,
    })),
    null,
    2
  );

  const disruptionDescription = (() => {
    switch (disruption.type) {
      case 'delay':
        return `The user needs ${disruption.additionalMinutes ?? 15} extra minutes on "${disruption.details ?? 'the current task'}".`;
      case 'skip':
        return `The user wants to skip "${disruption.details ?? 'a task'}".`;
      case 'new_task':
        return `The user wants to add a new task: "${disruption.details ?? 'untitled'}".`;
      case 'extend':
        return `The current task is being extended by ${disruption.additionalMinutes ?? 15} minutes.`;
    }
  })();

  return `A schedule disruption has occurred. Recalculate the remaining schedule.

DISRUPTION: ${disruptionDescription}
CURRENT TIME: ${currentTime.toISOString()}

REMAINING BLOCKS:
${blocksJSON}

RULES:
1. Calendar events (isCalendarEvent: true) MUST NOT be moved.
2. Compress lower-priority blocks proportionally to absorb the delay.
3. If compression is not enough, drop the lowest-priority non-calendar block(s).
4. Maintain 10-minute buffers between blocks.
5. Never schedule past the last block's original end time.

Return ONLY a valid JSON object with this shape (no extra text):

{
  "blocks": [ <recalculated TimeBlock array, same schema as input> ],
  "summary": "<1–2 sentence human-readable explanation of what changed>"
}`;
}
