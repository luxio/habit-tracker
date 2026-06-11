/**
 * Core-loop reward feedback: haptics + a chime, fired the moment a habit (or
 * challenge) is completed. Visual confetti is handled separately by the
 * CelebrationProvider so it can render into the React tree.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type CelebrationLevel = 'tick' | 'complete' | 'challenge';

let player: AudioPlayer | null = null;
let audioReady = false;

function ensurePlayer() {
  if (Platform.OS === 'web' || player) return;
  try {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player = createAudioPlayer(require('@/assets/sounds/chime.wav'));
    audioReady = true;
  } catch {
    audioReady = false;
  }
}

function playChime() {
  ensurePlayer();
  if (!audioReady || !player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Playback is best-effort; never let it break the interaction.
  }
}

function haptic(level: CelebrationLevel) {
  if (Platform.OS === 'web') return;
  try {
    if (level === 'tick') {
      Haptics.selectionAsync();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Simulators have no haptic engine — ignore.
  }
}

/**
 * Fire the audio + haptic reward for a completion event.
 * `tick`     — progress logged, not yet complete (light).
 * `complete` — a habit hit its target.
 * `challenge`— a challenge was finished (fanfare).
 */
export function celebrate(level: CelebrationLevel) {
  haptic(level);
  if (level !== 'tick') playChime();
}
