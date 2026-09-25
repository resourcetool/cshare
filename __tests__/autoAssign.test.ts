import { suggestAssignees } from '../src/utils/autoAssign';
import { PrivilegeRole } from '../src/types';
import { combineDateTime } from '../src/utils/dates';
import { makeUser } from './helpers';

const now = combineDateTime('2026-10-01', '09:00');
const T = 'bible';
const q: PrivilegeRole[] = ['baptized_publisher'];
const base = { typeId: T, requiredRole: 'baptized_publisher' as PrivilegeRole, requiresQualification: true, count: 1, weekId: '2026-10-05', excludeIds: [], now };

describe('suggestAssignees', () => {
  it('only suggests active, qualified people', () => {
    const people = [
      makeUser('a', 'Ann', { qualifications: q }),
      makeUser('b', 'Ben', { qualifications: q, active: false }),
      makeUser('c', 'Cy'),
    ];
    const r = suggestAssignees({ ...base, people, recent: [], count: 3 });
    expect(r.picks.map(p => p.id)).toEqual(['a']);
    expect(r.notes.join(' ')).toContain('Only 1 qualified person is available');
  });

  it('prefers the person who did it longest ago, and people who never did it', () => {
    const people = [makeUser('a', 'Ann', { qualifications: q }), makeUser('b', 'Ben', { qualifications: q }), makeUser('c', 'Cy', { qualifications: q })];
    const recent = [
      { typeId: T, weekId: 'w1', assigneeIds: ['a'], startAt: combineDateTime('2026-09-23', '19:00'), status: 'scheduled' as const },
      { typeId: T, weekId: 'w0', assigneeIds: ['b'], startAt: combineDateTime('2026-08-01', '19:00'), status: 'scheduled' as const },
    ];
    expect(suggestAssignees({ ...base, people, recent, count: 3 }).picks.map(p => p.id)).toEqual(['c', 'b', 'a']);
  });

  it('avoids people who already have an assignment that week', () => {
    const people = [makeUser('a', 'Ann', { qualifications: q }), makeUser('b', 'Ben', { qualifications: q })];
    const recent = [{ typeId: 'other', weekId: '2026-10-05', assigneeIds: ['a'], startAt: combineDateTime('2026-10-05', '19:00'), status: 'scheduled' as const }];
    expect(suggestAssignees({ ...base, people, recent }).picks.map(p => p.id)).toEqual(['b']);
  });

  it('ignores cancelled assignments', () => {
    const people = [makeUser('a', 'Ann', { qualifications: q }), makeUser('b', 'Ben', { qualifications: q })];
    const recent = [{ typeId: T, weekId: '2026-09-28', assigneeIds: ['b'], startAt: combineDateTime('2026-09-30', '19:00'), status: 'cancelled' as const }];
    // Ben's only history is cancelled, so it is a tie -> alphabetical
    expect(suggestAssignees({ ...base, people, recent }).picks.map(p => p.id)).toEqual(['a']);
  });

  it('is deterministic and respects exclusions', () => {
    const people = [makeUser('b', 'Ben', { qualifications: q }), makeUser('a', 'Ann', { qualifications: q })];
    const one = suggestAssignees({ ...base, people, recent: [], count: 2 }).picks.map(p => p.id);
    const two = suggestAssignees({ ...base, people: [...people].reverse(), recent: [], count: 2 }).picks.map(p => p.id);
    expect(one).toEqual(['a', 'b']);
    expect(two).toEqual(one);
    expect(suggestAssignees({ ...base, people, recent: [], excludeIds: ['a'] }).picks.map(p => p.id)).toEqual(['b']);
  });

  it('never silently suggests unqualified people', () => {
    const r = suggestAssignees({ ...base, people: [makeUser('c', 'Cy')], recent: [] });
    expect(r.picks).toEqual([]);
    expect(r.notes.join(' ')).toContain('qualified');
  });

  it('asks for a type when a qualification is required but no type is chosen', () => {
    const r = suggestAssignees({ ...base, typeId: undefined, requiredRole: undefined, people: [makeUser('a', 'Ann')], recent: [] });
    expect(r.picks).toEqual([]);
  });

  it('works without qualification requirement', () => {
    const r = suggestAssignees({ ...base, typeId: undefined, requiredRole: undefined, requiresQualification: false, people: [makeUser('a', 'Ann')], recent: [] });
    expect(r.picks.map(p => p.id)).toEqual(['a']);
  });
});
