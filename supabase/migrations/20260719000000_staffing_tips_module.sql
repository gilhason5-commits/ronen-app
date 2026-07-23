-- ============================================================
-- STAFFING + TIPS MODULE (מערכת כוח אדם, תקנים וטיפים)
-- ============================================================

-- Event staffing format (הגשה / הפוכה / מחוברת / מסיבה / טעימות)
alter table "Event" add column if not exists staffing_format text
  check (staffing_format in ('serving','flipped','connected','party','tasting'));

-- Backfill from event_type: serving→serving, wedding→flipped
update "Event" set staffing_format =
  case when event_type = 'wedding' then 'flipped' else 'serving' end
where staffing_format is null;

create table if not exists "StaffingAgency" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_waiters_per_event integer,
  contact_phone text,
  notes text,
  is_active boolean default true,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "AgencyWorker" (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references "StaffingAgency"(id) on delete cascade,
  agency_name text,
  full_name text not null,
  include_in_tips boolean default true,
  is_active boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- Parametric staffing rules ("ספר התקנים")
-- rule_type:
--   WAITER_FORMULA — waiter count per event format (params holds the formula pieces)
--   REQUIRED_ROLE  — mandatory role by guest-count range
--   OPS            — kitchen/cleaning/bar crew by guest-count range
--   SPECIAL_DAY    — day-of-week conditional additions (params.day, params.condition)
create table if not exists "StaffingRule" (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null check (rule_type in ('WAITER_FORMULA','REQUIRED_ROLE','OPS','SPECIAL_DAY')),
  role_name text,
  event_format text,
  min_guests integer,
  max_guests integer,
  quantity integer,
  arrival_offset_minutes integer,
  params jsonb default '{}',
  explanation text,
  is_active boolean default true,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- Planned role assignments per event (the monthly map)
create table if not exists "EventStaffingPlan" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  role_name text not null,
  slot integer default 1,
  assigned_employee_id uuid references "TaskEmployee"(id) on delete set null,
  assigned_name text,
  note text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);
create index if not exists idx_esp_event on "EventStaffingPlan"(event_id);

-- Planned waiter split between agencies per event
create table if not exists "EventAgencySplit" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  agency_id uuid references "StaffingAgency"(id) on delete cascade,
  agency_name text,
  planned_count integer default 0,
  is_override boolean default false,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);
create index if not exists idx_eas_event on "EventAgencySplit"(event_id);

-- Actual attendance per person per event (event-manager mobile screen)
create table if not exists "EventShift" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  event_date date,
  worker_id uuid references "AgencyWorker"(id) on delete set null,
  worker_name text not null,
  agency_id uuid references "StaffingAgency"(id) on delete set null,
  agency_name text,
  role_name text default 'מלצר',
  clock_in text,
  clock_out text,
  is_runner boolean default false,
  is_closing boolean default false,
  is_balcony boolean default false,
  is_substitute boolean default false,
  note text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);
create index if not exists idx_shift_event on "EventShift"(event_id);
create index if not exists idx_shift_date on "EventShift"(event_date);

