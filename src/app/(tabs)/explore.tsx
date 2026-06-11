import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { currentStreak, lastNDays, longestStreak, weekdayLabel } from '@/lib/date';
import { completionMap, consistency, dayCompletionRatio, isComplete } from '@/lib/habit';
import { useHabits, type Habit } from '@/lib/habits-store';
import { cancelReminders, enableReminders } from '@/lib/notifications';

export default function ProgressScreen() {
  const { habits } = useHabits();

  const totalCompletions = habits.reduce(
    (sum, h) => sum + Object.keys(h.history).filter((k) => isComplete(h, k)).length,
    0
  );
  const bestStreak = habits.reduce((max, h) => Math.max(max, longestStreak(completionMap(h))), 0);
  const consistency30 = consistency(habits, 30);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText themeColor="textSecondary" type="smallBold" style={styles.uppercase}>
              Accountability
            </ThemedText>
            <ThemedText type="subtitle">Progress</ThemedText>
          </View>

          {/* Summary stats */}
          <View style={styles.statsRow}>
            <Stat label="Done all-time" value={`${totalCompletions}`} />
            <Stat label="Longest streak" value={`${bestStreak}`} accent="🔥" />
            <Stat label="30-day consistency" value={`${consistency30}%`} />
          </View>

          {/* 30-day consistency chart */}
          {habits.length > 0 && <ConsistencyChart habits={habits} />}

          {/* Per-habit week grid */}
          <View style={styles.list}>
            {habits.map((habit) => (
              <WeekRow key={habit.id} habit={habit} />
            ))}
            {habits.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Add habits on the Today tab to see your progress here.
              </ThemedText>
            )}
          </View>

          <ReminderToggle habitCount={habits.length} />
          <AccountRow />
          <ResetButton />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText style={styles.statValue}>
        {accent ? `${accent} ` : ''}
        {value}
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small" style={styles.statLabel}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

/** Daily completion-rate bars over the last 30 days (no SVG). */
function ConsistencyChart({ habits }: { habits: Habit[] }) {
  const theme = useTheme();
  const days = lastNDays(30);
  return (
    <ThemedView type="backgroundElement" style={styles.chartCard}>
      <ThemedText themeColor="textSecondary" type="smallBold" style={styles.uppercase}>
        Last 30 days
      </ThemedText>
      <View style={styles.bars}>
        {days.map((key) => {
          const ratio = dayCompletionRatio(habits, key);
          return (
            <View key={key} style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${Math.max(4, ratio * 100)}%`,
                    backgroundColor: ratio === 1 ? theme.success : theme.primary,
                    opacity: ratio === 0 ? 0.18 : 1,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

function WeekRow({ habit }: { habit: Habit }) {
  const theme = useTheme();
  const days = lastNDays(7);
  const streak = currentStreak(completionMap(habit));

  return (
    <ThemedView type="backgroundElement" style={styles.weekCard}>
      <View style={styles.weekHeader}>
        <ThemedText style={styles.weekEmoji}>{habit.emoji}</ThemedText>
        <ThemedText style={styles.weekTitle}>{habit.name}</ThemedText>
        {streak > 0 && (
          <ThemedText themeColor="textSecondary" type="small" style={styles.weekStreak}>
            🔥 {streak}
          </ThemedText>
        )}
      </View>
      <View style={styles.dots}>
        {days.map((key) => {
          const done = isComplete(habit, key);
          return (
            <View key={key} style={styles.dayCol}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: done ? habit.color : theme.backgroundSelected },
                ]}
              />
              <ThemedText themeColor="textSecondary" style={styles.dayLabel}>
                {weekdayLabel(key)}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

function ReminderToggle({ habitCount }: { habitCount: number }) {
  const { remindersEnabled, setRemindersEnabled } = useHabits();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  async function onToggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const ok = await enableReminders(habitCount);
        setRemindersEnabled(ok);
      } else {
        await cancelReminders();
        setRemindersEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.reminderRow}>
      <View style={styles.reminderText}>
        <ThemedText style={styles.cardTitle}>Daily reminders</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          A nudge at 9am & 8pm to keep your streak alive.
        </ThemedText>
      </View>
      <Switch
        value={remindersEnabled}
        onValueChange={onToggle}
        disabled={busy}
        trackColor={{ true: theme.primary }}
      />
    </ThemedView>
  );
}

function AccountRow() {
  const { user, signOut } = useAuth();
  return (
    <ThemedView type="backgroundElement" style={styles.reminderRow}>
      <View style={styles.reminderText}>
        <ThemedText style={styles.cardTitle}>Account</ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
          {user?.email ?? 'Signed in'}
        </ThemedText>
      </View>
      <Pressable onPress={signOut} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <ThemedText type="link" style={styles.signOut}>
          Sign out
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function ResetButton() {
  const { resetAll } = useHabits();

  function confirmReset() {
    const message = 'This permanently clears your habits, streaks, and challenge.';
    if (Platform.OS === 'web') {
      // RN Web's Alert has no buttons; fall back to the browser confirm.
      if (typeof window !== 'undefined' && window.confirm(`Reset all data?\n\n${message}`)) {
        resetAll();
      }
      return;
    }
    Alert.alert('Reset all data?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetAll },
    ]);
  }

  return (
    <Pressable onPress={confirmReset} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <ThemedText style={styles.reset}>Reset all data</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  scroll: { flex: 1, alignSelf: 'stretch' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.half },
  uppercase: { textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { textAlign: 'center' },
  chartCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 },
  barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2, minHeight: 3 },
  list: { gap: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  weekCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  weekEmoji: { fontSize: 18 },
  weekTitle: { fontSize: 16, fontWeight: '600' },
  weekStreak: { marginLeft: 'auto' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: Spacing.one },
  dot: { width: 26, height: 26, borderRadius: 13 },
  dayLabel: { fontSize: 11 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  reminderText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  signOut: { fontWeight: '600' },
  reset: {
    textAlign: 'center',
    color: '#ff3b30',
    fontWeight: '600',
    paddingVertical: Spacing.three,
  },
});
