import React from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, EmptyState, LoadingView, Notice, Small } from '../../components/ui';
import { useLive } from '../../hooks/useLive';
import { AdminNav } from '../../navigation/types';
import { subscribeToGroups } from '../../services/groupService';
import { subscribeToUsers } from '../../services/userService';
import { MinistryGroup, UserProfile } from '../../types';
import { space } from '../../theme';

export default function GroupsScreen() {
  const nav = useNavigation<AdminNav>();
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const users = useLive<UserProfile[]>(subscribeToUsers, []);
  const byId = Object.fromEntries((users.data ?? []).map(u => [u.id, u]));

  const loading = (groups.loading && !groups.data) || (users.loading && !users.data);

  return (
    <Screen scroll={false} footer={<Button label="Add a group" onPress={() => nav.navigate('GroupEdit', undefined)} />}>
      <Body style={{ marginBottom: space.md }}>
        Ministry groups for the congregation's field service arrangement. Set how many groups you need, then assign people and a group overseer to each.
      </Body>
      {groups.error ? <Notice tone="warn" message={groups.error} /> : null}
      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={groups.data ?? []}
          keyExtractor={g => g.id}
          ListEmptyComponent={<EmptyState title="No groups yet" message="Add your congregation's ministry groups here." />}
          renderItem={({ item: g }) => {
            const memberCount = (users.data ?? []).filter(u => u.groupId === g.id).length;
            const overseer = g.overseerId ? byId[g.overseerId] : undefined;
            return (
              <Card onPress={() => nav.navigate('GroupEdit', { groupId: g.id })} accessibilityLabel={g.name}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <Body style={{ fontWeight: '700' }}>{g.name}</Body>
                    <Small>{memberCount} {memberCount === 1 ? 'person' : 'people'}{overseer ? ` · Overseer: ${overseer.name}` : ''}</Small>
                  </View>
                  {!overseer ? <Badge label="No overseer" tone="warn" /> : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}
