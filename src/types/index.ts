export type Role = 'admin' | 'user';
export type ResponseStatus = 'seen' | 'cannot_do';
export type AssignmentStatus = 'scheduled' | 'cancelled';
/** What one person sees for one assignment. */
export type DisplayStatus = 'scheduled' | 'seen' | 'cannot_do' | 'cancelled';

/**
 * The ONLY congregation qualifications CSHARE tracks. Every assignment type that needs a
 * qualification needs one of these (see AssignmentType.requiredRole).
 * A person can hold one or two at once: a "base" standing (publisher OR baptized_publisher)
 * plus, optionally, one appointed privilege (ministerial_servant OR elder).
 */
export type PrivilegeRole = 'publisher' | 'baptized_publisher' | 'ministerial_servant' | 'elder';

/**
 * How a person reports their field service each month. Independent of PrivilegeRole above —
 * a ministerial servant can be a "publisher" reporting-wise, an unbaptized publisher can be an
 * "auxiliary_pioneer", and so on. Set by an administrator, one per person.
 */
export type ReportingType = 'publisher' | 'baptized_publisher' | 'auxiliary_pioneer' | 'regular_pioneer';

export interface NotificationPreferences {
  reminders: boolean;
  callStyle: boolean;
}

/** A family member with no phone / no account of their own (e.g. a child). */
export interface Dependent {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  active: boolean;
  /** Only an administrator explicitly appointed as secretary may view all group reports. */
  secretary?: boolean;
  /** The privilege(s) this person holds: one or two of PrivilegeRole. Set by an administrator only. */
  qualifications: PrivilegeRole[];
  /** How this person reports field service each month. Set by an administrator only. */
  reportingType: ReportingType;
  /** Which ministry group this person belongs to, if any. Set by an administrator only. */
  groupId?: string;
  /** Children / family members with no phone of their own. Assignments for them are given under
   * this account: reminders, calls and the calendar all reach this person's phone instead. */
  dependents: Dependent[];
  notificationPreferences: NotificationPreferences;
  fcmTokens: string[];
  approvedAt?: Date;
  lastActiveAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssignmentResponse {
  status: ResponseStatus;
  at: Date;
  reason?: string;
  adminId?: string;
}

export interface Assignment {
  id: string;
  weekId: string;
  typeId?: string;
  /** the minimum privilege required to do this assignment, if any */
  requiredRole?: PrivilegeRole;
  icon?: string;
  meeting?: Meeting;
  title: string;
  description: string;
  category: string;
  location: string;
  /** YYYY-MM-DD (local) */
  date: string;
  /** HH:mm (24h, local) */
  startTime: string;
  endTime?: string;
  startAt: Date;
  assigneeIds: string[];
  /** uid -> name, so people can see who else is assigned without reading other profiles */
  assigneeNames: Record<string, string>;
  /** ids inside assigneeIds that are actually a CHILD of that account (no phone of their own):
   * assigneeNames holds the child's name, but reminders/calls/calendar still go to this adult. */
  childAssignees: string[];
  requiresQualification: boolean;
  status: AssignmentStatus;
  /** uid -> that person's response (seen / cannot_do) */
  responses: Record<string, AssignmentResponse>;
  reminderOffsetsMinutes: number[];
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AssignmentInput = Pick<
  Assignment,
  | 'typeId'
  | 'requiredRole'
  | 'icon'
  | 'meeting'
  | 'title'
  | 'description'
  | 'category'
  | 'location'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'assigneeIds'
  | 'assigneeNames'
  | 'childAssignees'
  | 'requiresQualification'
  | 'reminderOffsetsMinutes'
  | 'sortOrder'
>;

export type RowKind = 'part' | 'song' | 'note';
/** A week has two meetings, each with its own sheet. */
export type Meeting = 'midweek' | 'weekend';

/** One line of the weekly meeting sheet. */
export interface ProgramRow {
  /** stable inside a week: the assignment type id, or "x..." for a row added by hand */
  id: string;
  typeId?: string;
  /** the minimum privilege required for this part, if any */
  requiredRole?: PrivilegeRole;
  kind: RowKind;
  section: string;
  /** what the type is called, e.g. "Bible Akenkan" */
  label: string;
  /** what this week's part is called (editable) */
  title: string;
  icon: string;
  minutes: number;
  numbered: boolean;
  requiresQualification: boolean;
  /** several people can share this part */
  multiple: boolean;
  /** how many people it usually has */
  people: number;
  assigneeIds: string[];
  assigneeNames: Record<string, string>;
  /** ids inside assigneeIds that stand in for that account's child (no phone of their own) */
  childAssignees: string[];
  /** song number (songs only) */
  number?: string;
  /** filled in by scheduleRows */
  startTime?: string;
  endTime?: string;
}

/** The sheet of one meeting (midweek or weekend). */
export interface MeetingSheet {
  /** the reading / heading, e.g. "YEREMIA 36-37" */
  title: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  program: ProgramRow[];
}

export interface Week {
  id: string; // Monday's date, YYYY-MM-DD
  sheets: Partial<Record<Meeting, MeetingSheet>>;
  startDate: string;
  endDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssignmentType {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresQualification: boolean;
  allowsMultipleAssignees: boolean;
  active: boolean;
  sortOrder: number;
  /** part = has people, song = has a number, note = just a line (e.g. opening comments) */
  kind: RowKind;
  minutes: number;
  /** how many people the part usually has */
  people: number;
  /** shown with a number (1, 2, 3 ...) on the sheet */
  numbered: boolean;
  icon: string;
  /** which meeting's sheet this line belongs to */
  meeting: Meeting;
  /** the minimum privilege required for this part, if any (see PrivilegeRole) */
  requiredRole?: PrivilegeRole;
}

export interface AppSettings {
  categories: string[];
  reminderOffsetsMinutes: number[];
  callStyleEnabled: boolean;
  /** 0 = Sunday ... 6 = Saturday */
  meetingDay: number;
  meetingTime: string;
  /** how minutes are written on the sheet, {n} is the number: "{n} min", "Simma {n}" ... */
  minutesFormat: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekendDay: number;
  weekendTime: string;
  midweekName: string;
  weekendName: string;
  /** Hour references for the monthly report — entering more is always allowed, never a cap.
   * Kept configurable so a congregation-wide adjustment (e.g. a different auxiliary
   * arrangement for a given period) doesn't need a code change. */
  regularPioneerHours: number;
  auxiliaryPioneerHours: number;
}

export type PeopleFilter = 'everyone' | 'admins' | 'waiting' | 'inactive';

// ------------------------------------------------------------------ monthly field service reports

/** One person's report for one calendar month. Doc id is always `${uid}_${monthKey}`, which is
 * what stops an accidental duplicate report from ever existing for the same person/month. */
export interface MonthlyReport {
  id: string;
  uid: string;
  /** YYYY-MM */
  monthKey: string;
  /** captured at submission time, so later profile changes do not rewrite this report. */
  reportingType: ReportingType;
  /** Ministry group at the time the report was submitted. */
  groupId?: string;
  /** Member name captured at submission time for group reports. */
  reporterName?: string;
  /** Publisher / Baptized Publisher: did they share in the ministry this month? */
  participated?: boolean;
  /** Auxiliary Pioneer / Regular Pioneer only. Entering more than the reference hours is fine —
   * the reference is a minimum, never treated as a cap. */
  hours?: number;
  bibleStudies?: number;
  createdBy: string;
  submittedAt?: Date;
  updatedAt?: Date;
}

export type MonthlyReportInput = Pick<MonthlyReport, 'reportingType' | 'participated' | 'hours' | 'bibleStudies'>;

// ------------------------------------------------------------------ ministry groups

export interface MinistryGroup {
  id: string;
  name: string;
  /** uid of the group overseer, if assigned */
  overseerId?: string;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}