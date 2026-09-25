import { Assignment, AssignmentInput, AssignmentType, Meeting, PrivilegeRole, ProgramRow } from '../types';
import { pad2 } from './dates';
import { meetsRequiredRole } from './qualifications';

/** One line of the sheet made from an assignment type. */
export function rowFromType(t: AssignmentType, id: string = t.id, section: string = t.category): ProgramRow {
  return {
    id,
    typeId: t.id,
    requiredRole: t.requiredRole,
    kind: t.kind,
    section,
    label: t.name,
    title: t.name,
    icon: t.icon,
    minutes: t.minutes,
    numbered: t.numbered && t.kind === 'part',
    requiresQualification: t.requiresQualification,
    multiple: t.allowsMultipleAssignees,
    people: Math.max(1, t.people),
    assigneeIds: [],
    assigneeNames: {},
    childAssignees: [],
  };
}

/** The default sheet of one meeting: every type of that meeting that is in use, in printed order. */
export function rowsFromTypes(types: AssignmentType[], meeting: Meeting): ProgramRow[] {
  return types
    .filter(t => t.active && t.meeting === meeting)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(t => rowFromType(t));
}

/** Puts a row at the end of its section (or at the very end if the section is not on the sheet yet). */
export function insertInSection(rows: ProgramRow[], row: ProgramRow): ProgramRow[] {
  const last = rows.map(r => r.section).lastIndexOf(row.section);
  const next = [...rows];
  next.splice(last === -1 ? next.length : last + 1, 0, row);
  return next;
}

/** "{n} min" -> "7 min", "Simma {n}" -> "Simma 7" */
export function formatMinutes(format: string, n: number): string {
  return (format.includes('{n}') ? format : '{n} min').replace('{n}', String(n));
}

/** A blank row the administrator adds by hand. */
export function blankRow(section: string, id: string): ProgramRow {
  return {
    id,
    kind: 'part',
    section,
    label: 'Part',
    title: '',
    icon: '📌',
    minutes: 5,
    numbered: true,
    requiresQualification: false,
    multiple: true,
    people: 1,
    assigneeIds: [],
    assigneeNames: {},
    childAssignees: [],
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHmm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

/** Working out each line's time from the start of the meeting and the minutes of the lines before it. */
export function scheduleRows(rows: ProgramRow[], startTime: string): ProgramRow[] {
  let t = toMinutes(startTime);
  return rows.map(r => {
    const start = toHHmm(t);
    t += Math.max(0, r.minutes);
    return { ...r, startTime: start, endTime: r.minutes > 0 ? toHHmm(t) : undefined };
  });
}

/** Printed numbers: only numbered parts count (1, 2, 3 ...). */
export function rowNumbers(rows: ProgramRow[]): (number | null)[] {
  let n = 0;
  return rows.map(r => (r.numbered && r.kind === 'part' ? ++n : null));
}

export interface ProgramSection {
  section: string;
  rows: ProgramRow[];
}

/** Consecutive rows with the same section, keeping the order of the sheet. */
export function programSections(rows: ProgramRow[]): ProgramSection[] {
  const out: ProgramSection[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.section === r.section) last.rows.push(r);
    else out.push({ section: r.section, rows: [r] });
  }
  return out;
}

/** "Gifty Quaye / Agnes Odum" - the way the printed sheet writes pairs. */
export function assigneeText(row: Pick<ProgramRow, 'assigneeIds' | 'assigneeNames'>): string {
  return row.assigneeIds.map(id => row.assigneeNames[id] ?? 'Unknown').join(' / ');
}

/** "Dwom [74]", "Bible Akenkan (4 min)" */
export function rowHeading(row: ProgramRow): string {
  if (row.kind === 'song') return row.number ? `${row.title || row.label} [${row.number}]` : row.title || row.label;
  return row.title || row.label;
}

const meetingCode = (m: Meeting): string => (m === 'midweek' ? 'mw' : 'we');

/** Id of the assignment created from a row, stable so saving again updates instead of duplicating. */
export function rowAssignmentId(weekId: string, meeting: Meeting, rowId: string): string {
  return `${weekId}_${meetingCode(meeting)}_${rowId}`;
}

/**
 * Does this assignment id belong to the sheet of that meeting?
 * Ids from the first version of the sheet (no meeting code) count as midweek.
 */
export function belongsToSheet(id: string, weekId: string, meeting: Meeting): boolean {
  if (id.startsWith(`${weekId}_${meetingCode(meeting)}_`)) return true;
  const isCoded = id.startsWith(`${weekId}_mw_`) || id.startsWith(`${weekId}_we_`);
  return meeting === 'midweek' && id.startsWith(`${weekId}_`) && !isCoded;
}

/** True when saving would not change anything people can see, so no write is needed. */
export function sameAssignment(existing: Assignment, input: AssignmentInput): boolean {
  const ids = (x: string[]) => [...x].sort().join('|');
  return (
    existing.title === input.title &&
    existing.date === input.date &&
    existing.startTime === input.startTime &&
    (existing.endTime ?? '') === (input.endTime ?? '') &&
    existing.category === input.category &&
    (existing.icon ?? '') === (input.icon ?? '') &&
    (existing.meeting ?? '') === (input.meeting ?? '') &&
    existing.requiresQualification === input.requiresQualification &&
    existing.sortOrder === input.sortOrder &&
    ids(existing.assigneeIds) === ids(input.assigneeIds) &&
    input.assigneeIds.every(id => existing.assigneeNames[id] === input.assigneeNames[id]) &&
    ids(existing.childAssignees ?? []) === ids(input.childAssignees ?? []) &&
    existing.reminderOffsetsMinutes.join(',') === input.reminderOffsetsMinutes.join(',')
  );
}

/** Only parts with at least one person become assignments (songs and notes stay on the sheet only). */
export function rowNeedsAssignment(row: ProgramRow): boolean {
  return row.kind === 'part' && row.assigneeIds.length > 0;
}

export function rowToAssignmentInput(
  row: ProgramRow,
  ctx: { date: string; meeting: Meeting; reminders: number[]; index: number },
): AssignmentInput {
  return {
    meeting: ctx.meeting,
    typeId: row.typeId,
    requiredRole: row.requiredRole,
    icon: row.icon,
    title: row.title || row.label,
    description: '',
    category: row.section,
    location: '',
    date: ctx.date,
    startTime: row.startTime ?? '00:00',
    endTime: row.endTime,
    assigneeIds: row.assigneeIds,
    assigneeNames: row.assigneeNames,
    childAssignees: row.childAssignees,
    requiresQualification: row.requiresQualification && !!row.requiredRole,
    reminderOffsetsMinutes: ctx.reminders,
    sortOrder: ctx.index * 10,
  };
}

/** People who are on a part that needs a qualification they do not have. */
export function unqualifiedAssignments(
  rows: ProgramRow[],
  qualifications: Record<string, PrivilegeRole[]>,
): { row: ProgramRow; personId: string }[] {
  const out: { row: ProgramRow; personId: string }[] = [];
  for (const row of rows) {
    if (!row.requiresQualification || !row.requiredRole) continue;
    for (const id of row.assigneeIds) {
      if (row.childAssignees?.includes(id)) continue; // a child's own qualifications are not tracked
      if (!meetsRequiredRole(qualifications[id], row.requiredRole)) out.push({ row, personId: id });
    }
  }
  return out;
}
