import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { confirmAsync } from '../../components/confirm';
import { Badge, Body, Button, Chip, ChipRow, EmptyState, LoadingView, Notice, SectionTitle, Small, SwitchRow, TextField } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { AdminStackParams } from '../../navigation/types';
import { addDependentByAdmin, editDependentByAdmin, removeDependentByAdmin, subscribeToUsers, updateUserByAdmin } from '../../services/userService';
import { subscribeToGroups } from '../../services/groupService';
import { Dependent, MinistryGroup, PrivilegeRole, ReportingType, UserProfile } from '../../types';
import { space } from '../../theme';
import { callNumber, textNumber } from '../../utils/contact';
import { friendlyError, logError } from '../../utils/errors';
import { isWaiting } from '../../utils/people';
import { combineRoles, splitRoles } from '../../utils/qualifications';
import { REPORTING_TYPES, REPORTING_TYPE_LABELS } from '../../utils/reports';

export default function PersonEditScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParams>>();
  const route = useRoute<RouteProp<AdminStackParams, 'PersonEdit'>>();
  const { profile: me } = useAppData();
  const users = useLive<UserProfile[]>(subscribeToUsers, []);
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const person = (users.data ?? []).find(u => u.id === route.params.userId);
  const isSelf = person?.id === me.id;

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [base, setBase] = useState<'publisher' | 'baptized_publisher' | undefined>(undefined);
  const [appointment, setAppointment] = useState<'ministerial_servant' | 'elder' | undefined>(undefined);
  const [reportingType, setReportingType] = useState<ReportingType>('publisher');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [depBusy, setDepBusy] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [editingDepId, setEditingDepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (person && !loaded) {
      setName(person.name);
      setPhone(person.phone);
      setActive(person.active);
      setAdmin(person.role === 'admin');
      const split = splitRoles(person.qualifications);
      setBase(split.base);
      setAppointment(split.appointment);
      setReportingType(person.reportingType);
      setGroupId(person.groupId);
      setLoaded(true);
    }
  }, [person, loaded]);

  if (!person) {
    return <Screen>{users.loading ? <LoadingView /> : <EmptyState title="Person not found" actionLabel="Go back" onAction={navigation.goBack} />}</Screen>;
  }

  const waiting = isWaiting(person);
  const qualifications: PrivilegeRole[] = combineRoles(base, appointment);

  const save = async (approve = false) => {
    if (!name.trim()) return setError('Please enter a name.');
    if (!isSelf && admin && person.role !== 'admin') {
      const ok = await confirmAsync('Make an administrator?', `${name.trim()} will be able to manage people and assignments.`, 'Make administrator');
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateUserByAdmin(person.id, {
        name: name.trim(),
        phone: phone.trim(),
        qualifications,
        reportingType,
        groupId: groupId ?? null,
        ...(isSelf ? {} : { role: admin ? 'admin' : 'user', active: approve ? true : active }),
        ...(approve ? { approve: true } : {}),
      });
      if (result === 'queued') setError('Saved on this phone. It will be sent when you have internet.');
      else navigation.goBack();
    } catch (e) {
      logError('save person', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const isDuplicateChildName = (candidate: string, ignoreId?: string) =>
    (person.dependents ?? []).some(d => d.id !== ignoreId && d.name.trim().toLowerCase() === candidate.trim().toLowerCase());

  const startEditChild = (dep: Dependent) => {
    setEditingDepId(dep.id);
    setNewChildName(dep.name);
    setError(null);
  };

  const cancelEditChild = () => {
    setEditingDepId(null);
    setNewChildName('');
  };

  const saveChild = async () => {
    const childName = newChildName.trim();
    if (!childName) return setError("Please enter the child's name.");
    if (isDuplicateChildName(childName, editingDepId ?? undefined)) return setError(`${childName} is already added for this person.`);
    setDepBusy(true);
    setError(null);
    try {
      const result = editingDepId
        ? await editDependentByAdmin(person.id, editingDepId, childName, person.dependents ?? [])
        : await addDependentByAdmin(person.id, childName);
      setNewChildName('');
      setEditingDepId(null);
      if (result === 'queued') setError('Saved on this phone. It will be sent when you have internet.');
    } catch (e) {
      logError(editingDepId ? 'edit dependent' : 'add dependent', e);
      setError(friendlyError(e));
    } finally {
      setDepBusy(false);
    }
  };

  const removeChild = async (dep: Dependent) => {
    const ok = await confirmAsync('Remove this child?', `${dep.name} will no longer show up as someone you can assign a part to.`, 'Remove');
    if (!ok) return;
    if (editingDepId === dep.id) cancelEditChild();
    setDepBusy(true);
    setError(null);
    try {
      const result = await removeDependentByAdmin(person.id, dep);
      if (result === 'queued') setError('Saved on this phone. It will be sent when you have internet.');
    } catch (e) {
      logError('remove dependent', e);
      setError(friendlyError(e));
    } finally {
      setDepBusy(false);
    }
  };

  return (
    <Screen
      footer={
        waiting ? (
          <Button label="Approve and save" onPress={() => save(true)} loading={busy} />
        ) : (
          <Button label="Save" onPress={() => save(false)} loading={busy} />
        )
      }>
      {waiting ? <Notice tone="warn" message="This person signed up and is waiting for you to approve them. Check that you know who they are." /> : null}
      {error ? <Notice tone={error.startsWith('Saved') ? 'info' : 'bad'} message={error} /> : null}

      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <TextField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Email" value={person.email} onChangeText={() => {}} editable={false} />
      {phone ? (
        <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
          <Button label="Call" variant="secondary" onPress={() => callNumber(phone)} style={{ flex: 1 }} />
          <Button label="Text" variant="secondary" onPress={() => textNumber(phone)} style={{ flex: 1 }} />
        </View>
      ) : null}

      {isSelf ? (
        <Small>You cannot change your own access. Ask another administrator.</Small>
      ) : (
        <>
          {!waiting ? <SwitchRow label="Account is active" description="Turn off to stop this person using CSHARE." value={active} onValueChange={setActive} /> : null}
          <SwitchRow label="Administrator" description="Can manage people and assignments." value={admin} onValueChange={setAdmin} />
        </>
      )}

      <SectionTitle>Qualifications</SectionTitle>
      <Body style={{ marginBottom: space.sm }}>These are the only qualifications CSHARE tracks. Pick a standing, and — if it applies — one appointment. That is at most two.</Body>
      <Small>Standing</Small>
      <ChipRow>
        <Chip label="Publisher" selected={base === 'publisher'} onPress={() => setBase(base === 'publisher' ? undefined : 'publisher')} />
        <Chip label="Baptized Publisher" selected={base === 'baptized_publisher'} onPress={() => setBase('baptized_publisher')} />
      </ChipRow>
      <Small style={{ marginTop: space.md }}>Appointment (optional)</Small>
      <ChipRow>
        <Chip label="None" selected={!appointment} onPress={() => setAppointment(undefined)} />
        <Chip label="Ministerial Servant" selected={appointment === 'ministerial_servant'} onPress={() => setAppointment('ministerial_servant')} />
        <Chip label="Elder" selected={appointment === 'elder'} onPress={() => setAppointment('elder')} />
      </ChipRow>
      {appointment && base !== 'baptized_publisher' ? <Small style={{ marginTop: space.xs }}>An appointment always counts as Baptized Publisher too.</Small> : null}

      <SectionTitle>Monthly report</SectionTitle>
      <Body style={{ marginBottom: space.sm }}>How this person reports their field service each month.</Body>
      <ChipRow>
        {REPORTING_TYPES.map(t => (
          <Chip key={t} label={REPORTING_TYPE_LABELS[t]} selected={reportingType === t} onPress={() => setReportingType(t)} />
        ))}
      </ChipRow>

      <SectionTitle>Ministry group</SectionTitle>
      {(groups.data ?? []).length === 0 ? (
        <Small>No groups have been set up yet. An administrator can add them from People → Groups.</Small>
      ) : (
        <ChipRow>
          <Chip label="No group" selected={!groupId} onPress={() => setGroupId(undefined)} />
          {(groups.data ?? []).map(g => (
            <Chip key={g.id} label={g.name} selected={groupId === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </ChipRow>
      )}

      {!isSelf ? (
        <>
          <SectionTitle>Children with no phone</SectionTitle>
          <Body style={{ marginBottom: space.sm }}>
            If this person has a child who is given an assignment but has no phone of their own, add them here. When the admin assigns the child a part, reminders, the reminder call and the phone calendar all reach this account instead.
          </Body>
          {(person.dependents ?? []).length === 0 ? <Small>No children added yet.</Small> : null}
          {(person.dependents ?? []).map(dep => (
            <View key={dep.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
              <Badge label={dep.name} tone={editingDepId === dep.id ? 'good' : undefined} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Rename" variant="ghost" onPress={() => startEditChild(dep)} disabled={depBusy} />
                <Button label="Remove" variant="ghost" onPress={() => removeChild(dep)} disabled={depBusy} />
              </View>
            </View>
          ))}
          <TextField label={editingDepId ? "Rename child" : "Child's name"} value={newChildName} onChangeText={setNewChildName} autoCapitalize="words" placeholder="For example: Kwame" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button label={editingDepId ? 'Save name' : 'Add child'} variant="secondary" onPress={saveChild} loading={depBusy} disabled={!newChildName.trim()} style={{ flex: 1 }} />
            {editingDepId ? <Button label="Cancel" variant="ghost" onPress={cancelEditChild} disabled={depBusy} /> : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
