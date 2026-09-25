import {
  combineDateTime, daysBetween, dateInWeek, formatTime, formatWeekRange, formatDayLong,
  isValidDateKey, isValidTime, shiftWeek, startOfWeek, toDateKey, weekIdFor,
} from '../src/utils/dates';

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 8, 18)))).toBe('2026-09-14'); // Friday
    expect(toDateKey(startOfWeek(new Date(2026, 8, 20)))).toBe('2026-09-14'); // Sunday
    expect(toDateKey(startOfWeek(new Date(2026, 8, 21)))).toBe('2026-09-21'); // Monday
  });
  it('weekIdFor accepts date keys', () => {
    expect(weekIdFor('2026-10-07')).toBe('2026-10-05');
  });
  it('shifts weeks across month and year ends', () => {
    expect(shiftWeek('2026-09-28', 1)).toBe('2026-10-05');
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04');
    expect(shiftWeek('2026-10-05', -1)).toBe('2026-09-28');
  });
  it('finds a weekday inside a week', () => {
    expect(dateInWeek('2026-10-05', 3)).toBe('2026-10-07'); // Wednesday
    expect(dateInWeek('2026-10-05', 0)).toBe('2026-10-11'); // Sunday
  });
  it('formats ranges', () => {
    expect(formatWeekRange('2026-10-05')).toBe('5–11 October 2026');
    expect(formatWeekRange('2026-09-28')).toBe('28 Sep – 4 Oct 2026');
    expect(formatWeekRange('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
  it('formats times and days', () => {
    expect(formatTime('19:00')).toBe('7:00 PM');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatDayLong('2026-10-07')).toBe('Wednesday 7 October');
  });
  it('validates input', () => {
    expect(isValidTime('19:00')).toBe(true);
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-10-07')).toBe(true);
  });
  it('counts calendar days', () => {
    expect(daysBetween(combineDateTime('2026-10-06', '23:59'), combineDateTime('2026-10-07', '00:01'))).toBe(1);
    expect(daysBetween(combineDateTime('2026-10-07', '10:00'), combineDateTime('2026-10-04', '10:00'))).toBe(-3);
  });
});
