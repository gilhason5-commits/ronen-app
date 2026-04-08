import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET/POST /api/tasks-scheduler  (Vercel Cron: every 5 minutes)
 * 1. Sends reminders for tasks starting soon (reminder_before_start_minutes)
 * 2. Marks overdue tasks and escalates
 */
export default async function handler(req, res) {
  try {
    const now = new Date();
    const results = { reminders: 0, escalations: 0, overdue: 0 };

    // ── 1. Task reminders (start time approaching or just passed) ────
    const in60min = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const ago30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: upcoming, error: upcomingError } = await supabase
      .from('TaskAssignment')
      .select('*')
      .eq('status', 'PENDING')
      .lte('start_time', in60min)
      .gte('start_time', ago30min)
      .is('reminder_sent_at', null);

    if (upcomingError) return res.status(500).json({ error: 'query failed', detail: upcomingError.message });
    results.debug = { count: upcoming?.length || 0, now: now.toISOString(), ago30min, in60min };

    for (const task of upcoming || []) {
      const template = await getTemplate(task.task_template_id);
      const minutesUntilStart = Math.round((new Date(task.start_time) - now) / 60000);
      const reminderWindow = template?.reminder_before_start_minutes || 10;

      // Send if within window (before or up to 30 min after start)
      if (minutesUntilStart > reminderWindow) continue;
      if (!task.assigned_to_phone && !task.assigned_to_id) continue;

      const phone = task.assigned_to_phone || await getEmployeePhone(task.assigned_to_id);
      if (!phone) continue;

      // Atomic claim: prevents duplicate reminders from concurrent scheduler runs.
      const claimTime = new Date().toISOString();
      const { data: claimedRows, error: claimError } = await supabase
        .from('TaskAssignment')
        .update({ reminder_sent_at: claimTime })
        .eq('id', task.id)
        .is('reminder_sent_at', null)
        .select('id');

      if (claimError) {
        if (!results.errors) results.errors = [];
        results.errors.push({ task: task.task_title, error: `claim failed: ${claimError.message}` });
        console.error(`Reminder claim failed for task ${task.id}:`, claimError.message);
        continue;
      }

      if (!claimedRows || claimedRows.length === 0) {
        // Already claimed/sent by another run.
        continue;
      }

      try {
        await sendWhatsApp(phone, TEMPLATES.TASK_REMINDER, {
          '1': task.assigned_to_name || '',
          '2': task.task_title || '',
          '3': formatTime(task.start_time),
          '4': formatTime(task.end_time),
        });

        results.reminders++;
      } catch (err) {
        // Release claim on failure so a later scheduler run can retry.
        await supabase
          .from('TaskAssignment')
          .update({ reminder_sent_at: null })
          .eq('id', task.id)
          .eq('reminder_sent_at', claimTime);

        if (!results.errors) results.errors = [];
        results.errors.push({ task: task.task_title, error: err.message });
        console.error(`Reminder failed for task ${task.id}:`, err.message);
      }
    }

    // ── 2. Mark overdue + escalate ───────────────────────────────────
    const { data: pastDue } = await supabase
      .from('TaskAssignment')
      .select('*')
      .in('status', ['PENDING', 'NOT_DONE'])
      .lt('end_time', now.toISOString())
      .is('escalation_sent_at', null);

    for (const task of pastDue || []) {
      // Mark overdue
      await supabase
        .from('TaskAssignment')
        .update({ status: 'OVERDUE' })
        .eq('id', task.id);

      results.overdue++;

      // Escalate if configured
      if (!task.escalate_to_manager) continue;

      const escalationPhone = task.escalation_employee_phone ||
        (task.escalation_employee_id ? await getEmployeePhone(task.escalation_employee_id) : null) ||
        (task.manager_id ? await getEmployeePhone(task.manager_id) : null);

      if (!escalationPhone) continue;

      try {
        await sendWhatsApp(escalationPhone, TEMPLATES.TASK_ESCALATION, {
          '1': task.escalation_employee_name || task.manager_name || '',
          '2': task.task_title || '',
          '3': task.assigned_to_name || '',
          '4': formatTime(task.end_time),
        });

        await supabase
          .from('TaskAssignment')
          .update({ escalation_sent_at: now.toISOString() })
          .eq('id', task.id);

        results.escalations++;
      } catch (err) {
        console.error(`Escalation failed for task ${task.id}:`, err.message);
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getTemplate(templateId) {
  if (!templateId) return null;
  const { data } = await supabase
    .from('TaskTemplate')
    .select('reminder_before_start_minutes, reminder_before_end_minutes')
    .eq('id', templateId)
    .single();
  return data;
}

async function getEmployeePhone(employeeId) {
  if (!employeeId) return null;
  const { data } = await supabase
    .from('TaskEmployee')
    .select('phone_e164')
    .eq('id', employeeId)
    .single();
  return data?.phone_e164 || null;
}

function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}
