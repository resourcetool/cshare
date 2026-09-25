import { AppSettings, MonthlyReportInput, ReportingType } from '../types';
import { lastDayOfMonth } from './dates';

export const REPORTING_TYPES: ReportingType[] = ['publisher', 'baptized_publisher', 'auxiliary_pioneer', 'regular_pioneer'];

export const REPORTING_TYPE_LABELS: Record<ReportingType, string> = {
  publisher: 'Publisher',
  baptized_publisher: 'Baptized Publisher',
  auxiliary_pioneer: 'Auxiliary Pioneer',
  regular_pioneer: 'Regular Pioneer',
};

/** Auxiliary and Regular Pioneers report hours (and Bible studies); everyone else just reports
 * whether they shared in the ministry that month. */
export function reportsHours(type: ReportingType): boolean {
  return type === 'auxiliary_pioneer' || type === 'regular_pioneer';
}

/** The hour reference for this reporting type, or undefined if it doesn't use one. This is a
 * minimum to aim for, never a cap — entering more is always allowed. */
export function hourReferenceFor(type: ReportingType, settings: Pick<AppSettings, 'regularPioneerHours' | 'auxiliaryPioneerHours'>): number | undefined {
  if (type === 'regular_pioneer') return settings.regularPioneerHours;
  if (type === 'auxiliary_pioneer') return settings.auxiliaryPioneerHours;
  return undefined;
}

/** True once the form has what it needs to submit, for this reporting type. */
export function reportIsComplete(type: ReportingType, draft: Partial<MonthlyReportInput>): boolean {
  if (reportsHours(type)) return typeof draft.hours === 'number' && draft.hours >= 0;
  return typeof draft.participated === 'boolean';
}

/** A short line summarising an already-submitted report, for the "view your report" screen. */
export function summarizeReport(type: ReportingType, r: Partial<MonthlyReportInput>): string {
  if (reportsHours(type)) {
    const studies = r.bibleStudies ? `, ${r.bibleStudies} Bible ${r.bibleStudies === 1 ? 'study' : 'studies'}` : '';
    return `${r.hours ?? 0} hour${r.hours === 1 ? '' : 's'}${studies}`;
  }
  return r.participated ? 'Had a part in the ministry' : 'Did not have a part in the ministry';
}

/**
 * When the "time to send a report" reminder should ring this month: a heads-up a few days
 * before month end, and once more on the last day itself, both loud — the same as being handed
 * an assignment. Both are skipped once the report has actually been submitted.
 */
export function reportReminderDates(monthKey: string, now: Date): Date[] {
  const last = lastDayOfMonth(monthKey);
  const headsUp = new Date(last.getFullYear(), last.getMonth(), Math.max(1, last.getDate() - 4), 9, 0, 0);
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 18, 0, 0);
  return [headsUp, lastDay].filter(d => d.getTime() > now.getTime());
}
