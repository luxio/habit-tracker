/**
 * Retention hook: twice-daily LOCAL reminders. Local notifications work in
 * Expo Go on iOS (remote/push would need a dev build — intentionally out of
 * scope). All calls are best-effort and no-op on web.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// How the OS presents a notification while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const MORNING = { hour: 9, minute: 0 };
const EVENING = { hour: 20, minute: 0 };

/** Ask for permission. Returns true if granted. */
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      status = req.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Cancel existing reminders and schedule the morning + evening daily nudges.
 * `habitCount` personalizes the morning copy.
 */
export async function scheduleDailyReminders(habitCount: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const habitWord = habitCount === 1 ? 'habit' : 'habits';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '☀️ Ready to start?',
        body:
          habitCount > 0
            ? `${habitCount} ${habitWord} waiting for you today.`
            : 'Add a habit and start your streak.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: MORNING.hour,
        minute: MORNING.minute,
      },
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌙 Don't break your streak",
        body: 'Log today before the day ends.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: EVENING.hour,
        minute: EVENING.minute,
      },
    });
  } catch {
    // Best-effort.
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}

/** Request permission and schedule in one step. Returns whether it took effect. */
export async function enableReminders(habitCount: number): Promise<boolean> {
  const granted = await requestPermissions();
  if (!granted) return false;
  await scheduleDailyReminders(habitCount);
  return true;
}
