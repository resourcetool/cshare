import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Heading, LoadingView, Notice, SwitchRow, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { saveDailyServiceEntry, subscribeToMyServiceEntries, subscribeToMyReport, submitReport } from '../../services/reportService';
import { space, radius } from '../../theme';
import { formatMonthLong, lastDayOfMonth, previousMonthKey, toDateKey } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { hourReferenceFor, REPORTING_TYPE_LABELS, reportsHours, summarizeReport } from '../../utils/reports';
import { FieldServiceEntry, MonthlyReport } from '../../types';
import { useLive } from '../../hooks/useLive';
import { useTheme } from '../../context/ThemeContext';

function localDateString(d: Date): string {
  return toDateKey(d);
}

function daysInMonth(monthKey: string): string[] {
  const last = lastDayOfMonth(monthKey);
  const days: string[] = [];
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(toDateKey(new Date(last.getFullYear(), last.getMonth(), day)));
  }
  return days;
}

function displayDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

function totals(entries: FieldServiceEntry[]) {
  return entries.reduce(
    (acc, e) => ({ hours: acc.hours + e.hours, bibleStudies: acc.bibleStudies + e.bibleStudies }),
    { hours: 0, bibleStudies: 0 },
  );
}

function groupEntries(entries: FieldServiceEntry[]): Record<string, FieldServiceEntry> {
  return entries.reduce<Record<string, FieldServiceEntry>>((acc, entry) => {
    const old = acc[entry.date];
    acc[entry.date] = old
      ? { ...old, hours: old.hours + entry.hours, bibleStudies: old.bibleStudies + entry.bibleStudies }
      : entry;
    return acc;
  }, {});
}

