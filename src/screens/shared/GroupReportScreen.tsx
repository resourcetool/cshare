import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Chip, EmptyState, Heading, LoadingView, Notice, Small, Title } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { SharedStackParams } from '../../navigation/types';
import { subscribeToGroups } from '../../services/groupService';
import { subscribeToGroupReports, subscribeToUnassignedReports, updateReport } from '../../services/reportService';
import { MinistryGroup, MonthlyReport } from '../../types';
import { space } from '../../theme';
import { formatMonthLong, previousMonthKey } from '../../utils/dates';
import { REPORTING_TYPE_LABELS, reportsHours, summarizeReport } from '../../utils/reports';
import { useTheme } from '../../context/ThemeContext';
import { friendlyError, logError } from '../../utils/errors';

function getMonthOptions(currentMonthKey: string, count = 24): string[] {
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
  const months = useMemo(() => getMonthOptions(currentMonthKey), [currentMonthKey]);

  return (
    <View style={{ marginTop: space.md, marginBottom: space.sm }}>
      <Small style={{ marginBottom: space.xs }}>Report month</Small>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.xs, paddingRight: space.md }}
      >
        {months.map(monthKey => (
          <Chip
            key={monthKey}
            label={formatMonthLong(monthKey)}
            selected={value === monthKey}
            onPress={() => onChange(monthKey)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function GroupReportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedStackParams>>();
  const route = useRoute<RouteProp<SharedStackParams, 'GroupReport'>>();
  const { profile, currentMonthKey } = useAppData();
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const { palette } = useTheme();
  const [editingReport, setEditingReport] = useState<MonthlyReport | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editStudies, setEditStudies] = useState('');
  const [editParticipated, setEditParticipated] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const requestedGroupId = route.params?.groupId;
  const showUnassigned = route.params?.unassigned === true;
  const overseerGroup = useMemo(
    () => (groups.data ?? []).find(g => g.overseerId === profile.id),
    [groups.data, profile.id],
  );
  const canViewAllGroups = profile.role === 'admin' && profile.secretary === true;
  const canViewUnassigned = profile.role === 'admin';
  const canViewAssignedGroup = !!overseerGroup;
  const canViewGroupReports = canViewAllGroups || canViewAssignedGroup || (showUnassigned && canViewUnassigned);
  const selectedGroupId = canViewAllGroups ? requestedGroupId : overseerGroup?.id;
  const selectedGroup = useMemo(
    () => (groups.data ?? []).find(g => g.id === selectedGroupId),
    [groups.data, selectedGroupId],
  );
  const reports = useLive<MonthlyReport[]>(
    (ok, err) => {
      if (showUnassigned && canViewUnassigned) {
        return subscribeToUnassignedReports(selectedMonthKey, ok, err);
      }
      return selectedGroupId
        ? subscribeToGroupReports(selectedGroupId, selectedMonthKey, ok, err)
        : (() => {});
    },
    [showUnassigned, canViewUnassigned, selectedGroupId, selectedMonthKey],
  );

  const canEditReports = profile.role === 'admin';

  const openEdit = (report: MonthlyReport) => {
    setEditingReport(report);
    setEditHours(report.hours !== undefined ? String(report.hours) : '');
    setEditStudies(report.bibleStudies !== undefined ? String(report.bibleStudies) : '');
    setEditParticipated(report.participated === true);
    setEditError(null);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setEditingReport(null);
    setEditError(null);
  };

  const saveEditedReport = async () => {
    if (!editingReport) return;
    const needsHours = reportsHours(editingReport.reportingType);
    const patch: { participated?: boolean; hours?: number; bibleStudies?: number } = {};

    if (needsHours) {
      const hours = Number(editHours);
      const studies = Number(editStudies);
      if (!Number.isFinite(hours) || hours < 0 || hours > 750) {
        setEditError('Enter hours from 0 to 750.');
        return;
      }
      if (!Number.isFinite(studies) || studies < 0 || studies > 200) {
        setEditError('Enter Bible studies from 0 to 200.');
        return;
      }
      patch.hours = hours;
      patch.bibleStudies = studies;
    } else {
      patch.participated = editParticipated;
      if (editParticipated) {
        const studies = Number(editStudies);
        if (!Number.isInteger(studies) || studies < 0 || studies > 200) {
          setEditError('Enter Bible studies from 0 to 200.');
          return;
        }
        patch.bibleStudies = studies;
      } else {
        patch.bibleStudies = 0;
      }
    }

    setEditBusy(true);
    setEditError(null);
    try {
      await updateReport(editingReport.id, patch);
      setEditingReport(null);
    } catch (e) {
      logError('update submitted report', e);
      setEditError(friendlyError(e));
    } finally {
      setEditBusy(false);
    }
  };

  const editModal = editingReport ? (
    <Modal visible transparent animationType="slide" onRequestClose={closeEdit}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: palette.overlay }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: space.lg, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.lg }}>
            <Title>Edit Report</Title>
            <Body style={{ marginTop: space.xs }}>
              {editingReport.reporterName ?? editingReport.uid} · {formatMonthLong(editingReport.monthKey)}
            </Body>
            <Small style={{ marginTop: space.sm }}>{REPORTING_TYPE_LABELS[editingReport.reportingType]}</Small>

            {reportsHours(editingReport.reportingType) ? (
              <>
                <Small style={{ marginTop: space.lg, marginBottom: space.xs }}>Actual hours</Small>
                <TextInput
                  value={editHours}
                  onChangeText={setEditHours}
                  keyboardType="decimal-pad"
                  style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 12, color: palette.ink, backgroundColor: palette.surfaceAlt }}
                  placeholder="Hours"
                  placeholderTextColor={palette.placeholder}
                />
                <Small style={{ marginTop: space.md, marginBottom: space.xs }}>Bible studies</Small>
                <TextInput
                  value={editStudies}
                  onChangeText={setEditStudies}
                  keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 12, color: palette.ink, backgroundColor: palette.surfaceAlt }}
                  placeholder="Bible studies"
                  placeholderTextColor={palette.placeholder}
                />
              </>
            ) : (
              <>
                <Small style={{ marginTop: space.lg, marginBottom: space.xs }}>Participated in ministry?</Small>
                <Button
                  label={editParticipated ? 'Yes — tap to change to No' : 'No — tap to change to Yes'}
                  variant="secondary"
                  onPress={() => setEditParticipated(v => !v)}
                />
                {editParticipated ? (
                  <>
                    <Small style={{ marginTop: space.md, marginBottom: space.xs }}>Bible studies</Small>
                    <TextInput
                      value={editStudies}
                      onChangeText={setEditStudies}
                      keyboardType="number-pad"
                      style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 12, color: palette.ink, backgroundColor: palette.surfaceAlt }}
                      placeholder="Bible studies"
                      placeholderTextColor={palette.placeholder}
                    />
                  </>
                ) : null}
              </>
            )}

            {editError ? <Notice tone="bad" message={editError} /> : null}
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <Button label="Cancel" variant="secondary" onPress={closeEdit} disabled={editBusy} style={{ flex: 1 }} />
              <Button label="Save changes" onPress={saveEditedReport} loading={editBusy} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  ) : null;

  if (groups.loading && !groups.data) return <Screen><LoadingView /></Screen>;

  if (!canViewGroupReports) {
    return <Screen><EmptyState title="Group reports restricted" message="Only an assigned group overseer or administrator can view these reports." /></Screen>;
  }

  // Secretaries can enter this page without a groupId and choose a group.
  if (canViewAllGroups && !selectedGroupId && !showUnassigned) {
    return (
      <Screen>
        <Title>Group Monthly Reports</Title>
        <Body style={{ marginBottom: space.lg }}>Choose a ministry group to view its reports.</Body>
        <Card onPress={() => navigation.navigate('GroupReport', { unassigned: true })} accessibilityLabel="Unassigned reports">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Heading>Unassigned reports</Heading>
              <Small>Reports from people who are not assigned to a ministry group</Small>
            </View>
            <Body>›</Body>
          </View>
        </Card>
        {(groups.data ?? []).map(group => (
          <Card key={group.id} onPress={() => navigation.navigate('GroupReport', { groupId: group.id })} accessibilityLabel={group.name}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Heading>{group.name}</Heading>
                <Small>{group.overseerId ? 'Overseer assigned' : 'No overseer assigned'}</Small>
              </View>
              <Body>›</Body>
            </View>
          </Card>
        ))}
        {!groups.data?.length ? <EmptyState title="No groups yet" message="Create ministry groups first." /> : null}
      </Screen>
    );
  }

  if (showUnassigned && canViewUnassigned) {
    const submitted = reports.data?.length ?? 0;
    const loading = reports.loading && !reports.data;
    return (
      <Screen>
        <Button
          label={canViewAllGroups ? '← All groups' : '← Back'}
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ marginBottom: space.md }}
        />
        <Title>Unassigned reports</Title>
        <MonthFilter value={selectedMonthKey} onChange={setSelectedMonthKey} currentMonthKey={currentMonthKey} />
        <Body>{formatMonthLong(selectedMonthKey)} · {submitted} report{submitted === 1 ? '' : 's'} received</Body>
        <Notice tone="info" message="These reports are still visible to administrators even when the member has no ministry group." />
        {reports.error ? <Notice tone="bad" message={reports.error} /> : null}
        {loading ? <LoadingView /> : null}
        {!loading && !reports.error && !reports.data?.length ? <EmptyState title="No unassigned reports" message={`No reports have been submitted without a ministry group in ${formatMonthLong(selectedMonthKey)}.`} /> : null}
        {(reports.data ?? []).map(report => (
          <Card key={report.id} style={{ marginTop: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <Heading>{report.reporterName ?? report.uid}</Heading>
                <Small>{REPORTING_TYPE_LABELS[report.reportingType]}</Small>
              </View>
              <Badge label="Submitted" tone="good" />
            </View>
            <Body style={{ marginTop: space.sm }}>{summarizeReport(report.reportingType, report)}</Body>
            {canEditReports ? (
              <Button
                label="Edit report"
                variant="secondary"
                onPress={() => openEdit(report)}
                style={{ marginTop: space.md }}
              />
            ) : null}
          </Card>
        ))}
        {editModal}
      </Screen>
    );
  }

  // A non-secretary may only use this screen when they are the assigned overseer.
  if (!canViewAllGroups && !overseerGroup) {
    return <Screen><EmptyState title="No group report" message="You are not currently assigned as a ministry group overseer." /></Screen>;
  }

  if (!selectedGroup) {
    return <Screen><EmptyState title="Group not found" message="The group may have been removed or changed by an administrator." /></Screen>;
  }

  const submitted = reports.data?.length ?? 0;
  const loading = reports.loading && !reports.data;

  return (
    <Screen>
      {canViewAllGroups ? (
        <Button label="← All groups" variant="secondary" onPress={() => navigation.navigate('GroupReport', undefined)} style={{ marginBottom: space.md }} />
      ) : null}
      <Title>{selectedGroup.name}</Title>
      <MonthFilter value={selectedMonthKey} onChange={setSelectedMonthKey} currentMonthKey={currentMonthKey} />
      <Body>{formatMonthLong(selectedMonthKey)} · {submitted} report{submitted === 1 ? '' : 's'} received</Body>

      {reports.error ? <Notice tone="bad" message={reports.error} /> : null}
      {loading ? <LoadingView /> : null}
      {!loading && !reports.error && !reports.data?.length ? (
        <EmptyState title="No reports yet" message={`No reports were submitted for ${formatMonthLong(selectedMonthKey)}.`} />
      ) : null}

      {(reports.data ?? []).map(report => (
        <Card key={report.id} style={{ marginTop: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Heading>{report.reporterName ?? report.uid}</Heading>
              <Small>{REPORTING_TYPE_LABELS[report.reportingType]}</Small>
            </View>
            <Badge label="Submitted" tone="good" />
          </View>
          <Body style={{ marginTop: space.sm }}>{summarizeReport(report.reportingType, report)}</Body>
          {canEditReports ? (
            <Button
              label="Edit report"
              variant="secondary"
              onPress={() => openEdit(report)}
              style={{ marginTop: space.md }}
            />
          ) : null}
        </Card>
      ))}

      <Small style={{ marginTop: space.lg }}>
        Only reports submitted with this group are shown. A later group reassignment does not move an old report.
      </Small>
      {editModal}
    </Screen>
  );
}
