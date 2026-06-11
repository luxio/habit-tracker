// TanStack Query setup: the QueryClient, an AsyncStorage persister (so the cache
// survives app restarts for instant cold-start reads), NetInfo-driven online
// detection (so mutations pause offline and resume on reconnect), and the
// mutation defaults that let queued offline writes replay after a restart.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';

import * as api from '@/lib/habits-api';

// Mutation keys — shared between query-client (defaults) and the store (so the
// store can attach optimistic onMutate/onSettled to the same mutations).
export const mutationKeys = {
  habitAdd: ['habits', 'add'] as const,
  habitDelete: ['habits', 'delete'] as const,
  habitSetTarget: ['habits', 'setTarget'] as const,
  habitSetLog: ['habits', 'setLog'] as const,
  challengeStart: ['challenge', 'start'] as const,
  challengeClaim: ['challenge', 'claim'] as const,
  challengeClear: ['challenge', 'clear'] as const,
};

// Query keys are scoped by user id so one account never reads another's
// persisted cache (the AsyncStorage cache is shared across sign-ins).
export const queryKeys = {
  habits: (userId: string) => ['habits', userId] as const,
  challenge: (userId: string) => ['challenge', userId] as const,
};

// Variable payloads for each mutation (also what gets persisted when offline).
export type HabitAddVars = api.NewHabitInput & { tempId: string };
export type HabitDeleteVars = { id: string };
export type HabitSetTargetVars = { id: string; target: number };
export type HabitSetLogVars = { habitId: string; day: string; count: number };
export type ChallengeStartVars = api.NewChallengeInput;
export type ChallengeClaimVars = { id: string };
export type ChallengeClearVars = { id: string };

// Drive online/offline state from the device's real connectivity.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  })
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep cached data around long enough to back offline reads and persist.
      gcTime: 1000 * 60 * 60 * 24, // 24h
      retry: 2,
    },
    mutations: {
      // Persisted offline mutations should keep retrying until they succeed.
      retry: 3,
    },
  },
});

// Register the actual network functions for each mutation key. This is what
// lets mutations restored from disk (after an offline restart) know how to run.
queryClient.setMutationDefaults(mutationKeys.habitAdd, {
  // tempId is client-only (for the optimistic row); drop it before insert.
  mutationFn: ({ tempId: _tempId, ...input }: HabitAddVars) => api.insertHabit(input),
});
queryClient.setMutationDefaults(mutationKeys.habitDelete, {
  mutationFn: ({ id }: HabitDeleteVars) => api.deleteHabit(id),
});
queryClient.setMutationDefaults(mutationKeys.habitSetTarget, {
  mutationFn: ({ id, target }: HabitSetTargetVars) => api.updateTarget(id, target),
});
queryClient.setMutationDefaults(mutationKeys.habitSetLog, {
  mutationFn: ({ habitId, day, count }: HabitSetLogVars) => api.setLog(habitId, day, count),
});
queryClient.setMutationDefaults(mutationKeys.challengeStart, {
  mutationFn: (vars: ChallengeStartVars) => api.startChallenge(vars),
});
queryClient.setMutationDefaults(mutationKeys.challengeClaim, {
  mutationFn: ({ id }: ChallengeClaimVars) => api.claimChallenge(id),
});
queryClient.setMutationDefaults(mutationKeys.challengeClear, {
  mutationFn: ({ id }: ChallengeClearVars) => api.deleteChallenge(id),
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'habit-tracker-query-cache',
});
