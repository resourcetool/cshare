import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Card, Chip, ChipRow, EmptyState, LoadingView, Notice, Small, TextField } from '../../components/ui';
import { useLive } from '../../hooks/useLive';
import { subscribeToPublicPeople } from '../../services/userService';
import { PublicPerson, PrivilegeRole, ReportingType } from '../../types';
import { space } from '../../theme';
import { rolesLabel } from '../../utils/qualifications';
import { REPORTING_TYPE_LABELS } from '../../utils/reports';

type Filter = 'all' | PrivilegeRole;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'baptized_publisher', label: 'Baptized' },
  { key: 'ministerial_servant', label: 'Ministerial' },
  { key: 'elder', label: 'Elder' },
];

function matchesQualification(person: PublicPerson, filter: Filter): boolean {
  if (filter === 'all') return true;
  return person.qualifications.includes(filter);
}

function enrollmentLabel(type: ReportingType): string {
  return REPORTING_TYPE_LABELS[type] ?? 'Publisher';
}

export default function PeopleDirectoryScreen() {
  const people = useLive<PublicPerson[]>(subscribeToPublicPeople, []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = people.data ?? [];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(person => {
      if (!matchesQualification(person, filter)) return false;
      if (!q) return true;
      return `${person.name} ${person.phone}`.toLowerCase().includes(q);
    });
  }, [list, query, filter]);

  const adminCount = list.filter(p => p.role === 'admin').length;

  return (
    <Screen scroll={false}>
      <Card style={{ marginBottom: space.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <View style={{ minWidth: '45%' }}>
            <Small>Total people</Small>
            <Body style={{ fontWeight: '700' }}>{list.length}</Body>
          </View>
          <View style={{ minWidth: '45%' }}>
            <Small>Administrators</Small>
            <Body style={{ fontWeight: '700' }}>{adminCount}</Body>
          </View>
        </View>
      </Card>

      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Name or phone"
      />

      <ChipRow>
        {FILTERS.map(item => (
          <Chip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ChipRow>

      {people.error ? <Notice tone="warn" message={people.error} /> : null}

      {people.loading && !people.data ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={person => person.id}
          style={{ marginTop: space.sm }}
          ListEmptyComponent={<EmptyState title="Nobody here" message="No people match." />}
          renderItem={({ item: person }) => (
            <Card accessibilityLabel={person.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Body style={{ fontWeight: '700' }}>{person.name}</Body>
                  <Small>{person.phone || 'No phone number'}</Small>
                  <Small style={{ marginTop: space.xs }}>{enrollmentLabel(person.reportingType)}</Small>
                  <Small>{rolesLabel(person.qualifications)}</Small>
                </View>
                {person.role === 'admin' ? <Badge label="Admin" tone="info" /> : null}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
