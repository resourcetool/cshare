import { Assignment, UserProfile } from '../src/types';
import { combineDateTime } from '../src/utils/dates';

export function makeAssignment(over: Partial<Assignment> = {}): Assignment {
  const date = over.date ?? '2026-10-07';
  const startTime = over.startTime ?? '19:00';
  return {
    id: 'a1',
    weekId: '2026-10-05',
    title: 'Bible Reading',
    description: '',
    category: 'Teaching',
    location: '',
    date,
    startTime,
    startAt: combineDateTime(date, startTime),
    assigneeIds: ['u1'],
    assigneeNames: { u1: 'John' },
    childAssignees: [],
    requiresQualification: true,
    status: 'scheduled',
    responses: {},
    reminderOffsetsMinutes: [4320, 1440, 120],
    sortOrder: 40,
    createdBy: 'admin',
    updatedBy: 'admin',
    ...over,
  };
}

export function makeUser(id: string, name: string, over: Partial<UserProfile> = {}): UserProfile {
  return {
    id,
    name,
    email: `${id}@example.com`,
    phone: '+15550100',
    role: 'user',
    active: true,
    qualifications: [],
    reportingType: 'publisher',
    dependents: [],
    notificationPreferences: { reminders: true, callStyle: true },
    fcmTokens: [],
    ...over,
  };
}
