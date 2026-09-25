import React from 'react';
import { View } from 'react-native';
import { MAX_REMINDERS, normalizeOffsets, REMINDER_OPTIONS } from '../utils/reminders';
import { space } from '../theme';
import { Chip, ChipRow, Label } from './ui';

/** Up to three reminders, each chosen from a short list (or switched off). */
export function ReminderPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const slots: (number | null)[] = Array.from({ length: MAX_REMINDERS }, (_, i) => value[i] ?? null);

  const setSlot = (i: number, minutes: number | null) => {
    const next = [...slots];
    next[i] = minutes;
    onChange(normalizeOffsets(next.filter((m): m is number => m !== null)));
  };

  return (
    <View>
      {slots.map((current, i) => (
        <View key={i} style={{ marginBottom: space.md }}>
          <Label style={{ marginBottom: space.sm }}>{`Reminder ${i + 1}${i === MAX_REMINDERS - 1 ? ' (final)' : ''}`}</Label>
          <ChipRow>
            <Chip label="Off" selected={current === null} onPress={() => setSlot(i, null)} />
            {REMINDER_OPTIONS.map(o => (
              <Chip key={o.minutes} label={o.label} selected={current === o.minutes} onPress={() => setSlot(i, o.minutes)} />
            ))}
          </ChipRow>
        </View>
      ))}
    </View>
  );
}
