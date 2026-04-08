/**
 * GET/POST /api/run-all
 * Calls all scheduled automations. Designed to be called every 10 minutes by cron-job.org.
 * Each sub-function handles its own time-window logic.
 */
export default async function handler(req, res) {
  const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  const endpoints = [
    '/api/arrive-today',
    '/api/availability-no-response',
    '/api/ceo-escalation',
    '/api/tasks-scheduler',
  ];

  const results = {};

  for (const path of endpoints) {
    try {
      const r = await fetch(`${base}${path}`, { method: 'POST' });
      results[path] = await r.json();
    } catch (err) {
      results[path] = { error: err.message };
    }
  }

  return res.status(200).json({ ok: true, results });
}
