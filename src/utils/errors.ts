export function errorCode(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const c = (e as { code: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return '';
}

/** Technical details go to the developer log only. */
export function logError(context: string, e: unknown): void {
  console.warn(`[CSHARE] ${context}`, errorCode(e), e);
}

/** Plain-language message for the person using the app. */
export function friendlyError(e: unknown): string {
  const code = errorCode(e);
  if (code.includes('network-request-failed')) {
    return 'There is no internet connection. Please connect and try again.';
  }
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return "That email or password isn't right. Please check and try again.";
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been turned off. Please contact your administrator.';
    case 'firestore/permission-denied':
    case 'permission-denied':
      return "You don't have permission to do that.";
    case 'firestore/unavailable':
    case 'unavailable':
      return "Your information could not be synchronized. We'll try again when internet is available.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
