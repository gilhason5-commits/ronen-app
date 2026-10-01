-- The fixed-expenses page grows from 4 to 8 category tables — widen the
-- category CHECK accordingly.
ALTER TABLE "FixedExpense" DROP CONSTRAINT IF EXISTS "FixedExpense_category_check";
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_category_check"
  CHECK (category IN ('cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6', 'cat7', 'cat8'));

NOTIFY pgrst, 'reload schema';
