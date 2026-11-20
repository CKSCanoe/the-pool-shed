// Van report reminders guard: emails start OFF, only the server can read who to email, cron is protected.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql = fs.readFileSync('database/028-fleet-reminders.sql', 'utf8').replace(/--.*$/gm, '');
assert(/values \('fleet_email_reminders', false,/.test(sql), 'email reminders start switched off');
assert(/on conflict \(name\) do nothing/.test(sql), 'never switches an existing setting back on or off');
assert(/revoke all on public\.ps_fleet_reminder_log from anon, authenticated/.test(sql), 'log is server-only');
for (const fn of ['ps_fleet_reminders_due\\(text,date\\)', 'ps_fleet_reminder_sent\\(text,date,text,uuid,date,jsonb\\)']) {
  assert(new RegExp('revoke all on function public\\.' + fn + ' from public, anon, authenticated').test(sql), fn + ' hidden from staff');
  assert(new RegExp('grant execute on function public\\.' + fn + ' to service_role').test(sql), fn + ' for the server');
}
assert(/\(dom = 1 or \(dom - 1\) % 3 = 0 or r\.status = 'returned'\)/.test(sql), 'engineers: 1st, every 3 days, or straight away when sent back');
assert(/if dom in \(8, 15, 22\)/.test(sql), 'managers: 8th, 15th, 22nd');
assert(/l\.sent_on = today/.test(sql), 'never twice the same day');
assert(/case when \(me->>'manager'\)::boolean then v\.insurance_policy else null end/.test(sql), 'van list still hides policy numbers from engineers');
const api = fs.readFileSync('api/workspace-health.js', 'utf8');
assert(/!process\.env\.CRON_SECRET\|\|req\.headers\.authorization!=='Bearer '\+process\.env\.CRON_SECRET\)return send\(res,401/.test(api), 'cron needs the secret');
const cron = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons || [];
assert(cron.some(c => c.path === '/api/workspace-health?fleet-reminders=1'), 'daily cron scheduled');
const ui = fs.readFileSync('public/fleet-workspace.js', 'utf8');
assert(/poolshed:fleet-reminder-dismissed:/.test(ui), 'banner can be hidden for today');
console.log('Migration 028 guard passed (van report reminders).');
