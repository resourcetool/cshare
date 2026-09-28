import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Chip, ChipRow, EmptyState, LoadingView, Notice, Small, TextField } from '../../components/ui';
import { useLive } from '../../hooks/useLive';
import { AdminNav, AdminTabParams, PeopleFilter } from '../../navigation/types';
import { subscribeToUsers } from '../../services/userService';
import { PrivilegeRole, ReportingType, UserProfile } from '../../types';
import { space } from '../../theme';
import { filterPeople, isTurnedOff, isWaiting } from '../../utils/people';
import { ROLE_LABELS, ROLE_ORDER } from '../../utils/qualifications';
import { REPORTING_TYPES, REPORTING_TYPE_LABELS } from '../../utils/reports';

const FILTERS: { key: PeopleFilter; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'admins', label: 'Admins' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'inactive', label: 'Turned off' },
];

/** Enrollment = how the person reports field service (publisher, pioneers...). */
type EnrollmentFilter = 'all' | ReportingType;
/** Qualification = the privilege(s) an admin has marked (publisher ... elder), or none set yet. */
type QualificationFilter = 'all' | PrivilegeRole | 'none';

const matchesEnrollment = (u: UserProfile, f: EnrollmentFilter): boolean => f === 'all' || u.reportingType === f;
const matchesQualification = (u: UserProfile, f: QualificationFilter): boolean => {
  if (f === 'all') return true;
  const quals = u.qualifications ?? [];
  if (f === 'none') return quals.length === 0;
  return quals.includes(f);
};

