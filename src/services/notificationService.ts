import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  EventType,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import { Assignment } from '../types';
import { logError } from '../utils/errors';
import { planReminders } from '../utils/reminders';
import { addFcmToken, removeFcmToken } from './userService';

export const CHANNEL_REMINDER = 'cshare_reminders_v2'; // v2: switched off the device's default sound
export const CHANNEL_CALL = 'cshare_call_v1'; // change the id if the sound/vibration ever changes
export const CALL_ACTIVITY = 'com.cshare.CallActivity';
const SCHEDULED_PREFIX = 'cshare|';
const TEST_PREFIX = 'cshare-test|';
const SMALL_ICON = 'ic_notification';

// ------------------------------------------------------------------ setup & permissions

export async function ensureChannels(): Promise<void> {
  // Every CSHARE alarm/reminder uses this ringtone, never the device's own notification or
  // alarm sound, so an assignment reminder is always unmistakably a CSHARE reminder.
  await notifee.createChannel({
    id: CHANNEL_REMINDER,
    name: 'Assignment reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
    sound: 'cshare_ring', // android/app/src/main/res/raw/cshare_ring.wav
  });
  await notifee.createChannel({
    id: CHANNEL_CALL,
    name: 'Final reminder (call-style)',
    description: 'A louder, more noticeable reminder shortly before an assignment.',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 700, 300, 700, 300, 700],
    sound: 'cshare_ring', // android/app/src/main/res/raw/cshare_ring.wav
  });
}

export interface ReminderCapability {
  notifications: boolean;
  /** Android 12+ needs "Alarms & reminders" to be allowed for on-time delivery. */
  exactAlarms: boolean;
}

export async function getReminderCapability(): Promise<ReminderCapability> {
  const s = await notifee.getNotificationSettings();
  return {
    notifications:
      s.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      s.authorizationStatus === AuthorizationStatus.PROVISIONAL,
    exactAlarms: s.android.alarm !== AndroidNotificationSetting.DISABLED,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const s = await notifee.requestPermission();
  return (
    s.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    s.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

export const openNotificationSettings = () => notifee.openNotificationSettings();
export const openExactAlarmSettings = () => notifee.openAlarmPermissionSettings();

// ------------------------------------------------------------------ local reminders

function trigger(at: Date): TimestampTrigger {
  return {
    type: TriggerType.TIMESTAMP,
    timestamp: at.getTime(),
    alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
  };
}

export function androidFor(callStyle: boolean) {
  if (!callStyle) {
    return {
      channelId: CHANNEL_REMINDER,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.REMINDER,
      smallIcon: SMALL_ICON,
      color: '#0E5A66',
      pressAction: { id: 'default' },
    };
  }
  // Call-style: high priority + full-screen intent. If Android does not allow a full-screen
  // intent for this app (e.g. Android 14+ permission not granted, or the phone is in use)
  // it automatically shows the same notification as a heads-up alert with sound/vibration.
  return {
    channelId: CHANNEL_CALL,
    importance: AndroidImportance.HIGH,
    category: AndroidCategory.CALL,
    smallIcon: SMALL_ICON,
    color: '#0E5A66',
    autoCancel: true,
    timeoutAfter: 120000,
    pressAction: { id: 'call', launchActivity: CALL_ACTIVITY },
    fullScreenAction: { id: 'call', launchActivity: CALL_ACTIVITY },
  };
}

export interface SyncResult {
  scheduled: number;
  blocked?: 'notifications';
}

/**
 * Makes the reminders scheduled on this phone match the assignments Firestore last delivered.
 * Called every time assignments change (including when the phone reconnects and Firestore
 * catches up), so edits/cancellations made while the phone was offline replace old reminders.
 * Safe to call repeatedly — running it 1, 5 or 20 times in a row never creates a duplicate,
 * because each planned reminder's id is entirely derived from the assignment, so an unchanged
 * reminder always recomputes to the same id and is left alone (see planReminders / reminders.ts).
 *
 * "Assignment received" itself (Event 1) is a separate, one-shot notification handled by
 * announceNew() in backgroundSync.ts — this function only owns the scheduled Smart Reminders
 * (Events 2 and 3).
 */
export async function syncLocalReminders(
  assignments: Assignment[],
  uid: string,
  opts: { remindersEnabled: boolean; callStyle: boolean },
): Promise<SyncResult> {
  const cap = await getReminderCapability();
  if (!cap.notifications) return { scheduled: 0, blocked: 'notifications' };

  const planned = opts.remindersEnabled
    ? assignments.flatMap(a => planReminders(a, uid, { now: new Date(), callStyle: opts.callStyle }))
    : [];
  const wanted = new Set(planned.map(p => p.id));

  const existing = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(SCHEDULED_PREFIX));
  const stale = existing.filter(id => !wanted.has(id));
  if (stale.length) await notifee.cancelTriggerNotifications(stale);

  const have = new Set(existing);
  let scheduled = 0;
  for (const p of planned) {
    if (have.has(p.id)) {
      scheduled++;
      continue;
    }
    await notifee.createTriggerNotification(
      { id: p.id, title: p.title, body: p.body, data: { assignmentId: p.assignmentId }, android: androidFor(p.callStyle) },
      trigger(p.fireAt),
    );
    scheduled++;
  }
  return { scheduled };
}

export async function cancelAllLocalReminders(): Promise<void> {
  const ids = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(SCHEDULED_PREFIX));
  if (ids.length) await notifee.cancelTriggerNotifications(ids);
}

// ------------------------------------------------------------------ "time to send your report"

const REPORT_PREFIX = 'cshare-report|';

/**
 * Keeps this phone's "time to send your report" reminders in step: scheduled the same way as
 * assignment reminders (an Android exact alarm, so it still rings if the app is closed), loud
 * the same way a new assignment is, and automatically cancelled the moment the report for that
 * month has actually been submitted — never a leftover reminder to submit something already done.
 */
export async function syncReportReminder(
  dates: Date[],
  monthKey: string,
  alreadySubmitted: boolean,
  opts: { remindersEnabled: boolean; callStyle: boolean },
): Promise<void> {
  const cap = await getReminderCapability();
  if (!cap.notifications) return;

  const wanted = opts.remindersEnabled && !alreadySubmitted ? dates : [];
  const existing = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(REPORT_PREFIX));
  const stale = existing.filter(id => !id.startsWith(`${REPORT_PREFIX}${monthKey}|`));
  if (stale.length) await notifee.cancelTriggerNotifications(stale);
  if (!wanted.length) {
    const thisMonth = existing.filter(id => id.startsWith(`${REPORT_PREFIX}${monthKey}|`));
    if (thisMonth.length) await notifee.cancelTriggerNotifications(thisMonth);
    return;
  }

  const have = new Set(existing);
  for (const [i, at] of wanted.entries()) {
    const id = `${REPORT_PREFIX}${monthKey}|${at.getTime()}`;
    if (have.has(id)) continue;
    const isFinal = i === wanted.length - 1;
    const callStyle = isFinal && opts.callStyle;
    await notifee.createTriggerNotification(
      {
        id,
        title: 'CSHARE',
        body: callStyle
          ? "Your monthly report hasn't been sent yet. Please check the CSHARE app."
          : "Reminder: send your monthly field service report before the month ends.",
        android: androidFor(callStyle),
      },
      trigger(at),
    );
  }
}

