-- Splits the flat fixed-expenses list into two tabular sub-categories
-- (cat1 / cat2) for the new dedicated "הוצאות קבועות" page layout. Existing
-- rows default to cat1 so nothing already entered disappears.
ALTER TABLE "FixedExpense"
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'cat1',
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE "FixedExpense" DROP CONSTRAINT IF EXISTS "FixedExpense_category_check";
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_category_check"
  CHECK (category IN ('cat1', 'cat2'));

NOTIFY pgrst, 'reload schema';
