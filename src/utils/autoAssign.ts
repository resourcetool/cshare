import { AssignmentStatus, PrivilegeRole, UserProfile } from '../types';
import { addDays, daysBetween } from './dates';
import { meetsRequiredRole } from './qualifications';

export interface RecentAssignment {
  typeId?: string;
  weekId: string;
  assigneeIds: string[];
  startAt: Date;
  status: AssignmentStatus;
}

export interface AutoAssignInput {
  typeId?: string;
  requiredRole?: PrivilegeRole;
  requiresQualification: boolean;
  count: number;
  people: UserProfile[];
  recent: RecentAssignment[];
  weekId: string;
  excludeIds: string[];
  now: Date;
}

export interface AutoAssignResult {
  picks: UserProfile[];
  notes: string[];
}

/**
 * Simple, predictable suggestions. NOT a decision: the administrator reviews and confirms.
 *  1. active people only
 *  2. if a qualification is required, only qualified people
 *  3. prefer people with no other assignment this week
 *  4. then whoever did this kind of assignment longest ago (or never)
 *  5. then whoever has had the fewest assignments in the last 60 days
 *  6. then alphabetical, so the result is always the same for the same data
 */
export function suggestAssignees(input: AutoAssignInput): AutoAssignResult {
  const notes: string[] = [];
  const count = Math.max(1, Math.floor(input.count));
  let pool = input.people.filter(p => p.active && !input.excludeIds.includes(p.id));

  if (input.requiresQualification) {
    if (!input.requiredRole) {
      return { picks: [], notes: ['Choose an assignment type first, so qualified people can be found.'] };
    }
    pool = pool.filter(p => meetsRequiredRole(p.qualifications, input.requiredRole));
  }

  const recent = input.recent.filter(r => r.status !== 'cancelled');
  const cutoff = addDays(input.now, -60).getTime();

  const scored = pool.map(p => {
    const mine = recent.filter(r => r.assigneeIds.includes(p.id));
    const sameType = input.typeId ? mine.filter(r => r.typeId === input.typeId) : [];
    const last = sameType.reduce((m, r) => Math.max(m, r.startAt.getTime()), -Infinity);
    return {
      p,
      busy: mine.some(r => r.weekId === input.weekId),
      sinceSame: last === -Infinity ? Infinity : daysBetween(new Date(last), input.now),
      recentCount: mine.filter(r => r.startAt.getTime() >= cutoff).length,
    };
  });

  scored.sort((a, b) => {
    if (a.busy !== b.busy) return a.busy ? 1 : -1;
    if (a.sinceSame !== b.sinceSame) return a.sinceSame > b.sinceSame ? -1 : 1;
    if (a.recentCount !== b.recentCount) return a.recentCount - b.recentCount;
    return a.p.name.localeCompare(b.p.name);
  });

  const picks = scored.slice(0, count).map(s => s.p);
  if (picks.length === 0) {
    notes.push(input.requiresQualification ? 'Nobody is marked as qualified for this yet.' : 'There is nobody available.');
  } else if (picks.length < count) {
    notes.push(`Only ${picks.length} ${input.requiresQualification ? 'qualified ' : ''}${picks.length === 1 ? 'person is' : 'people are'} available.`);
  }
  if (picks.some(p => scored.find(s => s.p.id === p.id)?.busy)) {
    notes.push('Some of these people already have an assignment this week.');
  }
  return { picks, notes };
}
