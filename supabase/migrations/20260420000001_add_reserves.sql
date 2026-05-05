-- Add free-text reserves field to Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS reserves text;