/** For the "Send a test reminder" buttons in Settings. */
export async function scheduleTestReminder(callStyle: boolean, seconds = 8): Promise<void> {
  await ensureChannels();
  await notifee.createTriggerNotification(
    {
      id: `${TEST_PREFIX}${Date.now()}`,
      title: 'CSHARE',
      body: callStyle
        ? 'This is a test. You have an assignment. Please check the CSHARE app.'
        : 'This is a test reminder.',
      android: androidFor(callStyle),
    },
    trigger(new Date(Date.now() + seconds * 1000)),
  );
}

// ------------------------------------------------------------------ opening from a notification

export function listenForNotificationPress(onOpen: (assignmentId: string) => void, onGroupOpen?: (groupId: string) => void): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type !== EventType.PRESS) return;
    const data = detail.notification?.data;
    const groupId = data?.groupId;
    if (typeof groupId === 'string' && onGroupOpen) {
      onGroupOpen(groupId);
      return;
    }
    const id = data?.assignmentId;
    if (typeof id === 'string') onOpen(id);
  });
}

/** If the app was started by tapping a notification, return its data once. */
export async function getLaunchNotificationData(): Promise<Record<string, unknown> | undefined> {
  const initial = await notifee.getInitialNotification();
  const data = initial?.notification.data;
  return data ? (data as Record<string, unknown>) : undefined;
}

/** Backwards-compatible helper for callers that only need an assignment id. */
export async function getLaunchAssignmentId(): Promise<string | undefined> {
  const data = await getLaunchNotificationData();
  const id = data?.assignmentId;
  return typeof id === 'string' ? id : undefined;
}

// ------------------------------------------------------------------ push (needs internet)

/**
 * Saves this phone's FCM token on the user's profile so Cloud Functions can send
 * "new assignment / changed / cancelled" messages while the phone is online.
 * Returns a cleanup function.
 */
export async function registerPush(uid: string, onData: (data: { [k: string]: string | object } | undefined) => void): Promise<() => void> {
  const token = await messaging().getToken();
  await addFcmToken(uid, token);
  const offRefresh = messaging().onTokenRefresh(t => {
    addFcmToken(uid, t).catch(e => logError('token refresh', e));
  });
  // Push messages are "data only": the app decides what to do (sync now, or show a short notice).
  const offMessage = messaging().onMessage(async m => {
    onData(m.data);
  });
  return () => {
    offRefresh();
    offMessage();
  };
}

export async function unregisterPush(uid: string): Promise<void> {
  const token = await messaging().getToken();
  await removeFcmToken(uid, token);
  await messaging().deleteToken();
}
