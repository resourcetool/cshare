import { Assignment } from '../types';
import { daysBetween, formatDayShort, formatTime, toDateKey, weekdayName } from './dates';

/** Reminders are scheduled on the phone this many days ahead (matches how far out assignments
 * are queried), so Android's per-app exact-alarm limit is never at risk of being reached. */
export const HORIZON_DAYS = 60;

// --- Legacy per-assignment "alert" offsets -----------------------------------------------
// CSHARE's own reminders (below) are now fully automatic (see the Smart Reminder Engine), but
// this small set of offsets is still used for one separate, optional thing: how far ahead of an
// event the PHONE'S OWN calendar app should alert, when someone chooses to sync assignments (or
// add one) to their personal calendar. That is a different, opt-in feature — see calendarPlan.ts
// and calendarService.ts — and is unrelated to whether/when CSHARE itself reminds someone.
export const MAX_REMINDERS = 3;
export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 10080, label: '1 week before' },
  { minutes: 4320, label: '3 days before' },
  { minutes: 2880, label: '2 days before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 360, label: '6 hours before' },
  { minutes: 180, label: '3 hours before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 30, label: '30 minutes before' },
];

export function offsetLabel(minutes: number): string {
  const known = REMINDER_OPTIONS.find(o => o.minutes === minutes);
  if (known) return known.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} days before`;
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} minutes before`;
}

/** Unique, positive, biggest first (earliest reminder first), at most three. */
export function normalizeOffsets(offsets: number[]): number[] {
  const unique = Array.from(new Set(offsets.filter(n => Number.isFinite(n) && n > 0)));
  return unique.sort((a, b) => b - a).slice(0, MAX_REMINDERS);
}

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The Smart Reminder Engine.
 *
 * Rather than relying only on a fixed, manually-picked set of offsets (which quietly gives
 * nobody a reminder at all when an assignment is handed out with little notice), CSHARE works
 * out, from how much notice this particular assignment actually has, which candidate points
 * still make sense — always keeping at least one reminder before the assignment starts, and
 * never one that has already passed.
 */
function candidateLabel(minutes: number): string {
  if (minutes >= 1440) return `${minutes / 1440} day${minutes / 1440 === 1 ? '' : 's'} before`;
  if (minutes >= 60) return `${minutes / 60} hour${minutes / 60 === 1 ? '' : 's'} before`;
  return `${minutes} minutes before`;
}

/**
 * Picks which candidate points to actually use, tiered by how much notice there is in total.
 * This keeps the schedule sensible (not one reminder, not fifteen) whether the assignment was
 * given out weeks ahead or minutes ahead. See CSHARE's Smart Reminder specification for the
 * worked examples this mirrors.
 */
function tierFor(noticeMinutes: number): number[] {
  if (noticeMinutes > 7 * 1440) return [10080, 4320, 1440, 180, 60, 15];
  if (noticeMinutes > 1440) return [4320, 1440, 720, 180, 60, 15];
  if (noticeMinutes > 12 * 60) return [720, 180, 60, 15, 5];
  if (noticeMinutes > 3 * 60) return [180, 60, 30, 15, 5];
  if (noticeMinutes > 30) return [60, 30, 15, 5];
  return [5]; // under 30 minutes' notice: one heads-up is plenty, not a flurry of alerts
}

export interface PlannedReminder {
  id: string;
  assignmentId: string;
  fireAt: Date;
  /** The last reminder before the assignment starts. Shown call-style if the person allows it. */
  isFinal: boolean;
  callStyle: boolean;
  title: string;
  body: string;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** "tomorrow at 7:00 PM", "on Wednesday at 7:00 PM", "on Wed 8 Oct at 7:00 PM" */
export function whenPhrase(a: Assignment, fireAt: Date): string {
  const diff = daysBetween(fireAt, a.startAt);
  const time = formatTime(a.startTime);
  if (diff <= 0) return `today at ${time}`;
  if (diff === 1) return 'tomorrow at ' + time;
  if (diff < 7) return `on ${weekdayName(toDateKey(a.startAt))} at ${time}`;
  return `on ${formatDayShort(toDateKey(a.startAt))} at ${time}`;
}

/**
 * Decide which local reminders should exist for this person right now, for ONE assignment.
 * Pure function of (assignment, now): notificationService compares this against what is
 * actually scheduled on the device and reconciles the difference, so calling this again and
 * again — every sync, every app open — never creates a duplicate.
 */
export function planReminders(
  a: Assignment,
  uid: string,
  opts: { now: Date; callStyle: boolean; horizonDays?: number },
): PlannedReminder[] {
  if (a.status !== 'scheduled') return [];
  if (!a.assigneeIds.includes(uid)) return [];
  if (a.responses[uid]?.status === 'cannot_do') return [];
  if (a.startAt.getTime() <= opts.now.getTime()) return []; // already happening / past

  const horizon = opts.now.getTime() + (opts.horizonDays ?? HORIZON_DAYS) * DAY;
  const noticeMinutes = (a.startAt.getTime() - opts.now.getTime()) / MINUTE;
  const points = [...tierFor(noticeMinutes), 0]; // 0 = "starts now", always included

  const planned: PlannedReminder[] = [];
  points.forEach((offset, slot) => {
    const fireAt = new Date(a.startAt.getTime() - offset * MINUTE);
    if (fireAt.getTime() <= opts.now.getTime() + 5000) return; // already past — never schedule a candidate that's gone
    if (fireAt.getTime() > horizon) return; // set later instead, once it's within the scheduling window
    const isFinal = slot === points.length - 1;
    const callStyle = isFinal && opts.callStyle;
    const body =
      offset === 0
        ? (callStyle ? `${a.title} starts now. Please check the CSHARE app.` : `${a.title} starts now.`)
        : callStyle
          ? `You have an assignment: ${a.title}. Please check the CSHARE app.`
          : `${candidateLabel(offset)}: ${a.title} is ${whenPhrase(a, fireAt)}.`;
    planned.push({
      id: `cshare|${a.id}|${offset}|${fireAt.getTime()}|${callStyle ? 'c' : 'n'}|${hash(body)}`,
      assignmentId: a.id,
      fireAt,
      isFinal,
      callStyle,
      title: 'CSHARE',
      body,
    });
  });

  return planned;
}