export default function PeopleScreen() {
  const nav = useNavigation<AdminNav>();
  const route = useRoute<RouteProp<AdminTabParams, 'People'>>();
  const [filter, setFilter] = useState<PeopleFilter>(route.params?.filter ?? 'everyone');
  const [enrollment, setEnrollment] = useState<EnrollmentFilter>('all');
  const [qualification, setQualification] = useState<QualificationFilter>('all');
  const [query, setQuery] = useState('');
  // Filters are tucked away by default so the list gets the whole screen.
  const [showFilters, setShowFilters] = useState(false);
  const users = useLive<UserProfile[]>(subscribeToUsers, []);

  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  const all = users.data ?? [];
  const rows = useMemo(
    () => filterPeople(all, filter, query).filter(u => matchesEnrollment(u, enrollment) && matchesQualification(u, qualification)),
    [all, filter, query, enrollment, qualification],
  );

  // Each group's counts respect the OTHER filters (but ignore the search text), so a chip's
  // number is what you would get by tapping it.
  const statusCounts = useMemo(() => {
    const c = {} as Record<PeopleFilter, number>;
    FILTERS.forEach(f => {
      c[f.key] = filterPeople(all, f.key, '').filter(u => matchesEnrollment(u, enrollment) && matchesQualification(u, qualification)).length;
    });
    return c;
  }, [all, enrollment, qualification]);

  const enrollmentCounts = useMemo(() => {
    const base = filterPeople(all, filter, '').filter(u => matchesQualification(u, qualification));
    const c = { all: base.length } as Record<EnrollmentFilter, number>;
    REPORTING_TYPES.forEach(t => {
      c[t] = base.filter(u => u.reportingType === t).length;
    });
    return c;
  }, [all, filter, qualification]);

  const qualificationCounts = useMemo(() => {
    const base = filterPeople(all, filter, '').filter(u => matchesEnrollment(u, enrollment));
    const c = { all: base.length, none: base.filter(u => matchesQualification(u, 'none')).length } as Record<QualificationFilter, number>;
    ROLE_ORDER.forEach(r => {
      c[r] = base.filter(u => matchesQualification(u, r)).length;
    });
    return c;
  }, [all, filter, enrollment]);

  const activeLabel = FILTERS.find(f => f.key === filter)?.label ?? 'Everyone';
  const activeFilterCount = Number(filter !== 'everyone') + Number(enrollment !== 'all') + Number(qualification !== 'all');
  const isFiltered = activeFilterCount > 0 || query.trim().length > 0;
  const summary = isFiltered ? `Showing ${rows.length} of ${all.length} people` : `${all.length} ${all.length === 1 ? 'person' : 'people'} in total`;

  const toggleLabel = showFilters
    ? 'Hide filters ▲'
    : activeFilterCount === 0
      ? 'Filters ▼'
      : activeFilterCount === 1 && filter !== 'everyone'
        ? `Filter: ${activeLabel} ▼`
        : `Filters (${activeFilterCount}) ▼`;

  const clearAll = () => {
    setFilter('everyone');
    setEnrollment('all');
    setQualification('all');
  };

  return (
    <Screen inTabs scroll={false}>
      <Button label="Ministry groups" variant="secondary" onPress={() => nav.navigate('Groups')} style={{ marginBottom: space.md }} />
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name or phone" />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
        <Body style={{ fontWeight: '700' }}>{summary}</Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters(v => !v)}
          hitSlop={8}
          style={{ paddingVertical: space.xs, paddingHorizontal: space.sm }}>
          <Body style={{ fontWeight: '700' }}>{toggleLabel}</Body>
        </Pressable>
      </View>

      {showFilters ? (
        <View>
          <Small style={{ marginTop: space.xs }}>Status</Small>
          <ChipRow>
            {FILTERS.map(f => (
              <Chip key={f.key} label={`${f.label} (${statusCounts[f.key]})`} selected={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ChipRow>

          <Small style={{ marginTop: space.xs }}>Enrollment</Small>
          <ChipRow>
            <Chip label={`Any (${enrollmentCounts.all})`} selected={enrollment === 'all'} onPress={() => setEnrollment('all')} />
            {REPORTING_TYPES.map(t => (
              <Chip
                key={t}
                label={`${REPORTING_TYPE_LABELS[t]} (${enrollmentCounts[t]})`}
                selected={enrollment === t}
                onPress={() => setEnrollment(enrollment === t ? 'all' : t)}
              />
            ))}
          </ChipRow>

          <Small style={{ marginTop: space.xs }}>Qualification</Small>
          <ChipRow>
            <Chip label={`Any (${qualificationCounts.all})`} selected={qualification === 'all'} onPress={() => setQualification('all')} />
            {ROLE_ORDER.map(r => (
              <Chip
                key={r}
                label={`${ROLE_LABELS[r]} (${qualificationCounts[r]})`}
                selected={qualification === r}
                onPress={() => setQualification(qualification === r ? 'all' : r)}
              />
            ))}
            <Chip label={`Not set (${qualificationCounts.none})`} selected={qualification === 'none'} onPress={() => setQualification(qualification === 'none' ? 'all' : 'none')} />
          </ChipRow>

          {activeFilterCount > 0 ? (
            <Button label="Clear filters" variant="secondary" onPress={clearAll} style={{ marginTop: space.xs }} />
          ) : null}
        </View>
      ) : null}

      {users.error ? <Notice tone="warn" message={users.error} /> : null}
      {users.loading && !users.data ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={u => u.id}
          style={{ marginTop: space.sm }}
          ListEmptyComponent={<EmptyState title="Nobody here" message={filter === 'waiting' && activeFilterCount === 1 ? 'Nobody is waiting for approval.' : 'No people match.'} />}
          renderItem={({ item: u }) => (
            <Card onPress={() => nav.navigate('PersonEdit', { userId: u.id })} accessibilityLabel={u.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Body style={{ fontWeight: '700' }}>{u.name}</Body>
                  <Small>{u.phone || 'No phone number'}</Small>
                  <Small>{REPORTING_TYPE_LABELS[u.reportingType]}</Small>
                </View>
                {u.role === 'admin' ? <Badge label="Admin" tone="info" /> : null}
                {isWaiting(u) ? <Badge label="Waiting" tone="warn" /> : null}
                {isTurnedOff(u) ? <Badge label="Turned off" /> : null}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
