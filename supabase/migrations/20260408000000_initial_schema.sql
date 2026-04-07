-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- LOOKUP / REFERENCE TABLES (no foreign key dependencies)
-- ============================================================

create table if not exists "AppSetting" (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  description text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Department" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean default true,
  display_order integer,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Category" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  display_order integer,
  event_type text,
  active boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "SubCategory" (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references "Category"(id) on delete set null,
  name text not null,
  description text,
  display_order integer,
  event_type text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Ingredient_Category" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  display_order integer,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Supplier_Category" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  display_order integer,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "TaskCategory" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_type text not null check (category_type in ('RECURRING','PER_EVENT','PETI_VOR_RECURRING')),
  department text not null,
  is_active boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- SUPPLIER & INGREDIENT
-- ============================================================

create table if not exists "Supplier" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  accounting_phone text,
  payment_method text,
  payment_terms text,
  supplier_category_id uuid references "Supplier_Category"(id) on delete set null,
  supplier_category_name text,
  supplier_type text check (supplier_type in ('daily','weekly')),
  status text default 'active' check (status in ('active','inactive')),
  notes text,
  pdf_files jsonb default '[]',
  items_supplied jsonb default '[]',
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Ingredient" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  purchase_unit numeric default 1,
  system_unit text,
  unit text,
  base_price numeric,
  price_per_unit numeric,
  price_per_system numeric,
  waste_pct numeric,
  on_hand_qty numeric default 0,
  ingredient_category_id uuid references "Ingredient_Category"(id) on delete set null,
  ingredient_category_name text,
  current_supplier_id uuid references "Supplier"(id) on delete set null,
  current_supplier_name text,
  last_price_update date,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Ingredient_Price_History" (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references "Ingredient"(id) on delete cascade,
  ingredient_name text,
  old_price numeric,
  new_price numeric,
  old_price_per_system numeric,
  new_price_per_system numeric,
  supplier_id uuid references "Supplier"(id) on delete set null,
  supplier_name text,
  change_date date,
  created_date timestamptz default now()
);

create table if not exists "InventoryMovement" (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references "Ingredient"(id) on delete cascade,
  ingredient_name text,
  type text check (type in ('receive','consume','adjust','waste')),
  qty numeric,
  unit text,
  unit_cost numeric,
  total_cost numeric,
  notes text,
  movement_date date,
  source_type text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "SpecialIngredient" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_unit text,
  components jsonb default '[]',
  price_per_system_unit numeric,
  total_cost numeric,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- DISHES
-- ============================================================

create table if not exists "Dish" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  recipe text,
  event_type text,
  categories jsonb default '[]',
  sub_category_id uuid references "SubCategory"(id) on delete set null,
  sub_category_name text,
  serving_percentage numeric default 100,
  operations_department text,
  ingredients jsonb default '[]',
  unit_cost numeric,
  avg_portion_per_guest numeric,
  portion_factor numeric,
  preparation_mass_grams numeric,
  portion_size_grams numeric,
  base_unit text,
  pdf_files jsonb default '[]',
  active boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- EVENTS
-- ============================================================

create table if not exists "Event" (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_date date not null,
  event_time text,
  event_type text,
  guest_count integer,
  children_count integer,
  vegan_count integer,
  glatt_count integer,
  kashrut_note text,
  price_per_plate numeric,
  status text default 'draft' check (status in ('draft','in_progress','completed','cancelled','producer_draft')),
  notes text,
  food_cost_sum numeric,
  food_cost_pct numeric,
  event_price numeric,
  margin_pct numeric,
  producer_approved boolean default false,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Event_Stage" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  stage_name text,
  stage_order integer,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "Events_Dish" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  stage_id uuid references "Event_Stage"(id) on delete set null,
  category_id uuid references "Category"(id) on delete set null,
  dish_id uuid not null references "Dish"(id) on delete cascade,
  dish_name text,
  planned_qty numeric,
  planned_cost numeric,
  actual_qty numeric,
  actual_cost numeric,
  unit text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "EventDishNote" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event"(id) on delete cascade,
  event_dish_id uuid references "Events_Dish"(id) on delete cascade,
  note text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- INVOICES
-- ============================================================

create table if not exists "CustomerInvoice" (
  id uuid primary key default gen_random_uuid(),
  invoice_number text,
  event_id uuid references "Event"(id) on delete set null,
  event_name text,
  customer_name text,
  customer_email text,
  customer_phone text,
  line_items jsonb default '[]',
  amount numeric,
  tax numeric,
  total numeric,
  due_date date,
  status text default 'draft' check (status in ('draft','sent','paid','overdue')),
  payments jsonb default '[]',
  balance numeric,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "SupplierInvoice" (
  id uuid primary key default gen_random_uuid(),
  invoice_number text,
  supplier_id uuid references "Supplier"(id) on delete set null,
  supplier_name text,
  items jsonb default '[]',
  subtotal numeric,
  tax numeric,
  total numeric,
  due_date date,
  status text default 'pending' check (status in ('pending','draft','paid','overdue')),
  payments jsonb default '[]',
  balance numeric,
  pdf_url text,
  pdf_name text,
  notes text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "PurchaseOrder" (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references "Supplier"(id) on delete set null,
  supplier_name text,
  supplier_type text,
  order_date date,
  delivery_date date,
  items jsonb default '[]',
  subtotal numeric,
  tax numeric,
  total numeric,
  status text default 'pending' check (status in ('pending','confirmed','delivered','cancelled')),
  notes text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- EMPLOYEE / TASK MANAGEMENT
-- ============================================================

create table if not exists "EmployeeRole" (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  department_id uuid references "Department"(id) on delete set null,
  department_name text,
  description text,
  is_active boolean default true,
  is_manager boolean default false,
  manages_department_id uuid references "Department"(id) on delete set null,
  manages_department_name text,
  procedures text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "TaskEmployee" (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text,
  role_id uuid references "EmployeeRole"(id) on delete set null,
  role_name text,
  department_id uuid references "Department"(id) on delete set null,
  department_name text,
  is_active boolean default true,
  whatsapp_enabled boolean default true,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "TaskTemplate" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id uuid not null references "TaskCategory"(id) on delete cascade,
  category_name text,
  task_type text not null check (task_type in ('RECURRING','PER_EVENT','PETI_VOR_RECURRING')),
  department text,
  default_role text,
  manager_editable boolean default false,
  is_active boolean default true,
  reminder_before_start_minutes integer default 10,
  reminder_before_end_minutes integer default 10,
  escalate_to_manager_if_not_done boolean default true,
  escalation_role_id uuid references "EmployeeRole"(id) on delete set null,
  escalation_role_name text,
  schedule_rule text,
  anchor text default 'EVENT_START' check (anchor in ('EVENT_START','EVENT_END')),
  start_offset_minutes integer,
  duration_minutes integer,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "TaskAssignment" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references "Event"(id) on delete cascade,
  template_id uuid references "TaskTemplate"(id) on delete set null,
  assigned_to_id uuid references "TaskEmployee"(id) on delete set null,
  assigned_to_name text,
  role_id uuid references "EmployeeRole"(id) on delete set null,
  role_name text,
  start_time timestamptz,
  end_time timestamptz,
  status text default 'pending' check (status in ('pending','in_progress','completed','escalated')),
  additional_employees jsonb default '[]',
  escalation_employee_id uuid references "TaskEmployee"(id) on delete set null,
  escalation_employee_name text,
  notes text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "EventStaffing" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references "Event"(id) on delete cascade,
  event_name text,
  event_date date,
  employee_id uuid references "TaskEmployee"(id) on delete cascade,
  employee_name text,
  staffing_role_override text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "EmployeeDailyAvailability" (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references "Event"(id) on delete cascade,
  employee_id uuid references "TaskEmployee"(id) on delete cascade,
  employee_name text,
  event_date date,
  confirmation_status text default 'PENDING' check (confirmation_status in ('CONFIRMED_AVAILABLE','CONFIRMED_UNAVAILABLE','NO_RESPONSE','PENDING')),
  confirmation_sent_at timestamptz,
  confirmation_response_at timestamptz,
  manager_notified_at timestamptz,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table if not exists "WorkSummary" (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  summary_text text,
  issues_text text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ============================================================
-- AUTO-UPDATE updated_date TRIGGER
-- ============================================================

create or replace function update_updated_date()
returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables with updated_date
create trigger update_AppSetting_updated_date before update on "AppSetting" for each row execute function update_updated_date();
create trigger update_Department_updated_date before update on "Department" for each row execute function update_updated_date();
create trigger update_Category_updated_date before update on "Category" for each row execute function update_updated_date();
create trigger update_SubCategory_updated_date before update on "SubCategory" for each row execute function update_updated_date();
create trigger update_Ingredient_Category_updated_date before update on "Ingredient_Category" for each row execute function update_updated_date();
create trigger update_Supplier_Category_updated_date before update on "Supplier_Category" for each row execute function update_updated_date();
create trigger update_TaskCategory_updated_date before update on "TaskCategory" for each row execute function update_updated_date();
create trigger update_Supplier_updated_date before update on "Supplier" for each row execute function update_updated_date();
create trigger update_Ingredient_updated_date before update on "Ingredient" for each row execute function update_updated_date();
create trigger update_InventoryMovement_updated_date before update on "InventoryMovement" for each row execute function update_updated_date();
create trigger update_SpecialIngredient_updated_date before update on "SpecialIngredient" for each row execute function update_updated_date();
create trigger update_Dish_updated_date before update on "Dish" for each row execute function update_updated_date();
create trigger update_Event_updated_date before update on "Event" for each row execute function update_updated_date();
create trigger update_Event_Stage_updated_date before update on "Event_Stage" for each row execute function update_updated_date();
create trigger update_Events_Dish_updated_date before update on "Events_Dish" for each row execute function update_updated_date();
create trigger update_EventDishNote_updated_date before update on "EventDishNote" for each row execute function update_updated_date();
create trigger update_CustomerInvoice_updated_date before update on "CustomerInvoice" for each row execute function update_updated_date();
create trigger update_SupplierInvoice_updated_date before update on "SupplierInvoice" for each row execute function update_updated_date();
create trigger update_PurchaseOrder_updated_date before update on "PurchaseOrder" for each row execute function update_updated_date();
create trigger update_EmployeeRole_updated_date before update on "EmployeeRole" for each row execute function update_updated_date();
create trigger update_TaskEmployee_updated_date before update on "TaskEmployee" for each row execute function update_updated_date();
create trigger update_TaskTemplate_updated_date before update on "TaskTemplate" for each row execute function update_updated_date();
create trigger update_TaskAssignment_updated_date before update on "TaskAssignment" for each row execute function update_updated_date();
create trigger update_EventStaffing_updated_date before update on "EventStaffing" for each row execute function update_updated_date();
create trigger update_EmployeeDailyAvailability_updated_date before update on "EmployeeDailyAvailability" for each row execute function update_updated_date();
create trigger update_WorkSummary_updated_date before update on "WorkSummary" for each row execute function update_updated_date();
