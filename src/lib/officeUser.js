// The info@ office account gets special handling around producer approval:
// - it can approve an event manually ("אישור חריג") after the producer's
//   approval window (APPROVAL_MIN_BUSINESS_DAYS) has closed;
// - once an event is approved, purchasing/staffing are planned off its guest
//   counts, so it can no longer change them (other roles still can).
const OFFICE_EMAILS = ['info@raytlv.co.il'];

function isOfficeUser(user) {
  return OFFICE_EMAILS.includes((user?.email || '').toLowerCase());
}

export function canOverrideApprovalWindow(user) {
  return isOfficeUser(user);
}

export function isGuestCountLocked(user, event) {
  return !!event?.producer_approved && isOfficeUser(user);
}

export const GUEST_COUNT_LOCKED_MSG = 'האירוע אושר — לא ניתן לשנות כמות סועדים';
