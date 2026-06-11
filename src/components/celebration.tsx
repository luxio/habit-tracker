/**
 * Visual half of the core-loop reward. `useCelebration().fire()` triggers a
 * one-shot confetti burst rendered as a root overlay above the tabs. Built on
 * the project's existing react-native-reanimated (no SVG / no new dep).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const PIECE_COLORS = ['#3c87f7', '#34c759', '#ff9500', '#ff2d55', '#af52de', '#5ac8fa', '#ffd60a'];
const PIECE_COUNT = 20;

type CelebrationContextValue = { fire: () => void };
const CelebrationContext = createContext<CelebrationContextValue | null>(null);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [burst, setBurst] = useState(0);
  const fire = useCallback(() => setBurst((b) => b + 1), []);
  const value = useMemo(() => ({ fire }), [fire]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {/* Remounting on each burst (via key) restarts every piece's animation. */}
      {burst > 0 && <ConfettiBurst key={burst} />}
    </CelebrationContext.Provider>
  );
}

export function useCelebration(): CelebrationContextValue {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within a CelebrationProvider');
  return ctx;
}

function ConfettiBurst() {
  const { width, height } = useWindowDimensions();
  // Burst originates from the upper-middle of the screen.
  const origin = { x: width / 2, y: height * 0.32 };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PIECE_COUNT }).map((_, i) => (
        <Piece key={i} index={i} origin={origin} />
      ))}
    </View>
  );
}

function Piece({ index, origin }: { index: number; origin: { x: number; y: number } }) {
  const progress = useSharedValue(0);

  // Deterministic-ish spread so pieces fan out in all directions.
  const angle = (index / PIECE_COUNT) * Math.PI * 2 + (index % 3) * 0.35;
  const distance = 130 + (index % 5) * 34;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const spin = (index % 2 === 0 ? 1 : -1) * (360 + (index % 4) * 180);
  const color = PIECE_COLORS[index % PIECE_COLORS.length];
  const size = 8 + (index % 3) * 3;
  const duration = 850 + (index % 5) * 90;

  progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: interpolate(p, [0, 1], [0, dx]) },
        // Add gravity so pieces arc downward as they fly out.
        { translateY: interpolate(p, [0, 1], [0, dy]) + p * p * 220 },
        { rotate: `${interpolate(p, [0, 1], [0, spin])}deg` },
        { scale: interpolate(p, [0, 0.15, 1], [0.2, 1, 0.9]) },
      ],
      opacity: interpolate(p, [0, 0.1, 0.75, 1], [0, 1, 1, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: origin.x - size / 2,
          top: origin.y - size / 2,
          width: size,
          height: size * 1.6,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
});
