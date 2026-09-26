import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { Dependent, NotificationPreferences, PrivilegeRole, ReportingType, Role, UserProfile } from '../types';
import { toDate } from '../utils/dates';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../config/appVersion';
import { commit, CommitResult } from './commit';

const users = () => firestore().collection('users');
const now = () => firestore.FieldValue.serverTimestamp();

export function mapUser(id: string, d: FT.DocumentData): UserProfile {
  return {
    id,
    name: d.name ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    role: d.role === 'admin' ? 'admin' : 'user',
    active: d.active === true,
    developer: d.developer === true,
    secretary: d.secretary === true,
    appVersion: typeof d.appVersion === 'string' ? d.appVersion : undefined,
    appVersionCode: typeof d.appVersionCode === 'number' ? d.appVersionCode : undefined,
    lastAppSeenAt: toDate(d.lastAppSeenAt),
    qualifications: Array.isArray(d.qualifications) ? d.qualifications : [],
    reportingType: d.reportingType === 'baptized_publisher' || d.reportingType === 'auxiliary_pioneer' || d.reportingType === 'regular_pioneer' ? d.reportingType : 'publisher',
    groupId: typeof d.groupId === 'string' ? d.groupId : undefined,
    dependents: Array.isArray(d.dependents) ? d.dependents.map((x: any) => ({ id: x.id ?? '', name: x.name ?? '' })) : [], // eslint-disable-line @typescript-eslint/no-explicit-any
    notificationPreferences: {
      reminders: d.notificationPreferences?.reminders !== false,
      callStyle: d.notificationPreferences?.callStyle !== false,
    },
    fcmTokens: d.fcmTokens ?? [],
    approvedAt: toDate(d.approvedAt),
    lastActiveAt: toDate(d.lastActiveAt),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export interface ProfileSnapshot {
  profile: UserProfile | null;
  /** true when the answer came from the phone's saved copy, not the server */
  fromCache: boolean;
}

export function subscribeToProfile(
  uid: string,
  onData: (s: ProfileSnapshot) => void,
  onError: (e: unknown) => void,
): () => void {
  return users()
    .doc(uid)
    .onSnapshot(
      snap => {
        const data = snap.data();
        onData({
          profile: snap.exists && data ? mapUser(snap.id, data) : null,
          fromCache: snap.metadata.fromCache,
        });
      },
      onError,
    );
}

/** First-time setup. New accounts are always inactive users until an administrator approves them. */
export function createProfile(
  uid: string,
  data: { name: string; email: string; phone: string },
): Promise<CommitResult> {
  return commit(
    users().doc(uid).set({
      name: data.name.trim(),
      email: data.email,
      phone: data.phone.trim(),
      role: 'user',
      active: false,
      developer: false,
      secretary: false,
      qualifications: [],
      reportingType: 'publisher',
      dependents: [],
      notificationPreferences: { reminders: true, callStyle: true },
      fcmTokens: [],
      createdAt: now(),
      updatedAt: now(),
    }),
  );
}

export function updateMyProfile(
  uid: string,
  patch: { name?: string; phone?: string; notificationPreferences?: NotificationPreferences },
): Promise<CommitResult> {
  return commit(users().doc(uid).update({ ...patch, updatedAt: now() }));
}

export async function touchLastActive(uid: string): Promise<void> {
  await users().doc(uid).update({
    lastActiveAt: now(),
    appVersion: APP_VERSION_NAME,
    appVersionCode: APP_VERSION_CODE,
    lastAppSeenAt: now(),
  });
}

export async function addFcmToken(uid: string, token: string): Promise<void> {
  await users().doc(uid).update({ fcmTokens: firestore.FieldValue.arrayUnion(token) });
}

export async function removeFcmToken(uid: string, token: string): Promise<void> {
  await users().doc(uid).update({ fcmTokens: firestore.FieldValue.arrayRemove(token) });
}

// ------------------------------------------------------------------ administrators

export function subscribeToUsers(
  onData: (list: UserProfile[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return users().onSnapshot(
    snap =>
      onData(
        snap.docs
          .map(d => mapUser(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    onError,
  );
}

/** Contact details of active administrators (allowed for every active user by the rules). */
export function subscribeToAdmins(
  onData: (list: UserProfile[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return users()
    .where('role', '==', 'admin')
    .where('active', '==', true)
    .onSnapshot(
      snap =>
        onData(
          snap.docs
            .map(d => mapUser(d.id, d.data()))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      onError,
    );
}

export interface AdminUserPatch {
  name?: string;
  phone?: string;
  role?: Role;
  active?: boolean;
  secretary?: boolean;
  qualifications?: PrivilegeRole[];
  reportingType?: ReportingType;
  groupId?: string | null;
  /** set when an administrator approves someone */
  approve?: boolean;
}

export function updateUserByAdmin(uid: string, patch: AdminUserPatch): Promise<CommitResult> {
  const { approve, ...rest } = patch;
  const data: Record<string, unknown> = { ...rest, updatedAt: now() };
  if (approve) data.approvedAt = now();
  return commit(users().doc(uid).update(data));
}

// ------------------------------------------------------------------ children with no phone

/** Adds a child / family member with no phone of their own to this account. Admin only. */
export function addDependentByAdmin(uid: string, name: string): Promise<CommitResult> {
  const dep: Dependent = { id: `dep_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name: name.trim() };
  return commit(users().doc(uid).update({ dependents: firestore.FieldValue.arrayUnion(dep), updatedAt: now() }));
}

/** Renames a child. Needs the account's current dependent list (an admin already has it on
 * screen) so this is one atomic field write rather than a remove-then-add race. */
export function editDependentByAdmin(uid: string, depId: string, newName: string, currentDependents: Dependent[]): Promise<CommitResult> {
  const next = currentDependents.map(d => (d.id === depId ? { ...d, name: newName.trim() } : d));
  return commit(users().doc(uid).update({ dependents: next, updatedAt: now() }));
}

export function removeDependentByAdmin(uid: string, dep: Dependent): Promise<CommitResult> {
  return commit(users().doc(uid).update({ dependents: firestore.FieldValue.arrayRemove(dep), updatedAt: now() }));
}