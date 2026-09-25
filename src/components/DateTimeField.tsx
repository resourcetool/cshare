import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { radius, space, TOUCH } from '../theme';
import { combineDateTime, formatDayLong, formatTime, pad2, parseDateKey, toDateKey } from '../utils/dates';
import { Body, Label, Small } from './ui';

interface Props {
  label: string;
  mode: 'date' | 'time';
  /** 'YYYY-MM-DD' for dates, 'HH:mm' for times; empty when not set */
  value: string;
  onChange: (value: string) => void;
  /** lets the person remove an optional value */
  onClear?: () => void;
  placeholder?: string;
}

export function DateTimeField({ label, mode, value, onChange, onClear, placeholder }: Props) {
  const { palette } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? (mode === 'date' ? parseDateKey(value) : combineDateTime('2000-01-01', value)) : new Date();

  const apply = (d: Date) => onChange(mode === 'date' ? toDateKey(d) : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: false,
        onChange: (event, d) => {
          if (event.type === 'set' && d) apply(d);
        },
      });
    } else {
      setIosOpen(o => !o);
    }
  };

  const shown = value ? (mode === 'date' ? formatDayLong(value) : formatTime(value)) : placeholder ?? 'Tap to choose';

  return (
    <View style={{ marginBottom: space.lg }}>
      <Label style={{ marginBottom: space.xs }}>{label}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`} onPress={open} style={[styles.field, { borderColor: palette.line, backgroundColor: palette.surface }]}>
        <Body style={!value ? { color: palette.placeholder } : undefined}>{shown}</Body>
      </Pressable>
      {onClear && value ? (
        <Pressable accessibilityRole="button" onPress={onClear} style={{ paddingVertical: space.sm }}>
          <Small style={{ color: palette.primary, fontWeight: '700' }}>Remove {label.toLowerCase()}</Small>
        </Pressable>
      ) : null}
      {Platform.OS !== 'android' && iosOpen ? (
        <DateTimePicker value={current} mode={mode} display="spinner" onChange={(_e, d) => d && apply(d)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: TOUCH, justifyContent: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg },
});
