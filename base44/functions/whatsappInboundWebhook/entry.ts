import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TWIML_OK = "<?xml version='1.0' encoding='UTF-8'?><Response></Response>";
const xmlHeaders = { "Content-Type": "text/xml", "Cache-Control": "no-store" };

Deno.serve(async (req) => {
  // Return TwiML immediately for non-POST
  if (req.method !== "POST") {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (e) {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  const params = new URLSearchParams(rawBody);
  const fromPhone = (params.get("From") || "").replace("whatsapp:", "").trim();
  const body = (params.get("Body") || "").trim();
  const buttonPayload = (params.get("ButtonPayload") || params.get("ButtonText") || "").trim();
  const message = body || buttonPayload;

  console.log(`📥 From: ${fromPhone}, Body: "${message}"`);
  console.log("ButtonPayload", buttonPayload);

  if (!fromPhone || !message) {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  // ─── Check if this is a daily availability response ───
  const upperPayload = buttonPayload.toUpperCase();
  // Support both formats:
  // 1. Static: AVAILABLE_ON_TIME / NOT_AVAILABLE (from template HX62c0b5da...)
  // 2. With record ID: DAILY_AVAIL_YES_<id> / DAILY_AVAIL_NO_<id> (from testAvailabilityMessage)
  const isStaticAvailYes = upperPayload === 'AVAILABLE_ON_TIME';
  const isStaticAvailNo = upperPayload === 'NOT_AVAILABLE';
  const dailyAvailYesMatch = upperPayload.match(/^DAILY_AVAIL_YES_(.+)$/);
  const dailyAvailNoMatch = upperPayload.match(/^DAILY_AVAIL_NO_(.+)$/);

  const isAvailYes = isStaticAvailYes || !!dailyAvailYesMatch;
  const isAvailNo = isStaticAvailNo || !!dailyAvailNoMatch;
  // Record IDs are lowercase hex but upperPayload uppercased them — restore original case from raw buttonPayload
  const availRecordIdRaw = buttonPayload.trim();
  const availRecordIdFromPayload = dailyAvailYesMatch || dailyAvailNoMatch
    ? availRecordIdRaw.replace(/^.*_((?:[0-9a-fA-F]+))$/i, '$1').toLowerCase()
    : null;

  if (isAvailYes || isAvailNo) {
    return handleAvailabilityResponse(req, fromPhone, isAvailYes, isAvailNo, availRecordIdFromPayload);
  }

  // ─── Check if this is a manager replacement response ───
  const mgrApproveMatch = upperPayload.match(/^MGR_APPROVE_(.+)$/);
  const mgrRejectMatch = upperPayload.match(/^MGR_REJECT_(.+)$/);

  if (mgrApproveMatch || mgrRejectMatch) {
    return handleManagerReplacementResponse(req, fromPhone, mgrApproveMatch, mgrRejectMatch);
  }

  // ─── Otherwise, handle as task response ───
  const lowerPayload = buttonPayload.toLowerCase();
  const lowerMsg = message.toLowerCase();
  
  let hasDone = false;
  let hasNotDone = false;
  let taskIdFromPayload = null;

  const notDoneMatch = lowerPayload.match(/^not_done_(.+)$/);
  const doneMatch = lowerPayload.match(/^done_(.+)$/);

  if (notDoneMatch) {
    hasNotDone = true;
    taskIdFromPayload = notDoneMatch[1];
  } else if (doneMatch) {
    hasDone = true;
    taskIdFromPayload = doneMatch[1];
  } else {
    // Fallback for text replies without structured payload
    hasNotDone = message.includes("לא בוצע") || lowerMsg === "not_done" || lowerMsg === "no";
    hasDone = !hasNotDone && (message.includes("בוצע") || lowerMsg === "done" || lowerMsg === "yes");
  }

  if (!hasDone && !hasNotDone) {
    console.log(`⚠️ Unknown intent: "${message}"`);
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  console.log(`📌 Intent: ${hasDone ? "DONE" : "NOT_DONE"}, Task ID from payload: ${taskIdFromPayload || "none"}`);

  const base44 = createClientFromRequest(req);

  try {
    const employees = await base44.asServiceRole.entities.TaskEmployee.filter({ phone_e164: fromPhone });
    if (!employees[0]) {
      console.log(`⚠️ Unknown phone: ${fromPhone}`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }
    const employee = employees[0];

    let task = null;

    if (taskIdFromPayload) {
      // Direct lookup by task ID from button payload
      const tasks = await base44.asServiceRole.entities.TaskAssignment.filter({ id: taskIdFromPayload });
      task = tasks[0] || null;
      if (!task) {
        console.log(`⚠️ Task not found for ID: ${taskIdFromPayload}`);
        return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
      }
      console.log(`🎯 Task from payload: "${task.task_title}" (${task.id})`);
    } else {
      console.log(`🎯 Task has no id in payload`);
    }

    // Skip if task was already reported (DONE, NOT_DONE, or OVERDUE)
    if (task && task.status !== "PENDING") {
      console.log(`⚠️ Task ${task.id} already has status "${task.status}", ignoring duplicate report`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }

    if (hasDone) {
      await base44.asServiceRole.entities.TaskAssignment.update(task.id, {
        status: "DONE", completed_at: new Date().toISOString()
      });
      console.log(`✅ DONE by ${employee.full_name}`);
    } else {
      await base44.asServiceRole.entities.TaskAssignment.update(task.id, { status: "NOT_DONE", escalation_sent_at: new Date().toISOString() });
      console.log(`❌ NOT_DONE by ${employee.full_name}`);
      sendEscalation(base44, task, employee).catch(e => console.error("Escalation err:", e.message));
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
});

function buildEscalationTemplateData(task, employee) {
  const eventName = task.event_id ? (task.event_name || '-') : 'משימה שוטפת';
  const startStr = task.start_time
    ? new Date(task.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';
  const endStr = task.end_time
    ? new Date(task.end_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';
  return {
    employee_name: employee?.full_name || task.assigned_to_name || '-',
    task_title: task.task_title || 'משימה',
    event_name: eventName,
    time_range: `${startStr}-${endStr}`
  };
}

// ─── Daily Availability Handler ───────────────────────────────────────────────

async function handleAvailabilityResponse(req, fromPhone, isAvailYes, isAvailNo, recordIdFromPayload) {
  const isAvailable = isAvailYes;

  console.log(`📌 Availability intent: ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}, Phone: ${fromPhone}, RecordID: ${recordIdFromPayload || 'none'}`);

  const base44 = createClientFromRequest(req);

  try {
    // If we have a record ID from the payload, use it directly
    if (recordIdFromPayload) {
      const directRecords = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ id: recordIdFromPayload });
      if (directRecords[0]) {
        console.log(`🎯 Found record by ID: ${recordIdFromPayload} for ${directRecords[0].employee_name}`);
        return processAvailabilityRecord(base44, directRecords[0], isAvailable);
      }
      console.log(`⚠️ Record not found by ID: ${recordIdFromPayload}, falling back to phone lookup`);
    }

    // Fallback: Find today's PENDING availability record by phone number
    const now = new Date();
    const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const y = israelNow.getFullYear();
    const m = String(israelNow.getMonth() + 1).padStart(2, '0');
    const d = String(israelNow.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;

    // Normalize incoming phone
    const normalizedPhone = normalizePhoneHelper(fromPhone);

    const records = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({
      employee_phone: normalizedPhone,
      event_date: today,
      confirmation_status: 'PENDING'
    });
    const record = records[0];

    if (!record) {
      // Try without normalization in case stored format differs
      const records2 = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({
        event_date: today,
        confirmation_status: 'PENDING'
      });
      const phoneVariants = [fromPhone, normalizedPhone, normalizedPhone.replace('+972', '0')];
      const matchedRecord = records2.find(r => {
        const storedNorm = normalizePhoneHelper(r.employee_phone || '');
        return phoneVariants.includes(storedNorm) || phoneVariants.includes(r.employee_phone);
      });
      if (!matchedRecord) {
        console.log(`⚠️ No pending availability record found for phone ${fromPhone} on ${today}`);
        return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
      }
      // Use the matched record
      return processAvailabilityRecord(base44, matchedRecord, isAvailable);
    }

    return processAvailabilityRecord(base44, record, isAvailable);
  } catch (error) {
    console.error("❌ Availability error:", error.message);
  }

  return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
}

async function processAvailabilityRecord(base44, record, isAvailable) {
  const now = new Date().toISOString();
  const recordId = record.id;

  if (isAvailable) {
    await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
      confirmation_status: 'CONFIRMED_AVAILABLE',
      confirmation_response_at: now,
    });
    console.log(`✅ ${record.employee_name} confirmed AVAILABLE for ${record.event_name}`);
  } else {
    await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
      confirmation_status: 'CONFIRMED_UNAVAILABLE',
      confirmation_response_at: now,
    });
    console.log(`❌ ${record.employee_name} confirmed UNAVAILABLE for ${record.event_name}`);

    if (record.source_type === 'recurring') {
      cancelRecurringTasksForEmployee(base44, record).catch(e => console.error("Cancel tasks err:", e.message));
      sendRecurringUnavailableEscalation(base44, record).catch(e => console.error("Recurring esc err:", e.message));
    } else {
      cancelEventTasksForEmployee(base44, record).catch(e => console.error("Cancel event tasks err:", e.message));
      sendManagerAvailabilityEscalation(base44, record).catch(e => console.error("Avail escalation err:", e.message));
    }
  }

  return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
}

const ESCALATION_ROLE_NAMES = ["מנהלת משרד"];
const OFFICE_MGR_ESC_CONTENT_SID = "HX1b5558913e7e01ae8a6df5429626caaa";
const CEO_ESC_CONTENT_SID = "HXa898286c3885aeb4e986bdefd224572f";

async function sendManagerAvailabilityEscalation(base44, record) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) return;

  // Find all employees with escalation roles
  const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
  const escalationTargets = allEmployees.filter(emp =>
    ESCALATION_ROLE_NAMES.includes(emp.role_name)
  );

  if (escalationTargets.length === 0) {
    console.log(`⚠️ No employees found with roles ${ESCALATION_ROLE_NAMES.join(", ")}, skipping escalation`);
    return;
  }

  console.log(`📋 Found ${escalationTargets.length} escalation targets: ${escalationTargets.map(e => `${e.full_name} (${e.role_name})`).join(", ")}`);

  const escalationContentSid = "HX1b5558913e7e01ae8a6df5429626caaa";

  const months = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const d = new Date(record.event_date + 'T00:00:00');
  const eventDateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const results = await Promise.allSettled(escalationTargets.map(async (target) => {
    let toWhatsapp = (target.phone_e164 || "").replace(/[^\d+]/g, '');
    if (toWhatsapp.startsWith("0")) toWhatsapp = "+972" + toWhatsapp.substring(1);
    if (!toWhatsapp.startsWith("+")) toWhatsapp = "+" + toWhatsapp;

    if (!toWhatsapp || toWhatsapp.length < 8) {
      console.log(`⚠️ Invalid phone for ${target.full_name}, skipping`);
      return;
    }

    toWhatsapp = "whatsapp:" + toWhatsapp;

    const contentVariables = JSON.stringify({
      "1": target.full_name,
      "2": record.employee_name,
      "3": eventDateFormatted,
      "4": record.event_name
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", escalationContentSid);
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
      console.log(`📤 Escalation sent to ${target.full_name} (${target.role_name}) - ${target.phone_e164}`);
    } else {
      const err = await response.json();
      console.error(`❌ Escalation to ${target.full_name} failed: ${err.message || err.error_message}`);
    }
  }));

  await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
    manager_notified_at: new Date().toISOString()
  });

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ Escalation complete: ${successCount}/${escalationTargets.length} messages sent`);
}

// ─── Cancel recurring tasks for employee who said NOT_ARRIVING ────────────────

async function cancelRecurringTasksForEmployee(base44, record) {
  const targetDate = record.event_date;
  const dayStart = new Date(targetDate + 'T00:00:00');
  const dayEnd = new Date(targetDate + 'T23:59:59');

  // Get all pending tasks for this employee today (recurring only)
  const allTasks = await base44.asServiceRole.entities.TaskAssignment.filter({
    assigned_to_id: record.employee_id,
    status: 'PENDING'
  }, '-start_time', 500);

  const todayRecurring = allTasks.filter(t => {
    if (t.event_id) return false;
    if (!t.start_time) return false;
    const taskDate = new Date(t.start_time);
    return taskDate >= dayStart && taskDate <= dayEnd;
  });

  if (todayRecurring.length === 0) {
    console.log(`ℹ️ No recurring tasks to cancel for ${record.employee_name}`);
    return;
  }

  const updates = todayRecurring.map(t =>
    base44.asServiceRole.entities.TaskAssignment.update(t.id, { status: 'NOT_ARRIVING' })
  );
  await Promise.all(updates);
  console.log(`🚫 Cancelled ${todayRecurring.length} recurring tasks for ${record.employee_name}`);
}

// ─── Send escalation to office manager for recurring unavailability ───────────

async function sendRecurringUnavailableEscalation(base44, record) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) return;

  const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
  const officeManagers = allEmployees.filter(emp => emp.role_name === "מנהלת משרד");

  if (officeManagers.length === 0) {
    console.log(`⚠️ No office manager found, skipping escalation`);
    return;
  }

  for (const mgr of officeManagers) {
    let toWhatsapp = normalizePhoneHelper(mgr.phone_e164);
    if (!toWhatsapp || toWhatsapp.length < 8) continue;
    toWhatsapp = "whatsapp:" + toWhatsapp;

    const contentVariables = JSON.stringify({
      "1": mgr.full_name,
      "2": record.employee_name,
      "3": record.id,
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", OFFICE_MGR_ESC_CONTENT_SID);
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
      console.log(`📤 Office manager escalation sent to ${mgr.full_name}`);
    } else {
      const err = await response.json();
      console.error(`❌ Office manager esc failed: ${err.message || err.error_message}`);
    }
  }

  await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
    manager_notified_at: new Date().toISOString(),
    manager_replacement_status: 'PENDING'
  });
}

// ─── Handle manager replacement response (APPROVE/REJECT) ────────────────────

async function handleManagerReplacementResponse(req, fromPhone, approveMatch, rejectMatch) {
  const isApproved = !!approveMatch;
  const recordId = isApproved ? approveMatch[1] : rejectMatch[1];

  console.log(`📌 Manager replacement: ${isApproved ? "APPROVED" : "REJECTED"}, Record: ${recordId}`);

  const base44 = createClientFromRequest(req);

  try {
    const records = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ id: recordId });
    const record = records[0];

    if (!record) {
      console.log(`⚠️ Record not found: ${recordId}`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }

    if (record.manager_replacement_status && record.manager_replacement_status !== 'PENDING') {
      console.log(`⚠️ Already handled: ${record.manager_replacement_status}`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }

    if (isApproved) {
      await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
        manager_replacement_status: 'APPROVED'
      });
      console.log(`✅ Manager approved replacement for ${record.employee_name}`);
    } else {
      await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
        manager_replacement_status: 'REJECTED'
      });
      console.log(`❌ Manager rejected replacement for ${record.employee_name}`);

      // Send CEO escalation
      sendCEOEscalation(base44, record).catch(e => console.error("CEO esc err:", e.message));
    }
  } catch (error) {
    console.error("❌ Manager replacement error:", error.message);
  }

  return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
}

// ─── Send final escalation to CEO ─────────────────────────────────────────────

async function sendCEOEscalation(base44, record) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) return;

  // Find CEO by role name
  const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
  const ceoEmployees = allEmployees.filter(emp => emp.role_name === 'מנכ"ל');

  if (ceoEmployees.length === 0) {
    console.log(`⚠️ No CEO found, skipping escalation`);
    return;
  }

  for (const ceo of ceoEmployees) {
    let toWhatsapp = normalizePhoneHelper(ceo.phone_e164);
    if (!toWhatsapp || toWhatsapp.length < 8) continue;
    toWhatsapp = "whatsapp:" + toWhatsapp;

    const contentVariables = JSON.stringify({
      "1": record.employee_name,
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", CEO_ESC_CONTENT_SID);
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
      console.log(`📤 CEO escalation sent to ${ceo.full_name}`);
    } else {
      const err = await response.json();
      console.error(`❌ CEO esc failed: ${err.message || err.error_message}`);
    }
  }

  await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
    ceo_escalation_sent_at: new Date().toISOString()
  });
}

// ─── Cancel EVENT tasks for employee who said NOT_ARRIVING ────────────────────

async function cancelEventTasksForEmployee(base44, record) {
  if (!record.event_id || !record.employee_id) {
    console.log(`ℹ️ No event_id or employee_id on record ${record.id}, skipping event task cancellation`);
    return;
  }

  // Get all pending tasks for this employee+event
  const allTasks = await base44.asServiceRole.entities.TaskAssignment.filter({
    event_id: record.event_id,
    assigned_to_id: record.employee_id,
    status: 'PENDING'
  });

  if (allTasks.length === 0) {
    console.log(`ℹ️ No pending event tasks to cancel for ${record.employee_name} on event ${record.event_id}`);
    return;
  }

  const updates = allTasks.map(t =>
    base44.asServiceRole.entities.TaskAssignment.update(t.id, {
      status: 'NOT_ARRIVING',
      last_notification_start_sent_at: null,
      last_notification_end_sent_at: null
    })
  );
  await Promise.all(updates);
  console.log(`🚫 Cancelled ${allTasks.length} event tasks for ${record.employee_name} (event ${record.event_id})`);
}

function normalizePhoneHelper(phone) {
  if (!phone) return '';
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith("0")) p = "+972" + p.substring(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

// ─── Task Escalation ─────────────────────────────────────────────────────────

async function sendEscalation(base44, task, employee) {
  const escalationPhone = task.escalation_employee_phone;
  if (!escalationPhone) {
    console.log(`⚠️ No escalation employee configured for task ${task.id}, skipping`);
    return;
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) return;

  const escalationContentSid = "HX65d2161eeee74063f64295eb7e926c19";
  const escTemplateData = buildEscalationTemplateData(task, employee);

  let toWhatsapp = escalationPhone.replace(/[^\d+]/g, '');
  if (toWhatsapp.startsWith("0")) toWhatsapp = "+972" + toWhatsapp.substring(1);
  if (!toWhatsapp.startsWith("+")) toWhatsapp = "+" + toWhatsapp;
  toWhatsapp = "whatsapp:" + toWhatsapp;

  const contentVariables = JSON.stringify({
    "1": escTemplateData.employee_name,
    "2": escTemplateData.task_title,
    "3": escTemplateData.event_name,
    "4": escTemplateData.time_range
  });

  const formData = new URLSearchParams();
  formData.append("From", fromNumber);
  formData.append("To", toWhatsapp);
  formData.append("ContentSid", escalationContentSid);
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
    console.log(`📤 NOT_DONE escalation template sent to ${task.escalation_employee_name} (${escalationPhone}) for task ${task.id}`);
  } else {
    const err = await response.json();
    console.error(`❌ Escalation failed for task ${task.id}: ${err.message || err.error_message}`);
  }
}