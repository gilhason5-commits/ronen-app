import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/whatsapp-reply
 * Twilio webhook for incoming WhatsApp messages (employee availability replies).
 * Twilio sends form-encoded body with: From, Body, etc.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const from = req.body?.From || ''; // e.g. "whatsapp:+972501234567"
  const messageBody = (req.body?.Body || '').trim().toLowerCase();

  const phoneNumber = from.replace('whatsapp:', '');

  if (!phoneNumber) {
    return res.status(400).send('<?xml version="1.0"?><Response></Response>');
  }

  // Map reply to status
  const YES_WORDS = ['כן', 'yes', '1', 'זמין', 'זמינה', 'אשר'];
  const NO_WORDS = ['לא', 'no', '2', 'לא זמין', 'לא זמינה'];

  let newStatus = null;
  if (YES_WORDS.some(w => messageBody.includes(w))) {
    newStatus = 'CONFIRMED_AVAILABLE';
  } else if (NO_WORDS.some(w => messageBody.includes(w))) {
    newStatus = 'CONFIRMED_UNAVAILABLE';
  }

  if (!newStatus) {
    // Unrecognized reply — send help message
    return res.status(200).send(`<?xml version="1.0"?>
<Response>
  <Message>לא הבנתי. ענה *כן* אם זמין/ה או *לא* אם לא זמין/ה.</Message>
</Response>`);
  }

  // Find employee by phone
  const { data: employee } = await supabase
    .from('TaskEmployee')
    .select('id, full_name')
    .eq('phone_e164', phoneNumber)
    .single();

  if (!employee) {
    return res.status(200).send(`<?xml version="1.0"?>
<Response>
  <Message>מספר הטלפון שלך לא נמצא במערכת. פנה למנהל.</Message>
</Response>`);
  }

  // Find the most recent PENDING availability request for this employee
  const { data: pending } = await supabase
    .from('EmployeeDailyAvailability')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('confirmation_status', 'PENDING')
    .order('confirmation_sent_at', { ascending: false })
    .limit(1)
    .single();

  if (!pending) {
    return res.status(200).send(`<?xml version="1.0"?>
<Response>
  <Message>לא נמצאה בקשת זמינות פתוחה עבורך. תודה!</Message>
</Response>`);
  }

  // Update the availability record
  await supabase
    .from('EmployeeDailyAvailability')
    .update({
      confirmation_status: newStatus,
      confirmation_response_at: new Date().toISOString(),
    })
    .eq('id', pending.id);

  const replyMessage = newStatus === 'CONFIRMED_AVAILABLE'
    ? `תודה ${employee.full_name}! ✅ אישרנו שאת/ה זמין/ה לאירוע.`
    : `תודה ${employee.full_name}. ❌ רשמנו שאת/ה לא זמין/ה לאירוע.`;

  return res.status(200).send(`<?xml version="1.0"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>`);
}
