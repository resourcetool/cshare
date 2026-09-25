import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { AppearanceMode, useTheme } from '../context/ThemeContext';
import { updateMyProfile } from '../services/userService';
import {
  CalendarPrefs,
  clearCalendar,
  DeviceCalendar,
  getCalendarPrefs,
  hasCalendarPermission,
  listCalendars,
  requestCalendarPermission,
  setCalendarPrefs,
  syncCalendar,
} from '../services/calendarService';
import {
  getReminderCapability,
  openExactAlarmSettings,
  openNotificationSettings,
  ReminderCapability,
  requestNotificationPermission,
  scheduleTestReminder,
} from '../services/notificationService';
import { friendlyError, logError } from '../utils/errors';
import { space } from '../theme';
import { Body, Button, Card, Chip, ChipRow, Heading, Label, Notice, Small, SwitchRow, TextField } from './ui';

const APPEARANCE_OPTIONS: { mode: AppearanceMode; label: string }[] = [
  { mode: 'system', label: 'System default' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export function AppearanceSettings() {
  const { mode, setMode } = useTheme();
  return (
    <View>
      <ChipRow>
        {APPEARANCE_OPTIONS.map(o => (
          <Chip key={o.mode} label={o.label} selected={mode === o.mode} onPress={() => setMode(o.mode)} />
        ))}
      </ChipRow>
      <Small>"System default" follows your phone's own light/dark setting.</Small>
    </View>
  );
}

export function ProfileForm() {
  const { profile } = useAppData();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = name.trim() !== profile.name || phone.trim() !== profile.phone;

  const save = async () => {
    if (!name.trim()) return setMessage('Please enter your name.');
    setSaving(true);
    setMessage(null);
    try {
      const r = await updateMyProfile(profile.id, { name: name.trim(), phone: phone.trim() });
      setMessage(r === 'queued' ? 'Saved on this phone. It will be sent when you have internet.' : 'Saved.');
    } catch (e) {
      logError('save profile', e);
      setMessage(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <TextField label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <TextField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" hint="Administrators use this to reach you." />
      <TextField label="Email" value={profile.email} onChangeText={() => {}} editable={false} />
      {message ? <Notice tone="info" message={message} /> : null}
      <Button label="Save my details" onPress={save} loading={saving} disabled={!dirty} />
    </View>
  );
}

export function NotificationSettings() {
  const { profile, settings } = useAppData();
  const prefs = profile.notificationPreferences;
  const [cap, setCap] = useState<ReminderCapability | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getReminderCapability().then(setCap).catch(e => logError('capability', e));
  }, []);
  useEffect(refresh, [refresh]);

  const setPref = (patch: Partial<typeof prefs>) => {
    updateMyProfile(profile.id, { notificationPreferences: { ...prefs, ...patch } }).catch(e => setNote(friendlyError(e)));
  };

  const test = async (callStyle: boolean) => {
    try {
      if (!(await requestNotificationPermission())) {
        setNote('Notifications are turned off for CSHARE. Please turn them on first.');
        return openNotificationSettings();
      }
      await scheduleTestReminder(callStyle);
      setNote('A test reminder will appear in about 8 seconds. You can lock the screen to see how it looks.');
    } catch (e) {
      logError('test reminder', e);
      setNote('The test reminder could not be scheduled on this phone.');
    }
  };

  return (
    <View>
      <SwitchRow label="Assignment reminders" description="Reminders on this phone before each assignment. They work without internet." value={prefs.reminders} onValueChange={v => setPref({ reminders: v })} />
      <SwitchRow
        label="Loud final reminder"
        description={settings.callStyleEnabled ? 'The last reminder looks like an incoming call and rings.' : 'Your administrators have turned this off.'}
        value={prefs.callStyle && settings.callStyleEnabled}
        onValueChange={v => setPref({ callStyle: v })}
        disabled={!prefs.reminders || !settings.callStyleEnabled}
      />
      {cap && !cap.notifications ? (
        <Notice tone="warn" message="Notifications are turned off, so reminders cannot appear." actionLabel="Turn on notifications" onAction={() => requestNotificationPermission().then(ok => (ok ? refresh() : openNotificationSettings()))} />
      ) : null}
      {cap && cap.notifications && !cap.exactAlarms ? (
        <Notice tone="warn" message="Android may deliver reminders a little late. Allow “Alarms & reminders” for CSHARE so they arrive on time." actionLabel="Open Android setting" onAction={() => openExactAlarmSettings()} />
      ) : null}
      {note ? <Notice tone="info" message={note} /> : null}
      <View style={{ gap: space.sm }}>
        <Button label="Send me a test reminder" variant="secondary" onPress={() => test(false)} />
        <Button label="Try the loud final reminder" variant="secondary" onPress={() => test(true)} />
      </View>
      <Small style={{ marginTop: space.md }}>
        Some phones stop apps from running in the background to save battery. If reminders do not arrive, allow CSHARE to run without battery restrictions in your phone’s settings.
      </Small>
    </View>
  );
}

/** Adds the person's assignments to the phone calendar (Google Calendar syncs it), with the calendar's own alerts. */
export function CalendarSettings() {
  const { profile, settings, myAssignments } = useAppData();
  const [prefs, setPrefs] = useState<CalendarPrefs>({ enabled: false, alerts: true });
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [note, setNote] = useState<{ tone: 'good' | 'info' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getCalendarPrefs();
      setPrefs(p);
      if (p.enabled && (await hasCalendarPermission())) setCalendars(await listCalendars());
    })().catch(e => logError('calendar settings', e));
  }, []);

  const save = async (p: CalendarPrefs) => {
    setPrefs(p);
    await setCalendarPrefs(p);
  };

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (!(await requestCalendarPermission())) {
        setNote({ tone: 'bad', text: 'Calendar access was not allowed. You can allow it in your phone’s settings for CSHARE.' });
        return;
      }
      const list = await listCalendars();
      setCalendars(list);
      if (list.length === 0) {
        setNote({ tone: 'bad', text: 'No calendar was found on this phone. Open the Google Calendar app once and sign in, then try again.' });
        return;
      }
      const pick = list.find(c => c.account.includes('@')) ?? list[0];
      await save({ ...prefs, enabled: true, calendarId: pick.id });
      await syncCalendar(myAssignments, profile.id, settings);
      setNote({ tone: 'good', text: `Done. Your assignments are now in “${pick.name}”.` });
    } catch (e) {
      logError('calendar on', e);
      setNote({ tone: 'bad', text: 'The calendar could not be set up on this phone.' });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await clearCalendar(profile.id);
      await save({ ...prefs, enabled: false });
      setNote({ tone: 'info', text: 'CSHARE events were removed from your calendar.' });
    } finally {
      setBusy(false);
    }
  };

  const choose = async (id: number) => {
    setBusy(true);
    try {
      await clearCalendar(profile.id); // move everything to the new calendar
      await save({ ...prefs, calendarId: id });
      await syncCalendar(myAssignments, profile.id, settings);
    } finally {
      setBusy(false);
    }
  };

  const setAlerts = async (alerts: boolean) => {
    await save({ ...prefs, alerts });
    await syncCalendar(myAssignments, profile.id, settings);
  };

  return (
    <View>
      <SwitchRow
        label="Add my assignments to my phone calendar"
        description="Each part appears as an event, works offline, and shows in Google Calendar if your Google account is on this phone."
        value={prefs.enabled}
        onValueChange={v => (v ? turnOn() : turnOff())}
        disabled={busy}
      />
      {note ? <Notice tone={note.tone} message={note.text} /> : null}
      {prefs.enabled ? (
        <>
          {calendars.length > 1 ? (
            <View style={{ marginBottom: space.md }}>
              <Label style={{ marginBottom: space.sm }}>Which calendar?</Label>
              <ChipRow>
                {calendars.map(c => (
                  <Chip key={c.id} label={c.account && c.account !== c.name ? `${c.name} (${c.account})` : c.name} selected={prefs.calendarId === c.id} onPress={() => choose(c.id)} />
                ))}
              </ChipRow>
            </View>
          ) : null}
          <SwitchRow label="Let the calendar remind me too" description="The calendar app shows its own alerts before each part, like Outlook does." value={prefs.alerts} onValueChange={setAlerts} disabled={busy} />
          <Button label="Update the calendar now" variant="secondary" onPress={() => syncCalendar(myAssignments, profile.id, settings).then(() => setNote({ tone: 'good', text: 'Calendar updated.' }))} loading={busy} />
        </>
      ) : null}
      <Small style={{ marginTop: space.md }}>If both CSHARE and the calendar remind you, you will get two alerts. Switch one off if you prefer.</Small>
    </View>
  );
}

export function AccountSection() {
  const { signOut } = useAuth();
  const { profile } = useAppData();
  const confirm = () =>
    Alert.alert('Sign out?', 'You will need internet to sign in again. Your reminders on this phone will be removed.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut().catch(e => Alert.alert('Could not sign out', friendlyError(e))) },
    ]);
  return (
    <Card>
      <Heading>Account</Heading>
      <Body style={{ marginVertical: space.sm }}>Signed in as {profile.email}</Body>
      <Button label="Sign out" variant="secondary" onPress={confirm} />
    </Card>
  );
}
