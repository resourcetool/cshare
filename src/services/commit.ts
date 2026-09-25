import { logError } from '../utils/errors';

export type CommitResult = 'synced' | 'queued';

/**
 * Firestore writes only "finish" once the server confirms them. While offline that never
 * happens, although the change is safely stored on the device and applied to the screen.
 * This waits briefly: real errors (e.g. permission denied) are thrown, but if the write is
 * simply waiting for internet we report 'queued' so the app never appears to freeze.
 */
export async function commit(write: Promise<unknown>, waitMs = 4000): Promise<CommitResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const confirmed = write.then((): CommitResult => 'synced');
  confirmed.catch(e => logError('write', e)); // covers a failure that arrives after the wait
  const waiting = new Promise<CommitResult>(resolve => {
    timer = setTimeout(() => resolve('queued'), waitMs);
  });
  try {
    return await Promise.race([confirmed, waiting]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
