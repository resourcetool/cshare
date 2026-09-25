import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppDataProvider } from '../context/AppDataContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AuthScreen from '../screens/auth/AuthScreen';
import SetupProfileScreen from '../screens/auth/SetupProfileScreen';
import { NeedsInternetScreen, PendingScreen, ProfileLoadingScreen } from '../screens/auth/StatusScreens';
import { LoadingView } from '../components/ui';
import AdminNavigator from './AdminNavigator';
import UserNavigator from './UserNavigator';
import { flushPendingNavigation } from './navigationRef';

/** Opens an assignment the person tapped in a reminder, as soon as the navigator exists. */
function PendingOpener() {
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      flushPendingNavigation();
      if (++tries >= 10) clearInterval(id);
    }, 300);
    return () => clearInterval(id);
  }, []);
  return null;
}

/** Decides what to show from the sign-in state. Returning people go straight to the app. */
export default function RootNavigator() {
  const { state } = useAuth();
  const { online } = useOnlineStatus();

  switch (state.status) {
    case 'loading':
      return <LoadingView message="Opening CSHARE…" />;
    case 'signedOut':
      return <AuthScreen />;
    case 'unknown':
      // No saved copy of the profile yet: first setup needs internet.
      return online ? <ProfileLoadingScreen error={state.error} /> : <NeedsInternetScreen />;
    case 'needsProfile':
      return <SetupProfileScreen email={state.email} uid={state.uid} />;
    case 'inactive':
      return <PendingScreen profile={state.profile} />;
    case 'ready':
      return (
        <AppDataProvider profile={state.profile}>
          <PendingOpener />
          {state.profile.role === 'admin' ? <AdminNavigator /> : <UserNavigator />}
        </AppDataProvider>
      );
  }
}
