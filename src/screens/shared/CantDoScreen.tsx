import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Body, Button, Chip, ChipRow, Heading, Label, Notice, Small, TextField } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { SharedStackParams } from '../../navigation/types';
import { markCannotDo } from '../../services/assignmentService';
import { subscribeToAdmins } from '../../services/userService';
import { UserProfile } from '../../types';
import { space } from '../../theme';
import { callNumber, textNumber } from '../../utils/contact';
import { formatDayLong } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';

export default function CantDoScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SharedStackParams>>();
  const route = useRoute<RouteProp<SharedStackParams, 'CantDo'>>();
  const { profile, myAssignments } = useAppData();
  const a = myAssignments.find(x => x.id === route.params.assignmentId);
  const admins = useLive<UserProfile[]>(subscribeToAdmins, []);
  const list = (admins.data ?? []).filter(x => x.id !== profile.id);

  const [adminId, setAdminId] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<'synced' | 'queued' | null>(null);

  useEffect(() => {
    if (!adminId && list.length) setAdminId(list[0].id);
  }, [list, adminId]);

  if (!a) {
    return (
      <Screen>
        <Body>This assignment could not be found.</Body>
        <Button label="Go back" onPress={navigation.goBack} style={{ marginTop: space.lg }} />
      </Screen>
    );
  }

  const admin = list.find(x => x.id === adminId);
  const message = `CSHARE: I can't do "${a.title}" on ${formatDayLong(a.date)}.${reason.trim() ? ' ' + reason.trim() : ''} - ${profile.name}`;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setSent(await markCannotDo(a, profile.id, { reason, adminId }));
    } catch (e) {
      logError('cannot do', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        sent ? (
          <Button label="Done" onPress={() => navigation.popToTop()} />
        ) : (
          <Button label="Tell the administrator" variant="danger" onPress={send} loading={busy} />
        )
      }>
      <Heading>{a.title}</Heading>
      <Body style={{ marginBottom: space.lg }}>{formatDayLong(a.date)}</Body>

      {sent ? (
        <Notice
          tone="good"
          message={sent === 'queued' ? 'Saved on this phone. The administrator will see it when you next have internet. You can also call or text them now.' : 'Sent. The administrator can now see that you can\'t do this. You can also call or text them.'}
        />
      ) : null}
      {error ? <Notice tone="bad" message={error} /> : null}

      {list.length > 1 ? (
        <View style={{ marginBottom: space.lg }}>
          <Label style={{ marginBottom: space.sm }}>Who do you want to tell?</Label>
          <ChipRow>
            {list.map(x => (
              <Chip key={x.id} label={x.name} selected={x.id === adminId} onPress={() => setAdminId(x.id)} />
            ))}
          </ChipRow>
        </View>
      ) : null}
      {list.length === 0 ? <Notice tone="info" message="No administrator contact details are available right now. Your answer will still be saved for them." /> : null}

      {!sent ? <TextField label="Reason (optional)" value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="For example: I will be travelling" /> : null}

      {admin?.phone ? (
        <View>
          <Small style={{ marginBottom: space.sm }}>Contact {admin.name}</Small>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button label="Call" variant="secondary" onPress={() => callNumber(admin.phone)} style={{ flex: 1 }} />
            <Button label="Text" variant="secondary" onPress={() => textNumber(admin.phone, message)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
