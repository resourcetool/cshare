import firestore from '@react-native-firebase/firestore';
import { DEFAULT_SETTINGS, MEETING_TEMPLATES, TemplateLang } from '../constants';
import { AppSettings, AssignmentType } from '../types';
import { normalizeOffsets } from '../utils/reminders';
import { commit, CommitResult } from './commit';

const settingsDoc = () => firestore().collection('settings').doc('app');
const typesCol = () => firestore().collection('assignmentTypes');
const now = () => firestore.FieldValue.serverTimestamp();

function mapSettings(d: { [k: string]: any }): AppSettings { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    categories: Array.isArray(d.categories) && d.categories.length ? d.categories : DEFAULT_SETTINGS.categories,
    reminderOffsetsMinutes: Array.isArray(d.reminderOffsetsMinutes) ? normalizeOffsets(d.reminderOffsetsMinutes) : DEFAULT_SETTINGS.reminderOffsetsMinutes,
    callStyleEnabled: d.callStyleEnabled !== false,
    meetingDay: typeof d.meetingDay === 'number' ? d.meetingDay : DEFAULT_SETTINGS.meetingDay,
    meetingTime: typeof d.meetingTime === 'string' ? d.meetingTime : DEFAULT_SETTINGS.meetingTime,
    minutesFormat: typeof d.minutesFormat === 'string' && d.minutesFormat.includes('{n}') ? d.minutesFormat : DEFAULT_SETTINGS.minutesFormat,
    weekendDay: typeof d.weekendDay === 'number' ? d.weekendDay : DEFAULT_SETTINGS.weekendDay,
    weekendTime: typeof d.weekendTime === 'string' ? d.weekendTime : DEFAULT_SETTINGS.weekendTime,
    midweekName: typeof d.midweekName === 'string' && d.midweekName.trim() ? d.midweekName : DEFAULT_SETTINGS.midweekName,
    weekendName: typeof d.weekendName === 'string' && d.weekendName.trim() ? d.weekendName : DEFAULT_SETTINGS.weekendName,
    regularPioneerHours: typeof d.regularPioneerHours === 'number' && d.regularPioneerHours > 0 ? d.regularPioneerHours : DEFAULT_SETTINGS.regularPioneerHours,
    auxiliaryPioneerHours: typeof d.auxiliaryPioneerHours === 'number' && d.auxiliaryPioneerHours > 0 ? d.auxiliaryPioneerHours : DEFAULT_SETTINGS.auxiliaryPioneerHours,
  };
}

/** One-shot read (background sync). Falls back to the saved copy when offline. */
export async function getSettings(): Promise<AppSettings> {
  const snap = await settingsDoc().get();
  return mapSettings(snap.data() ?? {});
}

export function subscribeToSettings(
  onData: (s: AppSettings) => void,
  onError: (e: unknown) => void,
): () => void {
  return settingsDoc().onSnapshot(snap => onData(mapSettings(snap.data() ?? {})), onError);
}

export function saveSettings(s: AppSettings): Promise<CommitResult> {
  return commit(
    settingsDoc().set(
      {
        categories: s.categories,
        reminderOffsetsMinutes: normalizeOffsets(s.reminderOffsetsMinutes),
        callStyleEnabled: s.callStyleEnabled,
        meetingDay: s.meetingDay,
        meetingTime: s.meetingTime,
        minutesFormat: s.minutesFormat.includes('{n}') ? s.minutesFormat : DEFAULT_SETTINGS.minutesFormat,
        weekendDay: s.weekendDay,
        weekendTime: s.weekendTime,
        midweekName: s.midweekName.trim() || DEFAULT_SETTINGS.midweekName,
        weekendName: s.weekendName.trim() || DEFAULT_SETTINGS.weekendName,
        regularPioneerHours: s.regularPioneerHours > 0 ? s.regularPioneerHours : DEFAULT_SETTINGS.regularPioneerHours,
        auxiliaryPioneerHours: s.auxiliaryPioneerHours > 0 ? s.auxiliaryPioneerHours : DEFAULT_SETTINGS.auxiliaryPioneerHours,
        updatedAt: now(),
      },
      { merge: true },
    ),
  );
}

export function subscribeToTypes(
  onData: (list: AssignmentType[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return typesCol().onSnapshot(
    snap =>
      onData(
        snap.docs
          .map((d): AssignmentType => {
            const t = d.data();
            return {
              id: d.id,
              name: t.name ?? '',
              description: t.description ?? '',
              category: t.category ?? '',
              requiresQualification: t.requiresQualification === true,
              allowsMultipleAssignees: t.allowsMultipleAssignees === true,
              active: t.active !== false,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : 100,
              kind: t.kind === 'song' || t.kind === 'note' ? t.kind : 'part',
              minutes: typeof t.minutes === 'number' ? t.minutes : 5,
              people: typeof t.people === 'number' ? t.people : 1,
              numbered: t.numbered !== false && t.kind !== 'song' && t.kind !== 'note',
              icon: t.icon ?? '📌',
              meeting: t.meeting === 'weekend' ? 'weekend' : 'midweek',
              requiredRole: t.requiredRole ?? undefined,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      ),
    onError,
  );
}

function typeDoc(t: Omit<AssignmentType, 'id'>) {
  return {
    name: t.name,
    description: t.description,
    category: t.category,
    requiresQualification: t.requiresQualification,
    allowsMultipleAssignees: t.allowsMultipleAssignees,
    active: t.active,
    sortOrder: t.sortOrder,
    kind: t.kind,
    minutes: t.minutes,
    people: t.people,
    numbered: t.numbered,
    icon: t.icon,
    meeting: t.meeting,
    requiredRole: t.requiredRole ?? null,
    updatedAt: now(),
  };
}

export function saveType(t: Omit<AssignmentType, 'id'> & { id?: string }): Promise<CommitResult> {
  const ref = t.id ? typesCol().doc(t.id) : typesCol().doc();
  const { id: _id, ...data } = t;
  return commit(ref.set(typeDoc(data), { merge: true }));
}

export function deleteType(id: string): Promise<CommitResult> {
  return commit(typesCol().doc(id).delete());
}

/** Replaces the assignment types, the sheet sections and the minutes wording with a language preset. */
export async function loadMeetingTemplate(lang: TemplateLang): Promise<CommitResult> {
  const template = MEETING_TEMPLATES[lang];
  const snap = await typesCol().get();
  const batch = firestore().batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  template.types.forEach(t => batch.set(typesCol().doc(), typeDoc(t)));
  batch.set(settingsDoc(), { categories: template.categories, minutesFormat: template.minutesFormat, midweekName: template.midweekName, weekendName: template.weekendName, updatedAt: now() }, { merge: true });
  return commit(batch.commit());
}
