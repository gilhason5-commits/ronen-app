-- Supabase auto-enables RLS on tables created via the SQL editor. Every
-- other table in this schema has RLS off (access controlled at the app
-- layer), so match that instead of leaving StaffingChangeLog silently
-- blocking all writes from the authenticated app user.
alter table "StaffingChangeLog" disable row level security;

NOTIFY pgrst, 'reload schema';
