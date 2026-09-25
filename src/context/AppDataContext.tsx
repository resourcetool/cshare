import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_SETTINGS } from '../constants';
import { AppSettings, Assignment, AssignmentType, MonthlyReport, UserProfile, Week } from '../types';
import { useLive } from '../hooks/useLive';
import { subscribeToMyAssignments } from '../services/assignmentService';
import { subscribeToMyReport } from '../services/reportService';
import { subscribeToSettings, subscribeToTypes } from '../services/settingsService';
import { subscribeToWeeks } from '../services/weekService';
import { announceNew, handlePush, startBackgroundSync } from '../services/backgroundSync';
import { syncCalendar } from '../services/calendarService';
import { monthKeyFor, shiftWeek, weekIdFor } from '../utils/dates';
import { reportReminderDates } from '../utils/reports';
import { touchLastActive } from '../services/userService';
import {
  ensureChannels,
  getReminderCapability,
  openExactAlarmSettings,
  openNotificationSettings,
  registerPush,
  requestNotificationPermission,
  syncLocalReminders,
  syncReportReminder,
} from '../services/notificationService';
import { logError } from '../utils/errors';

export type ReminderIssue = 'notifications' | 'exact' | 'failed' | null;

interface AppData {
  profile: UserProfile;
  settings: AppSettings;
  types: AssignmentType[];
  typesReady: boolean;
  /** the weeks around today, kept on the phone so sheets can be read offline */
  weeks: Week[];
  myAssignments: Assignment[];
  myLoading: boolean;
  /** this calendar month, e.g. "2026-10" */
  currentMonthKey: string;
  /** this person's report for currentMonthKey, or null if they haven't submitted it yet */
  myReport: MonthlyReport | null;
  myReportLoading: boolean;
  reminderIssue: ReminderIssue;
  /** Tries to fix a reminder problem (asks for permission / opens the right Android screen). */
  fixReminders: () => Promise<void>;
  /** changes every time "reload" is used, so screens can start their live lists again */
  reloadKey: number;
  /** Starts everything again (pull to refresh / Reload button). Works whenever there is internet. */
  reload: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

/** Everything a signed-in, approved person needs. Also keeps this phone's reminders up to date. */
export function AppDataProvider({ profile, children }: { profile: UserProfile; children: React.ReactNode }) {
  const [reloadKey, setReloadKey] = useState(0);
  const settingsLive = useLive<AppSettings>(subscribeToSettings, [reloadKey]);
  const typesLive = useLive<AssignmentType[]>(subscribeToTypes, [reloadKey]);
  const mine = useLive<Assignment[]>((ok, err) => subscribeToMyAssignments(profile.id, ok, err), [profile.id, reloadKey]);
  const currentMonthKey = monthKeyFor(new Date());
  const myReportLive = useLive<MonthlyReport | null>(
    (ok, err) => subscribeToMyReport(profile.id, currentMonthKey, ok, err),
    [profile.id, currentMonthKey, reloadKey],
  );
  const weeksLive = useLive<Week[]>(
    (ok, err) => {
      const thisWeek = weekIdFor(new Date());
      return subscribeToWeeks(shiftWeek(thisWeek, -2), shiftWeek(thisWeek, 26), ok, err);
    },
    [reloadKey],
  );

  const [issue, setIssue] = useState<ReminderIssue>(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  const settings = settingsLive.data ?? DEFAULT_SETTINGS;
  const myAssignments = useMemo(() => mine.data ?? [], [mine.data]);
  const { reminders, callStyle } = profile.notificationPreferences;
  const callStyleOn = settings.callStyleEnabled && callStyle;

  // Once per launch: channels, permission, push token, "last active".
  useEffect(() => {
    let stopPush: () => void = () => {};
    let cancelled = false;
    (async () => {
      try {
        await ensureChannels();
        await requestNotificationPermission();
        bump();
      } catch (e) {
        logError('notification setup', e);
      }
      touchLastActive(profile.id).catch(e => logError('lastActive', e));
      startBackgroundSync().catch(e => logError('background sync setup', e));
      try {
        const stop = await registerPush(profile.id, data => {
          handlePush(data).catch(e => logError('push', e));
        });
        if (cancelled) stop();
        else stopPush = stop;
      } catch (e) {
        logError('push registration (needs internet)', e); // retried next launch
      }
    })();
    return () => {
      cancelled = true;
      stopPush();
    };
  }, [profile.id, bump]);

  // Come back from Android settings -> check again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') bump();
    });
    return () => sub.remove();
  }, [bump]);

  // Keep local reminders in step with the assignments.
  useEffect(() => {
    if (mine.loading) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await syncLocalReminders(myAssignments, profile.id, { remindersEnabled: reminders, callStyle: callStyleOn });
        await announceNew(myAssignments, profile.id, reminders, callStyleOn);
        await syncCalendar(myAssignments, profile.id, settings);
        const cap = await getReminderCapability();
        if (cancelled) return;
        if (result.blocked === 'notifications') setIssue(reminders ? 'notifications' : null);
        else setIssue(reminders && !cap.exactAlarms ? 'exact' : null);
      } catch (e) {
        logError('reminder scheduling', e);
        if (!cancelled) setIssue('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myAssignments, mine.loading, profile.id, reminders, callStyleOn, tick, settings]);

  // "Time to send your report": loud, the same as a new assignment, and cancelled the moment
  // this month's report has actually been submitted.
  useEffect(() => {
    if (myReportLive.loading) return;
    syncReportReminder(reportReminderDates(currentMonthKey, new Date()), currentMonthKey, !!myReportLive.data, {
      remindersEnabled: reminders,
      callStyle: callStyleOn,
    }).catch(e => logError('report reminder scheduling', e));
  }, [myReportLive.data, myReportLive.loading, currentMonthKey, reminders, callStyleOn, tick]);

  const fixReminders = useCallback(async () => {
    try {
      if (issue === 'exact') await openExactAlarmSettings();
      else if (issue === 'notifications') {
        const ok = await requestNotificationPermission();
        if (!ok) await openNotificationSettings();
      }
    } finally {
      bump();
    }
  }, [issue, bump]);

  const reload = useCallback(async () => {
    setReloadKey(k => k + 1);
    bump();
    await new Promise<void>(resolve => setTimeout(resolve, 800));
  }, [bump]);

  const value = useMemo<AppData>(
    () => ({
      profile,
      settings,
      types: typesLive.data ?? [],
      typesReady: !typesLive.loading,
      weeks: weeksLive.data ?? [],
      myAssignments,
      myLoading: mine.loading,
      currentMonthKey,
      myReport: myReportLive.data ?? null,
      myReportLoading: myReportLive.loading,
      reminderIssue: issue,
      fixReminders,
      reloadKey,
      reload,
    }),
    [profile, settings, typesLive.data, typesLive.loading, weeksLive.data, myAssignments, mine.loading, currentMonthKey, myReportLive.data, myReportLive.loading, issue, fixReminders, reloadKey, reload],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}

/** For components that also appear outside the signed-in area (returns null there). */
export function useOptionalAppData(): AppData | null {
  return useContext(AppDataContext);
}
