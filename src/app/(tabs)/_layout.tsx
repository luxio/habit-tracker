import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useHabits } from '@/lib/habits-store';

export default function TabsLayout() {
  const { loading, onboardingDone } = useHabits();

  // Wait for persisted state before deciding; the splash overlay covers this.
  if (loading) return null;
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return <AppTabs />;
}
