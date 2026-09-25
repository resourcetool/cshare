import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { confirmAsync } from '../../components/confirm';
import { Button, Chip, ChipRow, Label, Notice, Stepper, SwitchRow, TextField } from '../../components/ui';
import { ICONS } from '../../constants';
import { Meeting, PrivilegeRole, RowKind } from '../../types';
import { useAppData } from '../../context/AppDataContext';
import { AdminStackParams } from '../../navigation/types';
import { deleteType, saveType } from '../../services/settingsService';
import { ROLE_LABELS, ROLE_ORDER } from '../../utils/qualifications';
import { space } from '../../theme';
import { friendlyError } from '../../utils/errors';

export default function TypeEditScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParams>>();
  const route = useRoute<RouteProp<AdminStackParams, 'TypeEdit'>>();
  const { types, settings } = useAppData();
  const typeId = route.params?.typeId;
  const existing = types.find(t => t.id === typeId);

  const [loaded, setLoaded] = useState(!typeId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(settings.categories[0] ?? '');
  const [requiresQualification, setRequires] = useState(true);
  const [multiple, setMultiple] = useState(false);
  const [active, setActive] = useState(true);
  const [kind, setKind] = useState<RowKind>('part');
  const [meeting, setMeeting] = useState<Meeting>('midweek');
  const [minutes, setMinutes] = useState(5);
  const [people, setPeople] = useState(1);
  const [numbered, setNumbered] = useState(true);
  const [icon, setIcon] = useState('📌');
  const [requiredRole, setRequiredRole] = useState<PrivilegeRole | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setDescription(existing.description);
      setCategory(existing.category);
      setRequires(existing.requiresQualification);
      setMultiple(existing.allowsMultipleAssignees);
      setActive(existing.active);
      setKind(existing.kind);
      setMeeting(existing.meeting);
      setMinutes(existing.minutes);
      setPeople(existing.people);
      setNumbered(existing.numbered);
      setIcon(existing.icon);
      setRequiredRole(existing.requiredRole);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const save = async () => {
    if (!name.trim()) return setError('Please enter a name.');
    if (requiresQualification && !requiredRole) return setError('Choose which qualification this part needs.');
    setBusy(true);
    setError(null);
    try {
      await saveType({
        id: typeId,
        name: name.trim(),
        description: description.trim(),
        category,
        requiresQualification,
        allowsMultipleAssignees: multiple,
        active,
        kind,
        meeting,
        minutes,
        people: kind === 'part' ? people : 1,
        numbered: kind === 'part' && numbered,
        icon,
        requiredRole,
        sortOrder: existing?.sortOrder ?? (types.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 10),
      });
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!typeId) return;
    if (!(await confirmAsync('Delete this type?', 'Existing assignments keep their title. People’s qualifications for it are no longer used.', 'Delete', true))) return;
    try {
      await deleteType(typeId);
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Screen footer={<Button label="Save" onPress={save} loading={busy} />}>
      {error ? <Notice tone="bad" message={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} placeholder="For example: Bible Reading" autoCapitalize="words" />
      <Label style={{ marginBottom: space.sm }}>Icon</Label>
      <ChipRow>
        {ICONS.map(i => (
          <Chip key={i} label={i} selected={icon === i} onPress={() => setIcon(i)} />
        ))}
      </ChipRow>
      <Label style={{ marginBottom: space.sm }}>Which meeting?</Label>
      <ChipRow>
        <Chip label={settings.midweekName} selected={meeting === 'midweek'} onPress={() => setMeeting('midweek')} />
        <Chip label={settings.weekendName} selected={meeting === 'weekend'} onPress={() => setMeeting('weekend')} />
      </ChipRow>
      <Label style={{ marginBottom: space.sm }}>What is it?</Label>
      <ChipRow>
        <Chip label="A part with people" selected={kind === 'part'} onPress={() => setKind('part')} />
        <Chip label="A song" selected={kind === 'song'} onPress={() => setKind('song')} />
        <Chip label="A line of text" selected={kind === 'note'} onPress={() => setKind('note')} />
      </ChipRow>
      <View style={{ marginVertical: space.md }}>
        <Label style={{ marginBottom: space.sm }}>How long?</Label>
        <Stepper label="minutes" value={minutes} onChange={setMinutes} suffix=" min" />
      </View>
      {kind === 'part' ? (
        <View style={{ marginBottom: space.md }}>
          <Label style={{ marginBottom: space.sm }}>How many people usually?</Label>
          <ChipRow>
            {[1, 2, 3, 4].map(n => (
              <Chip key={n} label={String(n)} selected={people === n} onPress={() => { setPeople(n); if (n > 1) setMultiple(true); }} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <TextField label="Notes (optional)" value={description} onChangeText={setDescription} multiline />
      <Label style={{ marginBottom: space.sm }}>Section</Label>
      <ChipRow>
        {settings.categories.map(c => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>
      {kind === 'part' ? <SwitchRow label="Shown with a number (1, 2, 3 …)" value={numbered} onValueChange={setNumbered} /> : null}
      <SwitchRow label="Needs a qualification" description="Only people marked as qualified are suggested." value={requiresQualification} onValueChange={setRequires} />
      <SwitchRow label="Can have more than one person" description="For example, a demonstration with two people." value={multiple} onValueChange={setMultiple} />
      {requiresQualification ? (
        <View style={{ marginBottom: space.md }}>
          <Label style={{ marginBottom: space.sm }}>Which qualification is needed?</Label>
          <ChipRow>
            {ROLE_ORDER.map(r => (
              <Chip key={r} label={ROLE_LABELS[r]} selected={requiredRole === r} onPress={() => setRequiredRole(r)} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <SwitchRow label="In use" description="Turn off to hide it when creating assignments." value={active} onValueChange={setActive} />
      {typeId ? <Button label="Delete this type" variant="ghost" onPress={remove} style={{ marginTop: space.lg }} /> : null}
    </Screen>
  );
}
