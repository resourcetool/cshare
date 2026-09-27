import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { Assignment, AppSettings, Meeting } from '../types';
import { CalendarMap, eventFor, planCalendar } from '../utils/calendarPlan';
import { logError } from '../utils/errors';
import { getWeek } from './weekService';

/** The small native module in android/.../CalendarModule.kt */
interface NativeCalendar {
  hasPermission(): Promise<boolean>;
  listCalendars(): Promise<{ id: number; name: string; account: string; type: string }[]>;
  upsertEvent(
    calendarId: number,
    eventId: number,
    title: string,
    description: string,
    location: string,
    startMs: number,
    endMs: number,
    alarmMinutes: number[],
  ): Promise<number>;
  deleteEvent(eventId: number): Promise<boolean>;
}

const native = (): NativeCalendar | undefined => (Platform.OS === 'android' ? (NativeModules.CshareCalendar as NativeCalendar | undefined) : undefined);

export interface DeviceCalendar {
  id: number;
  name: string;
  account: string;
}

/** Settings live on the phone (a calendar id only means something on that phone). */
export interface CalendarPrefs {
  enabled: boolean;
  calendarId?: number;
  /** let the calendar app show its own alerts too */
  alerts: boolean;
}

const PREFS_KEY = 'cshare.calprefs.v1';
const MAP_KEY = 'cshare.calmap.v1';

export async function getCalendarPrefs(): Promise<CalendarPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return { enabled: false, alerts: true, ...(JSON.parse(raw) as Partial<CalendarPrefs>) };
  } catch {
    // fall through to defaults
  }
  return { enabled: false, alerts: true };
}

export async function setCalendarPrefs(p: CalendarPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export async function hasCalendarPermission(): Promise<boolean> {
  return (await native()?.hasPermission()) ?? false;
}

export async function requestCalendarPermission(): Promise<boolean> {
  if (!native()) return false;
  const r = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.READ_CALENDAR, PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR]);
  return Object.values(r).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
}

export async function listCalendars(): Promise<DeviceCalendar[]> {
  const list = (await native()?.listCalendars()) ?? [];
  return list.map(c => ({ id: c.id, name: c.name, account: c.account }));
}

async function readMap(uid: string): Promise<CalendarMap> {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, CalendarMap>) : {};
    return all[uid] ?? {};
  } catch {
    return {};
  }
}

async function writeMap(uid: string, map: CalendarMap): Promise<void> {
  const raw = await AsyncStorage.getItem(MAP_KEY);
  const all = raw ? (JSON.parse(raw) as Record<string, CalendarMap>) : {};
  all[uid] = map;
  await AsyncStorage.setItem(MAP_KEY, JSON.stringify(all));
}

/**
 * Reads the meeting start saved by the administrator on the weekly meeting sheet.
 * This is deliberately separate from an assignment's estimated part time: the
 * latter can be 10–20 minutes after the meeting begins and can change with pacing.
 */
async function loadMeetingStarts(assignments: Assignment[]): Promise<Record<string, Date>> {
  const keys = new Set<string>();
  for (const a of assignments) {
    if (a.meeting === 'midweek' || a.meeting === 'weekend') keys.add(`${a.weekId}:${a.meeting}`);
  }

  const out: Record<string, Date> = {};
  await Promise.all(
    Array.from(keys).map(async key => {
      const [weekId, meeting] = key.split(':') as [string, Meeting];
      try {
        const week = await getWeek(weekId);
        const sheet = week?.sheets[meeting];
        if (!sheet?.date || !sheet.startTime) return;
        // The sheet date is the authoritative meeting date. Assignments normally
        // have the same date, but using the sheet keeps the calendar tied to the
        // administrator's saved meeting definition.
        const [year, month, day] = sheet.date.split('-').map(Number);
        const [hour, minute] = sheet.startTime.split(':').map(Number);
        const start = new Date(year, month - 1, day, hour, minute, 0, 0);
        if (!Number.isNaN(start.getTime())) out[key] = start;
      } catch (e) {
        // If the weekly sheet cannot be read, calendar sync still works using the
        // assignment's own startAt as a safe compatibility fallback.
        logError(`calendar meeting start ${key}`, e);
      }
    }),
  );
  return out;
}

let running: Promise<void> = Promise.resolve();

