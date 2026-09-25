import React, { useEffect, useState } from 'react';
import { Screen } from '../../components/Screen';
import { Body, Button, LoadingView, Small, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { space } from '../../theme';

export function PendingScreen({ profile }: { profile: UserProfile }) {
  const { signOut } = useAuth();
  const turnedOff = !!profile.approvedAt;
  return (
    <Screen standalone>
      <Title style={{ marginTop: space.xl }}>{turnedOff ? 'Your account is turned off' : 'Waiting for approval'}</Title>
      <Body style={{ marginVertical: space.lg }}>
        {turnedOff
          ? 'An administrator has turned off your CSHARE account. Please contact them if you think this is a mistake.'
          : `Thank you, ${profile.name}. An administrator needs to approve your account. This screen updates by itself when they do, as long as you have internet. You can close the app and come back later.`}
      </Body>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}

export function NeedsInternetScreen() {
  const { signOut } = useAuth();
  return (
    <Screen standalone>
      <Title style={{ marginTop: space.xl }}>Internet needed once</Title>
      <Body style={{ marginVertical: space.lg }}>
        CSHARE has not saved your information on this phone yet. Please connect to the internet once. After that, CSHARE works without internet.
      </Body>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}

/** Shown while the profile is being fetched. After 8 seconds (or an error) it explains what to check. */
export function ProfileLoadingScreen({ error }: { error?: string }) {
  const { signOut } = useAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!slow && !error) return <LoadingView message="Getting your information…" />;
  return (
    <Screen standalone>
      <Title style={{ marginTop: space.xl }}>This is taking too long</Title>
      <Body style={{ marginTop: space.lg }}>{error ?? 'We could not get your information yet.'}</Body>
      <Body style={{ marginVertical: space.lg }}>
        Check your internet connection, then close and reopen CSHARE.
      </Body>
      <Small style={{ marginBottom: space.lg }}>
        Setting CSHARE up for the first time? In the Firebase console, make sure the Firestore database is created and the security rules are published.
      </Small>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}
