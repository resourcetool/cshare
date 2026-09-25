import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Chip, ChipRow, EmptyState, LoadingView, Notice, Small, TextField } from '../../components/ui';
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

export default function PeopleScreen() {
  const nav = useNavigation<AdminNav>();
  const route = useRoute<RouteProp<AdminTabParams, 'People'>>();
  const [filter, setFilter] = useState<PeopleFilter>(route.params?.filter ?? 'everyone');
  const [query, setQuery] = useState('');
  const users = useLive<UserProfile[]>(subscribeToUsers, []);

  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  const rows = filterPeople(users.data ?? [], filter, query);

  return (
    <Screen inTabs scroll={false}>
      <Button label="Ministry groups" variant="secondary" onPress={() => nav.navigate('Groups')} style={{ marginBottom: space.md }} />
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name or phone" />
      <ChipRow>
        {FILTERS.map(f => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      {users.error ? <Notice tone="warn" message={users.error} /> : null}
      {users.loading && !users.data ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={u => u.id}
          style={{ marginTop: space.sm }}
          ListEmptyComponent={<EmptyState title="Nobody here" message={filter === 'waiting' ? 'Nobody is waiting for approval.' : 'No people match.'} />}
          renderItem={({ item: u }) => (
            <Card onPress={() => nav.navigate('PersonEdit', { userId: u.id })} accessibilityLabel={u.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: space.sm }}>
                  <Body style={{ fontWeight: '700' }}>{u.name}</Body>
                  <Small>{u.phone || 'No phone number'}</Small>
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
