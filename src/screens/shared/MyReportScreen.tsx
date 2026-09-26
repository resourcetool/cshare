import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Heading, LoadingView, Notice, SwitchRow, TextField, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import {
  addServiceEntry,
  deleteServiceEntry,
  subscribeToMyServiceEntries,
  submitReport,
  updateServiceEntry,
} from '../../services/reportService';
import { space } from '../../theme';
import { formatMonthLong, monthKeyFor } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { hourReferenceFor, REPORTING_TYPE_LABELS, reportsHours, summarizeReport } from '../../utils/reports';
import { FieldServiceEntry } from '../../types';
import { useLive } from '../../hooks/useLive';

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

export default function MyReportScreen() {
  const navigation = useNavigation();
  const { profile, settings, currentMonthKey, myReport, myReportLoading } = useAppData();
  const monthName = formatMonthLong(currentMonthKey);
  const type = profile.reportingType;
  const needsHours = reportsHours(type);
  const reference = hourReferenceFor(type, settings);

  const entriesLive = useLive<FieldServiceEntry[]>(
    (ok, err) => needsHours
      ? subscribeToMyServiceEntries(profile.id, currentMonthKey, ok, err)
      : () => {},
    [profile.id, currentMonthKey, needsHours],
  );

  const entries = entriesLive.data ?? [];
  const total = useMemo(() => totals(entries), [entries]);

  const [entryDate, setEntryDate] = useState(localDateString(new Date()));
  const [entryHours, setEntryHours] = useState('');
  const [entryStudies, setEntryStudies] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [participated, setParticipated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myReportLoading || (needsHours && entriesLive.loading && !entriesLive.data)) {
    return <Screen><LoadingView /></Screen>;
  }

  const saveEntry = async () => {
    setError(null);
    const hours = Number(entryHours);
    const studies = entryStudies.trim() === '' ? 0 : Number(entryStudies);
    const entryMonth = monthKeyFor(new Date(`${entryDate}T12:00:00`));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      setError('Enter the date as YYYY-MM-DD.');
      return;
    }
    if (entryMonth !== currentMonthKey) {
      setError(`Daily entries must be for ${monthName}.`);
      return;
    }
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      setError('Enter hours from 0 to 24.');
      return;
    }
    if (!Number.isFinite(studies) || studies < 0 || studies > 50) {
      setError('Enter Bible studies from 0 to 50.');
      return;
    }

    setBusy(true);
    try {
      const result = editingId
        ? await updateServiceEntry(profile.id, editingId, {
            date: entryDate,
            monthKey: currentMonthKey,
            hours,
            bibleStudies: studies,
          })
        : await addServiceEntry(profile.id, {
            date: entryDate,
            monthKey: currentMonthKey,
            hours,
            bibleStudies: studies,
          });

      if (result === 'queued') {
        setError('Saved on this phone. It will be sent when you have internet.');
      }
      setEditingId(null);
      setEntryHours('');
      setEntryStudies('');
      setEntryDate(localDateString(new Date()));
    } catch (e) {
      logError('save field service entry', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const editEntry = (entry: FieldServiceEntry) => {
    setEditingId(entry.id);
    setEntryDate(entry.date);
    setEntryHours(String(entry.hours));
    setEntryStudies(String(entry.bibleStudies));
    setError(null);
  };

  const removeEntry = async (entry: FieldServiceEntry) => {
    setError(null);
    setBusy(true);
    try {
      const result = await deleteServiceEntry(profile.id, entry.id);
      if (result === 'queued') setError('Deletion saved on this phone and will sync when you have internet.');
      if (editingId === entry.id) {
        setEditingId(null);
        setEntryHours('');
        setEntryStudies('');
      }
    } catch (e) {
      logError('delete field service entry', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await submitReport(
        profile.id,
        currentMonthKey,
        needsHours
          ? {
              reportingType: type,
              hours: total.hours,
              bibleStudies: total.bibleStudies,
            }
          : {
              reportingType: type,
              participated,
            },
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

  if (myReport) {
    return (
      <Screen>
        <Title>{monthName}</Title>
        <Body style={{ marginBottom: space.lg }}>Your report for this month has been sent in.</Body>
        <Card>
          <Badge label="Submitted" tone="good" />
          <Heading style={{ marginTop: space.sm }}>{REPORTING_TYPE_LABELS[myReport.reportingType]}</Heading>
          <Body style={{ marginTop: space.xs }}>{summarizeReport(myReport.reportingType, myReport)}</Body>
        </Card>
        <Body>Need to change something? Ask an administrator — they can correct a report already sent in.</Body>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Submit monthly report" onPress={submit} loading={busy} disabled={busy} />}>
      <Title>{monthName}</Title>
      <Body style={{ marginBottom: space.lg }}>Reporting as: {REPORTING_TYPE_LABELS[type]}</Body>
      {error ? <Notice tone={error.startsWith('Saved') || error.startsWith('Deletion') ? 'info' : 'bad'} message={error} /> : null}

      {needsHours ? (
        <>
          <Card style={{ marginBottom: space.lg }}>
            <Heading>Month-to-date total</Heading>
            <Body style={{ marginTop: space.xs }}>
              {total.hours} hour{total.hours === 1 ? '' : 's'} · {total.bibleStudies} Bible {total.bibleStudies === 1 ? 'study' : 'studies'}
            </Body>
            {reference ? (
              <Body style={{ marginTop: space.xs }}>
                Reference: {reference} hours. This is a minimum, not a maximum.
              </Body>
            ) : null}
          </Card>

          <Card style={{ marginBottom: space.lg }}>
            <Heading>{editingId ? 'Edit field-service entry' : 'Add field-service entry'}</Heading>
            <Body style={{ marginTop: space.xs, marginBottom: space.md }}>
              Record your hours and Bible studies each time you share in the ministry.
            </Body>
            <TextField
              label="Date (YYYY-MM-DD)"
              value={entryDate}
              onChangeText={setEntryDate}
              placeholder={localDateString(new Date())}
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="Hours"
              value={entryHours}
              onChangeText={setEntryHours}
              keyboardType="decimal-pad"
              placeholder="e.g. 2"
            />
            <TextField
              label="Bible studies"
              value={entryStudies}
              onChangeText={setEntryStudies}
              keyboardType="number-pad"
              placeholder="0"
            />
            <Button label={editingId ? 'Save changes' : 'Add to monthly report'} onPress={saveEntry} loading={busy} disabled={busy} />
            {editingId ? (
              <Button
                label="Cancel edit"
                variant="secondary"
                onPress={() => {
                  setEditingId(null);
                  setEntryHours('');
                  setEntryStudies('');
                  setEntryDate(localDateString(new Date()));
                }}
                disabled={busy}
                style={{ marginTop: space.sm }}
              />
            ) : null}
          </Card>

          <Heading style={{ marginBottom: space.sm }}>This month's entries</Heading>
          {entries.length === 0 ? (
            <Card style={{ marginBottom: space.lg }}>
              <Body>No field-service entries yet. You can add your first entry now.</Body>
            </Card>
          ) : null}

          {entries.map(entry => (
            <Card key={entry.id} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Heading>{displayDate(entry.date)}</Heading>
                  <Body style={{ marginTop: space.xs }}>
                    {entry.hours} hour{entry.hours === 1 ? '' : 's'} · {entry.bibleStudies} Bible {entry.bibleStudies === 1 ? 'study' : 'studies'}
                  </Body>
                </View>
                <Badge label="Saved" tone="good" />
              </View>
              <View style={{ flexDirection: 'row', marginTop: space.sm }}>
                <Button label="Edit" variant="secondary" onPress={() => editEntry(entry)} disabled={busy} style={{ flex: 1, marginRight: space.xs }} />
                <Button label="Delete" variant="secondary" onPress={() => removeEntry(entry)} disabled={busy} style={{ flex: 1, marginLeft: space.xs }} />
              </View>
            </Card>
          ))}
        </>
      ) : (
        <View style={{ marginBottom: space.lg }}>
          <SwitchRow label="I had a part in the ministry" value={participated} onValueChange={setParticipated} />
        </View>
      )}
    </Screen>
  );
}
