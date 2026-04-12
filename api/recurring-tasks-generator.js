import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS_AHEAD = 30;
const BULK_CREATE_BATCH_SIZE = 50;

/**
 * GET/POST /api/recurring-tasks-generator
 * Ensures recurring TaskAssignment instances always exist for the next 30 days.
 * Mirrors the Base44 recurringTasksGenerator logic using Supabase only.
 */
export default async function handler(req, res) {
  try {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);
    let totalCreated = 0;

    console.log(`Started recurring generator at ${now.toISOString()}, cutoff ${cutoffDate.toISOString()}`);

    const [allAssignments, allTemplates] = await Promise.all([
      fetchAllRecurring(),
      fetchActiveTemplates(),
    ]);

    console.log(`Fetched ${allAssignments.length} recurring assignments`);

    if (allAssignments.length === 0) {
      return res.status(200).json({ message: 'No recurring assignments', created: 0 });
    }

    const seriesMap = {};
    for (const a of allAssignments) {
      const key = `${a.task_template_id}__${a.assigned_to_id}`;
      if (!seriesMap[key]) seriesMap[key] = [];
      seriesMap[key].push(a);
    }

    // Keep only the latest owner per template to match existing behavior.
    const templateOwner = {};
    for (const a of allAssignments) {
      const tid = a.task_template_id;
      const created = new Date(a.created_date || a.created_at || a.start_time);
      if (!templateOwner[tid] || created > templateOwner[tid].latest) {
        templateOwner[tid] = { assigned_to_id: a.assigned_to_id, latest: created };
      }
    }

    for (const key of Object.keys(seriesMap)) {
      const [tid, empId] = key.split('__');
      if (templateOwner[tid] && templateOwner[tid].assigned_to_id !== empId) {
        console.log(
          `Skipping stale series: template ${tid} for employee ${empId} (owned by ${templateOwner[tid].assigned_to_id})`
        );
        delete seriesMap[key];
      }
    }

    console.log(`Found ${Object.keys(seriesMap).length} recurring series after dedup`);

    const templateById = Object.fromEntries((allTemplates || []).map((t) => [t.id, t]));
    const allNewAssignments = [];

    for (const assignments of Object.values(seriesMap)) {
      assignments.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      const latest = assignments[0];
      const latestDate = new Date(latest.start_time);

      if (latestDate >= cutoffDate) continue;

      const template = templateById[latest.task_template_id];
      const recurrenceType = latest.recurrence_type;
      const recurrenceTime = latest.recurrence_time || '09:00';
      const recurrenceDays = latest.recurrence_days || [];
      const recurrenceDayOfMonth = latest.recurrence_day_of_month || 1;
      const durationMinutes = template?.duration_minutes || 60;

      const existingDates = new Set(
        assignments.map((a) => new Date(a.start_time).toISOString().split('T')[0])
      );

      const [hours, minutes] = recurrenceTime.split(':').map(Number);
      const startFrom = new Date(latestDate);
      startFrom.setDate(startFrom.getDate() + 1);

      if (recurrenceType === 'daily') {
        const current = new Date(startFrom);
        while (current <= cutoffDate) {
          // Keep existing behavior: skip Friday/Saturday.
          if (current.getDay() !== 5 && current.getDay() !== 6) {
            const dateStr = current.toISOString().split('T')[0];
            if (!existingDates.has(dateStr)) {
              const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes);
              const end = new Date(start.getTime() + durationMinutes * 60000);
              allNewAssignments.push(buildAssignment(latest, start, end));
            }
          }
          current.setDate(current.getDate() + 1);
        }
      } else if (recurrenceType === 'weekly') {
        if (recurrenceDays.length === 0) continue;

        const current = new Date(startFrom);
        while (current <= cutoffDate) {
          if (recurrenceDays.includes(current.getDay())) {
            const dateStr = current.toISOString().split('T')[0];
            if (!existingDates.has(dateStr)) {
              const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes);
              const end = new Date(start.getTime() + durationMinutes * 60000);
              allNewAssignments.push(buildAssignment(latest, start, end));
            }
          }
          current.setDate(current.getDate() + 1);
        }
      } else if (recurrenceType === 'monthly') {
        const current = new Date(startFrom);
        while (current <= cutoffDate) {
          const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
          const targetDay = Math.min(recurrenceDayOfMonth, lastDay);
          if (current.getDate() === targetDay) {
            const dateStr = current.toISOString().split('T')[0];
            if (!existingDates.has(dateStr)) {
              const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes);
              const end = new Date(start.getTime() + durationMinutes * 60000);
              allNewAssignments.push(buildAssignment(latest, start, end));
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    if (allNewAssignments.length > 0) {
      const batches = [];
      for (let i = 0; i < allNewAssignments.length; i += BULK_CREATE_BATCH_SIZE) {
        batches.push(allNewAssignments.slice(i, i + BULK_CREATE_BATCH_SIZE));
      }

      console.log(`Creating ${allNewAssignments.length} assignments in ${batches.length} batches`);

      // Run in groups of 3 batches to avoid overwhelming the API.
      for (let i = 0; i < batches.length; i += 3) {
        const group = batches.slice(i, i + 3);
        const results = await Promise.all(group.map((batch) => insertAssignments(batch)));
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }

      totalCreated = allNewAssignments.length;
    }

    console.log(`Recurring generation completed. Created ${totalCreated} assignments.`);

    return res.status(200).json({
      message: 'Recurring tasks generation completed',
      total_created: totalCreated,
      completed_at: now.toISOString(),
    });
  } catch (error) {
    console.error('recurring-tasks-generator error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function fetchAllRecurring() {
  const results = [];
  let skip = 0;
  const pageSize = 200;

  while (true) {
    const { data, error } = await supabase
      .from('TaskAssignment')
      .select('*')
      .is('event_id', null)
      .not('recurrence_type', 'is', null)
      .neq('recurrence_type', 'once')
      .order('start_time', { ascending: false })
      .range(skip, skip + pageSize - 1);

    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    if (page.length === 0) break;

    results.push(...page);

    if (page.length < pageSize) break;
    skip += pageSize;
  }

  return results;
}

async function fetchActiveTemplates() {
  const { data, error } = await supabase
    .from('TaskTemplate')
    .select('id, duration_minutes, is_active')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

async function insertAssignments(batch) {
  const { error } = await supabase.from('TaskAssignment').insert(batch);
  return { error };
}

function buildAssignment(reference, startDateTime, endDateTime) {
  return {
    task_template_id: emptyToNull(reference.task_template_id),
    task_title: reference.task_title,
    task_description: reference.task_description,
    event_id: null,
    event_name: null,
    assigned_to_id: emptyToNull(reference.assigned_to_id),
    assigned_to_name: reference.assigned_to_name,
    assigned_to_phone: reference.assigned_to_phone,
    additional_employees: reference.additional_employees || [],
    computed_start_time: startDateTime.toISOString(),
    computed_end_time: endDateTime.toISOString(),
    start_time: startDateTime.toISOString(),
    end_time: endDateTime.toISOString(),
    status: 'PENDING',
    reminder_before_start_minutes: reference.reminder_before_start_minutes,
    reminder_before_end_minutes: reference.reminder_before_end_minutes,
    escalate_to_manager: reference.escalate_to_manager,
    manager_id: emptyToNull(reference.manager_id),
    manager_name: reference.manager_name,
    manager_phone: reference.manager_phone || '',
    escalation_role_id: emptyToNull(reference.escalation_role_id),
    escalation_role_name: reference.escalation_role_name || '',
    escalation_employee_id: emptyToNull(reference.escalation_employee_id),
    escalation_employee_name: reference.escalation_employee_name || '',
    escalation_employee_phone: reference.escalation_employee_phone || '',
    recurrence_type: reference.recurrence_type,
    recurrence_days: reference.recurrence_days || [],
    recurrence_day_of_month: reference.recurrence_day_of_month,
    recurrence_time: reference.recurrence_time,
    manually_overridden: false,
  };
}

function emptyToNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}
