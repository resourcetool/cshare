import { Assignment, DisplayStatus } from '../types';
import { addDays, combineDateTime, startOfDay } from './dates';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';

export function statusFor(a: Assignment, uid: string): DisplayStatus {
  if (a.status === 'cancelled') return 'cancelled';
  return a.responses[uid]?.status ?? 'scheduled';
}

export function statusLabel(s: DisplayStatus, audience: 'admin' | 'user'): string {
  switch (s) {
    case 'seen':
      return 'Seen';
    case 'cannot_do':
      return "Can't do";
    case 'cancelled':
      return 'Cancelled';
    default:
      return audience === 'admin' ? 'Not seen yet' : 'Scheduled';
  }
}

export function statusTone(s: DisplayStatus): Tone {
  switch (s) {
    case 'seen':
      return 'good';
    case 'cannot_do':
      return 'bad';
    case 'cancelled':
      return 'neutral';
    default:
      return 'info';
  }
}

export interface AttentionItem {
  assignment: Assignment;
  uid: string;
  name: string;
  reason?: string;
}

/** People who said they cannot do an assignment (that is still going ahead). */
export function attentionItems(list: Assignment[]): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const a of list) {
    if (a.status === 'cancelled') continue;
    for (const uid of a.assigneeIds) {
      const r = a.responses[uid];
      if (r?.status === 'cannot_do') {
        out.push({ assignment: a, uid, name: a.assigneeNames[uid] ?? 'Someone', reason: r.reason });
      }
    }
  }
  return out;
}

/**
 * People who have an assignment coming up soon but have never opened it (no "seen" and no
 * "cannot do" on record). Surfacing this — with time to still call or text them — is what makes
 * it hard for someone to later say they were never told: the app shows, before the fact, exactly
 * who has not yet acknowledged their part.
 */
export function unconfirmedSoonItems(list: Assignment[], now: Date, withinHours = 72): AttentionItem[] {
  const cutoff = now.getTime() + withinHours * HOUR;
  const out: AttentionItem[] = [];
  for (const a of list) {
    if (a.status === 'cancelled') continue;
    if (a.startAt.getTime() < now.getTime() || a.startAt.getTime() > cutoff) continue;
    for (const uid of a.assigneeIds) {
      if (!a.responses[uid]) out.push({ assignment: a, uid, name: a.assigneeNames[uid] ?? 'Someone' });
    }
  }
  return out;
}

const HOUR = 3600000;
const DEFAULT_DURATION_MS = 60 * 60000; // most parts are well under an hour; used when there's no explicit end time

/** The moment this assignment should stop being treated as "current" (its own end time, or a
 * sensible default after its start) — this is what decides when it drops off the dashboard. */
export function assignmentEndAt(a: Assignment): Date {
  if (a.endTime) return combineDateTime(a.date, a.endTime);
  return new Date(a.startAt.getTime() + DEFAULT_DURATION_MS);
}

/** Assignments that are current or upcoming — never one that has already finished. */
export function upcomingFor(list: Assignment[], now: Date): Assignment[] {
  return list
    .filter(a => assignmentEndAt(a).getTime() > now.getTime())
    .sort((x, y) => x.startAt.getTime() - y.startAt.getTime());
}

/** Today's assignments that have not finished yet, soonest first. */
export function todaysFor(list: Assignment[], now: Date): Assignment[] {
  return upcomingFor(list, now).filter(a => a.startAt.getTime() < startOfDay(addDays(now, 1)).getTime());
}

export function nextAssignment(list: Assignment[], uid: string, now: Date): Assignment | undefined {
  return upcomingFor(list, now).find(a => {
    const s = statusFor(a, uid);
    return s !== 'cancelled' && s !== 'cannot_do';
  });
}
