import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle: string;
  /** Label for the primary action button. */
  cta: string;
  /** Runs the auth call; return an error message string to display, or null. */
  onSubmit: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Optional note shown after a successful submit (e.g. "check your email"). */
  successNote?: string;
  footerText: string;
  footerLinkLabel: string;
  footerHref: Href;
};

export function AuthForm({
  title,
  subtitle,
  cta,
  onSubmit,
  successNote,
  footerText,
  footerLinkLabel,
  footerHref,
}: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const { error } = await onSubmit(email, password);
    setBusy(false);
    if (error) setError(error);
    else if (successNote) setNote(successNote);
  }

  return (
    <View style={styles.form}>
      <View style={styles.header}>
        <ThemedText style={styles.bigEmoji}>🌱</ThemedText>
        <ThemedText type="subtitle" style={styles.center}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {subtitle}
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.field}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          style={[styles.input, { color: theme.text }]}
        />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.field}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          secureTextEntry
          style={[styles.input, { color: theme.text }]}
          onSubmitEditing={submit}
        />
      </ThemedView>

      {error && (
        <ThemedText type="small" style={[styles.message, { color: '#ff3b30' }]}>
          {error}
        </ThemedText>
      )}
      {note && (
        <ThemedText type="small" themeColor="success" style={styles.message}>
          {note}
        </ThemedText>
      )}

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.primary, opacity: !canSubmit ? 0.4 : pressed ? 0.8 : 1 },
        ]}>
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText style={styles.primaryLabel}>{cta}</ThemedText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <ThemedText themeColor="textSecondary" type="small">
          {footerText}{' '}
        </ThemedText>
        <Link href={footerHref} replace>
          <ThemedText type="link" style={styles.footerLink}>
            {footerLinkLabel}
          </ThemedText>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three, alignItems: 'stretch' },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  bigEmoji: { fontSize: 56, textAlign: 'center' },
  center: { textAlign: 'center' },
  field: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  input: { fontSize: 18, paddingVertical: Spacing.three },
  message: { textAlign: 'center' },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.two,
  },
  primaryLabel: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerLink: { fontWeight: '600' },
});
