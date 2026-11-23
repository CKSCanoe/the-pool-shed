/* Pool Shed v1.91.0 — Vans & Fleet (monthly report reminders added in v1.53).
   Managers (Admin, Management): van register, MOT / tax / insurance / service, documents, supplies list, monthly report
   review and sign-off, damage register. Engineers: "My van" and the monthly report on their phone.
   Every rule (own van only, locked after submit, signatures, sign-off by someone else) is enforced by the database (026/027). */
(function(global){
  'use strict';
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var AREAS = ['Front','Rear','Left side','Right side','Roof','Windscreen','Interior','Wheels and tyres'];
  var SEVERITY = ['Minor scratch','Scratch','Dent','Major damage'];
  var s = { vans: null, me: null, loading: false, error: '', view: 'list', vanId: null, editing: null, report: null, history: null, busy: false, msg: null, signed: {} };

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function day(v){ return v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function month(v){ return v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''; }
  function rerender(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); } catch (_) {} }
  function friendly(e){ return String(e && (e.message || e.error) || e || 'Something went wrong').replace(/^.*?ERROR:\s*/, ''); }
  function users(){ return typeof global.__POOL_SHED_ALL_USERS__ === 'function' ? (global.__POOL_SHED_ALL_USERS__() || []) : []; }
  function tone(st){ return st === 'Overdue' || st === 'Missing' ? 'bad' : st === 'Due soon' ? 'warn' : 'good'; }
  function pill(t, k){ return '<span class="finance-pill ' + (k || 'dark') + '">' + esc(t) + '</span>'; }
  function plate(r){ return '<span class="fleet-plate">' + esc(r) + '</span>'; }
  function panel(title, help, body, actions){ return '<section class="finance-panel"><header class="finance-panel-head"><div><h3>' + esc(title) + '</h3><p>' + esc(help || '') + '</p></div>' + (actions ? '<div class="finance-row-actions">' + actions + '</div>' : '') + '</header><div class="finance-panel-body">' + body + '</div></section>'; }
  function btn(label, action, cls, attrs){ return '<button type="button" class="' + (cls || 'secondary') + '" data-fl="' + action + '" ' + (attrs || '') + '>' + esc(label) + '</button>'; }

  async function rpc(name, args){ var db = DB(); if (!db) throw new Error('Not connected. Sign in again.'); var r = await db.rpc(name, args); if (r.error) throw r.error; return r.data; }
  async function token(){ return typeof global.__POOL_SHED_AUTH_TOKEN__ === 'function' ? await global.__POOL_SHED_AUTH_TOKEN__() : ''; }
  async function upload(vanId, kind, blob, name){
    if (blob.size > 25 * 1024 * 1024) throw new Error('The file is larger than 25 MB.');
    var r = await fetch('/api/media?action=fleet-upload&workspace=' + encodeURIComponent(W()) + '&vanId=' + encodeURIComponent(vanId) + '&kind=' + encodeURIComponent(kind) + '&name=' + encodeURIComponent(name || kind),
      { method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    var body = await r.json().catch(function(){ return {}; });
    if (!r.ok) throw new Error(body.error || 'Upload failed.');
    return body.ref;
  }
  async function signRefs(refs){
    refs = (refs || []).filter(function(r){ return r && /^fleet-media:/.test(r) && !s.signed[r]; });
    if (!refs.length) return;
    var r = await fetch('/api/media?action=fleet-sign&workspace=' + encodeURIComponent(W()) + '&refs=' + refs.map(encodeURIComponent).join(','), { headers: { Authorization: 'Bearer ' + await token() } });
    var body = await r.json().catch(function(){ return {}; });
    Object.assign(s.signed, body.urls || {}); rerender();
  }

  async function load(force){
    if (s.loading || (!force && s.vans)) return;
    s.loading = true; s.error = '';
    try { s.vans = await rpc('ps_fleet_vans', { w: W() }) || []; s.me = { manager: isManager() }; }
    catch (e) { s.error = friendly(e); s.vans = s.vans || []; }
    s.loading = false; rerender();
  }
  function isManager(){ var u = typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? global.__POOL_SHED_CURRENT_USER__() : {}; return ['Admin','Management','Manager'].indexOf(String(u && u.role)) >= 0; }

  // ---------- Fleet overview (managers) / My van (everyone else) ----------
  function render(){
    load(false);
    if (s.view === 'edit') return editView();
    if (s.view === 'report') return reportView();
    var vans = s.vans || [], mgr = isManager();
    if (!mgr) {
      if (!vans.length) return panel('My van', '', '<p class="muted">' + (s.loading ? 'Loading…' : 'No van is assigned to you yet. Ask the office to assign your van.') + '</p>');
      return vans.map(myVanCard).join('');
    }
    var issues = vans.filter(function(v){ return v.worst_state !== 'OK'; }).length;
    var waiting = vans.filter(function(v){ return v.report_status === 'submitted'; }).length;
    var damage = vans.reduce(function(t, v){ return t + Number(v.open_damage || 0); }, 0);
    var metrics = '<div class="finance-command-metrics">' + metric('Vans', vans.length, 'on the road') + metric('MOT / tax / insurance / service', issues, 'vans with something due or overdue') +
      metric('Reports to sign off', waiting, month(new Date().toISOString())) + metric('Open damage', damage, 'dents and scratches not yet repaired') + '</div>';
    var rows = vans.map(function(v){
      var rep = v.report_status === 'signed_off' ? pill('Signed off', 'good') : v.report_status === 'submitted' ? pill('Waiting for your sign-off', 'warn') :
                v.report_status === 'returned' ? pill('Sent back', 'warn') : v.report_status === 'draft' ? pill('In progress', 'dark') : pill('Not started', new Date().getDate() > 7 ? 'bad' : 'dark');
      return '<tr><td>' + plate(v.registration) + '<br><small>' + esc([v.make, v.model, v.year, v.colour].filter(Boolean).join(' · ')) + '</small></td>' +
        '<td>' + esc(v.assigned_name || 'Not assigned') + '<br><small>' + (v.odometer != null ? esc(Number(v.odometer).toLocaleString('en-GB')) + ' miles' : '') + '</small></td>' +
        '<td>' + due('MOT', v.mot_due, v.mot_state) + due('Tax', v.tax_due, v.tax_state) + due('Insurance', v.insurance_due, v.insurance_state) + due('Service', v.service_due, v.service_state) + '</td>' +
        '<td>' + rep + (Number(v.open_damage) ? '<br>' + pill(v.open_damage + ' open damage', 'warn') : '') + '</td>' +
        '<td class="finance-row-actions">' + btn(v.report_status === 'submitted' ? 'Review report' : 'Monthly report', 'open-report', v.report_status === 'submitted' ? 'primary small' : 'secondary small', 'data-van="' + esc(v.id) + '"') +
        btn('Edit van', 'edit', 'secondary small', 'data-van="' + esc(v.id) + '"') + '</td></tr>';
    }).join('');
    var table = vans.length ? '<table class="finance-table fleet-table"><thead><tr><th>Van</th><th>Engineer</th><th>Compliance</th><th>This month</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
                            : '<p class="muted">' + (s.loading ? 'Loading…' : 'No vans yet. Add your first van.') + '</p>';
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') + (s.msg ? '<div class="pp-result good">' + s.msg + '</div>' : '') + metrics +
      panel('Vans', 'Each engineer completes a van report every month; you review and sign it off.', table, btn('Add a van', 'new', 'primary') + btn('Refresh', 'refresh'));
  }
  function metric(l, v, h){ return '<div class="finance-metric"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong><small>' + esc(h || '') + '</small></div>'; }
  function due(label, date, st){ return '<div class="fleet-due"><span>' + esc(label) + '</span> ' + pill(st === 'Missing' ? 'Not set' : day(date), tone(st)) + '</div>'; }
  function myVanCard(v){
    var st = v.report_status, cta = st === 'signed_off' ? pill('This month: signed off', 'good') : st === 'submitted' ? pill('Submitted, waiting for sign-off', 'dark') :
      btn(st === 'returned' ? 'Fix and re-submit this month\'s report' : st === 'draft' ? 'Continue this month\'s report' : 'Start this month\'s van report', 'open-report', 'primary', 'data-van="' + esc(v.id) + '"');
    return panel('My van', esc(v.make + ' ' + v.model), '<div class="fleet-myvan">' + plate(v.registration) +
      '<div>' + due('MOT', v.mot_due, v.mot_state) + due('Tax', v.tax_due, v.tax_state) + due('Insurance', v.insurance_due, v.insurance_state) + due('Service', v.service_due, v.service_state) + '</div>' +
      '<p>' + (v.odometer != null ? 'Last mileage: <strong>' + esc(Number(v.odometer).toLocaleString('en-GB')) + '</strong>' : '') + (Number(v.open_damage) ? ' · ' + pill(v.open_damage + ' damage on record', 'warn') : '') + '</p>' + cta + '</div>');
  }

  // ---------- Add / edit a van (managers) ----------
  function editView(){
    var v = s.editing || {}, engineers = users().filter(function(u){ return u && u.id && u.status !== 'Disabled'; });
    var opt = function(val, cur){ return '<option' + (String(val) === String(cur || '') ? ' selected' : '') + '>' + esc(val) + '</option>'; };
    var field = function(label, name, val, type, extra){ return '<label>' + esc(label) + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : String(val).slice(0, type === 'date' ? 10 : 200)) + '" ' + (extra || '') + '></label>'; };
    var kit = (v.kit || []).concat([{ item: '', target_qty: '' }]).map(function(k, i){
      return '<div class="fleet-kit-row"><input name="kit_item_' + i + '" placeholder="Item, e.g. Chlorine tablets 5kg" value="' + esc(k.item || '') + '"><input name="kit_qty_' + i + '" inputmode="decimal" placeholder="Qty" value="' + esc(k.target_qty == null ? '' : k.target_qty) + '"></div>'; }).join('');
    return panel(v.id ? 'Edit van ' + (v.registration || '') : 'Add a van', 'All dates feed the compliance reminders (due soon: 30 days; service: 21 days).',
      '<form data-fl-form="van"><div class="form-grid three">' +
      field('Registration plate', 'registration', v.registration, 'text', 'required maxlength="10" style="text-transform:uppercase"') + field('Make', 'make', v.make, 'text', 'required placeholder="e.g. Ford"') +
      field('Model', 'model', v.model, 'text', 'required placeholder="e.g. Transit Custom"') + field('Variant / trim', 'variant', v.variant) + field('Year', 'year', v.year, 'number', 'min="1980" max="2100"') +
      field('Colour', 'colour', v.colour) + '<label>Fuel<select name="fuel_type"><option value=""></option>' + ['Diesel','Petrol','Electric','Hybrid','Other'].map(function(f){ return opt(f, v.fuel_type); }).join('') + '</select></label>' +
      field('VIN (chassis number)', 'vin', v.vin, 'text', 'maxlength="17"') + '<label>Status<select name="status">' + ['Active','Off road','In repair','Sold'].map(function(f){ return opt(f, v.status || 'Active'); }).join('') + '</select></label>' +
      '<label>Assigned engineer<select name="assigned_user"><option value="">Not assigned</option>' + engineers.map(function(u){ return '<option value="' + esc(u.id) + '"' + (u.id === v.assigned_user ? ' selected' : '') + '>' + esc(u.name || u.email) + ' (' + esc(u.role) + ')</option>'; }).join('') + '</select></label>' +
      field('MOT due', 'mot_due', v.mot_due, 'date') + field('Road tax due', 'tax_due', v.tax_due, 'date') +
      field('Insurer', 'insurance_provider', v.insurance_provider) + field('Policy number', 'insurance_policy', v.insurance_policy) + field('Insurance renewal', 'insurance_due', v.insurance_due, 'date') +
      field('Next service due', 'service_due', v.service_due, 'date') + field('Service due at (miles)', 'service_due_miles', v.service_due_miles, 'number') +
      field('Breakdown cover', 'breakdown_provider', v.breakdown_provider) + field('Breakdown renewal', 'breakdown_due', v.breakdown_due, 'date') +
      '<label class="full">Notes<input name="notes" value="' + esc(v.notes || '') + '"></label></div>' +
      '<h4>Van supplies (what should be on board)</h4><p class="muted">Engineers count these every month; anything short goes on the restock list.</p><div class="fleet-kit">' + kit + '</div>' +
      (v.id ? '<h4>Documents</h4><div class="form-grid three">' + ['v5','insurance','mot','service'].map(function(k){ return '<label>' + ({ v5: 'V5C logbook', insurance: 'Insurance certificate', mot: 'MOT certificate', service: 'Service record' })[k] + '<input type="file" accept="image/*,application/pdf" data-fl-doc="' + k + '"></label>'; }).join('') + '</div>' : '<p class="muted">Save the van first, then add its V5, insurance and MOT documents.</p>') +
      '<div class="finance-row-actions"><button type="submit" class="primary"' + (s.busy ? ' disabled' : '') + '>Save van</button>' + btn('Cancel', 'back') + '</div></form>');
  }

  // ---------- Monthly report (engineer fills, manager reviews) ----------
  function reportView(){
    var d = s.report; if (!d) return panel('Monthly van report', '', '<p class="muted">Loading…</p>');
    var r = d.report, v = d.van, editable = r.status === 'draft' || r.status === 'returned', reviewing = r.status === 'submitted' && isManager();
    var head = '<div class="fleet-report-head">' + plate(v.registration) + '<div><strong>' + esc(v.make + ' ' + v.model) + '</strong><br>Report for <strong>' + esc(month(r.period)) + '</strong> · ' +
      ({ draft: 'In progress', returned: 'Sent back: ' + (r.review_note || ''), submitted: 'Submitted by ' + (r.engineer_name || '') + ' on ' + day(r.submitted_at), signed_off: 'Signed off by ' + (r.manager_name || '') + ' on ' + day(r.reviewed_at) })[r.status] + '</div></div>' +
      (r.status === 'returned' ? '<div class="pp-result bad">Sent back: ' + esc(r.review_note) + '</div>' : '');
    var sections = {}; (d.checklist || []).forEach(function(c){ (sections[c.section] = sections[c.section] || []).push(c); });
    var checks = Object.keys(sections).map(function(sec){
      return '<h4>' + esc(sec) + '</h4>' + sections[sec].map(function(c){
        var a = (r.checklist || {})[c.code] || {}, ok = a.ok === true, bad = a.ok === false;
        return '<div class="fleet-check ' + (bad ? 'bad' : ok ? 'good' : '') + '"><span>' + esc(c.label) + '</span>' +
          (editable ? '<div class="fleet-okfail"><button type="button" class="' + (ok ? 'primary' : 'secondary') + ' small" data-fl="check" data-code="' + esc(c.code) + '" data-ok="1">OK</button>' +
                      '<button type="button" class="' + (bad ? 'danger' : 'secondary') + ' small" data-fl="check" data-code="' + esc(c.code) + '" data-ok="0">Problem</button></div>'
                    : '<strong>' + (ok ? 'OK' : bad ? 'Problem' : '—') + '</strong>') +
          (bad ? (editable ? '<input class="full" placeholder="What is wrong and what is being done?" value="' + esc(a.note || '') + '" data-fl-note="' + esc(c.code) + '">' : '<p class="full"><em>' + esc(a.note) + '</em></p>') : '') + '</div>'; }).join(''); }).join('');
    var kit = (r.kit_counts || []).map(function(k, i){
      var short = k.counted != null && Number(k.counted) < Number(k.expected);
      return '<div class="fleet-check ' + (short ? 'bad' : '') + '"><span>' + esc(k.item) + ' <small>(should have ' + esc(k.expected) + ')</small></span>' +
        (editable ? '<input inputmode="decimal" class="fleet-count" value="' + esc(k.counted == null ? '' : k.counted) + '" data-fl-count="' + i + '" placeholder="Count">' : '<strong>' + esc(k.counted) + (short ? ' · short' : '') + '</strong>') + '</div>'; }).join('') ||
      '<p class="muted">No supplies list set for this van yet.</p>';
    var damage = (d.open_damage || []).map(function(dm){
      signRefs(dm.photo_refs);
      return '<div class="fleet-damage"><strong>' + esc(dm.area) + ' · ' + esc(dm.severity) + '</strong><p>' + esc(dm.description) + ' <small>(' + (dm.report_id === r.id ? 'logged in this report' : 'already on record, ' + day(dm.reported_at)) + ')</small></p>' +
        '<div class="fleet-photos">' + (dm.photo_refs || []).map(function(p){ return s.signed[p] ? '<a href="' + esc(s.signed[p]) + '" target="_blank" rel="noopener"><img src="' + esc(s.signed[p]) + '" alt="Damage photo"></a>' : '<span class="muted">photo</span>'; }).join('') + '</div>' +
        (isManager() && !editable ? btn('Mark repaired', 'close-damage', 'secondary small', 'data-id="' + esc(dm.id) + '" data-outcome="Repaired"') + btn('Accept (no repair)', 'close-damage', 'secondary small', 'data-id="' + esc(dm.id) + '" data-outcome="Accepted (no repair)"') : '') + '</div>'; }).join('');
    var addDamage = editable ? '<details class="fleet-add-damage"><summary>+ Log a dent, scratch or other damage</summary><form data-fl-form="damage"><div class="form-grid three">' +
      '<label>Where<select name="area">' + AREAS.map(function(a){ return '<option>' + esc(a) + '</option>'; }).join('') + '</select></label>' +
      '<label>Type<select name="severity">' + SEVERITY.map(function(a){ return '<option>' + esc(a) + '</option>'; }).join('') + '</select></label>' +
      '<label class="full">What happened / description<input name="description" required placeholder="e.g. 5cm dent on sliding door, reversing at site"></label>' +
      '<label class="full">Photos (at least one)<input type="file" name="photos" accept="image/*" capture="environment" multiple required></label></div>' +
      '<button type="submit" class="primary"' + (s.busy ? ' disabled' : '') + '>Add damage</button></form></details>' : '';
    if (r.engineer_signature_ref) signRefs([r.engineer_signature_ref, r.manager_signature_ref]);
    var sig = function(ref, name, label){ return ref ? '<div class="fleet-sig"><span>' + esc(label) + '</span>' + (s.signed[ref] ? '<img src="' + esc(s.signed[ref]) + '" alt="Signature">' : '') + '<strong>' + esc(name || '') + '</strong></div>' : ''; };
    var submit = editable ? '<h4>Sign and submit</h4><p class="muted">By signing you confirm this report is a true record of the van\'s condition today.</p>' +
      '<canvas class="fleet-pad" data-fl-pad width="600" height="160" aria-label="Sign here"></canvas><div class="finance-row-actions">' + btn('Clear signature', 'clear-pad') + '</div>' +
      '<div class="form-grid three"><label>Your name<input data-fl-name value="' + esc((global.__POOL_SHED_CURRENT_USER__ && global.__POOL_SHED_CURRENT_USER__().name) || '') + '"></label></div>' +
      btn(s.busy ? 'Submitting…' : 'Submit report', 'submit', 'primary', s.busy ? 'disabled' : '') : '';
    var review = reviewing ? '<h4>Your review</h4><label class="full">Comments (required to send back)<input data-fl-review-note placeholder="e.g. Book the tyre in this week"></label>' +
      '<canvas class="fleet-pad" data-fl-pad width="600" height="160" aria-label="Sign here"></canvas><div class="finance-row-actions">' + btn('Clear signature', 'clear-pad') + '</div>' +
      '<div class="form-grid three"><label>Your name<input data-fl-name value="' + esc((global.__POOL_SHED_CURRENT_USER__ && global.__POOL_SHED_CURRENT_USER__().name) || '') + '"></label></div>' +
      '<div class="finance-row-actions">' + btn('Sign off report', 'signoff', 'primary') + btn('Send back to engineer', 'sendback') + '</div>' : '';
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') +
      panel('Monthly van report', '', head + '<div class="finance-row-actions">' + btn('← Back', 'back') + btn('Print / save as PDF', 'print') + '</div>' +
        '<h4>Mileage</h4>' + (editable ? '<label>Odometer reading<input inputmode="numeric" data-fl-odo value="' + esc(r.odometer == null ? '' : r.odometer) + '" placeholder="' + esc(v.odometer ? 'Last: ' + v.odometer : 'Miles') + '"></label>' : '<p><strong>' + esc(r.odometer) + '</strong> miles</p>') +
        checks + '<h4>Damage</h4>' + (damage || '<p class="muted">No damage on record.</p>') + addDamage +
        '<h4>Van supplies</h4>' + kit +
        '<h4>Notes</h4>' + (editable ? '<textarea data-fl-notes rows="3" placeholder="Anything else the office should know">' + esc(r.notes || '') + '</textarea>' : '<p>' + esc(r.notes || '—') + '</p>') +
        sig(r.engineer_signature_ref, r.engineer_name, 'Engineer') + sig(r.manager_signature_ref, r.manager_name, 'Signed off by') + submit + review);
  }

  async function openReport(vanId){
    s.view = 'report'; s.vanId = vanId; s.report = null; rerender();
    try { s.report = await rpc('ps_fleet_report_open', { w: W(), van: vanId, p: new Date().toISOString().slice(0, 10) }); } catch (e) { s.error = friendly(e); }
    rerender(); setTimeout(initPads, 50);
  }
  // Changes are combined into one pending save, so a quick run of edits never loses an earlier one.
  var saveTimer = null, pending = {};
  function queueSave(patch){
    var r = s.report && s.report.report; if (!r) return;
    Object.keys(patch).forEach(function(k){
      if (k === 'checklist') pending.checklist = Object.assign({}, pending.checklist || {}, patch.checklist);
      else pending[k] = patch[k];
    });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 600);
  }
  function flushSave(){
    var r = s.report && s.report.report; clearTimeout(saveTimer);
    if (!r || !Object.keys(pending).length) return Promise.resolve();
    var p = pending; pending = {};
    return rpc('ps_fleet_report_save', { w: W(), report: r.id, patch: p }).catch(function(e){ notify(friendly(e)); });
  }
  function initPads(){
    document.querySelectorAll('[data-fl-pad]').forEach(function(c){
      if (c.dataset.ready) return; c.dataset.ready = '1';
      var ctx = c.getContext('2d'), drawing = false, inked = false;
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = 'var(--color-shell)';
      var pos = function(e){ var b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / b.width, (e.clientY - b.top) * c.height / b.height]; };
      c.addEventListener('pointerdown', function(e){ drawing = true; c.setPointerCapture(e.pointerId); var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); e.preventDefault(); });
      c.addEventListener('pointermove', function(e){ if (!drawing) return; var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); inked = true; c.dataset.inked = '1'; e.preventDefault(); });
      c.addEventListener('pointerup', function(){ drawing = false; });
      c.style.touchAction = 'none';
    });
  }
  function padBlob(){ var c = document.querySelector('[data-fl-pad]'); if (!c || !c.dataset.inked) return Promise.resolve(null);
    return new Promise(function(res){ c.toBlob(function(b){ res(b); }, 'image/png'); }); }
  async function act(fn, ok){ if (s.busy) return; s.busy = true; s.error = ''; rerender(); try { var r = await fn(); if (ok) notify(typeof ok === 'function' ? ok(r) : ok); } catch (e) { s.error = friendly(e); notify(s.error); } s.busy = false; rerender(); setTimeout(initPads, 50); }

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-fl]'); if (!b) return;
    var a = b.dataset.fl, rep = s.report && s.report.report;
    if (a === 'refresh') return load(true);
    if (a === 'back') { flushSave(); s.view = 'list'; s.editing = null; s.report = null; return load(true); }
    if (a === 'new') { s.view = 'edit'; s.editing = {}; return rerender(); }
    if (a === 'edit') { var v = (s.vans || []).find(function(x){ return x.id === b.dataset.van; }); s.view = 'edit'; s.editing = Object.assign({}, v, { kit: [] }); rerender();
      return rpc('ps_fleet_van_kit', { w: W(), van: v.id }).then(function(kit){ s.editing.kit = (kit || []).map(function(k){ return { item: k.item, target_qty: k.target_qty }; }); rerender(); }).catch(function(e){ notify(friendly(e)); }); }
    if (a === 'open-report') return openReport(b.dataset.van);
    if (a === 'print') return global.print();
    if (a === 'check') { var code = b.dataset.code, ok = b.dataset.ok === '1', cur = (rep.checklist || {})[code] || {};
      rep.checklist = Object.assign({}, rep.checklist); rep.checklist[code] = { ok: ok, note: ok ? '' : (cur.note || '') }; queueSave({ checklist: (function(o){ o[code] = rep.checklist[code]; return o; })({}) }); rerender(); setTimeout(initPads, 50); return; }
    if (a === 'clear-pad') { var c = document.querySelector('[data-fl-pad]'); if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); delete c.dataset.inked; } return; }
    if (a === 'submit') return act(async function(){
      await flushSave();
      await rpc('ps_fleet_report_save', { w: W(), report: rep.id, patch: { odometer: (document.querySelector('[data-fl-odo]') || {}).value, notes: (document.querySelector('[data-fl-notes]') || {}).value, checklist: rep.checklist, kit_counts: rep.kit_counts } });
      var blob = await padBlob(); if (!blob) throw new Error('Sign in the box before submitting.');
      var ref = await upload(s.report.van.id, 'signature', blob, 'engineer-signature.png');
      await rpc('ps_fleet_report_submit', { w: W(), report: rep.id, signature_ref: ref, signed_name: (document.querySelector('[data-fl-name]') || {}).value });
      s.view = 'list'; s.report = null; await load(true);
    }, 'Van report submitted for sign-off.');
    if (a === 'signoff' || a === 'sendback') return act(async function(){
      var approve = a === 'signoff', note = (document.querySelector('[data-fl-review-note]') || {}).value, ref = null;
      if (approve) { var blob = await padBlob(); if (!blob) throw new Error('Sign in the box to sign off.'); ref = await upload(s.report.van.id, 'signature', blob, 'manager-signature.png'); }
      await rpc('ps_fleet_report_review', { w: W(), report: rep.id, approve: approve, note: note || '', signature_ref: ref, signed_name: (document.querySelector('[data-fl-name]') || {}).value });
      s.view = 'list'; s.report = null; await load(true);
    }, a === 'signoff' ? 'Report signed off.' : 'Report sent back to the engineer.');
    if (a === 'close-damage') { var note = prompt(b.dataset.outcome === 'Repaired' ? 'Who repaired it, when, and the cost?' : 'Why is it being accepted without repair?'); if (!note) return;
      return act(async function(){ await rpc('ps_fleet_damage_close', { w: W(), damage: b.dataset.id, outcome: b.dataset.outcome, note: note }); s.report = await rpc('ps_fleet_report_open', { w: W(), van: s.vanId, p: s.report.report.period }); }, 'Damage record closed.'); }
  });
  document.addEventListener('input', function(e){
    var t = e.target, rep = s.report && s.report.report; if (!rep) return;
    if (t.dataset.flNote) { var c = Object.assign({}, rep.checklist[t.dataset.flNote], { note: t.value }); rep.checklist[t.dataset.flNote] = c; var o = {}; o[t.dataset.flNote] = c; queueSave({ checklist: o }); }
    if (t.dataset.flCount != null) { var k = rep.kit_counts[Number(t.dataset.flCount)]; k.counted = t.value === '' ? null : Number(t.value); queueSave({ kit_counts: rep.kit_counts }); }
    if (t.matches('[data-fl-odo]')) { rep.odometer = t.value === '' ? null : Number(t.value); queueSave({ odometer: t.value }); }
    if (t.matches('[data-fl-notes]')) { rep.notes = t.value; queueSave({ notes: t.value }); }
  });
  document.addEventListener('submit', function(e){
    var f = e.target.closest && e.target.closest('[data-fl-form]'); if (!f) return; e.preventDefault();
    if (f.dataset.flForm === 'van') return act(async function(){
      var fd = new FormData(f), van = { id: s.editing && s.editing.id || '', kit: [] };
      ['registration','make','model','variant','year','colour','fuel_type','vin','status','assigned_user','mot_due','tax_due','insurance_provider','insurance_policy','insurance_due','service_due','service_due_miles','breakdown_provider','breakdown_due','notes'].forEach(function(k){ van[k] = String(fd.get(k) || ''); });
      for (var i = 0; fd.has('kit_item_' + i); i++) { var it = String(fd.get('kit_item_' + i) || '').trim(); if (it) van.kit.push({ item: it, target_qty: String(fd.get('kit_qty_' + i) || '1') }); }
      var r = await rpc('ps_fleet_van_save', { w: W(), van: van });
      var docs = f.querySelectorAll('[data-fl-doc]');
      for (var j = 0; j < docs.length; j++) { var file = docs[j].files && docs[j].files[0]; if (file) await upload(r.id, docs[j].dataset.flDoc, file, file.name); }
      s.msg = 'Saved ' + esc(r.registration) + '.'; s.view = 'list'; s.editing = null; await load(true);
    }, 'Van saved.');
    if (f.dataset.flForm === 'damage') return act(async function(){
      var fd = new FormData(f), files = f.photos.files, refs = [];
      if (!files.length) throw new Error('Add at least one photo of the damage.');
      for (var i = 0; i < files.length; i++) refs.push(await upload(s.report.van.id, 'damage_photo', files[i], files[i].name));
      await rpc('ps_fleet_damage_add', { w: W(), report: s.report.report.id, damage: { area: fd.get('area'), severity: fd.get('severity'), description: fd.get('description'), photo_refs: refs } });
      s.report = await rpc('ps_fleet_report_open', { w: W(), van: s.vanId, p: s.report.report.period });
    }, 'Damage logged with photos.');
  });

  (function styles(){
    if (typeof document === 'undefined' || !document.head || document.getElementById('fleet-styles')) return;
    var st = document.createElement('style'); st.id = 'fleet-styles';
    st.textContent = '.fleet-plate{display:inline-block;font:700 15px/1 "Arial Narrow",Arial,sans-serif;letter-spacing:.06em;background:#FFD400;color:#111;border:2px solid #111;border-radius:4px;padding:5px 9px;min-width:92px;text-align:center}' +
      '.fleet-due{display:flex;gap:6px;align-items:center;margin:2px 0;font-size:12px}.fleet-due span:first-child{min-width:68px;color:var(--color-text-secondary)}' +
      '.fleet-myvan{display:grid;gap:10px}.fleet-report-head{display:flex;gap:12px;align-items:center;margin-bottom:8px}' +
      '.fleet-check{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;padding:8px 10px;border:1px solid var(--color-border-default);border-radius:8px;margin:6px 0}' +
      '.fleet-check.bad{border-color:var(--color-status-danger-text);background:rgba(192,57,43,.06)}.fleet-check.good{border-color:var(--color-status-success-text)}.fleet-check .full{grid-column:1/-1}' +
      '.fleet-okfail{display:flex;gap:6px}.fleet-okfail button{min-width:84px;min-height:40px}.fleet-count{width:90px;min-height:40px}' +
      '.fleet-damage{border:1px solid var(--color-border-default);border-radius:8px;padding:8px 10px;margin:6px 0}.fleet-photos{display:flex;gap:6px;flex-wrap:wrap}.fleet-photos img{width:96px;height:72px;object-fit:cover;border-radius:6px}' +
      '.fleet-pad{width:100%;max-width:600px;height:160px;border:2px dashed var(--color-text-secondary);border-radius:8px;background:#fff;touch-action:none}' +
      '.fleet-sig{display:flex;gap:10px;align-items:center;margin:8px 0}.fleet-sig img{height:60px;background:#fff;border:1px solid var(--color-border-default);border-radius:6px}' +
      '.fleet-kit{display:grid;gap:6px}.fleet-kit-row{display:grid;grid-template-columns:1fr 90px;gap:6px}' +
      '.fleet-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:var(--color-status-danger-text);color:var(--color-action-contrast);font:700 11px/1 system-ui}' +
      '.fleet-reminder{margin:12px 14px;display:grid;gap:6px}.fleet-reminder-row span{flex:1;min-width:0}.fleet-reminder [data-fl=dismiss-reminder]{justify-self:end;width:auto;min-height:0;padding:2px 4px;border:0;background:none;box-shadow:none;color:inherit;opacity:.7;font-size:12px;text-decoration:underline;cursor:pointer}.fleet-reminder-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--color-status-attention);background:var(--color-status-attention-bg)}.fleet-reminder-row.bad{border-color:var(--color-status-danger-text);background:var(--color-status-danger-bg)}' +
      '@media (max-width:700px){.fleet-check{grid-template-columns:1fr}.fleet-okfail button{flex:1}}' +
      '@media print{.sidebar,.topbar,.finance-row-actions,.fleet-pad,details.fleet-add-damage{display:none!important}}';
    document.head.appendChild(st);
  })();
  // ---------- Reminders (v1.53): banner + menu count ----------
  function me(){ return typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? (global.__POOL_SHED_CURRENT_USER__() || {}) : {}; }
  function reminders(){
    var vans = s.vans || [], uid = String(me().id || ''), dom = new Date().getDate(), mo = month(new Date().toISOString());
    var mine = vans.filter(function(v){ return String(v.assigned_user || '') === uid && ['not started','draft','returned'].indexOf(v.report_status) >= 0; });
    var out = { count: 0, items: [] };
    mine.forEach(function(v){
      out.items.push({ tone: v.report_status === 'returned' ? 'bad' : 'warn', van: v.id,
        text: v.report_status === 'returned' ? 'Your ' + mo + ' van report for ' + v.registration + ' was sent back: ' + (v.report_review_note || 'please update it') + '.'
                                             : 'Your ' + mo + ' van report for ' + v.registration + ' is due.', cta: v.report_status === 'draft' ? 'Continue report' : v.report_status === 'returned' ? 'Update report' : 'Start report' });
    });
    if (isManager()) {
      var waiting = vans.filter(function(v){ return v.report_status === 'submitted'; }).length;
      var missing = vans.filter(function(v){ return v.assigned_user && ['not started','draft'].indexOf(v.report_status) >= 0 && String(v.assigned_user) !== uid; }).length;
      if (waiting) out.items.push({ tone: 'warn', text: waiting + ' van report' + (waiting > 1 ? 's are' : ' is') + ' waiting for your sign-off.', cta: 'Review', page: true });
      if (missing && dom > 7) out.items.push({ tone: 'bad', text: missing + ' van' + (missing > 1 ? 's have' : ' has') + ' no ' + mo + ' report yet.', cta: 'View vans', page: true });
    }
    out.count = out.items.length;
    return out;
  }
  function dismissKey(){ return 'poolshed:fleet-reminder-dismissed:' + new Date().toISOString().slice(0, 10); }
  function paintReminders(){
    if (typeof document === 'undefined') return;
    var r = reminders(), main = document.getElementById('mainContent'), topbar = main && main.querySelector('.topbar');
    var link = document.querySelector('#nav [data-tab="fleet"]');
    if (link) {
      var b = link.querySelector('.fleet-badge');
      if (r.count && !b) { b = document.createElement('span'); b.className = 'fleet-badge'; link.appendChild(b); }
      if (b) { if (r.count) { b.textContent = String(r.count); b.setAttribute('aria-label', r.count + ' van report reminder' + (r.count > 1 ? 's' : '')); } else b.remove(); }
    }
    var box = document.getElementById('fleet-reminder');
    var hide = !r.count || (typeof localStorage !== 'undefined' && localStorage.getItem(dismissKey()) === '1');
    if (hide) { if (box) box.remove(); return; }
    if (!box && topbar) { box = document.createElement('div'); box.id = 'fleet-reminder'; box.setAttribute('role', 'status'); topbar.insertAdjacentElement('afterend', box); }
    if (!box) return;
    box.className = 'fleet-reminder';
    box.innerHTML = r.items.map(function(i){ return '<div class="fleet-reminder-row ' + i.tone + '"><span>🚐 ' + esc(i.text) + '</span>' +
      '<button type="button" class="primary small" data-fl="' + (i.van ? 'open-report' : 'go-fleet') + '"' + (i.van ? ' data-van="' + esc(i.van) + '"' : '') + '>' + esc(i.cta) + '</button></div>'; }).join('') +
      '<button type="button" class="link small" data-fl="dismiss-reminder">Hide for today</button>';
  }
  var reminderStarted = false;
  function startReminders(){
    if (reminderStarted || typeof document === 'undefined') return; reminderStarted = true;
    var ready = function(){ return typeof global.__POOL_SHED_WORKSPACE_READY__ === 'function' && global.__POOL_SHED_WORKSPACE_READY__() && DB(); };
    var tick = function(){ if (!ready()) return setTimeout(tick, 2000); load(true).then(paintReminders); };
    tick();
    setInterval(function(){ if (!document.hidden && ready()) load(true).then(paintReminders); }, 10 * 60 * 1000);
    var nav = document.getElementById('nav');
    if (nav && typeof MutationObserver === 'function') new MutationObserver(function(){ if (!nav.querySelector('[data-tab="fleet"] .fleet-badge') && reminders().count) paintReminders(); }).observe(nav, { childList: true });
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-fl]'); if (!b) return;
      if (b.dataset.fl === 'dismiss-reminder') { try { localStorage.setItem(dismissKey(), '1'); } catch (_) {} paintReminders(); }
      if (b.dataset.fl === 'go-fleet' && typeof global.__POOL_SHED_OPEN_TAB__ === 'function') { s.view = 'list'; global.__POOL_SHED_OPEN_TAB__('fleet'); }
      if (b.dataset.fl === 'open-report' && typeof global.__POOL_SHED_OPEN_TAB__ === 'function' && b.closest('#fleet-reminder')) global.__POOL_SHED_OPEN_TAB__('fleet');
    }, true);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startReminders); else setTimeout(startReminders, 0);
  }
  global.PoolShedFleetUI = { render: render, reload: function(){ return load(true); }, _state: s, _reminders: reminders, _paint: paintReminders };
})(typeof window !== 'undefined' ? window : globalThis);
