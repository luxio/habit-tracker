import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { addDaysKey, daysSince, todayKey } from '@/lib/date';
import { allComplete, isComplete } from '@/lib/habit';
import { cancelReminders } from '@/lib/notifications';

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
  /** Day the challenge began. */
  startKey: string;
  rewardClaimed: boolean;
};

export type ChallengeStatus = 'active' | 'completed' | 'failed';

const STORAGE_KEY = 'habits.v2';
const LEGACY_KEY = 'habits.v1';
const CHALLENGE_KEY = 'challenge.v1';
const REMINDERS_KEY = 'reminders.v1';
const ONBOARDING_KEY = 'onboarding.v1';

/** Palette used when creating new habits. */
export const HABIT_COLORS = ['#3c87f7', '#34c759', '#ff9500', '#ff2d55', '#af52de', '#5ac8fa'];
export const SUGGESTED_EMOJI = ['💧', '🏃', '📚', '🧘', '🥗', '😴', '✍️', '🎸', '🧹', '☎️'];

function seedHabits(): Habit[] {
  return [
    { id: 'h1', name: 'Drink water', emoji: '💧', color: '#3c87f7', type: 'volume', target: 8, history: {} },
    { id: 'h2', name: 'Move 20 min', emoji: '🏃', color: '#34c759', type: 'binary', target: 1, history: {} },
    { id: 'h3', name: 'Read', emoji: '📚', color: '#ff9500', type: 'binary', target: 1, history: {} },
  ];
}

/** Old (v1) habits stored history as Record<string, boolean>. */
type LegacyHabit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  history: Record<string, boolean>;
};

function migrateLegacy(legacy: LegacyHabit[]): Habit[] {
  return legacy.map((h) => {
    const history: Record<string, number> = {};
    for (const [key, done] of Object.entries(h.history)) if (done) history[key] = 1;
    return { ...h, type: 'binary' as const, target: 1, history };
  });
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
  /** Wipe all persisted data and return to a fresh-install state. */
  resetAll: () => void;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [loading, setLoading] = useState(true);

  // Keep a ref to current habits so imperative callbacks read fresh state.
  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  // Load once on mount (with v1 -> v2 migration).
  useEffect(() => {
    (async () => {
      try {
        const [raw, legacyRaw, challengeRaw, remindersRaw, onboardingRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_KEY),
          AsyncStorage.getItem(CHALLENGE_KEY),
          AsyncStorage.getItem(REMINDERS_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);

        if (raw) {
          setHabits(JSON.parse(raw) as Habit[]);
        } else if (legacyRaw) {
          setHabits(migrateLegacy(JSON.parse(legacyRaw) as LegacyHabit[]));
        } else {
          setHabits(seedHabits());
        }

        if (challengeRaw) setActiveChallenge(JSON.parse(challengeRaw) as Challenge);
        setRemindersEnabledState(remindersRaw === 'true');
        setOnboardingDone(onboardingRaw === 'true');
      } catch {
        setHabits(seedHabits());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist habits on change (after initial load).
  useEffect(() => {
    if (!loading) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits)).catch(() => {});
  }, [habits, loading]);

  // Persist the active challenge (or clear it).
  useEffect(() => {
    if (loading) return;
    if (activeChallenge) {
      AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(activeChallenge)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CHALLENGE_KEY).catch(() => {});
    }
  }, [activeChallenge, loading]);

  const logHabit = useCallback((id: string) => {
    const key = todayKey();
    const habit = habitsRef.current.find((h) => h.id === id);
    let justCompleted = false;
    if (habit) {
      const before = isComplete(habit, key);
      const next = Math.min(habit.target, (habit.history[key] ?? 0) + 1);
      justCompleted = !before && next >= habit.target;
    }
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const count = h.history[key] ?? 0;
        if (count >= h.target) return h; // already at target
        return { ...h, history: { ...h.history, [key]: count + 1 } };
      })
    );
    return { justCompleted };
  }, []);

  const unlogHabit = useCallback((id: string) => {
    const key = todayKey();
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const count = h.history[key] ?? 0;
        if (count <= 0) return h;
        const history = { ...h.history };
        const next = count - 1;
        if (next <= 0) delete history[key];
        else history[key] = next;
        return { ...h, history };
      })
    );
  }, []);

  const addHabit = useCallback<HabitsContextValue['addHabit']>((name, opts) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setHabits((prev) => {
      const type = opts?.type ?? 'binary';
      const habit: Habit = {
        id: `h${Date.now()}`,
        name: trimmed,
        emoji: opts?.emoji ?? SUGGESTED_EMOJI[prev.length % SUGGESTED_EMOJI.length],
        color: opts?.color ?? HABIT_COLORS[prev.length % HABIT_COLORS.length],
        type,
        target: type === 'binary' ? 1 : Math.max(2, opts?.target ?? 3),
        history: {},
      };
      return [...prev, habit];
    });
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const setHabitTarget = useCallback((id: string, target: number) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, target: h.type === 'binary' ? 1 : Math.max(2, target) } : h
      )
    );
  }, []);

  const startChallenge = useCallback((lengthDays: number) => {
    setActiveChallenge({
      id: `c${Date.now()}`,
      title: `${lengthDays}-Day Starter`,
      lengthDays,
      startKey: todayKey(),
      rewardClaimed: false,
    });
  }, []);

  const claimChallengeReward = useCallback(() => {
    setActiveChallenge((prev) => (prev ? { ...prev, rewardClaimed: true } : prev));
  }, []);

  const clearChallenge = useCallback(() => setActiveChallenge(null), []);

  const setRemindersEnabled = useCallback((enabled: boolean) => {
    setRemindersEnabledState(enabled);
    AsyncStorage.setItem(REMINDERS_KEY, enabled ? 'true' : 'false').catch(() => {});
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    // Cancel scheduled reminders, then drop the persisted keys. The habits
    // re-seed (and challenge clear) are persisted by their own effects, so we
    // only remove the keys those effects don't re-write — avoiding a race.
    cancelReminders();
    AsyncStorage.multiRemove([LEGACY_KEY, REMINDERS_KEY, ONBOARDING_KEY]).catch(() => {});
    setHabits(seedHabits());
    setActiveChallenge(null);
    setRemindersEnabledState(false);
    setOnboardingDone(false);
  }, []);

  const value = useMemo(
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
