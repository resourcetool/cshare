import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatWeekRange, parseDateKey, shiftWeek, weekIdFor } from '../utils/dates';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme';
import { Button, Heading, Small } from './ui';

/** `minWeekId`: pass the current week to stop navigation into the past (used for normal users —
 * old, already-happened weeks are not shown to them, only the current week and later). Leave it
 * unset for admins, who may need to look back to fix something from a recent week. */
export function WeekNav({ weekId, onChange, minWeekId }: { weekId: string; onChange: (id: string) => void; minWeekId?: string }) {
  const { palette } = useTheme();
  const thisWeek = weekIdFor(new Date());
  const label = weekId === thisWeek ? 'This week' : weekId === shiftWeek(thisWeek, 1) ? 'Next week' : weekId === shiftWeek(thisWeek, -1) ? 'Last week' : 'Week';
  const atFloor = !!minWeekId && weekId <= minWeekId;

  const pickDate = () => {
    DateTimePickerAndroid.open({
      value: parseDateKey(weekId),
      mode: 'date',
      minimumDate: minWeekId ? parseDateKey(minWeekId) : undefined,
      onChange: (event, d) => {
        if (event.type === 'set' && d) onChange(weekIdFor(minWeekId && weekIdFor(d) < minWeekId ? parseDateKey(minWeekId) : d));
      },
    });
  };

  return (
    <View style={[styles.wrap, { borderBottomColor: palette.line }]}>
      <Small>{label}</Small>
      <Heading>{formatWeekRange(weekId)}</Heading>
      <View style={styles.row}>
        <Button label="◀ Earlier" variant="secondary" onPress={() => onChange(shiftWeek(weekId, -1))} style={{ flex: 1 }} disabled={atFloor} />
        <Button label="Later ▶" variant="secondary" onPress={() => onChange(shiftWeek(weekId, 1))} style={{ flex: 1 }} />
      </View>
      <View style={styles.row}>
        {Platform.OS === 'android' ? <Button label="📅 Go to a date" variant="ghost" onPress={pickDate} style={{ flex: 1 }} /> : null}
        {weekId !== thisWeek ? <Button label="This week" variant="ghost" onPress={() => onChange(thisWeek)} style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: space.md, borderBottomWidth: 1, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
});
