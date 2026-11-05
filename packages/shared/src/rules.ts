import type { AppointmentStatus, AppRole, ListingStatus } from './constants';

export type TransitionActor = 'owner' | 'system';

/** Mirrors public.listing_transitions. A test keeps the two identical. */
export const LISTING_TRANSITIONS: ReadonlyArray<readonly [ListingStatus, ListingStatus, TransitionActor]> = [
  ['draft', 'pending_review', 'owner'],
  ['draft', 'archived', 'owner'],
  ['pending_review', 'draft', 'owner'],
  ['pending_review', 'archived', 'owner'],
  ['pending_review', 'published', 'system'],
  ['pending_review', 'rejected', 'system'],
  ['rejected', 'draft', 'owner'],
  ['rejected', 'pending_review', 'owner'],
  ['rejected', 'archived', 'owner'],
  ['published', 'pending_review', 'owner'],
  ['published', 'paused', 'owner'],
  ['published', 'rented', 'owner'],
  ['published', 'sold', 'owner'],
  ['published', 'archived', 'owner'],
  ['published', 'expired', 'system'],
  ['published', 'rejected', 'system'],
  ['paused', 'published', 'owner'],
  ['paused', 'pending_review', 'owner'],
  ['paused', 'archived', 'owner'],
  ['paused', 'rejected', 'system'],
  ['rented', 'archived', 'owner'],
  ['sold', 'archived', 'owner'],
  ['expired', 'pending_review', 'owner'],
  ['expired', 'archived', 'owner'],
];

export function canTransitionListing(from: ListingStatus, to: ListingStatus, actor: TransitionActor): boolean {
  return LISTING_TRANSITIONS.some(([f, t, a]) => f === from && t === to && (actor === 'system' || a === 'owner'));
}

export function nextOwnerStatuses(from: ListingStatus): ListingStatus[] {
  return LISTING_TRANSITIONS.filter(([f, , a]) => f === from && a === 'owner').map(([, t]) => t);
}

/** Statuses in which the owner may edit content. */
export const EDITABLE_LISTING_STATUSES: readonly ListingStatus[] = [
  'draft', 'rejected', 'published', 'paused', 'expired', 'pending_review',
];

/** Editing any of these on a live listing sends it back through review. */
export const MATERIAL_LISTING_FIELDS = [
  'title', 'description', 'purpose', 'categoryId', 'salePrice', 'monthlyRent', 'dailyRent',
  'videoUrl', 'virtualTourUrl', 'contactPhone', 'contactLine',
] as const;

export function hasMaterialChange(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  return MATERIAL_LISTING_FIELDS.some(
    (field) => field in patch && patch[field] !== undefined && patch[field] !== current[field],
  );
}

export type AppointmentAction = 'confirm' | 'reject' | 'reschedule' | 'accept_reschedule' | 'cancel' | 'complete';
export type AppointmentParty = 'requester' | 'owner';

const ACTIVE_APPOINTMENT: readonly AppointmentStatus[] = ['requested', 'confirmed', 'reschedule_requested'];

export function nextAppointmentStatus(input: {
  status: AppointmentStatus;
  action: AppointmentAction;
  party: AppointmentParty;
  proposedByOtherParty: boolean;
}): AppointmentStatus | null {
  const { status, action, party, proposedByOtherParty } = input;
  switch (action) {
    case 'confirm':
      return status === 'requested' && party === 'owner' ? 'confirmed' : null;
    case 'reject':
      return status === 'requested' && party === 'owner' ? 'rejected' : null;
    case 'reschedule':
      return ACTIVE_APPOINTMENT.includes(status) ? 'reschedule_requested' : null;
    case 'accept_reschedule':
      return status === 'reschedule_requested' && proposedByOtherParty ? 'confirmed' : null;
    case 'cancel':
      return ACTIVE_APPOINTMENT.includes(status) ? 'cancelled' : null;
    case 'complete':
      return status === 'confirmed' && party === 'owner' ? 'completed' : null;
    default:
      return null;
  }
}

export function isLister(roles: readonly AppRole[]): boolean {
  return roles.some((role) => role === 'owner' || role === 'agent' || role === 'admin');
}

export function isAdmin(roles: readonly AppRole[]): boolean {
  return roles.includes('admin');
}
