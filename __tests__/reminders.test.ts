import { normalizeOffsets, planReminders, whenPhrase, offsetLabel } from '../src/utils/reminders';
import { combineDateTime } from '../src/utils/dates';
import { makeAssignment } from './helpers';

const now = combineDateTime('2026-10-01', '09:00');

/** Every plan CSHARE produces must satisfy these, no matter how much notice there is. */
function expectSanePlan(plan: ReturnType<typeof planReminders>, now: Date, startAt: Date, callStyleAllowed: boolean) {
  expect(plan.length).toBeGreaterThan(0);
  for (const p of plan) {
    expect(p.fireAt.getTime()).toBeGreaterThan(now.getTime());
    expect(p.fireAt.getTime()).toBeLessThanOrEqual(startAt.getTime());
  }
  // strictly increasing fire times, and no duplicates
  for (let i = 1; i < plan.length; i++) expect(plan[i].fireAt.getTime()).toBeGreaterThan(plan[i - 1].fireAt.getTime());
  const last = plan[plan.length - 1];
  expect(last.isFinal).toBe(true);
  expect(last.fireAt.getTime()).toBe(startAt.getTime()); // the plan always ends with "starts now"
  expect(last.callStyle).toBe(callStyleAllowed);
  expect(plan.some(p => p.callStyle && p.fireAt.getTime() < startAt.getTime())).toBe(callStyleAllowed);
}

