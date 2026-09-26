import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Chip, ChipRow, Notice, Small, TextField, Title } from '../../components/ui';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { sendPasswordReset, signIn, signUp, validateSignupPassword } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import { space } from '../../theme';
import { friendlyError, logError } from '../../utils/errors';

export default function AuthScreen() {
  const { palette } = useTheme();
  const { online } = useOnlineStatus();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Please enter your email and password.');
    if (mode === 'signup') {
      const policy = validateSignupPassword(password);
      if (!policy.valid) return setError(policy.message ?? 'Please choose a stronger password.');
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
      // AuthContext notices the new sign-in and moves on by itself.
    } catch (e) {
      logError('auth', e);
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setError('Type your email above first, then tap “Forgot password”.');
    try {
      await sendPasswordReset(email);
      Alert.alert('Check your email', 'We sent you a link to choose a new password.');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Screen standalone>
      <View style={{ marginTop: space.xl, marginBottom: space.xl }}>
        <Title style={{ fontSize: 40, lineHeight: 46, color: palette.primary }}>CSHARE</Title>
        <Body style={{ marginTop: space.sm }}>Your weekly assignments, saved on your phone so you can see them even without internet.</Body>
      </View>

      <ChipRow>
        <Chip label="Sign in" selected={mode === 'signin'} onPress={() => setMode('signin')} />
        <Chip label="Create account" selected={mode === 'signup'} onPress={() => setMode('signup')} />
      </ChipRow>

      {!online ? <Notice tone="warn" message="You are offline. Signing in for the first time needs internet." /> : null}
      {error ? <Notice tone="bad" message={error} /> : null}

      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} hint={mode === 'signup' ? '10+ characters, with uppercase, lowercase, number and special character.' : undefined} />
      <Button label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
      {mode === 'signin' ? <Button label="Forgot password?" variant="ghost" onPress={forgot} style={{ marginTop: space.sm }} /> : null}
      <Small style={{ marginTop: space.lg }}>
        {mode === 'signup'
          ? 'After you create your account, an administrator will approve you. You only need to do this once.'
          : 'You only sign in once. CSHARE remembers you afterwards.'}
      </Small>
    </Screen>
  );
}
