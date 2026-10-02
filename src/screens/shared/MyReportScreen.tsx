import React, { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Heading, LoadingView, Notice, SwitchRow, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { saveDailyServiceEntry, subscribeToMyServiceEntries, subscribeToMyReport, submitReport } from '../../services/reportService';
import { space, radius } from '../../theme';
import { formatMonthLong, lastDayOfMonth, monthKeyFor, parseMonthKey, previousMonthKey, toDateKey } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { hourReferenceFor, REPORTING_TYPE_LABELS, reportsHours, summarizeReport } from '../../utils/reports';
import { FieldServiceEntry, MonthlyReport } from '../../types';
import { useLive } from '../../hooks/useLive';
import { useTheme } from '../../context/ThemeContext';

function localDateString(d: Date): string {
  return toDateKey(d);
}

function nextMonthKey(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return monthKeyFor(new Date(year, month + 1, 1));
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
  const { profile, settings, currentMonthKey } = useAppData();
  const type = profile.reportingType;
  const needsHours = reportsHours(type);
  const reference = hourReferenceFor(type, settings);
  const today = new Date();
  const todayKey = localDateString(today);

  // The report screen can now inspect any completed month. Future months are never selectable.
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // If the app rolls into a new month while this screen is open, follow the new
    // current month only when the user was already viewing the current month.
    setSelectedMonthKey(previous => previous === currentMonthKey ? currentMonthKey : previous);
  }, [currentMonthKey]);

  const selectedReportLive = useLive<MonthlyReport | null>(
    (ok, err) => subscribeToMyReport(profile.id, selectedMonthKey, ok, err),
    [profile.id, selectedMonthKey],
  );

  const selectedEntriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) => needsHours
      ? subscribeToMyServiceEntries(profile.id, selectedMonthKey, ok, err)
      : (() => { ok([]); return () => {}; })(),
    [profile.id, selectedMonthKey, needsHours],
  );

  const activeReport = selectedReportLive.data;
  const activeEntries = selectedEntriesLive.data ?? [];
  const monthName = formatMonthLong(selectedMonthKey);
  const rows = useMemo(() => daysInMonth(selectedMonthKey), [selectedMonthKey]);
  const byDate = useMemo(() => groupEntries(activeEntries), [activeEntries]);
  const total = useMemo(() => totals(activeEntries), [activeEntries]);

  const activeMonthIsCurrent = selectedMonthKey === currentMonthKey;
  const futureMonth = selectedMonthKey > currentMonthKey;

  // Current-month submission keeps the original restriction. A completed past
  // month may be submitted now, which is what allows a late app recipient to
  // catch up on an older month.
  const canSubmit = !activeMonthIsCurrent || today.getDate() === lastDayOfMonth(currentMonthKey).getDate();

  const [hours, setHours] = useState('');
  const [studies, setStudies] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participated, setParticipated] = useState(false);

  // For a past month with no daily entries, allow someone who received the app
  // late to report the total they actually remember without inventing daily values.
  const [useRememberedTotal, setUseRememberedTotal] = useState(false);
  const [rememberedHours, setRememberedHours] = useState('');
  const [rememberedStudies, setRememberedStudies] = useState('');

  useEffect(() => {
    setEditingDate(null);
    setHours('');
    setStudies('');
    setError(null);
    setParticipated(false);
    setUseRememberedTotal(false);
    setRememberedHours('');
    setRememberedStudies('');
    setShowHelp(false);
  }, [selectedMonthKey]);

  const canUseRememberedTotal =
    needsHours &&
    !activeMonthIsCurrent &&
    !activeReport &&
    activeEntries.length === 0;

  const helpType = activeReport?.reportingType ?? type;
  const helpNeedsHours = reportsHours(helpType);

  const goToPreviousMonth = () => {
    setSelectedMonthKey(previousMonthKey(selectedMonthKey));
  };

  const goToNextMonth = () => {
    const next = nextMonthKey(selectedMonthKey);
    if (next <= currentMonthKey) setSelectedMonthKey(next);
  };

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

  const submit = async () => {
    if (activeReport) {
      setError('This report has already been sent in. Ask an administrator if a correction is needed.');
      return;
    }

    if (futureMonth) {
      setError('Future months cannot be reported.');
      return;
    }

    if (!canSubmit) {
      setError(`You can submit ${monthName} on the last day of the month.`);
      return;
    }

    let reportHours: number | undefined;
    let reportStudies: number | undefined;

    // Publishers and Baptized Publishers must enter Bible studies when
    // they say they had a part in the ministry. Zero is a valid value.
    if (!needsHours && participated) {
      if (studies.trim() === '') {
        setError('Enter the number of Bible studies before submitting.');
        return;
      }

      const studyCount = Number(studies);

      if (!Number.isInteger(studyCount) || studyCount < 0 || studyCount > 200) {
        setError('Enter Bible studies from 0 to 200.');
        return;
      }

      reportStudies = studyCount;
    }

    if (needsHours) {
      if (useRememberedTotal) {
        const h = Number(rememberedHours);
        const st = Number(rememberedStudies);

        if (!Number.isFinite(h) || h < 0 || h > 750) {
          setError('Enter remembered hours from 0 to 750.');
          return;
        }

        if (!Number.isInteger(st) || st < 0 || st > 200) {
          setError('Enter Bible studies from 0 to 200.');
          return;
        }

        reportHours = h;
        reportStudies = st;
      } else {
        reportHours = total.hours;
        reportStudies = total.bibleStudies;
      }
    }

    setBusy(true);
    setError(null);

    try {
      const result = await submitReport(
        profile.id,
        selectedMonthKey,
        needsHours
          ? {
              reportingType: type,
              hours: reportHours ?? 0,
              bibleStudies: reportStudies ?? 0,
            }
          : {
              reportingType: type,
              participated,
              ...(participated ? { bibleStudies: reportStudies ?? 0 } : {}),
            },
        {
          groupId: profile.groupId,
          reporterName: profile.name,
        },
      );

      if (result === 'queued') {
        setError('Saved on this phone. It will be sent when you have internet.');
      } else {
        navigation.goBack();
      }
    } catch (e) {
      logError('submit report', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const renderMonthFilter = () => (
    <Card style={{ marginBottom: space.md }}>
      <Heading>Report month</Heading>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: space.sm,
        }}
      >
        <Button
          label="Previous"
          variant="secondary"
          onPress={goToPreviousMonth}
          disabled={busy}
          style={{ flex: 1, marginRight: space.xs }}
        />

        <View style={{ flex: 1.4, alignItems: 'center' }}>
          <Text
            style={{
              color: palette.ink,
              fontSize: 16,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            {monthName}
          </Text>

          {activeMonthIsCurrent ? <Badge label="CURRENT" tone="info" /> : null}
        </View>

        <Button
          label="Next"
          variant="secondary"
          onPress={goToNextMonth}
          disabled={busy || selectedMonthKey >= currentMonthKey}
          style={{ flex: 1, marginLeft: space.xs }}
        />
      </View>

      {!activeMonthIsCurrent ? (
        <Button
          label="Back to current month"
          variant="ghost"
          onPress={() => setSelectedMonthKey(currentMonthKey)}
          disabled={busy}
          style={{ marginTop: space.xs }}
        />
      ) : null}
    </Card>
  );

  const renderHelp = () => (
    <Card style={{ marginBottom: space.lg }}>
      <Heading>How to use your monthly report</Heading>

      {helpNeedsHours ? (
        <>
          <Body style={{ marginTop: space.sm }}>
            You are reporting as a pioneer. Select the month you want to review, then enter or edit the daily hours and Bible studies for that month.
          </Body>
          <Body style={{ marginTop: space.sm }}>
            If you received the app late and have no daily entries for an older month, you can use the remembered monthly total option instead of making up individual daily figures.
          </Body>
          <Body style={{ marginTop: space.sm }}>
            Past months can be submitted once the information is complete. Future dates cannot be entered.
          </Body>
        </>
      ) : (
        <>
          <Body style={{ marginTop: space.sm }}>
            Select the month you want to review. For a publisher or baptized publisher, indicate whether you shared in the ministry and enter your Bible studies when applicable.
          </Body>
          <Body style={{ marginTop: space.sm }}>
            If you received the app late, you can select an older month and submit the information you remember for that month.
          </Body>
          <Body style={{ marginTop: space.sm }}>
            A report that has already been sent in cannot be changed from this screen. Ask an administrator if a correction is needed.
          </Body>
        </>
      )}
    </Card>
  );

  if (selectedReportLive.loading || selectedEntriesLive.loading) {
    return <Screen><LoadingView /></Screen>;
  }

  if (activeReport) {
    return (
      <Screen>
        {renderMonthFilter()}

        <Button
          label={showHelp ? 'Hide help' : 'How to use'}
          variant="secondary"
          onPress={() => setShowHelp(value => !value)}
          style={{ marginBottom: space.md }}
        />

        {showHelp ? renderHelp() : null}

        <Title>{monthName}</Title>
        <Body style={{ marginBottom: space.lg }}>Your report for this month has been sent in.</Body>

        <Card>
          <Badge label="Submitted" tone="good" />
          <Heading style={{ marginTop: space.sm }}>{REPORTING_TYPE_LABELS[activeReport.reportingType]}</Heading>
          <Body style={{ marginTop: space.xs }}>{summarizeReport(activeReport.reportingType, activeReport)}</Body>
        </Card>

        <Notice
          tone="info"
          message="Need to change something in a submitted report? Ask an administrator. Your existing role restrictions remain in place."
        />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Submit monthly report" onPress={submit} loading={busy} disabled={busy || !canSubmit || futureMonth} />}>
      {renderMonthFilter()}

      <Button
        label={showHelp ? 'Hide help' : 'How to use'}
        variant="secondary"
        onPress={() => setShowHelp(value => !value)}
        style={{ marginBottom: space.md }}
      />

      {showHelp ? renderHelp() : null}

      <Title>{monthName}</Title>

      <Body style={{ marginBottom: space.md }}>
        Reporting as: {REPORTING_TYPE_LABELS[type]}
      </Body>

      {activeMonthIsCurrent && !canSubmit ? (
        <Notice
          tone="info"
          message={`Keep recording your daily activity. Submission opens on ${formatMonthLong(currentMonthKey)}'s last day.`}
        />
      ) : null}

      {!activeMonthIsCurrent ? (
        <Notice
          tone="warn"
          message="You are viewing a previous month. You can complete and submit it now if it has not already been sent in."
        />
      ) : null}

      {error ? (
        <Notice
          tone={error.startsWith('Saved') ? 'info' : 'bad'}
          message={error}
        />
      ) : null}

      {needsHours ? (
        <>
          <Card style={{ marginBottom: space.lg }}>
            <Heading>Month total</Heading>

            <Body style={{ marginTop: space.xs }}>
              {useRememberedTotal ? `${rememberedHours || 0} hour${Number(rememberedHours) === 1 ? '' : 's'} · ${rememberedStudies || 0} Bible ${Number(rememberedStudies) === 1 ? 'study' : 'studies'}` : `${total.hours} hour${total.hours === 1 ? '' : 's'} · ${total.bibleStudies} Bible ${total.bibleStudies === 1 ? 'study' : 'studies'}`}
            </Body>

            {reference ? (
              <Body style={{ marginTop: space.xs }}>
                Reference: {reference} hours. This is a minimum, not a maximum.
              </Body>
            ) : null}
          </Card>

          {canUseRememberedTotal ? (
            <Card style={{ marginBottom: space.lg }}>
              <SwitchRow
                label="I only remember my monthly total"
                value={useRememberedTotal}
                onValueChange={(value) => {
                  setUseRememberedTotal(value);
                  setError(null);
                  if (!value) {
                    setRememberedHours('');
                    setRememberedStudies('');
                  }
                }}
                disabled={busy}
              />

              {useRememberedTotal ? (
                <>
                  <Body style={{ marginTop: space.sm }}>
                    Enter the total you remember for this month. Use this only when there are no daily entries to recover.
                  </Body>

                  <View style={{ flexDirection: 'row', marginTop: space.md }}>
                    <View style={{ flex: 1, marginRight: space.xs }}>
                      <Body style={{ marginBottom: space.xs }}>Hours</Body>
                      <TextInput
                        value={rememberedHours}
                        onChangeText={setRememberedHours}
                        placeholder="0"
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
                    </View>

                    <View style={{ flex: 1, marginLeft: space.xs }}>
                      <Body style={{ marginBottom: space.xs }}>Bible studies</Body>
                      <TextInput
                        value={rememberedStudies}
                        onChangeText={setRememberedStudies}
                        placeholder="0"
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
                    </View>
                  </View>
                </>
              ) : null}
            </Card>
          ) : null}

          {!useRememberedTotal ? (
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
                <Text style={{ flex: 1.3, fontWeight: '700', color: palette.ink }}>
                  Date
                </Text>

                <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: palette.ink }}>
                  Hours
                </Text>

                <Text style={{ flex: 0.8, textAlign: 'center', fontWeight: '700', color: palette.ink }}>
                  Studies
                </Text>

                <Text style={{ width: 74, textAlign: 'right', fontWeight: '700', color: palette.ink }}>
                  Action
                </Text>
              </View>

              {rows.map(dateKey => {
                const entry = byDate[dateKey];
                const isToday = dateKey === todayKey && activeMonthIsCurrent;
                const isFuture = activeMonthIsCurrent && dateKey > todayKey;
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
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 54,
                      }}
                    >
                      <View style={{ flex: 1.25 }}>
                        <Text
                          style={{
                            fontWeight: isToday ? '800' : '500',
                            color: isFuture ? palette.muted : palette.ink,
                          }}
                        >
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
                            style={{
                              width: 58,
                              minHeight: 44,
                              borderWidth: 1.5,
                              borderColor: palette.primary,
                              borderRadius: radius.md,
                              textAlign: 'center',
                              color: palette.ink,
                              backgroundColor: palette.surface,
                              fontSize: 16,
                            }}
                          />
                        ) : (
                          <Text
                            style={{
                              color: isFuture ? palette.muted : palette.ink,
                              fontSize: 17,
                            }}
                          >
                            {entry?.hours ?? '—'}
                          </Text>
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
                            style={{
                              width: 58,
                              minHeight: 44,
                              borderWidth: 1.5,
                              borderColor: palette.primary,
                              borderRadius: radius.md,
                              textAlign: 'center',
                              color: palette.ink,
                              backgroundColor: palette.surface,
                              fontSize: 16,
                            }}
                          />
                        ) : (
                          <Text
                            style={{
                              color: isFuture ? palette.muted : palette.ink,
                              fontSize: 17,
                            }}
                          >
                            {entry?.bibleStudies ?? '—'}
                          </Text>
                        )}
                      </View>

                      <View style={{ width: 74, alignItems: 'flex-end' }}>
                        {!isEditing && canEdit ? (
                          <Button
                            label="Edit"
                            variant="secondary"
                            onPress={() => beginEdit(dateKey)}
                            disabled={busy}
                          />
                        ) : null}
                      </View>
                    </View>

                    {isEditing && !isToday ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          marginTop: space.xs,
                          paddingLeft: space.xs,
                        }}
                      >
                        <Button
                          label="Save changes"
                          onPress={() => saveEntry(dateKey)}
                          loading={busy}
                          disabled={busy}
                          style={{ flex: 1, marginRight: space.xs }}
                        />

                        <Button
                          label="Cancel"
                          variant="secondary"
                          onPress={cancelEdit}
                          disabled={busy}
                          style={{ flex: 1, marginLeft: space.xs }}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {activeMonthIsCurrent && !useRememberedTotal ? (
            <Button
              label="Save today's entry"
              onPress={saveToday}
              loading={busy}
              disabled={busy}
            />
          ) : null}
        </>
      ) : (
        <Card>
          <SwitchRow
            label="I had a part in the ministry"
            value={participated}
            onValueChange={(value) => {
              setParticipated(value);
              if (!value) setStudies('');
            }}
            disabled={!canSubmit || busy}
          />

          {participated ? (
            <View style={{ marginTop: space.md }}>
              <Body style={{ marginBottom: space.xs }}>
                Bible studies
              </Body>

              <TextInput
                value={studies}
                onChangeText={setStudies}
                placeholder="Enter number"
                placeholderTextColor={palette.placeholder}
                keyboardType="number-pad"
                editable={!busy && canSubmit}
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
      )}
    </Screen>
  );
}
