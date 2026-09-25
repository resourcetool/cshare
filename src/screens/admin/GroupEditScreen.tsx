import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { confirmAsync } from '../../components/confirm';
import { Badge, Body, Button, EmptyState, Heading, Label, LoadingView, Notice, Small, TextField } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useLive } from '../../hooks/useLive';
import { AdminStackParams } from '../../navigation/types';
import { deleteGroup, movePersonToGroup, saveGroup, subscribeToGroups } from '../../services/groupService';
import { subscribeToUsers } from '../../services/userService';
import { MinistryGroup, UserProfile } from '../../types';
import { radius, space, TOUCH } from '../../theme';
import { friendlyError, logError } from '../../utils/errors';

export default function GroupEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AdminStackParams, 'GroupEdit'>>();
  const { palette } = useTheme();
  const groupId = route.params?.groupId;
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const users = useLive<UserProfile[]>(subscribeToUsers, []);
  const existing = groupId ? (groups.data ?? []).find(g => g.id === groupId) : undefined;

  const [name, setName] = useState('');
  const [overseerId, setOverseerId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(!groupId);
  const [busy, setBusy] = useState<string | null>(null); // uid currently being moved, or 'save'/'delete'
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (groupId && existing && !loaded) {
      setName(existing.name);
      setOverseerId(existing.overseerId);
      setLoaded(true);
    }
  }, [groupId, existing, loaded]);

  const people = useMemo(() => (users.data ?? []).filter(u => u.active), [users.data]);
  const members = useMemo(() => people.filter(u => u.groupId === groupId), [people, groupId]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(u => !q || u.name.toLowerCase().includes(q));
  }, [people, query]);

  if (groupId && (groups.loading || users.loading) && !loaded) return <Screen><LoadingView /></Screen>;
  if (groupId && !existing && !groups.loading) {
    return <Screen><EmptyState title="Group not found" actionLabel="Go back" onAction={navigation.goBack} /></Screen>;
  }

  const save = async () => {
    if (!name.trim()) return setError('Please enter a name for this group.');
    setBusy('save');
    setError(null);
    try {
      const result = await saveGroup({ id: groupId, name: name.trim(), overseerId, sortOrder: existing?.sortOrder ?? Date.now() % 100000 });
      if (result === 'queued') setError('Saved on this phone. It will be sent when you have internet.');
      else navigation.goBack();
    } catch (e) {
      logError('save group', e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!groupId) return;
    const ok = await confirmAsync('Remove this group?', members.length ? `${members.length} ${members.length === 1 ? 'person is' : 'people are'} in this group. They will no longer be in a group; they will not be removed from CSHARE.` : 'This group has no one in it yet.', 'Remove', true);
    if (!ok) return;
    setBusy('delete');
    setError(null);
    try {
      await Promise.all(members.map(m => movePersonToGroup(m.id, undefined)));
      const result = await deleteGroup(groupId);
      if (result === 'queued') setError('Removed on this phone. It will sync when you have internet.');
      else navigation.goBack();
    } catch (e) {
      logError('delete group', e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleMember = async (u: UserProfile) => {
    if (!groupId) return; // save the group first, so there is somewhere to move them into
    const inThisGroup = u.groupId === groupId;
    setBusy(u.id);
    setError(null);
    try {
      await movePersonToGroup(u.id, inThisGroup ? undefined : groupId);
    } catch (e) {
      logError('move person to group', e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen footer={<Button label={groupId ? 'Save' : 'Add group'} onPress={save} loading={busy === 'save'} />}>
      {error ? <Notice tone={error.startsWith('Saved') || error.startsWith('Removed') ? 'info' : 'bad'} message={error} /> : null}
      <TextField label="Group name" value={name} onChangeText={setName} placeholder="For example: Group 1" autoCapitalize="words" />

      <Label style={{ marginBottom: space.sm }}>Group overseer</Label>
      <Small style={{ marginBottom: space.sm }}>Optional. Can be anyone, not only someone already in this group.</Small>
      {[undefined, ...people.map(u => u.id)].map(id => (
        <Pressable
          key={id ?? 'none'}
          accessibilityRole="button"
          accessibilityLabel={id ? people.find(u => u.id === id)?.name : 'No overseer'}
          onPress={() => setOverseerId(id)}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginBottom: space.xs }}>
          <Body style={{ fontWeight: overseerId === id ? '700' : '400', color: overseerId === id ? palette.primary : palette.ink }}>
            {overseerId === id ? '● ' : '○ '}{id ? people.find(u => u.id === id)?.name : 'No overseer'}
          </Body>
        </Pressable>
      ))}

      {groupId ? (
        <>
          <Heading style={{ marginTop: space.xl, marginBottom: space.sm }}>People ({members.length})</Heading>
          <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name" />
          {candidates.map(u => {
            const inThisGroup = u.groupId === groupId;
            const otherGroup = !inThisGroup && u.groupId ? groups.data?.find(g => g.id === u.groupId) : undefined;
            return (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                accessibilityLabel={u.name}
                accessibilityState={{ selected: inThisGroup }}
                onPress={() => toggleMember(u)}
                disabled={busy === u.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, padding: space.md, marginBottom: space.sm, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: palette.surface, borderColor: palette.line },
                  inThisGroup && { borderColor: palette.primary, backgroundColor: palette.primarySoft },
                ]}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: inThisGroup ? '700' : '400' }}>{u.name}</Body>
                  {otherGroup ? <Small>Currently in {otherGroup.name}</Small> : null}
                </View>
                {inThisGroup ? <Badge label="In this group" tone="good" /> : null}
              </Pressable>
            );
          })}
          <Button label="Remove this group" variant="danger" onPress={remove} loading={busy === 'delete'} style={{ marginTop: space.lg }} />
        </>
      ) : (
        <Small>Save the group first, then you can add people to it.</Small>
      )}
    </Screen>
  );
}
