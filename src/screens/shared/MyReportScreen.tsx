import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import {
  Badge,
  Body,
  Button,
  Card,
  Heading,
  LoadingView,
  Notice,
  Small,
  SwitchRow,
  Title,
} from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import {
  saveDailyServiceEntry,
  subscribeToMyServiceEntries,
  subscribeToMyReport,
  submitReport,
  updateMyReport,
} from '../../services/reportService';
import { space, radius } from '../../theme';
import {
  formatMonthLong,
  lastDayOfMonth,
  previousMonthKey,
  toDateKey,
} from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import {
  hourReferenceFor,
  REPORTING_TYPE_LABELS,
  reportsHours,
  summarizeReport,
} from '../../utils/reports';
import { FieldServiceEntry, MonthlyReport, MonthlyReportInput } from '../../types';
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

function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(8, 10)));
}

function weekdayOffset(monthKey: string): number {
  const d = lastDayOfMonth(monthKey);
  return new Date(d.getFullYear(), d.getMonth(), 1).getDay();
}

function totals(entries: FieldServiceEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      hours: acc.hours + e.hours,
      bibleStudies: acc.bibleStudies + e.bibleStudies,
    }),
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

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    (ok, err) =>
      needsHours
        ? subscribeToMyServiceEntries(profile.id, currentMonthKey, ok, err)
        : (() => {
            ok([]);
            return () => {};
          })(),
    [profile.id, currentMonthKey, needsHours],
  );

  const previousEntriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) =>
      needsHours
        ? subscribeToMyServiceEntries(profile.id, previousKey, ok, err)
        : (() => {
            ok([]);
            return () => {};
          })(),
    [profile.id, previousKey, needsHours],
  );

  const currentEntries = currentEntriesLive.data ?? [];
  const previousEntries = previousEntriesLive.data ?? [];

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
  const canSubmit =
    !needsHours ||
    !activeMonthIsCurrent ||
    today.getDate() === lastDayOfMonth(currentMonthKey).getDate();

  const [hours, setHours] = useState('');
  const [studies, setStudies] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSubmitted, setEditingSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participated, setParticipated] = useState(false);

  useEffect(() => {
    if (!activeReport) {
      setParticipated(false);
      return;
    }
    setParticipated(activeReport.participated === true);
    setStudies(
      activeReport.bibleStudies !== undefined ? String(activeReport.bibleStudies) : '',
    );
  }, [activeReport?.id, activeReport?.updatedAt?.getTime(), activeReport?.participated, activeReport?.bibleStudies]);

  if (
    myReportLoading ||
    currentEntriesLive.loading ||
    previousReportLive.loading ||
    (needsHours && previousEntriesLive.loading)
  ) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  const beginEditDay = (dateKey: string) => {
    const entry = byDate[dateKey];
    setEditingDate(dateKey);
    setHours(entry ? String(entry.hours) : '');
    setStudies(entry ? String(entry.bibleStudies) : '');
    setError(null);
  };

  const cancelDayEdit = () => {
    setEditingDate(null);
    setHours('');
    setStudies('');
    setError(null);
  };

  const saveEntry = async (dateKey: string) => {
    setError(null);

    const existing = byDate[dateKey];
    const h = hours.trim() === '' ? existing?.hours ?? 0 : Number(hours);
    const st = studies.trim() === '' ? existing?.bibleStudies ?? 0 : Number(studies);
    const isFuture = activeMonthIsCurrent && dateKey > todayKey;

    if (isFuture) {
      setError('Future dates cannot be entered.');
      return;
    }
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      setError('Enter hours from 0 to 24.');
      return;
    }
    if (!Number.isFinite(st) || st < 0 || st > 50) {
      setError('Enter Bible studies from 0 to 50.');
      return;
    }

    setBusy(true);
    try {
      const result = await saveDailyServiceEntry(profile.id, {
        date: dateKey,
        monthKey: activeMonthKey,
        hours: h,
        bibleStudies: st,
      });

      /*
       * If the monthly report was already submitted, correcting a calendar
       * day also corrects the submitted total. Both writes are offline-safe.
       */
      if (activeReport) {
        const old = existing ?? { hours: 0, bibleStudies: 0 };
        const nextHours = total.hours - old.hours + h;
        const nextStudies = total.bibleStudies - old.bibleStudies + st;

        const reportResult = await updateMyReport(profile.id, activeMonthKey, {
          hours: nextHours,
          bibleStudies: nextStudies,
        });

        if (result === 'queued' || reportResult === 'queued') {
          setError('Saved on this phone. The correction will sync when you have internet.');
        }
      } else if (result === 'queued') {
        setError('Saved on this phone. It will sync when you have internet.');
      }

      cancelDayEdit();
    } catch (e) {
      logError('save field service entry', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    setError(null);

    if (!activeReport && !canSubmit) {
      setError(`You can submit ${monthName} on the last day of the month.`);
      return;
    }

    if (!needsHours && participated) {
      if (studies.trim() === '') {
        setError('Enter the number of Bible studies before saving the report.');
        return;
      }

      const studyCount = Number(studies);
      if (!Number.isInteger(studyCount) || studyCount < 0 || studyCount > 200) {
        setError('Enter Bible studies from 0 to 200.');
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      const input: MonthlyReportInput = needsHours
        ? {
            reportingType: type,
            hours: total.hours,
            bibleStudies: total.bibleStudies,
          }
        : {
            reportingType: type,
            participated,
            ...(participated ? { bibleStudies: Number(studies) } : {}),
          };

      const result = activeReport
        ? await updateMyReport(profile.id, activeMonthKey, {
            participated: input.participated,
            hours: input.hours,
            bibleStudies: input.bibleStudies,
          })
        : await submitReport(
            profile.id,
            activeMonthKey,
            input,
            {
              groupId: profile.groupId,
              reporterName: profile.name,
            },
          );

      setEditingSubmitted(false);

      if (result === 'queued') {
        setError(
          activeReport
            ? 'Correction saved on this phone. It will sync when you have internet.'
            : 'Saved on this phone. It will be sent when you have internet.',
        );
      }
    } catch (e) {
      logError('save monthly report', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submittedView = !!activeReport && !editingSubmitted;

  return (
    <Screen
      footer={
        submittedView ? undefined : (
          <Button
            label={activeReport ? 'Save report changes' : 'Submit monthly report'}
            onPress={saveReport}
            loading={busy}
            disabled={busy || (!activeReport && !canSubmit)}
          />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Title>{monthName}</Title>
          <Body>Reporting as: {REPORTING_TYPE_LABELS[type]}</Body>
        </View>
        {activeReport ? <Badge label="Submitted" tone="good" /> : null}
      </View>

      {activeMonthIsCurrent && !activeReport && !canSubmit ? (
        <Notice
          tone="info"
          message={`Keep recording your daily activity. Monthly submission opens on the last day of ${monthName}.`}
        />
      ) : null}

      {!activeMonthIsCurrent ? (
        <Notice
          tone="warn"
          message="This previous month still has entries that have not been submitted. Finish this report before recording a new month."
        />
      ) : null}

      {error ? (
        <Notice
          tone={error.startsWith('Saved') || error.startsWith('Correction') ? 'info' : 'bad'}
          message={error}
        />
      ) : null}

      {submittedView ? (
        <>
          <Card style={{ marginBottom: space.md }}>
            <Heading>{REPORTING_TYPE_LABELS[activeReport.reportingType]}</Heading>
            <Body style={{ marginTop: space.xs }}>
              {summarizeReport(activeReport.reportingType, activeReport)}
            </Body>
          </Card>

          <Notice
            tone="info"
            message="Made a mistake? You can correct your submitted report yourself. Your group overseer will receive the updated report."
          />

          <Button
            label={needsHours ? 'Edit calendar & report' : 'Edit submitted report'}
            variant="secondary"
            onPress={() => setEditingSubmitted(true)}
            disabled={busy}
            style={{ marginTop: space.md }}
          />

          {needsHours ? (
            <Body style={{ marginTop: space.md }}>
              You can also tap any completed day below to correct its hours or Bible studies.
            </Body>
          ) : null}
        </>
      ) : null}

      {needsHours && (!activeReport || editingSubmitted) ? (
        <>
          <Card style={{ marginTop: space.lg, marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Small>MONTH TOTAL</Small>
                <Heading style={{ marginTop: 2 }}>
                  {total.hours}h · {total.bibleStudies} studies
                </Heading>
              </View>
              {reference ? (
                <Badge label={`${reference}h reference`} tone="info" />
              ) : null}
            </View>
          </Card>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: space.xs,
            }}
          >
            {weekdays.map(day => (
              <Text
                key={day}
                style={{
                  width: '14.28%',
                  textAlign: 'center',
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: weekdayOffset(activeMonthKey) }).map((_, index) => (
              <View key={`blank-${index}`} style={{ width: '14.28%', aspectRatio: 0.82 }} />
            ))}

            {rows.map(dateKey => {
              const entry = byDate[dateKey];
              const isToday = dateKey === todayKey && activeMonthIsCurrent;
              const isFuture = activeMonthIsCurrent && dateKey > todayKey;
              const selected = editingDate === dateKey;

              return (
                <Pressable
                  key={dateKey}
                  onPress={() => !isFuture && beginEditDay(dateKey)}
                  disabled={isFuture || busy}
                  style={{
                    width: '14.28%',
                    minHeight: 76,
                    padding: 3,
                    opacity: isFuture ? 0.4 : 1,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderWidth: selected || isToday ? 2 : 1,
                      borderColor: selected
                        ? palette.primary
                        : isToday
                          ? palette.info
                          : palette.line,
                      borderRadius: radius.md,
                      backgroundColor: entry
                        ? palette.primarySoft
                        : palette.surface,
                      padding: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.ink,
                        fontWeight: isToday ? '800' : '600',
                        fontSize: 13,
                      }}
                    >
                      {dayNumber(dateKey)}
                    </Text>

                    {entry ? (
                      <>
                        <Text
                          style={{
                            color: palette.primary,
                            fontWeight: '800',
                            fontSize: 13,
                            marginTop: 5,
                          }}
                        >
                          {entry.hours}h
                        </Text>
                        <Text style={{ color: palette.muted, fontSize: 10 }}>
                          {entry.bibleStudies} {entry.bibleStudies === 1 ? 'study' : 'studies'}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: palette.muted, fontSize: 10, marginTop: 6 }}>
                        {isFuture ? '—' : 'Tap'}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {editingDate ? (
            <Card style={{ marginTop: space.md }}>
              <Heading>{displayDay(editingDate)}</Heading>

              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <View style={{ flex: 1, marginRight: space.sm }}>
                  <Small>Hours</Small>
                  <TextInput
                    value={hours}
                    onChangeText={setHours}
                    placeholder="0"
                    placeholderTextColor={palette.placeholder}
                    keyboardType="decimal-pad"
                    style={{
                      minHeight: 48,
                      borderWidth: 1.5,
                      borderColor: palette.primary,
                      borderRadius: radius.md,
                      marginTop: space.xs,
                      textAlign: 'center',
                      color: palette.ink,
                      backgroundColor: palette.surface,
                      fontSize: 17,
                    }}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: space.sm }}>
                  <Small>Bible studies</Small>
                  <TextInput
                    value={studies}
                    onChangeText={setStudies}
                    placeholder="0"
                    placeholderTextColor={palette.placeholder}
                    keyboardType="number-pad"
                    style={{
                      minHeight: 48,
                      borderWidth: 1.5,
                      borderColor: palette.primary,
                      borderRadius: radius.md,
                      marginTop: space.xs,
                      textAlign: 'center',
                      color: palette.ink,
                      backgroundColor: palette.surface,
                      fontSize: 17,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <Button
                  label="Save day"
                  onPress={() => saveEntry(editingDate)}
                  loading={busy}
                  disabled={busy}
                  style={{ flex: 1, marginRight: space.xs }}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={cancelDayEdit}
                  disabled={busy}
                  style={{ flex: 1, marginLeft: space.xs }}
                />
              </View>
            </Card>
          ) : null}

          <Small style={{ marginTop: space.md }}>
            Tap a day to enter or correct activity. Entries are saved locally first and automatically sync to Firebase when internet returns.
          </Small>
        </>
      ) : null}

      {!needsHours && (!activeReport || editingSubmitted) ? (
        <Card style={{ marginTop: space.lg }}>
          <SwitchRow
            label="I had a part in the ministry"
            value={participated}
            onValueChange={value => {
              setParticipated(value);
              if (!value) setStudies('');
            }}
            disabled={busy || (!activeReport && !canSubmit)}
          />

          {participated ? (
            <View style={{ marginTop: space.md }}>
              <Body style={{ marginBottom: space.xs }}>Bible studies</Body>
              <TextInput
                value={studies}
                onChangeText={setStudies}
                placeholder="Enter number"
                placeholderTextColor={palette.placeholder}
                keyboardType="number-pad"
                editable={!busy && (canSubmit || !!activeReport)}
                style={{
                  minHeight: 48,
                  borderWidth: 1.5,
                  borderColor: palette.primary,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  color: palette.ink,
                  backgroundColor: palette.surface,
                  fontSize: 16,
                }}
              />
              <Body style={{ marginTop: space.xs }}>
                Enter 0 if you did not conduct any Bible studies.
              </Body>
            </View>
          ) : null}
        </Card>
      ) : null}

      {activeReport && editingSubmitted ? (
        <Button
          label="Cancel editing"
          variant="secondary"
          onPress={() => {
            setEditingSubmitted(false);
            setError(null);
          }}
          disabled={busy}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </Screen>
  );
}
