-- Free-text field for event occasion (חתונה, בר מצווה, אירוע חברה, etc.)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS occasion text;
