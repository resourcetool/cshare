import { formatMonthLong, isValidMonthKey, lastDayOfMonth, monthKeyFor, parseMonthKey, previousMonthKey } from '../src/utils/dates';
import { hourReferenceFor, reportIsComplete, reportReminderDates, reportsHours, REPORTING_TYPE_LABELS, summarizeReport } from '../src/utils/reports';
import { DEFAULT_SETTINGS } from '../src/constants';

describe('month helpers', () => {
  it('builds and reads YYYY-MM keys', () => {
    expect(monthKeyFor(new Date(2026, 9, 15))).toBe('2026-10'); // October = month index 9
    expect(parseMonthKey('2026-10')).toEqual({ year: 2026, month: 9 });
  });

  it('validates keys', () => {
    expect(isValidMonthKey('2026-10')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-1')).toBe(false);
    expect(isValidMonthKey('not-a-month')).toBe(false);
  });

  it('formats a friendly month name', () => {
    expect(formatMonthLong('2026-10')).toBe('October 2026');
    expect(formatMonthLong('2027-01')).toBe('January 2027');
  });

  it('finds the previous month, including across a year boundary', () => {
    expect(previousMonthKey('2026-10')).toBe('2026-09');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });

  it('finds the last calendar day of the month', () => {
    expect(lastDayOfMonth('2026-02').getDate()).toBe(28); // 2026 is not a leap year
    expect(lastDayOfMonth('2024-02').getDate()).toBe(29); // 2024 is
    expect(lastDayOfMonth('2026-04').getDate()).toBe(30);
  });
});

describe('reporting type rules', () => {
  it('only pioneers report hours', () => {
    expect(reportsHours('publisher')).toBe(false);
    expect(reportsHours('baptized_publisher')).toBe(false);
    expect(reportsHours('auxiliary_pioneer')).toBe(true);
    expect(reportsHours('regular_pioneer')).toBe(true);
  });

  it('uses the congregation reference hours, per type', () => {
    expect(hourReferenceFor('regular_pioneer', DEFAULT_SETTINGS)).toBe(50);
    expect(hourReferenceFor('auxiliary_pioneer', DEFAULT_SETTINGS)).toBe(30);
    expect(hourReferenceFor('publisher', DEFAULT_SETTINGS)).toBeUndefined();
  });

  it('respects a congregation using a different auxiliary arrangement', () => {
    const custom = { ...DEFAULT_SETTINGS, auxiliaryPioneerHours: 15 };
    expect(hourReferenceFor('auxiliary_pioneer', custom)).toBe(15);
  });

  it('a report is only complete once it has what its type needs', () => {
    expect(reportIsComplete('publisher', {})).toBe(false);
    expect(reportIsComplete('publisher', { participated: false })).toBe(true); // "No" is still a complete answer
    expect(reportIsComplete('regular_pioneer', {})).toBe(false);
    expect(reportIsComplete('regular_pioneer', { hours: 0 })).toBe(true);
    expect(reportIsComplete('regular_pioneer', { hours: 65 })).toBe(true); // more than the reference is fine
  });

  it('every reporting type has a label', () => {
    expect(REPORTING_TYPE_LABELS.regular_pioneer).toBe('Regular Pioneer');
    expect(REPORTING_TYPE_LABELS.auxiliary_pioneer).toBe('Auxiliary Pioneer');
    expect(REPORTING_TYPE_LABELS.publisher).toBe('Publisher');
    expect(REPORTING_TYPE_LABELS.baptized_publisher).toBe('Baptized Publisher');
  });

  it('summarizes a submitted report', () => {
    expect(summarizeReport('publisher', { participated: true })).toBe('Had a part in the ministry');
    expect(summarizeReport('publisher', { participated: false })).toBe('Did not have a part in the ministry');
    expect(summarizeReport('regular_pioneer', { hours: 55, bibleStudies: 2 })).toBe('55 hours, 2 Bible studies');
    expect(summarizeReport('regular_pioneer', { hours: 1 })).toBe('1 hour');
  });
});

describe('report reminder timing', () => {
  it('offers a heads-up before month end and one on the last day, both still ahead of now', () => {
    const now = new Date(2026, 9, 1); // October 1st
    const dates = reportReminderDates('2026-10', now);
    expect(dates).toHaveLength(2);
    expect(dates[0].getTime()).toBeLessThan(dates[1].getTime());
    expect(dates.every(d => d.getTime() > now.getTime())).toBe(true);
    expect(dates[1].getDate()).toBe(lastDayOfMonth('2026-10').getDate());
  });

  it('drops reminder points that would already be in the past', () => {
    const now = new Date(2026, 9, 31, 12, 0); // the last day, at noon
    const dates = reportReminderDates('2026-10', now);
    expect(dates).toHaveLength(1); // only the evening-of-the-last-day one is still ahead
  });

  it('gives nothing once the month is already over', () => {
    const now = new Date(2026, 10, 2); // November 2nd
    expect(reportReminderDates('2026-10', now)).toEqual([]);
  });
});
