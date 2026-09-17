-- Add optional revenue "addition" line items to an event: lighting/sound,
-- after-party food, and two free-text custom additions (name + amount).
-- These feed into the event's "הכנסה כוללת" (total revenue) alongside the
-- food revenue, without being folded into food revenue itself.
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS lighting_sound_cost numeric,
  ADD COLUMN IF NOT EXISTS after_party_food_cost numeric,
  ADD COLUMN IF NOT EXISTS custom_addition_1_name text,
  ADD COLUMN IF NOT EXISTS custom_addition_1_amount numeric,
  ADD COLUMN IF NOT EXISTS custom_addition_2_name text,
  ADD COLUMN IF NOT EXISTS custom_addition_2_amount numeric;

NOTIFY pgrst, 'reload schema';
