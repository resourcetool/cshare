import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { WeekNav } from '../../components/WeekNav';
import { WeekSheet } from '../../components/WeekSheet';
import { ProgramSheet } from '../../components/ProgramSheet';
import { Body, Chip, ChipRow, EmptyState } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { useNow } from '../../hooks/useNow';
import { UserNav } from '../../navigation/types';
import { subscribeToWeek } from '../../services/weekService';
import { Week } from '../../types';
import { formatDayLong, formatTime, weekIdFor } from '../../utils/dates';

type View = 'mine' | 'midweek' | 'weekend';

/**
 * A normal user can only look at the current week and weeks after it — never one that has
 * already passed — and can only view the schedule here, never print or share it (that stays an
 * administrative action; see the admin Week screen for it).
 */
export default function MyWeekScreen() {
  const nav = useNavigation<UserNav>();
  const { profile, settings, myAssignments, reloadKey } = useAppData();
  const now = useNow();
  const thisWeek = weekIdFor(now);
  const [weekId, setWeekId] = useState(thisWeek);
  const [view, setView] = useState<View>('mine');

  // If the app stays open across a week boundary, jump forward with it rather than trusting the
  // week that was current when the screen first opened.
  useEffect(() => {
    setWeekId(w => (w < thisWeek ? thisWeek : w));
  }, [thisWeek]);

  const week = useLive<Week | null>((ok, err) => subscribeToWeek(weekId, ok, err), [weekId, reloadKey]);
  const items = myAssignments.filter(a => a.weekId === weekId);
  const sheet = view === 'mine' ? undefined : week.data?.sheets[view];
  const meetingName = view === 'weekend' ? settings.weekendName : settings.midweekName;

  return (
    <Screen inTabs>
      <WeekNav weekId={weekId} onChange={setWeekId} minWeekId={thisWeek} />
      <ChipRow>
        <Chip label="📌 My parts" selected={view === 'mine'} onPress={() => setView('mine')} />
        <Chip label={`📋 ${settings.midweekName}`} selected={view === 'midweek'} onPress={() => setView('midweek')} />
        <Chip label={`📋 ${settings.weekendName}`} selected={view === 'weekend'} onPress={() => setView('weekend')} />
      </ChipRow>

      {view === 'mine' ? (
        items.length === 0 ? (
          <EmptyState title="Nothing for you this week" message="Parts given to you will show here." />
        ) : (
          <WeekSheet assignments={items} categories={settings.categories} uid={profile.id} variant="user" onPress={a => nav.navigate('AssignmentDetail', { assignmentId: a.id })} />
        )
      ) : sheet ? (
        <>
          {sheet.title ? <Body style={{ marginBottom: 8, fontWeight: '700' }}>{sheet.title}</Body> : null}
          <Body style={{ marginBottom: 12 }}>{formatDayLong(sheet.date)} · {formatTime(sheet.startTime)}</Body>
          <ProgramSheet rows={sheet.program} uid={profile.id} minutesFormat={settings.minutesFormat} />
        </>
      ) : (
        <EmptyState title="Not ready yet" message={`The ${meetingName} for this week has not been published yet.`} />
      )}
    </Screen>
  );
}
