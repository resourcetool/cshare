import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Screen } from '../../components/Screen';
import {
  Badge,
  Body,
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
import { subscribeToPublicPeople } from '../../services/userService';
import { PublicPerson } from '../../types';
import { space } from '../../theme';
import { rolesLabel } from '../../utils/qualifications';

type PeopleFilter =
  | 'everyone'
  | 'publisher'
  | 'baptized_publisher'
  | 'ministerial_servant'
  | 'elder';

const FILTERS: { key: PeopleFilter; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'baptized_publisher', label: 'Baptized' },
  { key: 'ministerial_servant', label: 'Ministerial Servant' },
  { key: 'elder', label: 'Elder' },
];

export default function PeopleDirectoryScreen() {
  const [filter, setFilter] = useState<PeopleFilter>('everyone');
  const [query, setQuery] = useState('');

  const people = useLive<PublicPerson[]>(subscribeToPublicPeople, []);

  const rows = useMemo(() => {
    const list = people.data ?? [];
    const search = query.trim().toLowerCase();

    return list.filter(person => {
      const matchesSearch =
        !search ||
        person.name.toLowerCase().includes(search) ||
        person.phone.toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (filter === 'everyone') return true;

      return person.qualifications?.includes(filter);
    });
  }, [people.data, query, filter]);

  const totalPeople = people.data?.length ?? 0;

  const administrators =
    people.data?.filter(person => person.role === 'admin').length ?? 0;

  return (
    <Screen inTabs scroll={false}>
      <Notice
        tone="warn"
        message="STRICT PRIVACY NOTICE: The information displayed here is for authorized congregation use only. Do NOT share, forward, copy, publish, screenshot, or disclose another person's name, phone number, enrollment, qualification, or other personal information without proper authorization. Treat everyone's personal information as confidential."
      />

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          marginTop: space.md,
          marginBottom: space.md,
        }}
      >
        <Card style={{ flex: 1 }}>
          <Small>Total people</Small>
          <Body style={{ fontSize: 22, fontWeight: '700', marginTop: 4 }}>
            {totalPeople}
          </Body>
        </Card>

        <Card style={{ flex: 1 }}>
          <Small>Administrators</Small>
          <Body style={{ fontSize: 22, fontWeight: '700', marginTop: 4 }}>
            {administrators}
          </Body>
        </Card>
      </View>

      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Name or phone number"
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

      {people.error ? (
        <Notice tone="warn" message={people.error} />
      ) : null}

      {people.loading && !people.data ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={person => person.id}
          style={{ marginTop: space.sm }}
          contentContainerStyle={{
            paddingBottom: space.lg,
          }}
          ListEmptyComponent={
            <EmptyState
              title="Nobody here"
              message="No congregation members match your search or filter."
            />
          }
          renderItem={({ item: person }) => (
            <Card
              accessibilityLabel={`Congregation member ${person.name}`}
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
                    {person.name}
                  </Body>

                  <Small style={{ marginTop: 2 }}>
                    {person.phone || 'No phone number'}
                  </Small>

                  {person.qualifications?.length ? (
                    <Small style={{ marginTop: 4 }}>
                      {rolesLabel(person.qualifications)}
                    </Small>
                  ) : (
                    <Small style={{ marginTop: 4 }}>
                      No qualification listed
                    </Small>
                  )}
                </View>

                {person.role === 'admin' ? (
                  <Badge label="Admin" tone="info" />
                ) : null}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}