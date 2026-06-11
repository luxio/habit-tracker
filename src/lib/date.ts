/** Date helpers for habit tracking. All keys are local-time 'YYYY-MM-DD'. */

export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return dateKey();
}

/** Returns the last `n` days as date keys, oldest first, ending today. */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dateKey(d));
  }
  return out;
}

/** Parse a 'YYYY-MM-DD' key into a local-time Date (midnight). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The date key `n` days after the given key (n may be negative). */
export function addDaysKey(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Whole days from `key` until today (today => 0, yesterday => 1). */
export function daysSince(key: string): number {
  const start = keyToDate(key).getTime();
  const today = keyToDate(todayKey()).getTime();
  return Math.round((today - start) / 86_400_000);
}

/** Single-letter weekday label (S M T W T F S) for a date key. */
export function weekdayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
}

/**
 * Current streak: consecutive completed days counting back from today.
 * Today not yet done doesn't break the streak (we count from yesterday),
 * but a completed today extends it.
 */
export function currentStreak(history: Record<string, boolean>): number {
  let streak = 0;
  const now = new Date();
  // If today isn't done yet, start counting from yesterday so the streak holds.
  const startOffset = history[dateKey(now)] ? 0 : 1;
  for (let i = startOffset; ; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (history[dateKey(d)]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Longest run of consecutive completed days in the habit's history. */
export function longestStreak(history: Record<string, boolean>): number {
  const days = Object.keys(history)
    .filter((k) => history[k])
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (prev && (date.getTime() - prev.getTime()) / 86_400_000 === 1) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}
