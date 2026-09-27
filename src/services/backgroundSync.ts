import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundFetch from 'react-native-background-fetch';
import notifee from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';

import { Assignment } from '../types';
import {
  formatDayShort,
  formatTime,
  monthKeyFor,
} from '../utils/dates';
import { reportReminderDates } from '../utils/reports';
import { logError } from '../utils/errors';

import {
  getMyAssignments,
} from './assignmentService';

import {
  getMyReport,
} from './reportService';

import {
  currentUser,
} from './authService';

import {
  androidFor,
  ensureChannels,
  syncLocalReminders,
  syncReportReminder,
} from './notificationService';

import {
  syncCalendar,
} from './calendarService';

import {
  getSettings,
} from './settingsService';

import {
  mapUser,
} from './userService';

/*
 * Keeps this phone's reminders up to date even when
 * the CSHARE UI is not open.
 *
 * There are three ways the sync can happen:
 *
 * 1. Firebase push wakes the background handler.
 * 2. Android BackgroundFetch periodically runs the sync.
 * 3. Opening CSHARE runs the sync.
 *
 * Once a reminder has been scheduled, the actual reminder
 * is handled by Android's local notification/alarm system.
 */

const KNOWN_KEY =
  'cshare.known.v1';

type Known =
  Record<
    string,
    Record<string, number>
  >;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  return new Promise<T>(
    (resolve, reject) => {
      const timer =
        setTimeout(
          () =>
            reject(
              new Error(
                'timeout',
              ),
            ),
          ms,
        );

      promise.then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        },
      );
    },
  );
}

async function readKnown(): Promise<Known> {
  try {
    const raw =
      await AsyncStorage.getItem(
        KNOWN_KEY,
      );

    if (!raw) {
      return {};
    }

    return JSON.parse(
      raw,
    ) as Known;
  } catch {
    return {};
  }
}

/**
 * Announces newly discovered assignments.
 *
 * This is separate from the actual scheduled reminders.
 */
export async function announceNew(
  assignments: Assignment[],
  uid: string,
  enabled: boolean,
  callStyle: boolean,
): Promise<void> {
  const all =
    await readKnown();

  const known =
    all[uid];

  const nowMs =
    Date.now();

  const next:
    Record<string, number> =
    {};

  const fresh: {
    a: Assignment;
    changed: boolean;
  }[] = [];

  const assignmentAwarenessWindowMs =
    14 *
    24 *
    60 *
    60 *
    1000;

  for (
    const a of assignments
  ) {
    if (
      a.status !==
      'scheduled'
    ) {
      continue;
    }

    if (
      a.responses[uid]
        ?.status ===
      'cannot_do'
    ) {
      continue;
    }

    if (
      a.startAt.getTime() <
      nowMs
    ) {
      continue;
    }

    const startMs =
      a.startAt.getTime();

    next[a.id] =
      startMs;

    const lastChanged =
      a.updatedAt?.getTime() ??
      a.createdAt?.getTime() ??
      0;

    const recentlyChanged =
      lastChanged > 0 &&
      nowMs -
        lastChanged <=
        assignmentAwarenessWindowMs;

    if (
      a.updatedBy !== uid &&
      (
        !known ||
        known[a.id] ===
          undefined ||
        known[a.id] !==
          startMs
      ) &&
      (
        !!known ||
        recentlyChanged
      )
    ) {
      fresh.push({
        a,
        changed:
          !!known &&
          known[a.id] !==
            undefined,
      });
    }
  }

  all[uid] =
    next;

  await AsyncStorage.setItem(
    KNOWN_KEY,
    JSON.stringify(all),
  );

  if (
    !enabled ||
    fresh.length === 0
  ) {
    return;
  }

  await ensureChannels();

  for (
    const item of fresh
  ) {
    const {
      a,
      changed,
    } = item;

    const when =
      `${formatDayShort(
        a.date,
      )}, ${formatTime(
        a.startTime,
      )}`;

    await notifee.displayNotification(
      {
        id:
          `cshare-new|${a.id}|` +
          `${a.startAt.getTime()}`,

        title:
          'CSHARE',

        body: changed
          ? `Changed: ${a.title} is now ${when}. Please check the CSHARE app.`
          : `You have a new assignment: ${a.title}, ${when}. Please check the CSHARE app.`,

        data: {
          assignmentId:
            a.id,
        },

        android:
          androidFor(
            callStyle,
          ),
      },
    );
  }
}

/**
 * Reads the current user's assignments and
 * schedules/removes local reminders as necessary.
 */
