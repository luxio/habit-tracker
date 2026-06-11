// Shared domain types. Kept in their own module so both the data-access layer
// (habits-api) and the store can import them without a circular dependency.

export type HabitType = 'binary' | 'volume';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** 'binary' = once/day; 'volume' = target times/day. */
  type: HabitType;
  /** Completions needed per day (binary = 1). */
  target: number;
  /** Map of 'YYYY-MM-DD' -> times logged that day. */
  history: Record<string, number>;
};

export type Challenge = {
  id: string;
  title: string;
  lengthDays: number;
  /** Day the challenge began ('YYYY-MM-DD'). */
  startKey: string;
  rewardClaimed: boolean;
};

export type ChallengeStatus = 'active' | 'completed' | 'failed';
