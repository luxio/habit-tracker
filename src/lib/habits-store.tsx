import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/lib/auth';
import { addDaysKey, daysSince, todayKey } from '@/lib/date';
import { allComplete } from '@/lib/habit';
import * as api from '@/lib/habits-api';
import { cancelReminders } from '@/lib/notifications';
import {
  mutationKeys,
  queryClient,
  queryKeys,
  type ChallengeStartVars,
  type HabitAddVars,
  type HabitSetLogVars,
} from '@/lib/query-client';
import type { Challenge, ChallengeStatus, Habit, HabitType } from '@/lib/types';

// Re-exported so existing screens keep importing these from '@/lib/habits-store'.
export type { Challenge, ChallengeStatus, Habit, HabitType };

const REMINDERS_KEY = 'reminders.v1';
const ONBOARDING_KEY = 'onboarding.v1';

/** Palette used when creating new habits. */
export const HABIT_COLORS = ['#3c87f7', '#34c759', '#ff9500', '#ff2d55', '#af52de', '#5ac8fa'];
export const SUGGESTED_EMOJI = ['💧', '🏃', '📚', '🧘', '🥗', '😴', '✍️', '🎸', '🧹', '☎️'];

function tempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Derived progress/status for a challenge against current habits. */
export function evaluateChallenge(
  challenge: Challenge,
  habits: Habit[]
): { progress: number; status: ChallengeStatus } {
  let progress = 0;
  let status: ChallengeStatus = 'active';
  for (let offset = 0; offset < challenge.lengthDays; offset++) {
    const key = addDaysKey(challenge.startKey, offset);
    if (allComplete(habits, key)) {
      progress++;
      continue;
    }
    // Day not fully complete: if it's already over, the challenge is broken.
    if (daysSince(key) >= 1) status = 'failed';
    break;
  }
  if (status !== 'failed' && progress >= challenge.lengthDays) status = 'completed';
  return { progress, status };
}

