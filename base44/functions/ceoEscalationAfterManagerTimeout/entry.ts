import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// This function runs every 15 minutes and checks for EmployeeDailyAvailability records where:
// 1. Employee confirmed UNAVAILABLE (actively said "not arriving")
// 2. Manager was notified (manager_notified_at exists)
// 3. Manager has NOT responded (manager_replacement_status is still PENDING)
// 4. More than 1 hour has passed since manager was notified
// 5. CEO escalation has NOT been sent yet (ceo_escalation_sent_at is empty)
// When all conditions are met, it sends an escalation to the CEO.

const MANAGER_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Get today's date in Israel timezone
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const y = israelTime.getFullYear();
    const m = String(israelTime.getMonth() + 1).padStart(2, '0');
    const d = String(israelTime.getDate()).padStart(2, '0');
    const currentDay = `${y}-${m}-${d}`;

    console.log(`🕐 ceoEscalationAfterManagerTimeout running for ${currentDay}`);

    // Find records where employee is unavailable OR didn't respond, and manager was notified but didn't respond
    const confirmedUnavailable = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({
      event_date: currentDay,
      confirmation_status: 'CONFIRMED_UNAVAILABLE',
      manager_replacement_status: 'PENDING'
    });
    const noResponse = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({
      event_date: currentDay,
      confirmation_status: 'NO_RESPONSE',
      manager_replacement_status: 'PENDING'
    });
    const unavailableRecords = [...confirmedUnavailable, ...noResponse];

    console.log(`📋 Found ${unavailableRecords.length} records (${confirmedUnavailable.length} CONFIRMED_UNAVAILABLE + ${noResponse.length} NO_RESPONSE) with PENDING manager status`);

    let escalationsSent = 0;

    for (const record of unavailableRecords) {
      // Skip if CEO escalation already sent
      if (record.ceo_escalation_sent_at) {
        continue;
      }

      // Skip if manager hasn't been notified yet
      if (!record.manager_notified_at) {
        continue;
      }

      // Check if 1 hour has passed since manager was notified
      const managerNotifiedAt = new Date(record.manager_notified_at);
      const elapsed = now.getTime() - managerNotifiedAt.getTime();

      if (elapsed < MANAGER_TIMEOUT_MS) {
        const minutesLeft = Math.round((MANAGER_TIMEOUT_MS - elapsed) / 60000);
        console.log(`⏳ Record ${record.id} (${record.employee_name}): ${minutesLeft} min left before CEO escalation`);
        continue;
      }

      // Time's up — send CEO escalation
      console.log(`🚨 Record ${record.id} (${record.employee_name}): Manager timeout exceeded, sending CEO escalation`);
      await sendCEOEscalation(base44, record);
      escalationsSent++;
    }

    console.log(`✅ Done. CEO escalations sent: ${escalationsSent}`);

    return Response.json({
      date: currentDay,
      records_checked: unavailableRecords.length,
      escalations_sent: escalationsSent,
      completed_at: now.toISOString()
    });

  } catch (error) {
    console.error("❌ ceoEscalationAfterManagerTimeout error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function sendCEOEscalation(base44, record) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  if (!accountSid || !authToken) {
    console.log("⚠️ Twilio credentials not configured, skipping CEO escalation");
    return;
  }

  const CEO_ESC_CONTENT_SID = "HXa898286c3885aeb4e986bdefd224572f";

  // Find CEO by role name
  const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
  const ceoEmployees = allEmployees.filter(emp => emp.role_name === 'מנכ"ל');

  if (ceoEmployees.length === 0) {
    console.log("⚠️ No CEO found in TaskEmployee, skipping escalation");
    return;
  }

  for (const ceo of ceoEmployees) {
    let toWhatsapp = normalizePhone(ceo.phone_e164);
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
      console.log(`📤 CEO escalation sent to ${ceo.full_name} for employee ${record.employee_name}`);
    } else {
      const err = await response.json();
      console.error(`❌ CEO escalation failed: ${err.message || err.error_message}`);
    }
  }

  // Update the record with CEO escalation timestamp
  await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
    ceo_escalation_sent_at: new Date().toISOString()
  });

  console.log(`✅ CEO escalation complete for ${record.employee_name}`);
}

function normalizePhone(phone) {
  if (!phone) return '';
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith("0")) p = "+972" + p.substring(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}