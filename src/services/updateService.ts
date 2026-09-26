import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { AppUpdateConfig } from '../types';
import { toDate } from '../utils/dates';
import { commit, CommitResult } from './commit';

const updateDoc = () => firestore().collection('settings').doc('update');
const now = () => firestore.FieldValue.serverTimestamp();

function mapUpdate(d: FT.DocumentData | undefined): AppUpdateConfig | null {
  if (!d) return null;
  return {
    available: d.available === true,
    versionName: typeof d.versionName === 'string' ? d.versionName : '',
    versionCode: typeof d.versionCode === 'number' ? d.versionCode : 0,
    url: typeof d.url === 'string' ? d.url : '',
    message: typeof d.message === 'string' ? d.message : 'A new CSHARE update is available.',
    updatedAt: toDate(d.updatedAt),
  };
}

export function subscribeToAppUpdate(
  onData: (update: AppUpdateConfig | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return updateDoc().onSnapshot(
    snap => onData(snap.exists ? mapUpdate(snap.data()) : null),
    onError,
  );
}

/** Only a developer should call this. Firestore rules enforce that on the server. */
export function saveAppUpdate(update: {
  available: boolean;
  versionName: string;
  versionCode: number;
  url: string;
  message: string;
}): Promise<CommitResult> {
  return commit(
    updateDoc().set(
      {
        available: update.available,
        versionName: update.versionName.trim(),
        versionCode: Math.max(1, Math.floor(update.versionCode)),
        url: update.url.trim(),
        message: update.message.trim() || 'A new CSHARE update is available.',
        updatedAt: now(),
      },
      { merge: true },
    ),
  );
}