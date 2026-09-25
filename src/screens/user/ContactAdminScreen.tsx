import React from 'react';
import { View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, EmptyState, Heading, LoadingView, Notice, Small } from '../../components/ui';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { subscribeToAdmins } from '../../services/userService';
import { UserProfile } from '../../types';
import { space } from '../../theme';
import { callNumber, textNumber } from '../../utils/contact';

export default function ContactAdminScreen() {
  const { profile } = useAppData();
  const admins = useLive<UserProfile[]>(subscribeToAdmins, []);
  const list = (admins.data ?? []).filter(a => a.id !== profile.id);

  return (
    <Screen inTabs>
      <Body style={{ marginBottom: space.lg }}>Need to ask something or change an assignment? Call or text an administrator.</Body>
      {admins.error ? <Notice tone="warn" message={admins.error} /> : null}
      {admins.loading && !admins.data ? (
        <LoadingView />
      ) : list.length === 0 ? (
        <EmptyState title="No administrators to show yet" message="Their contact details appear here once they are available." />
      ) : (
        list.map(a => (
          <Card key={a.id}>
            <Heading>{a.name}</Heading>
            <Small style={{ marginBottom: space.md }}>{a.phone || 'No phone number saved'}</Small>
            {a.phone ? (
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button label="Call" onPress={() => callNumber(a.phone)} style={{ flex: 1 }} />
                <Button label="Text" variant="secondary" onPress={() => textNumber(a.phone, `CSHARE: This is ${profile.name}. `)} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
