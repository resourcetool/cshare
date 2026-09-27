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
import { planReminders } from '../utils/reminders';
import { addFcmToken, removeFcmToken } from './userService';

export const CHANNEL_REMINDER = 'cshare_reminders_v3';
export const CHANNEL_CALL = 'cshare_call_v2';

export const CALL_ACTIVITY =
  'com.cshare.CallActivity';

const SCHEDULED_PREFIX =
  'cshare|';

const TEST_PREFIX =
  'cshare-test|';

const SMALL_ICON =
  'ic_notification';

/*
 * IMPORTANT
 *
 * Put your custom sound file here:
 *
 * android/app/src/main/res/raw/cshare_ring.wav
 *
 * Android resource names must:
 * - use lowercase letters
 * - contain no spaces
 * - contain no brackets
 * - contain no special characters
 *
 * The notification sound name below therefore stays:
 *
 * cshare_ring
 */

// ------------------------------------------------------------------
// CHANNELS & PERMISSIONS
// ------------------------------------------------------------------

export async function ensureChannels(): Promise<void> {
  /*
   * Main CSHARE reminder channel.
   *
   * Every normal CSHARE reminder uses:
   *
   * cshare_ring.wav
   */
  await notifee.createChannel({
    id: CHANNEL_REMINDER,
    name: 'CSHARE Reminders',
    description:
      'Notifications and reminders from CSHARE.',
    importance:
      AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [
      300,
      500,
      300,
      500,
    ],
    sound: 'cshare_ring',
  });

  /*
   * Final/call-style reminder channel.
   *
   * It deliberately uses the SAME
   * CSHARE sound so that users recognize
   * every CSHARE reminder immediately.
   */
  await notifee.createChannel({
    id: CHANNEL_CALL,
    name: 'CSHARE Final Reminders',
    description:
      'Important CSHARE reminders shortly before an assignment.',
    importance:
      AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [
      300,
      700,
      300,
      700,
      300,
      700,
    ],
    sound: 'cshare_ring',
  });
}

export interface ReminderCapability {
  notifications: boolean;
  exactAlarms: boolean;
}

