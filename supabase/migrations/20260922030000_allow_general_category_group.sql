-- Add 'general' (כלליות) as a 4th group_type — per-event flat expenses that
-- don't belong to the food/drink/consumables dish tree.
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_group_type_check";
ALTER TABLE "Category" ADD CONSTRAINT "Category_group_type_check"
  CHECK (group_type IN ('food', 'drink', 'consumables', 'general'));

NOTIFY pgrst, 'reload schema';
