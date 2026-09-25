import { createNavigationContainerRef } from '@react-navigation/native';
import type { AdminStackParams } from './types';

export const navigationRef = createNavigationContainerRef<AdminStackParams>();

let pendingAssignmentId: string | null = null;
let pendingGroupId: string | null = null;

/** Opens an assignment (e.g. from a tapped reminder). Waits until the app is ready. */
export function openAssignment(assignmentId: string): void {
  if (navigationRef.isReady()) navigationRef.navigate('AssignmentDetail', { assignmentId });
  else pendingAssignmentId = assignmentId;
}

export function flushPendingNavigation(): void {
  if (!navigationRef.isReady()) return;
  if (pendingAssignmentId) {
    const id = pendingAssignmentId;
    pendingAssignmentId = null;
    navigationRef.navigate('AssignmentDetail', { assignmentId: id });
    return;
  }
  if (pendingGroupId !== null) {
    const id = pendingGroupId;
    pendingGroupId = null;
    navigationRef.navigate('GroupReport', { groupId: id });
  }
}

export function openGroupReport(groupId?: string): void {
  if (navigationRef.isReady()) navigationRef.navigate('GroupReport', groupId ? { groupId } : undefined);
  else pendingGroupId = groupId ?? null;
}