export async function runBackgroundSync(): Promise<void> {
  const user =
    currentUser();

  if (!user) {
    return;
  }

  const snap =
    await withTimeout(
      firestore()
        .collection('users')
        .doc(user.uid)
        .get(),
      25000,
    );

  const data =
    snap.data();

  if (
    !snap.exists ||
    !data
  ) {
    return;
  }

  const profile =
    mapUser(
      user.uid,
      data,
    );

  if (!profile.active) {
    return;
  }

  const [
    settings,
    assignments,
  ] =
    await Promise.all([
      withTimeout(
        getSettings(),
        25000,
      ),

      withTimeout(
        getMyAssignments(
          user.uid,
        ),
        25000,
      ),
    ]);

  const prefs =
    profile.notificationPreferences;

  const callStyleOn =
    settings.callStyleEnabled &&
    prefs.callStyle;

  /*
   * This is the important part:
   *
   * Every synchronization reconciles the
   * assignments on the server with the
   * alarms currently scheduled on the phone.
   */
  await syncLocalReminders(
    assignments,
    user.uid,
    {
      remindersEnabled:
        prefs.reminders,

      callStyle:
        callStyleOn,
    },
  );

  await announceNew(
    assignments,
    user.uid,
    prefs.reminders,
    callStyleOn,
  );

  await syncCalendar(
    assignments,
    user.uid,
    settings,
  );

  /*
   * Field-service report reminder.
   *
   * Kept separate so changing assignment
   * reminders does not break reports.
   */
  try {
    const monthKey =
      monthKeyFor(
        new Date(),
      );

    const report =
      await withTimeout(
        getMyReport(
          user.uid,
          monthKey,
        ),
        25000,
      );

    await syncReportReminder(
      reportReminderDates(
        monthKey,
        new Date(),
      ),
      monthKey,
      !!report,
      {
        remindersEnabled:
          prefs.reminders,

        callStyle:
          callStyleOn,
      },
    );
  } catch (error) {
    logError(
      'report reminder sync',
      error,
    );
  }
}

export type PushData =
  | {
      [key: string]:
        | string
        | object;
    }
  | undefined;

/**
 * Handles an incoming background push.
 *
 * A normal notification can be displayed immediately.
 * A sync push causes CSHARE to retrieve the latest
 * assignments and schedule local Android reminders.
 */
export async function handlePush(
  data: PushData,
): Promise<void> {
  if (
    data?.type ===
      'notify' &&
    typeof data.body ===
      'string'
  ) {
    await ensureChannels();

    const notificationData:
      Record<
        string,
        string
      > = {};

    if (
      typeof data.assignmentId ===
      'string'
    ) {
      notificationData.assignmentId =
        data.assignmentId;
    }

    if (
      typeof data.groupId ===
      'string'
    ) {
      notificationData.groupId =
        data.groupId;
    }

    if (
      typeof data.reportId ===
      'string'
    ) {
      notificationData.reportId =
        data.reportId;
    }

    await notifee.displayNotification(
      {
        title:
          typeof data.title ===
          'string'
            ? data.title
            : 'CSHARE',

        body:
          data.body,

        data:
          Object.keys(
            notificationData,
          ).length
            ? notificationData
            : undefined,

        android:
          androidFor(false),
      },
    );

    return;
  }

  /*
   * For a background synchronization
   * push, immediately retrieve the
   * latest assignments and schedule
   * their local reminders.
   */
  await runBackgroundSync();
}

/**
 * Android can call this even when the
 * application UI is not running.
 */
export async function headlessSync(
  event: {
    taskId: string;
    timeout: boolean;
  },
): Promise<void> {
  if (!event.timeout) {
    try {
      await runBackgroundSync();
    } catch (error) {
      logError(
        'background sync',
        error,
      );
    }
  }

  BackgroundFetch.finish(
    event.taskId,
  );
}

/**
 * Registers Android background synchronization.
 *
 * Android controls the exact time of
 * periodic background fetches. The Firebase
 * background push is what allows a newly
 * assigned part to trigger synchronization
 * immediately when the server sends it.
 */
export async function startBackgroundSync(): Promise<void> {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,

      stopOnTerminate:
        false,

      startOnBoot:
        true,

      enableHeadless:
        true,

      requiredNetworkType:
        BackgroundFetch.NETWORK_TYPE_ANY,
    },

    async (
      taskId: string,
    ) => {
      try {
        await runBackgroundSync();
      } catch (error) {
        logError(
          'background sync',
          error,
        );
      } finally {
        BackgroundFetch.finish(
          taskId,
        );
      }
    },

    async (
      taskId: string,
    ) => {
      BackgroundFetch.finish(
        taskId,
      );
    },
  );
}