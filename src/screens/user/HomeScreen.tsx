import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { MyAssignments } from '../../components/MyAssignments';
import { Badge, Body, Button, Card, Heading, Notice, Small, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { UserNav } from '../../navigation/types';
import { subscribeToGroups } from '../../services/groupService';
import { MinistryGroup } from '../../types';
import { space } from '../../theme';
import { formatMonthLong } from '../../utils/dates';
import { firstName } from '../../utils/text';

export default function HomeScreen() {
  const nav = useNavigation<UserNav>();
  const { profile, currentMonthKey, myReport, myReportLoading, reminderIssue, fixReminders, reload } = useAppData();
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const overseerGroup = useMemo(
    () => (groups.data ?? []).find(g => g.overseerId === profile.id),
    [groups.data, profile.id],
  );

  return (
    <Screen inTabs>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, gap: space.md }}>
        <Title style={{ flex: 1 }}>Hello, {firstName(profile.name)}</Title>
        <Button label="↻ Reload" variant="secondary" onPress={reload} style={{ minHeight: 48 }} />
      </View>

      {reminderIssue === 'notifications' ? (
        <Notice tone="warn" message="Reminders are off because notifications are turned off for CSHARE." actionLabel="Turn on reminders" onAction={fixReminders} />
      ) : null}
      {reminderIssue === 'exact' ? (
        <Notice tone="warn" message="Reminders may arrive late. Allow “Alarms & reminders” for CSHARE." actionLabel="Fix this" onAction={fixReminders} />
      ) : null}
      {reminderIssue === 'failed' ? <Notice tone="warn" message="Reminders could not be set up on this phone. Open CSHARE again later to retry." /> : null}

      <Card onPress={() => nav.navigate('MyReport')} accessibilityLabel="My Monthly Report">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <Heading>My Monthly Report</Heading>
            <Small>{formatMonthLong(currentMonthKey)}</Small>
          </View>
          {!myReportLoading ? <Badge label={myReport ? 'Submitted' : 'Not sent yet'} tone={myReport ? 'good' : 'warn'} /> : null}
        </View>
      </Card>

      {overseerGroup ? (
        <Card onPress={() => nav.navigate('GroupReport', undefined)} accessibilityLabel="Group Monthly Report">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Heading>Group Monthly Report</Heading>
              <Small>{overseerGroup.name} · {formatMonthLong(currentMonthKey)}</Small>
            </View>
            <Badge label="Open" tone="info" />
          </View>
        </Card>
      ) : null}

      <MyAssignments onOpen={a => nav.navigate('AssignmentDetail', { assignmentId: a.id })} />
    </Screen>
  );
}
