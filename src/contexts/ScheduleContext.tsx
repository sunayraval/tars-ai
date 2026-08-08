'use client';

/**
 * ScheduleContext
 *
 * Manages the daily schedule state machine via useReducer. Coordinates AI
 * calls for generation, check-ins, and recalculation. Persists to and
 * restores from Firestore.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ScheduleState,
  DailySchedule,
  SetupQuestion,
  SetupAnswers,
  ScheduleAction,
  TimeBlock,
} from '@/lib/scheduling/types';
import { generateSetupQuestions, buildScheduleFromAI, shouldCheckIn, generateCheckIn, markBlockComplete, markBlockSkipped } from '@/lib/scheduling/engine';
import { recalculateFromAI } from '@/lib/scheduling/recalculator';
import { useAuthContext } from './AuthContext';
import { useChatContext } from './ChatContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';

// ---------------------------------------------------------------------------
// Reducer State
// ---------------------------------------------------------------------------

interface ScheduleReducerState {
  schedule: DailySchedule | null;
  state: ScheduleState;
  questions: SetupQuestion[];
  answers: SetupAnswers;
}

const initialState: ScheduleReducerState = {
  schedule: null,
  state: 'IDLE',
  questions: [],
  answers: {},
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function scheduleReducer(
  s: ScheduleReducerState,
  action: ScheduleAction
): ScheduleReducerState {
  switch (action.type) {
    case 'START_SETUP':
      return {
        ...s,
        state: 'SETUP_QA',
        questions: action.questions,
        answers: {},
      };

    case 'SUBMIT_ANSWER':
      return {
        ...s,
        answers: { ...s.answers, [action.questionId]: action.answer },
        questions: s.questions.map((q) =>
          q.id === action.questionId ? { ...q, answer: action.answer } : q
        ),
      };

    case 'START_GENERATING':
      return { ...s, state: 'GENERATING' };

    case 'SET_SCHEDULE':
      return {
        ...s,
        state: action.schedule.state,
        schedule: action.schedule,
      };

    case 'COMPLETE_BLOCK': {
      if (!s.schedule) return s;
      const updated = markBlockComplete(s.schedule, action.blockId);
      return {
        ...s,
        schedule: updated,
        state: updated.state,
      };
    }

    case 'SKIP_BLOCK': {
      if (!s.schedule) return s;
      const updated = markBlockSkipped(s.schedule, action.blockId);
      return {
        ...s,
        schedule: updated,
        state: updated.state,
      };
    }

    case 'START_RECALCULATING':
      return { ...s, state: 'RECALCULATING' };

    case 'SET_RECALCULATED':
      return {
        ...s,
        state: action.schedule.state,
        schedule: action.schedule,
      };

    case 'START_CHECK_IN':
      return { ...s, state: 'CHECK_IN' };

    case 'END_CHECK_IN':
      return { ...s, state: 'ACTIVE' };

    case 'CANCEL_SCHEDULE':
      return { ...initialState };

    case 'RESTORE_SCHEDULE':
      return {
        ...s,
        schedule: action.schedule,
        state: action.schedule.state,
        questions: action.questions,
      };

    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ScheduleContextValue {
  schedule: DailySchedule | null;
  state: ScheduleState;
  questions: SetupQuestion[];
  answers: SetupAnswers;
  startSetup: () => void;
  submitAnswer: (questionId: string, answer: string) => void;
  generateSchedule: () => Promise<void>;
  completeCurrentTask: () => void;
  reportDelay: (minutes: number) => Promise<void>;
  skipCurrentTask: () => void;
  cancelSchedule: () => void;
}

const ScheduleContext = createContext<ScheduleContextValue | undefined>(
  undefined
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const { sendSystemMessage } = useChatContext();
  const [reducerState, dispatch] = useReducer(scheduleReducer, initialState);
  const checkInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { schedule, state, questions, answers } = reducerState;

  // ---- Firestore persistence key ----
  const todayKey = new Date().toISOString().slice(0, 10);

  const getScheduleDocRef = useCallback(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'schedules', todayKey);
  }, [user, todayKey]);

  // ---- Persist schedule changes ----
  useEffect(() => {
    if (!schedule || !user) return;

    const ref = getScheduleDocRef();
    if (!ref) return;

    const serialisable = {
      ...schedule,
      blocks: schedule.blocks.map((b) => ({
        ...b,
        startTime: new Date(b.startTime).toISOString(),
        endTime: new Date(b.endTime).toISOString(),
      })),
      createdAt: new Date(schedule.createdAt).toISOString(),
      lastRecalculatedAt: schedule.lastRecalculatedAt
        ? new Date(schedule.lastRecalculatedAt).toISOString()
        : null,
    };

    setDoc(ref, serialisable, { merge: true }).catch((err) =>
      console.error('Failed to persist schedule:', err)
    );
  }, [schedule, user, getScheduleDocRef]);

  // ---- Restore today's schedule on mount ----
  useEffect(() => {
    if (!user) return;

    const ref = getScheduleDocRef();
    if (!ref) return;

    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const restored: DailySchedule = {
            date: data.date,
            blocks: (data.blocks ?? []).map((b: any) => ({
              ...b,
              startTime: new Date(b.startTime),
              endTime: new Date(b.endTime),
            })),
            state: data.state ?? 'IDLE',
            currentBlockIndex: data.currentBlockIndex ?? 0,
            createdAt: new Date(data.createdAt),
            lastRecalculatedAt: data.lastRecalculatedAt
              ? new Date(data.lastRecalculatedAt)
              : undefined,
          };

          if (restored.state !== 'IDLE' && restored.state !== 'COMPLETED') {
            dispatch({
              type: 'RESTORE_SCHEDULE',
              schedule: restored,
              questions: [],
            });
          }
        }
      })
      .catch((err) => console.error('Failed to restore schedule:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---- Check-in timer (every 60s while ACTIVE) ----
  useEffect(() => {
    if (state !== 'ACTIVE' || !schedule || !user) {
      if (checkInTimerRef.current) {
        clearInterval(checkInTimerRef.current);
        checkInTimerRef.current = null;
      }
      return;
    }

    checkInTimerRef.current = setInterval(async () => {
      const now = new Date();
      if (shouldCheckIn(schedule, now)) {
        dispatch({ type: 'START_CHECK_IN' });

        try {
          const message = await generateCheckIn(schedule, now, user.uid);
          await sendSystemMessage(`🕐 **Schedule Check-in**\n\n${message}`);
        } catch (err) {
          console.error('Check-in failed:', err);
        } finally {
          dispatch({ type: 'END_CHECK_IN' });
        }
      }
    }, 60_000);

    return () => {
      if (checkInTimerRef.current) {
        clearInterval(checkInTimerRef.current);
        checkInTimerRef.current = null;
      }
    };
  }, [state, schedule, user, sendSystemMessage]);

  // ==== Actions ====

  const startSetup = useCallback(() => {
    // We import tasks from a hook elsewhere — for now use empty array
    // The dashboard page will supply tasks via generateSetupQuestions
    const qs = generateSetupQuestions([]);
    dispatch({ type: 'START_SETUP', questions: qs });
  }, []);

  const submitAnswer = useCallback(
    (questionId: string, answer: string) => {
      dispatch({ type: 'SUBMIT_ANSWER', questionId, answer });
    },
    []
  );

  const generateScheduleAction = useCallback(async () => {
    if (!user) return;

    dispatch({ type: 'START_GENERATING' });

    try {
      const daily = await buildScheduleFromAI(answers, [], [], user.uid);
      dispatch({ type: 'SET_SCHEDULE', schedule: daily });
      await sendSystemMessage(
        '✅ **Schedule generated!** Your daily plan is ready. Good luck!'
      );
    } catch (err) {
      console.error('Schedule generation failed:', err);
      await sendSystemMessage(
        '❌ Failed to generate schedule. Please try again.'
      );
      dispatch({ type: 'CANCEL_SCHEDULE' });
    }
  }, [user, answers, sendSystemMessage]);

  const completeCurrentTask = useCallback(() => {
    if (!schedule) return;
    const block = schedule.blocks[schedule.currentBlockIndex];
    if (!block) return;
    dispatch({ type: 'COMPLETE_BLOCK', blockId: block.id });
    sendSystemMessage(
      `✅ Completed: **${block.title}**. Moving on!`
    );
  }, [schedule, sendSystemMessage]);

  const reportDelay = useCallback(
    async (minutes: number) => {
      if (!schedule || !user) return;

      dispatch({ type: 'START_RECALCULATING' });

      try {
        const { updatedSchedule, summary } = await recalculateFromAI(
          schedule,
          { type: 'delay', additionalMinutes: minutes },
          user.uid
        );
        dispatch({ type: 'SET_RECALCULATED', schedule: updatedSchedule });
        await sendSystemMessage(`🔄 **Schedule adjusted:** ${summary}`);
      } catch (err) {
        console.error('Recalculation failed:', err);
        dispatch({ type: 'END_CHECK_IN' }); // return to ACTIVE
        await sendSystemMessage(
          '⚠️ Could not recalculate. The current schedule remains unchanged.'
        );
      }
    },
    [schedule, user, sendSystemMessage]
  );

  const skipCurrentTask = useCallback(() => {
    if (!schedule) return;
    const block = schedule.blocks[schedule.currentBlockIndex];
    if (!block) return;
    dispatch({ type: 'SKIP_BLOCK', blockId: block.id });
    sendSystemMessage(
      `⏭️ Skipped: **${block.title}**. Moving to the next block.`
    );
  }, [schedule, sendSystemMessage]);

  const cancelSchedule = useCallback(() => {
    dispatch({ type: 'CANCEL_SCHEDULE' });
    sendSystemMessage('🚫 Schedule cancelled.');
  }, [sendSystemMessage]);

  return (
    <ScheduleContext.Provider
      value={{
        schedule,
        state,
        questions,
        answers,
        startSetup,
        submitAnswer,
        generateSchedule: generateScheduleAction,
        completeCurrentTask,
        reportDelay,
        skipCurrentTask,
        cancelSchedule,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScheduleContext(): ScheduleContextValue {
  const ctx = useContext(ScheduleContext);
  if (!ctx) {
    throw new Error('useScheduleContext must be used inside <ScheduleProvider>');
  }
  return ctx;
}
