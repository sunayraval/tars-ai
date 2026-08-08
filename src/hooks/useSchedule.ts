/**
 * useSchedule Hook
 *
 * Convenience wrapper around useScheduleContext for cleaner imports.
 */

import { useScheduleContext } from '@/contexts/ScheduleContext';

export function useSchedule() {
  const {
    schedule,
    state,
    questions,
    answers,
    startSetup,
    submitAnswer,
    generateSchedule,
    completeCurrentTask,
    reportDelay,
    skipCurrentTask,
    cancelSchedule,
  } = useScheduleContext();

  return {
    schedule,
    state,
    questions,
    answers,
    startSetup,
    submitAnswer,
    generateSchedule,
    completeCurrentTask,
    reportDelay,
    skipCurrentTask,
    cancelSchedule,
  };
}
