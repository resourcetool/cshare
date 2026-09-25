import { Assignment, PeopleFilter, UserProfile } from '../types';

/** New sign-ups that an administrator has not approved yet. */
export const isWaiting = (u: UserProfile): boolean => !u.active && !u.approvedAt;
/** Approved once, later turned off. */
export const isTurnedOff = (u: UserProfile): boolean => !u.active && !!u.approvedAt;

export function filterPeople(list: UserProfile[], filter: PeopleFilter, query: string): UserProfile[] {
  const q = query.trim().toLowerCase();
  return list.filter(u => {
    if (q && !u.name.toLowerCase().includes(q) && !u.phone.includes(q)) return false;
    switch (filter) {
      case 'admins':
        return u.role === 'admin' && u.active;
      case 'waiting':
        return isWaiting(u);
      case 'inactive':
        return isTurnedOff(u);
      default:
        return true;
    }
  });
}

// ------------------------------------------------------------------ children / dependents
//
// A child with no phone of their own is never given their own account. Instead the
// administrator picks the child from the parent's list of dependents when assigning: the
// assignment's assigneeId stays the PARENT'S real uid (so reminders, the call-style alarm and
// the phone calendar all reach the parent automatically, and every Firestore rule / query
// keeps working unchanged) but the displayed name is the child's, and the id is also listed in
// `childAssignees` so the app can show "for your child, <name>" instead of "for you".

/** True if this assigneeId's entry in the assignment is standing in for that account's child. */
export function isChildEntry(a: Pick<Assignment, 'childAssignees'>, id: string): boolean {
  return (a.childAssignees ?? []).includes(id);
}
