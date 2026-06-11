# Habit Tracker

A small, polished habit-tracking app built with [Expo](https://expo.dev) (SDK 56, React Native 0.85, React 19) and Expo Router. Track daily habits, build streaks, take on consistency challenges, and get a little reward feedback every time you check one off.

> Demo project for *How to Build Mobile Apps with Claude Code*.

## Features

- **Today** — toggle habit completion, add/delete habits, see a daily progress ring. Habits can have a per-day target (e.g. drink water 8×).
- **Progress** — last-7-days grid plus current/longest streak and completion-rate stats.
- **Challenges** — start a multi-day "all habits complete" challenge and claim a reward when you finish it.
- **Habit detail** — per-habit history, streaks, and target editing (`/habit/[id]`).
- **Onboarding** — first-run intro flow.
- **Reward feedback** — haptics + a chime + confetti the moment a habit or challenge is completed.
- **Local reminders** — twice-daily local notifications (works in Expo Go on iOS).
- **Light/dark theming** and a **web** build via React Native Web.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npm start          # Metro dev server (i=iOS, a=Android, w=web, r=reload)
   npm run ios        # start + open iOS simulator
   npm run web        # start + open in the browser
   ```

AsyncStorage is bundled into Expo Go, so the app runs there without a custom dev build.

> **Platform note:** the iOS simulator works out of the box (Xcode required). Android is not configured locally (needs JDK 17+ / Android Studio) — use Expo Go or EAS for Android.

## Scripts

```bash
npm start              # Metro dev server
npm run ios            # open iOS simulator
npm run web            # open web build
npx tsc --noEmit       # type-check — the primary correctness gate (no test suite)
npm run lint           # ESLint (expo lint)
npx expo-doctor        # validate project/native config
```

## Project structure

Source lives in **`src/`**. Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

```
src/
  app/                     # Expo Router routes (route root is src/app)
    _layout.tsx            # ThemeProvider → HabitsProvider → tabs
    (tabs)/
      index.tsx            # Today
      explore.tsx          # Progress
      challenges.tsx       # Challenges
    habit/[id].tsx         # Habit detail
    onboarding.tsx         # First-run intro
  components/              # ThemedText / ThemedView, app tabs, celebration, ui/…
  constants/theme.ts       # Colors, Spacing, Fonts, layout constants
  hooks/                   # useTheme, color scheme
  lib/
    habits-store.tsx       # HabitsProvider + useHabits() — single source of truth
    habit.ts               # pure helpers (counts, completion, consistency)
    date.ts                # local-time date keys + streak/grid helpers
    feedback.ts            # haptics + chime reward feedback
    notifications.ts       # twice-daily local reminders
```

### How it fits together

- **State:** `HabitsProvider` (`src/lib/habits-store.tsx`) is the single source of truth. It persists the whole habit array to AsyncStorage (key `habits.v1`) on every change and seeds default habits on first load. A `Habit.history` is a `Record<'YYYY-MM-DD', number>` of per-day completion counts; a day is complete once the count reaches the habit's `target`.
- **Navigation:** the app uses `NativeTabs` (`expo-router/unstable-native-tabs`) wired up in `src/components/app-tabs.tsx`, not Expo Router's `<Tabs>`. To add a screen, add the route file under `src/app/` and a `NativeTabs.Trigger` in `app-tabs.tsx`.
- **Styling:** go through theme primitives — `ThemedText` / `ThemedView` and the `Colors`/`Spacing` scales in `src/constants/theme.ts` — rather than raw `Text`/`View`.
- **Web vs native:** some components ship a `*.web.tsx` variant (e.g. `app-tabs`, `animated-icon`); Metro picks the platform variant automatically.

## Notes

There is no test framework configured — `npx tsc --noEmit` (TypeScript strict) is the primary correctness gate. Expo SDK 56 changed many APIs; check the [versioned docs](https://docs.expo.dev/versions/v56.0.0/) before adding native features.
