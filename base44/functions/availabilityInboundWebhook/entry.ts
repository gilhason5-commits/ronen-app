import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Handles incoming WhatsApp responses for daily availability confirmation.
// Separate from whatsappInboundWebhook to avoid conflicts.
// Pattern copied from whatsappInboundWebhook for consistency.

const TWIML_OK = "<?xml version='1.0' encoding='UTF-8'?><Response></Response>";
const xmlHeaders = { "Content-Type": "text/xml", "Cache-Control": "no-store" };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  const params = new URLSearchParams(rawBody);
  const fromPhone = (params.get("From") || "").replace("whatsapp:", "").trim();
  const body = (params.get("Body") || "").trim();
  const buttonPayload = (params.get("ButtonPayload") || params.get("ButtonText") || "").trim();
  const message = body || buttonPayload;

  console.log(`📥 Availability webhook - From: ${fromPhone}, Body: "${message}"`);

  if (!fromPhone || !message) {
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  // Parse button payload format: "DAILY_AVAIL_YES_{record_id}" or "DAILY_AVAIL_NO_{record_id}"
  const upperPayload = buttonPayload.toUpperCase();

  let isAvailable = false;
  let isUnavailable = false;
  let recordId = null;

  const availYesMatch = upperPayload.match(/^DAILY_AVAIL_YES_(.+)$/);
  const availNoMatch = upperPayload.match(/^DAILY_AVAIL_NO_(.+)$/);

  if (availYesMatch) {
    isAvailable = true;
    recordId = availYesMatch[1];
  } else if (availNoMatch) {
    isUnavailable = true;
    recordId = availNoMatch[1];
  } else {
    // Not an availability response, ignore (let task webhook handle it)
    console.log(`ℹ️ Not an availability payload, ignoring`);
    return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
  }

  console.log(`📌 Availability intent: ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}, Record ID: ${recordId}`);

  const base44 = createClientFromRequest(req);

  try {
    // Find the availability record
    const records = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ id: recordId });
    const record = records[0];

    if (!record) {
      console.log(`⚠️ Availability record not found: ${recordId}`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }

    // Skip if already responded
    if (record.confirmation_status !== 'PENDING') {
      console.log(`⚠️ Record ${recordId} already has status "${record.confirmation_status}", ignoring`);
      return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
    }

    const now = new Date().toISOString();

    if (isAvailable) {
      await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
        confirmation_status: 'CONFIRMED_AVAILABLE',
        confirmation_response_at: now,
      });
      console.log(`✅ ${record.employee_name} confirmed AVAILABLE for event ${record.event_name}`);
    } else {
      await base44.asServiceRole.entities.EmployeeDailyAvailability.update(recordId, {
        confirmation_status: 'CONFIRMED_UNAVAILABLE',
        confirmation_response_at: now,
      });
      console.log(`❌ ${record.employee_name} confirmed UNAVAILABLE for event ${record.event_name}`);

      // Send escalation to manager (copied from whatsappInboundWebhook)
      sendManagerEscalation(base44, record).catch(e => console.error("Escalation err:", e.message));
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  return new Response(TWIML_OK, { status: 200, headers: xmlHeaders });
});

// ─── Escalation Logic ───────────────────
// Sends escalation to all employees with roles "מנהלת משרד" and "מנהל אירוע"

const ESCALATION_ROLE_NAMES = ["מנהלת משרד", "מנכ\"ל"];

async function sendManagerEscalation(base44, record) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) return;

  // Find all employees with the escalation roles
  const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
  const escalationTargets = allEmployees.filter(emp =>
    ESCALATION_ROLE_NAMES.includes(emp.role_name)
  );

  if (escalationTargets.length === 0) {
    console.log(`⚠️ No employees found with roles ${ESCALATION_ROLE_NAMES.join(", ")}, skipping escalation`);
    return;
  }

  console.log(`📋 Found ${escalationTargets.length} escalation targets: ${escalationTargets.map(e => `${e.full_name} (${e.role_name})`).join(", ")}`);

  const escalationContentSid = "HX9cd368aa65ef93d66ae43e6ef2dece87";
  const eventDateFormatted = formatHebrewDate(record.event_date);

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

    if (escalationContentSid) {
      formData.append("ContentSid", escalationContentSid);
      formData.append("ContentVariables", contentVariables);
    } else {
      formData.append("Body", `⚠️ שלום ${target.full_name},\n${record.employee_name} דיווח/ה שלא מגיע/ה לאירוע "${record.event_name}" בתאריך ${eventDateFormatted}.\nנא לטפל בהתאם.`);
    }

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

  // Update the record with escalation timestamp
  await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
    manager_notified_at: new Date().toISOString()
  });

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ Escalation complete: ${successCount}/${escalationTargets.length} messages sent`);
}

function formatHebrewDate(dateStr) {
  const months = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}