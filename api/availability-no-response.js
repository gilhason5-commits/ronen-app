import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET/POST /api/availability-no-response  (Vercel Cron: every 5 minutes)
 * Runs 2 hours after availability_send_hour.
 * Marks PENDING availability as NO_RESPONSE and escalates to office manager.
 */
export default async function handler(req, res) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find PENDING records sent more than 2 hours ago
    const { data: pending } = await supabase
      .from('EmployeeDailyAvailability')
      .select('*, Event:event_id(event_name, event_time)')
      .eq('confirmation_status', 'PENDING')
      .lt('confirmation_sent_at', twoHoursAgo);

    if (!pending?.length) return res.status(200).json({ message: 'No pending records', processed: 0 });

    let processed = 0;

    for (const record of pending) {
      // Update to NO_RESPONSE
      await supabase
        .from('EmployeeDailyAvailability')
        .update({ confirmation_status: 'NO_RESPONSE' })
        .eq('id', record.id);

      // Find office manager to escalate to
      const { data: managerRole } = await supabase
        .from('EmployeeRole')
        .select('id')
        .eq('is_manager', true)
        .limit(1)
        .single();

      if (managerRole) {
        const { data: manager } = await supabase
          .from('TaskEmployee')
          .select('full_name, phone_e164')
          .eq('role_id', managerRole.id)
          .eq('is_active', true)
          .single();

        if (manager?.phone_e164) {
          try {
            await sendWhatsApp(manager.phone_e164, TEMPLATES.NO_ANSWER_ESC, {
              '1': record.employee_name,
              '2': record.Event?.event_name || 'אירוע',
              '3': record.Event?.event_time || '',
            });

            await supabase
              .from('EmployeeDailyAvailability')
              .update({ manager_notified_at: new Date().toISOString() })
              .eq('id', record.id);
          } catch (err) {
            console.error(`Failed to escalate for ${record.employee_name}:`, err.message);
          }
        }
      }

      processed++;
    }

    return res.status(200).json({ success: true, processed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
