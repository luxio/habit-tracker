import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CelebrationProvider } from '@/components/celebration';
import { AuthProvider, useAuth } from '@/lib/auth';
import { HabitsProvider } from '@/lib/habits-store';
import { asyncStoragePersister, queryClient } from '@/lib/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
      // Once the cache is rehydrated from disk, replay any writes that were
      // queued while offline.
      onSuccess={() => {
        queryClient.resumePausedMutations();
      }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <HabitsProvider>
            <CelebrationProvider>
              <AnimatedSplashOverlay />
              <RootNavigator />
            </CelebrationProvider>
          </HabitsProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function RootNavigator() {
  useAuthRedirect();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="habit/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

/** Redirect to the auth flow when signed out, and into the app when signed in. */
function useAuthRedirect() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);
}
