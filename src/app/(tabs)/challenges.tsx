import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCelebration } from '@/components/celebration';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { celebrate } from '@/lib/feedback';
import { evaluateChallenge, useHabits } from '@/lib/habits-store';

export default function ChallengesScreen() {
  const { activeChallenge, habits, startChallenge, claimChallengeReward, clearChallenge } =
    useHabits();
  const { fire } = useCelebration();
  const theme = useTheme();

  const evald = activeChallenge ? evaluateChallenge(activeChallenge, habits) : null;

  function handleClaim() {
    celebrate('challenge');
    fire();
    claimChallengeReward();
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText themeColor="textSecondary" type="smallBold" style={styles.uppercase}>
              Retention hook
            </ThemedText>
            <ThemedText type="subtitle">Challenges</ThemedText>
          </View>

          {activeChallenge && evald ? (
            <>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText style={styles.challengeTitle}>{activeChallenge.title}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  Complete every habit each day to win.
                </ThemedText>

                {/* Segmented day progress */}
                <View style={styles.segments}>
                  {Array.from({ length: activeChallenge.lengthDays }).map((_, i) => {
                    const filled = i < evald.progress;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.segment,
                          {
                            backgroundColor: filled ? theme.success : theme.backgroundSelected,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <ThemedText themeColor="textSecondary" type="small">
                  {evald.progress} / {activeChallenge.lengthDays} days
                </ThemedText>
              </ThemedView>

              {evald.status === 'completed' && !activeChallenge.rewardClaimed && (
                <Pressable onPress={handleClaim} style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.rewardCta, { backgroundColor: theme.success }]}>
                    <ThemedText style={styles.rewardText}>🎉 Claim your reward</ThemedText>
                  </View>
                </Pressable>
              )}

              {evald.status === 'completed' && activeChallenge.rewardClaimed && (
                <ThemedView type="backgroundElement" style={styles.badge}>
                  <ThemedText style={styles.badgeEmoji}>🏆</ThemedText>
                  <ThemedText style={styles.challengeTitle}>Challenge complete!</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
                    You showed up every day. Ready for the next one?
                  </ThemedText>
                  <StartButtons onStart={startChallenge} replace />
                </ThemedView>
              )}

              {evald.status === 'failed' && (
                <ThemedView type="backgroundElement" style={styles.badge}>
                  <ThemedText style={styles.badgeEmoji}>💪</ThemedText>
                  <ThemedText style={styles.challengeTitle}>Streak broken</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
                    Missed a day — no worries. Start fresh.
                  </ThemedText>
                  <StartButtons onStart={startChallenge} replace />
                </ThemedView>
              )}

              {evald.status === 'active' && (
                <Pressable onPress={clearChallenge} hitSlop={8} style={styles.cancelLink}>
                  <ThemedText themeColor="textSecondary" type="small">
                    Cancel challenge
                  </ThemedText>
                </Pressable>
              )}
            </>
          ) : (
            <ThemedView type="backgroundElement" style={styles.badge}>
              <ThemedText style={styles.badgeEmoji}>🔥</ThemedText>
              <ThemedText style={styles.challengeTitle}>Start a challenge</ThemedText>
              <ThemedText themeColor="textSecondary" type="small" style={styles.center}>
                Commit to completing all your habits for a set number of days.
              </ThemedText>
              <StartButtons onStart={startChallenge} />
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StartButtons({
  onStart,
  replace,
}: {
  onStart: (days: number) => void;
  replace?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.startRow}>
      {[3, 7, 21].map((days) => (
        <Pressable
          key={days}
          onPress={() => onStart(days)}
          style={({ pressed }) => [
            styles.startButton,
            { borderColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {days} days
          </ThemedText>
        </Pressable>
      ))}
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
  header: { gap: Spacing.half },
  uppercase: { textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three },
  challengeTitle: { fontSize: 20, fontWeight: '700' },
  segments: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.one },
  segment: { flex: 1, height: 10, borderRadius: 5 },
  rewardCta: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  rewardText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  badge: { borderRadius: Spacing.three, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  badgeEmoji: { fontSize: 48 },
  center: { textAlign: 'center' },
  startRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  startButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
});
