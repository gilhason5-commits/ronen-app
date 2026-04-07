import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// This function runs daily to ensure recurring tasks always have
// future TaskAssignment instances. It looks at existing recurring
// assignments, finds the latest one per template+employee, and
// generates new instances to maintain a rolling 30-day window.

const DAYS_AHEAD = 30;
const BULK_CREATE_BATCH_SIZE = 50; // Max records per bulkCreate call

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);
    let totalCreated = 0;

    console.log(`🔄 Started at ${now.toISOString()}, cutoff ${cutoffDate.toISOString()}`);

    // Fetch only recurring assignments (not event-based) and active templates
    const [allAssignments, allTemplates] = await Promise.all([
      fetchAllRecurring(base44),
      base44.asServiceRole.entities.TaskTemplate.filter({ is_active: true })
    ]);

    console.log(`📋 Fetched ${allAssignments.length} recurring assignments`);

    if (allAssignments.length === 0) {
      return Response.json({ message: 'No recurring assignments', created: 0 });
    }

    // Group by template_id + assigned_to_id (unique recurring "series")
    const seriesMap = {};
    for (const a of allAssignments) {
      const key = `${a.task_template_id}__${a.assigned_to_id}`;
      if (!seriesMap[key]) seriesMap[key] = [];
      seriesMap[key].push(a);
    }

    // Dedup: if same template is assigned to multiple employees, keep only the latest series
    const templateOwner = {}; // template_id -> { assigned_to_id, latest_created_date }
    for (const a of allAssignments) {
      const tid = a.task_template_id;
      const created = new Date(a.created_date || a.start_time);
      if (!templateOwner[tid] || created > templateOwner[tid].latest) {
        templateOwner[tid] = { assigned_to_id: a.assigned_to_id, latest: created };
      }
    }

    // Remove series that are NOT the latest owner for their template
    for (const key of Object.keys(seriesMap)) {
      const [tid, empId] = key.split('__');
      if (templateOwner[tid] && templateOwner[tid].assigned_to_id !== empId) {
        console.log(`⚠️ Skipping stale series: template ${tid} for employee ${empId} (owned by ${templateOwner[tid].assigned_to_id})`);
        delete seriesMap[key];
      }
    }

    console.log(`📋 Found ${Object.keys(seriesMap).length} recurring series (after dedup)`);

    const templateById = Object.fromEntries(allTemplates.map(t => [t.id, t]));

    // Collect all new assignments across all series first, then bulk create
    const allNewAssignments = [];

    for (const [key, assignments] of Object.entries(seriesMap)) {
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
        assignments.map(a => new Date(a.start_time).toISOString().split('T')[0])
      );

      const [hours, minutes] = recurrenceTime.split(':').map(Number);
      const startFrom = new Date(latestDate);
      startFrom.setDate(startFrom.getDate() + 1);

      let count = 0;

      if (recurrenceType === 'daily') {
        const current = new Date(startFrom);
        while (current <= cutoffDate) {
          if (current.getDay() !== 5 && current.getDay() !== 6) {
            const dateStr = current.toISOString().split('T')[0];
            if (!existingDates.has(dateStr)) {
              const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hours, minutes);
              const end = new Date(start.getTime() + durationMinutes * 60000);
              allNewAssignments.push(buildAssignment(latest, start, end));
              count++;
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
              count++;
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
              count++;
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }

      if (count > 0) {
        console.log(`  ➕ ${count} new for "${latest.task_title}" → ${latest.assigned_to_name}`);
      }
    }

    // Bulk create in batches, with parallel execution per batch
    if (allNewAssignments.length > 0) {
      const batches = [];
      for (let i = 0; i < allNewAssignments.length; i += BULK_CREATE_BATCH_SIZE) {
        batches.push(allNewAssignments.slice(i, i + BULK_CREATE_BATCH_SIZE));
      }

      console.log(`💾 Creating ${allNewAssignments.length} assignments in ${batches.length} batches`);

      // Run batches in groups of 3 to avoid overwhelming the API
      for (let i = 0; i < batches.length; i += 3) {
        const group = batches.slice(i, i + 3);
        await Promise.all(
          group.map(batch => base44.asServiceRole.entities.TaskAssignment.bulkCreate(batch))
        );
      }

      totalCreated = allNewAssignments.length;
    }

    console.log(`🎉 Done. Created ${totalCreated} assignments.`);

    return Response.json({
      message: 'Recurring tasks generation completed',
      total_created: totalCreated,
      completed_at: now.toISOString()
    });

  } catch (error) {
    console.error("❌ recurringTasksGenerator error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Paginated fetch: only recurring (non-event) assignments
async function fetchAllRecurring(base44) {
  const results = [];
  let skip = 0;
  const pageSize = 200;

  while (true) {
    const raw = await base44.asServiceRole.entities.TaskAssignment.filter(
      {}, '-start_time', pageSize, skip
    );
    const page = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    if (page.length === 0) break;

    for (const a of page) {
      if (!a.event_id && a.recurrence_type && a.recurrence_type !== 'once') {
        results.push(a);
      }
    }

    if (page.length < pageSize) break;
    skip += pageSize;
  }

  return results;
}

function buildAssignment(reference, startDateTime, endDateTime) {
  return {
    task_template_id: reference.task_template_id,
    task_title: reference.task_title,
    task_description: reference.task_description,
    event_id: null,
    event_name: null,
    assigned_to_id: reference.assigned_to_id,
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
    manager_id: reference.manager_id,
    manager_name: reference.manager_name,
    manager_phone: reference.manager_phone || '',
    escalation_role_id: reference.escalation_role_id || '',
    escalation_role_name: reference.escalation_role_name || '',
    escalation_employee_id: reference.escalation_employee_id || '',
    escalation_employee_name: reference.escalation_employee_name || '',
    escalation_employee_phone: reference.escalation_employee_phone || '',
    recurrence_type: reference.recurrence_type,
    recurrence_days: reference.recurrence_days || [],
    recurrence_day_of_month: reference.recurrence_day_of_month,
    recurrence_time: reference.recurrence_time,
    manually_overridden: false
  };
}