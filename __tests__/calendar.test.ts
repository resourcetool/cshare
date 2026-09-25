import { planCalendar, eventFor, CalendarMap } from '../src/utils/calendarPlan';
import { planReminders } from '../src/utils/reminders';
import { combineDateTime, formatDayWithYear } from '../src/utils/dates';
import { makeAssignment } from './helpers';

const now = combineDateTime('2026-10-01', '09:00');
const names = { midweek: 'Midweek Meeting', weekend: 'Weekend Meeting' };
const opts = { now, alerts: true, meetingNames: names };

describe('phone calendar plan', () => {
  it('adds a new assignment as an event with the reminders as calendar alerts', () => {
    const a = makeAssignment({ meeting: 'midweek', endTime: '19:10', location: 'Kingdom Hall' });
    const ops = planCalendar([a], 'u1', {}, opts);
    expect(ops).toHaveLength(1);
    const op = ops[0];
    if (op.type !== 'upsert') throw new Error('expected upsert');
    expect(op.eventId).toBe(0);
    expect(op.spec.title).toBe('CSHARE: Bible Reading');
    expect(op.spec.location).toBe('Kingdom Hall');
    expect(op.spec.alarms).toEqual([4320, 1440, 120]);
    expect(op.spec.endMs - op.spec.startMs).toBe(10 * 60000);
    expect(op.spec.description).toContain('Midweek Meeting');
  });

  it('can leave the alerts to CSHARE alone', () => {
    const spec = eventFor(makeAssignment(), { alerts: false });
    expect(spec.alarms).toEqual([]);
  });

  it('updates only what changed and does nothing when nothing changed', () => {
    const a = makeAssignment();
    const spec = eventFor(a, { alerts: true, meetingName: undefined });
    const map: CalendarMap = { a1: { eventId: 7, sig: spec.sig, startMs: spec.startMs } };
    expect(planCalendar([a], 'u1', map, opts)).toEqual([]);
    const moved = makeAssignment({ date: '2026-10-08' });
    const ops = planCalendar([moved], 'u1', map, opts);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'upsert', eventId: 7 });
  });

  it('removes upcoming events that no longer apply, keeps past ones as history', () => {
    const future = combineDateTime('2026-10-07', '19:00').getTime();
    const past = combineDateTime('2026-09-01', '19:00').getTime();
    const map: CalendarMap = { gone: { eventId: 1, sig: 'x', startMs: future }, old: { eventId: 2, sig: 'x', startMs: past } };
    const ops = planCalendar([], 'u1', map, opts);
    expect(ops).toContainEqual({ type: 'delete', assignmentId: 'gone', eventId: 1 });
    expect(ops).toContainEqual({ type: 'forget', assignmentId: 'old' });
  });

  it('removes events for cancelled assignments and for "can\'t do"', () => {
    const map: CalendarMap = { a1: { eventId: 5, sig: 'x', startMs: combineDateTime('2026-10-07', '19:00').getTime() } };
    expect(planCalendar([makeAssignment({ status: 'cancelled' })], 'u1', map, opts)[0]).toMatchObject({ type: 'delete', eventId: 5 });
    const cant = makeAssignment({ responses: { u1: { status: 'cannot_do', at: now } } });
    expect(planCalendar([cant], 'u1', map, opts)[0]).toMatchObject({ type: 'delete', eventId: 5 });
  });

  it('ignores assignments of other people and ones that are already over', () => {
    expect(planCalendar([makeAssignment({ assigneeIds: ['other'] })], 'u1', {}, opts)).toEqual([]);
    expect(planCalendar([makeAssignment({ date: '2026-09-01' })], 'u1', {}, opts)).toEqual([]);
  });
});

describe('planning far ahead', () => {
  it('sets reminders only inside a 60 day window, so a talk next year is picked up later', () => {
    const talk = makeAssignment({ date: '2027-03-10' });
    expect(planReminders(talk, 'u1', { now, callStyle: true })).toEqual([]);
    const oneWeekIn = combineDateTime('2027-01-08', '09:00'); // still 61+ days away: only the first reminder fits the window
    expect(planReminders(talk, 'u1', { now: oneWeekIn, callStyle: true })).toHaveLength(1);
    const soon = combineDateTime('2027-01-15', '09:00'); // within 2 months: all three reminders are scheduled
    expect(planReminders(talk, 'u1', { now: soon, callStyle: true })).toHaveLength(3);
  });

  it('shows the year when a date is not in the current year', () => {
    expect(formatDayWithYear('2026-12-30', now)).toBe('Wed 30 Dec');
    expect(formatDayWithYear('2027-01-06', now)).toBe('Wed 6 Jan 2027');
  });
});