-- Monthly tip pool
create table if not exists "TipPool" (
  id uuid primary key default gen_random_uuid(),
  month text not null unique, -- 'YYYY-MM'
  amount numeric default 0,
  status text default 'draft' check (status in ('draft','locked')),
  notes text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- Tip distribution rules
-- rule_type: PERCENT (of pool), FIXED (monthly fixed), PER_RUNNER, PER_CLOSING
-- The remainder after all rules is divided between waiters by actual shifts.
create table if not exists "TipRule" (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  rule_type text not null check (rule_type in ('PERCENT','FIXED','PER_RUNNER','PER_CLOSING')),
  value numeric not null default 0,
  explanation text,
  is_active boolean default true,
  sort_order integer default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- Locked allocation result per worker per month
create table if not exists "TipAllocation" (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references "TipPool"(id) on delete cascade,
  month text,
  worker_name text not null,
  agency_name text,
  shifts integer default 0,
  runners integer default 0,
  closings integer default 0,
  breakdown jsonb default '{}',
  total numeric default 0,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);
create index if not exists idx_tipalloc_pool on "TipAllocation"(pool_id);

-- updated_date triggers (reuse existing function)
do $$
declare t text;
begin
  foreach t in array array['StaffingAgency','AgencyWorker','StaffingRule','EventStaffingPlan','EventAgencySplit','EventShift','TipPool','TipRule','TipAllocation']
  loop
    execute format('drop trigger if exists set_updated_date on %I', t);
    execute format('create trigger set_updated_date before update on %I for each row execute function update_updated_date()', t);
  end loop;
end $$;

-- ============================================================
-- SEED: agencies
-- ============================================================
insert into "StaffingAgency" (name, max_waiters_per_event, sort_order)
select * from (values ('עמי', 18, 1), ('איגור', 6, 2)) v(name, cap, ord)
where not exists (select 1 from "StaffingAgency");

-- ============================================================
-- SEED: staffing rules (defaults from תקנים.docx — editable in UI)
-- ============================================================
insert into "StaffingRule" (rule_type, role_name, event_format, min_guests, max_guests, quantity, arrival_offset_minutes, params, explanation, sort_order)
select * from (values
  -- ---- waiter formulas per format ----
  ('WAITER_FORMULA', 'מלצרים', 'serving',   null::int, null::int, null::int, -60,
    '{"formula":"ratio","ratio":10}'::jsonb,
    'הגשה: מלצר לכל 10 סועדים', 1),
  ('WAITER_FORMULA', 'מלצרים', 'flipped',   null, null, null, -60,
    '{"formula":"flipped","ratio":10,"exclude_roles":["מארחת","מארחת נוספת","ניהול כניסה"]}'::jsonb,
    'הפוכה: כמות סופית ÷ 10 פחות מספר המנהלים באירוע (בלי מארחת וניהול כניסה)', 2),
  ('WAITER_FORMULA', 'מלצרים', 'connected', null, null, null, -60,
    '{"formula":"ratio_plus","ratio":10,"plus":4}'::jsonb,
    'מחוברת: חישוב רגיל + 4', 3),
  ('WAITER_FORMULA', 'מלצרים', 'party',     null, null, null, -60,
    '{"formula":"ratio","ratio":15}'::jsonb,
    'מסיבה: מלצר לכל 15 (לברר מול רונן — 1:15 או 1:20)', 4),
  ('WAITER_FORMULA', 'מלצרים', 'tasting',   null, null, null, -60,
    '{"formula":"tables","per_tables":1,"add_runner":true}'::jsonb,
    'טעימות: לפי שולחנות + ראנר', 5),
  -- ---- required roles by guest count ----
  ('REQUIRED_ROLE', 'מנהל אירוע',   null, 0,    null, 1, -240, '{}', 'מנהל אירוע — תמיד, מגיע 4 שעות לפני', 10),
  ('REQUIRED_ROLE', 'פלור 1',       null, 150,  null, 1, -120, '{}', 'פלור 1 — מעל 150 סועדים', 11),
  ('REQUIRED_ROLE', 'פלור 2',       null, 300,  null, 1, -120, '{}', 'פלור 2 — מעל 300 סועדים', 12),
  ('REQUIRED_ROLE', 'מנהל מרפסת',   null, 100,  null, 1, -180, '{}', 'מנהל מרפסת — מעל 100 סועדים, מגיע 3 שעות לפני', 13),
  ('REQUIRED_ROLE', 'מארחת',        null, 0,    null, 1, -120, '{}', 'מארחת — תמיד', 14),
  ('REQUIRED_ROLE', 'מארחת נוספת',  null, 200,  null, 1, -120, '{}', 'מארחת נוספת — מ־200 סועדים', 15),
  ('REQUIRED_ROLE', 'ניהול כניסה',  null, 0,    null, 1, -120, '{}', 'ניהול כניסה — תמיד, מגיע שעתיים לפני', 16),
  ('REQUIRED_ROLE', 'ראנר',         null, 0,    null, 1, -90,  '{}', 'ראנר — תמיד', 17),
  ('REQUIRED_ROLE', 'ראנר שני',     null, 200,  null, 1, -90,  '{}', 'ראנר שני — מעל 200 סועדים', 18),
  ('REQUIRED_ROLE', 'מזנונים',      null, 0,    null, 1, -120, '{}', 'מזנונים — מגיע שעתיים לפני', 19),
  ('REQUIRED_ROLE', 'סומלייה',      null, 0,    null, 1, -90,  '{}', 'סומלייה — מגיע שעה וחצי לפני', 20),
  -- ---- kitchen / cleaning / bar ----
  ('OPS', 'שף',           null, 0,    null, 1, null, '{}', 'שף — תמיד', 30),
  ('OPS', 'סו-שף',        null, 0,    null, 1, null, '{}', 'סו-שף — תמיד', 31),
  ('OPS', 'טבח',          null, 0,    250,  4, null, '{}', 'עד 250 סועדים — 4 טבחים', 32),
  ('OPS', 'טבח',          null, 251,  null, 5, null, '{}', 'מעל 250 סועדים — טבח נוסף (5)', 33),
  ('OPS', 'מדיח',         null, 0,    100,  1, null, '{}', 'עד 100 סועדים — מדיח אחד', 34),
  ('OPS', 'מדיח',         null, 101,  200,  2, null, '{}', 'מעל 100 — שני מדיחים', 35),
  ('OPS', 'מדיח',         null, 201,  300,  3, null, '{}', 'מעל 200 — שלושה מדיחים', 36),
  ('OPS', 'מדיח',         null, 301,  null, 4, null, '{}', 'מעל 300 — ארבעה מדיחים', 37),
  ('OPS', 'מנקת ערב',     null, 0,    null, 1, null, '{}', 'מנקת ערב — תמיד', 38),
  ('OPS', 'שטיפת סירים',  null, 200,  null, 1, null, '{}', 'שטיפת סירים — מעל 200 (תקן קטוע במסמך, לברר)', 39),
  ('OPS', 'הקמת בר',      null, 0,    null, 1, null, '{}', 'הקמת בר — תמיד', 40),
  ('OPS', 'סוגר',         null, 0,    null, 3, null, '{"with_after":4}', 'שלושה סוגרים, ארבעה עם אפטר', 41),
  -- ---- special day rules ----
  ('SPECIAL_DAY', 'טבח',          null, null, null, 1, null, '{"day":4,"condition":"event_next_day"}',    'תוספת טבח בחמישי כשיש אירוע בשישי', 50),
  ('SPECIAL_DAY', 'מנקת ערב',     null, null, null, 1, null, '{"day":4}',                                  'שתי מנקות בחמישי (תוספת אחת)', 51),
  ('SPECIAL_DAY', 'מלצרים מוקדמים', null, null, null, null, -120, '{"day":5,"formats":["flipped"]}',       'מלצרים מוקדמים בהפוכות ובשישי — מגיעים שעתיים לפני', 52)
) v(rule_type, role_name, event_format, min_guests, max_guests, quantity, arrival_offset_minutes, params, explanation, sort_order)
where not exists (select 1 from "StaffingRule");

-- ============================================================
-- SEED: tip rules (defaults from the tips dashboard — editable in UI)
-- ============================================================
insert into "TipRule" (role_name, rule_type, value, explanation, sort_order)
select * from (values
  ('מנהל אירוע',      'PERCENT',     20,    'מנהל אירוע — 20% מהקופה (לברר: אחוז או 10,000 פיקס)', 1),
  ('מפיק',            'FIXED',       0,     'מפיק — סכום קבוע (להגדיר)', 2),
  ('מטבח',            'PERCENT',     30,    'מטבח — 30% מהקופה', 3),
  ('פלור',            'PERCENT',     20,    'פלור — 20% מהקופה', 4),
  ('מלצרית משפחה',    'FIXED',       0,     'מלצרית משפחה — סכום קבוע (להגדיר)', 5),
  ('סאונד',           'FIXED',       0,     'סאונד — סכום קבוע (להגדיר)', 6),
  ('אבטחה',           'FIXED',       0,     'אבטחה — סכום קבוע (להגדיר)', 7),
  ('יין',             'FIXED',       0,     'יין — סכום קבוע (להגדיר)', 8),
  ('ראנר',            'PER_RUNNER',  50,    'ראנר — 50 ₪ לכל מופע ראנר שנרשם בנוכחות', 9),
  ('סגירה',           'PER_CLOSING', 80,    'סגירה — 80 ₪ לכל מופע סגירה שנרשם בנוכחות', 10)
) v(role_name, rule_type, value, explanation, sort_order)
where not exists (select 1 from "TipRule");
