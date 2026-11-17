import type { LocalDate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar date of `d` in the device timezone. */
export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC, which would shift the day west of UTC). */
export function fromLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(s: LocalDate, days: number): LocalDate {
  const d = fromLocalDate(s);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** The `n` local dates ending at `end` (inclusive), oldest first. */
export function lastNDays(end: LocalDate, n: number): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

/** "Monday, 16 Nov" (Design H1/H2 header). */
export function formatHeaderDate(s: LocalDate): string {
  const d = fromLocalDate(s);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Monday 16 November" — screen-reader label for day pickers. */
export function formatLongDate(s: LocalDate): string {
  const d = fromLocalDate(s);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function weekdayShort(s: LocalDate): string {
  return WEEKDAYS_SHORT[fromLocalDate(s).getDay()]!;
}

export function dayOfMonth(s: LocalDate): number {
  return fromLocalDate(s).getDate();
}

/**
 * "12:41" from an ISO-8601 timestamp with offset. Uses the wall-clock time written in
 * the timestamp (the meal's own local time), so a meal logged while travelling keeps
 * the time the user saw when they ate it.
 */
export function formatMealTime(isoWithOffset: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(isoWithOffset);
  return m ? `${m[1]}:${m[2]}` : '';
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}