/**
 * Makes the phone calendar match this person's assignments. Safe to call often; does nothing
 * unless the person switched it on and allowed calendar access. Never throws.
 */
export function syncCalendar(assignments: Assignment[], uid: string, settings: Pick<AppSettings, 'midweekName' | 'weekendName'>): Promise<void> {
  // one run at a time, so two triggers never create the same event twice
  running = running.then(() => doSync(assignments, uid, settings)).catch(e => logError('calendar sync', e));
  return running;
}

async function doSync(assignments: Assignment[], uid: string, settings: Pick<AppSettings, 'midweekName' | 'weekendName'>): Promise<void> {
  const mod = native();
  const prefs = await getCalendarPrefs();
  if (!mod || !prefs.enabled || prefs.calendarId === undefined) return;
  if (!(await mod.hasPermission())) return;

  const map = await readMap(uid);
  const meetingStarts = await loadMeetingStarts(assignments);
  const ops = planCalendar(assignments, uid, map, {
    now: new Date(),
    alerts: prefs.alerts,
    meetingNames: { midweek: settings.midweekName, weekend: settings.weekendName },
    meetingStarts,
  });
  if (ops.length === 0) return;

  const next: CalendarMap = { ...map };
  for (const op of ops) {
    try {
      if (op.type === 'upsert') {
        const s = op.spec;
        const eventId = await mod.upsertEvent(prefs.calendarId, op.eventId, s.title, s.description, s.location, s.startMs, s.endMs, s.alarms);
        next[op.assignmentId] = { eventId, sig: s.sig, startMs: s.startMs };
      } else if (op.type === 'delete') {
        await mod.deleteEvent(op.eventId);
        delete next[op.assignmentId];
      } else {
        delete next[op.assignmentId];
      }
    } catch (e) {
      logError(`calendar ${op.type}`, e); // that one is retried at the next sync
    }
  }
  await writeMap(uid, next);
}

/** Removes CSHARE's events again (when the person switches the calendar off). */
export async function clearCalendar(uid: string): Promise<void> {
  const mod = native();
  if (!mod || !(await mod.hasPermission())) return;
  const map = await readMap(uid);
  for (const entry of Object.values(map)) {
    try {
      await mod.deleteEvent(entry.eventId);
    } catch (e) {
      logError('calendar clear', e);
    }
  }
  await writeMap(uid, {});
}

// ----------------------------------------------------------- one assignment, "Add to phone"

export type AddToPhoneResult =
  | { ok: true; calendarName: string }
  | { ok: false; reason: 'unsupported' | 'permission_denied' | 'no_calendar' | 'error' };

/**
 * "Add to phone": puts ONE assignment on the device calendar right now, on request — separate
 * from, and independent of, whether the person has the continuous background sync above turned
 * on. Safe to tap more than once (it updates the same event rather than creating a second one),
 * so re-tapping after an admin changes the time also fixes the calendar entry.
 */
export async function addAssignmentToDeviceCalendar(
  a: Assignment,
  uid: string,
  meetingName: string | undefined,
): Promise<AddToPhoneResult> {
  const mod = native();
  if (!mod) return { ok: false, reason: 'unsupported' };
  try {
    if (!(await mod.hasPermission()) && !(await requestCalendarPermission())) {
      return { ok: false, reason: 'permission_denied' };
    }
    const list = await listCalendars();
    if (list.length === 0) return { ok: false, reason: 'no_calendar' };

    const prefs = await getCalendarPrefs();
    const chosen = list.find(c => c.id === prefs.calendarId) ?? list.find(c => c.account.includes('@')) ?? list[0];

    const map = await readMap(uid);
    const meetingStarts = await loadMeetingStarts([a]);
    const spec = eventFor(a, {
      meetingName,
      alerts: true,
      meetingStartAt: a.meeting ? meetingStarts[`${a.weekId}:${a.meeting}`] : undefined,
    });
    const eventId = await mod.upsertEvent(chosen.id, map[a.id]?.eventId ?? 0, spec.title, spec.description, spec.location, spec.startMs, spec.endMs, spec.alarms);
    await writeMap(uid, { ...map, [a.id]: { eventId, sig: spec.sig, startMs: spec.startMs } });
    return { ok: true, calendarName: chosen.name };
  } catch (e) {
    logError('add to phone calendar', e);
    return { ok: false, reason: 'error' };
  }
}