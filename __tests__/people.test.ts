import { filterPeople, isTurnedOff, isWaiting } from '../src/utils/people';
import { makeUser } from './helpers';

describe('people filters', () => {
  const list = [
    makeUser('a', 'Ann', { role: 'admin' }),
    makeUser('b', 'Ben'),
    makeUser('c', 'Cy', { active: false }),
    makeUser('d', 'Di', { active: false, approvedAt: new Date() }),
  ];
  it('tells new sign-ups from people who were turned off', () => {
    expect(isWaiting(list[2])).toBe(true);
    expect(isTurnedOff(list[2])).toBe(false);
    expect(isTurnedOff(list[3])).toBe(true);
  });
  it('filters and searches', () => {
    expect(filterPeople(list, 'admins', '').map(u => u.id)).toEqual(['a']);
    expect(filterPeople(list, 'waiting', '').map(u => u.id)).toEqual(['c']);
    expect(filterPeople(list, 'inactive', '').map(u => u.id)).toEqual(['d']);
    expect(filterPeople(list, 'everyone', 'be').map(u => u.id)).toEqual(['b']);
    expect(filterPeople(list, 'everyone', '').length).toBe(4);
  });
});
