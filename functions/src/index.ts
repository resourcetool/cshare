import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

/**
 * OPTIONAL. The only server-side code in CSHARE.
 *
 * Phones already sync by themselves when they get internet (background sync, every ~15+ min).
 * This function makes it INSTANT: when an assignment changes it sends a silent "data only"
 * push to the people involved. Their app wakes up, reads the latest assignments and schedules
 * the reminders right away (and shows "New assignment"). Needs the Firebase Blaze plan.
 *
 * Reminders themselves are never sent from here: each phone schedules them locally,
 * so they still ring with no internet and with the app closed.
 */

interface AssignmentDoc {
  title?: string;
  date?: string;
  startTime?: string;
  status?: string;
  assigneeIds?: string[];
  assigneeNames?: Record<string, string>;
  responses?: Record<string, { status?: string; adminId?: string }>;
}

async function tokensFor(uids: string[]): Promise<string[]> {
  const tokens = new Set<string>();
  for (let i = 0; i < uids.length; i += 10) {
    const snap = await db.collection('users').where('__name__', 'in', uids.slice(i, i + 10)).get();
    snap.forEach(d => {
      if (d.get('active') === true) (d.get('fcmTokens') ?? []).forEach((t: string) => tokens.add(t));
    });
  }
  return Array.from(tokens);
}

/** Data-only, high priority: delivered to the app even when it is closed. */
async function push(uids: string[], data: Record<string, string>): Promise<void> {
  if (uids.length === 0) return;
  const tokens = await tokensFor(uids);
  for (let i = 0; i < tokens.length; i += 500) {
    await getMessaging().sendEachForMulticast({ tokens: tokens.slice(i, i + 500), data, android: { priority: 'high' } });
  }
}

const fingerprint = (a?: AssignmentDoc) =>
  JSON.stringify([a?.title, a?.date, a?.startTime, a?.status, [...(a?.assigneeIds ?? [])].sort()]);

export const onAssignmentWritten = onDocumentWritten('assignments/{assignmentId}', async event => {
  const id = event.params.assignmentId;
  const before = event.data?.before.data() as AssignmentDoc | undefined;
  const after = event.data?.after.data() as AssignmentDoc | undefined;

  // Anyone added, removed, or whose part changed: tell their phone to sync now.
  if (fingerprint(before) !== fingerprint(after)) {
    const involved = Array.from(new Set([...(before?.assigneeIds ?? []), ...(after?.assigneeIds ?? [])]));
    await push(involved, { type: 'sync', assignmentId: id });
  }

  // Someone newly said "I can't do this": a short notice for the administrator they chose (or all).
  if (!after) return;
  for (const uid of after.assigneeIds ?? []) {
    const was = before?.responses?.[uid]?.status;
    const now = after.responses?.[uid];
    if (now?.status === 'cannot_do' && was !== 'cannot_do') {
      const name = after.assigneeNames?.[uid] ?? 'Someone';
      let adminIds: string[] = now.adminId ? [now.adminId] : [];
      if (adminIds.length === 0) {
        const admins = await db.collection('users').where('role', '==', 'admin').where('active', '==', true).get();
        adminIds = admins.docs.map(d => d.id);
      }
      await push(adminIds, {
        type: 'notify',
        title: 'CSHARE',
        body: `${name} can't do ${after.title ?? 'an assignment'} (${after.date ?? ''} ${after.startTime ?? ''}).`.trim(),
        assignmentId: id,
      });
    }
  }
});


interface ReportDoc {
  uid?: string;
  monthKey?: string;
  groupId?: string;
  reporterName?: string;
  reportingType?: string;
  participated?: boolean;
  hours?: number;
  bibleStudies?: number;
}

/** Alerts the assigned group overseer when a new monthly report arrives. */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async event => {
  const report = event.data?.data() as ReportDoc | undefined;
  if (!report?.groupId) return;

  const groupSnap = await db.collection('groups').doc(report.groupId).get();
  if (!groupSnap.exists) return;
  const overseerId = groupSnap.get('overseerId') as string | undefined;
  if (!overseerId || overseerId === report.uid) return;

  const name = report.reporterName ?? 'A member';
  const month = report.monthKey ?? 'this month';
  const detail = report.hours !== undefined
    ? `${report.hours} hours${report.bibleStudies !== undefined ? `, ${report.bibleStudies} Bible studies` : ''}`
    : report.participated === true
      ? 'had a part in the ministry'
      : 'did not have a part in the ministry';

  await push([overseerId], {
    type: 'notify',
    title: 'New group report',
    body: `${name} submitted their ${month} report: ${detail}.`,
    groupId: report.groupId,
    reportId: event.params.reportId,
  });
});