export default function MyReportScreen() {
  const navigation = useNavigation();
  const { palette } = useTheme();
  const { profile, settings, currentMonthKey, myReport, myReportLoading } = useAppData();
  const type = profile.reportingType;
  const needsHours = reportsHours(type);
  const reference = hourReferenceFor(type, settings);
  const today = new Date();
  const todayKey = localDateString(today);
  const previousKey = previousMonthKey(currentMonthKey);

  const previousReportLive = useLive<MonthlyReport | null>(
    (ok, err) => subscribeToMyReport(profile.id, previousKey, ok, err),
    [profile.id, previousKey],
  );

  const currentEntriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) => needsHours ? subscribeToMyServiceEntries(profile.id, currentMonthKey, ok, err) : () => {},
    [profile.id, currentMonthKey, needsHours],
  );
  const previousEntriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) => needsHours ? subscribeToMyServiceEntries(profile.id, previousKey, ok, err) : () => {},
    [profile.id, previousKey, needsHours],
  );

  const currentEntries = currentEntriesLive.data ?? [];
  const previousEntries = previousEntriesLive.data ?? [];

  // If the previous month contains unsent service data, keep that month on screen until it is submitted.
  // This prevents the new month from visually replacing data that still needs to be reported.
  const activeMonthKey = useMemo(() => {
    if (myReport) return currentMonthKey;
    if (needsHours && !previousReportLive.data && previousEntries.length > 0) return previousKey;
    return currentMonthKey;
  }, [myReport, currentMonthKey, needsHours, previousReportLive.data, previousEntries.length, previousKey]);

  const activeEntries = activeMonthKey === currentMonthKey ? currentEntries : previousEntries;
  const activeReport = activeMonthKey === currentMonthKey ? myReport : previousReportLive.data;
  const monthName = formatMonthLong(activeMonthKey);
  const rows = useMemo(() => daysInMonth(activeMonthKey), [activeMonthKey]);
  const byDate = useMemo(() => groupEntries(activeEntries), [activeEntries]);
  const total = useMemo(() => totals(activeEntries), [activeEntries]);
  const activeMonthIsCurrent = activeMonthKey === currentMonthKey;
  const canSubmit = !needsHours || !activeMonthIsCurrent || today.getDate() === lastDayOfMonth(currentMonthKey).getDate();

  const [hours, setHours] = useState('');
  const [studies, setStudies] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participated, setParticipated] = useState(false);

  if (myReportLoading || currentEntriesLive.loading || previousReportLive.loading || (needsHours && previousEntriesLive.loading)) {
    return <Screen><LoadingView /></Screen>;
  }

  if (activeReport) {
    return (
      <Screen>
        <Title>{monthName}</Title>
        <Body style={{ marginBottom: space.lg }}>Your report for this month has been sent in.</Body>
        <Card>
          <Badge label="Submitted" tone="good" />
          <Heading style={{ marginTop: space.sm }}>{REPORTING_TYPE_LABELS[activeReport.reportingType]}</Heading>
          <Body style={{ marginTop: space.xs }}>{summarizeReport(activeReport.reportingType, activeReport)}</Body>
        </Card>
        <Body>Need to change something? Ask an administrator — they can correct a report already sent in.</Body>
      </Screen>
    );
  }

  const todayEntry = byDate[todayKey];

  const saveToday = async () => {
    setError(null);
    const h = hours.trim() === '' ? (todayEntry?.hours ?? 0) : Number(hours);
    const s = studies.trim() === '' ? (todayEntry?.bibleStudies ?? 0) : Number(studies);
    if (!activeMonthIsCurrent) {
      setError('Finish and submit the previous month before entering a new month.');
      return;
    }
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      setError('Enter hours from 0 to 24.');
      return;
    }
    if (!Number.isFinite(s) || s < 0 || s > 50) {
      setError('Enter Bible studies from 0 to 50.');
      return;
    }
    setBusy(true);
    try {
      const result = await saveDailyServiceEntry(profile.id, {
        date: todayKey,
        monthKey: currentMonthKey,
        hours: h,
        bibleStudies: s,
      });
      setHours('');
      setStudies('');
      if (result === 'queued') setError('Saved on this phone. It will sync when you have internet.');
    } catch (e) {
      logError('save daily field service', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) {
      setError(`You can submit ${monthName} on the last day of the month.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitReport(
        profile.id,
        activeMonthKey,
        needsHours
          ? { reportingType: type, hours: total.hours, bibleStudies: total.bibleStudies }
          : { reportingType: type, participated },
        { groupId: profile.groupId, reporterName: profile.name },
      );
      if (result === 'queued') setError('Saved on this phone. It will be sent when you have internet.');
      else navigation.goBack();
    } catch (e) {
      logError('submit report', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Submit monthly report" onPress={submit} loading={busy} disabled={busy || !canSubmit} />}>
      <Title>{monthName}</Title>
      <Body style={{ marginBottom: space.md }}>Reporting as: {REPORTING_TYPE_LABELS[type]}</Body>
      {activeMonthIsCurrent && !canSubmit ? (
        <Notice tone="info" message={`Keep recording your daily activity. Submission opens on ${formatMonthLong(currentMonthKey)}'s last day.`} />
      ) : null}
      {!activeMonthIsCurrent ? (
        <Notice tone="warn" message="This previous month still has entries that have not been submitted. Submit it before a new month can be recorded." />
      ) : null}
      {error ? <Notice tone={error.startsWith('Saved') ? 'info' : 'bad'} message={error} /> : null}

      {needsHours ? (
        <>
          <Card style={{ marginBottom: space.lg }}>
            <Heading>Month total</Heading>
            <Body style={{ marginTop: space.xs }}>
              {total.hours} hour{total.hours === 1 ? '' : 's'} · {total.bibleStudies} Bible {total.bibleStudies === 1 ? 'study' : 'studies'}
            </Body>
            {reference ? <Body style={{ marginTop: space.xs }}>Reference: {reference} hours. This is a minimum, not a maximum.</Body> : null}
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', padding: space.md, backgroundColor: palette.surfaceAlt, borderBottomWidth: 1, borderBottomColor: palette.line }}>
              <Text style={{ flex: 1.3, fontWeight: '700', color: palette.ink }}>Date</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: palette.ink }}>Hours</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: palette.ink }}>Studies</Text>
            </View>

            {rows.map(dateKey => {
              const entry = byDate[dateKey];
              const isToday = dateKey === todayKey;
              const isFuture = activeMonthIsCurrent && dateKey > todayKey;
              const editable = isToday && !isFuture && activeMonthIsCurrent;
              return (
                <View key={dateKey} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: isToday ? palette.primarySoft : 'transparent' }}>
                  <View style={{ flex: 1.3 }}>
                    <Text style={{ fontWeight: isToday ? '800' : '500', color: isFuture ? palette.muted : palette.ink }}>{displayDay(dateKey)}</Text>
                    {isToday ? <Badge label="TODAY" tone="info" /> : null}
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    {editable ? (
                      <TextInput value={hours} onChangeText={setHours} placeholder={entry ? String(entry.hours) : '0'} placeholderTextColor={palette.placeholder} keyboardType="decimal-pad" style={{ width: 64, minHeight: 46, borderWidth: 1.5, borderColor: palette.primary, borderRadius: radius.md, textAlign: 'center', color: palette.ink, backgroundColor: palette.surface, fontSize: 17 }} />
                    ) : <Text style={{ color: isFuture ? palette.muted : palette.ink, fontSize: 17 }}>{entry?.hours ?? '—'}</Text>}
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    {editable ? (
                      <TextInput value={studies} onChangeText={setStudies} placeholder={entry ? String(entry.bibleStudies) : '0'} placeholderTextColor={palette.placeholder} keyboardType="number-pad" style={{ width: 64, minHeight: 46, borderWidth: 1.5, borderColor: palette.primary, borderRadius: radius.md, textAlign: 'center', color: palette.ink, backgroundColor: palette.surface, fontSize: 17 }} />
                    ) : <Text style={{ color: isFuture ? palette.muted : palette.ink, fontSize: 17 }}>{entry?.bibleStudies ?? '—'}</Text>}
                  </View>
                </View>
              );
            })}
          </Card>

          {activeMonthIsCurrent ? (
            <Button label="Save today's entry" onPress={saveToday} loading={busy} disabled={busy} />
          ) : null}
        </>
      ) : (
        <Card>
          <SwitchRow label="I had a part in the ministry" value={participated} onValueChange={setParticipated} disabled={!canSubmit || busy} />
        </Card>
      )}
    </Screen>
  );
}
