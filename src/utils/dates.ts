const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const pad2 = (n: number): string => (n < 10 ? '0' : '') + n;

/** Firestore Timestamp | Date | null -> Date | undefined */
export function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const maybe = v as { toDate?: unknown };
  if (typeof maybe.toDate === 'function') return (maybe.toDate as () => Date).call(v);
  return undefined;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function combineDateTime(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function isValidDateKey(k: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  return toDateKey(parseDateKey(k)) === k;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/** The week id is the date of that week's Monday. */
export function weekIdFor(dateOrKey: Date | string): string {
  const d = typeof dateOrKey === 'string' ? parseDateKey(dateOrKey) : dateOrKey;
  return toDateKey(startOfWeek(d));
}

export function shiftWeek(weekId: string, delta: number): string {
  return toDateKey(addDays(parseDateKey(weekId), delta * 7));
}

export function weekBounds(weekId: string): { start: Date; end: Date } {
  const start = parseDateKey(weekId);
  return { start, end: addDays(start, 6) };
}

/** Date (YYYY-MM-DD) of the given weekday (0=Sunday) inside a Monday-based week. */
export function dateInWeek(weekId: string, jsDay: number): string {
  return toDateKey(addDays(parseDateKey(weekId), (jsDay + 6) % 7));
}

export function formatWeekRange(weekId: string): string {
  const { start, end } = weekBounds(weekId);
  const sm = MONTHS[start.getMonth()];
  const em = MONTHS[end.getMonth()];
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${sm.slice(0, 3)} ${start.getFullYear()} – ${end.getDate()} ${em.slice(0, 3)} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${sm.slice(0, 3)} – ${end.getDate()} ${em.slice(0, 3)} ${end.getFullYear()}`;
  }
  return `${start.getDate()}–${end.getDate()} ${em} ${end.getFullYear()}`;
}

export function formatDayLong(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDayShort(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "Wed 6 Jan 2027" for another year, "Wed 6 Jan" for this year, so far-away dates are clear. */
export function formatDayWithYear(dateKey: string, now: Date): string {
  const d = parseDateKey(dateKey);
  const base = formatDayShort(dateKey);
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function weekdayName(dateKey: string): string {
  return DAYS[parseDateKey(dateKey).getDay()];
}

/** '19:00' -> '7:00 PM' */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m)} ${suffix}`;
}

export function formatTimeRange(start: string, end?: string): string {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** Whole calendar days from `from` to `to` (local), negative if `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

// ------------------------------------------------------------------ months (for reports)

/** YYYY-MM for the month containing this date. */
export function monthKeyFor(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function isValidMonthKey(k: string): boolean {
  return /^\d{4}-\d{2}$/.test(k) && parseMonthKey(k).month >= 0 && parseMonthKey(k).month <= 11;
}

/** "October 2026" */
export function formatMonthLong(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return `${MONTHS[month]} ${year}`;
}

export function previousMonthKey(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month - 1, 1);
  return monthKeyFor(d);
}

/** Midnight on the last calendar day of the month. */
export function lastDayOfMonth(monthKey: string): Date {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month + 1, 0);
}
