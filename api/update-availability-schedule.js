import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/update-availability-schedule
 * Body: { hour: "11:00" }
 * Updates the AppSetting for availability_send_hour.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { hour } = req.body || {};
  if (!hour) return res.status(400).json({ error: 'Missing hour' });

  // Upsert the setting
  const { data: existing } = await supabase
    .from('AppSetting')
    .select('id')
    .eq('key', 'availability_send_hour')
    .single();

  if (existing) {
    await supabase.from('AppSetting').update({ value: hour }).eq('id', existing.id);
  } else {
    await supabase.from('AppSetting').insert({ key: 'availability_send_hour', value: hour });
  }

  return res.status(200).json({ success: true, hour });
}
