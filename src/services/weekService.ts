import firestore from '@react-native-firebase/firestore';
import { MeetingSheet, ProgramRow, Week } from '../types';
import { toDate } from '../utils/dates';

const col = () => firestore().collection('weeks');

function mapRow(d: { [k: string]: any }): ProgramRow { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: d.id ?? '',
    typeId: d.typeId ?? undefined,
    requiredRole: d.requiredRole ?? undefined,
    kind: d.kind === 'song' || d.kind === 'note' ? d.kind : 'part',
    section: d.section ?? '',
    label: d.label ?? '',
    title: d.title ?? '',
    icon: d.icon ?? '📌',
    minutes: typeof d.minutes === 'number' ? d.minutes : 0,
    numbered: d.numbered === true,
    requiresQualification: d.requiresQualification === true,
    multiple: d.multiple === true,
    people: typeof d.people === 'number' ? d.people : 1,
    assigneeIds: d.assigneeIds ?? [],
    assigneeNames: d.assigneeNames ?? {},
    childAssignees: d.childAssignees ?? [],
    number: d.number ?? undefined,
    startTime: d.startTime ?? undefined,
    endTime: d.endTime ?? undefined,
  };
}

/** Firestore does not accept `undefined`, so optional values are written as null. */
export function rowToDoc(r: ProgramRow) {
  return {
    id: r.id,
    typeId: r.typeId ?? null,
    requiredRole: r.requiredRole ?? null,
    kind: r.kind,
    section: r.section,
    label: r.label,
    title: r.title,
    icon: r.icon,
    minutes: r.minutes,
    numbered: r.numbered,
    requiresQualification: r.requiresQualification,
    multiple: r.multiple,
    people: r.people,
    assigneeIds: r.assigneeIds,
    assigneeNames: r.assigneeNames,
    childAssignees: r.childAssignees ?? [],
    number: r.number ?? null,
    startTime: r.startTime ?? null,
    endTime: r.endTime ?? null,
  };
}

export const weekDocRef = (weekId: string) => col().doc(weekId);

function mapSheet(d: { [k: string]: any }): MeetingSheet { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    title: d.title ?? '',
    date: d.date ?? '',
    startTime: d.startTime ?? '',
    program: Array.isArray(d.program) ? d.program.map(mapRow) : [],
  };
}

function mapWeek(id: string, d: { [k: string]: any }): Week { // eslint-disable-line @typescript-eslint/no-explicit-any
  const sheets: Week['sheets'] = {};
  if (d.midweek && Array.isArray(d.midweek.program)) {
    sheets.midweek = mapSheet(d.midweek);
  } else if (Array.isArray(d.program) && d.program.length > 0) {
    // first version of the app stored the (midweek) sheet at the top of the week document
    sheets.midweek = mapSheet({ title: d.title, date: d.meetingDate, startTime: d.startTime, program: d.program });
  }
  if (d.weekend && Array.isArray(d.weekend.program)) sheets.weekend = mapSheet(d.weekend);
  return {
    id,
    sheets,
    startDate: d.startDate ?? id,
    endDate: d.endDate ?? '',
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function subscribeToWeek(
  weekId: string,
  onData: (w: Week | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .doc(weekId)
    .onSnapshot(snap => {
      const d = snap.data();
      onData(snap.exists && d ? mapWeek(snap.id, d) : null);
    }, onError);
}

/**
 * A run of weeks (ids are Monday dates, so they sort as text). The app keeps the nearby weeks
 * in its saved copy so the whole meeting sheet can be read offline.
 */
export function subscribeToWeeks(
  fromWeekId: string,
  toWeekId: string,
  onData: (list: Week[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return col()
    .where(firestore.FieldPath.documentId(), '>=', fromWeekId)
    .where(firestore.FieldPath.documentId(), '<=', toWeekId)
    .onSnapshot(snap => onData(snap.docs.map(d => mapWeek(d.id, d.data()))), onError);
}
