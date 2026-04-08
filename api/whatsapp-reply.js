import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/whatsapp-reply
 * Twilio webhook for incoming WhatsApp messages.
 * Handles:
 *  - Availability replies (כן/לא) → updates EmployeeDailyAvailability
 *  - Task replies (בוצע/לא בוצע) → updates TaskAssignment
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const from = req.body?.From || '';
  const messageBody = (req.body?.Body || '').trim();
  const phone = from.replace('whatsapp:', '');

  if (!phone) return xmlResponse(res, '');

  // Find employee by phone
  const { data: employee } = await supabase
    .from('TaskEmployee')
    .select('id, full_name')
    .eq('phone_e164', phone)
    .single();

  if (!employee) {
    return xmlResponse(res, 'מספר הטלפון שלך לא נמצא במערכת. פנה למנהל.');
  }

  const lower = messageBody.toLowerCase();
  const isYes = ['כן', 'yes', '✅', 'זמין', 'זמינה', 'אשר', 'בוצע', '1'].some(w => lower.includes(w));
  const isNo  = ['לא', 'no', '❌', 'לא זמין', 'לא בוצע', '2'].some(w => lower.includes(w));
  const isDone    = ['בוצע', '✅', 'done', 'yes'].some(w => lower.includes(w));
  const isNotDone = ['לא בוצע', '❌', 'not done'].some(w => lower.includes(w));

  // ── Check for pending TASK assignment first ──────────────────────
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const { data: pendingTask } = await supabase
    .from('TaskAssignment')
    .select('id, task_title, escalate_to_manager, escalation_employee_id, escalation_employee_phone, manager_id, manager_name')
    .eq('assigned_to_id', employee.id)
    .eq('status', 'PENDING')
    .gte('reminder_sent_at', oneHourAgo)
    .order('reminder_sent_at', { ascending: false })
    .limit(1)
    .single();

  if (pendingTask && (isDone || isNotDone)) {
    const newStatus = isDone ? 'DONE' : 'NOT_DONE';
    await supabase
      .from('TaskAssignment')
      .update({ status: newStatus })
      .eq('id', pendingTask.id);

    if (newStatus === 'NOT_DONE' && pendingTask.escalate_to_manager) {
      const escalationPhone = pendingTask.escalation_employee_phone ||
        (pendingTask.escalation_employee_id ? await getPhone(pendingTask.escalation_employee_id) : null) ||
        (pendingTask.manager_id ? await getPhone(pendingTask.manager_id) : null);

      if (escalationPhone) {
        await sendWhatsApp(escalationPhone, TEMPLATES.TASK_ESCALATION, {
          '1': pendingTask.manager_name || '',
          '2': pendingTask.task_title || '',
          '3': employee.full_name,
          '4': '',
        }).catch(console.error);
      }
    }

    const reply = isDone
      ? `תודה ${employee.full_name}! ✅ המשימה "${pendingTask.task_title}" סומנה כבוצעה.`
      : `${employee.full_name}, רשמנו שהמשימה "${pendingTask.task_title}" לא בוצעה. ❌`;

    return xmlResponse(res, reply);
  }

  // ── Check for pending AVAILABILITY record ────────────────────────
  const { data: pendingAvail } = await supabase
    .from('EmployeeDailyAvailability')
    .select('id, event_id, Event:event_id(event_name)')
    .eq('employee_id', employee.id)
    .eq('confirmation_status', 'PENDING')
    .order('confirmation_sent_at', { ascending: false })
    .limit(1)
    .single();

  if (pendingAvail && (isYes || isNo)) {
    const newStatus = isYes ? 'CONFIRMED_AVAILABLE' : 'CONFIRMED_UNAVAILABLE';

    await supabase
      .from('EmployeeDailyAvailability')
      .update({
        confirmation_status: newStatus,
        confirmation_response_at: now.toISOString(),
      })
      .eq('id', pendingAvail.id);

    if (newStatus === 'CONFIRMED_UNAVAILABLE') {
      // Mark associated tasks as NOT_ARRIVING
      await supabase
        .from('TaskAssignment')
        .update({ status: 'NOT_ARRIVING' })
        .eq('event_id', pendingAvail.event_id)
        .eq('assigned_to_id', employee.id);

      // Escalate to office manager
      const { data: managerRole } = await supabase
        .from('EmployeeRole')
        .select('id')
        .eq('is_manager', true)
        .limit(1)
        .single();

      if (managerRole) {
        const { data: manager } = await supabase
          .from('TaskEmployee')
          .select('phone_e164, full_name')
          .eq('role_id', managerRole.id)
          .eq('is_active', true)
          .single();

        if (manager?.phone_e164) {
          await sendWhatsApp(manager.phone_e164, TEMPLATES.MANAGER_UNAVAILABLE_ESC, {
            '1': manager.full_name,
            '2': employee.full_name,
            '3': pendingAvail.Event?.event_name || 'אירוע',
          }).catch(console.error);
        }
      }
    }

    const reply = isYes
      ? `תודה ${employee.full_name}! ✅ אישרנו שאת/ה מגיע/ה.`
      : `תודה ${employee.full_name}. ❌ רשמנו שאת/ה לא מגיע/ה. המנהל יקבל הודעה.`;

    return xmlResponse(res, reply);
  }

  // Unrecognized
  return xmlResponse(res, 'לא הבנתי. ענה *כן* / *לא* לשאלת זמינות, או *בוצע* / *לא בוצע* למשימה.');
}

function xmlResponse(res, message) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(`<?xml version="1.0"?><Response>${message ? `<Message>${message}</Message>` : ''}</Response>`);
}

async function getPhone(employeeId) {
  if (!employeeId) return null;
  const { data } = await supabase.from('TaskEmployee').select('phone_e164').eq('id', employeeId).single();
  return data?.phone_e164 || null;
}
