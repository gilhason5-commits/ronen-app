import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Params: to_phone_e164, task_title, event_name, start_time, end_time, task_id, employee_name
    const { to_phone_e164, task_title, event_name, start_time, end_time, task_id, employee_name } = await req.json();

    // Validation
    if (!to_phone_e164 || to_phone_e164.trim() === '') {
      console.error("❌ Phone number missing");
      return Response.json({ error: "Phone number missing", failed_at: new Date().toISOString() });
    }

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const contentSid = Deno.env.get("TWILIO_CONTENT_SID");
    let fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || "+972535662556";
    if (!fromNumber.startsWith("whatsapp:")) {
      fromNumber = "whatsapp:" + fromNumber;
    }

    if (!accountSid || !authToken) {
      console.error("❌ Twilio credentials not configured");
      return Response.json({ error: "Twilio credentials not configured", failed_at: new Date().toISOString() });
    }

    if (!contentSid) {
      console.error("❌ TWILIO_CONTENT_SID not configured");
      return Response.json({ error: "TWILIO_CONTENT_SID not configured", failed_at: new Date().toISOString() });
    }

    // Format phone number - strip invisible/RTL characters
    let toWhatsapp = to_phone_e164.replace(/[^\d+]/g, '');
    if (toWhatsapp.startsWith("0")) toWhatsapp = "+972" + toWhatsapp.substring(1);
    if (!toWhatsapp.startsWith("+")) toWhatsapp = "+" + toWhatsapp;
    toWhatsapp = "whatsapp:" + toWhatsapp;

    // Twilio API call with Content Template
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    // Template variables:
    // {{1}} = task_title (משימה לביצוע)
    // {{2}} = event_name (האירוע שאליו משויכת המשימה)
    // {{3}} = start_time (שעת התחלה)
    // {{4}} = end_time (שעת סיום)
    // {{5}} = task_id (קוד זיהוי המשימה)
    // {{6}} = employee_name (שם העובד)
    const contentVariables = JSON.stringify({
      "1": task_title || "-",
      "2": event_name || "-",
      "3": start_time || "-",
      "4": end_time || "-",
      "5": task_id || "-",
      "6": employee_name || "-"
    });

    const formData = new URLSearchParams();
    formData.append("From", fromNumber);
    formData.append("To", toWhatsapp);
    formData.append("ContentSid", contentSid);
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

    const result = await response.json();

    if (response.ok) {
      console.log(`📤 Sent WhatsApp template to ${to_phone_e164}, task: ${task_title}`);
      return Response.json({
        message_sid: result.sid,
        status: result.status,
        sent_at: new Date().toISOString()
      });
    } else {
      console.error(`❌ Failed to send to ${to_phone_e164}: ${result.message || result.error_message}`);
      return Response.json({
        error: result.message || result.error_message || "Failed to send message",
        failed_at: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("❌ sendWhatsappMessage error:", error.message);
    return Response.json({ error: error.message, failed_at: new Date().toISOString() }, { status: 500 });
  }
});