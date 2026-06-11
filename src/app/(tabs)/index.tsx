import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCelebration } from '@/components/celebration';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentStreak } from '@/lib/date';
import { celebrate } from '@/lib/feedback';
import { completionMap, isComplete, progressForDay } from '@/lib/habit';
import { evaluateChallenge, useHabits, type Habit } from '@/lib/habits-store';

export default function TodayScreen() {
  const theme = useTheme();
  const { habits, logHabit, unlogHabit, addHabit, activeChallenge } = useHabits();
  const { fire } = useCelebration();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const doneCount = habits.filter((h) => isComplete(h)).length;
  const total = habits.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function handleLog(habit: Habit) {
    const { justCompleted } = logHabit(habit.id);
    if (justCompleted) {
      celebrate('complete');
      fire();
    } else {
      celebrate('tick');
    }
  }

  function commitAdd() {
    if (draft.trim()) addHabit(draft);
    setDraft('');
    setAdding(false);
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText themeColor="textSecondary" type="smallBold" style={styles.uppercase}>
                {today}
              </ThemedText>
              <ThemedText type="subtitle">Today</ThemedText>
            </View>
            <ProgressRing pct={pct} label={`${doneCount}/${total}`} />
          </View>

          {activeChallenge && <ChallengeBanner />}

          {/* Habit list */}
          <View style={styles.list}>
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onLog={() => handleLog(habit)}
                onUndo={() => unlogHabit(habit.id)}
              />
            ))}

            {habits.length === 0 && !adding && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No habits yet. Add your first one below. 🌱
              </ThemedText>
            )}

            {/* Inline add composer */}
            {adding ? (
              <ThemedView type="backgroundElement" style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="New habit, e.g. Meditate"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={commitAdd}
                  style={[styles.input, { color: theme.text }]}
                />
                <Pressable onPress={commitAdd} hitSlop={8}>
                  <ThemedText type="linkPrimary" style={styles.addAction}>
                    Add
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <Pressable
                onPress={() => setAdding(true)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={styles.addButtonInner}>
                  <ThemedText themeColor="textSecondary" style={styles.addPlus}>
                    ＋
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" type="smallBold">
                    New habit
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChallengeBanner() {
  const { activeChallenge, habits } = useHabits();
  const theme = useTheme();
  if (!activeChallenge) return null;
  const { progress, status } = evaluateChallenge(activeChallenge, habits);
  const label =
    status === 'completed'
      ? 'Challenge complete — claim your reward!'
      : status === 'failed'
        ? 'Streak broken — start a new challenge'
        : `Day ${Math.min(progress + 1, activeChallenge.lengthDays)} of ${activeChallenge.lengthDays}`;

  return (
    <Link href="/challenges" asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={[styles.banner, { borderColor: theme.primary }]}>
          <ThemedText style={styles.bannerEmoji}>🔥</ThemedText>
          <View style={styles.bannerBody}>
            <ThemedText type="smallBold">{activeChallenge.title}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {label}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.chevron}>
            ›
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

function HabitCard({ habit, onLog, onUndo }: { habit: Habit; onLog: () => void; onUndo: () => void }) {
  const streak = currentStreak(completionMap(habit));
  const done = isComplete(habit);

  return (
    <Pressable
      onPress={() => router.push(`/habit/${habit.id}`)}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={[styles.emojiWrap, { backgroundColor: habit.color + '22' }]}>
          <ThemedText style={styles.emoji}>{habit.emoji}</ThemedText>
        </View>

        <View style={styles.cardBody}>
          <ThemedText style={styles.cardTitle}>{habit.name}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {streak > 0 ? `🔥 ${streak} day${streak === 1 ? '' : 's'} streak` : 'Start your streak'}
          </ThemedText>
        </View>

        <HabitControl habit={habit} done={done} onLog={onLog} onUndo={onUndo} />
      </ThemedView>
    </Pressable>
  );
}

/** Right-hand control: a check for binary habits, a counter for volume. */
function HabitControl({
  habit,
  done,
  onLog,
  onUndo,
}: {
  habit: Habit;
  done: boolean;
  onLog: () => void;
  onUndo: () => void;
}) {
  const { count, target } = progressForDay(habit);

  if (habit.type === 'volume') {
    return (
      <View style={styles.volumeWrap}>
        <Pressable onPress={onUndo} hitSlop={6} disabled={count === 0}>
          <ThemedText
            themeColor="textSecondary"
            style={[styles.count, count === 0 && styles.countMuted]}>
            {count}/{target}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onLog} hitSlop={8}>
          <View
            style={[
              styles.check,
              { borderColor: habit.color },
              done && { backgroundColor: habit.color },
            ]}>
            <ThemedText style={done ? styles.checkMark : styles.plus}>{done ? '✓' : '＋'}</ThemedText>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={done ? onUndo : onLog} hitSlop={8}>
      <View
        style={[
          styles.check,
          { borderColor: habit.color },
          done && { backgroundColor: habit.color },
        ]}>
        {done && <ThemedText style={styles.checkMark}>✓</ThemedText>}
      </View>
    </Pressable>
  );
}

/** Lightweight progress indicator (no SVG dependency). */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const theme = useTheme();
  const complete = pct === 100;
  return (
    <View style={[styles.ring, { borderColor: complete ? theme.success : theme.backgroundSelected }]}>
      <ThemedText type="smallBold" style={complete ? { color: theme.success } : undefined}>
        {label}
      </ThemedText>
    </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: Spacing.half },
  uppercase: { textTransform: 'uppercase', letterSpacing: 0.5 },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  bannerEmoji: { fontSize: 22 },
  bannerBody: { flex: 1, gap: 2 },
  chevron: { fontSize: 24 },
  list: { gap: Spacing.two },
  empty: { textAlign: 'center', paddingVertical: Spacing.four },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  volumeWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  count: { fontSize: 15, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  countMuted: { opacity: 0.5 },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontSize: 18, fontWeight: '600', lineHeight: Platform.OS === 'ios' ? 22 : 20 },
  checkMark: { color: '#ffffff', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  addButton: { marginTop: Spacing.one },
  pressed: { opacity: 0.6 },
  addButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8884',
  },
  addPlus: { fontSize: 18, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    marginTop: Spacing.one,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  addAction: { paddingHorizontal: Spacing.one },
});
