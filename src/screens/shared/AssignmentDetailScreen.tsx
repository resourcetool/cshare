import React, { useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, EmptyState, Heading, LoadingView, Notice, Small, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { SharedStackParams } from '../../navigation/types';
import { recordViewed, undoCannotDo } from '../../services/assignmentService';
import { addAssignmentToDeviceCalendar } from '../../services/calendarService';
import { space } from '../../theme';
import { formatDayLong, formatTimeRange } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { statusFor, statusLabel, statusTone } from '../../utils/status';

export default function AssignmentDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedStackParams>>();
  const route = useRoute<RouteProp<SharedStackParams, 'AssignmentDetail'>>();
  const { profile, settings, myAssignments, myLoading } = useAppData();
  const a = myAssignments.find(x => x.id === route.params.assignmentId);
  const [error, setError] = useState<string | null>(null);
  const [calendarNote, setCalendarNote] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [addingToPhone, setAddingToPhone] = useState(false);
  const answered = !!a?.responses[profile.id];
  const cancelled = a?.status === 'cancelled';

  // Opening the assignment records "Seen" so administrators know it was received.
  useEffect(() => {
    if (!a || answered || cancelled) return;
    recordViewed(a, profile.id)?.catch(e => logError('record viewed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, answered, cancelled]);

  if (!a) {
    return (
      <Screen>
        {myLoading ? (
          <LoadingView />
        ) : (
          <EmptyState title="This assignment is no longer here" message="It may have been removed or changed. Check your home screen for your current assignments." actionLabel="Go back" onAction={navigation.goBack} />
        )}
      </Screen>
    );
  }

  const s = statusFor(a, profile.id);
  const isChild = a.childAssignees?.includes(profile.id);
  const others = a.assigneeIds.filter(id => id !== profile.id).map(id => a.assigneeNames[id] ?? 'Someone');
  const response = a.responses[profile.id];
  const meetingName = a.meeting === 'weekend' ? settings.weekendName : a.meeting === 'midweek' ? settings.midweekName : undefined;

  const undo = async () => {
    try {
      setError(null);
      await undoCannotDo(a, profile.id);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  // "Add to phone": a personal, optional copy on the device's own calendar. This is separate
  // from CSHARE's own Smart Reminders, which keep working either way.
  const addToPhone = async () => {
    setAddingToPhone(true);
    setCalendarNote(null);
    try {
      const result = await addAssignmentToDeviceCalendar(a, profile.id, meetingName);
      if (result.ok) setCalendarNote({ tone: 'good', text: `Added to “${result.calendarName}” on your phone.` });
      else if (result.reason === 'permission_denied') setCalendarNote({ tone: 'bad', text: 'Calendar access was not allowed, so this could not be added. You can allow it in your phone’s settings for CSHARE.' });
      else if (result.reason === 'no_calendar') setCalendarNote({ tone: 'bad', text: 'No calendar was found on this phone. Open the Google Calendar app once and sign in, then try again.' });
      else if (result.reason === 'unsupported') setCalendarNote({ tone: 'bad', text: 'This phone does not support adding events to its calendar.' });
      else setCalendarNote({ tone: 'bad', text: 'This could not be added to your calendar. Please try again.' });
    } catch (e) {
      logError('add to phone', e);
      setCalendarNote({ tone: 'bad', text: friendlyError(e) });
    } finally {
      setAddingToPhone(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Contact admin" variant="secondary" onPress={() => navigation.navigate('ContactAdmin')} />
          {!cancelled && s !== 'cannot_do' ? (
            <Button label="I Can't Do This" variant="danger" onPress={() => navigation.navigate('CantDo', { assignmentId: a.id })} style={{ marginTop: space.sm }} />
          ) : null}
        </>
      }>
      {cancelled ? <Notice tone="warn" message="This assignment was cancelled. You do not need to do anything." /> : null}
      {error ? <Notice tone="bad" message={error} /> : null}

      <Badge label={statusLabel(s, 'user')} tone={statusTone(s)} />
      <Title style={{ marginTop: space.md }}>{a.title}</Title>
      {a.category ? <Small>{a.category}</Small> : null}
      {isChild ? <Small style={{ marginTop: space.xs }}>For your child, {a.assigneeNames[profile.id]} (no phone of their own)</Small> : null}

      <Card style={{ marginTop: space.lg }}>
        <Heading>{formatDayLong(a.date)}</Heading>
        <Body>{formatTimeRange(a.startTime, a.endTime)}</Body>
        {a.location ? <Body style={{ marginTop: space.sm }}>{a.location}</Body> : null}
      </Card>

      {others.length ? (
        <Card>
          <Small>Also assigned</Small>
          <Body>{others.join(', ')}</Body>
        </Card>
      ) : null}

      {a.description ? (
        <Card>
          <Small>Instructions</Small>
          <Body>{a.description}</Body>
        </Card>
      ) : null}

      {!cancelled ? (
        <Card>
          <Heading>Add to phone</Heading>
          <Body style={{ marginVertical: space.sm }}>Put this one assignment on your phone's own calendar. This is separate from CSHARE's reminders, which keep working either way.</Body>
          {calendarNote ? <Notice tone={calendarNote.tone} message={calendarNote.text} /> : null}
          <Button label="Add to phone" variant="secondary" onPress={addToPhone} loading={addingToPhone} />
        </Card>
      ) : null}

      {s === 'cannot_do' ? (
        <Card>
          <Heading>You told the administrator you can't do this</Heading>
          {response?.reason ? <Body style={{ marginTop: space.sm }}>“{response.reason}”</Body> : null}
          <Small style={{ marginVertical: space.sm }}>Reminders are off for this assignment.</Small>
          <Button label="Actually, I can do it" variant="secondary" onPress={undo} />
        </Card>
      ) : null}
    </Screen>
  );
}
