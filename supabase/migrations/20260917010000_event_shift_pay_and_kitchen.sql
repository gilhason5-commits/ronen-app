-- Let an EventShift row carry pay info (hourly or daily wage) regardless of
-- whether the worker came from a staffing agency or the kitchen/cleaning
-- roster, and let a shift reference a KitchenRosterMember directly so
-- kitchen staff can be marked present in event attendance the same way
-- agency workers are.
ALTER TABLE "EventShift"
  ADD COLUMN IF NOT EXISTS kitchen_member_id uuid REFERENCES "KitchenRosterMember"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'agency' CHECK (source IN ('agency', 'kitchen')),
  ADD COLUMN IF NOT EXISTS pay_type text CHECK (pay_type IN ('hourly', 'daily')),
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS daily_rate numeric,
  ADD COLUMN IF NOT EXISTS hours numeric;

-- Link each kitchen/cleaning roster member to a real TaskEmployee record so
-- they show up under "עובדים" and can be referenced consistently elsewhere.
ALTER TABLE "KitchenRosterMember"
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES "TaskEmployee"(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
