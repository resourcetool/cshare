import React, { useState } from 'react';
import { Screen } from '../../components/Screen';
import { Body, Button, Notice, TextField, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { createProfile } from '../../services/userService';
import { space } from '../../theme';
import { friendlyError, logError } from '../../utils/errors';

export default function SetupProfileScreen({ uid, email }: { uid: string; email: string }) {
  const { signOut } = useAuth();
  const { online } = useOnlineStatus();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Please enter your name.');
    if (phone.replace(/[^0-9]/g, '').length < 6) return setError('Please enter a phone number administrators can reach you on.');
    setBusy(true);
    setError(null);
    try {
      await createProfile(uid, { name, email, phone });
    } catch (e) {
      logError('create profile', e);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen standalone>
      <Title style={{ marginTop: space.xl }}>Almost done</Title>
      <Body style={{ marginVertical: space.lg }}>Tell us who you are. An administrator will then approve you, and your assignments will appear here.</Body>
      {!online ? <Notice tone="warn" message="You are offline. First-time setup needs internet." /> : null}
      {error ? <Notice tone="bad" message={error} /> : null}
      <TextField label="Your full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <TextField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Button label="Finish setup" onPress={save} loading={busy} />
      <Button label="Use a different account" variant="ghost" onPress={() => signOut()} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
