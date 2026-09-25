import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { Assignment, AssignmentInput, AssignmentResponse } from '../types';
import { addDays, combineDateTime, startOfDay, toDate, weekIdFor } from '../utils/dates';
import { normalizeOffsets } from '../utils/reminders';
import { commit, CommitResult } from './commit';

const col = () => firestore().collection('assignments');
const ts = (d: Date) => firestore.Timestamp.fromDate(d);

/**
 * Converts one Firestore assignment into the app's Assignment type.
 *
 * IMPORTANT:
 * The date + startTime fields are treated as the human-readable schedule.
 * If they exist, they are used to calculate startAt. This protects the app
 * from an old/stale Firestore startAt value hiding an assignment from the
 * user's homepage or reminder system.
 */
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

  const date =
    typeof d.date === 'string' && d.date.trim()
      ? d.date
      : '1970-01-01';

  const startTime =
    typeof d.startTime === 'string' && d.startTime.trim()
      ? d.startTime
      : '00:00';

  /*
   * Prefer date + startTime because those are the values displayed and edited
   * by the administrator. The stored startAt is only used as a fallback for
   * older documents that may not have usable date/time fields.
   */
  const calculatedStartAt =
    date !== '1970-01-01'
      ? combineDateTime(date, startTime)
      : toDate(d.startAt) ?? new Date(0);

  return {
    id,
    weekId: d.weekId ?? '',
    typeId: d.typeId ?? undefined,
    requiredRole: d.requiredRole ?? undefined,
    icon: d.icon ?? undefined,

    meeting:
      d.meeting === 'weekend' || d.meeting === 'midweek'
        ? d.meeting
        : undefined,

    title: d.title ?? '',
    description: d.description ?? '',
    category: d.category ?? '',
    location: d.location ?? '',

    date,
    startTime,
    endTime: d.endTime ?? undefined,

    startAt: calculatedStartAt,

    assigneeIds: Array.isArray(d.assigneeIds)
      ? d.assigneeIds
      : [],

    assigneeNames:
      d.assigneeNames && typeof d.assigneeNames === 'object'
        ? d.assigneeNames
        : {},

    childAssignees: Array.isArray(d.childAssignees)
      ? d.childAssignees
      : [],

    requiresQualification: d.requiresQualification === true,

    status:
      d.status === 'cancelled'
        ? 'cancelled'
        : 'scheduled',

    responses,

    reminderOffsetsMinutes: Array.isArray(d.reminderOffsetsMinutes)
      ? d.reminderOffsetsMinutes
      : [],

    sortOrder:
      typeof d.sortOrder === 'number'
        ? d.sortOrder
        : 100,

    createdBy: d.createdBy ?? '',
    updatedBy: d.updatedBy ?? '',

    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/**
 * Fields written when an assignment is created or updated.
 */
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

    reminderOffsetsMinutes: normalizeOffsets(
      input.reminderOffsetsMinutes,
    ),

    sortOrder: input.sortOrder,

    weekId: weekIdFor(input.date),

    /*
     * Keep writing startAt for Firestore queries, admin screens and
     * compatibility with existing data.
     */
    startAt: ts(
      combineDateTime(
        input.date,
        input.startTime,
      ),
    ),
  };
}

// ---------------------------------------------------------------
// reading (live)

/**
 * Gets ALL assignments assigned to this person.
 *
 * IMPORTANT:
 * We intentionally do NOT use:
 *
 *   where('startAt', '>=', ...)
 *
 * here.
 *
 * If startAt becomes stale or incorrect, Firestore would hide the assignment
 * completely and the user would see "No upcoming assignments" even though
 * they have actually been assigned a part.
 *
 * We fetch by assignee first and let the app use the date/startTime fields
 * to determine whether the assignment is current or upcoming.
 */
export function subscribeToMyAssignments(
  uid: string,
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where('assigneeIds', 'array-contains', uid)
    .onSnapshot(
      snap => {
        const list = snap.docs
          .map(d => mapAssignment(d.id, d.data()))
          .sort(
            (a, b) =>
              a.startAt.getTime() -
              b.startAt.getTime(),
          );

        onData(list);
      },
      onError,
    );
}

