// Supabase data-access layer. Translates between the relational rows
// (habits / habit_logs / challenges) and the app's `Habit` / `Challenge` shapes.
// All queries are implicitly scoped to the signed-in user by Row-Level Security,
// and inserts default `user_id` to auth.uid() (see supabase/schema.sql).

import { supabase } from '@/lib/supabase';
import type { Challenge, Habit, HabitType } from '@/lib/types';

type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: HabitType;
  target: number;
  created_at: string;
};

type HabitLogRow = { habit_id: string; day: string; count: number };

type ChallengeRow = {
  id: string;
  title: string;
  length_days: number;
  start_key: string;
  reward_claimed: boolean;
};

/**
 * Default habits, mirrored from the `seed_default_habits` trigger in
 * supabase/schema.sql. New accounts are seeded server-side by that trigger;
 * this copy is only used by `resetData` to restore the starter set.
 */
const DEFAULT_HABITS: Pick<HabitRow, 'name' | 'emoji' | 'color' | 'type' | 'target'>[] = [
  { name: 'Drink water', emoji: '💧', color: '#3c87f7', type: 'volume', target: 8 },
  { name: 'Move 20 min', emoji: '🏃', color: '#34c759', type: 'binary', target: 1 },
  { name: 'Read', emoji: '📚', color: '#ff9500', type: 'binary', target: 1 },
];

function rowToHabit(row: HabitRow, logs: HabitLogRow[]): Habit {
  const history: Record<string, number> = {};
  for (const log of logs) if (log.count > 0) history[log.day] = log.count;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    type: row.type,
    target: row.target,
    history,
  };
}

/** Fetch all habits with their logs, assembled into the `Habit` shape. */
export async function fetchHabits(): Promise<Habit[]> {
  const [{ data: habitRows, error: hErr }, { data: logRows, error: lErr }] = await Promise.all([
    supabase.from('habits').select('*').order('created_at', { ascending: true }),
    supabase.from('habit_logs').select('habit_id, day, count'),
  ]);
  if (hErr) throw hErr;
  if (lErr) throw lErr;

  const logsByHabit = new Map<string, HabitLogRow[]>();
  for (const log of (logRows ?? []) as HabitLogRow[]) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log);
    logsByHabit.set(log.habit_id, list);
  }
  return ((habitRows ?? []) as HabitRow[]).map((row) =>
    rowToHabit(row, logsByHabit.get(row.id) ?? [])
  );
}

/**
 * Wipe the user's habits + challenge and restore the default starter habits.
 * Deleting habits cascade-deletes their logs (see schema). Backs the
 * "Reset all data" action.
 */
export async function resetData(): Promise<void> {
  // Supabase requires a filter on delete; `id is not null` matches every row.
  const { error: cErr } = await supabase.from('challenges').delete().not('id', 'is', null);
  if (cErr) throw cErr;
  const { error: hErr } = await supabase.from('habits').delete().not('id', 'is', null);
  if (hErr) throw hErr;
  const { error: sErr } = await supabase.from('habits').insert(DEFAULT_HABITS);
  if (sErr) throw sErr;
}

export type NewHabitInput = {
  name: string;
  emoji: string;
  color: string;
  type: HabitType;
  target: number;
};

export async function insertHabit(input: NewHabitInput): Promise<HabitRow> {
  const { data, error } = await supabase.from('habits').insert(input).select().single();
  if (error) throw error;
  return data as HabitRow;
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTarget(id: string, target: number): Promise<void> {
  const { error } = await supabase.from('habits').update({ target }).eq('id', id);
  if (error) throw error;
}

/**
 * Set the absolute completion count for a habit on a given day. Idempotent, so
 * it replays safely after being queued offline (last write wins for that day).
 * A count of 0 removes the row to keep the table tidy.
 */
export async function setLog(habitId: string, day: string, count: number): Promise<void> {
  if (count <= 0) {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('day', day);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('habit_logs')
    .upsert({ habit_id: habitId, day, count }, { onConflict: 'habit_id,day' });
  if (error) throw error;
}

// --- Challenges -----------------------------------------------------------

function rowToChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    title: row.title,
    lengthDays: row.length_days,
    startKey: row.start_key,
    rewardClaimed: row.reward_claimed,
  };
}

export async function fetchChallenge(): Promise<Challenge | null> {
  const { data, error } = await supabase.from('challenges').select('*').maybeSingle();
  if (error) throw error;
  return data ? rowToChallenge(data as ChallengeRow) : null;
}

export type NewChallengeInput = { title: string; lengthDays: number; startKey: string };

export async function startChallenge(input: NewChallengeInput): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      title: input.title,
      length_days: input.lengthDays,
      start_key: input.startKey,
      reward_claimed: false,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToChallenge(data as ChallengeRow);
}

export async function claimChallenge(id: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ reward_claimed: true })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('challenges').delete().eq('id', id);
  if (error) throw error;
}
