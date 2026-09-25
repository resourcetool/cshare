import firestore from '@react-native-firebase/firestore';
import { Assignment, Meeting, ProgramRow } from '../types';
import {
  belongsToSheet,
  rowAssignmentId,
  rowNeedsAssignment,
  rowToAssignmentInput,
  sameAssignment,
  scheduleRows,
} from '../utils/program';
import { toDateKey, weekBounds } from '../utils/dates';
import {
  assignmentFields,
  preservedResponses,
} from './assignmentService';
import { commit, CommitResult } from './commit';
import {
  rowToDoc,
  weekDocRef,
} from './weekService';

const now = () =>
  firestore.FieldValue.serverTimestamp();

export interface PublishArgs {
  weekId: string;

  meeting: Meeting;

  /** heading of the meeting, e.g. "YEREMIA 36-37" */
  title: string;

  /** day of the meeting, YYYY-MM-DD */
  date: string;

  startTime: string;

  rows: ProgramRow[];

  /**
   * Everything already saved for this week.
   * Unchanged parts keep their "seen" answers.
   */
  existing: Assignment[];

  reminders: number[];

  adminId: string;
}

/**
 * Saves one meeting's sheet and creates / updates / removes
 * the personal assignments in ONE batch.
 *
 * Assignments made from a sheet have the id:
 *
 *   <weekId>_<mw|we>_<rowId>
 *
 * so saving again updates the same assignment instead of
 * creating duplicates.
 */
export function publishProgram(
  a: PublishArgs,
): Promise<CommitResult> {
  const scheduled = scheduleRows(
    a.rows,
    a.startTime,
  );

  const col =
    firestore().collection('assignments');

  const batch =
    firestore().batch();

  const existingById =
    new Map(
      a.existing
        .filter(x =>
          belongsToSheet(
            x.id,
            a.weekId,
            a.meeting,
          ),
        )
        .map(x => [x.id, x]),
    );

  const keep = new Set<string>();

  scheduled.forEach((row, index) => {
    if (!rowNeedsAssignment(row)) {
      return;
    }

    const id = rowAssignmentId(
      a.weekId,
      a.meeting,
      row.id,
    );

    keep.add(id);

    const input =
      rowToAssignmentInput(row, {
        date: a.date,
        meeting: a.meeting,
        reminders: a.reminders,
        index,
      });

    const before =
      existingById.get(id);

    if (before) {
      /*
       * Nothing people can see has changed.
       *
       * This prevents unnecessary Firestore writes and prevents
       * unnecessary reminder rescheduling.
       */
      if (sameAssignment(before, input)) {
        return;
      }

      /*
       * Rebuild the normal assignment fields from the current
       * program row.
       *
       * If the administrator only changes the assignee, the
       * program's date/time remains the source of truth.
       */
      const fields =
        assignmentFields(input);

      /*
       * Preserve the existing stored startAt when the actual
       * date and start time have NOT changed.
       *
       * This protects an existing assignment from needless
       * Timestamp rewriting when an administrator merely changes
       * who is assigned.
       */
      const scheduleUnchanged =
        before.date === input.date &&
        before.startTime === input.startTime;

      batch.update(
        col.doc(id),
        {
          ...fields,

          ...(scheduleUnchanged
            ? {
                startAt:
                  firestore.Timestamp.fromDate(
                    before.startAt,
                  ),
              }
            : {}),

          responses:
            preservedResponses(
              before,
              input,
            ),

          updatedBy: a.adminId,
          updatedAt: now(),
        },
      );
    } else {
      batch.set(
        col.doc(id),
        {
          ...assignmentFields(input),

          status: 'scheduled',

          responses: {},

          createdBy: a.adminId,
          updatedBy: a.adminId,

          createdAt: now(),
          updatedAt: now(),
        },
      );
    }
  });

  /*
   * Remove assignments that no longer exist on the sheet.
   */
  existingById.forEach(
    (_x, id) => {
      if (!keep.has(id)) {
        batch.delete(
          col.doc(id),
        );
      }
    },
  );

  /*
   * Save the actual meeting sheet.
   */
  batch.set(
    weekDocRef(a.weekId),
    {
      startDate: a.weekId,

      endDate:
        toDateKey(
          weekBounds(a.weekId).end,
        ),

      updatedAt: now(),

      [a.meeting]: {
        title: a.title.trim(),
        date: a.date,
        startTime: a.startTime,

        program:
          scheduled.map(rowToDoc),
      },
    },
    { merge: true },
  );

  return commit(
    batch.commit(),
    6000,
  );
}

/**
 * Removes one meeting's sheet and every assignment
 * made from it.
 */
export function clearSheet(
  weekId: string,
  meeting: Meeting,
  existing: Assignment[],
): Promise<CommitResult> {
  const batch =
    firestore().batch();

  existing
    .filter(x =>
      belongsToSheet(
        x.id,
        weekId,
        meeting,
      ),
    )
    .forEach(x => {
      batch.delete(
        firestore()
          .collection('assignments')
          .doc(x.id),
      );
    });

  const remove =
    firestore.FieldValue.delete();

  batch.update(
    weekDocRef(weekId),

    meeting === 'midweek'
      ? {
          midweek: remove,
          program: remove,
          title: remove,
          startTime: remove,
          meetingDate: remove,
          updatedAt: now(),
        }
      : {
          weekend: remove,
          updatedAt: now(),
        },
  );

  return commit(
    batch.commit(),
    6000,
  );
}