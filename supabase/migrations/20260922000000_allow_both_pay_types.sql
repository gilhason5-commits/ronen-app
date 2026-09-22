-- Allow an employee to be marked as both hourly and global/monthly paid
-- (e.g. a global monthly base plus hourly overtime), so both rates get
-- entered and shown together.
ALTER TABLE "TaskEmployee" DROP CONSTRAINT IF EXISTS "TaskEmployee_pay_type_check";
ALTER TABLE "TaskEmployee"
  ADD CONSTRAINT "TaskEmployee_pay_type_check" CHECK (pay_type IN ('hourly', 'global', 'both'));

NOTIFY pgrst, 'reload schema';
