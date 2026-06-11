import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enableReminders } from '@/lib/notifications';
import {
  HABIT_COLORS,
  SUGGESTED_EMOJI,
  useHabits,
  type HabitType,
} from '@/lib/habits-store';

type Step = 'welcome' | 'create' | 'reminders' | 'challenge';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { habits, addHabit, startChallenge, setRemindersEnabled, completeOnboarding } = useHabits();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(SUGGESTED_EMOJI[0]);
  const [type, setType] = useState<HabitType>('binary');
  const [target, setTarget] = useState(3);
  const [busy, setBusy] = useState(false);

  function createHabit() {
    addHabit(name, { type, target, emoji, color: HABIT_COLORS[habits.length % HABIT_COLORS.length] });
    setStep('reminders');
  }

  async function enable() {
    setBusy(true);
    try {
      const ok = await enableReminders(habits.length + 1);
      setRemindersEnabled(ok);
    } finally {
      setBusy(false);
      setStep('challenge');
    }
  }

  function finish(withChallenge: boolean) {
    if (withChallenge) startChallenge(3);
    completeOnboarding();
    router.replace('/');
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'welcome' && (
            <View style={styles.stepWrap}>
              <ThemedText style={styles.bigEmoji}>🌱</ThemedText>
              <ThemedText type="subtitle" style={styles.center}>
                Build habits that stick
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                Track daily habits, keep your streak alive, and earn rewards for showing up.
              </ThemedText>
              <PrimaryButton label="Get started" onPress={() => setStep('create')} />
            </View>
          )}

          {step === 'create' && (
            <View style={styles.stepWrap}>
              <ThemedText type="subtitle" style={styles.center}>
                Your first habit
              </ThemedText>

              <ThemedView type="backgroundElement" style={styles.field}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Drink water"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  style={[styles.input, { color: theme.text }]}
                />
              </ThemedView>

              {/* Emoji picker */}
              <View style={styles.emojiRow}>
                {SUGGESTED_EMOJI.map((e) => (
                  <Pressable key={e} onPress={() => setEmoji(e)}>
                    <View
                      style={[
                        styles.emojiOption,
                        {
                          backgroundColor:
                            e === emoji ? theme.primary + '33' : theme.backgroundElement,
                          borderColor: e === emoji ? theme.primary : 'transparent',
                        },
                      ]}>
                      <ThemedText style={styles.emojiText}>{e}</ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* Type toggle */}
              <View style={styles.typeRow}>
                <TypeChip
                  active={type === 'binary'}
                  label="Once a day"
                  onPress={() => setType('binary')}
                />
                <TypeChip
                  active={type === 'volume'}
                  label="Several times"
                  onPress={() => setType('volume')}
                />
              </View>

              {type === 'volume' && (
                <View style={styles.stepperRow}>
                  <ThemedText themeColor="textSecondary">Times per day</ThemedText>
                  <View style={styles.stepper}>
                    <StepperButton label="−" onPress={() => setTarget((t) => Math.max(2, t - 1))} />
                    <ThemedText style={styles.stepperValue}>{target}</ThemedText>
                    <StepperButton label="+" onPress={() => setTarget((t) => Math.min(20, t + 1))} />
                  </View>
                </View>
              )}

              <PrimaryButton label="Create habit" disabled={!name.trim()} onPress={createHabit} />
            </View>
          )}

          {step === 'reminders' && (
            <View style={styles.stepWrap}>
              <ThemedText style={styles.bigEmoji}>🔔</ThemedText>
              <ThemedText type="subtitle" style={styles.center}>
                Stay on track
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                We&apos;ll nudge you each morning and evening so you never miss a day.
              </ThemedText>
              <PrimaryButton
                label={busy ? 'Enabling…' : 'Enable reminders'}
                disabled={busy}
                onPress={enable}
              />
              <Pressable onPress={() => setStep('challenge')} hitSlop={8}>
                <ThemedText themeColor="textSecondary" type="small" style={styles.skip}>
                  Maybe later
                </ThemedText>
              </Pressable>
            </View>
          )}

          {step === 'challenge' && (
            <View style={styles.stepWrap}>
              <ThemedText style={styles.bigEmoji}>🔥</ThemedText>
              <ThemedText type="subtitle" style={styles.center}>
                3-Day Starter Challenge
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                Complete all your habits for 3 days in a row and earn your first trophy.
              </ThemedText>
              <PrimaryButton label="Start the challenge" onPress={() => finish(true)} />
              <Pressable onPress={() => finish(false)} hitSlop={8}>
                <ThemedText themeColor="textSecondary" type="small" style={styles.skip}>
                  Skip for now
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: theme.primary, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}>
      <ThemedText style={styles.primaryLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function TypeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.typeChipWrap}>
      <View
        style={[
          styles.typeChip,
          {
            backgroundColor: active ? theme.primary + '22' : theme.backgroundElement,
            borderColor: active ? theme.primary : 'transparent',
          },
        ]}>
        <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  stepWrap: { gap: Spacing.three, alignItems: 'stretch' },
  bigEmoji: { fontSize: 64, textAlign: 'center' },
  center: { textAlign: 'center' },
  field: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  input: { fontSize: 18, paddingVertical: Spacing.three },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 24 },
  typeRow: { flexDirection: 'row', gap: Spacing.two },
  typeChipWrap: { flex: 1 },
  typeChip: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonLabel: { fontSize: 22, fontWeight: '600' },
  stepperValue: { fontSize: 20, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryLabel: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  skip: { textAlign: 'center', paddingVertical: Spacing.two },
});
