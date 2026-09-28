import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { Screen } from '../../components/Screen';
import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  LoadingView,
  Notice,
  Small,
  TextField,
} from '../../components/ui';

import { useLive } from '../../hooks/useLive';
import { AdminNav, AdminTabParams, PeopleFilter } from '../../navigation/types';
import { subscribeToUsers } from '../../services/userService';
import { UserProfile } from '../../types';
import { space } from '../../theme';
import { filterPeople, isTurnedOff, isWaiting } from '../../utils/people';

const FILTERS: { key: PeopleFilter; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'admins', label: 'Admins' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'inactive', label: 'Turned off' },
];

type QualificationFilter =
  | 'all'
  | 'publisher'
  | 'baptized_publisher'
  | 'ministerial_servant'
  | 'elder';

const QUALIFICATION_FILTERS: {
  key: QualificationFilter;
  label: string;
}[] = [
  { key: 'all', label: 'All' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'baptized_publisher', label: 'Baptized' },
  { key: 'ministerial_servant', label: 'Ministerial' },
  { key: 'elder', label: 'Elder' },
];

function normaliseQualification(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function hasQualification(
  user: UserProfile,
  qualification: QualificationFilter,
): boolean {
  if (qualification === 'all') return true;

  // Publisher / Baptized Publisher are stored as reportingType.
  if (qualification === 'publisher') {
    return (
      user.reportingType === 'publisher'
    );
  }

  if (qualification === 'baptized_publisher') {
    return (
      user.reportingType === 'baptized_publisher'
    );
  }

  // Elder / Ministerial Servant are stored in qualifications.
  const qualifications = Array.isArray(user.qualifications)
    ? user.qualifications
    : [];

  const values = qualifications.map(normaliseQualification);

  if (qualification === 'elder') {
    return (
      values.includes('elder') ||
      values.includes('elders')
    );
  }

  if (qualification === 'ministerial_servant') {
    return (
      values.includes('ministerial_servant') ||
      values.includes('ministerial_servants') ||
      values.includes('ministerial')
    );
  }

  return true;
}

export default function PeopleScreen() {
  const nav = useNavigation<AdminNav>();
  const route = useRoute<RouteProp<AdminTabParams, 'People'>>();

  const [filter, setFilter] = useState<PeopleFilter>(
    route.params?.filter ?? 'everyone',
  );

  const [qualificationFilter, setQualificationFilter] =
    useState<QualificationFilter>('all');

  const [query, setQuery] = useState('');

  const users = useLive<UserProfile[]>(subscribeToUsers, []);

  useEffect(() => {
    if (route.params?.filter) {
      setFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  const allUsers = users.data ?? [];

  /*
   * Summary numbers
   */
  const totalPeople = allUsers.length;

  const adminCount = allUsers.filter(
    user => user.role === 'admin',
  ).length;

  const waitingCount = allUsers.filter(
    user => isWaiting(user),
  ).length;

  const turnedOffCount = allUsers.filter(
    user => isTurnedOff(user),
  ).length;

  /*
   * Apply the existing status filter first,
   * then apply the qualification filter.
   */
  const statusRows = filterPeople(
    allUsers,
    filter,
    query,
  );

  const rows = useMemo(() => {
    return statusRows.filter(user =>
      hasQualification(user, qualificationFilter),
    );
  }, [statusRows, qualificationFilter]);

  return (
    <Screen inTabs scroll={false}>
      <Button
        label="Ministry groups"
        variant="secondary"
        onPress={() => nav.navigate('Groups')}
        style={{ marginBottom: space.md }}
      />

      {/* ---------------------------------------------------------
          PEOPLE SUMMARY
          Kept deliberately simple and compact.
      ---------------------------------------------------------- */}
      <Card style={{ marginBottom: space.sm }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              minWidth: '23%',
              marginBottom: space.xs,
            }}
          >
            <Small>Total</Small>
            <Body style={{ fontWeight: '700' }}>
              {totalPeople}
            </Body>
          </View>

          <View
            style={{
              minWidth: '23%',
              marginBottom: space.xs,
            }}
          >
            <Small>Admins</Small>
            <Body style={{ fontWeight: '700' }}>
              {adminCount}
            </Body>
          </View>

          <View
            style={{
              minWidth: '23%',
              marginBottom: space.xs,
            }}
          >
            <Small>Waiting</Small>
            <Body style={{ fontWeight: '700' }}>
              {waitingCount}
            </Body>
          </View>

          <View
            style={{
              minWidth: '23%',
              marginBottom: space.xs,
            }}
          >
            <Small>Turned off</Small>
            <Body style={{ fontWeight: '700' }}>
              {turnedOffCount}
            </Body>
          </View>
        </View>
      </Card>

      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Name or phone"
      />

      {/* Status filters */}
      <ChipRow>
        {FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ChipRow>

      {/* Qualification filters */}
      <Small style={{ marginTop: space.sm }}>
        Qualification
      </Small>

      <ChipRow>
        {QUALIFICATION_FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            selected={qualificationFilter === f.key}
            onPress={() =>
              setQualificationFilter(f.key)
            }
          />
        ))}
      </ChipRow>

      {users.error ? (
        <Notice tone="warn" message={users.error} />
      ) : null}

      {users.loading && !users.data ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={u => u.id}
          style={{ marginTop: space.sm }}
          ListEmptyComponent={
            <EmptyState
              title="Nobody here"
              message={
                filter === 'waiting'
                  ? 'Nobody is waiting for approval.'
                  : 'No people match.'
              }
            />
          }
          renderItem={({ item: u }) => (
            <Card
              onPress={() =>
                nav.navigate('PersonEdit', {
                  userId: u.id,
                })
              }
              accessibilityLabel={u.name}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    flex: 1,
                    paddingRight: space.sm,
                  }}
                >
                  <Body style={{ fontWeight: '700' }}>
                    {u.name}
                  </Body>

                  <Small>
                    {u.phone || 'No phone number'}
                  </Small>
                </View>

                <View
                  style={{
                    alignItems: 'flex-end',
                  }}
                >
                  {u.role === 'admin' ? (
                    <Badge
                      label="Admin"
                      tone="info"
                    />
                  ) : null}

                  {isWaiting(u) ? (
                    <Badge
                      label="Waiting"
                      tone="warn"
                    />
                  ) : null}

                  {isTurnedOff(u) ? (
                    <Badge label="Turned off" />
                  ) : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}