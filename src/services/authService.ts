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

export interface PasswordPolicyResult {
  valid: boolean;
  message?: string;
}

/**
 * CSHARE signup password policy.
 * Existing passwords are not affected: this is enforced when creating a new account.
 */
export function validateSignupPassword(password: string): PasswordPolicyResult {
  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long.' };
  }
  if (/\s/.test(password)) {
    return { valid: false, message: 'Password must not contain spaces.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character, such as ! or @.' };
  }
  return { valid: true };
}

export async function signUp(email: string, password: string): Promise<void> {
  const policy = validateSignupPassword(password);
  if (!policy.valid) {
    throw new Error(policy.message ?? 'Please choose a stronger password.');
  }
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