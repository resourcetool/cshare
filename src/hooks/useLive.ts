import { useEffect, useState } from 'react';
import { friendlyError, logError } from '../utils/errors';

export type Subscribe<T> = (onData: (data: T) => void, onError: (e: unknown) => void) => () => void;

export interface Live<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribes to a Firestore listener for as long as the screen is shown.
 * Firestore answers instantly from its saved copy when offline, so `loading` is short.
 */
export function useLive<T>(subscribe: Subscribe<T>, deps: readonly unknown[]): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    setState(s => (s.loading ? s : { ...s, loading: true }));
    return subscribe(
      data => setState({ data, loading: false, error: null }),
      e => {
        logError('live query', e);
        setState(s => ({ ...s, loading: false, error: friendlyError(e) }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
