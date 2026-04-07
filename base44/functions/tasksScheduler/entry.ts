import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Task scheduler: handles WhatsApp reminders and escalations for all events.
// Each task is processed separately based on its event_id.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentTime = new Date();
    let tasksChecked = 0;
    let messagesSent = 0;

    console.log(`🕐 Scheduler started at ${currentTime.toISOString()}`);

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
    if (!fromNumber.startsWith("whatsapp:")) {
      fromNumber = "whatsapp:" + fromNumber;
    }
    const contentSid = Deno.env.get("TWILIO_CONTENT_SID");

    if (!accountSid || !authToken) {
      console.error("❌ Twilio credentials not configured");
      return Response.json({ error: "Twilio credentials not configured" }, { status: 500 });
    }

    // ── BATCH LOAD ──
    const results = await Promise.all([
      base44.asServiceRole.entities.TaskAssignment.filter({ status: 'PENDING' }, '-start_time', 500),
      base44.asServiceRole.entities.TaskAssignment.filter({ status: 'OVERDUE' }, '-start_time', 200),
      base44.asServiceRole.entities.TaskEmployee.filter({}),
      base44.asServiceRole.entities.Event.filter({})
    ]);

    // Ensure arrays — the API may return a single object or null when there are 0-1 results
    const pendingTasks = Array.isArray(results[0]) ? results[0] : (results[0] ? [results[0]] : []);
    const overdueTasks = Array.isArray(results[1]) ? results[1] : (results[1] ? [results[1]] : []);
    const allEmployees = Array.isArray(results[2]) ? results[2] : (results[2] ? [results[2]] : []);
    const allEvents    = Array.isArray(results[3]) ? results[3] : (results[3] ? [results[3]] : []);

    // Merge: pending + overdue (without already-escalated), exclude NOT_ARRIVING
    const tasks = [
      ...pendingTasks,
      ...overdueTasks.filter(t => !t.escalation_sent_at)
    ].filter(t => t.status !== 'NOT_ARRIVING');

    // Build lookup maps
    const employeeById = Object.fromEntries(allEmployees.map(e => [e.id, e]));
    const eventById    = Object.fromEntries(allEvents.map(e => [e.id, e]));

    console.log(`📋 Found ${tasks.length} active tasks | ${allEmployees.length} employees | ${allEvents.length} events`);

    const pendingUpdates = [];

    for (const task of tasks) {
      tasksChecked++;

      if (!task.assigned_to_id || task.assigned_to_id.trim() === '') continue;

      const employee = employeeById[task.assigned_to_id];
      if (!employee || !employee.phone_e164) {
        console.log(`⚠️ Task ${task.id}: Employee ${task.assigned_to_id} has no phone`);
        continue;
      }

      const phoneE164 = normalizePhone(employee.phone_e164);
      const startTime = task.start_time ? new Date(task.start_time) : null;
      const endTime   = task.end_time   ? new Date(task.end_time)   : null;
      const reminderMinutes = task.reminder_before_start_minutes || 10;

      // A) ⏰ Start Reminder
      if (startTime && !task.last_notification_start_sent_at) {
        const reminderTime = new Date(startTime.getTime() - reminderMinutes * 60 * 1000);

        if (currentTime >= reminderTime && (!endTime || currentTime < endTime)) {
          const templateData = buildTemplateData(task, eventById);

          const result = await sendWhatsappTemplate(accountSid, authToken, fromNumber, phoneE164, contentSid, templateData);
          if (result.success) {
            messagesSent++;
            console.log(`📤 Start reminder sent for task ${task.id} to ${phoneE164}`);
          } else {
            console.error(`❌ Failed to send start reminder for task ${task.id}: ${result.error}`);
          }

          // For EVENT tasks: notify additional employees (they share one TaskAssignment)
          if (task.event_id && task.additional_employees?.length > 0) {
            for (const addEmp of task.additional_employees) {
              if (!addEmp.employee_phone) continue;
              const addPhone = normalizePhone(addEmp.employee_phone);
              const addTemplateData = { ...templateData, employee_name: addEmp.employee_name || '-' };
              const addResult = await sendWhatsappTemplate(accountSid, authToken, fromNumber, addPhone, contentSid, addTemplateData);
              if (addResult.success) {
                messagesSent++;
                console.log(`📤 Start reminder sent for task ${task.id} to additional employee ${addPhone}`);
              }
            }
          }

          pendingUpdates.push(
            base44.asServiceRole.entities.TaskAssignment.update(task.id, {
              last_notification_start_sent_at: currentTime.toISOString()
            })
          );
        }
      }

      // B) ⚠️ OVERDUE + Escalation (only for event tasks, skip recurring)
      if (task.event_id && endTime && currentTime >= endTime &&
          task.status !== 'DONE' && task.status !== 'NOT_DONE' && task.status !== 'NOT_ARRIVING' &&
          !task.escalation_sent_at) {

        console.log(`⚠️ Task ${task.id} (event #${task.event_id || 'recurring'}) marked OVERDUE`);

        if (task.escalation_employee_phone) {
          const escalationContentSid = "HX65d2161eeee74063f64295eb7e926c19";
          const escPhone = normalizePhone(task.escalation_employee_phone);
          const escTemplateData = buildEscalationTemplateData(task, employee, eventById);
          const escResult = await sendEscalationTemplate(accountSid, authToken, fromNumber, escPhone, escalationContentSid, escTemplateData);
          if (escResult.success) {
            messagesSent++;
            console.log(`📤 OVERDUE escalation sent to ${task.escalation_employee_name} (${task.escalation_employee_phone}) for task ${task.id}`);
          } else {
            console.error(`❌ Failed escalation for task ${task.id}: ${escResult.error}`);
          }
        } else {
          console.log(`⚠️ Task ${task.id}: No escalation employee configured, skipping escalation`);
        }

        pendingUpdates.push(
          base44.asServiceRole.entities.TaskAssignment.update(task.id, {
            status: 'OVERDUE',
            escalation_sent_at: currentTime.toISOString()
          })
        );
      }
    }

    // Flush all DB writes in parallel
    if (pendingUpdates.length > 0) {
      await Promise.all(pendingUpdates);
      console.log(`💾 Flushed ${pendingUpdates.length} DB update(s)`);
    }

    console.log(`✅ Scheduler completed: checked ${tasksChecked} tasks, sent ${messagesSent} messages`);

    return Response.json({
      tasks_checked: tasksChecked,
      messages_sent: messagesSent,
      completed_at: currentTime.toISOString()
    });

  } catch (error) {
    console.error("❌ tasksScheduler error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith("0")) p = "+972" + p.substring(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

function buildEscalationTemplateData(task, employee, eventById) {
  const eventName = task.event_id ? (task.event_name || eventById?.[task.event_id]?.event_name || '-') : 'משימה שוטפת';
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
    time_range: `${startStr}-${endStr}`
  };
}

function buildTemplateData(task, eventById) {
  let eventName = task.event_name || "-";
  if (task.event_id && !task.event_name) {
    const event = eventById[task.event_id];
    if (event) eventName = event.event_name || event.name || "-";
  }

  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' };
  const startStr = task.start_time
    ? new Date(task.start_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';
  const endStr = task.end_time
    ? new Date(task.end_time).toLocaleTimeString('he-IL', timeOpts)
    : '--:--';

  return {
    task_title:    task.task_title || 'משימה',
    event_name:    eventName,
    start_time:    startStr,
    end_time:      endStr,
    task_id:       task.id || '-',
    employee_name: task.assigned_to_name || '-'
  };
}

async function sendWhatsappTemplate(accountSid, authToken, fromNumber, toPhone, contentSid, templateData) {
  try {
    const toWhatsapp = toPhone.startsWith("whatsapp:") ? toPhone : "whatsapp:" + toPhone;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const contentVariables = JSON.stringify({
      "1": templateData.task_title,
      "2": templateData.event_name,
      "3": templateData.start_time,
      "4": templateData.end_time,
      "5": templateData.task_id,
      "6": templateData.employee_name
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);

    if (contentSid) {
      formData.append("ContentSid", contentSid);
      formData.append("ContentVariables", contentVariables);
    } else {
      formData.append("Body", `📋 משימה: ${templateData.task_title}\n🎉 אירוע: ${templateData.event_name}\n⏰ חלון: ${templateData.start_time}-${templateData.end_time}\n📱 השב: ✅ בוצע / ❌ לא בוצע`);
    }

    const authHeader = btoa(`${accountSid}:${authToken}`);
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, sid: result.sid };
    } else {
      const result = await response.json();
      return { success: false, error: result.message || result.error_message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendEscalationTemplate(accountSid, authToken, fromNumber, toPhone, escalationContentSid, templateData) {
  try {
    const toWhatsapp = toPhone.startsWith("whatsapp:") ? toPhone : "whatsapp:" + toPhone;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const contentVariables = JSON.stringify({
      "1": templateData.employee_name,
      "2": templateData.task_title,
      "3": templateData.event_name,
      "4": templateData.time_range
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", escalationContentSid);
    formData.append("ContentVariables", contentVariables);

    const authHeader = btoa(`${accountSid}:${authToken}`);
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, sid: result.sid };
    } else {
      const result = await response.json();
      return { success: false, error: result.message || result.error_message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}