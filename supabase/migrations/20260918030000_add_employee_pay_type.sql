-- Per-employee pay type (hourly or global/monthly) and its rate, editable
-- from עמוד עובדים.
ALTER TABLE "TaskEmployee"
  ADD COLUMN IF NOT EXISTS pay_type text CHECK (pay_type IN ('hourly', 'global')),
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS global_rate numeric;

NOTIFY pgrst, 'reload schema';
