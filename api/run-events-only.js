/**
 * GET/POST /api/run-events-only
 *
 * A trimmed-down variant of /api/run-all that only fires the crons relevant
 * to event-day reminders + escalations. Use this on days when the regular
 * recurring-task crons are intentionally paused (e.g. cron-job.org skipping
 * Fridays for kashrut reasons) so event tasks still get their reminders.
 *
 * Skipped on purpose:
 *   - /api/peti-vor-availability   (Peti Vor recurring availability check)
 *   - /api/recurring-tasks-generator (creates the next 30 days of recurring rows)
 *
 * tasks-scheduler is called with ?events_only=1 so it filters to rows that
 * have a non-null event_id and ignores recurring assignments entirely.
 */
export default async function handler(req, res) {
  const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  const endpoints = [
    '/api/arrive-today',
    '/api/availability-no-response',
    '/api/ceo-escalation',
    '/api/tasks-scheduler?events_only=1',
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
