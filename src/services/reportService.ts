import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { MonthlyReport, MonthlyReportInput } from '../types';
import { toDate } from '../utils/dates';
import { commit, CommitResult } from './commit';

const reports = () => firestore().collection('reports');
const now = () => firestore.FieldValue.serverTimestamp();

/** Doc id is always this — one document can ever exist for a given person/month. */
export function reportId(uid: string, monthKey: string): string {
  return `${uid}_${monthKey}`;
}

function mapReport(id: string, d: FT.DocumentData): MonthlyReport {
  return {
    id,
    uid: d.uid ?? '',
    monthKey: d.monthKey ?? '',
    reportingType: d.reportingType ?? 'publisher',
    groupId: typeof d.groupId === 'string' ? d.groupId : undefined,
    reporterName: typeof d.reporterName === 'string' ? d.reporterName : undefined,
    participated: typeof d.participated === 'boolean' ? d.participated : undefined,
    hours: typeof d.hours === 'number' ? d.hours : undefined,
    bibleStudies: typeof d.bibleStudies === 'number' ? d.bibleStudies : undefined,
    createdBy: d.createdBy ?? '',
    submittedAt: toDate(d.submittedAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/** This person's report for one month, or null if they haven't submitted it yet. */
export function subscribeToMyReport(
  uid: string,
  monthKey: string,
  onData: (r: MonthlyReport | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return reports()
    .doc(reportId(uid, monthKey))
    .onSnapshot(snap => onData(snap.exists && snap.data() ? mapReport(snap.id, snap.data() as FT.DocumentData) : null), onError);
}

/** One-shot read (used by the background sync, to decide whether a report reminder is still due). */
export async function getMyReport(uid: string, monthKey: string): Promise<MonthlyReport | null> {
  const snap = await reports().doc(reportId(uid, monthKey)).get();
  const data = snap.data();
  return snap.exists && data ? mapReport(snap.id, data) : null;
}

/**
 * Submits a report for the given month. The doc id (`${uid}_${monthKey}`) means there can only
 * ever be one. This calls plain `.set()`, but Firestore evaluates a `.set()` against the
 * security rules' `create` rule ONLY while the document doesn't exist yet — the moment it does,
 * the very same call is evaluated as an `update`, which the rules only allow an administrator to
 * do. So a second accidental submission for the same month is rejected by the server outright,
 * not just discouraged by the UI. If a correction is genuinely needed, an administrator can
 * update it.
 */
export function submitReport(
  uid: string,
  monthKey: string,
  input: MonthlyReportInput,
  snapshot: { groupId?: string; reporterName: string },
): Promise<CommitResult> {
  return commit(
    reports()
      .doc(reportId(uid, monthKey))
      .set({
        uid,
        monthKey,
        reportingType: input.reportingType,
        ...(snapshot.groupId ? { groupId: snapshot.groupId } : {}),
        reporterName: snapshot.reporterName,
        ...(input.participated !== undefined ? { participated: input.participated } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.bibleStudies !== undefined ? { bibleStudies: input.bibleStudies } : {}),
        createdBy: uid,
        submittedAt: now(),
        updatedAt: now(),
      }),
  );
}


/** Live reports belonging to one ministry group. The security rules only permit an administrator
 * or that group's overseer to read this query. Filtering by groupId alone avoids requiring a
 * composite Firestore index; the current month is filtered locally. */
export function subscribeToGroupReports(
  groupId: string,
  monthKey: string,
  onData: (reports: MonthlyReport[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return reports()
    .where('groupId', '==', groupId)
    .onSnapshot(
      snap => {
        const list = snap.docs
          .map(d => mapReport(d.id, d.data() as FT.DocumentData))
          .filter(r => r.monthKey === monthKey)
          .sort((a, b) => (a.reporterName ?? a.uid).localeCompare(b.reporterName ?? b.uid));
        onData(list);
      },
      onError,
    );
}
