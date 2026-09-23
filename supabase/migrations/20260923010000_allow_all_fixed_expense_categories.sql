-- Categories 3 & 4 became tabular expense tables too (same as 1 & 2),
-- instead of freeform memo blocks — widen the category CHECK accordingly.
ALTER TABLE "FixedExpense" DROP CONSTRAINT IF EXISTS "FixedExpense_category_check";
ALTER TABLE "FixedExpense" ADD CONSTRAINT "FixedExpense_category_check"
  CHECK (category IN ('cat1', 'cat2', 'cat3', 'cat4'));

NOTIFY pgrst, 'reload schema';
