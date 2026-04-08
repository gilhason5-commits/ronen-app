import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp, TEMPLATES } from './_twilio.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET/POST /api/ceo-escalation  (Vercel Cron: every 15 minutes)
 * If manager was notified about unavailable/no-response employee 30+ minutes ago
 * and no replacement was confirmed → escalate to CEO.
 */
export default async function handler(req, res) {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: records } = await supabase
      .from('EmployeeDailyAvailability')
      .select('*, Event:event_id(event_name, event_time)')
      .in('confirmation_status', ['CONFIRMED_UNAVAILABLE', 'NO_RESPONSE'])
      .lt('manager_notified_at', thirtyMinAgo)
      .is('ceo_escalated_at', null)
      .not('manager_notified_at', 'is', null);

    if (!records?.length) return res.status(200).json({ message: 'No escalations needed', sent: 0 });

    // Find CEO
    const { data: ceoRole } = await supabase
      .from('EmployeeRole')
      .select('id')
      .ilike('role_name', '%מנכ%')
      .limit(1)
      .single();

    let ceoPhone = null;
    if (ceoRole) {
      const { data: ceo } = await supabase
        .from('TaskEmployee')
        .select('full_name, phone_e164')
        .eq('role_id', ceoRole.id)
        .eq('is_active', true)
        .single();
      ceoPhone = ceo?.phone_e164;
    }

    if (!ceoPhone) return res.status(200).json({ message: 'CEO not found', sent: 0 });

    let sent = 0;

    for (const record of records) {
      try {
        await sendWhatsApp(ceoPhone, TEMPLATES.CEO_ESC_FINAL, {
          '1': record.employee_name,
          '2': record.Event?.event_name || 'אירוע',
          '3': record.Event?.event_time || '',
          '4': record.confirmation_status === 'NO_RESPONSE' ? 'לא ענה' : 'לא זמין',
        });

        await supabase
          .from('EmployeeDailyAvailability')
          .update({ ceo_escalated_at: new Date().toISOString() })
          .eq('id', record.id);

        sent++;
      } catch (err) {
        console.error(`CEO escalation failed for ${record.employee_name}:`, err.message);
      }
    }

    return res.status(200).json({ success: true, sent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