export async function getReminderCapability(): Promise<ReminderCapability> {
  const settings =
    await notifee.getNotificationSettings();

  return {
    notifications:
      settings.authorizationStatus ===
        AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus ===
        AuthorizationStatus.PROVISIONAL,

    exactAlarms:
      settings.android.alarm !==
      AndroidNotificationSetting.DISABLED,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings =
    await notifee.requestPermission();

  return (
    settings.authorizationStatus ===
      AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus ===
      AuthorizationStatus.PROVISIONAL
  );
}

export const openNotificationSettings =
  () =>
    notifee.openNotificationSettings();

export const openExactAlarmSettings =
  () =>
    notifee.openAlarmPermissionSettings();

// ------------------------------------------------------------------
// EXACT ANDROID TRIGGER
// ------------------------------------------------------------------

function trigger(
  at: Date,
): TimestampTrigger {
  return {
    type: TriggerType.TIMESTAMP,

    timestamp: at.getTime(),

    alarmManager: {
      type:
        AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
    },
  };
}

// ------------------------------------------------------------------
// ANDROID NOTIFICATION CONFIGURATION
// ------------------------------------------------------------------

export function androidFor(
  callStyle: boolean,
) {
  if (!callStyle) {
    return {
      channelId:
        CHANNEL_REMINDER,

      importance:
        AndroidImportance.HIGH,

      category:
        AndroidCategory.REMINDER,

      smallIcon:
        SMALL_ICON,

      color:
        '#0E5A66',

      vibrationPattern: [
        300,
        500,
        300,
        500,
      ],

      pressAction: {
        id: 'default',
      },
    };
  }

  /*
   * Final reminder.
   *
   * Same CSHARE sound, but more noticeable.
   */
  return {
    channelId:
      CHANNEL_CALL,

    importance:
      AndroidImportance.HIGH,

    category:
      AndroidCategory.CALL,

    smallIcon:
      SMALL_ICON,

    color:
      '#0E5A66',

    vibrationPattern: [
      300,
      700,
      300,
      700,
      300,
      700,
    ],

    autoCancel:
      true,

    timeoutAfter:
      120000,

    pressAction: {
      id: 'call',
      launchActivity:
        CALL_ACTIVITY,
    },

    fullScreenAction: {
      id: 'call',
      launchActivity:
        CALL_ACTIVITY,
    },
  };
}

// ------------------------------------------------------------------
// ASSIGNMENT REMINDERS
// ------------------------------------------------------------------

export interface SyncResult {
  scheduled: number;
  blocked?:
    'notifications';
}

export async function syncLocalReminders(
  assignments: Assignment[],
  uid: string,
  opts: {
    remindersEnabled: boolean;
    callStyle: boolean;
  },
): Promise<SyncResult> {
  /*
   * Make sure the CSHARE channels exist
   * before scheduling anything.
   */
  await ensureChannels();

  const capability =
    await getReminderCapability();

  if (!capability.notifications) {
    return {
      scheduled: 0,
      blocked:
        'notifications',
    };
  }

  /*
   * Build the complete list of reminders
   * that SHOULD exist.
   */
  const planned =
    opts.remindersEnabled
      ? assignments.flatMap(
          assignment =>
            planReminders(
              assignment,
              uid,
              {
                now:
                  new Date(),

                callStyle:
                  opts.callStyle,
              },
            ),
        )
      : [];

  const wanted =
    new Set(
      planned.map(
        reminder =>
          reminder.id,
      ),
    );

  /*
   * Get reminders currently registered
   * with Android.
   */
  const existing =
    (
      await notifee
        .getTriggerNotificationIds()
    ).filter(
      id =>
        id.startsWith(
          SCHEDULED_PREFIX,
        ),
    );

  /*
   * Remove reminders that no longer
   * correspond to a valid assignment.
   */
  const stale =
    existing.filter(
      id =>
        !wanted.has(id),
    );

  if (stale.length > 0) {
    await notifee
      .cancelTriggerNotifications(
        stale,
      );
  }

  const have =
    new Set(existing);

  let scheduled = 0;

  /*
   * Schedule every required reminder.
   *
   * Android owns the actual alarm after
   * this point. CSHARE does NOT have to
   * remain open.
   */
  for (
    const reminder of planned
  ) {
    if (
      have.has(
        reminder.id,
      )
    ) {
      scheduled++;
      continue;
    }

    await notifee
      .createTriggerNotification(
        {
          id:
            reminder.id,

          title:
            reminder.title,

          body:
            reminder.body,

          data: {
            assignmentId:
              reminder.assignmentId,
          },

          android:
            androidFor(
              reminder.callStyle,
            ),
        },

        trigger(
          reminder.fireAt,
        ),
      );

    scheduled++;
  }

  return {
    scheduled,
  };
}

// ------------------------------------------------------------------
// CANCEL ASSIGNMENT REMINDERS
// ------------------------------------------------------------------

export async function cancelAllLocalReminders(): Promise<void> {
  const ids =
    (
      await notifee
        .getTriggerNotificationIds()
    ).filter(
      id =>
        id.startsWith(
          SCHEDULED_PREFIX,
        ),
    );

  if (ids.length > 0) {
    await notifee
      .cancelTriggerNotifications(
        ids,
      );
  }
}

// ------------------------------------------------------------------
// MONTHLY FIELD SERVICE REPORT REMINDERS
// ------------------------------------------------------------------

const REPORT_PREFIX =
  'cshare-report|';

export async function syncReportReminder(
  dates: Date[],
  monthKey: string,
  alreadySubmitted: boolean,
  opts: {
    remindersEnabled: boolean;
    callStyle: boolean;
  },
): Promise<void> {
  /*
   * Make sure report reminders also
   * use the CSHARE sound.
   */
  await ensureChannels();

  const capability =
    await getReminderCapability();

  if (!capability.notifications) {
    return;
  }

  const wanted =
    opts.remindersEnabled &&
    !alreadySubmitted
      ? dates
      : [];

  const existing =
    (
      await notifee
        .getTriggerNotificationIds()
    ).filter(
      id =>
        id.startsWith(
          REPORT_PREFIX,
        ),
    );

  /*
   * Remove reminders belonging to
   * previous months.
   */
  const stale =
    existing.filter(
      id =>
        !id.startsWith(
          `${REPORT_PREFIX}${monthKey}|`,
        ),
    );

  if (stale.length > 0) {
    await notifee
      .cancelTriggerNotifications(
        stale,
      );
  }

  /*
   * If report is already submitted,
   * remove this month's reminders.
   */
  if (!wanted.length) {
    const thisMonth =
      existing.filter(
        id =>
          id.startsWith(
            `${REPORT_PREFIX}${monthKey}|`,
          ),
      );

    if (thisMonth.length > 0) {
      await notifee
        .cancelTriggerNotifications(
          thisMonth,
        );
    }

    return;
  }

  const have =
    new Set(existing);

  for (
    const [
      index,
      at,
    ] of wanted.entries()
  ) {
    const id =
      `${REPORT_PREFIX}${monthKey}|${at.getTime()}`;

    if (have.has(id)) {
      continue;
    }

    const isFinal =
      index ===
      wanted.length - 1;

    const callStyle =
      isFinal &&
      opts.callStyle;

    await notifee
      .createTriggerNotification(
        {
          id,

          title:
            'CSHARE',

          body:
            callStyle
              ? "Your monthly report hasn't been sent yet. Please check the CSHARE app."
              : 'Reminder: send your monthly field service report before the month ends.',

          android:
            androidFor(
              callStyle,
            ),
        },

        trigger(at),
      );
  }
}

// ------------------------------------------------------------------
// TEST REMINDER
// ------------------------------------------------------------------

export async function scheduleTestReminder(
  callStyle: boolean,
  seconds = 8,
): Promise<void> {
  await ensureChannels();

  await notifee
    .createTriggerNotification(
      {
        id:
          `${TEST_PREFIX}${Date.now()}`,

        title:
          'CSHARE',

        body:
          callStyle
            ? 'This is a test. You have an assignment. Please check the CSHARE app.'
            : 'This is a CSHARE test reminder.',

        android:
          androidFor(
            callStyle,
          ),
      },

      trigger(
        new Date(
          Date.now() +
            seconds * 1000,
        ),
      ),
    );
}

// ------------------------------------------------------------------
// NOTIFICATION PRESS
// ------------------------------------------------------------------

export function listenForNotificationPress(
  onOpen: (
    assignmentId: string,
  ) => void,

  onGroupOpen?: (
    groupId: string,
  ) => void,
): () => void {
  return notifee.onForegroundEvent(
    ({
      type,
      detail,
    }) => {
      if (
        type !==
        EventType.PRESS
      ) {
        return;
      }

      const data =
        detail.notification
          ?.data;

      const groupId =
        data?.groupId;

      if (
        typeof groupId ===
          'string' &&
        onGroupOpen
      ) {
        onGroupOpen(
          groupId,
        );
        return;
      }

      const assignmentId =
        data?.assignmentId;

      if (
        typeof assignmentId ===
        'string'
      ) {
        onOpen(
          assignmentId,
        );
      }
    },
  );
}

// ------------------------------------------------------------------
// OPENING CSHARE FROM NOTIFICATION
// ------------------------------------------------------------------

export async function getLaunchNotificationData(): Promise<
  Record<string, unknown> | undefined
> {
  const initial =
    await notifee
      .getInitialNotification();

  const data =
    initial?.notification
      .data;

  return data
    ? (data as Record<
        string,
        unknown
      >)
    : undefined;
}

export async function getLaunchAssignmentId(): Promise<
  string | undefined
> {
  const data =
    await getLaunchNotificationData();

  const id =
    data?.assignmentId;

  return typeof id ===
    'string'
    ? id
    : undefined;
}