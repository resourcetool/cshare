import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { MyAssignments } from '../../components/MyAssignments';
import { AppUpdateNotice } from '../../components/AppUpdateNotice';
import { Badge, Body, Button, Card, Heading, Notice, Small, Title } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useLive } from '../../hooks/useLive';
import { UserNav } from '../../navigation/types';
import { subscribeToGroups } from '../../services/groupService';
import { MinistryGroup } from '../../types';
import { space } from '../../theme';
import { formatMonthLong } from '../../utils/dates';
import { firstName } from '../../utils/text';

export default function HomeScreen() {
  const nav = useNavigation<UserNav>();
  const { palette } = useTheme();
  const { profile, currentMonthKey, myReport, myReportLoading, reminderIssue, fixReminders, reload } = useAppData();
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const overseerGroup = useMemo(
    () => (groups.data ?? []).find(g => g.overseerId === profile.id),
    [groups.data, profile.id],
  );

  return (
    <Screen inTabs>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xl }}>
        <View style={{ flex: 1 }}>
          <Small>Welcome back</Small>
          <Title style={{ marginTop: 2 }}>Hello, {firstName(profile.name)}</Title>
        </View>
        <Button label="Refresh" icon="refresh" variant="secondary" onPress={reload} style={{ minHeight: 42, paddingHorizontal: space.md }} />
      </View>

      <AppUpdateNotice />

      {reminderIssue === 'notifications' ? (
        <Notice tone="warn" message="Reminders are off because notifications are turned off for CSHARE." actionLabel="Turn on reminders" onAction={fixReminders} />
      ) : null}
      {reminderIssue === 'exact' ? (
        <Notice tone="warn" message="Reminders may arrive late. Allow “Alarms & reminders” for CSHARE." actionLabel="Fix this" onAction={fixReminders} />
      ) : null}
      {reminderIssue === 'failed' ? <Notice tone="warn" message="Reminders could not be set up on this phone. Open CSHARE again later to retry." /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My Monthly Report"
        onPress={() => nav.navigate('MyReport')}
        style={({ pressed }) => ({
          backgroundColor: palette.primary,
          borderRadius: 14,
          padding: space.lg,
          marginBottom: space.md,
          opacity: pressed ? 0.9 : 1,
        })}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: palette.onPrimary === '#FFFFFF' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
            <Icon name="report" size={23} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Small style={{ color: palette.onPrimary === '#FFFFFF' ? '#C5E0E3' : palette.onPrimary }}>{formatMonthLong(currentMonthKey)}</Small>
            <Heading style={{ color: palette.onPrimary, marginTop: 1 }}>My Monthly Report</Heading>
          </View>
          {!myReportLoading ? <Badge label={myReport ? 'Submitted' : 'Not sent yet'} tone={myReport ? 'good' : 'warn'} /> : null}
        </View>
      </Pressable>

      {overseerGroup || profile.secretary ? (
        <Card onPress={() => nav.navigate('GroupReport', undefined)} accessibilityLabel="Group Monthly Report" style={{ paddingVertical: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
              <Icon name="groups" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Heading>Group Monthly Report</Heading>
              <Small>{profile.secretary && !overseerGroup ? 'All ministry groups' : overseerGroup?.name} · {formatMonthLong(currentMonthKey)}</Small>
            </View>
            <Icon name="arrow-right" size={24} color="#55666E" />
          </View>
        </Card>
      ) : null}

      <View style={{ marginTop: space.md, marginBottom: space.sm }}>
        <Heading>Upcoming assignments</Heading>
        <Body style={{ color: palette.muted, marginTop: 2 }}>Your next responsibilities at a glance.</Body>
      </View>

      <MyAssignments onOpen={a => nav.navigate('AssignmentDetail', { assignmentId: a.id })} />
    </Screen>
  );
}
