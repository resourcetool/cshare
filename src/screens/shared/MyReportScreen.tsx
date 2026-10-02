import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Chip, Heading, LoadingView, Notice, SwitchRow, Title } from '../../components/ui';
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

function monthOptions(currentMonthKey: string, count = 24): string[] {
  const months: string[] = [];
  let key = currentMonthKey;
  for (let i = 0; i < count; i += 1) {
    months.push(key);
    key = previousMonthKey(key);
  }
  return months;
}

function MonthFilter({
  value,
  onChange,
  currentMonthKey,
}: {
  value: string;
  onChange: (monthKey: string) => void;
  currentMonthKey: string;
}) {
  const months = useMemo(() => monthOptions(currentMonthKey), [currentMonthKey]);

  return (
    <View style={{ marginBottom: space.md }}>
      <Body style={{ marginBottom: space.xs }}>Report month</Body>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.xs, paddingRight: space.md }}
      >
        {months.map(monthKey => (
          <Chip
            key={monthKey}
            label={monthKey === currentMonthKey ? `${formatMonthLong(monthKey)} · Current` : formatMonthLong(monthKey)}
            selected={value === monthKey}
            onPress={() => onChange(monthKey)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function MyReportScreen() {
  const navigation = useNavigation();
  const { palette } = useTheme();
  const { profile, settings, currentMonthKey, myReportLoading } = useAppData();
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

  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [autoSelectedPrevious, setAutoSelectedPrevious] = useState(false);

  // If a member reaches a new month without sending the previous month's report,
  // keep the previous report on screen so it cannot silently disappear.
  useEffect(() => {
    if (!previousReportLive.loading && !previousReportLive.data && !autoSelectedPrevious) {
      setSelectedMonthKey(previousKey);
      setAutoSelectedPrevious(true);
    }
  }, [previousReportLive.loading, previousReportLive.data, previousKey, autoSelectedPrevious]);

  const selectedReportLive = useLive<MonthlyReport | null>(
    (ok, err) => subscribeToMyReport(profile.id, selectedMonthKey, ok, err),
    [profile.id, selectedMonthKey],
  );

  // Daily entries are used only for the current month's pioneer workflow.
  // For a past month, pioneers enter remembered totals directly instead of recreating
  // the daily record day by day.
  const selectedEntriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) => needsHours
      ? subscribeToMyServiceEntries(profile.id, selectedMonthKey, ok, err)
      : (() => { ok([]); return () => {}; })(),
    [profile.id, selectedMonthKey, needsHours],
  );

  const selectedEntries = selectedEntriesLive.data ?? [];
  const selectedReport = selectedReportLive.data;
  const selectedMonthIsCurrent = selectedMonthKey === currentMonthKey;
  const selectedMonthName = formatMonthLong(selectedMonthKey);
  const rows = useMemo(() => daysInMonth(selectedMonthKey), [selectedMonthKey]);
  const byDate = useMemo(() => groupEntries(selectedEntries), [selectedEntries]);
  const calculatedTotal = useMemo(() => totals(selectedEntries), [selectedEntries]);

  const [hours, setHours] = useState('');
  const [studies, setStudies] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participated, setParticipated] = useState(false);

  const [pastHours, setPastHours] = useState('');
  const [pastStudies, setPastStudies] = useState('');

  // Keep totals inputs aligned with the selected month's saved data.
  useEffect(() => {
    if (selectedReport) {
      setPastHours(selectedReport.hours !== undefined ? String(selectedReport.hours) : '');
      setPastStudies(selectedReport.bibleStudies !== undefined ? String(selectedReport.bibleStudies) : '');
      setParticipated(selectedReport.participated === true);
      return;
    }

    if (needsHours) {
      setPastHours(String(calculatedTotal.hours));
      setPastStudies(String(calculatedTotal.bibleStudies));
    } else {
      setPastHours('');
      setPastStudies('');
      setParticipated(false);
    }
    setError(null);
  }, [selectedReport, calculatedTotal.hours, calculatedTotal.bibleStudies, needsHours, selectedMonthKey]);

  const loading =
    myReportLoading ||
    previousReportLive.loading ||
    selectedReportLive.loading ||
    selectedEntriesLive.loading;

  if (loading) {
    return <Screen><LoadingView /></Screen>;
  }

  const hasUnsentPreviousMonth = selectedMonthKey === previousKey && !previousReportLive.data;
  const pastMonth = !selectedMonthIsCurrent;
  const canSubmit = !selectedMonthIsCurrent || !needsHours || today.getDate() === lastDayOfMonth(currentMonthKey).getDate();

  const beginEdit = (dateKey: string) => {
    const entry = byDate[dateKey];
    setEditingDate(dateKey);
    setHours(entry ? String(entry.hours) : '');
    setStudies(entry ? String(entry.bibleStudies) : '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingDate(null);
    setHours('');
    setStudies('');
    setError(null);
  };

  const saveEntry = async (dateKey: string) => {
    setError(null);
    const existing = byDate[dateKey];
    const h = hours.trim() === '' ? (existing?.hours ?? 0) : Number(hours);
    const st = studies.trim() === '' ? (existing?.bibleStudies ?? 0) : Number(studies);
    const isFuture = selectedMonthIsCurrent && dateKey > todayKey;

    if (!selectedMonthIsCurrent) {
      setError('Past months use totals only. Enter the remembered monthly total below.');
      return;
    }

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
        monthKey: selectedMonthKey,
        hours: h,
        bibleStudies: st,
      });

      const wasQueued = result === 'queued';
      cancelEdit();

      if (wasQueued) setError('Saved on this phone. It will sync when you have internet.');
    } catch (e) {
      logError('save field service entry', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveToday = () => saveEntry(todayKey);

  const showHelp = () => {
    const roleTitle = REPORTING_TYPE_LABELS[type];
    const roleInstructions = needsHours
      ? 'For the current month, record your activity by day. Your monthly hours and Bible studies are calculated from those entries. If you reach a past month without a report, enter the total hours and Bible studies you remember; you do not need to recreate each day.'
      : 'For your report, indicate whether you had a part in the ministry and enter your Bible studies when applicable. If you need to complete a past month, use the totals-only form; you do not need to recreate daily activity.';

    Alert.alert(
      `${roleTitle} — Monthly Report`,
      `${roleInstructions}\n\nUse Report month to look at another month. A report that has already been submitted is shown as read-only. If a submitted report needs correction, ask an administrator.\n\nIf you missed the previous month, CSHARE keeps that report available so you can complete it before continuing normally.`,
    );
  };

  const submit = async () => {
    if (!canSubmit) {
      setError(`You can submit ${selectedMonthName} on the last day of the month.`);
      return;
    }

    let input;

    if (needsHours) {
      const sourceHours = selectedMonthIsCurrent ? calculatedTotal.hours : Number(pastHours);
      const sourceStudies = selectedMonthIsCurrent ? calculatedTotal.bibleStudies : Number(pastStudies);

      if (!Number.isFinite(sourceHours) || sourceHours < 0 || sourceHours > 750) {
        setError('Enter total hours from 0 to 750.');
        return;
      }

      if (!Number.isInteger(sourceStudies) || sourceStudies < 0 || sourceStudies > 200) {
        setError('Enter total Bible studies from 0 to 200.');
        return;
      }

      input = {
        reportingType: type,
        hours: sourceHours,
        bibleStudies: sourceStudies,
      } as const;
    } else {
      if (participated && pastStudies.trim() === '') {
        setError('Enter the number of Bible studies before submitting.');
        return;
      }

      const studyCount = participated ? Number(pastStudies) : 0;
      if (!Number.isInteger(studyCount) || studyCount < 0 || studyCount > 200) {
        setError('Enter Bible studies from 0 to 200.');
        return;
      }

      input = {
        reportingType: type,
        participated,
        ...(participated ? { bibleStudies: studyCount } : {}),
      } as const;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await submitReport(
        profile.id,
        selectedMonthKey,
        input,
        {
          groupId: profile.groupId,
          reporterName: profile.name,
        },
      );

      if (result === 'queued') {
        setError('Saved on this phone. It will be sent when you have internet.');
      } else {
        // If the member just completed the overdue month, move them to the current month.
        if (selectedMonthKey === previousKey && !previousReportLive.data) {
          setSelectedMonthKey(currentMonthKey);
          setAutoSelectedPrevious(true);
        }
      }
    } catch (e) {
      logError('submit report', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Submit monthly report" onPress={submit} loading={busy} disabled={busy || !canSubmit || !!selectedReport} />}>
      <Title>{selectedMonthName}</Title>

      <Body style={{ marginBottom: space.md }}>
        Reporting as: {REPORTING_TYPE_LABELS[type]}
      </Body>

      <MonthFilter
        value={selectedMonthKey}
        onChange={(monthKey) => {
          if (busy) return;
          setSelectedMonthKey(monthKey);
          setEditingDate(null);
          setError(null);
        }}
        currentMonthKey={currentMonthKey}
      />

      <Button
        label="How to use this report"
        variant="secondary"
        onPress={showHelp}
        disabled={busy}
        style={{ marginBottom: space.md }}
      />

      {selectedMonthIsCurrent && !canSubmit ? (
        <Notice
          tone="info"
          message={`Keep recording your daily activity. Submission opens on ${formatMonthLong(currentMonthKey)}'s last day.`}
        />
      ) : null}

      {pastMonth && !selectedReport ? (
        <Notice
          tone={hasUnsentPreviousMonth ? 'warn' : 'info'}
          message={
            hasUnsentPreviousMonth
              ? `Your ${selectedMonthName} report has not been sent yet. Complete it now before continuing with the new month.`
              : `This is a past month. You can complete or review the report using monthly totals only.`
          }
        />
      ) : null}

      {selectedReport ? (
        <>
          <Card>
            <Badge label="Submitted" tone="good" />
            <Heading style={{ marginTop: space.sm }}>{REPORTING_TYPE_LABELS[selectedReport.reportingType]}</Heading>
            <Body style={{ marginTop: space.xs }}>{summarizeReport(selectedReport.reportingType, selectedReport)}</Body>
          </Card>
          <Body>
            This report has already been sent. Members cannot overwrite a submitted report; ask an administrator if a correction is needed.
          </Body>
        </>
      ) : null}

      {error ? (
        <Notice tone={error.startsWith('Saved') ? 'info' : 'bad'} message={error} />
      ) : null}

      {!selectedReport && needsHours && pastMonth ? (
        <Card>
          <Heading>Past month totals</Heading>
          <Body style={{ marginTop: space.xs }}>
            Enter the totals you remember for {selectedMonthName}. You do not need to recreate each day's activity.
          </Body>

          <Body style={{ marginTop: space.md, marginBottom: space.xs }}>Total hours</Body>
          <TextInput
            value={pastHours}
            onChangeText={setPastHours}
            placeholder="Total hours"
            placeholderTextColor={palette.placeholder}
            keyboardType="decimal-pad"
            editable={!busy}
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

          <Body style={{ marginTop: space.md, marginBottom: space.xs }}>Bible studies</Body>
          <TextInput
            value={pastStudies}
            onChangeText={setPastStudies}
            placeholder="Bible studies"
            placeholderTextColor={palette.placeholder}
            keyboardType="number-pad"
            editable={!busy}
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

          {reference ? (
            <Body style={{ marginTop: space.xs }}>
              Reference: {reference} hours. This is a minimum, not a maximum.
            </Body>
          ) : null}
        </Card>
      ) : null}

      {!selectedReport && !needsHours && pastMonth ? (
        <Card>
          <Heading>Past month report</Heading>
          <Body style={{ marginTop: space.xs }}>
            Record what applied to {selectedMonthName}. You do not need to recreate daily entries.
          </Body>

          <SwitchRow
            label="I had a part in the ministry"
            value={participated}
            onValueChange={(value) => {
              setParticipated(value);
              if (!value) setPastStudies('');
            }}
            disabled={busy}
          />

          {participated ? (
            <View style={{ marginTop: space.md }}>
              <Body style={{ marginBottom: space.xs }}>Bible studies</Body>
              <TextInput
                value={pastStudies}
                onChangeText={setPastStudies}
                placeholder="Enter number"
                placeholderTextColor={palette.placeholder}
                keyboardType="number-pad"
                editable={!busy}
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
              <Body style={{ marginTop: space.xs }}>Enter 0 if you did not conduct any Bible studies.</Body>
            </View>
          ) : null}
        </Card>
      ) : null}

      {!selectedReport && needsHours && selectedMonthIsCurrent ? (
        <>
          <Card style={{ marginBottom: space.lg }}>
            <Heading>Month total</Heading>
            <Body style={{ marginTop: space.xs }}>
              {calculatedTotal.hours} hour{calculatedTotal.hours === 1 ? '' : 's'} · {calculatedTotal.bibleStudies} Bible {calculatedTotal.bibleStudies === 1 ? 'study' : 'studies'}
            </Body>
            {reference ? (
              <Body style={{ marginTop: space.xs }}>
                Reference: {reference} hours. This is a minimum, not a maximum.
              </Body>
            ) : null}
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space.lg }}>
            <View
              style={{
                flexDirection: 'row',
                padding: space.md,
                backgroundColor: palette.surfaceAlt,
                borderBottomWidth: 1,
                borderBottomColor: palette.line,
              }}
            >
              <Text style={{ flex: 1.3, fontWeight: '700', color: palette.ink }}>Date</Text>
              <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: palette.ink }}>Hours</Text>
              <Text style={{ flex: 0.8, textAlign: 'center', fontWeight: '700', color: palette.ink }}>Studies</Text>
              <Text style={{ width: 74, textAlign: 'right', fontWeight: '700', color: palette.ink }}>Action</Text>
            </View>

            {rows.map(dateKey => {
              const entry = byDate[dateKey];
              const isToday = dateKey === todayKey;
              const isFuture = dateKey > todayKey;
              const isEditing = isToday || editingDate === dateKey;
              const canEdit = !isFuture;

              return (
                <View
                  key={dateKey}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.line,
                    backgroundColor: isToday ? palette.primarySoft : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54 }}>
                    <View style={{ flex: 1.25 }}>
                      <Text style={{ fontWeight: isToday ? '800' : '500', color: isFuture ? palette.muted : palette.ink }}>
                        {displayDay(dateKey)}
                      </Text>
                      {isToday ? <Badge label="TODAY" tone="info" /> : null}
                    </View>

                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                      {isEditing ? (
                        <TextInput
                          value={hours}
                          onChangeText={setHours}
                          placeholder={entry ? String(entry.hours) : '0'}
                          placeholderTextColor={palette.placeholder}
                          keyboardType="decimal-pad"
                          style={{ width: 58, minHeight: 44, borderWidth: 1.5, borderColor: palette.primary, borderRadius: radius.md, textAlign: 'center', color: palette.ink, backgroundColor: palette.surface, fontSize: 16 }}
                        />
                      ) : (
                        <Text style={{ color: isFuture ? palette.muted : palette.ink, fontSize: 17 }}>{entry?.hours ?? '—'}</Text>
                      )}
                    </View>

                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                      {isEditing ? (
                        <TextInput
                          value={studies}
                          onChangeText={setStudies}
                          placeholder={entry ? String(entry.bibleStudies) : '0'}
                          placeholderTextColor={palette.placeholder}
                          keyboardType="number-pad"
                          style={{ width: 58, minHeight: 44, borderWidth: 1.5, borderColor: palette.primary, borderRadius: radius.md, textAlign: 'center', color: palette.ink, backgroundColor: palette.surface, fontSize: 16 }}
                        />
                      ) : (
                        <Text style={{ color: isFuture ? palette.muted : palette.ink, fontSize: 17 }}>{entry?.bibleStudies ?? '—'}</Text>
                      )}
                    </View>

                    <View style={{ width: 74, alignItems: 'flex-end' }}>
                      {!isEditing && canEdit ? (
                        <Button label="Edit" variant="secondary" onPress={() => beginEdit(dateKey)} disabled={busy} />
                      ) : null}
                    </View>
                  </View>

                  {isEditing && !isToday ? (
                    <View style={{ flexDirection: 'row', marginTop: space.xs, paddingLeft: space.xs }}>
                      <Button label="Save changes" onPress={() => saveEntry(dateKey)} loading={busy} disabled={busy} style={{ flex: 1, marginRight: space.xs }} />
                      <Button label="Cancel" variant="secondary" onPress={cancelEdit} disabled={busy} style={{ flex: 1, marginLeft: space.xs }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>

          <Button label="Save today's entry" onPress={saveToday} loading={busy} disabled={busy} />
        </>
      ) : null}

      {!selectedReport && !needsHours && selectedMonthIsCurrent ? (
        <Card>
          <SwitchRow
            label="I had a part in the ministry"
            value={participated}
            onValueChange={(value) => {
              setParticipated(value);
              if (!value) setPastStudies('');
            }}
            disabled={busy}
          />

          {participated ? (
            <View style={{ marginTop: space.md }}>
              <Body style={{ marginBottom: space.xs }}>Bible studies</Body>
              <TextInput
                value={pastStudies}
                onChangeText={setPastStudies}
                placeholder="Enter number"
                placeholderTextColor={palette.placeholder}
                keyboardType="number-pad"
                editable={!busy}
                style={{ minHeight: 48, borderWidth: 1.5, borderColor: palette.primary, borderRadius: radius.md, paddingHorizontal: space.md, color: palette.ink, backgroundColor: palette.surface, fontSize: 16 }}
              />
              <Body style={{ marginTop: space.xs }}>Enter 0 if you did not conduct any Bible studies.</Body>
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