/**
 * All assignments belonging to a particular week.
 *
 * This is unchanged in behavior.
 */
export function subscribeToWeekAssignments(
  weekId: string,
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where('weekId', '==', weekId)
    .onSnapshot(
      snap =>
        onData(
          snap.docs.map(d =>
            mapAssignment(d.id, d.data()),
          ),
        ),
      onError,
    );
}

/**
 * Administrators: everything from today onwards.
 *
 * This remains a startAt query because administrators need a bounded
 * upcoming list. The assignments are mapped using the same safe date/time
 * handling above.
 */
export function subscribeToUpcoming(
  onData: (list: Assignment[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where(
      'startAt',
      '>=',
      ts(startOfDay(new Date())),
    )
    .orderBy('startAt')
    .limit(300)
    .onSnapshot(
      snap =>
        onData(
          snap.docs.map(d =>
            mapAssignment(d.id, d.data()),
          ),
        ),
      onError,
    );
}

/**
 * One-shot read used by the background reminder sync.
 *
 * IMPORTANT:
 * This intentionally fetches by assignee only.
 *
 * The reminder engine itself decides which assignments are actually
 * upcoming and therefore need reminders.
 */
export async function getMyAssignments(
  uid: string,
): Promise<Assignment[]> {
  const snap = await col()
    .where('assigneeIds', 'array-contains', uid)
    .get();

  return snap.docs
    .map(d => mapAssignment(d.id, d.data()))
    .sort(
      (a, b) =>
        a.startAt.getTime() -
        b.startAt.getTime(),
    );
}

export async function getRecentAssignments(
  days: number,
): Promise<Assignment[]> {
  const snap = await col()
    .where(
      'startAt',
      '>=',
      ts(
        addDays(
          startOfDay(new Date()),
          -days,
        ),
      ),
    )
    .get();

  return snap.docs.map(d =>
    mapAssignment(d.id, d.data()),
  );
}

// ---------------------------------------------------------------
// administrators

/**
 * Answers to keep when an assignment is edited:
 * - none if the day/time changed
 * - never keep answers for people who were removed
 */
export function preservedResponses(
  existing: Assignment,
  input: AssignmentInput,
): Record<string, unknown> {
  const timeChanged =
    existing.date !== input.date ||
    existing.startTime !== input.startTime;

  const responses: Record<string, unknown> = {};

  if (timeChanged) return responses;

  for (const uid of input.assigneeIds) {
    const r = existing.responses[uid];

    if (r) {
      responses[uid] = {
        status: r.status,
        at: ts(r.at),
        ...(r.reason
          ? { reason: r.reason }
          : {}),
        ...(r.adminId
          ? { adminId: r.adminId }
          : {}),
      };
    }
  }

  return responses;
}

// ---------------------------------------------------------------
// the assigned person

function setResponse(
  a: Assignment,
  uid: string,
  r: Record<string, unknown>,
): Promise<CommitResult> {
  return commit(
    col()
      .doc(a.id)
      .update({
        [`responses.${uid}`]: r,
      }),
  );
}

/**
 * Called when a person opens their assignment.
 * Never overwrites an existing answer.
 */
export function recordViewed(
  a: Assignment,
  uid: string,
): Promise<CommitResult> | null {
  if (a.responses[uid]) return null;

  return setResponse(a, uid, {
    status: 'seen',
    at: ts(new Date()),
  });
}

export function markCannotDo(
  a: Assignment,
  uid: string,
  data: {
    reason: string;
    adminId?: string;
  },
): Promise<CommitResult> {
  const reason = data.reason
    .trim()
    .slice(0, 300);

  return setResponse(a, uid, {
    status: 'cannot_do',
    at: ts(new Date()),

    ...(reason ? { reason } : {}),

    ...(data.adminId
      ? { adminId: data.adminId }
      : {}),
  });
}

export function undoCannotDo(
  a: Assignment,
  uid: string,
): Promise<CommitResult> {
  return setResponse(a, uid, {
    status: 'seen',
    at: ts(new Date()),
  });
}