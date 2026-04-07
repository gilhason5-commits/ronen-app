import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { record_id } = await req.json();

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
  if (!fromNumber.startsWith("whatsapp:")) fromNumber = "whatsapp:" + fromNumber;
  const contentSid = "HXeb24b73630eed144cd02fe9af16a5ece"; // arrive_today template

  // Get the record
  const records = await base44.asServiceRole.entities.EmployeeDailyAvailability.filter({ id: record_id });
  const record = records[0];
  if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });

  // Format date
  const months = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const d = new Date(record.event_date + 'T00:00:00');
  const eventDateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  // Normalize phone
  let phone = record.employee_phone.replace(/[^\d+]/g, '');
  if (phone.startsWith("0")) phone = "+972" + phone.substring(1);
  if (!phone.startsWith("+")) phone = "+" + phone;
  const toWhatsapp = "whatsapp:" + phone;

  const contentVariables = JSON.stringify({
    "1": record.employee_name,
    "2": eventDateFormatted,
    "3": record.id
  });

  const formData = new URLSearchParams();
  formData.append("From", fromNumber);
  formData.append("To", toWhatsapp);
  formData.append("ContentSid", contentSid);
  formData.append("ContentVariables", contentVariables);

  console.log(`📤 Sending test availability message to ${record.employee_name} (${toWhatsapp})`);
  console.log(`📋 ContentVariables: ${contentVariables}`);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(accountSid + ":" + authToken)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  const result = await response.json();

  if (response.ok) {
    console.log(`✅ Message sent! SID: ${result.sid}`);
    return Response.json({ success: true, sid: result.sid, record_id: record.id });
  } else {
    console.error(`❌ Failed: ${result.message || result.error_message}`);
    return Response.json({ success: false, error: result.message || result.error_message });
  }
});