import { PrivilegeRole } from '../types';

/**
 * The only qualifications CSHARE tracks, lowest first. A higher privilege can always do
 * anything a lower one can (an elder can do a talk that only asks for "baptized publisher").
 */
export const ROLE_ORDER: PrivilegeRole[] = ['publisher', 'baptized_publisher', 'ministerial_servant', 'elder'];

export const ROLE_LABELS: Record<PrivilegeRole, string> = {
  publisher: 'Publisher',
  baptized_publisher: 'Baptized Publisher',
  ministerial_servant: 'Ministerial Servant',
  elder: 'Elder',
};

const rank = (r: PrivilegeRole): number => ROLE_ORDER.indexOf(r);

/** The single highest privilege this person holds, or undefined if they have none yet. */
export function highestRole(roles: PrivilegeRole[] | undefined): PrivilegeRole | undefined {
  if (!roles || roles.length === 0) return undefined;
  return roles.reduce((best, r) => (rank(r) > rank(best) ? r : best), roles[0]);
}

/** Does this person's highest privilege meet (or exceed) what the assignment needs? */
export function meetsRequiredRole(roles: PrivilegeRole[] | undefined, required: PrivilegeRole | undefined): boolean {
  if (!required) return true;
  const top = highestRole(roles);
  return !!top && rank(top) >= rank(required);
}

/** "Baptized Publisher, Elder" */
export function rolesLabel(roles: PrivilegeRole[] | undefined): string {
  if (!roles || roles.length === 0) return 'No qualifications set yet';
  return ROLE_ORDER.filter(r => roles.includes(r)).map(r => ROLE_LABELS[r]).join(', ');
}

/**
 * A person's roles always come out of two independent choices, so at most two apply at once:
 *  - base standing: "publisher" or "baptized_publisher" (or neither, if not set yet)
 *  - appointment (only possible once baptized): "ministerial_servant" or "elder" (or neither)
 */
export function splitRoles(roles: PrivilegeRole[] | undefined): { base?: 'publisher' | 'baptized_publisher'; appointment?: 'ministerial_servant' | 'elder' } {
  const list = roles ?? [];
  return {
    base: list.includes('baptized_publisher') ? 'baptized_publisher' : list.includes('publisher') ? 'publisher' : undefined,
    appointment: list.includes('elder') ? 'elder' : list.includes('ministerial_servant') ? 'ministerial_servant' : undefined,
  };
}

/** Builds the (at most two) roles from the two independent choices above. Always one or two. */
export function combineRoles(base: 'publisher' | 'baptized_publisher' | undefined, appointment: 'ministerial_servant' | 'elder' | undefined): PrivilegeRole[] {
  // An appointment always implies baptized standing, so it replaces "publisher" if that was picked.
  if (appointment) return ['baptized_publisher', appointment];
  return base ? [base] : [];
}
