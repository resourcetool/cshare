export type Role = 'admin' | 'user';
export type ResponseStatus = 'seen' | 'cannot_do';
export type AssignmentStatus = 'scheduled' | 'cancelled';

/** What one person sees for one assignment. */
export type DisplayStatus = 'scheduled' | 'seen' | 'cannot_do' | 'cancelled';

/**
 * The ONLY congregation qualifications CSHARE tracks.
 */
export type PrivilegeRole =
  | 'publisher'
  | 'baptized_publisher'
  | 'ministerial_servant'
  | 'elder';

/**
 * How a person reports their field service each month.
 */
export type ReportingType =
  | 'publisher'
  | 'baptized_publisher'
  | 'auxiliary_pioneer'
  | 'regular_pioneer';

export interface NotificationPreferences {
  reminders: boolean;
  callStyle: boolean;
}

/** A family member with no phone / no account of their own. */
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

  /**
   * True when an administrator has designated this person
   * as the congregation secretary.
   *
   * This is separate from the admin role.
   */
  isSecretary: boolean;

  qualifications: PrivilegeRole[];

  /** How this person reports field service each month. */
  reportingType: ReportingType;

  /** Which ministry group this person belongs to, if any. */
  groupId?: string;

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
  requiredRole?: PrivilegeRole;
  icon?: string;
  meeting?: Meeting;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  startTime: string;
  endTime?: string;
  startAt: Date;
  assigneeIds: string[];
  assigneeNames: Record<string, string>;
  childAssignees: string[];
  requiresQualification: boolean;
  status: AssignmentStatus;
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

export type Meeting = 'midweek' | 'weekend';

export interface ProgramRow {
  id: string;
  typeId?: string;
  requiredRole?: PrivilegeRole;
  kind: RowKind;
  section: string;
  label: string;
  title: string;
  icon: string;
  minutes: number;
  numbered: boolean;
  requiresQualification: boolean;
  multiple: boolean;
  people: number;
  assigneeIds: string[];
  assigneeNames: Record<string, string>;
  childAssignees: string[];
  number?: string;
  startTime?: string;
  endTime?: string;
}

export interface MeetingSheet {
  title: string;
  date: string;
  startTime: string;
  program: ProgramRow[];
}

export interface Week {
  id: string;
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
  kind: RowKind;
  minutes: number;
  people: number;
  numbered: boolean;
  icon: string;
  meeting: Meeting;
  requiredRole?: PrivilegeRole;
}

export interface AppSettings {
  categories: string[];
  reminderOffsetsMinutes: number[];
  callStyleEnabled: boolean;
  meetingDay: number;
  meetingTime: string;
  minutesFormat: string;
  weekendDay: number;
  weekendTime: string;
  midweekName: string;
  weekendName: string;
  regularPioneerHours: number;
  auxiliaryPioneerHours: number;
}

export type PeopleFilter =
  | 'everyone'
  | 'admins'
  | 'waiting'
  | 'inactive';

// ------------------------------------------------------------------ monthly field service reports

export interface MonthlyReport {
  id: string;
  uid: string;
  monthKey: string;
  reportingType: ReportingType;
  groupId?: string;
  reporterName?: string;
  participated?: boolean;
  hours?: number;
  bibleStudies?: number;
  createdBy: string;
  submittedAt?: Date;
  updatedAt?: Date;
}

export type MonthlyReportInput = Pick<
  MonthlyReport,
  'reportingType' | 'participated' | 'hours' | 'bibleStudies'
>;

// ------------------------------------------------------------------ ministry groups

export interface MinistryGroup {
  id: string;
  name: string;
  overseerId?: string;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}