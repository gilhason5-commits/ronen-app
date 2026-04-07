import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// This scheduler sends WhatsApp availability confirmation messages to employees
// assigned to upcoming events. It creates EmployeeDailyAvailability records
// and sends WhatsApp messages to each employee.
// Runs every 5 minutes. Checks AppSetting for the configured send hour.
// Only acts once per day, within the configured time window.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const currentTime = new Date();
    const israelNow = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentHourMin = `${String(israelNow.getHours()).padStart(2, '0')}:${String(israelNow.getMinutes()).padStart(2, '0')}`;

    // Get configured send hour from AppSetting
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'availability_send_hour' });
    const sendHour = settings.length > 0 ? settings[0].value : '11:00';

    // Check if we're within 5-minute window of the configured send time
    const [confH, confM] = sendHour.split(':').map(Number);
    const [nowH, nowM] = [israelNow.getHours(), israelNow.getMinutes()];
    const confMinutes = confH * 60 + confM;
    const nowMinutes = nowH * 60 + nowM;
    const diff = nowMinutes - confMinutes;

    if (diff < 0 || diff >= 5) {
      // Not time yet or already past window
      return Response.json({ skipped: true, reason: `Not in send window. Current: ${currentHourMin}, configured: ${sendHour}` });
    }

    console.log(`🕐 arriveToday triggered at ${currentHourMin} (configured: ${sendHour})`);

    let messagesSent = 0;
    let recordsCreated = 0;

    // Get Twilio credentials (same as tasksScheduler)
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
    if (!fromNumber.startsWith("whatsapp:")) {
      fromNumber = "whatsapp:" + fromNumber;
    }
    const contentSid = "HX62c0b5da0411f3fa4ce3e7db287321b8"; // arrive_to_event template

    if (!accountSid || !authToken) {
      console.error("❌ Twilio credentials not configured");
      return Response.json({ error: "Twilio credentials not configured" }, { status: 500 });
    }

    // Default: today in Israel timezone
    const y = israelNow.getFullYear();
    const m = String(israelNow.getMonth() + 1).padStart(2, '0');
    const d = String(israelNow.getDate()).padStart(2, '0');
    const targetDate = `${y}-${m}-${d}`;

    console.log(`📅 Target date: ${targetDate}`);

    // Batch load all relevant data
    const [allEvents, allAssignments, allEmployees, existingAvailability] = await Promise.all([
      base44.asServiceRole.entities.Event.filter({ event_date: targetDate }),
      base44.asServiceRole.entities.TaskAssignment.filter({}, '-start_time', 1000),
      base44.asServiceRole.entities.TaskEmployee.filter({}),
      base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ event_date: targetDate }),
    ]);

    console.log(`📋 Found ${allEvents.length} events on ${targetDate}, ${allEmployees.length} employees`);

    if (allEvents.length === 0) {
      console.log("ℹ️ No events on target date, nothing to do");
      return Response.json({ message: "No events on target date", date: targetDate });
    }

    // Build lookups
    const employeeById = Object.fromEntries(allEmployees.map(e => [e.id, e]));
    const existingKey = new Set(existingAvailability.map(a => `${a.employee_id}_${a.event_id}`));

    const pendingCreates = [];
    const pendingMessages = [];

    for (const event of allEvents) {
      // Find all assignments for this event
      const eventAssignments = allAssignments.filter(a => a.event_id === event.id);

      // Collect unique employee IDs from assignments (primary + additional)
      const employeeIds = new Set();
      for (const assignment of eventAssignments) {
        if (assignment.assigned_to_id) employeeIds.add(assignment.assigned_to_id);
        if (assignment.additional_employees?.length) {
          for (const ae of assignment.additional_employees) {
            if (ae.employee_id) employeeIds.add(ae.employee_id);
          }
        }
      }

      console.log(`🎉 Event "${event.event_name}" (${event.id}): ${employeeIds.size} unique employees`);

      for (const empId of employeeIds) {
        const key = `${empId}_${event.id}`;
        if (existingKey.has(key)) {
          continue; // Already has a record for this date+event
        }

        const employee = employeeById[empId];
        if (!employee || !employee.phone_e164) {
          console.log(`⚠️ Employee ${empId}: no phone, skipping`);
          continue;
        }

        // Create the availability record
        const record = {
          employee_id: empId,
          employee_name: employee.full_name,
          employee_phone: employee.phone_e164,
          event_id: event.id,
          event_name: event.event_name,
          event_date: targetDate,
          confirmation_status: 'PENDING',
          confirmation_sent_at: currentTime.toISOString(),
          manager_id: employee.manager_id || '',
          manager_name: employee.manager_name || '',
          manager_phone: '',
        };

        // Find manager phone
        if (employee.manager_id) {
          const manager = employeeById[employee.manager_id];
          if (manager) record.manager_phone = manager.phone_e164 || '';
        }

        pendingCreates.push(record);
        existingKey.add(key); // Prevent duplicates within same run

        // Queue message send
        const phoneE164 = normalizePhone(employee.phone_e164);
        pendingMessages.push({
          phone: phoneE164,
          record,
          event,
        });
      }
    }

    // Bulk create availability records
    if (pendingCreates.length > 0) {
      const created = await base44.asServiceRole.entities.EmployeeDailyAvailability.bulkCreate(pendingCreates);
      recordsCreated = created.length;
      console.log(`💾 Created ${recordsCreated} availability records`);

      // Build a map from employee_id+event_id to created record id
      const createdMap = {};
      for (const c of created) {
        createdMap[`${c.employee_id}_${c.event_id}`] = c.id;
      }

      // Send WhatsApp messages
      for (const msg of pendingMessages) {
        const recordId = createdMap[`${msg.record.employee_id}_${msg.record.event_id}`] || '';
        const eventDateFormatted = formatHebrewDate(msg.record.event_date);

        const templateData = {
          employee_name: msg.record.employee_name,
          event_name: msg.record.event_name || msg.event.event_name,
          event_date: eventDateFormatted,
          record_id: recordId,
        };

        const result = await sendWhatsappTemplate(accountSid, authToken, fromNumber, msg.phone, contentSid, templateData);
        if (result.success) {
          messagesSent++;
          console.log(`📤 Availability message sent to ${msg.record.employee_name} (${msg.phone})`);
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
    console.error("❌ arriveToday error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Helpers (copied from tasksScheduler for consistency) ─────────────────────

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

// Send WhatsApp using Content Template (copied from tasksScheduler)
async function sendWhatsappTemplate(accountSid, authToken, fromNumber, toPhone, contentSid, templateData) {
  try {
    const toWhatsapp = toPhone.startsWith("whatsapp:") ? toPhone : "whatsapp:" + toPhone;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const contentVariables = JSON.stringify({
      "1": templateData.employee_name,
      "2": templateData.event_date,
      "3": templateData.record_id
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);

    if (contentSid) {
      formData.append("ContentSid", contentSid);
      formData.append("ContentVariables", contentVariables);
    } else {
      formData.append("Body", `שלום ${templateData.employee_name},\nאנחנו מקיימים לראותך היום, ${templateData.event_date}. באולם\nהאם אתה מגיע לעבודה היום?\nאנא אשר את הגעתך עד 11:00 בבוקר`);
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