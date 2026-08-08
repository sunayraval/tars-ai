/**
 * Scheduling Types
 *
 * Defines the core data structures for the AI-managed scheduling system.
 * The schedule operates as a state machine:
 *   IDLE → SETUP_QA → GENERATING → ACTIVE → CHECK_IN → RECALCULATING → COMPLETED
 */

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

/** All valid states of the daily schedule lifecycle. */
export type ScheduleState =
  | 'IDLE'
  | 'SETUP_QA'
  | 'GENERATING'
  | 'ACTIVE'
  | 'CHECK_IN'
  | 'RECALCULATING'
  | 'COMPLETED';

// ---------------------------------------------------------------------------
// Time Blocks
// ---------------------------------------------------------------------------

/** Status of a single time block within the schedule. */
export type BlockStatus = 'upcoming' | 'active' | 'completed' | 'skipped' | 'delayed';

/** A single scheduled time block — can represent a task, break, or calendar event. */
export interface TimeBlock {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: BlockStatus;
  /** Whether this block originates from a synced calendar event (immovable). */
  isCalendarEvent: boolean;
  /** Estimated duration in minutes. */
  estimatedDuration: number;
  /** Higher number = higher priority. Used for drop decisions during recalculation. */
  priority?: number;
}

// ---------------------------------------------------------------------------
// Daily Schedule
// ---------------------------------------------------------------------------

/** The full schedule for a single day. */
export interface DailySchedule {
  /** ISO date string: YYYY-MM-DD */
  date: string;
  blocks: TimeBlock[];
  state: ScheduleState;
  /** Index of the block that is currently active (or next to start). */
  currentBlockIndex: number;
  createdAt: Date;
  lastRecalculatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Setup Q&A
// ---------------------------------------------------------------------------

/** Supported input types for setup questions. */
export type SetupQuestionType = 'time' | 'text' | 'multiselect' | 'choice';

/** A single question presented during the SETUP_QA phase. */
export interface SetupQuestion {
  id: string;
  question: string;
  type: SetupQuestionType;
  options?: string[];
  answer?: string;
}

/** Collected answers keyed by question id. */
export type SetupAnswers = Record<string, string>;

// ---------------------------------------------------------------------------
// Disruption Reports
// ---------------------------------------------------------------------------

/** Type of disruption a user can report while a schedule is ACTIVE. */
export type DisruptionType = 'delay' | 'skip' | 'new_task' | 'extend';

/** A user-reported disruption that may trigger a schedule recalculation. */
export interface DisruptionReport {
  type: DisruptionType;
  blockId?: string;
  details?: string;
  /** Number of additional minutes needed (for delay/extend types). */
  additionalMinutes?: number;
}

// ---------------------------------------------------------------------------
// Reducer Actions
// ---------------------------------------------------------------------------

/** All actions dispatched to the schedule reducer. */
export type ScheduleAction =
  | { type: 'START_SETUP'; questions: SetupQuestion[] }
  | { type: 'SUBMIT_ANSWER'; questionId: string; answer: string }
  | { type: 'START_GENERATING' }
  | { type: 'SET_SCHEDULE'; schedule: DailySchedule }
  | { type: 'COMPLETE_BLOCK'; blockId: string }
  | { type: 'SKIP_BLOCK'; blockId: string }
  | { type: 'START_RECALCULATING' }
  | { type: 'SET_RECALCULATED'; schedule: DailySchedule }
  | { type: 'START_CHECK_IN' }
  | { type: 'END_CHECK_IN' }
  | { type: 'CANCEL_SCHEDULE' }
  | { type: 'RESTORE_SCHEDULE'; schedule: DailySchedule; questions: SetupQuestion[] };
