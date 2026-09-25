import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgramRow, UserProfile } from '../types';
import { meetsRequiredRole } from '../utils/qualifications';
import { useTheme } from '../context/ThemeContext';
import { radius, space, TOUCH } from '../theme';
import { Badge, Body, Button, Heading, IconBadge, Label, Small, Stepper, SwitchRow, TextField } from './ui';

interface Props {
  /** the line being edited (null = closed) */
  row: ProgramRow | null;
  people: UserProfile[];
  onSave: (row: ProgramRow) => void;
  onDelete: (row: ProgramRow) => void;
  onClose: () => void;
}

/** One selectable row in the assignee list: either a real person, or one of their children
 * (no phone of their own — the assignment is still given under the parent's account). */
interface Candidate {
  id: string;
  name: string;
  subtitle?: string;
  qualified: boolean;
  /** if set, choosing this candidate assigns the PARENT (id) but shows this child's name */
  childName?: string;
}

/** Everything about one line of the sheet in one place: who, title, length. Tap a name to assign. */
export function RowEditorModal({ row, people, onSave, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [minutes, setMinutes] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  /** id -> child's name, only set for ids chosen as "assign this person's child" */
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setNumber(row.number ?? '');
    setMinutes(row.minutes);
    setIds(row.assigneeIds);
    const initialChildNames: Record<string, string> = {};
    for (const id of row.childAssignees ?? []) initialChildNames[id] = row.assigneeNames[id] ?? '';
    setChildNames(initialChildNames);
    setQuery('');
    setShowAll(false);
  }, [row]);

  const checking = !!row?.requiresQualification && !!row?.requiredRole;

  const candidates = useMemo<Candidate[]>(() => {
    const out: Candidate[] = [];
    for (const p of people) {
      out.push({ id: p.id, name: p.name, qualified: !checking || meetsRequiredRole(p.qualifications, row?.requiredRole) });
      for (const dep of p.dependents ?? []) {
        // A child's own qualifications are not tracked. Rather than hide them behind the
        // "show unqualified" switch (which would make it look like "add child" is broken),
        // children always show up — it is the admin's call whether the part suits them.
        out.push({ id: p.id, name: dep.name, subtitle: `child of ${p.name}, no phone of their own`, qualified: true, childName: dep.name });
      }
    }
    return out;
  }, [people, checking, row?.requiredRole]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .filter(c => c.qualified || showAll || (ids.includes(c.id) && (childNames[c.id] ?? '') === (c.childName ?? '')))
      .sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.name.localeCompare(b.name));
  }, [candidates, query, showAll, ids, childNames]);

  if (!row) return null;
  const single = !row.multiple;

  const isChosen = (c: Candidate) => ids.includes(c.id) && (childNames[c.id] ?? '') === (c.childName ?? '');

  const toggle = (c: Candidate) => {
    const chosen = isChosen(c);
    if (single) {
      if (chosen) {
        setIds([]);
        setChildNames({});
      } else {
        setIds([c.id]);
        setChildNames(c.childName ? { [c.id]: c.childName } : {});
      }
      return;
    }
    if (chosen) {
      setIds(ids.filter(x => x !== c.id));
      setChildNames(prev => { const next = { ...prev }; delete next[c.id]; return next; });
    } else {
      setIds(prev => (prev.includes(c.id) ? prev : [...prev, c.id]));
      setChildNames(prev => (c.childName ? { ...prev, [c.id]: c.childName } : (() => { const n = { ...prev }; delete n[c.id]; return n; })()));
    }
  };

  const save = () => {
    const names: Record<string, string> = {};
    for (const id of ids) names[id] = childNames[id] ?? people.find(p => p.id === id)?.name ?? row.assigneeNames[id] ?? 'Unknown';
    const childAssignees = ids.filter(id => !!childNames[id]);
    onSave({ ...row, title: title.trim(), number: number || undefined, minutes, assigneeIds: ids, assigneeNames: names, childAssignees });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: palette.bg }]}>
        <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.line }]}>
          <IconBadge icon={row.icon} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Small>{row.section}</Small>
            <Heading>{row.label || 'Part'}</Heading>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
          {row.kind === 'song' ? (
            <TextField label="Song number" value={number} onChangeText={t => setNumber(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} placeholder="For example: 74" />
          ) : (
            <>
              <TextField label="Title (leave empty to use the name above)" value={title} onChangeText={setTitle} placeholder={row.label || 'Title of the part'} multiline />
              <View style={styles.minutes}>
                <Label>Length</Label>
                <Stepper label="minutes" value={minutes} onChange={setMinutes} suffix=" min" />
              </View>
            </>
          )}

          {row.kind === 'part' ? (
            <>
              <Heading style={{ marginTop: space.lg, marginBottom: space.sm }}>{single ? 'Who?' : `Who? (${row.people > 1 ? `usually ${row.people} people` : 'one or more'})`}</Heading>
              <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Type a name" />
              {checking ? <SwitchRow label="Also show people who are not qualified" value={showAll} onValueChange={setShowAll} /> : null}
              {list.length === 0 ? <Body style={{ color: palette.muted }}>{checking && !showAll ? 'Nobody is marked as qualified yet. Turn on the switch to see everyone.' : 'No people found.'}</Body> : null}
              {list.map(c => {
                const on = isChosen(c);
                return (
                  <Pressable
                    key={`${c.id}:${c.childName ?? ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${c.name}${c.subtitle ? `, ${c.subtitle}` : ''}${c.qualified ? '' : ', not qualified'}`}
                    onPress={() => toggle(c)}
                    style={[styles.person, { backgroundColor: palette.surface, borderColor: palette.line }, on && { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: on ? '700' : '400' }}>{c.name}</Body>
                      {c.subtitle ? <Small>{c.subtitle}</Small> : null}
                      {checking && !c.qualified ? <Badge label="Not qualified" tone="warn" /> : null}
                    </View>
                    <Body style={{ color: palette.primary, fontWeight: '700' }}>{on ? '✓ Chosen' : ''}</Body>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          <Button label="Remove this line from the sheet" variant="ghost" onPress={() => onDelete(row)} style={{ marginTop: space.xl }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: palette.surface, borderTopColor: palette.line }]}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Save" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderBottomWidth: 1 },
  minutes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  person: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, padding: space.md, marginBottom: space.sm, borderRadius: radius.md, borderWidth: 1.5 },
  footer: { padding: space.lg, borderTopWidth: 1 },
});
