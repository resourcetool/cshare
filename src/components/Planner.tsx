import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppData } from '../context/AppDataContext';
import { useLive } from '../hooks/useLive';
import { subscribeToWeeks } from '../services/weekService';
import { Meeting, Week } from '../types';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme';
import { formatWeekRange, shiftWeek, weekIdFor } from '../utils/dates';
import { Badge, Body, Button, Heading, LoadingView, Small } from './ui';

function progress(week: Week | undefined, meeting: Meeting): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  const sheet = week?.sheets[meeting];
  if (!sheet) return { label: 'Not started', tone: 'neutral' };
  const parts = sheet.program.filter(r => r.kind === 'part');
  const done = parts.filter(r => r.assigneeIds.length > 0).length;
  return { label: `${done}/${parts.length} assigned`, tone: done === parts.length && parts.length > 0 ? 'good' : 'warn' };
}

/** The coming weeks at a glance: which meetings are started and how many parts have someone. */
export function Planner({ onOpen }: { onOpen: (weekId: string, meeting: Meeting) => void }) {
  const { palette } = useTheme();
  const { settings, reloadKey } = useAppData();
  const [count, setCount] = useState(26);
  const thisWeek = weekIdFor(new Date());
  const live = useLive<Week[]>((ok, err) => subscribeToWeeks(thisWeek, shiftWeek(thisWeek, count), ok, err), [count, reloadKey]);
  const byId = new Map((live.data ?? []).map(w => [w.id, w]));

  if (live.loading && !live.data) return <LoadingView />;

  return (
    <View>
      <Small style={{ marginBottom: space.md }}>Tap a meeting to open or start its sheet. Plan as far ahead as you like: people see their parts as soon as you assign them.</Small>
      {Array.from({ length: count + 1 }, (_, i) => shiftWeek(thisWeek, i)).map(id => {
        const week = byId.get(id);
        return (
          <View key={id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <Heading>{formatWeekRange(id)}</Heading>
            {(['midweek', 'weekend'] as Meeting[]).map(m => {
              const p = progress(week, m);
              return (
                <Pressable key={m} accessibilityRole="button" accessibilityLabel={`${m === 'midweek' ? settings.midweekName : settings.weekendName}, ${p.label}`} onPress={() => onOpen(id, m)} style={[styles.row, { borderTopColor: palette.line }]}>
                  <Body style={{ flex: 1 }}>{m === 'midweek' ? settings.midweekName : settings.weekendName}</Body>
                  <Badge label={p.label} tone={p.tone} />
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <Button label="Show 13 more weeks" variant="secondary" onPress={() => setCount(c => c + 13)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderTopWidth: 1, marginTop: space.sm, paddingTop: space.sm },
});
