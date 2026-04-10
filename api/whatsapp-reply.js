import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp, TEMPLATES } from "./_twilio.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TWIML_OK = "<?xml version='1.0' encoding='UTF-8'?><Response></Response>";
const ESCALATION_ROLE_NAMES = ["מנהלת משרד"];
const OFFICE_MGR_ESC_CONTENT_SID = TEMPLATES.MANAGER_UNAVAILABLE_ESC;
const CEO_ESC_CONTENT_SID = TEMPLATES.CEO_ESC_FINAL;

/**
 * POST /api/whatsapp-reply
 * Twilio inbound webhook.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return xmlOk(res);

  let params;
  try {
    params = await getRequestParams(req);
  } catch (error) {
    console.error("❌ Failed to parse webhook body:", error.message);
    return xmlOk(res);
  }

  const fromPhone = (params.get("From") || "").replace("whatsapp:", "").trim();
  const body = (params.get("Body") || "").trim();
  const buttonPayload = (params.get("ButtonPayload") || params.get("ButtonText") || "").trim();
  const message = body || buttonPayload;

  console.log(`📥 From: ${fromPhone}, Body: "${message}"`);
  console.log("ButtonPayload:", buttonPayload);

  if (!fromPhone || !message) return xmlOk(res);

  const upperPayload = buttonPayload.toUpperCase();
  const isStaticAvailYes = upperPayload === "AVAILABLE_ON_TIME";
  const isStaticAvailNo = upperPayload === "NOT_AVAILABLE";
  const dailyAvailYesMatch = upperPayload.match(/^DAILY_AVAIL_YES_(.+)$/);
  const dailyAvailNoMatch = upperPayload.match(/^DAILY_AVAIL_NO_(.+)$/);

  const isAvailYes = isStaticAvailYes || !!dailyAvailYesMatch;
  const isAvailNo = isStaticAvailNo || !!dailyAvailNoMatch;
  const availRecordIdFromPayload =
    dailyAvailYesMatch || dailyAvailNoMatch
      ? buttonPayload.replace(/^.*_((?:[0-9a-fA-F-]+))$/i, "$1").toLowerCase()
      : null;

  if (isAvailYes || isAvailNo) {
    await handleAvailabilityResponse(fromPhone, isAvailYes, availRecordIdFromPayload);
    return xmlOk(res);
  }

  const mgrApproveMatch = upperPayload.match(/^MGR_APPROVE_(.+)$/);
  const mgrRejectMatch = upperPayload.match(/^MGR_REJECT_(.+)$/);
  if (mgrApproveMatch || mgrRejectMatch) {
    await handleManagerReplacementResponse(buttonPayload, mgrApproveMatch, mgrRejectMatch);
    return xmlOk(res);
  }

  const lowerPayload = buttonPayload.toLowerCase();
  const lowerMessage = message.toLowerCase();

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
    hasNotDone = message.includes("לא בוצע") || lowerMessage === "not_done" || lowerMessage === "no";
    hasDone = !hasNotDone && (message.includes("בוצע") || lowerMessage === "done" || lowerMessage === "yes");
  }

  if (!hasDone && !hasNotDone) {
    console.log(`⚠️ Unknown intent: "${message}"`);
    return xmlOk(res);
  }

  console.log(`📌 Intent: ${hasDone ? "DONE" : "NOT_DONE"}, task ID: ${taskIdFromPayload || "none"}`);

  try {
    const employee = await findEmployeeByPhone(fromPhone);
    if (!employee) {
      console.log(`⚠️ Unknown phone: ${fromPhone}`);
      return xmlOk(res);
    }

    if (!taskIdFromPayload) {
      console.log("⚠️ Task response without structured task id, skipping");
      return xmlOk(res);
    }

    const { data: task, error: taskError } = await supabase
      .from("TaskAssignment")
      .select("*")
      .eq("id", taskIdFromPayload)
      .single();

    if (taskError || !task) {
      console.log(`⚠️ Task not found for ID: ${taskIdFromPayload}`);
      return xmlOk(res);
    }

    if (task.status !== "PENDING") {
      console.log(`⚠️ Task ${task.id} already "${task.status}", ignoring duplicate report`);
      return xmlOk(res);
    }

    if (hasDone) {
      const { data: updatedRows } = await supabase
        .from("TaskAssignment")
        .update({ status: "DONE", completed_at: new Date().toISOString() })
        .eq("id", task.id)
        .eq("status", "PENDING")
        .select("id");

      if (!updatedRows || updatedRows.length === 0) {
        console.log(`⚠️ Task ${task.id} already handled by another process`);
        return xmlOk(res);
      }

      console.log(`✅ DONE by ${employee.full_name}`);
    } else {
      const nowIso = new Date().toISOString();
      const { data: updatedRows } = await supabase
        .from("TaskAssignment")
        .update({ status: "NOT_DONE", escalation_sent_at: nowIso })
        .eq("id", task.id)
        .eq("status", "PENDING")
        .select("id");

      if (!updatedRows || updatedRows.length === 0) {
        console.log(`⚠️ Task ${task.id} already handled by another process`);
        return xmlOk(res);
      }

      console.log(`❌ NOT_DONE by ${employee.full_name}`);
      await sendTaskEscalation(task, employee);
    }
  } catch (error) {
    console.error("❌ Task response error:", error.message);
  }

  return xmlOk(res);
}

async function handleAvailabilityResponse(fromPhone, isAvailYes, recordIdFromPayload) {
  const isAvailable = isAvailYes;
  console.log(
    `📌 Availability intent: ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}, phone: ${fromPhone}, record: ${recordIdFromPayload || "none"}`,
  );

  try {
    if (recordIdFromPayload) {
      const { data: directRecord } = await supabase
        .from("EmployeeDailyAvailability")
        .select("*")
        .eq("id", recordIdFromPayload)
        .single();

      if (directRecord) {
        console.log(`🎯 Found availability record by id: ${recordIdFromPayload}`);
        await processAvailabilityRecord(directRecord, isAvailable);
        return;
      }

      console.log(`⚠️ Availability record not found by id: ${recordIdFromPayload}, falling back to phone`);
    }

    const today = getIsraelDateString();
    const normalizedPhone = normalizePhone(fromPhone);
    const employee = await findEmployeeByPhone(fromPhone);

    let record = null;

    if (employee?.id) {
      const { data: recordsByEmployee } = await supabase
        .from("EmployeeDailyAvailability")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("event_date", today)
        .eq("confirmation_status", "PENDING")
        .order("confirmation_sent_at", { ascending: false })
        .limit(1);
      record = recordsByEmployee?.[0] || null;
    }

    if (!record) {
      const { data: fallbackRecords } = await supabase
        .from("EmployeeDailyAvailability")
        .select("*")
        .eq("event_date", today)
        .eq("confirmation_status", "PENDING");

      const phoneVariants = [fromPhone, normalizedPhone, normalizedPhone.replace("+972", "0")];
      record = (fallbackRecords || []).find((row) => {
        const stored = row.employee_phone || "";
        const storedNorm = normalizePhone(stored);
        return (
          (employee?.id && row.employee_id === employee.id) ||
          phoneVariants.includes(stored) ||
          phoneVariants.includes(storedNorm)
        );
      });
    }

    if (!record) {
      console.log(`⚠️ No pending availability record found for ${fromPhone} on ${today}`);
      return;
    }

    await processAvailabilityRecord(record, isAvailable);
  } catch (error) {
    console.error("❌ Availability response error:", error.message);
  }
}

async function processAvailabilityRecord(record, isAvailable) {
  const nowIso = new Date().toISOString();
  const nextStatus = isAvailable ? "CONFIRMED_AVAILABLE" : "CONFIRMED_UNAVAILABLE";

  const { data: updatedRows, error: updateError } = await supabase
    .from("EmployeeDailyAvailability")
    .update({
      confirmation_status: nextStatus,
      confirmation_response_at: nowIso,
    })
    .eq("id", record.id)
    .eq("confirmation_status", "PENDING")
    .select("id");

  if (updateError) {
    console.error(`❌ Failed to update availability record ${record.id}:`, updateError.message);
    return;
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.log(`⚠️ Availability record ${record.id} already handled`);
    return;
  }

  if (isAvailable) {
    console.log(`✅ ${record.employee_name || "Employee"} confirmed AVAILABLE`);
    return;
  }

  console.log(`❌ ${record.employee_name || "Employee"} confirmed UNAVAILABLE`);

  if (record.source_type === "recurring") {
    await cancelRecurringTasksForEmployee(record);
    await sendRecurringUnavailableEscalation(record);
  } else {
    await cancelEventTasksForEmployee(record);
    await sendManagerAvailabilityEscalation(record);
  }
}

async function sendManagerAvailabilityEscalation(record) {
  const { data: escalationTargets } = await supabase
    .from("TaskEmployee")
    .select("id, full_name, role_name, phone_e164")
    .eq("is_active", true)
    .in("role_name", ESCALATION_ROLE_NAMES);

  if (!escalationTargets?.length) {
    console.log(`⚠️ No escalation employees found with roles: ${ESCALATION_ROLE_NAMES.join(", ")}`);
    return;
  }

  const eventDateFormatted = formatHebrewDate(record.event_date);

  const results = await Promise.allSettled(
    escalationTargets.map(async (target) => {
      const phone = normalizePhone(target.phone_e164 || "");
      if (!phone) return;

      await sendWhatsApp(phone, OFFICE_MGR_ESC_CONTENT_SID, {
        "1": target.full_name || "",
        "2": record.employee_name || "",
        "3": eventDateFormatted,
        "4": record.event_name || "אירוע",
      });

      console.log(`📤 Availability escalation sent to ${target.full_name} (${target.role_name})`);
    }),
  );

  const { error: managerStatusError } = await supabase
    .from("EmployeeDailyAvailability")
    .update({
      manager_notified_at: new Date().toISOString(),
      manager_replacement_status: "PENDING",
    })
    .eq("id", record.id);

  if (managerStatusError) {
    // Backward compatible fallback for environments where manager_replacement_status is missing.
    await supabase
      .from("EmployeeDailyAvailability")
      .update({ manager_notified_at: new Date().toISOString() })
      .eq("id", record.id);
  }

  const successCount = results.filter((r) => r.status === "fulfilled").length;
  console.log(`✅ Availability escalation complete: ${successCount}/${escalationTargets.length}`);
}

async function cancelRecurringTasksForEmployee(record) {
  if (!record.employee_id || !record.event_date) return;

  const dayStartIso = new Date(`${record.event_date}T00:00:00`).toISOString();
  const dayEndIso = new Date(`${record.event_date}T23:59:59`).toISOString();

  const { data: tasks } = await supabase
    .from("TaskAssignment")
    .select("id")
    .eq("assigned_to_id", record.employee_id)
    .eq("status", "PENDING")
    .is("event_id", null)
    .gte("start_time", dayStartIso)
    .lte("start_time", dayEndIso);

  if (!tasks?.length) {
    console.log(`ℹ️ No recurring tasks to cancel for ${record.employee_name || record.employee_id}`);
    return;
  }

  await Promise.all(
    tasks.map((task) =>
      supabase.from("TaskAssignment").update({ status: "NOT_ARRIVING" }).eq("id", task.id),
    ),
  );

  console.log(`🚫 Cancelled ${tasks.length} recurring tasks for ${record.employee_name || record.employee_id}`);
}

async function sendRecurringUnavailableEscalation(record) {
  const { data: officeManagers } = await supabase
    .from("TaskEmployee")
    .select("id, full_name, role_name, phone_e164")
    .eq("is_active", true)
    .eq("role_name", "מנהלת משרד");

  if (!officeManagers?.length) {
    console.log("⚠️ No office manager found, skipping recurring escalation");
    return;
  }

  await Promise.allSettled(
    officeManagers.map(async (manager) => {
      const phone = normalizePhone(manager.phone_e164 || "");
      if (!phone) return;

      await sendWhatsApp(phone, OFFICE_MGR_ESC_CONTENT_SID, {
        "1": manager.full_name || "",
        "2": record.employee_name || "",
        "3": record.id,
      });

      console.log(`📤 Office manager escalation sent to ${manager.full_name}`);
    }),
  );

  const { error: managerStatusError } = await supabase
    .from("EmployeeDailyAvailability")
    .update({
      manager_notified_at: new Date().toISOString(),
      manager_replacement_status: "PENDING",
    })
    .eq("id", record.id);

  if (managerStatusError) {
    await supabase
      .from("EmployeeDailyAvailability")
      .update({ manager_notified_at: new Date().toISOString() })
      .eq("id", record.id);
  }
}

async function handleManagerReplacementResponse(buttonPayload, approveMatch, rejectMatch) {
  const isApproved = !!approveMatch;
  const recordId = buttonPayload.replace(/^(?:MGR_APPROVE|MGR_REJECT)_(.+)$/i, "$1");
  console.log(`📌 Manager replacement: ${isApproved ? "APPROVED" : "REJECTED"}, record: ${recordId}`);

  try {
    const { data: record } = await supabase
      .from("EmployeeDailyAvailability")
      .select("*")
      .eq("id", recordId)
      .single();

    if (!record) {
      console.log(`⚠️ Record not found: ${recordId}`);
      return;
    }

    if (record.manager_replacement_status && record.manager_replacement_status !== "PENDING") {
      console.log(`⚠️ Replacement already handled: ${record.manager_replacement_status}`);
      return;
    }

    if (isApproved) {
      await supabase
        .from("EmployeeDailyAvailability")
        .update({ manager_replacement_status: "APPROVED" })
        .eq("id", recordId);
      console.log(`✅ Manager approved replacement for ${record.employee_name || record.employee_id}`);
    } else {
      await supabase
        .from("EmployeeDailyAvailability")
        .update({ manager_replacement_status: "REJECTED" })
        .eq("id", recordId);
      console.log(`❌ Manager rejected replacement for ${record.employee_name || record.employee_id}`);
      await sendCEOEscalation(record);
    }
  } catch (error) {
    console.error("❌ Manager replacement response error:", error.message);
  }
}

async function sendCEOEscalation(record) {
  const { data: ceoEmployees } = await supabase
    .from("TaskEmployee")
    .select("id, full_name, role_name, phone_e164")
    .eq("is_active", true)
    .ilike("role_name", "%מנכ%");

  if (!ceoEmployees?.length) {
    console.log("⚠️ No CEO found, skipping escalation");
    return;
  }

  await Promise.allSettled(
    ceoEmployees.map(async (ceo) => {
      const phone = normalizePhone(ceo.phone_e164 || "");
      if (!phone) return;
      await sendWhatsApp(phone, CEO_ESC_CONTENT_SID, { "1": record.employee_name || "" });
      console.log(`📤 CEO escalation sent to ${ceo.full_name}`);
    }),
  );

  const nowIso = new Date().toISOString();
  const { error: ceoUpdateError } = await supabase
    .from("EmployeeDailyAvailability")
    .update({
      ceo_escalated_at: nowIso,
      ceo_escalation_sent_at: nowIso,
    })
    .eq("id", record.id);

  if (ceoUpdateError) {
    await supabase
      .from("EmployeeDailyAvailability")
      .update({ ceo_escalated_at: nowIso })
      .eq("id", record.id);
  }
}

async function cancelEventTasksForEmployee(record) {
  if (!record.event_id || !record.employee_id) {
    console.log(`ℹ️ Missing event_id/employee_id on availability record ${record.id}, skipping event cancellation`);
    return;
  }

  const { data: tasks } = await supabase
    .from("TaskAssignment")
    .select("id")
    .eq("event_id", record.event_id)
    .eq("assigned_to_id", record.employee_id)
    .eq("status", "PENDING");

  if (!tasks?.length) {
    console.log(`ℹ️ No pending event tasks to cancel for ${record.employee_name || record.employee_id}`);
    return;
  }

  await Promise.all(
    tasks.map((task) =>
      supabase
        .from("TaskAssignment")
        .update({
          status: "NOT_ARRIVING",
          last_notification_start_sent_at: null,
          last_notification_end_sent_at: null,
        })
        .eq("id", task.id),
    ),
  );

  console.log(`🚫 Cancelled ${tasks.length} event task(s) for ${record.employee_name || record.employee_id}`);
}

async function sendTaskEscalation(task, employee) {
  const escalationPhone = task.escalation_employee_phone;
  if (!escalationPhone) {
    console.log(`⚠️ No escalation employee configured for task ${task.id}, skipping`);
    return;
  }

  const templateData = buildTaskEscalationTemplateData(task, employee);
  const phone = normalizePhone(escalationPhone);
  if (!phone) return;

  try {
    await sendWhatsApp(phone, TEMPLATES.TASK_ESCALATION, {
      "1": templateData.employee_name,
      "2": templateData.task_title,
      "3": templateData.event_name,
      "4": templateData.time_range,
    });
    console.log(
      `📤 NOT_DONE escalation sent to ${task.escalation_employee_name || "escalation employee"} (${escalationPhone}) for task ${task.id}`,
    );
  } catch (error) {
    console.error(`❌ Escalation failed for task ${task.id}: ${error.message}`);
  }
}

function buildTaskEscalationTemplateData(task, employee) {
  const eventName = task.event_id ? task.event_name || "-" : "משימה שוטפת";
  const timeOpts = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" };
  const startStr = task.start_time ? new Date(task.start_time).toLocaleTimeString("he-IL", timeOpts) : "--:--";
  const endStr = task.end_time ? new Date(task.end_time).toLocaleTimeString("he-IL", timeOpts) : "--:--";

  return {
    employee_name: employee?.full_name || task.assigned_to_name || "-",
    task_title: task.task_title || "משימה",
    event_name: eventName,
    time_range: `${startStr}-${endStr}`,
  };
}

async function findEmployeeByPhone(fromPhone) {
  const normalized = normalizePhone(fromPhone);
  const variants = [fromPhone, normalized, normalized.replace("+972", "0")].filter(Boolean);

  for (const phone of variants) {
    const { data } = await supabase
      .from("TaskEmployee")
      .select("id, full_name, phone_e164")
      .eq("phone_e164", phone)
      .limit(1);
    if (data?.[0]) return data[0];
  }

  return null;
}

async function getRequestParams(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body)) {
      if (value == null) continue;
      form.append(key, String(value));
    }
    return form;
  }

  if (typeof req.body === "string") return new URLSearchParams(req.body);
  if (Buffer.isBuffer(req.body)) return new URLSearchParams(req.body.toString("utf8"));

  const raw = await readRawBody(req);
  return new URLSearchParams(raw);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function normalizePhone(phone) {
  if (!phone) return "";
  let p = String(phone).replace(/[^\d+]/g, "");
  if (p.startsWith("0")) p = "+972" + p.substring(1);
  if (p && !p.startsWith("+")) p = "+" + p;
  return p;
}

function getIsraelDateString() {
  const israelNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const year = israelNow.getFullYear();
  const month = String(israelNow.getMonth() + 1).padStart(2, "0");
  const day = String(israelNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHebrewDate(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const months = ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function xmlOk(res) {
  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(TWIML_OK);
}
