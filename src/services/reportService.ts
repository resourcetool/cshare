import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { FieldServiceEntry, MonthlyReport, MonthlyReportInput } from '../types';
import { toDate } from '../utils/dates';
import { commit, CommitResult } from './commit';

const reports = () => firestore().collection('reports');
const serviceEntries = (uid: string) =>
  firestore().collection('serviceEntries').doc(uid).collection('entries');
const now = () => firestore.FieldValue.serverTimestamp();

/** Doc id is always this — one monthly report can exist for a given person/month. */
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

function mapServiceEntry(id: string, d: FT.DocumentData): FieldServiceEntry {
  return {
    id,
    uid: d.uid ?? '',
    date: d.date ?? '',
    monthKey: d.monthKey ?? '',
    hours: typeof d.hours === 'number' ? d.hours : 0,
    bibleStudies: typeof d.bibleStudies === 'number' ? d.bibleStudies : 0,
    createdAt: toDate(d.createdAt),
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
    .onSnapshot(
      snap => onData(snap.exists && snap.data() ? mapReport(snap.id, snap.data() as FT.DocumentData) : null),
      onError,
    );
}

/** Live daily field-service entries for the signed-in pioneer for one month. */
export function subscribeToMyServiceEntries(
  uid: string,
  monthKey: string,
  onData: (entries: FieldServiceEntry[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return serviceEntries(uid)
    .where('monthKey', '==', monthKey)
    .onSnapshot(
      snap => {
        const list = snap.docs
          .map(d => mapServiceEntry(d.id, d.data() as FT.DocumentData))
          .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        onData(list);
      },
      onError,
    );
}

/** Add one field-service visit. Only auxiliary/regular pioneers can create these; Firestore enforces that. */
export function addServiceEntry(
  uid: string,
  entry: { date: string; monthKey: string; hours: number; bibleStudies: number },
): Promise<CommitResult> {
  const ref = serviceEntries(uid).doc();
  return commit(
    ref.set({
      uid,
      date: entry.date,
      monthKey: entry.monthKey,
      hours: entry.hours,
      bibleStudies: entry.bibleStudies,
      createdAt: now(),
      updatedAt: now(),
    }),
  );
}

export function updateServiceEntry(
  uid: string,
  entryId: string,
  patch: { date: string; monthKey: string; hours: number; bibleStudies: number },
): Promise<CommitResult> {
  return commit(
    serviceEntries(uid).doc(entryId).update({
      date: patch.date,
      monthKey: patch.monthKey,
      hours: patch.hours,
      bibleStudies: patch.bibleStudies,
      updatedAt: now(),
    }),
  );
}

export function deleteServiceEntry(
  uid: string,
  entryId: string,
): Promise<CommitResult> {
  return commit(serviceEntries(uid).doc(entryId).delete());
}

/** One-shot read used by background sync to decide whether a report reminder is still due. */
export async function getMyReport(uid: string, monthKey: string): Promise<MonthlyReport | null> {
  const snap = await reports().doc(reportId(uid, monthKey)).get();
  const data = snap.data();
  return snap.exists && data ? mapReport(snap.id, data) : null;
}

/**
 * Submits the final monthly report. For pioneers, the totals shown by the app come from the
 * daily entries. A normal user cannot overwrite a submitted report; only an administrator can
 * correct an existing report.
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

/** Live reports belonging to one ministry group. */
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