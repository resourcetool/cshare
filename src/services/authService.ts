import auth from '@react-native-firebase/auth';

export interface AuthUser {
  uid: string;
  email: string | null;
}

// Firebase Auth keeps the person signed in across app restarts (and offline) by itself.
export function observeAuthState(cb: (user: AuthUser | null) => void): () => void {
  return auth().onAuthStateChanged(u => cb(u ? { uid: u.uid, email: u.email } : null));
}

export async function signIn(email: string, password: string): Promise<void> {
  await auth().signInWithEmailAndPassword(email.trim(), password);
}

export async function signUp(email: string, password: string): Promise<void> {
  await auth().createUserWithEmailAndPassword(email.trim(), password);
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}

export async function sendPasswordReset(email: string): Promise<void> {
  await auth().sendPasswordResetEmail(email.trim());
}

export function currentUser(): AuthUser | null {
  const u = auth().currentUser;
  return u ? { uid: u.uid, email: u.email } : null;
}
