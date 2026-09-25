import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface OnlineState {
  online: boolean;
  /** true for a few seconds after the connection comes back */
  justSynced: boolean;
}

let state: OnlineState = { online: true, justSynced: false };
const listeners = new Set<() => void>();
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function set(next: OnlineState) {
  state = next;
  listeners.forEach(l => l());
}

function start() {
  if (started) return;
  started = true;
  NetInfo.addEventListener(s => {
    const online = s.isConnected === true && s.isInternetReachable !== false;
    if (online === state.online) return;
    if (timer) clearTimeout(timer);
    if (online) {
      set({ online: true, justSynced: true });
      timer = setTimeout(() => set({ online: true, justSynced: false }), 3000);
    } else {
      set({ online: false, justSynced: false });
    }
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useOnlineStatus(): OnlineState {
  return useSyncExternalStore(subscribe, () => state);
}
