import { Assignment, Meeting } from '../types';
import { combineDateTime } from './dates';
import { normalizeOffsets } from './reminders';

/** What goes into the phone's calendar for one assignment. */
export interface CalendarEventSpec {
  title: string;
  description: string;
  location: string;
  startMs: number;
  endMs: number;
  /** minutes before the start; the calendar app shows these alerts */
  alarms: number[];
  /** changes whenever anything above changes */
  sig: string;
}

/** What we remember: which calendar event belongs to which assignment. */
export type CalendarMap = Record<string, { eventId: number; sig: string; startMs: number }>;

export type CalendarOp =
  | { type: 'upsert'; assignmentId: string; eventId: number; spec: CalendarEventSpec }
  | { type: 'delete'; assignmentId: string; eventId: number }
  | { type: 'forget'; assignmentId: string };

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function eventFor(a: Assignment, opts: { meetingName?: string; alerts: boolean }): CalendarEventSpec {
  const startMs = a.startAt.getTime();
  let endMs = a.endTime ? combineDateTime(a.date, a.endTime).getTime() : startMs + 30 * 60000;
  if (endMs <= startMs) endMs = startMs + 30 * 60000;
  const others = Object.entries(a.assigneeNames).map(([, name]) => name);
  const description = [
    [opts.meetingName, a.category].filter(Boolean).join(' · '),
    others.length > 1 ? `With: ${others.join(', ')}` : '',
    a.description,
    'Opened from CSHARE',
  ].filter(Boolean).join('\n');
  const alarms = opts.alerts ? normalizeOffsets(a.reminderOffsetsMinutes) : [];
  const title = `CSHARE: ${a.title}`;
  return { title, description, location: a.location, startMs, endMs, alarms, sig: hash([title, startMs, endMs, a.location, description, alarms.join(',')].join('|')) };
}

/**
 * Decides what to do in the calendar so it matches this person's assignments:
 * add new ones, update changed ones, remove cancelled / reassigned / "can't do" ones.
 */
export function planCalendar(
  assignments: Assignment[],
  uid: string,
  map: CalendarMap,
  opts: { now: Date; alerts: boolean; meetingNames: Record<Meeting, string> },
): CalendarOp[] {
  const nowMs = opts.now.getTime();
  const ops: CalendarOp[] = [];
  const wanted = new Set<string>();

  for (const a of assignments) {
    if (!a.assigneeIds.includes(uid) || a.status !== 'scheduled') continue;
    if (a.responses[uid]?.status === 'cannot_do') continue;
    if (a.startAt.getTime() < nowMs - 3600000) continue; // already over
    wanted.add(a.id);
    const spec = eventFor(a, { meetingName: a.meeting ? opts.meetingNames[a.meeting] : undefined, alerts: opts.alerts });
    const prev = map[a.id];
    if (!prev) ops.push({ type: 'upsert', assignmentId: a.id, eventId: 0, spec });
    else if (prev.sig !== spec.sig) ops.push({ type: 'upsert', assignmentId: a.id, eventId: prev.eventId, spec });
  }

  for (const [id, entry] of Object.entries(map)) {
    if (wanted.has(id)) continue;
    // past events stay in the calendar as history; upcoming ones that no longer apply are removed
    ops.push(entry.startMs > nowMs ? { type: 'delete', assignmentId: id, eventId: entry.eventId } : { type: 'forget', assignmentId: id });
  }
  return ops;
}
