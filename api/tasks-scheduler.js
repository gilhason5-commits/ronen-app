import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET/POST /api/tasks-scheduler  (Vercel Cron: every 5 minutes)
 * Port of base44/functions/tasksScheduler without Base44 SDK.
 * Handles task reminders and overdue escalations.
 */
export default async function handler(req, res) {
  try {
    const currentTime = new Date();
    let tasksChecked = 0;
    let messagesSent = 0;

    console.log(`Scheduler started at ${currentTime.toISOString()}`);

    const [pendingTasks, overdueTasks, allEmployees, allEvents] = await Promise.all([
      fetchTasksByStatus('PENDING', 500),
      fetchTasksByStatus('OVERDUE', 200),
      fetchEmployees(),
      fetchEvents(),
    ]);

    const tasks = [
      ...pendingTasks,
      ...overdueTasks.filter((t) => !t.escalation_sent_at),
    ].filter((t) => t.status !== 'NOT_ARRIVING');

    const employeeById = Object.fromEntries(allEmployees.map((e) => [e.id, e]));
    const eventById = Object.fromEntries(allEvents.map((e) => [e.id, e]));

    console.log(`Found ${tasks.length} active tasks | ${allEmployees.length} employees | ${allEvents.length} events`);

    const pendingUpdates = [];

    for (const task of tasks) {
      tasksChecked++;

      if (!task.assigned_to_id || String(task.assigned_to_id).trim() === '') continue;

      const employee = employeeById[task.assigned_to_id];
      if (!employee || !employee.phone_e164) {
        console.log(`Task ${task.id}: Employee ${task.assigned_to_id} has no phone`);
        continue;
      }

      const phoneE164 = normalizePhone(employee.phone_e164);
      const startTime = task.start_time ? new Date(task.start_time) : null;
      const endTime = task.end_time ? new Date(task.end_time) : null;
      const reminderMinutes = task.reminder_before_start_minutes || 10;

      // A) Start reminder
      if (startTime && !task.last_notification_start_sent_at) {
        const reminderTime = new Date(startTime.getTime() - reminderMinutes * 60 * 1000);

        if (currentTime >= reminderTime && (!endTime || currentTime < endTime)) {
          const templateData = buildTemplateData(task, eventById);

          const sent = await sendTaskReminder(phoneE164, templateData);
          if (sent) {
            messagesSent++;
            console.log(`Start reminder sent for task ${task.id} to ${phoneE164}`);
          }

          // For event tasks, notify additional employees on the same assignment.
          if (task.event_id && Array.isArray(task.additional_employees) && task.additional_employees.length > 0) {
            for (const addEmp of task.additional_employees) {
              if (!addEmp?.employee_phone) continue;

              const addPhone = normalizePhone(addEmp.employee_phone);
              const addTemplateData = { ...templateData, employee_name: addEmp.employee_name || '-' };
              const addSent = await sendTaskReminder(addPhone, addTemplateData);
              if (addSent) {
                messagesSent++;
                console.log(`Start reminder sent for task ${task.id} to additional employee ${addPhone}`);
              }
            }
          }

          pendingUpdates.push(
            updateTask(task.id, { last_notification_start_sent_at: currentTime.toISOString() })
          );
        }
      }

      // B) OVERDUE + escalation (event tasks only; recurring tasks are excluded).
      if (
        task.event_id &&
        endTime &&
        currentTime >= endTime &&
        task.status !== 'DONE' &&
        task.status !== 'NOT_DONE' &&
        task.status !== 'NOT_ARRIVING' &&
        !task.escalation_sent_at
      ) {
        console.log(`Task ${task.id} (event #${task.event_id || 'recurring'}) marked OVERDUE`);

        if (task.escalation_employee_phone) {
          const escPhone = normalizePhone(task.escalation_employee_phone);
          const escTemplateData = buildEscalationTemplateData(task, employee, eventById);
          const escSent = await sendTaskEscalation(escPhone, escTemplateData);
          if (escSent) {
            messagesSent++;
            console.log(
              `OVERDUE escalation sent to ${task.escalation_employee_name || '-'} (${task.escalation_employee_phone}) for task ${task.id}`
            );
          }
        } else {
          console.log(`Task ${task.id}: No escalation employee configured, skipping escalation`);
        }

        pendingUpdates.push(
          updateTask(task.id, {
            status: 'OVERDUE',
            escalation_sent_at: currentTime.toISOString(),
          })
        );
      }
    }

    if (pendingUpdates.length > 0) {
      const settled = await Promise.allSettled(pendingUpdates);
      const failures = settled.filter((s) => s.status === 'rejected');
      if (failures.length > 0) {
        console.error(`Failed ${failures.length} scheduler update(s)`);
      }
      console.log(`Flushed ${pendingUpdates.length} DB update(s)`);
    }

    console.log(`Scheduler completed: checked ${tasksChecked} tasks, sent ${messagesSent} messages`);

    return res.status(200).json({
      tasks_checked: tasksChecked,
      messages_sent: messagesSent,
      completed_at: currentTime.toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function fetchTasksByStatus(status, limit) {
  const { data, error } = await supabase
    .from('TaskAssignment')
    .select('*')
    .eq('status', status)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function fetchEmployees() {
  const { data, error } = await supabase
    .from('TaskEmployee')
    .select('id, full_name, phone_e164');

  if (error) throw error;
  return data || [];
}

async function fetchEvents() {
  const { data, error } = await supabase
    .from('Event')
    .select('id, event_name');

  if (error) throw error;
  return data || [];
}

async function updateTask(taskId, patch) {
  const { error } = await supabase
    .from('TaskAssignment')
    .update(patch)
    .eq('id', taskId);

  if (error) throw error;
}

async function sendTaskReminder(phone, templateData) {
  try {
    await sendWhatsApp(phone, TEMPLATES.TASK_REMINDER, {
      '1': templateData.task_title,
      '2': templateData.event_name,
      '3': templateData.start_time,
      '4': templateData.end_time,
      '5': templateData.task_id,
      '6': templateData.employee_name,
    });
    return true;
  } catch (error) {
    console.error(`Failed reminder send to ${phone}: ${error.message}`);
    return false;
  }
}

async function sendTaskEscalation(phone, templateData) {
  try {
    await sendWhatsApp(phone, TEMPLATES.TASK_ESCALATION, {
      '1': templateData.employee_name,
      '2': templateData.task_title,
      '3': templateData.event_name,
      '4': templateData.time_range,
    });
    return true;
  } catch (error) {
    console.error(`Failed escalation send to ${phone}: ${error.message}`);
    return false;
  }
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d+]/g, '');
  if (p.startsWith('0')) p = `+972${p.substring(1)}`;
  if (!p.startsWith('+')) p = `+${p}`;
  return p;
}

function buildEscalationTemplateData(task, employee, eventById) {
  const eventName = task.event_id ? task.event_name || eventById?.[task.event_id]?.event_name || '-' : 'משימה שוטפת';
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' };
  const startStr = task.start_time
    ? new Date(task.start_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';
  const endStr = task.end_time
    ? new Date(task.end_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';
  return {
    employee_name: employee?.full_name || task.assigned_to_name || '-',
    task_title: task.task_title || 'משימה',
    event_name: eventName,
    time_range: `${startStr}-${endStr}`,
  };
}

function buildTemplateData(task, eventById) {
  let eventName = task.event_name || '-';
  if (task.event_id && !task.event_name) {
    const event = eventById[task.event_id];
    if (event) eventName = event.event_name || '-';
  }

  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' };
  const startStr = task.start_time
    ? new Date(task.start_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';
  const endStr = task.end_time
    ? new Date(task.end_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';

  return {
    task_title: task.task_title || 'משימה',
    event_name: eventName,
    start_time: startStr,
    end_time: endStr,
    task_id: task.id || '-',
    employee_name: task.assigned_to_name || '-',
  };
}
