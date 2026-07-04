-- Reroute task escalations to the backup performer.
-- When an employee who is the escalation target of event tasks (typically the
-- event manager) marks they are not coming, every unsent escalation that
-- pointed at them is repointed to the backup performer who took over their own
-- tasks. The original target is kept so a later "coming after all" reply can
-- restore it.
alter table "TaskAssignment" add column if not exists original_escalation_employee_id uuid;
alter table "TaskAssignment" add column if not exists original_escalation_employee_name text;
alter table "TaskAssignment" add column if not exists original_escalation_employee_phone text;
