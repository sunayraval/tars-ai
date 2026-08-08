/**
 * Schedule Recalculator
 *
 * Provides both AI-powered and deterministic (fallback) strategies for
 * adjusting the daily schedule after a disruption.
 */

import type { TimeBlock, DailySchedule, DisruptionReport } from './types';
import { SYSTEM_PROMPT, buildRecalculationPrompt } from './prompts';

// ---------------------------------------------------------------------------
// AI-Powered Recalculation
// ---------------------------------------------------------------------------

/**
 * Calls the AI to intelligently recalculate the remaining schedule after a
 * disruption. Falls back to deterministic helpers if the AI call fails.
 */
export async function recalculateFromAI(
  schedule: DailySchedule,
  disruption: DisruptionReport,
  uid: string
): Promise<{ updatedSchedule: DailySchedule; summary: string }> {
  const remainingBlocks = schedule.blocks.filter(
    (b) => b.status === 'upcoming' || b.status === 'active'
  );

  const currentTime = new Date();
  const prompt = buildRecalculationPrompt(disruption, remainingBlocks, currentTime);

  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('openRouterApiKey') : '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        uid,
        apiKey: apiKey || '',
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Recalculation request failed: ${response.status}`);
    }

    const data = await response.json();
    const content: string =
      data.choices?.[0]?.message?.content ?? data.content ?? '';

    const jsonStr = extractJSON(content);
    const parsed = JSON.parse(jsonStr);

    const newBlocks: TimeBlock[] = (parsed.blocks ?? []).map((raw: any) => ({
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

    // Merge: keep completed/skipped blocks, replace remaining with AI output
    const completedBlocks = schedule.blocks.filter(
      (b) => b.status === 'completed' || b.status === 'skipped'
    );

    const updatedSchedule: DailySchedule = {
      ...schedule,
      blocks: [...completedBlocks, ...newBlocks],
      state: 'ACTIVE',
      lastRecalculatedAt: new Date(),
      currentBlockIndex: completedBlocks.length,
    };

    return {
      updatedSchedule,
      summary: parsed.summary ?? 'Schedule has been recalculated.',
    };
  } catch (error) {
    console.warn('AI recalculation failed, using deterministic fallback:', error);
    return recalculateFallback(schedule, disruption);
  }
}

// ---------------------------------------------------------------------------
// Deterministic Fallbacks
// ---------------------------------------------------------------------------

/**
 * Fallback recalculation using pure functions when AI is unavailable.
 */
function recalculateFallback(
  schedule: DailySchedule,
  disruption: DisruptionReport
): { updatedSchedule: DailySchedule; summary: string } {
  const remaining = schedule.blocks.filter(
    (b) => b.status === 'upcoming' || b.status === 'active'
  );
  const completed = schedule.blocks.filter(
    (b) => b.status === 'completed' || b.status === 'skipped'
  );

  let adjusted: TimeBlock[];
  let summary: string;

  switch (disruption.type) {
    case 'delay':
    case 'extend': {
      const delayMin = disruption.additionalMinutes ?? 15;
      adjusted = shiftBlocks(remaining, delayMin, 0);

      // Check if we've overflowed past the last block's original end
      const originalEnd = remaining.length > 0
        ? new Date(remaining[remaining.length - 1].endTime)
        : new Date();
      const shiftedEnd = adjusted.length > 0
        ? new Date(adjusted[adjusted.length - 1].endTime)
        : new Date();

      if (shiftedEnd > originalEnd) {
        const overflowMin = Math.ceil(
          (shiftedEnd.getTime() - originalEnd.getTime()) / 60_000
        );
        const { kept, dropped } = dropLowestPriority(adjusted, overflowMin);
        adjusted = kept;
        const droppedNames = dropped.map((b) => b.title).join(', ');
        summary = `Shifted remaining blocks by ${delayMin} min. Dropped ${dropped.length} lower-priority task(s)${droppedNames ? `: ${droppedNames}` : ''} to stay within your work hours.`;
      } else {
        summary = `Shifted remaining blocks by ${delayMin} minutes.`;
      }
      break;
    }

    case 'skip': {
      // Remove the skipped block and compress to fill the gap
      const blockId = disruption.blockId;
      adjusted = remaining.filter((b) => b.id !== blockId);
      if (adjusted.length > 0) {
        const gapStart = new Date(adjusted[0].startTime);
        adjusted = reanchorBlocks(adjusted, gapStart);
      }
      summary = 'Skipped task removed; remaining blocks shifted earlier.';
      break;
    }

    case 'new_task': {
      // Append new task at the end — simple approach
      adjusted = [...remaining];
      summary = 'New task will be added. Please regenerate the schedule for optimal placement.';
      break;
    }

    default:
      adjusted = remaining;
      summary = 'No changes made.';
  }

  return {
    updatedSchedule: {
      ...schedule,
      blocks: [...completed, ...adjusted],
      state: 'ACTIVE',
      lastRecalculatedAt: new Date(),
      currentBlockIndex: completed.length,
    },
    summary,
  };
}

// ---------------------------------------------------------------------------
// Pure Helper Functions (exported for direct use as fallbacks)
// ---------------------------------------------------------------------------

/**
 * Shifts all blocks at or after `afterIndex` by `delayMinutes` minutes.
 * Calendar events are NOT shifted.
 */
export function shiftBlocks(
  blocks: TimeBlock[],
  delayMinutes: number,
  afterIndex: number
): TimeBlock[] {
  const delayMs = delayMinutes * 60_000;

  return blocks.map((block, idx) => {
    if (idx < afterIndex || block.isCalendarEvent) return block;

    return {
      ...block,
      startTime: new Date(new Date(block.startTime).getTime() + delayMs),
      endTime: new Date(new Date(block.endTime).getTime() + delayMs),
    };
  });
}

/**
 * Proportionally reduces the duration of remaining blocks so the schedule
 * finishes by `availableEndTime`.
 */
export function compressSchedule(
  blocks: TimeBlock[],
  availableEndTime: Date
): TimeBlock[] {
  if (blocks.length === 0) return blocks;

  const compressible = blocks.filter((b) => !b.isCalendarEvent);
  const fixed = blocks.filter((b) => b.isCalendarEvent);

  const totalCompressibleMs = compressible.reduce(
    (sum, b) =>
      sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()),
    0
  );
  const fixedMs = fixed.reduce(
    (sum, b) =>
      sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()),
    0
  );

  const firstStart = new Date(
    Math.min(...blocks.map((b) => new Date(b.startTime).getTime()))
  );
  const availableMs = availableEndTime.getTime() - firstStart.getTime() - fixedMs;

  if (availableMs <= 0 || totalCompressibleMs <= 0) return blocks;

  const ratio = Math.min(1, availableMs / totalCompressibleMs);

  let cursor = firstStart.getTime();
  return blocks.map((block) => {
    if (block.isCalendarEvent) {
      // Place calendar events at their fixed times
      return block;
    }

    const originalDuration =
      new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    const newDuration = Math.max(
      5 * 60_000, // minimum 5 minutes
      Math.round(originalDuration * ratio)
    );

    const newStart = new Date(cursor);
    const newEnd = new Date(cursor + newDuration);
    cursor += newDuration;

    return {
      ...block,
      startTime: newStart,
      endTime: newEnd,
      estimatedDuration: Math.round(newDuration / 60_000),
    };
  });
}

/**
 * Removes the lowest-priority non-calendar blocks until `overflowMinutes`
 * of time has been recovered.
 */
export function dropLowestPriority(
  blocks: TimeBlock[],
  overflowMinutes: number
): { kept: TimeBlock[]; dropped: TimeBlock[] } {
  // Sort candidates by priority ascending (lowest first)
  const droppable = blocks
    .filter((b) => !b.isCalendarEvent && b.taskId !== 'break' && b.taskId !== 'buffer')
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

  const dropped: TimeBlock[] = [];
  let recoveredMinutes = 0;

  for (const block of droppable) {
    if (recoveredMinutes >= overflowMinutes) break;
    dropped.push(block);
    recoveredMinutes += block.estimatedDuration;
  }

  const droppedIds = new Set(dropped.map((b) => b.id));
  const kept = blocks.filter((b) => !droppedIds.has(b.id));

  return { kept, dropped };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Re-anchors blocks sequentially starting from a given time, preserving durations. */
function reanchorBlocks(blocks: TimeBlock[], startFrom: Date): TimeBlock[] {
  let cursor = startFrom.getTime();
  return blocks.map((block) => {
    if (block.isCalendarEvent) return block;

    const duration =
      new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    const newStart = new Date(cursor);
    const newEnd = new Date(cursor + duration);
    cursor += duration;

    return { ...block, startTime: newStart, endTime: newEnd };
  });
}

/** Extracts JSON from an AI response that may contain markdown fences. */
function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1].trim();

  return text.trim();
}
