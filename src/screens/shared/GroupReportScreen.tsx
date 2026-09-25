import React, { useMemo } from 'react';
import { View } from 'react-native';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import type {
  RouteProp,
} from '@react-navigation/native';

import { Screen } from '../../components/Screen';

import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Heading,
  LoadingView,
  Notice,
  Small,
  Title,
} from '../../components/ui';

import { useAppData } from '../../context/AppDataContext';

import { useLive } from '../../hooks/useLive';

import { AdminStackParams } from '../../navigation/types';

import { subscribeToGroups } from '../../services/groupService';

import {
  subscribeToGroupReports,
} from '../../services/reportService';

import {
  MinistryGroup,
  MonthlyReport,
} from '../../types';

import { space } from '../../theme';

import {
  formatMonthLong,
} from '../../utils/dates';

import {
  REPORTING_TYPE_LABELS,
  summarizeReport,
} from '../../utils/reports';

export default function GroupReportScreen() {
  const navigation =
    useNavigation();

  const route =
    useRoute<
      RouteProp<
        AdminStackParams,
        'GroupReport'
      >
    >();

  const {
    profile,
    currentMonthKey,
  } = useAppData();

  const groups =
    useLive<MinistryGroup[]>(
      subscribeToGroups,
      [],
    );

  const requestedGroupId =
    route.params?.groupId;

  const overseerGroup =
    useMemo(
      () =>
        (groups.data ?? []).find(
          g =>
            g.overseerId ===
            profile.id,
        ),
      [
        groups.data,
        profile.id,
      ],
    );

  /*
   * Admins and Secretaries can choose
   * any group.
   *
   * A normal group overseer can only
   * use their own assigned group.
   */
  const canViewAllGroups =
    profile.role === 'admin' ||
    profile.isSecretary === true;

  const selectedGroupId =
    requestedGroupId ??
    (canViewAllGroups
      ? undefined
      : overseerGroup?.id);

  const selectedGroup =
    useMemo(
      () =>
        (groups.data ?? []).find(
          g =>
            g.id ===
            selectedGroupId,
        ),
      [
        groups.data,
        selectedGroupId,
      ],
    );

  const reports =
    useLive<MonthlyReport[]>(
      (ok, err) =>
        selectedGroupId
          ? subscribeToGroupReports(
              selectedGroupId,
              currentMonthKey,
              ok,
              err,
            )
          : () => {},

      [
        selectedGroupId,
        currentMonthKey,
      ],
    );

  if (
    groups.loading &&
    !groups.data
  ) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  /*
   * Admin OR Secretary:
   * show all groups when no group
   * has been selected yet.
   */
  if (
    canViewAllGroups &&
    !selectedGroupId
  ) {
    return (
      <Screen>
        <Title>
          Group Monthly Reports
        </Title>

        <Body
          style={{
            marginBottom:
              space.lg,
          }}>
          {profile.isSecretary &&
          profile.role !== 'admin'
            ? 'As secretary, you can view reports from all ministry groups.'
            : 'Choose a ministry group to view its reports.'}
        </Body>

        {(groups.data ?? []).map(
          group => (
            <Card
              key={group.id}
              onPress={() =>
                navigation.navigate(
                  'GroupReport',
                  {
                    groupId:
                      group.id,
                  },
                )
              }
              accessibilityLabel={
                group.name
              }>
              <View
                style={{
                  flexDirection:
                    'row',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                }}>
                <View
                  style={{
                    flex: 1,
                  }}>
                  <Heading>
                    {group.name}
                  </Heading>

                  <Small>
                    {group.overseerId
                      ? 'Overseer assigned'
                      : 'No overseer assigned'}
                  </Small>
                </View>

                <Body>
                  ›
                </Body>
              </View>
            </Card>
          ),
        )}

        {!groups.data?.length ? (
          <EmptyState
            title="No groups yet"
            message="Create ministry groups first."
          />
        ) : null}
      </Screen>
    );
  }

  /*
   * Normal users who are not secretaries
   * must be assigned as an overseer.
   */
  if (
    !canViewAllGroups &&
    !overseerGroup
  ) {
    return (
      <Screen>
        <EmptyState
          title="No group report"
          message="You are not currently assigned as a ministry group overseer."
        />
      </Screen>
    );
  }

  if (!selectedGroup) {
    return (
      <Screen>
        <EmptyState
          title="Group not found"
          message="The group may have been removed or changed by an administrator."
        />
      </Screen>
    );
  }

  const submitted =
    reports.data?.length ?? 0;

  const loading =
    reports.loading &&
    !reports.data;

  return (
    <Screen>
      {canViewAllGroups ? (
        <Button
          label="← All groups"
          variant="secondary"
          onPress={() =>
            navigation.navigate(
              'GroupReport',
              undefined,
            )
          }
          style={{
            marginBottom:
              space.md,
          }}
        />
      ) : null}

      <Title>
        {selectedGroup.name}
      </Title>

      <Body>
        {formatMonthLong(
          currentMonthKey,
        )}{' '}
        · {submitted} report
        {submitted === 1
          ? ''
          : 's'} received
      </Body>

      {reports.error ? (
        <Notice
          tone="bad"
          message={
            reports.error
          }
        />
      ) : null}

      {loading ? (
        <LoadingView />
      ) : null}

      {!loading &&
      !reports.error &&
      !reports.data?.length ? (
        <EmptyState
          title="No reports yet"
          message="Reports will appear here as members submit them."
        />
      ) : null}

      {(reports.data ?? []).map(
        report => (
          <Card
            key={report.id}
            style={{
              marginTop:
                space.md,
            }}>
            <View
              style={{
                flexDirection:
                  'row',
                justifyContent:
                  'space-between',
                alignItems:
                  'flex-start',
              }}>
              <View
                style={{
                  flex: 1,
                  paddingRight:
                    space.sm,
                }}>
                <Heading>
                  {report.reporterName ??
                    report.uid}
                </Heading>

                <Small>
                  {
                    REPORTING_TYPE_LABELS[
                      report.reportingType
                    ]
                  }
                </Small>
              </View>

              <Badge
                label="Submitted"
                tone="good"
              />
            </View>

            <Body
              style={{
                marginTop:
                  space.sm,
              }}>
              {summarizeReport(
                report.reportingType,
                report,
              )}
            </Body>
          </Card>
        ),
      )}

      <Small
        style={{
          marginTop:
            space.lg,
        }}>
        Only reports submitted with
        this group are shown. A later
        group reassignment does not move
        an old report.
      </Small>
    </Screen>
  );
}