type HabitsContextValue = {
  habits: Habit[];
  loading: boolean;
  onboardingDone: boolean;
  remindersEnabled: boolean;
  activeChallenge: Challenge | null;
  /** Log a completion for today. Returns whether it just reached its target. */
  logHabit: (id: string) => { justCompleted: boolean };
  /** Remove one of today's completions (decrement / un-check). */
  unlogHabit: (id: string) => void;
  addHabit: (
    name: string,
    opts?: { type?: HabitType; target?: number; emoji?: string; color?: string }
  ) => void;
  deleteHabit: (id: string) => void;
  setHabitTarget: (id: string, target: number) => void;
  startChallenge: (lengthDays: number) => void;
  claimChallengeReward: () => void;
  clearChallenge: () => void;
  setRemindersEnabled: (enabled: boolean) => void;
  completeOnboarding: () => void;
  /** Wipe all data (server + local prefs) and restore the default habits. */
  resetAll: () => void;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const enabled = !!userId;

  // ---- Device-local prefs (not user data; stay in AsyncStorage) ----
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [remindersRaw, onboardingRaw] = await Promise.all([
          AsyncStorage.getItem(REMINDERS_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);
        setRemindersEnabledState(remindersRaw === 'true');
        setOnboardingDone(onboardingRaw === 'true');
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, []);

  // ---- Server state (habits + challenge) via TanStack Query ----
  const habitsKey = queryKeys.habits(userId ?? 'anon');
  const challengeKey = queryKeys.challenge(userId ?? 'anon');

  const habitsQuery = useQuery({
    queryKey: habitsKey,
    queryFn: api.fetchHabits,
    enabled,
  });
  const challengeQuery = useQuery({
    queryKey: challengeKey,
    queryFn: api.fetchChallenge,
    enabled,
  });

  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data]);
  const activeChallenge = challengeQuery.data ?? null;

  const getHabits = useCallback(
    () => queryClient.getQueryData<Habit[]>(habitsKey) ?? [],
    [habitsKey]
  );
  const setHabitsData = useCallback(
    (updater: (prev: Habit[]) => Habit[]) => {
      queryClient.setQueryData<Habit[]>(habitsKey, (prev) => updater(prev ?? []));
    },
    [habitsKey]
  );

  // ---- Habit mutations (optimistic; mutationFn comes from setMutationDefaults) ----

  const setLogMutation = useMutation<unknown, Error, HabitSetLogVars, { prev: Habit[] }>({
    mutationKey: mutationKeys.habitSetLog,
    onMutate: async ({ habitId, day, count }) => {
      await queryClient.cancelQueries({ queryKey: habitsKey });
      const prev = getHabits();
      setHabitsData((habits) =>
        habits.map((h) => {
          if (h.id !== habitId) return h;
          const history = { ...h.history };
          if (count <= 0) delete history[day];
          else history[day] = count;
          return { ...h, history };
        })
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(habitsKey, ctx.prev);
    },
    // No onSettled refetch: avoids flicker during rapid toggling. The optimistic
    // value matches what we wrote; fetchHabits reconciles on the next load.
  });

  const addMutation = useMutation<unknown, Error, HabitAddVars, { prev: Habit[] }>({
    mutationKey: mutationKeys.habitAdd,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: habitsKey });
      const prev = getHabits();
      const optimistic: Habit = {
        id: vars.tempId,
        name: vars.name,
        emoji: vars.emoji,
        color: vars.color,
        type: vars.type,
        target: vars.target,
        history: {},
      };
      setHabitsData((habits) => [...habits, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(habitsKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });

  const deleteMutation = useMutation<unknown, Error, { id: string }, { prev: Habit[] }>({
    mutationKey: mutationKeys.habitDelete,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: habitsKey });
      const prev = getHabits();
      setHabitsData((habits) => habits.filter((h) => h.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(habitsKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });

  const targetMutation = useMutation<unknown, Error, { id: string; target: number }, { prev: Habit[] }>({
    mutationKey: mutationKeys.habitSetTarget,
    onMutate: async ({ id, target }) => {
      await queryClient.cancelQueries({ queryKey: habitsKey });
      const prev = getHabits();
      setHabitsData((habits) => habits.map((h) => (h.id === id ? { ...h, target } : h)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(habitsKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });

  // ---- Challenge mutations ----

  const startChallengeMutation = useMutation<unknown, Error, ChallengeStartVars, { prev: Challenge | null }>({
    mutationKey: mutationKeys.challengeStart,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: challengeKey });
      const prev = queryClient.getQueryData<Challenge | null>(challengeKey) ?? null;
      const optimistic: Challenge = {
        id: tempId('c'),
        title: vars.title,
        lengthDays: vars.lengthDays,
        startKey: vars.startKey,
        rewardClaimed: false,
      };
      queryClient.setQueryData<Challenge | null>(challengeKey, optimistic);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(challengeKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: challengeKey }),
  });

  const claimChallengeMutation = useMutation<unknown, Error, { id: string }, { prev: Challenge | null }>({
    mutationKey: mutationKeys.challengeClaim,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: challengeKey });
      const prev = queryClient.getQueryData<Challenge | null>(challengeKey) ?? null;
      queryClient.setQueryData<Challenge | null>(challengeKey, (c) =>
        c ? { ...c, rewardClaimed: true } : c
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(challengeKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: challengeKey }),
  });

  const clearChallengeMutation = useMutation<unknown, Error, { id: string }, { prev: Challenge | null }>({
    mutationKey: mutationKeys.challengeClear,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: challengeKey });
      const prev = queryClient.getQueryData<Challenge | null>(challengeKey) ?? null;
      queryClient.setQueryData<Challenge | null>(challengeKey, null);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(challengeKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: challengeKey }),
  });

  // ---- Imperative API (same shape the screens already use) ----

  const logHabit = useCallback(
    (id: string) => {
      const key = todayKey();
      const habit = getHabits().find((h) => h.id === id);
      if (!habit) return { justCompleted: false };
      const count = habit.history[key] ?? 0;
      if (count >= habit.target) return { justCompleted: false }; // already at target
      const next = count + 1;
      setLogMutation.mutate({ habitId: id, day: key, count: next });
      return { justCompleted: next >= habit.target };
    },
    [getHabits, setLogMutation]
  );

  const unlogHabit = useCallback(
    (id: string) => {
      const key = todayKey();
      const habit = getHabits().find((h) => h.id === id);
      if (!habit) return;
      const count = habit.history[key] ?? 0;
      if (count <= 0) return;
      setLogMutation.mutate({ habitId: id, day: key, count: count - 1 });
    },
    [getHabits, setLogMutation]
  );

  const addHabit = useCallback<HabitsContextValue['addHabit']>(
    (name, opts) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const count = getHabits().length;
      const type = opts?.type ?? 'binary';
      addMutation.mutate({
        tempId: tempId('h'),
        name: trimmed,
        emoji: opts?.emoji ?? SUGGESTED_EMOJI[count % SUGGESTED_EMOJI.length],
        color: opts?.color ?? HABIT_COLORS[count % HABIT_COLORS.length],
        type,
        target: type === 'binary' ? 1 : Math.max(2, opts?.target ?? 3),
      });
    },
    [getHabits, addMutation]
  );

  const deleteHabit = useCallback((id: string) => deleteMutation.mutate({ id }), [deleteMutation]);

  const setHabitTarget = useCallback(
    (id: string, target: number) => {
      const habit = getHabits().find((h) => h.id === id);
      if (!habit) return;
      const next = habit.type === 'binary' ? 1 : Math.max(2, target);
      targetMutation.mutate({ id, target: next });
    },
    [getHabits, targetMutation]
  );

  const startChallenge = useCallback(
    (lengthDays: number) => {
      startChallengeMutation.mutate({
        title: `${lengthDays}-Day Starter`,
        lengthDays,
        startKey: todayKey(),
      });
    },
    [startChallengeMutation]
  );

  const claimChallengeReward = useCallback(() => {
    const current = queryClient.getQueryData<Challenge | null>(challengeKey);
    if (current) claimChallengeMutation.mutate({ id: current.id });
  }, [challengeKey, claimChallengeMutation]);

  const clearChallenge = useCallback(() => {
    const current = queryClient.getQueryData<Challenge | null>(challengeKey);
    if (current) clearChallengeMutation.mutate({ id: current.id });
  }, [challengeKey, clearChallengeMutation]);

  const setRemindersEnabled = useCallback((value: boolean) => {
    setRemindersEnabledState(value);
    AsyncStorage.setItem(REMINDERS_KEY, value ? 'true' : 'false').catch(() => {});
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    cancelReminders();
    AsyncStorage.multiRemove([REMINDERS_KEY, ONBOARDING_KEY]).catch(() => {});
    setRemindersEnabledState(false);
    setOnboardingDone(false);
    // Wipe + reseed on the server, then refetch.
    api
      .resetData()
      .catch(() => {})
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
        queryClient.invalidateQueries({ queryKey: challengeKey });
      });
  }, [habitsKey, challengeKey]);

  const loading = prefsLoading || (enabled && habitsQuery.isLoading);

  const value = useMemo<HabitsContextValue>(
    () => ({
      habits,
      loading,
      onboardingDone,
      remindersEnabled,
      activeChallenge,
      logHabit,
      unlogHabit,
      addHabit,
      deleteHabit,
      setHabitTarget,
      startChallenge,
      claimChallengeReward,
      clearChallenge,
      setRemindersEnabled,
      completeOnboarding,
      resetAll,
    }),
    [
      habits,
      loading,
      onboardingDone,
      remindersEnabled,
      activeChallenge,
      logHabit,
      unlogHabit,
      addHabit,
      deleteHabit,
      setHabitTarget,
      startChallenge,
      claimChallengeReward,
      clearChallenge,
      setRemindersEnabled,
      completeOnboarding,
      resetAll,
    ]
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within a HabitsProvider');
  return ctx;
}
