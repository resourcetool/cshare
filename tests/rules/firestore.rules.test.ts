/**
 * Security-rule tests. Run with:  npm run test:rules   (needs the Firebase CLI + Java;
 * it starts the Firestore emulator for you).
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, collection, getDocs, query, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

const profile = (over: Record<string, unknown> = {}) => ({
  name: 'Person', email: 'p@example.com', phone: '+1555', role: 'user', active: true,
  qualifications: [], reportingType: 'publisher', dependents: [],
  notificationPreferences: { reminders: true, callStyle: true }, fcmTokens: [], ...over,
});

const assignment = (over: Record<string, unknown> = {}) => ({
  title: 'Bible Reading', weekId: '2026-10-05', date: '2026-10-07', startTime: '19:00',
  assigneeIds: ['user1'], assigneeNames: { user1: 'One' }, childAssignees: [],
  status: 'scheduled', responses: {}, requiresQualification: false, reminderOffsetsMinutes: [],
  sortOrder: 10, startAt: Timestamp.now(), ...over,
});

const report = (over: Record<string, unknown> = {}) => ({
  uid: 'user1', monthKey: '2026-10', reportingType: 'regular_pioneer', hours: 55, bibleStudies: 2,
  groupId: 'g1', reporterName: 'One', createdBy: 'user1', submittedAt: Timestamp.now(), ...over,
});

const group = (over: Record<string, unknown> = {}) => ({
  name: 'Group 1', sortOrder: 10, ...over,
});

const as = (uid: string | null, email?: string) =>
  (uid ? env.authenticatedContext(uid, { email: email ?? `${uid}@example.com` }) : env.unauthenticatedContext()).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cshare',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin1'), profile({ name: 'Admin One', role: 'admin', email: 'admin1@example.com' }));
    await setDoc(doc(db, 'users/admin2'), profile({ name: 'Admin Two', role: 'admin', email: 'admin2@example.com' }));
    await setDoc(doc(db, 'users/user1'), profile({ name: 'One', email: 'user1@example.com' }));
    await setDoc(doc(db, 'users/user2'), profile({ name: 'Two', email: 'user2@example.com', groupId: 'g1' }));
    await setDoc(doc(db, 'users/waiting'), profile({ name: 'Waiting', active: false, email: 'waiting@example.com' }));
    await setDoc(doc(db, 'assignments/a1'), assignment());
    await setDoc(doc(db, 'settings/app'), { categories: ['Opening'] });
    await setDoc(doc(db, 'reports/user1_2026-10'), report());
    await setDoc(doc(db, 'groups/g1'), group({ overseerId: 'user1' }));
    await setDoc(doc(db, 'reports/user2_2026-10'), report({ uid: 'user2', reporterName: 'Two', createdBy: 'user2' }));
  });
});

describe('sign-up', () => {
  const base = { name: 'New', email: 'newbie@example.com', phone: '+1', role: 'user', active: false, qualifications: [], reportingType: 'publisher', dependents: [], notificationPreferences: { reminders: true, callStyle: true }, fcmTokens: [] };

  it('lets a new person create their own INACTIVE user profile', async () => {
    await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), base));
  });
  it('does NOT let them make themselves admin or active', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), { ...base, role: 'admin', active: false }));
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), { ...base, role: 'user', active: true }));
  });
  it('does NOT let them give themselves a qualification, a reporting type other than publisher, or a dependent', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), { ...base, qualifications: ['elder'] }));
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), { ...base, reportingType: 'regular_pioneer' }));
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), { ...base, dependents: [{ id: 'd1', name: 'Kid' }] }));
  });
  it('does not allow creating a profile for someone else', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/other'), base));
  });
});

describe('users collection', () => {
  it('a user cannot change their own role, active flag, qualifications, reporting type, group or dependents', async () => {
    const db = as('user1');
    await assertFails(updateDoc(doc(db, 'users/user1'), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { active: false }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { qualifications: ['ministerial_servant'] }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { reportingType: 'regular_pioneer' }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { groupId: 'g1' }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { dependents: [{ id: 'd1', name: 'Kid' }] }));
  });
  it('a user can change their own name, phone and notification choices', async () => {
    const db = as('user1');
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { name: 'Renamed', phone: '+1999' }));
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { notificationPreferences: { reminders: false, callStyle: false } }));
  });
  it('a user cannot edit or read other people', async () => {
    const db = as('user1');
    await assertFails(updateDoc(doc(db, 'users/user2'), { name: 'Hacked' }));
    await assertFails(getDoc(doc(db, 'users/user2')));
  });
  it('an active user CAN read administrator contact details', async () => {
    const db = as('user1');
    await assertSucceeds(getDoc(doc(db, 'users/admin1')));
    await assertSucceeds(getDocs(query(collection(db, 'users'), where('role', '==', 'admin'), where('active', '==', true))));
  });
  it('administrators manage users, including reporting type and group', async () => {
    const db = as('admin1');
    await assertSucceeds(updateDoc(doc(db, 'users/waiting'), { active: true, approvedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { role: 'admin' }));
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { qualifications: ['baptized_publisher'] }));
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { reportingType: 'auxiliary_pioneer' }));
    await assertSucceeds(updateDoc(doc(db, 'users/user1'), { groupId: 'g1' }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { reportingType: 'not-a-type' }));
    await assertFails(updateDoc(doc(db, 'users/user1'), { email: 'changed@example.com' }));
    await assertFails(deleteDoc(doc(db, 'users/user1')));
  });
  it('an administrator cannot remove their own admin access', async () => {
    await assertFails(updateDoc(doc(as('admin1'), 'users/admin1'), { role: 'user' }));
    await assertFails(updateDoc(doc(as('admin1'), 'users/admin1'), { active: false }));
  });
});

describe('assignments', () => {
  it('signed-out and inactive people cannot read anything', async () => {
    await assertFails(getDoc(doc(as(null), 'assignments/a1')));
    await assertFails(getDoc(doc(as('waiting'), 'assignments/a1')));
    await assertFails(getDoc(doc(as('waiting'), 'settings/app')));
  });
  it('a person reads only their own assignments', async () => {
    await assertSucceeds(getDoc(doc(as('user1'), 'assignments/a1')));
    await assertFails(getDoc(doc(as('user2'), 'assignments/a1')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'assignments/a1')));
  });
  it('a person can record that they SAW their assignment, or that they CAN\'T do it', async () => {
    const db = as('user1');
    await assertSucceeds(updateDoc(doc(db, 'assignments/a1'), { 'responses.user1': { status: 'seen', at: Timestamp.now() } }));
    await assertSucceeds(updateDoc(doc(db, 'assignments/a1'), { 'responses.user1': { status: 'cannot_do', at: Timestamp.now(), reason: 'Travelling', adminId: 'admin1' } }));
  });
  it('a person cannot answer for someone else, use odd values, or change the assignment', async () => {
    const db = as('user1');
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { 'responses.user2': { status: 'seen', at: Timestamp.now() } }));
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { 'responses.user1': { status: 'approved', at: Timestamp.now() } }));
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { 'responses.user1': { status: 'seen', at: Timestamp.now(), extra: 1 } }));
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { title: 'Something else' }));
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { assigneeIds: ['user1', 'user2'] }));
    await assertFails(updateDoc(doc(db, 'assignments/a1'), { status: 'cancelled' }));
  });
  it('someone who is not assigned cannot respond', async () => {
    await assertFails(updateDoc(doc(as('user2'), 'assignments/a1'), { 'responses.user2': { status: 'seen', at: Timestamp.now() } }));
  });
  it('users cannot create or delete assignments; administrators can do everything', async () => {
    await assertFails(setDoc(doc(as('user1'), 'assignments/new'), assignment()));
    await assertFails(deleteDoc(doc(as('user1'), 'assignments/a1')));
    const admin = as('admin1');
    await assertSucceeds(setDoc(doc(admin, 'assignments/new'), assignment({ assigneeIds: ['user2'] })));
    await assertSucceeds(updateDoc(doc(admin, 'assignments/a1'), { title: 'Edited' }));
    await assertSucceeds(deleteDoc(doc(admin, 'assignments/a1')));
  });
  it('rejects a malformed assignment even from an administrator', async () => {
    const admin = as('admin1');
    await assertFails(setDoc(doc(admin, 'assignments/bad1'), assignment({ date: 'not-a-date' })));
    await assertFails(setDoc(doc(admin, 'assignments/bad2'), assignment({ startTime: '7pm' })));
    await assertFails(setDoc(doc(admin, 'assignments/bad3'), assignment({ status: 'done' })));
  });
});

describe('shared reference data', () => {
  it('everyone active can read settings, weeks and types; only administrators can write them', async () => {
    await assertSucceeds(getDoc(doc(as('user1'), 'settings/app')));
    await assertFails(setDoc(doc(as('user1'), 'settings/app'), { categories: [] }));
    await assertFails(setDoc(doc(as('user1'), 'weeks/2026-10-05'), { title: 'x' }));
    await assertFails(setDoc(doc(as('user1'), 'assignmentTypes/t1'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(as('admin1'), 'weeks/2026-10-05'), { title: 'x' }));
    await assertSucceeds(setDoc(doc(as('admin1'), 'assignmentTypes/t1'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(as('admin1'), 'settings/app'), { categories: ['A'] }));
  });
});

describe('monthly reports', () => {
  it('a person reads only their own report', async () => {
    await assertSucceeds(getDoc(doc(as('user1'), 'reports/user1_2026-10')));
    await assertFails(getDoc(doc(as('user2'), 'reports/user1_2026-10')));
    await assertSucceeds(getDoc(doc(as('admin1'), 'reports/user1_2026-10')));
  });
  it('a group overseer can query reports for their group, but another user cannot', async () => {
    const overseerDb = as('user1');
    const memberDb = as('user2');
    const groupQuery = query(collection(overseerDb, 'reports'), where('groupId', '==', 'g1'));
    await assertSucceeds(getDocs(groupQuery));
    const unauthorizedQuery = query(collection(memberDb, 'reports'), where('groupId', '==', 'g1'));
    await assertFails(getDocs(unauthorizedQuery));
  });
  it('a person can submit their own report for a month with no report yet', async () => {
    await assertSucceeds(setDoc(doc(as('user2'), 'reports/user2_2026-11'), report({ uid: 'user2', monthKey: '2026-11', createdBy: 'user2' })));
  });
  it('cannot submit a second report for a month already reported — even with different numbers', async () => {
    await assertFails(setDoc(doc(as('user1'), 'reports/user1_2026-10'), report({ hours: 99 })));
  });
  it('cannot submit a report under someone else\'s uid, or with a mismatched document id', async () => {
    await assertFails(setDoc(doc(as('user2'), 'reports/user1_2026-11'), report({ uid: 'user1', monthKey: '2026-11', createdBy: 'user2' })));
    await assertFails(setDoc(doc(as('user2'), 'reports/user2_2026-11'), report({ uid: 'user2', monthKey: '2026-12', createdBy: 'user2' })));
  });
  it('rejects a report with an out-of-range or wrong-shaped value', async () => {
    await assertFails(setDoc(doc(as('user2'), 'reports/user2_2026-11'), report({ uid: 'user2', monthKey: '2026-11', createdBy: 'user2', hours: -5 })));
    await assertFails(setDoc(doc(as('user2'), 'reports/user2_2026-11'), report({ uid: 'user2', monthKey: '2026-11', createdBy: 'user2', reportingType: 'not-a-type' })));
    await assertFails(setDoc(doc(as('user2'), 'reports/user2_2026-11'), report({ uid: 'user2', monthKey: 'October', createdBy: 'user2' })));
  });
  it('only an administrator can correct an already-submitted report', async () => {
    await assertFails(updateDoc(doc(as('user1'), 'reports/user1_2026-10'), { hours: 60 }));
    await assertSucceeds(updateDoc(doc(as('admin1'), 'reports/user1_2026-10'), { hours: 60 }));
  });
  it('nobody can delete a report', async () => {
    await assertFails(deleteDoc(doc(as('user1'), 'reports/user1_2026-10')));
    await assertFails(deleteDoc(doc(as('admin1'), 'reports/user1_2026-10')));
  });
});

describe('ministry groups', () => {
  it('any active person can read groups; only administrators can write them', async () => {
    await assertSucceeds(getDoc(doc(as('user1'), 'groups/g1')));
    await assertFails(setDoc(doc(as('user1'), 'groups/g2'), group()));
    await assertFails(updateDoc(doc(as('user1'), 'groups/g1'), { name: 'Hacked' }));
    await assertSucceeds(setDoc(doc(as('admin1'), 'groups/g2'), group({ name: 'Group 2', sortOrder: 20 })));
    await assertSucceeds(updateDoc(doc(as('admin1'), 'groups/g1'), { overseerId: 'user1' }));
    await assertSucceeds(deleteDoc(doc(as('admin1'), 'groups/g2')));
  });
  it('rejects a group with no name', async () => {
    await assertFails(setDoc(doc(as('admin1'), 'groups/g3'), group({ name: '' })));
  });
});
