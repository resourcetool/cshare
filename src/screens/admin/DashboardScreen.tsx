import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { MyAssignments } from '../../components/MyAssignments';
import { AppUpdateNotice } from '../../components/AppUpdateNotice';
import { AssignmentCard } from '../../components/AssignmentCard';
import { Icon, IconName } from '../../components/Icon';
import { Badge, Body, Button, Card, Heading, Label, Notice, Small, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { AdminNav } from '../../navigation/types';
import { subscribeToUpcoming } from '../../services/assignmentService';
import { subscribeToUsers } from '../../services/userService';
import { Assignment, UserProfile } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { radius, space } from '../../theme';
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

  const tiles: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'planner', label: 'Planner', onPress: () => nav.navigate('Week', { planner: true }) },
    { icon: 'meeting', label: settings.midweekName, onPress: () => nav.navigate('Week', { meeting: 'midweek' }) },
    { icon: 'calendar', label: settings.weekendName, onPress: () => nav.navigate('Week', { meeting: 'weekend' }) },
    { icon: 'people', label: 'People', onPress: () => nav.navigate('People') },
    { icon: 'groups', label: 'Ministry groups', onPress: () => nav.navigate('Groups') },
    ...(profile.secretary ? [{ icon: 'report' as IconName, label: 'Group reports', onPress: () => nav.navigate('GroupReport', undefined) }] : []),
    { icon: 'settings', label: 'Settings', onPress: () => nav.navigate('Settings') },
  ];

  return (
    <Screen inTabs>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Small>CSHARE administration</Small>
          <Title style={{ marginTop: 2 }}>Hello, {firstName(profile.name)}</Title>
        </View>
        <Button label="Refresh" icon="refresh" variant="secondary" onPress={reload} style={{ minHeight: 42, paddingHorizontal: space.md }} />
      </View>

      <AppUpdateNotice />

      {waiting.length ? (
        <Notice
          tone="warn"
          message={`${waiting.length} ${waiting.length === 1 ? 'person is' : 'people are'} waiting for approval.`}
          actionLabel="Review"
          onAction={() => nav.navigate('People', { filter: 'waiting' })}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My Monthly Report"
        onPress={() => nav.navigate('MyReport')}
        style={({ pressed }) => [styles.reportHero, { backgroundColor: palette.primary }, pressed && { opacity: 0.9 }]}>
        <View style={styles.reportIcon}>
          <Icon name="report" size={23} color={palette.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Small style={{ color: palette.onPrimary, opacity: 0.78 }}>{formatMonthLong(currentMonthKey)}</Small>
          <Heading style={{ color: palette.onPrimary, marginTop: 1 }}>My Monthly Report</Heading>
        </View>
        {!myReportLoading ? <Badge label={myReport ? 'Submitted' : 'Not sent yet'} tone={myReport ? 'good' : 'warn'} /> : null}
      </Pressable>

      <View style={{ marginTop: space.lg, marginBottom: space.sm }}>
        <Heading>Quick access</Heading>
        <Small>Everything you manage most often.</Small>
      </View>

      <View style={styles.grid}>
        {tiles.map(t => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={t.onPress}
            style={({ pressed }) => [styles.tile, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && { opacity: 0.78 }]}>
            <View style={[styles.tileIcon, { backgroundColor: palette.primarySoft }]}>
              <Icon name={t.icon} size={21} color={palette.primary} />
            </View>
            <Label style={{ flex: 1, marginLeft: space.sm }} numberOfLines={2}>{t.label}</Label>
            <Icon name="arrow-right" size={21} color={palette.muted} />
          </Pressable>
        ))}
      </View>

      {attention.length ? (
        <>
          <View style={styles.sectionHeader}><Heading>Needs your attention</Heading><Badge label={String(attention.length)} tone="warn" /></View>
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
          <View style={styles.sectionHeader}><Heading>Hasn't confirmed yet</Heading><Badge label={String(unconfirmed.length)} tone="info" /></View>
          <Body style={{ marginBottom: space.sm }}>People with assignments in the next three days who have not opened them yet.</Body>
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
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                    <Button label="Call" icon="phone" variant="secondary" onPress={() => callNumber(phone)} style={{ flex: 1 }} />
                    <Button label="Text" icon="comment" variant="secondary" onPress={() => textNumber(phone)} style={{ flex: 1 }} />
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
          <View style={styles.sectionHeader}><Heading>Upcoming assignments</Heading><Badge label={String((upcoming.data ?? []).length)} tone="info" /></View>
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

      <MyAssignments onOpen={a => nav.navigate('AssignmentDetail', { assignmentId: a.id })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl },
  reportHero: { minHeight: 82, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  reportIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', minHeight: 66, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' },
  tileIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm },
});
