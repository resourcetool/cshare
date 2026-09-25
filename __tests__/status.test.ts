import { attentionItems, nextAssignment, statusFor, statusLabel, upcomingFor } from '../src/utils/status';
import { groupByCategory } from '../src/utils/sheet';
import { friendlyError } from '../src/utils/errors';
import { cleanPhone, firstName, joinNames } from '../src/utils/text';
import { combineDateTime } from '../src/utils/dates';
import { makeAssignment } from './helpers';

const now = combineDateTime('2026-10-01', '09:00');

describe('status', () => {
  it('derives a per-person status', () => {
    expect(statusFor(makeAssignment(), 'u1')).toBe('scheduled');
    expect(statusFor(makeAssignment({ responses: { u1: { status: 'seen', at: now } } }), 'u1')).toBe('seen');
    expect(statusFor(makeAssignment({ responses: { u1: { status: 'seen', at: now } }, status: 'cancelled' }), 'u1')).toBe('cancelled');
    expect(statusLabel('scheduled', 'admin')).toBe('Not seen yet');
    expect(statusLabel('scheduled', 'user')).toBe('Scheduled');
  });

  it('lists "can\'t do" requests but not for cancelled assignments', () => {
    const a = makeAssignment({ responses: { u1: { status: 'cannot_do', at: now, reason: 'Travelling' } } });
    const c = makeAssignment({ id: 'a2', status: 'cancelled', responses: { u1: { status: 'cannot_do', at: now } } });
    const items = attentionItems([a, c]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'John', reason: 'Travelling' });
  });

  it('finds the next assignment, skipping past, cancelled and cannot-do ones', () => {
    const past = makeAssignment({ id: 'past', date: '2026-09-20' });
    const cancelled = makeAssignment({ id: 'c', date: '2026-10-02', status: 'cancelled' });
    const cant = makeAssignment({ id: 'x', date: '2026-10-03', responses: { u1: { status: 'cannot_do', at: now } } });
    const good = makeAssignment({ id: 'g', date: '2026-10-07' });
    expect(nextAssignment([past, cancelled, cant, good], 'u1', now)?.id).toBe('g');
    expect(upcomingFor([good, past, cancelled], now).map(a => a.id)).toEqual(['c', 'g']);
    expect(nextAssignment([past], 'u1', now)).toBeUndefined();
  });
});

describe('sheet', () => {
  it('groups by configured category order', () => {
    const list = [
      makeAssignment({ id: '1', category: 'Living', sortOrder: 70 }),
      makeAssignment({ id: '2', category: 'Opening', sortOrder: 10 }),
      makeAssignment({ id: '3', category: 'Teaching', sortOrder: 40 }),
      makeAssignment({ id: '4', category: 'Teaching', sortOrder: 30 }),
      makeAssignment({ id: '5', category: 'Mystery', sortOrder: 1 }),
    ];
    const sections = groupByCategory(list, ['Opening', 'Teaching', 'Living']);
    expect(sections.map(s => s.category)).toEqual(['Opening', 'Teaching', 'Living', 'Mystery']);
    expect(sections[1].items.map(a => a.id)).toEqual(['4', '3']);
  });
});

describe('text and errors', () => {
  it('cleans phone numbers', () => {
    expect(cleanPhone(' +1 (555) 010-0100 ')).toBe('+15550100100');
    expect(cleanPhone('0771 234 567')).toBe('0771234567');
  });
  it('names', () => {
    expect(firstName('  Mary Jane Watson')).toBe('Mary');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
    expect(joinNames(['A'])).toBe('A');
  });
  it('never shows raw Firebase codes', () => {
    expect(friendlyError({ code: 'auth/network-request-failed' })).toContain('internet');
    expect(friendlyError({ code: 'firestore/unavailable' })).toContain('synchronized');
    expect(friendlyError({ code: 'auth/wrong-password' })).toContain('email or password');
    expect(friendlyError(new Error('FirebaseException code 7'))).not.toContain('FirebaseException');
    expect(friendlyError(undefined)).toBe('Something went wrong. Please try again.');
  });
});
