import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cudsnpnqyvzkcicxxisc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZHNucG5xeXZ6a2NpY3h4aXNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU2ODAxMywiZXhwIjoyMDkxMTQ0MDEzfQ.jmhGSiefXkFsf90CSWfX1cSodrtObVpazW8b541pN-0'
);

// We can't run DDL via PostgREST, so we test by inserting a dummy row
// and checking which columns exist, then use upsert to "force" schema detection.

// Instead — insert a test row with all new columns and catch which ones fail
const testColumns = [
  'recurrence_type',
  'recurrence_time',
  'recurrence_days',
  'recurrence_day_of_month',
  'reminder_sent_at',
  'escalation_sent_at',
];

console.log('בודק עמודות קיימות ב-TaskAssignment...');

const { data, error } = await supabase
  .from('TaskAssignment')
  .select('id,' + testColumns.join(','))
  .limit(1);

if (error) {
  console.log('❌ עמודות חסרות:', error.message);
  console.log('\n🔧 הרץ את ה-SQL הבא ב-Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/cudsnpnqyvzkcicxxisc/sql/new\n');
  console.log(`ALTER TABLE "TaskAssignment"
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_time text,
  ADD COLUMN IF NOT EXISTS recurrence_days jsonb default '[]',
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_sent_at timestamptz;

ALTER TABLE "EmployeeDailyAvailability"
  ADD COLUMN IF NOT EXISTS ceo_escalated_at timestamptz;

NOTIFY pgrst, 'reload schema';`);
} else {
  console.log('✅ כל העמודות קיימות! אין צורך בשינויים.');
}
