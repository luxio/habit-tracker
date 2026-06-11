import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CelebrationProvider } from '@/components/celebration';
import { HabitsProvider } from '@/lib/habits-store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HabitsProvider>
        <CelebrationProvider>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="habit/[id]" options={{ presentation: 'card' }} />
          </Stack>
        </CelebrationProvider>
      </HabitsProvider>
    </ThemeProvider>
  );
}
