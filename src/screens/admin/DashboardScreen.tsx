import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { MyAssignments } from '../../components/MyAssignments';
import { AssignmentCard } from '../../components/AssignmentCard';
import { Badge, Body, Button, Card, Heading, Label, Notice, Small, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { AdminNav } from '../../navigation/types';
import { subscribeToUpcoming } from '../../services/assignmentService';
import { subscribeToUsers } from '../../services/userService';
import { Assignment, UserProfile } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { radius, space, TOUCH } from '../../theme';
import { callNumber, textNumber } from '../../utils/contact';
import { formatDayShort, formatMonthLong } from '../../utils/dates';
import { isWaiting } from '../../utils/people';
import { attentionItems, unconfirmedSoonItems } from '../../utils/status';
import { firstName } from '../../utils/text';

export default function DashboardScreen() {
  const nav = useNavigation<AdminNav>();
  const { palette } = useTheme();
  const { profile, settings, currentMonthKey, myReport, myReportLoading, reload, reloadKey } = useAppData();
  const upcoming = useLive<Assignment[]>(subscribeToUpcoming, [reloadKey]);
  const users = useLive<UserProfile[]>(subscribeToUsers, [reloadKey]);
  const usersById = Object.fromEntries((users.data ?? []).map(u => [u.id, u]));

  const attention = attentionItems(upcoming.data ?? []);
  const unconfirmed = unconfirmedSoonItems(upcoming.data ?? [], new Date());
  const waiting = (users.data ?? []).filter(isWaiting);

  const tiles: { icon: string; label: string; onPress: () => void; wide?: boolean }[] = [
    { icon: '🗓️', label: 'Planner: weeks ahead', wide: true, onPress: () => nav.navigate('Week', { planner: true }) },
    { icon: '📋', label: settings.midweekName, onPress: () => nav.navigate('Week', { meeting: 'midweek' }) },
    { icon: '📋', label: settings.weekendName, onPress: () => nav.navigate('Week', { meeting: 'weekend' }) },
    { icon: '👥', label: 'People', onPress: () => nav.navigate('People') },
    { icon: '🧭', label: 'Ministry groups', onPress: () => nav.navigate('Groups') },
    ...(profile.secretary ? [{ icon: '📊', label: 'Group reports', onPress: () => nav.navigate('GroupReport', undefined) }] : []),
    { icon: '⚙️', label: 'Settings', onPress: () => nav.navigate('Settings') },
  ];

  return (
    <Screen inTabs>
      <View style={styles.header}>
        <Title style={{ flex: 1 }}>Hello, {firstName(profile.name)}</Title>
        <Button label="↻ Reload" variant="secondary" onPress={reload} style={{ minHeight: 48 }} />
      </View>

      {waiting.length ? (
        <Notice
          tone="warn"
          message={`${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting for approval.`}
          actionLabel="Review"
          onAction={() => nav.navigate('People', { filter: 'waiting' })}
        />
      ) : null}

      <View style={styles.grid}>
        {tiles.map(t => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={t.onPress}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: t.wide ? palette.call : palette.primary },
              t.wide && styles.wide,
              pressed && { opacity: 0.8 },
            ]}>
            <Text style={{ fontSize: 30, textAlign: 'center' }}>{t.icon}</Text>
            <Label style={{ color: palette.onPrimary, fontSize: 17, textAlign: 'center', marginTop: 4 }}>{t.label}</Label>
          </Pressable>
        ))}
      </View>

      <Card onPress={() => nav.navigate('MyReport')} accessibilityLabel="My Monthly Report">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <Heading>My Monthly Report</Heading>
            <Small>{formatMonthLong(currentMonthKey)}</Small>
          </View>
          {!myReportLoading ? <Badge label={myReport ? 'Submitted' : 'Not sent yet'} tone={myReport ? 'good' : 'warn'} /> : null}
        </View>
      </Card>

      {attention.length ? (
        <>
          <Heading style={{ marginTop: space.lg, marginBottom: space.md }}>Needs your attention</Heading>
          {attention.slice(0, 5).map(item => (
            <Card
              key={`${item.assignment.id}-${item.uid}`}
              onPress={() => nav.navigate('Week', { weekId: item.assignment.weekId, meeting: item.assignment.meeting ?? 'midweek' })}
              accessibilityLabel={`${item.name} can't do ${item.assignment.title}`}>
              <Label>{item.name} can't do {item.assignment.title}</Label>
              <Small>{formatDayShort(item.assignment.date)}{item.reason ? ` — “${item.reason}”` : ''}</Small>
            </Card>
          ))}
          {attention.length > 5 ? <Body>and {attention.length - 5} more.</Body> : null}
        </>
      ) : null}

      {unconfirmed.length ? (
        <>
          <Heading style={{ marginTop: space.lg, marginBottom: space.md }}>Hasn't confirmed yet</Heading>
          <Body style={{ marginBottom: space.sm }}>These people have an assignment coming up in the next three days but have not yet opened it in CSHARE. Worth a call, so nobody can later say they never heard about it.</Body>
          {unconfirmed.slice(0, 5).map(item => {
            const phone = usersById[item.uid]?.phone;
            return (
              <Card
                key={`${item.assignment.id}-${item.uid}`}
                onPress={() => nav.navigate('Week', { weekId: item.assignment.weekId, meeting: item.assignment.meeting ?? 'midweek' })}
                accessibilityLabel={`${item.name} has not confirmed ${item.assignment.title}`}>
                <Label>{item.name} — {item.assignment.title}</Label>
                <Small>{formatDayShort(item.assignment.date)}</Small>
                {phone ? (
                  <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
                    <Button label="Call" variant="secondary" onPress={() => callNumber(phone)} style={{ flex: 1 }} />
                    <Button label="Text" variant="secondary" onPress={() => textNumber(phone)} style={{ flex: 1 }} />
                  </View>
                ) : null}
              </Card>
            );
          })}
          {unconfirmed.length > 5 ? <Body>and {unconfirmed.length - 5} more.</Body> : null}
        </>
      ) : null}

      {(upcoming.data ?? []).length ? (
        <>
          <Heading style={{ marginTop: space.lg, marginBottom: space.md }}>Upcoming assignments</Heading>
          {(upcoming.data ?? []).slice(0, 5).map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              uid={profile.id}
              variant="admin"
              usersById={usersById}
              onPress={() => nav.navigate('Week', { weekId: a.weekId, meeting: a.meeting ?? 'midweek' })}
            />
          ))}
        </>
      ) : null}

      <View style={{ height: space.lg }} />
      <MyAssignments onOpen={a => nav.navigate('AssignmentDetail', { assignmentId: a.id })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  wide: { width: '100%' },
  tile: { width: '48.5%', minHeight: TOUCH + 44, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', padding: space.md, marginBottom: space.md },
});
