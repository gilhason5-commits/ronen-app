import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'protocol-files';

// Protocols page PDF attachments: hands a signed-in admin a one-time signed
// upload URL into the public protocol-files bucket, so the browser uploads
// straight to Storage without needing storage RLS policies.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const path = `${crypto.randomUUID()}.pdf`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return res.status(200).json({ path, token: data.token, publicUrl });
}
