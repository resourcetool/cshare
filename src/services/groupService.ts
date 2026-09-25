import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { MinistryGroup } from '../types';
import { toDate } from '../utils/dates';
import { commit, CommitResult } from './commit';
import { updateUserByAdmin } from './userService';

const groups = () => firestore().collection('groups');
const now = () => firestore.FieldValue.serverTimestamp();

function mapGroup(id: string, d: FT.DocumentData): MinistryGroup {
  return {
    id,
    name: d.name ?? '',
    overseerId: d.overseerId ?? undefined,
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 100,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function subscribeToGroups(
  onData: (list: MinistryGroup[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return groups().onSnapshot(
    snap => onData(snap.docs.map(d => mapGroup(d.id, d.data())).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))),
    onError,
  );
}

/** Creates a group (no id) or updates one (with id). */
export function saveGroup(g: { id?: string; name: string; overseerId?: string; sortOrder: number }): Promise<CommitResult> {
  const ref = g.id ? groups().doc(g.id) : groups().doc();
  return commit(
    ref.set(
      {
        name: g.name.trim(),
        overseerId: g.overseerId ?? null,
        sortOrder: g.sortOrder,
        updatedAt: now(),
        ...(g.id ? {} : { createdAt: now() }),
      },
      { merge: true },
    ),
  );
}

export function deleteGroup(id: string): Promise<CommitResult> {
  return commit(groups().doc(id).delete());
}

/** Moves a person into a group, or out of any group (pass undefined). */
export function movePersonToGroup(uid: string, groupId: string | undefined): Promise<CommitResult> {
  return updateUserByAdmin(uid, { groupId: groupId ?? null });
}
