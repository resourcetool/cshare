import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme';
import { isValidDateKey, isValidTime } from '../utils/dates';
import { DateTimeField } from './DateTimeField';
import { Button, Heading, Notice, TextField } from './ui';

interface Props {
  visible: boolean;
  meetingName: string;
  title: string;
  date: string;
  startTime: string;
  onSave: (v: { title: string; date: string; startTime: string }) => void;
  onClose: () => void;
}

/** Reading / day / start time of a meeting. */
export function MeetingDetailsModal({ visible, meetingName, title, date, startTime, onSave, onClose }: Props) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState(title);
  const [d, setD] = useState(date);
  const [s, setS] = useState(startTime);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setT(title);
      setD(date);
      setS(startTime);
      setError(null);
    }
  }, [visible, title, date, startTime]);

  const save = () => {
    if (!isValidDateKey(d)) return setError('Please choose the day.');
    if (!isValidTime(s)) return setError('Please choose the start time.');
    onSave({ title: t, date: d, startTime: s });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
        <Heading style={{ marginBottom: space.lg }}>{meetingName}</Heading>
        {error ? <Notice tone="bad" message={error} /> : null}
        <TextField label="Reading or heading (optional)" value={t} onChangeText={setT} placeholder="For example: YEREMIA 36-37" autoCapitalize="characters" />
        <DateTimeField label="Day" mode="date" value={d} onChange={setD} />
        <DateTimeField label="Starts" mode="time" value={s} onChange={setS} />
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Save" onPress={save} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}
