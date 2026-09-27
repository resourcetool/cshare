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
  const points: number[] = [];

  if (noticeMinutes > 5 * 1440) {
    points.push(
      5 * 1440,
      4 * 1440,
      3 * 1440,
      2 * 1440,
      1440,
    );
  } else if (noticeMinutes > 4 * 1440) {
    points.push(
      4 * 1440,
      3 * 1440,
      2 * 1440,
      1440,
    );
  } else if (noticeMinutes > 3 * 1440) {
    points.push(
      3 * 1440,
      2 * 1440,
      1440,
    );
  } else if (noticeMinutes > 2 * 1440) {
    points.push(
      2 * 1440,
      1440,
    );
  } else if (noticeMinutes > 1440) {
    points.push(1440);
  }

  // Same-day reminders.
  points.push(
    360,
    60,
    20,
    10,
    2,
    0,
  );

  return points;
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

  // Assignment already started/passed.
  if (
    a.startAt.getTime() <=
    opts.now.getTime()
  ) {
    return [];
  }

  const horizon =
    opts.now.getTime() +
    (opts.horizonDays ?? HORIZON_DAYS) *
      DAY;

  const noticeMinutes =
    (a.startAt.getTime() -
      opts.now.getTime()) /
    MINUTE;

  const points =
    awarenessOffsets(noticeMinutes);

  const planned: PlannedReminder[] = [];

  points.forEach(offset => {
    const fireAt = new Date(
      a.startAt.getTime() -
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
      offset === 20 ||
      offset === 10 ||
      offset === 2 ||
      offset === 0;

    const callStyle =
      opts.callStyle &&
      callStyleOffset;

    let body: string;

    if (offset === 0) {
      body =
        `${a.title} starts now. ` +
        `Please check the CSHARE app.`;
    } else if (callStyle) {
      if (offset === 1440) {
        body =
          `Your assignment is tomorrow: ` +
          `${a.title}. Please check the CSHARE app.`;
      } else if (offset === 60) {
        body =
          `Your assignment starts in 1 hour: ` +
          `${a.title}. Please check the CSHARE app.`;
      } else {
        body =
          `Your assignment starts in ${offset} minutes: ` +
          `${a.title}. Please check the CSHARE app.`;
      }
    } else {
      body =
        `${candidateLabel(offset)}: ` +
        `${a.title} is ${whenPhrase(
          a,
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