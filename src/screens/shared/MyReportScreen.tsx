import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Heading, LoadingView, Notice, SwitchRow, TextField, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { submitReport } from '../../services/reportService';
import { space } from '../../theme';
import { formatMonthLong } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { hourReferenceFor, REPORTING_TYPE_LABELS, reportsHours, summarizeReport } from '../../utils/reports';

/**
 * A person's own monthly field service report — always THIS month, always THEIR OWN: there is
 * no way to open anyone else's from here, and the server (see firestore.rules) refuses to hand
 * over another person's report even if something tried to ask for one directly.
 */
export default function MyReportScreen() {
  const navigation = useNavigation();
  const { profile, settings, currentMonthKey, myReport, myReportLoading } = useAppData();
  const monthName = formatMonthLong(currentMonthKey);
  const type = profile.reportingType;
  const needsHours = reportsHours(type);
  const reference = hourReferenceFor(type, settings);

  const [participated, setParticipated] = useState(false);
  const [hoursText, setHoursText] = useState('');
  const [studiesText, setStudiesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myReportLoading) return <Screen><LoadingView /></Screen>;

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

  const hours = Number(hoursText);
  const studies = studiesText.trim() ? Number(studiesText) : 0;
  const validHours = hoursText.trim() !== '' && Number.isFinite(hours) && hours >= 0;
  const validStudies = studiesText.trim() === '' || (Number.isFinite(studies) && studies >= 0);
  const canSubmit = needsHours ? validHours && validStudies : true;

  const submit = async () => {
    if (!canSubmit) return setError(needsHours ? 'Please enter a valid number of hours.' : null);
    setBusy(true);
    setError(null);
    try {
      const result = await submitReport(profile.id, currentMonthKey, {
        reportingType: type,
        ...(needsHours ? { hours, bibleStudies: studies } : { participated }),
      }, { groupId: profile.groupId, reporterName: profile.name });
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
    <Screen footer={<Button label="Submit report" onPress={submit} loading={busy} disabled={!canSubmit} />}>
      <Title>{monthName}</Title>
      <Body style={{ marginBottom: space.lg }}>Reporting as: {REPORTING_TYPE_LABELS[type]}</Body>
      {error ? <Notice tone={error.startsWith('Saved') ? 'info' : 'bad'} message={error} /> : null}

      {needsHours ? (
        <>
          <TextField
            label="Hours"
            value={hoursText}
            onChangeText={setHoursText}
            keyboardType="number-pad"
            placeholder={reference ? `Reference: ${reference}` : undefined}
            hint={reference ? `The reference is ${reference} hours. You can enter more than this — it is not a maximum.` : undefined}
          />
          <TextField label="Bible studies (optional)" value={studiesText} onChangeText={setStudiesText} keyboardType="number-pad" />
        </>
      ) : (
        <View style={{ marginBottom: space.lg }}>
          <SwitchRow label="I had a part in the ministry" value={participated} onValueChange={setParticipated} />
        </View>
      )}
    </Screen>
  );
}
