import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundFetch from 'react-native-background-fetch';
import notifee from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';
import { Assignment } from '../types';
import { formatDayShort, formatTime, monthKeyFor } from '../utils/dates';
import { reportReminderDates } from '../utils/reports';
import { logError } from '../utils/errors';
import { getMyAssignments } from './assignmentService';
import { getMyReport } from './reportService';
import { currentUser } from './authService';
import { androidFor, ensureChannels, syncLocalReminders, syncReportReminder } from './notificationService';
import { syncCalendar } from './calendarService';
import { getSettings } from './settingsService';
import { mapUser } from './userService';

/*
 * Keeps this phone's reminders up to date WITHOUT the app being open:
 *  - Android runs `headlessSync` by itself every ~15 minutes or more, but only when the phone
 *    has an internet connection (like a mail app). It also runs after a restart.
 *  - If Cloud Functions are deployed, a push message triggers the same sync straight away.
 *  - Opening the app does it too.
 * Reminders themselves are Android alarms on the phone, so they ring offline, app closed.
 */

const KNOWN_KEY = 'cshare.known.v1';
type Known = Record<string, Record<string, number>>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function readKnown(): Promise<Known> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_KEY);
    return raw ? (JSON.parse(raw) as Known) : {};
  } catch {
    return {};
  }
}

/**
 * Shows "New assignment" / "Changed" the moment this phone learns about it — the same loud,
 * call-style alert as the final reminder before an assignment (when the person allows it), since
 * a quiet notification is too easy to miss for something this important.
 * The very first run only learns what already exists, so nobody is flooded.
 */
export async function announceNew(assignments: Assignment[], uid: string, enabled: boolean, callStyle: boolean): Promise<void> {
  const all = await readKnown();
  const known = all[uid];
  const nowMs = Date.now();
  const next: Record<string, number> = {};
  const fresh: { a: Assignment; changed: boolean }[] = [];

  for (const a of assignments) {
    if (a.status !== 'scheduled' || a.responses[uid]?.status === 'cannot_do' || a.startAt.getTime() < nowMs) continue;
    const ms = a.startAt.getTime();
    next[a.id] = ms;
    // people are not told about what they saved themselves
    if (known && known[a.id] !== ms && a.updatedBy !== uid) fresh.push({ a, changed: known[a.id] !== undefined });
  }

  all[uid] = next;
  await AsyncStorage.setItem(KNOWN_KEY, JSON.stringify(all));
  if (!known || !enabled || fresh.length === 0) return;

  await ensureChannels();
  for (const { a, changed } of fresh) {
    const when = `${formatDayShort(a.date)}, ${formatTime(a.startTime)}`;
    await notifee.displayNotification({
      id: `cshare-new|${a.id}|${a.startAt.getTime()}`, // same id = never shown twice
      title: 'CSHARE',
      body: changed
        ? `Changed: ${a.title} is now ${when}.`
        : callStyle
          ? `You have a new assignment: ${a.title}. Please check the CSHARE app.`
          : `New assignment: ${a.title}, ${when}.`,
      data: { assignmentId: a.id },
      android: androidFor(changed ? false : callStyle),
    });
  }
}

/** Reads what this person needs (from the server if online, otherwise the saved copy) and schedules reminders. */
export async function runBackgroundSync(): Promise<void> {
  const user = currentUser();
  if (!user) return;

  const snap = await withTimeout(firestore().collection('users').doc(user.uid).get(), 25000);
  const data = snap.data();
  if (!snap.exists || !data) return;
  const profile = mapUser(user.uid, data);
  if (!profile.active) return;

  const [settings, assignments] = await Promise.all([
    withTimeout(getSettings(), 25000),
    withTimeout(getMyAssignments(user.uid), 25000),
  ]);
  const prefs = profile.notificationPreferences;
  const callStyleOn = settings.callStyleEnabled && prefs.callStyle;
  await syncLocalReminders(assignments, user.uid, {
    remindersEnabled: prefs.reminders,
    callStyle: callStyleOn,
  });
  await announceNew(assignments, user.uid, prefs.reminders, callStyleOn);
  await syncCalendar(assignments, user.uid, settings);

  try {
    const monthKey = monthKeyFor(new Date());
    const report = await withTimeout(getMyReport(user.uid, monthKey), 25000);
    await syncReportReminder(reportReminderDates(monthKey, new Date()), monthKey, !!report, {
      remindersEnabled: prefs.reminders,
      callStyle: callStyleOn,
    });
  } catch (e) {
    logError('report reminder sync', e);
  }
}

export type PushData = { [k: string]: string | object } | undefined;

/** A push message from the Cloud Function: either "sync now" or a short notice for administrators. */
export async function handlePush(data: PushData): Promise<void> {
  if (data?.type === 'notify' && typeof data.body === 'string') {
    await ensureChannels();
    const notificationData: Record<string, string> = {};
    if (typeof data.assignmentId === 'string') notificationData.assignmentId = data.assignmentId;
    if (typeof data.groupId === 'string') notificationData.groupId = data.groupId;
    if (typeof data.reportId === 'string') notificationData.reportId = data.reportId;
    await notifee.displayNotification({
      title: typeof data.title === 'string' ? data.title : 'CSHARE',
      body: data.body,
      data: Object.keys(notificationData).length ? notificationData : undefined,
      android: androidFor(false),
    });
    return;
  }
  await runBackgroundSync();
}

/** Android calls this even when the app is closed (registered in index.js). */
export async function headlessSync(event: { taskId: string; timeout: boolean }): Promise<void> {
  if (!event.timeout) {
    try {
      await runBackgroundSync();
    } catch (e) {
      logError('background sync', e);
    }
  }
  BackgroundFetch.finish(event.taskId);
}

/** Asks Android to run the sync regularly (only when there is a connection) and after a restart. */
export async function startBackgroundSync(): Promise<void> {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId: string) => {
      try {
        await runBackgroundSync();
      } catch (e) {
        logError('background sync', e);
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    async (taskId: string) => {
      BackgroundFetch.finish(taskId);
    },
  );
}
