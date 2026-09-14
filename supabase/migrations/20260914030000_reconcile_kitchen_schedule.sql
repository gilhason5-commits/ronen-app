-- Reconcile two parallel kitchen-schedule builds that landed in the same
-- session window: this repo went with the KitchenRosterMember/KitchenShift
-- design (per-date, with per-person defaults) rather than the day-of-week
-- recurring KitchenStaffShift table an earlier local branch had already
-- pushed straight to the shared DB. Drop the unused one so it doesn't sit
-- there as dead/confusing duplicate data, and fix a name typo against the
-- actual reference sheet ("דיויד" → "דיווד").

drop table if exists "KitchenStaffShift";

update "KitchenRosterMember" set full_name = 'דיווד טאבון' where full_name = 'דיויד טאבון';
update "KitchenShift" set member_name = 'דיווד טאבון' where member_name = 'דיויד טאבון';

-- The abandoned build also created TaskEmployee rows for the kitchen staff
-- (so they'd be pickable in the old table's "add employee" form). The kept
-- design keeps kitchen staff entirely in KitchenRosterMember instead, so
-- these would otherwise just show up as stray options in unrelated
-- front-of-house role-assignment dropdowns. קובי/סטיבן predate this and are
-- left alone. Unreferenced elsewhere (created minutes before this fix, on
-- the same session) — plain delete, not a cascade concern.
delete from "TaskEmployee" where full_name in (
  'אלרואי', 'TEE טה', 'דיוד טאבון', 'דיווד טאבון', 'ITZIK', 'ונסי', 'נטשה NATASHA',
  'תיאו', 'אביטל', 'JOKA', 'MAK מצד', 'מאק MAK'
);

NOTIFY pgrst, 'reload schema';
