import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Runs every 5 minutes. Checks AppSetting for configured send hour + 2 hours.
// Only acts once per day within the configured time window.
// Checks for PENDING availability records and updates them to NO_RESPONSE.

const NO_ANSWER_ESC_CONTENT_SID = "HXe4763fc016f5e2e1600d909d53d8228c";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const y = israelTime.getFullYear();
    const m = String(israelTime.getMonth() + 1).padStart(2, '0');
    const d = String(israelTime.getDate()).padStart(2, '0');
    const currentDay = `${y}-${m}-${d}`;
    const currentHourMin = `${String(israelTime.getHours()).padStart(2, '0')}:${String(israelTime.getMinutes()).padStart(2, '0')}`;

    // Get configured send hour and calculate no-response check time (+2 hours)
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'availability_send_hour' });
    const sendHour = settings.length > 0 ? settings[0].value : '11:00';
    const [confH, confM] = sendHour.split(':').map(Number);
    let checkH = confH + 2;
    if (checkH >= 24) checkH -= 24;
    const checkMinutes = checkH * 60 + confM;
    const nowMinutes = israelTime.getHours() * 60 + israelTime.getMinutes();
    const diff = nowMinutes - checkMinutes;

    if (diff < 0 || diff >= 5) {
      return Response.json({ skipped: true, reason: `Not in check window. Current: ${currentHourMin}, check time: ${String(checkH).padStart(2, '0')}:${String(confM).padStart(2, '0')}` });
    }

    console.log(`🕐 availabilityNoResponseChecker triggered at ${currentHourMin} (send hour: ${sendHour}, check time: ${String(checkH).padStart(2, '0')}:${String(confM).padStart(2, '0')})`);

    // Find all PENDING records for today
    const pendingRecords = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({
      event_date: currentDay,
      confirmation_status: 'PENDING'
    });

    console.log(`📋 Found ${pendingRecords.length} PENDING records for today`);

    if (pendingRecords.length === 0) {
      return Response.json({ date: currentDay, timed_out: 0 });
    }

    // All pending records at this point are considered timed out
    // (we only run 2 hours after send time)
    const timedOutRecords = pendingRecords;

    console.log(`⏰ ${timedOutRecords.length} records to process as NO_RESPONSE`);

    if (timedOutRecords.length === 0) {
      return Response.json({ date: currentDay, timed_out: 0, pending: pendingRecords.length });
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
    if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;

    // Get all active employees to find office managers
    const allEmployees = await base44.asServiceRole.entities.TaskEmployee.filter({ is_active: true });
    const officeManagers = allEmployees.filter(emp => emp.role_name === "מנהלת משרד");

    let recordsUpdated = 0;
    let escalationsSent = 0;

    for (const record of timedOutRecords) {
      // 1. Update status to NO_RESPONSE
      await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
        confirmation_status: 'NO_RESPONSE',
        confirmation_response_at: now.toISOString(),
      });
      recordsUpdated++;
      console.log(`📝 ${record.employee_name} marked as NO_RESPONSE for ${record.event_name}`);

      // 2. Send escalation to office manager(s) — tasks are NOT automatically changed.
      //    Tasks only become NOT_ARRIVING when the employee explicitly says "לא בסידור".
      if (accountSid && authToken && officeManagers.length > 0) {
        const eventDateFormatted = formatHebrewDate(record.event_date);

        for (const mgr of officeManagers) {
          const toPhone = normalizePhone(mgr.phone_e164);
          if (!toPhone || toPhone.length < 8) continue;

          const contentVariables = JSON.stringify({
            "1": record.employee_name,
            "2": eventDateFormatted,
          });

          const formData = new URLSearchParams();
          formData.append("From", fromNumber);
          formData.append("To", "whatsapp:" + toPhone);
          formData.append("ContentSid", NO_ANSWER_ESC_CONTENT_SID);
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
            escalationsSent++;
            console.log(`📤 No-response escalation sent to ${mgr.full_name} about ${record.employee_name}`);
          } else {
            const err = await response.json();
            console.error(`❌ Escalation to ${mgr.full_name} failed: ${err.message || err.error_message}`);
          }
        }

        // Update record with manager notification timestamp
        await base44.asServiceRole.entities.EmployeeDailyAvailability.update(record.id, {
          manager_notified_at: now.toISOString(),
          manager_replacement_status: 'PENDING'
        });
      }
    }

    console.log(`✅ Done: ${recordsUpdated} records updated, ${escalationsSent} escalations sent`);

    return Response.json({
      date: currentDay,
      timed_out: recordsUpdated,
      escalations_sent: escalationsSent,
      still_pending: pendingRecords.length - timedOutRecords.length,
      completed_at: now.toISOString()
    });

  } catch (error) {
    console.error("❌ availabilityNoResponseChecker error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizePhone(phone) {
  if (!phone) return '';
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