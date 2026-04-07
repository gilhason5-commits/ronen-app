import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// This scheduler checks which employees have recurring tasks today
// and sends them a WhatsApp availability confirmation message.
// Similar to dailyAvailabilityScheduler but for recurring tasks.

const RECURRING_AVAIL_CONTENT_SID = "HXa4a3a47785b4416b68b117f2b833fdfc";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const currentTime = new Date();
    let messagesSent = 0;
    let recordsCreated = 0;

    console.log(`🕐 RecurringAvailabilityScheduler started at ${currentTime.toISOString()}`);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
    if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;

    if (!accountSid || !authToken) {
      console.error("❌ Twilio credentials not configured");
      return Response.json({ error: "Twilio credentials not configured" }, { status: 500 });
    }

    // Determine target date (Israel timezone)
    let targetDate;
    try {
      const body = await req.clone().json();
      targetDate = body.target_date || null;
    } catch { targetDate = null; }

    if (!targetDate) {
      const israelNow = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const y = israelNow.getFullYear();
      const m = String(israelNow.getMonth() + 1).padStart(2, '0');
      const d = String(israelNow.getDate()).padStart(2, '0');
      targetDate = `${y}-${m}-${d}`;
    }

    console.log(`📅 Target date: ${targetDate}`);

    // Build start/end of target day to filter tasks
    const dayStart = new Date(targetDate + 'T00:00:00');
    const dayEnd = new Date(targetDate + 'T23:59:59');

    // Load data
    const [allTasks, allEmployees, existingAvailability] = await Promise.all([
      base44.asServiceRole.entities.TaskAssignment.filter({ status: 'PENDING' }, '-start_time', 1000),
      base44.asServiceRole.entities.TaskEmployee.filter({}),
      base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ event_date: targetDate }),
    ]);

    // Filter to only recurring tasks (no event_id) scheduled for today
    const todayRecurringTasks = allTasks.filter(t => {
      if (t.event_id) return false; // skip event tasks
      if (!t.start_time) return false;
      const taskDate = new Date(t.start_time);
      return taskDate >= dayStart && taskDate <= dayEnd;
    });

    console.log(`📋 Found ${todayRecurringTasks.length} recurring tasks for today`);

    if (todayRecurringTasks.length === 0) {
      return Response.json({ message: "No recurring tasks for today", date: targetDate });
    }

    // Get unique employee IDs with recurring tasks today
    const employeeTaskMap = {};
    for (const task of todayRecurringTasks) {
      if (!task.assigned_to_id) continue;
      if (!employeeTaskMap[task.assigned_to_id]) {
        employeeTaskMap[task.assigned_to_id] = [];
      }
      employeeTaskMap[task.assigned_to_id].push(task);
    }

    const employeeById = Object.fromEntries(allEmployees.map(e => [e.id, e]));
    
    // Use "recurring" as event_id marker for recurring availability
    const RECURRING_MARKER = "recurring";
    const existingKey = new Set(existingAvailability.map(a => `${a.employee_id}_${a.event_id}`));

    const pendingCreates = [];
    const pendingMessages = [];

    for (const [empId, tasks] of Object.entries(employeeTaskMap)) {
      const key = `${empId}_${RECURRING_MARKER}`;
      if (existingKey.has(key)) {
        console.log(`ℹ️ Employee ${empId} already has recurring availability record for today, skipping`);
        continue;
      }

      const employee = employeeById[empId];
      if (!employee || !employee.phone_e164) {
        console.log(`⚠️ Employee ${empId}: no phone, skipping`);
        continue;
      }

      const record = {
        employee_id: empId,
        employee_name: employee.full_name,
        employee_phone: employee.phone_e164,
        event_id: RECURRING_MARKER,
        event_name: "משימות שוטפות",
        event_date: targetDate,
        source_type: "recurring",
        confirmation_status: 'PENDING',
        confirmation_sent_at: currentTime.toISOString(),
        manager_id: employee.manager_id || '',
        manager_name: employee.manager_name || '',
        manager_phone: '',
      };

      if (employee.manager_id) {
        const manager = employeeById[employee.manager_id];
        if (manager) record.manager_phone = manager.phone_e164 || '';
      }

      pendingCreates.push(record);
      existingKey.add(key);

      pendingMessages.push({
        phone: normalizePhone(employee.phone_e164),
        record,
      });
    }

    // Bulk create
    if (pendingCreates.length > 0) {
      const created = await base44.asServiceRole.entities.EmployeeDailyAvailability.bulkCreate(pendingCreates);
      recordsCreated = created.length;
      console.log(`💾 Created ${recordsCreated} recurring availability records`);

      const createdMap = {};
      for (const c of created) {
        createdMap[c.employee_id] = c.id;
      }

      // Send WhatsApp messages
      for (const msg of pendingMessages) {
        const recordId = createdMap[msg.record.employee_id] || '';
        const eventDateFormatted = formatHebrewDate(msg.record.event_date);

        const contentVariables = JSON.stringify({
          "1": msg.record.employee_name,
          "2": eventDateFormatted,
          "3": recordId,
        });

        const result = await sendTwilioMessage(accountSid, authToken, fromNumber, msg.phone, RECURRING_AVAIL_CONTENT_SID, contentVariables);
        if (result.success) {
          messagesSent++;
          console.log(`📤 Recurring availability message sent to ${msg.record.employee_name} (${msg.phone})`);
        } else {
          console.error(`❌ Failed to send to ${msg.phone}: ${result.error}`);
        }
      }
    }

    console.log(`✅ Completed: ${recordsCreated} records created, ${messagesSent} messages sent`);

    return Response.json({
      date: targetDate,
      records_created: recordsCreated,
      messages_sent: messagesSent,
      completed_at: currentTime.toISOString()
    });

  } catch (error) {
    console.error("❌ recurringAvailabilityScheduler error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith("0")) p = "+972" + p.substring(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

function formatHebrewDate(dateStr) {
  const months = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function sendTwilioMessage(accountSid, authToken, fromNumber, toPhone, contentSid, contentVariables) {
  try {
    const toWhatsapp = toPhone.startsWith("whatsapp:") ? toPhone : "whatsapp:" + toPhone;
    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", contentSid);
    formData.append("ContentVariables", contentVariables);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(accountSid + ":" + authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (response.ok) {
      return { success: true };
    } else {
      const err = await response.json();
      return { success: false, error: err.message || err.error_message };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}