import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { observeAuthState, signOut as authSignOut, currentUser } from '../services/authService';
import { subscribeToProfile } from '../services/userService';
import { cancelAllLocalReminders, unregisterPush } from '../services/notificationService';
import { friendlyError, logError } from '../utils/errors';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** signed in, but we cannot yet tell whether a profile exists (no saved copy, maybe offline) */
  | { status: 'unknown'; uid: string; error?: string }
  /** signed in, but first-time setup (name + phone) is not finished */
  | { status: 'needsProfile'; uid: string; email: string }
  /** profile exists but an administrator has not approved it (or has turned it off) */
  | { status: 'inactive'; profile: UserProfile }
  | { status: 'ready'; profile: UserProfile };

interface AuthContextValue {
  state: AuthState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let stopProfile: () => void = () => {};
    const stopAuth = observeAuthState(user => {
      stopProfile();
      if (!user) {
        setState({ status: 'signedOut' });
        return;
      }
      // Firebase remembers the sign-in, and Firestore answers from its saved copy when offline,
      // so a returning person goes straight to the app without internet.
      setState(s => (s.status === 'ready' || s.status === 'inactive' ? s : { status: 'unknown', uid: user.uid }));
      stopProfile = subscribeToProfile(
        user.uid,
        ({ profile, fromCache }) => {
          if (profile) setState(profile.active ? { status: 'ready', profile } : { status: 'inactive', profile });
          else if (fromCache) setState({ status: 'unknown', uid: user.uid });
          else setState({ status: 'needsProfile', uid: user.uid, email: user.email ?? '' });
        },
        e => {
          logError('profile', e);
          setState({ status: 'unknown', uid: user.uid, error: friendlyError(e) });
        },
      );
    });
    return () => {
      stopProfile();
      stopAuth();
    };
  }, []);

  const signOut = useCallback(async () => {
    const uid = currentUser()?.uid;
    try {
      await cancelAllLocalReminders();
      if (uid) await Promise.race([unregisterPush(uid), new Promise<void>(resolve => setTimeout(resolve, 3000))]);
    } catch (e) {
      logError('sign out cleanup', e);
    }
    await authSignOut();
  }, []);

  const value = useMemo(() => ({ state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
