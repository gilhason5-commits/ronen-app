/**
 * Base44 → Supabase Data Migration Script
 * Run: node migration-data/import.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://cudsnpnqyvzkcicxxisc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZHNucG5xeXZ6a2NpY3h4aXNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU2ODAxMywiZXhwIjoyMDkxMTQ0MDEzfQ.jmhGSiefXkFsf90CSWfX1cSodrtObVpazW8b541pN-0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── ID mapping: base44_hex_id → new UUID ─────────────────────────────────────
// Load existing map so re-runs don't create duplicates
const idMapPath = path.join(__dirname, 'id_map.json');
const idMap = fs.existsSync(idMapPath) ? JSON.parse(fs.readFileSync(idMapPath, 'utf-8')) : {};
function mapId(base44Id) {
  if (!base44Id) return null;
  if (!idMap[base44Id]) idMap[base44Id] = randomUUID();
  return idMap[base44Id];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readCSV(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${filename} not found — skipping`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

function parseJSON(val) {
  if (!val || val === '' || val === 'None') return null;
  try { return JSON.parse(val); } catch { return null; }
}

function safeNum(val) {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function safeBool(val) {
  if (val === 'true' || val === true) return true;
  if (val === 'false' || val === false) return false;
  return null;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function upsert(table, rows) {
  if (!rows.length) { console.log(`  ⚠️  No rows for ${table}`); return; }
  let ok = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  ❌ ${table} batch ${Math.floor(i/100)+1}: ${error.message}`);
    } else {
      ok += batch.length;
    }
  }
  console.log(`  ✅ ${table}: ${ok}/${rows.length} rows`);
}

// ─── 1. Ingredient_Category ───────────────────────────────────────────────────
async function importIngredientCategories() {
  console.log('\n📂 Ingredient_Category...');
  const rows = readCSV('Ingredient_Category_export.csv');
  if (!rows.length) return;
  await upsert('Ingredient_Category', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    description: r.description || null,
    display_order: safeNum(r.display_order),
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 2. Supplier_Category ─────────────────────────────────────────────────────
async function importSupplierCategories() {
  console.log('\n📂 Supplier_Category...');
  const rows = readCSV('Supplier_Category_export.csv');
  if (!rows.length) return;
  await upsert('Supplier_Category', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    description: r.description || null,
    display_order: safeNum(r.display_order),
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 3. Category ─────────────────────────────────────────────────────────────
async function importCategories() {
  console.log('\n📂 Category...');
  const rows = readCSV('Category_export.csv');
  if (!rows.length) return;
  await upsert('Category', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    description: r.description || null,
    display_order: safeNum(r.display_order),
    event_type: r.event_type || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 4. SubCategory ──────────────────────────────────────────────────────────
async function importSubCategories() {
  console.log('\n📂 SubCategory...');
  const rows = readCSV('SubCategory_export.csv');
  if (!rows.length) return;
  await upsert('SubCategory', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    category_id: r.category_id ? mapId(r.category_id) : null,
    category_name: r.category_name || null,
    display_order: safeNum(r.display_order),
    event_type: r.event_type || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 5. Department ───────────────────────────────────────────────────────────
async function importDepartments() {
  console.log('\n🏢 Department...');
  const rows = readCSV('Department_export.csv');
  if (!rows.length) return;
  await upsert('Department', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    description: r.description || null,
    is_active: safeBool(r.is_active) ?? true,
    display_order: safeNum(r.display_order),
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 6. Supplier ─────────────────────────────────────────────────────────────
async function importSuppliers() {
  console.log('\n🏭 Supplier...');
  const rows = readCSV('Supplier_export.csv');
  if (!rows.length) return;
  await upsert('Supplier', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    contact_person: r.contact_person || null,
    email: r.email || null,
    phone: r.phone || null,
    accounting_phone: r.accounting_phone || null,
    payment_method: r.payment_method || null,
    payment_terms: r.payment_terms || null,
    supplier_category_id: r.supplier_category_id ? mapId(r.supplier_category_id) : null,
    supplier_category_name: r.supplier_category_name || null,
    supplier_type: ['daily','weekly'].includes(r.supplier_type) ? r.supplier_type : null,
    status: ['active','inactive'].includes(r.status) ? r.status : 'active',
    notes: r.notes || null,
    pdf_files: parseJSON(r.pdf_files) ?? [],
    items_supplied: parseJSON(r.items_supplied) ?? [],
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 7. Ingredient ───────────────────────────────────────────────────────────
async function importIngredients() {
  console.log('\n🥕 Ingredient...');
  const rows = readCSV('Ingredient_export.csv');
  if (!rows.length) return;
  await upsert('Ingredient', rows.map(r => ({
    id: mapId(r.id),
    name: r.name || '',
    purchase_unit: safeNum(r.purchase_unit),
    system_unit: r.system_unit || null,
    unit: r.unit || null,
    base_price: safeNum(r.base_price),
    price_per_unit: safeNum(r.price_per_unit),
    price_per_system: safeNum(r.price_per_system),
    waste_pct: safeNum(r.waste_pct),
    on_hand_qty: safeNum(r.on_hand_qty) ?? 0,
    ingredient_category_id: r.ingredient_category_id ? mapId(r.ingredient_category_id) : null,
    ingredient_category_name: r.ingredient_category_name || null,
    current_supplier_id: r.current_supplier_id ? mapId(r.current_supplier_id) : null,
    current_supplier_name: r.current_supplier_name || null,
    last_price_update: r.last_price_update || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 8. Ingredient_Price_History ─────────────────────────────────────────────
async function importIngredientPriceHistory() {
  console.log('\n📈 Ingredient_Price_History...');
  const rows = readCSV('Ingredient_Price_History_export.csv');
  if (!rows.length) return;
  await upsert('Ingredient_Price_History', rows.map(r => ({
    id: mapId(r.id),
    ingredient_id: r.ingredient_id ? mapId(r.ingredient_id) : null,
    ingredient_name: r.ingredient_name || null,
    old_price: safeNum(r.old_price),
    new_price: safeNum(r.new_price),
    old_price_per_system: safeNum(r.old_price_per_system),
    new_price_per_system: safeNum(r.new_price_per_system),
    supplier_id: r.supplier_id ? mapId(r.supplier_id) : null,
    supplier_name: r.supplier_name || null,
    change_date: r.change_date || null,
    created_date: safeDate(r.created_date),
  })));
}

// ─── 9. SpecialIngredient ─────────────────────────────────────────────────────
async function importSpecialIngredients() {
  console.log('\n⭐ SpecialIngredient...');
  const rows = readCSV('SpecialIngredient_export.csv');
  if (!rows.length) return;
  await upsert('SpecialIngredient', rows.map(r => {
    // Map ingredient_ids inside components array
    let components = parseJSON(r.components);
    if (Array.isArray(components)) {
      components = components.map(c => ({
        ...c,
        ingredient_id: c.ingredient_id ? mapId(c.ingredient_id) : null,
      }));
    }
    return {
      id: mapId(r.id),
      name: r.name || '',
      description: r.description || null,
      system_unit: r.system_unit || null,
      components: components ?? [],
      price_per_system_unit: safeNum(r.price_per_system_unit),
      total_cost: safeNum(r.total_cost),
      created_date: safeDate(r.created_date),
      updated_date: safeDate(r.updated_date),
    };
  }));
}

// ─── 10. Dish ────────────────────────────────────────────────────────────────
async function importDishes() {
  console.log('\n🍽️  Dish...');
  const rows = readCSV('Dish_export.csv');
  if (!rows.length) return;

  await upsert('Dish', rows.map(r => {
    // Fix ingredients — map IDs
    let ingredients = parseJSON(r.ingredients);
    if (Array.isArray(ingredients)) {
      ingredients = ingredients.map(ing => ({
        ...ing,
        ingredient_id: ing.ingredient_id ? mapId(ing.ingredient_id) : null,
      }));
    }

    // Fix categories — value may be a plain hex string (not array)
    let categories = parseJSON(r.categories);
    if (typeof categories === 'string') {
      // Was a plain ID string — wrap it
      categories = [{ category_id: mapId(categories) }];
    } else if (Array.isArray(categories)) {
      categories = categories.map(cat => {
        // Guard against string-spread bug (object with "0","1",... keys)
        if (cat && typeof cat === 'object' && !cat.category_id && '0' in cat) {
          const rawId = Object.values(cat).join('').replace('category_id', '').trim();
          return { category_id: mapId(rawId) };
        }
        return { ...cat, category_id: cat.category_id ? mapId(cat.category_id) : null };
      });
    }

    return {
      id: mapId(r.id),
      name: r.name || '',
      description: r.description || null,
      recipe: r.recipe || null,
      event_type: r.event_type || null,
      categories: categories ?? [],
      sub_category_id: r.sub_category_id ? mapId(r.sub_category_id) : null,
      sub_category_name: r.sub_category_name || null,
      serving_percentage: safeNum(r.serving_percentage) ?? 100,
      operations_department: r.operations_department || null,
      ingredients: ingredients ?? [],
      unit_cost: safeNum(r.unit_cost),
      price_per_guest: safeNum(r.price_per_guest),
      portion_size_grams: safeNum(r.portion_size_grams),
      preparation_mass_grams: safeNum(r.preparation_mass_grams),
      waste_pct: safeNum(r.waste_pct),
      portion_factor: safeNum(r.portion_factor),
      avg_portion_per_guest: safeNum(r.avg_portion_per_guest),
      base_unit: r.base_unit || null,
      active: safeBool(r.active) ?? true,
      pdf_files: parseJSON(r.pdf_files) ?? [],
      created_date: safeDate(r.created_date),
      updated_date: safeDate(r.updated_date),
    };
  }));
}

// ─── 11. EmployeeRole ────────────────────────────────────────────────────────
async function importEmployeeRoles() {
  console.log('\n👔 EmployeeRole...');
  const rows = readCSV('EmployeeRole_export.csv');
  if (!rows.length) return;
  await upsert('EmployeeRole', rows.map(r => ({
    id: mapId(r.id),
    role_name: r.role_name || '',
    description: r.description || null,
    is_active: safeBool(r.is_active) ?? true,
    is_manager: safeBool(r.is_manager) ?? false,
    department_id: r.department_id ? mapId(r.department_id) : null,
    department_name: r.department_name || null,
    manages_department_id: r.manages_department_id ? mapId(r.manages_department_id) : null,
    manages_department_name: r.manages_department_name || null,
    procedures: r.procedures || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 12. TaskEmployee ────────────────────────────────────────────────────────
async function importTaskEmployees() {
  console.log('\n👷 TaskEmployee...');
  const rows = readCSV('TaskEmployee_export.csv');
  if (!rows.length) return;
  await upsert('TaskEmployee', rows.map(r => ({
    id: mapId(r.id),
    full_name: r.full_name || '',
    phone_e164: r.phone_e164 || null,
    role_id: r.role_id ? mapId(r.role_id) : null,
    role_name: r.role_name || null,
    department_id: r.department_id ? mapId(r.department_id) : null,
    department_name: r.department_name || null,
    manager_id: r.manager_id ? mapId(r.manager_id) : null,
    manager_name: r.manager_name || null,
    is_active: safeBool(r.is_active) ?? true,
    whatsapp_enabled: safeBool(r.whatsapp_enabled) ?? false,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 13. TaskTemplate ────────────────────────────────────────────────────────
async function importTaskTemplates() {
  console.log('\n📋 TaskTemplate...');
  const rows = readCSV('TaskTemplate_export.csv');
  if (!rows.length) return;
  await upsert('TaskTemplate', rows.map(r => ({
    id: mapId(r.id),
    title: r.title || '',
    description: r.description || null,
    task_type: r.task_type || null,
    anchor: r.anchor || null,
    start_offset_minutes: safeNum(r.start_offset_minutes),
    duration_minutes: safeNum(r.duration_minutes),
    department: r.department || null,
    default_role: r.default_role || null,
    category_id: r.category_id ? mapId(r.category_id) : null,
    category_name: r.category_name || null,
    is_active: safeBool(r.is_active) ?? true,
    manager_editable: safeBool(r.manager_editable) ?? false,
    reminder_before_start_minutes: safeNum(r.reminder_before_start_minutes),
    reminder_before_end_minutes: safeNum(r.reminder_before_end_minutes),
    escalate_to_manager_if_not_done: safeBool(r.escalate_to_manager_if_not_done) ?? false,
    escalation_role_id: r.escalation_role_id ? mapId(r.escalation_role_id) : null,
    escalation_role_name: r.escalation_role_name || null,
    schedule_rule: r.schedule_rule || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 14. TaskAssignment ───────────────────────────────────────────────────────
async function importTaskAssignments() {
  console.log('\n📌 TaskAssignment...');
  const rows = readCSV('TaskAssignment_export.csv');
  if (!rows.length) return;
  await upsert('TaskAssignment', rows.map(r => ({
    id: mapId(r.id),
    task_template_id: r.task_template_id ? mapId(r.task_template_id) : null,
    task_title: r.task_title || null,
    task_description: r.task_description || null,
    assigned_to_id: r.assigned_to_id ? mapId(r.assigned_to_id) : null,
    assigned_to_name: r.assigned_to_name || null,
    assigned_to_phone: r.assigned_to_phone || null,
    manager_id: r.manager_id ? mapId(r.manager_id) : null,
    manager_name: r.manager_name || null,
    manager_phone: r.manager_phone || null,
    event_id: r.event_id ? mapId(r.event_id) : null,
    event_name: r.event_name || null,
    status: (r.status || 'PENDING').toLowerCase(),
    start_time: r.start_time || null,
    end_time: r.end_time || null,
    computed_start_time: r.computed_start_time || null,
    computed_end_time: r.computed_end_time || null,
    completed_at: r.completed_at || null,
    recurrence_type: r.recurrence_type || null,
    recurrence_days: parseJSON(r.recurrence_days) ?? [],
    recurrence_time: r.recurrence_time || null,
    recurrence_day_of_month: safeNum(r.recurrence_day_of_month),
    reminder_before_start_minutes: safeNum(r.reminder_before_start_minutes),
    reminder_before_end_minutes: safeNum(r.reminder_before_end_minutes),
    escalate_to_manager: safeBool(r.escalate_to_manager) ?? false,
    escalation_role_id: r.escalation_role_id ? mapId(r.escalation_role_id) : null,
    escalation_role_name: r.escalation_role_name || null,
    escalation_employee_id: r.escalation_employee_id ? mapId(r.escalation_employee_id) : null,
    escalation_employee_name: r.escalation_employee_name || null,
    escalation_employee_phone: r.escalation_employee_phone || null,
    escalation_sent_at: r.escalation_sent_at || null,
    manually_overridden: safeBool(r.manually_overridden) ?? false,
    additional_employees: parseJSON(r.additional_employees) ?? [],
    last_notification_start_sent_at: r.last_notification_start_sent_at || null,
    last_notification_end_sent_at: r.last_notification_end_sent_at || null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── 15. Events_Dish ────────────────────────────────────────────────────────
async function importEventsDish() {
  console.log('\n🔗 Events_Dish...');
  const rows = readCSV('Events_Dish_export.csv');
  if (!rows.length) return;
  // Skip rows whose event_id is unknown (events not yet imported)
  const valid = rows.filter(r => r.event_id && idMap[r.event_id]);
  const skipped = rows.length - valid.length;
  if (skipped > 0) console.log(`  ⚠️  Skipping ${skipped} rows with unknown event_id (import Events first)`);
  if (!valid.length) return;

  await upsert('Events_Dish', valid.map(r => ({
    id: mapId(r.id),
    dish_id: r.dish_id ? mapId(r.dish_id) : null,
    event_id: mapId(r.event_id),
    category_id: r.category_id ? mapId(r.category_id) : null,
    planned_qty: safeNum(r.planned_qty) ?? 0,
    planned_cost: safeNum(r.planned_cost) ?? 0,
    dish_name: r.dish_name || null,
    unit: r.unit || null,
    stage_id: r.stage_id ? mapId(r.stage_id) : null,
    created_date: safeDate(r.created_date),
    updated_date: safeDate(r.updated_date),
  })));
}

// ─── Save ID map ──────────────────────────────────────────────────────────────
function saveIdMap() {
  const mapPath = path.join(__dirname, 'id_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(idMap, null, 2), 'utf-8');
  console.log(`\n💾 id_map.json saved (${Object.keys(idMap).length} entries)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Base44 → Supabase migration\n');

  // Lookup tables first (no FK deps)
  await importIngredientCategories();
  await importSupplierCategories();
  await importCategories();
  await importSubCategories();
  await importDepartments();

  // Core entities
  await importSuppliers();
  await importIngredients();
  await importIngredientPriceHistory();
  await importSpecialIngredients();
  await importDishes();

  // HR / Tasks
  await importEmployeeRoles();
  await importTaskEmployees();
  await importTaskTemplates();
  await importTaskAssignments();

  // Junction table (needs Events — skip unknown)
  await importEventsDish();

  saveIdMap();
  console.log('\n✨ Done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
