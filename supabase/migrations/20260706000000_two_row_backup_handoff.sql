-- Two-row backup handoff. When an employee marks "not coming", their original
-- task now STAYS on them with status NOT_ARRIVING (so the day's history shows
-- who didn't show up), and a linked COPY is created for the backup employee,
-- who continues the normal reminder/escalation lifecycle on the copy.
alter table "TaskAssignment" add column if not exists covered_by_backup_id uuid;
alter table "TaskAssignment" add column if not exists covered_by_backup_name text;
alter table "TaskAssignment" add column if not exists copied_from_task_id uuid;
