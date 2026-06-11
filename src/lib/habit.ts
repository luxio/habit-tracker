/** Pure, component-free helpers derived from a Habit's type/target/history. */

import { lastNDays, todayKey } from '@/lib/date';
import type { Habit } from '@/lib/habits-store';

/** Times the habit was logged on a given day (0 if none). */
export function countForDay(habit: Habit, key: string = todayKey()): number {
  return habit.history[key] ?? 0;
}

/** A day counts as complete once the logged count reaches the target. */
export function isComplete(habit: Habit, key: string = todayKey()): boolean {
  return countForDay(habit, key) >= habit.target;
}

/** Today's progress for rendering counters/rings. */
export function progressForDay(habit: Habit, key: string = todayKey()) {
  return { count: countForDay(habit, key), target: habit.target };
}

/**
 * Boolean "completed day" map, so the existing streak/grid helpers in date.ts
 * keep their `Record<string, boolean>` signatures unchanged.
 */
export function completionMap(habit: Habit): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(habit.history)) {
    if (isComplete(habit, key)) out[key] = true;
  }
  return out;
}

/** Overall completion rate (0–100) across all habits over the last `days`. */
export function consistency(habits: Habit[], days: number): number {
  if (habits.length === 0) return 0;
  const keys = lastNDays(days);
  let done = 0;
  for (const key of keys) {
    for (const habit of habits) if (isComplete(habit, key)) done++;
  }
  const possible = keys.length * habits.length;
  return possible === 0 ? 0 : Math.round((done / possible) * 100);
}

/** Fraction (0–1) of habits complete on a given day — used by per-day bars. */
export function dayCompletionRatio(habits: Habit[], key: string): number {
  if (habits.length === 0) return 0;
  const done = habits.filter((h) => isComplete(h, key)).length;
  return done / habits.length;
}

/** True when every habit is complete on the given day (challenge day success). */
export function allComplete(habits: Habit[], key: string): boolean {
  return habits.length > 0 && habits.every((h) => isComplete(h, key));
}
