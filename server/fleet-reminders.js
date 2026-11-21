// Pool Shed v1.53 — daily monthly-van-report reminder emails (Vercel cron, once a day).
// Sends only when ALL of these are true: the request carries the CRON_SECRET; the ps_feature_flags row
// 'fleet_email_reminders' is on (starts OFF); RESEND_API_KEY and QUOTE_FROM_EMAIL are set. Who to email and when is
// decided by the database (ps_fleet_reminders_due); each email is logged so nobody is emailed twice the same day.

const esc = v => String(v == null ? '' : v).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const monthName = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function engineerEmail(row, period, appUrl) {
  const m = monthName(period);
  const returned = row.status === 'returned';
  const subject = returned ? `Your van report for ${m} was sent back (${row.registration})` : `Your van report for ${m} is due (${row.registration})`;
  const text = `Hello ${row.name || ''},\n\n` +
    (returned ? `Your ${m} van report for ${row.registration} was sent back: "${row.review_note || ''}". Please update it and submit it again.\n\n`
              : `Please complete the ${m} van report for ${row.registration} (${row.van}): mileage, checks, any dents or scratches with photos, the van supplies count, and your signature.\n\n`) +
    `Open Pool Shed → Vans & Fleet: ${appUrl}\n\nThank you,\nPool Bros`;
  return { subject, text };
}

export function managerEmail(outstanding, period, appUrl) {
  const m = monthName(period);
  const lines = outstanding.map(o => `• ${o.registration} (${o.engineer || 'no engineer assigned'}): ${o.status === 'submitted' ? 'waiting for your sign-off' : o.status === 'returned' ? 'sent back, waiting for the engineer' : o.status === 'draft' ? 'started, not submitted' : 'not started'}`);
  return { subject: `Van reports for ${m}: ${outstanding.length} still open`, text: `Van reports for ${m} that are not signed off yet:\n\n${lines.join('\n')}\n\nOpen Pool Shed → Vans & Fleet: ${appUrl}\n\nPool Shed` };
}

export async function runFleetReminders({ db, send, w = 'pool-bros-main', today = new Date().toISOString().slice(0, 10), appUrl = process.env.APP_ORIGIN || '' } = {}) {
  const due = await db('rpc/ps_fleet_reminders_due', { method: 'POST', body: { w, today } });
  if (!due || !due.enabled) return { skipped: 'fleet_email_reminders is off', wouldEmail: { engineers: (due && due.engineers || []).length, managers: (due && due.managers || []).length } };
  if (!process.env.RESEND_API_KEY || !process.env.QUOTE_FROM_EMAIL) return { skipped: 'email is not configured (RESEND_API_KEY, QUOTE_FROM_EMAIL)' };
  const sent = [], failed = [];
  for (const e of due.engineers || []) {
    try { const mail = engineerEmail(e, due.period, appUrl); await send(e.email, mail.subject, mail.text, `van-report-${due.period}-${e.user_id}-${today}`);
      await db('rpc/ps_fleet_reminder_sent', { method: 'POST', body: { w, per: due.period, kind: 'engineer', recipient: e.user_id, today, detail: { registration: e.registration, status: e.status } } });
      sent.push(e.email); } catch (err) { failed.push({ to: e.email, error: String(err.message || err) }); }
  }
  const open = due.outstanding || [];
  for (const m of open.length ? (due.managers || []) : []) {
    try { const mail = managerEmail(open, due.period, appUrl); await send(m.email, mail.subject, mail.text, `van-report-managers-${due.period}-${m.user_id}-${today}`);
      await db('rpc/ps_fleet_reminder_sent', { method: 'POST', body: { w, per: due.period, kind: 'manager', recipient: m.user_id, today, detail: { open: open.length } } });
      sent.push(m.email); } catch (err) { failed.push({ to: m.email, error: String(err.message || err) }); }
  }
  return { sent: sent.length, failed };
}

export async function resendEmail(to, subject, text, idempotencyKey) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: process.env.QUOTE_FROM_EMAIL, to: [to], subject, text }) });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || ('Email provider rejected the request (' + r.status + ')')); }
  return true;
}
