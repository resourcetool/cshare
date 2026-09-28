import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { Dependent, NotificationPreferences, PrivilegeRole, PublicPerson, ReportingType, Role, UserProfile } from '../types';
import { toDate } from '../utils/dates';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../config/appVersion';
import { commit, CommitResult } from './commit';

const users = () => firestore().collection('users');
const publicPeople = () => firestore().collection('publicPeople');
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

export async function updateMyProfile(
  uid: string,
  patch: { name?: string; phone?: string; notificationPreferences?: NotificationPreferences },
): Promise<CommitResult> {
  const current = await users().doc(uid).get();
  const before: FT.DocumentData = current.data() ?? {};
  const next: FT.DocumentData = { ...before, ...patch };

  const publicData: PublicPerson = {
    id: uid,
    name: String(next.name ?? ''),
    phone: String(next.phone ?? ''),
    role: next.role === 'admin' ? 'admin' : 'user',
    active: next.active === true,
    qualifications: Array.isArray(next.qualifications) ? next.qualifications : [],
  };

  const batch = firestore().batch();
  batch.update(users().doc(uid), { ...patch, updatedAt: now() });
  batch.set(
    publicPeople().doc(uid),
    {
      ...publicData,
      // Remove the old public reportingType field if it exists.
      reportingType: firestore.FieldValue.delete(),
    },
    { merge: true },
  );
  return commit(batch.commit());
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

export async function updateUserByAdmin(uid: string, patch: AdminUserPatch): Promise<CommitResult> {
  const { approve, ...rest } = patch;
  const current = await users().doc(uid).get();
  const before: FT.DocumentData = current.data() ?? {};

  const next: FT.DocumentData = {
    ...before,
    ...rest,
  };

  const data: Record<string, unknown> = { ...rest, updatedAt: now() };
  if (approve) data.approvedAt = now();

  const publicData: PublicPerson = {
    id: uid,
    name: String(next.name ?? ''),
    phone: String(next.phone ?? ''),
    role: next.role === 'admin' ? 'admin' : 'user',
    active: next.active === true,
    qualifications: Array.isArray(next.qualifications) ? next.qualifications : [],
  };

  const batch = firestore().batch();
  batch.update(users().doc(uid), data);
  batch.set(
    publicPeople().doc(uid),
    {
      ...publicData,
      // Remove the old public reportingType field if it exists.
      reportingType: firestore.FieldValue.delete(),
    },
    { merge: true },
  );
  return commit(batch.commit());
}

/** Congregation-visible copy of people. Never contains email, dependents, tokens or private settings. */
export function subscribeToPublicPeople(
  onData: (list: PublicPerson[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return publicPeople()
    .where('active', '==', true)
    .onSnapshot(
      snap =>
        onData(
          snap.docs
            .map((d): PublicPerson => ({
              id: d.id,
              name: d.data().name ?? '',
              phone: d.data().phone ?? '',
              role: d.data().role === 'admin' ? 'admin' : 'user',
              active: d.data().active === true,
              qualifications: Array.isArray(d.data().qualifications) ? d.data().qualifications : [],
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      onError,
    );
}

/** Admin-only backfill/synchronisation for existing congregation members. */
export async function syncPublicPeople(list: UserProfile[]): Promise<void> {
  const batch = firestore().batch();
  for (const u of list) {
    batch.set(publicPeople().doc(u.id), {
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      active: u.active,
      qualifications: u.qualifications,
      // Remove the old public reportingType field if it exists.
      reportingType: firestore.FieldValue.delete(),
    }, { merge: true });
  }
  await batch.commit();
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