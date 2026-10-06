// The info@ office account can approve an event manually ("אישור חריג")
// after the producer's approval window (APPROVAL_MIN_BUSINESS_DAYS) has closed.
const OFFICE_EMAILS = ['info@raytlv.co.il'];

function isOfficeUser(user) {
  return OFFICE_EMAILS.includes((user?.email || '').toLowerCase());
}

export function canOverrideApprovalWindow(user) {
  return isOfficeUser(user);
}