describe('Smart Reminder Engine', () => {
  it('plans a sane, future-only schedule that always ends with "starts now"', () => {
    const a = makeAssignment(); // Oct 7, 19:00 — about 6.5 days of notice from `now`
    const plan = planReminders(a, 'u1', { now, callStyle: true });
    expectSanePlan(plan, now, a.startAt, true);
  });

  it('respects the call-style switch even on the final reminder', () => {
    const plan = planReminders(makeAssignment(), 'u1', { now, callStyle: false });
    expect(plan.every(p => !p.callStyle)).toBe(true);
  });

  it('worked example: assigned with about a day of notice (spec #16)', () => {
    // "Monday 6:00 PM" now, assignment "Tuesday 6:30 PM"
    const start = combineDateTime('2026-10-06', '18:30'); // Tuesday
    const a = makeAssignment({ date: '2026-10-06', startTime: '18:30' });
    const monday6pm = combineDateTime('2026-10-05', '18:00');
    const plan = planReminders(a, 'u1', { now: monday6pm, callStyle: true });
    expectSanePlan(plan, monday6pm, start, true);
    // the impossible-by-then 3-day and 7-day marks must never appear
    expect(plan.some(p => p.fireAt.getTime() < monday6pm.getTime())).toBe(false);
    // assignment-day marks are present
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '12:30').getTime())).toBe(true); // 6h before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '17:30').getTime())).toBe(true); // 1h before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:10').getTime())).toBe(true); // 20m before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:20').getTime())).toBe(true); // 10m before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:28').getTime())).toBe(true); // 2m before
  });

  it('worked example: short-notice assignment still gets useful reminders (spec #17)', () => {
    // "Tuesday 5:45 PM" now, assignment "Tuesday 6:30 PM" — 45 minutes' notice
    const start = combineDateTime('2026-10-06', '18:30');
    const a = makeAssignment({ date: '2026-10-06', startTime: '18:30' });
    const soonNow = combineDateTime('2026-10-06', '17:45');
    const plan = planReminders(a, 'u1', { now: soonNow, callStyle: true });
    expectSanePlan(plan, soonNow, start, true);
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:10').getTime())).toBe(true); // 20m before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:20').getTime())).toBe(true); // 10m before
    expect(plan.some(p => p.fireAt.getTime() === combineDateTime('2026-10-06', '18:28').getTime())).toBe(true); // 2m before
  });

  it('never leaves someone with zero reminders, even with only a couple of minutes notice', () => {
    const start = combineDateTime('2026-10-06', '18:30');
    const a = makeAssignment({ date: '2026-10-06', startTime: '18:30' });
    const lastMinute = combineDateTime('2026-10-06', '18:28'); // 2 minutes' notice
    const plan = planReminders(a, 'u1', { now: lastMinute, callStyle: true });
    expectSanePlan(plan, lastMinute, start, true);
    expect(plan).toHaveLength(1); // just "starts now" — there is no room for anything else
  });


  it('gives daily awareness reminders for a six-day assignment, then increases near the start', () => {
    const start = combineDateTime('2026-10-07', '19:00');
    const sixDaysOut = combineDateTime('2026-10-01', '19:00');
    const a = makeAssignment({ date: '2026-10-07', startTime: '19:00' });
    const plan = planReminders(a, 'u1', { now: sixDaysOut, callStyle: true });

    const offsets = plan.map(p => Math.round((start.getTime() - p.fireAt.getTime()) / 60000));
    expect(offsets).toEqual([7200, 5760, 4320, 2880, 1440, 360, 60, 20, 10, 2, 0]);

    const callOffsets = plan.filter(p => p.callStyle).map(p => Math.round((start.getTime() - p.fireAt.getTime()) / 60000));
    expect(callOffsets).toEqual([1440, 60, 2, 0]);
  });

  it('uses the one-hour call-style reminder when there is less than one day of notice', () => {
    const start = combineDateTime('2026-10-06', '18:30');
    const a = makeAssignment({ date: '2026-10-06', startTime: '18:30' });
    const now18Hours = combineDateTime('2026-10-06', '00:30');
    const plan = planReminders(a, 'u1', { now: now18Hours, callStyle: true });
    const callOffsets = plan.filter(p => p.callStyle).map(p => Math.round((start.getTime() - p.fireAt.getTime()) / 60000));
    expect(callOffsets).toEqual([60, 2, 0]);
  });

  it('plans nothing for cancelled, other people, or "cannot do"', () => {
    expect(planReminders(makeAssignment({ status: 'cancelled' }), 'u1', { now, callStyle: true })).toEqual([]);
    expect(planReminders(makeAssignment(), 'someone-else', { now, callStyle: true })).toEqual([]);
    const cant = makeAssignment({ responses: { u1: { status: 'cannot_do', at: now } } });
    expect(planReminders(cant, 'u1', { now, callStyle: true })).toEqual([]);
  });

  it('still reminds people who have seen the assignment', () => {
    const seen = makeAssignment({ responses: { u1: { status: 'seen', at: now } } });
    expect(planReminders(seen, 'u1', { now, callStyle: true }).length).toBeGreaterThan(0);
  });

  it('gives no reminder once the assignment has already started', () => {
    const started = makeAssignment({ date: '2026-10-01', startTime: '08:00' });
    expect(planReminders(started, 'u1', { now: combineDateTime('2026-10-01', '09:00'), callStyle: true })).toEqual([]);
  });

  it('is idempotent: replanning the same assignment at the same moment gives identical ids, every time', () => {
    const a = planReminders(makeAssignment(), 'u1', { now, callStyle: true });
    const b = planReminders(makeAssignment(), 'u1', { now, callStyle: true });
    const c = planReminders(makeAssignment(), 'u1', { now, callStyle: true });
    expect(a.map(p => p.id)).toEqual(b.map(p => p.id));
    expect(a.map(p => p.id)).toEqual(c.map(p => p.id));
  });

  it('changes ids when the time or the wording changes, so devices reschedule instead of duplicating', () => {
    const a = planReminders(makeAssignment(), 'u1', { now, callStyle: true });
    const moved = planReminders(makeAssignment({ date: '2026-10-08', startTime: '19:00' }), 'u1', { now, callStyle: true });
    const renamed = planReminders(makeAssignment({ title: 'Student Talk' }), 'u1', { now, callStyle: true });
    expect(a[0].id).not.toBe(moved[0].id);
    expect(a[0].id).not.toBe(renamed[0].id);
  });

  it('writes friendly text', () => {
    const a = makeAssignment();
    expect(whenPhrase(a, combineDateTime('2026-10-06', '19:00'))).toBe('tomorrow at 7:00 PM');
    expect(whenPhrase(a, combineDateTime('2026-10-07', '17:00'))).toBe('today at 7:00 PM');
    expect(whenPhrase(a, combineDateTime('2026-10-04', '19:00'))).toBe('on Wednesday at 7:00 PM');
    expect(whenPhrase(a, combineDateTime('2026-09-28', '19:00'))).toBe('on Wed 7 Oct at 7:00 PM');
    expect(offsetLabel(1440)).toBe('1 day before');
    expect(offsetLabel(90)).toBe('90 minutes before');
  });

  it('normalizes legacy calendar-alert offsets: unique, positive, largest first, max 3', () => {
    expect(normalizeOffsets([120, 1440, 1440, -5, 0, 4320, 30])).toEqual([4320, 1440, 120]);
  });
});