import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { Assignment, AssignmentInput, AssignmentResponse } from '../types';
import { addDays, combineDateTime, startOfDay, toDate, weekIdFor } from '../utils/dates';
import { normalizeOffsets } from '../utils/reminders';
import { commit, CommitResult } from './commit';

const col = () => firestore().collection('assignments');
const ts = (d: Date) => firestore.Timestamp.fromDate(d);

export function mapAssignment(id: string, d: FT.DocumentData): Assignment {
  const responses: Record<string, AssignmentResponse> = {};
  Object.entries(d.responses ?? {}).forEach(([uid, r]) => {
    const resp = r as FT.DocumentData;
    if (resp.status === 'seen' || resp.status === 'cannot_do') {
      responses[uid] = {
        status: resp.status,
        at: toDate(resp.at) ?? new Date(0),
        reason: resp.reason ?? undefined,
        adminId: resp.adminId ?? undefined,
      };
    }
  });
  return {
    id,
    weekId: d.weekId ?? '',
    typeId: d.typeId ?? undefined,
    requiredRole: d.requiredRole ?? undefined,
    icon: d.icon ?? undefined,
    meeting: d.meeting === 'weekend' || d.meeting === 'midweek' ? d.meeting : undefined,
    title: d.title ?? '',
    description: d.description ?? '',
    category: d.category ?? '',
    location: d.location ?? '',
    date: d.date ?? '',
    startTime: d.startTime ?? '00:00',
    endTime: d.endTime ?? undefined,
    startAt: toDate(d.startAt) ?? combineDateTime(d.date ?? '1970-01-01', d.startTime ?? '00:00'),
    assigneeIds: d.assigneeIds ?? [],
    assigneeNames: d.assigneeNames ?? {},
    childAssignees: d.childAssignees ?? [],
    requiresQualification: d.requiresQualification === true,
    status: d.status === 'cancelled' ? 'cancelled' : 'scheduled',
    responses,
    reminderOffsetsMinutes: d.reminderOffsetsMinutes ?? [],
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 100,
    createdBy: d.createdBy ?? '',
    updatedBy: d.updatedBy ?? '',
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function assignmentFields(input: AssignmentInput) {
  return {
    typeId: input.typeId ?? null,
    requiredRole: input.requiredRole ?? null,
    icon: input.icon ?? null,
    meeting: input.meeting ?? null,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    location: input.location.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime ?? null,
    assigneeIds: input.assigneeIds,
    assigneeNames: input.assigneeNames,
    childAssignees: input.childAssignees ?? [],
    requiresQualification: input.requiresQualification,
    reminderOffsetsMinutes: normalizeOffsets(input.reminderOffsetsMinutes),
    sortOrder: input.sortOrder,
    weekId: weekIdFor(input.date),
    startAt: ts(combineDateTime(input.date, input.startTime)),
  };
}

// --------------------------------------------------------------- reading (live)

/**
 * Only this person's CURRENT and UPCOMING assignments — never a past one. Today's date is the
 * floor, both to match what the dashboard should show and so the app never downloads (and then
 * has to filter out on the phone) weeks of history it will never display.
 */
export function subscribeToMyAssignments(
  uid: string,
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  const from = ts(startOfDay(new Date()));
  return col()
    .where('assigneeIds', 'array-contains', uid)
    .where('startAt', '>=', from)
    .orderBy('startAt')
    .onSnapshot(snap => onData(snap.docs.map(d => mapAssignment(d.id, d.data()))), onError);
}

export function subscribeToWeekAssignments(
  weekId: string,
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where('weekId', '==', weekId)
    .onSnapshot(snap => onData(snap.docs.map(d => mapAssignment(d.id, d.data()))), onError);
}

/** Administrators: everything from today onwards. */
export function subscribeToUpcoming(
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where('startAt', '>=', ts(startOfDay(new Date())))
    .orderBy('startAt')
    .limit(300)
    .onSnapshot(snap => onData(snap.docs.map(d => mapAssignment(d.id, d.data()))), onError);
}

/** One-shot read of this person's current + upcoming assignments (used by the background sync). */
export async function getMyAssignments(uid: string): Promise<Assignment[]> {
  const from = ts(startOfDay(new Date()));
  const snap = await col().where('assigneeIds', 'array-contains', uid).where('startAt', '>=', from).orderBy('startAt').get();
  return snap.docs.map(d => mapAssignment(d.id, d.data()));
}

export async function getRecentAssignments(days: number): Promise<Assignment[]> {
  const snap = await col()
    .where('startAt', '>=', ts(addDays(startOfDay(new Date()), -days)))
    .get();
  return snap.docs.map(d => mapAssignment(d.id, d.data()));
}

// --------------------------------------------------------------- administrators

/** Answers to keep when an assignment is edited: none if the day/time changed, and never for removed people. */
export function preservedResponses(existing: Assignment, input: AssignmentInput): Record<string, unknown> {
  const timeChanged = existing.date !== input.date || existing.startTime !== input.startTime;
  const responses: Record<string, unknown> = {};
  if (timeChanged) return responses;
  for (const uid of input.assigneeIds) {
    const r = existing.responses[uid];
    if (r) {
      responses[uid] = {
        status: r.status,
        at: ts(r.at),
        ...(r.reason ? { reason: r.reason } : {}),
        ...(r.adminId ? { adminId: r.adminId } : {}),
      };
    }
  }
  return responses;
}

// --------------------------------------------------------------- the assigned person

function setResponse(a: Assignment, uid: string, r: Record<string, unknown>): Promise<CommitResult> {
  return commit(col().doc(a.id).update({ [`responses.${uid}`]: r }));
}

/** Called when a person opens their assignment. Never overwrites an existing answer. */
export function recordViewed(a: Assignment, uid: string): Promise<CommitResult> | null {
  if (a.responses[uid]) return null;
  return setResponse(a, uid, { status: 'seen', at: ts(new Date()) });
}

export function markCannotDo(
  a: Assignment,
  uid: string,
  data: { reason: string; adminId?: string },
): Promise<CommitResult> {
  const reason = data.reason.trim().slice(0, 300);
  return setResponse(a, uid, {
    status: 'cannot_do',
    at: ts(new Date()),
    ...(reason ? { reason } : {}),
    ...(data.adminId ? { adminId: data.adminId } : {}),
  });
}

export function undoCannotDo(a: Assignment, uid: string): Promise<CommitResult> {
  return setResponse(a, uid, { status: 'seen', at: ts(new Date()) });
}
