// Vans & Fleet screen wiring: menu entry, permissions, page hook, script and offline cache.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const app = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const perms = fs.readFileSync('public/settings-permissions-engine.js', 'utf8');
const ui = fs.readFileSync('public/fleet-workspace.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(/\{ id: "fleet", label: "Vans & Fleet"/.test(app), 'menu entry');
assert(/if \(active === "fleet"\) \{[^}]*getElementById\("screen-fleet"\)/.test(app), 'page hook writes into its screen');
assert(/<section id="screen-fleet" class="screen grid hidden"><\/section>/.test(index), 'screen area exists');
assert(/'warehouse','fleet','fulfilment'/.test(perms) && /r\.fleet=perm\(true,true,true,false,false\)/.test(perms), 'every role may open it; the database limits what they see');
assert(/fleet-workspace\.js\?v=1\.52\.0/.test(index) && /fleet-workspace\.js\?v=1\.52\.0/.test(sw), 'script loaded and cached offline');
for (const fn of ['ps_fleet_vans','ps_fleet_van_save','ps_fleet_van_kit','ps_fleet_report_open','ps_fleet_report_save','ps_fleet_damage_add','ps_fleet_report_submit','ps_fleet_report_review','ps_fleet_damage_close'])
  assert(ui.includes("'" + fn + "'"), 'uses ' + fn);
assert(!/rpc\('ps_fleet_report_open'[^;]*\n?[^;]*s\.editing\.kit/.test(ui), 'editing a van never starts a report');
assert(/action=fleet-upload/.test(ui) && /action=fleet-sign/.test(ui), 'photos and signatures through the protected fleet store');
console.log('Fleet UI v1.52: menu, permissions, page hook, script and offline cache wired.');
