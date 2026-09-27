import { Assignment } from '../types';
import { daysBetween, formatDayShort, formatTime, toDateKey, weekdayName } from './dates';

/** Reminders are scheduled on the phone this many days ahead. */
export const HORIZON_DAYS = 60;

// Legacy calendar reminder options.
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

  if (known) {
    return known.label;
  }

  if (minutes % 1440 === 0) {
    return `${minutes / 1440} days before`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hours before`;
  }

  return `${minutes} minutes before`;
}

/**
 * Unique, positive, biggest first.
 */
export function normalizeOffsets(offsets: number[]): number[] {
  const unique = Array.from(
    new Set(
      offsets.filter(
        n => Number.isFinite(n) && n > 0,
      ),
    ),
  );

  return unique
    .sort((a, b) => b - a)
    .slice(0, MAX_REMINDERS);
}

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Smart Reminder Engine.
 *
 * The reminder schedule automatically adapts to how much notice
 * the user received for the assignment.
 */
function candidateLabel(minutes: number): string {
  if (minutes >= 1440) {
    return `${minutes / 1440} day${
      minutes / 1440 === 1 ? '' : 's'
    } before`;
  }

  if (minutes >= 60) {
    return `${minutes / 60} hour${
      minutes / 60 === 1 ? '' : 's'
    } before`;
  }

  return `${minutes} minutes before`;
}

/**
 * Creates the reminder points based on the amount of notice.
 *
 * Long notice:
 *   5 days
 *   4 days
 *   3 days
 *   2 days
 *   1 day
 *
 * Short notice:
 *   6 hours
 *   1 hour
 *   20 minutes
 *   10 minutes
 *   2 minutes
 *   start time
 */
function awarenessOffsets(noticeMinutes: number): number[] {
  /*
   * Adaptive checkpoints. The assignment-arrival notification is
   * separate; these are only future scheduled reminders.
   *
   * 6 days notice -> 5d, 4d, 3d, 2d, 1d, 6h, 1h, 20m, 10m, 2m, start
   * 3 hours notice -> 2h, 1h, 30m, 20m, 10m, 2m, start
   * 1 hour notice  -> 40m, 20m, 10m, 2m, start
   * 45m notice     -> 40m, 20m, 10m, 2m, start
   * 7m notice      -> 2m, start
   * 1m notice      -> start
   */
  const checkpoints: number[] = [];

  if (noticeMinutes > 1440) {
    // Long notice: one checkpoint per full day, excluding the
    // exact moment the assignment was received.
    const fullDays = Math.floor(noticeMinutes / 1440);
    for (let days = fullDays; days >= 1; days -= 1) {
      checkpoints.push(days * 1440);
    }

    // Once the assignment is on the same day, increase the pace.
    checkpoints.push(360, 60, 20, 10, 2);
  } else if (noticeMinutes > 360) {
    // Several hours' notice: use the 6-hour checkpoint and then
    // the final hour/minute checkpoints.
    checkpoints.push(360, 60, 20, 10, 2);
  } else {
    // Same-day short notice: choose checkpoints that fit naturally
    // inside the actual amount of notice available.
    if (noticeMinutes > 180) {
      checkpoints.push(180);
    }

    if (noticeMinutes > 120) {
      checkpoints.push(120);
    }

    if (noticeMinutes > 60) {
      checkpoints.push(60, 30);
    } else if (noticeMinutes > 40) {
      checkpoints.push(40);
    }

    if (noticeMinutes > 20) {
      checkpoints.push(20);
    }

    if (noticeMinutes > 10) {
      checkpoints.push(10);
    }

    if (noticeMinutes > 2) {
      checkpoints.push(2);
    }
  }

  // Always keep the actual start-time reminder.
  checkpoints.push(0);

  return Array.from(new Set(checkpoints));
}

export interface PlannedReminder {
  id: string;
  assignmentId: string;
  fireAt: Date;
  isFinal: boolean;
  callStyle: boolean;
  title: string;
  body: string;
}

function hash(s: string): string {
  let h = 5381;

  for (let i = 0; i < s.length; i++) {
    h =
      ((h << 5) +
        h +
        s.charCodeAt(i)) |
      0;
  }

  return (h >>> 0).toString(36);
}

/**
 * Produces phrases such as:
 *
 * today at 7:00 PM
 * tomorrow at 7:00 PM
 * on Wednesday at 7:00 PM
 * on Wed 8 Oct at 7:00 PM
 */
export function whenPhrase(
  a: Assignment,
  fireAt: Date,
): string {
  const diff = daysBetween(
    fireAt,
    a.startAt,
  );

  const time = formatTime(a.startTime);

  if (diff <= 0) {
    return `today at ${time}`;
  }

  if (diff === 1) {
    return `tomorrow at ${time}`;
  }

  if (diff < 7) {
    return `on ${weekdayName(
      toDateKey(a.startAt),
    )} at ${time}`;
  }

  return `on ${formatDayShort(
    toDateKey(a.startAt),
  )} at ${time}`;
}

/**
 * Decide which reminders should exist for this person right now.
 *
 * This function is intentionally pure.
 */
export function planReminders(
  a: Assignment,
  uid: string,
  opts: {
    now: Date;
    callStyle: boolean;
    horizonDays?: number;
    /** Optional admin-configured meeting start. When supplied, it is the reminder anchor. */
    meetingStartAt?: Date;
  },
): PlannedReminder[] {
  // Only scheduled assignments.
  if (a.status !== 'scheduled') {
    return [];
  }

  // Only the assigned person.
  if (!a.assigneeIds.includes(uid)) {
    return [];
  }

  // Do not remind someone who declined.
  if (
    a.responses[uid]?.status ===
    'cannot_do'
  ) {
    return [];
  }

  // Use the admin-configured meeting start as the reminder anchor when available.
  // Fall back to the assignment start for older assignments or data without a meeting sheet.
  const anchorStartAt =
    opts.meetingStartAt ?? a.startAt;

  // The meeting has already started/passed.
  if (
    anchorStartAt.getTime() <=
    opts.now.getTime()
  ) {
    return [];
  }

  const horizon =
    opts.now.getTime() +
    (opts.horizonDays ?? HORIZON_DAYS) *
      DAY;

  const noticeMinutes =
    (anchorStartAt.getTime() -
      opts.now.getTime()) /
    MINUTE;

  const points =
    awarenessOffsets(noticeMinutes);

  const planned: PlannedReminder[] = [];

  points.forEach(offset => {
    const fireAt = new Date(
      anchorStartAt.getTime() -
        offset * MINUTE,
    );

    // Do not schedule something that has already passed.
    if (
      fireAt.getTime() <=
      opts.now.getTime() + 5000
    ) {
      return;
    }

    // Do not schedule outside our horizon.
    if (
      fireAt.getTime() > horizon
    ) {
      return;
    }

    const isFinal = offset === 0;

    const callStyleOffset =
      offset === 1440 ||
      offset === 60 ||
      offset === 2 ||
      offset === 0;

    const callStyle =
      opts.callStyle &&
      callStyleOffset;

    let body: string;

    if (offset === 0) {
      body =
        `The meeting starts now. ` +
        `${a.title} is your assignment. Please check the CSHARE app.`;
    } else if (callStyle) {
      if (offset === 1440) {
        body =
          `Your meeting is tomorrow. ` +
          `You have ${a.title}. Please check the CSHARE app.`;
      } else if (offset === 60) {
        body =
          `Your meeting starts in 1 hour. ` +
          `You have ${a.title}. Please check the CSHARE app.`;
      } else {
        body =
          `Your meeting starts in ${offset} minutes. ` +
          `You have ${a.title}. Please check the CSHARE app.`;
      }
    } else {
      body =
        `${candidateLabel(offset)}: ` +
        `${a.title} is ${whenPhrase(
          { ...a, startAt: anchorStartAt, startTime: `${anchorStartAt.getHours().toString().padStart(2, '0')}:${anchorStartAt.getMinutes().toString().padStart(2, '0')}`, date: toDateKey(anchorStartAt) },
          fireAt,
        )}.`;
    }

    planned.push({
      id:
        `cshare|${a.id}|${offset}|` +
        `${fireAt.getTime()}|` +
        `${callStyle ? 'c' : 'n'}|` +
        `${hash(body)}`,

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