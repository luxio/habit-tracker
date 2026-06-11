import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentStreak, keyToDate, lastNDays, longestStreak } from '@/lib/date';
import { completionMap, countForDay, isComplete } from '@/lib/habit';
import { useHabits } from '@/lib/habits-store';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { habits, deleteHabit, setHabitTarget } = useHabits();
  const habit = habits.find((h) => h.id === id);

  if (!habit) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BackButton />
          <ThemedText themeColor="textSecondary" style={styles.missing}>
            This habit no longer exists.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const completed = completionMap(habit);
  const current = currentStreak(completed);
  const longest = longestStreak(completed);
  const totalDone = Object.keys(habit.history).filter((k) => isComplete(habit, k)).length;
  const days = lastNDays(30);

  function handleDelete() {
    deleteHabit(habit!.id);
    router.back();
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BackButton />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.emojiWrap, { backgroundColor: habit.color + '22' }]}>
              <ThemedText style={styles.emoji}>{habit.emoji}</ThemedText>
            </View>
            <View style={styles.headerText}>
              <ThemedText type="subtitle">{habit.name}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {habit.type === 'volume' ? `${habit.target}× per day` : 'Once a day'}
              </ThemedText>
            </View>
          </View>

          {/* Streak stats */}
          <View style={styles.statsRow}>
            <Stat label="Current streak" value={`${current}`} accent="🔥" />
            <Stat label="Longest streak" value={`${longest}`} />
            <Stat label="Days completed" value={`${totalDone}`} />
          </View>

          {/* Edit target for volume habits */}
          {habit.type === 'volume' && (
            <ThemedView type="backgroundElement" style={styles.editRow}>
              <ThemedText style={styles.sectionTitle}>Daily target</ThemedText>
              <View style={styles.stepper}>
                <StepperButton
                  label="−"
                  onPress={() => setHabitTarget(habit.id, habit.target - 1)}
                />
                <ThemedText style={styles.stepperValue}>{habit.target}</ThemedText>
                <StepperButton
                  label="+"
                  onPress={() => setHabitTarget(habit.id, habit.target + 1)}
                />
              </View>
            </ThemedView>
          )}

          {/* 30-day log grid */}
          <ThemedView type="backgroundElement" style={styles.logCard}>
            <ThemedText style={styles.sectionTitle}>Last 30 days</ThemedText>
            <View style={styles.grid}>
              {days.map((key) => {
                const done = isComplete(habit, key);
                const partial = !done && countForDay(habit, key) > 0;
                return (
                  <View
                    key={key}
                    style={[
                      styles.gridCell,
                      {
                        backgroundColor: done
                          ? habit.color
                          : partial
                            ? habit.color + '55'
                            : theme.backgroundSelected,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </ThemedView>

          {/* Recent log entries */}
          <View style={styles.logList}>
            <ThemedText style={styles.sectionTitle}>History</ThemedText>
            {recentEntries(habit).length === 0 ? (
              <ThemedText themeColor="textSecondary" type="small">
                No completions logged yet.
              </ThemedText>
            ) : (
              recentEntries(habit).map(({ key, count }) => (
                <View key={key} style={styles.logItem}>
                  <ThemedText type="small">
                    {keyToDate(key).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {habit.type === 'volume' ? `${count}/${habit.target}` : '✓ done'}
                  </ThemedText>
                </View>
              ))
            )}
          </View>

          <Pressable onPress={handleDelete} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText style={[styles.delete, { color: '#ff3b30' }]}>Delete habit</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function recentEntries(habit: { history: Record<string, number> }) {
  return Object.keys(habit.history)
    .filter((k) => habit.history[k] > 0)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 14)
    .map((key) => ({ key, count: habit.history[key] }));
}

function BackButton() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
      <ThemedText type="linkPrimary">‹ Back</ThemedText>
    </Pressable>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText style={styles.statValue}>
        {accent ? `${accent} ` : ''}
        {value}
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.stepperButton, { borderColor: theme.border }]}>
        <ThemedText style={styles.stepperButtonLabel}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  back: { paddingVertical: Spacing.one, alignSelf: 'flex-start' },
  missing: { textAlign: 'center', padding: Spacing.four },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emojiWrap: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  headerText: { flex: 1, gap: 2 },
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
  center: { textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonLabel: { fontSize: 20, fontWeight: '600' },
  stepperValue: { fontSize: 18, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  logCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridCell: { width: 22, height: 22, borderRadius: 5 },
  logList: { gap: Spacing.two },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.half },
  delete: { textAlign: 'center', fontWeight: '600', paddingVertical: Spacing.three },
  pressed: { opacity: 0.6 },
});
