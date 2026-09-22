-- Splits the kitchen weekly roster grid into separate tables by team —
-- 'kitchen' (existing צוות מטבח וניקיון) vs 'ops' (new תפעול table: bar,
-- general cleaning, dishwashing). Existing rows default to 'kitchen' so the
-- current table's membership is unaffected.
ALTER TABLE "KitchenRosterMember"
  ADD COLUMN IF NOT EXISTS roster_group text NOT NULL DEFAULT 'kitchen';

NOTIFY pgrst, 'reload schema';
