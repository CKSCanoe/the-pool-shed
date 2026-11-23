/* Pool Shed in-app dialogs (from v1.84), instead of the browser's own prompt and confirm boxes.
   PoolShedDialog.ask({ title, message, fields: [{ name, label, type, required, value, placeholder, options, hint }], confirmLabel, danger })
     → Promise of { name: value } or null when cancelled. Several questions are asked at once, in one box.
   PoolShedDialog.confirm({ title, message, confirmLabel, danger }) → Promise of true or false.
   Enter confirms (Ctrl+Enter in a long text box), Esc cancels, focus stays inside the box, and focus returns afterwards. */
(function(global){
'use strict';
if (typeof document === 'undefined') return;
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var open = null;
function fieldHtml(f, i){ var id = 'psd-f' + i, req = f.required ? ' required aria-required="true"' : '', v = f.value == null ? '' : f.value, hint = f.hint ? '<small>' + esc(f.hint) + '</small>' : '';
  var label = '<span>' + esc(f.label || f.name) + (f.required ? '' : ' <em>(optional)</em>') + '</span>';
  if (f.type === 'textarea') return '<label class="psd-field" for="' + id + '">' + label + '<textarea id="' + id + '" name="' + esc(f.name) + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '"' + req + '>' + esc(v) + '</textarea>' + hint + '</label>';
  if (f.type === 'select') return '<label class="psd-field" for="' + id + '">' + label + '<select id="' + id + '" name="' + esc(f.name) + '"' + req + '>' + (f.options || []).map(function(o){ var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>' + hint + '</label>';
  if (f.type === 'choice') return '<fieldset class="psd-field psd-choice"><legend>' + esc(f.label || f.name) + '</legend><div>' + (f.options || []).map(function(o, n){ var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return '<label><input type="radio" name="' + esc(f.name) + '" value="' + esc(val) + '"' + ((String(val) === String(v) || (v === '' && n === 0)) ? ' checked' : '') + '><span>' + esc(lab) + '</span></label>'; }).join('') + '</div>' + hint + '</fieldset>';
  return '<label class="psd-field" for="' + id + '">' + label + '<input id="' + id + '" name="' + esc(f.name) + '" type="' + esc(f.type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.step ? ' step="' + esc(f.step) + '"' : '') + (f.min != null ? ' min="' + esc(f.min) + '"' : '') + req + ' autocomplete="off">' + hint + '</label>'; }
function show(opts){
  if (open) open.cancel();
  return new Promise(function(resolve){
    var last = document.activeElement, fields = opts.fields || [], wrap = document.createElement('div');
    // opts.html is only ever trusted markup from Pool Shed's own code (the shortcuts sheet), never user or customer text
    wrap.className = 'psd-wrap'; wrap.innerHTML = '<div class="psd-scrim"></div><form class="psd-box" role="dialog" aria-modal="true" aria-labelledby="psd-title" novalidate>' +
      '<h2 id="psd-title">' + esc(opts.title || 'Are you sure?') + '</h2>' + (opts.message ? '<p class="psd-msg">' + esc(opts.message) + '</p>' : '') + (opts.html ? '<div class="psd-html">' + opts.html + '</div>' : '') +
      fields.map(fieldHtml).join('') + '<p class="psd-error" role="alert" hidden></p>' +
      '<div class="psd-actions">' + (opts.infoOnly ? '' : '<button type="button" class="psd-cancel">' + esc(opts.cancelLabel || 'Cancel') + '</button>') + '<button type="submit" class="psd-ok' + (opts.danger ? ' danger' : '') + '">' + esc(opts.confirmLabel || 'OK') + '</button></div></form>';
    document.body.appendChild(wrap);
    var form = wrap.querySelector('form'), err = wrap.querySelector('.psd-error');
    function done(val){ if (!wrap.parentNode) return; wrap.remove(); document.removeEventListener('keydown', onKey, true); open = null; try { if (last && last.focus && document.contains(last)) last.focus(); } catch (_) {} resolve(val); }
    function values(){ var out = {}; fields.forEach(function(f){ if (f.type === 'choice') { var c = form.querySelector('input[name="' + CSS.escape(f.name) + '"]:checked'); out[f.name] = c ? c.value : ''; } else { var el = form.elements[f.name]; out[f.name] = el ? String(el.value) : ''; } }); return out; }
    function submit(){ var v = values(), missing = fields.filter(function(f){ return f.required && !String(v[f.name] || '').trim(); });
      if (missing.length) { err.textContent = 'Fill in: ' + missing.map(function(f){ return f.label || f.name; }).join(', ') + '.'; err.hidden = false; var el = form.elements[missing[0].name]; if (el && el.focus) el.focus(); return; }
      if (opts.validate) { var msg = opts.validate(v); if (msg) { err.textContent = msg; err.hidden = false; return; } }
      done(fields.length ? v : true); }
    function onKey(e){ if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(fields.length ? null : false); return; }
      if (e.key === 'Tab') { var f = [].slice.call(form.querySelectorAll('input,select,textarea,button')).filter(function(x){ return !x.disabled; }); if (!f.length) return; var i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      if (e.key === 'Enter' && e.target && e.target.tagName === 'TEXTAREA' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }
    form.addEventListener('submit', function(e){ e.preventDefault(); submit(); });
    var cancelBtn = form.querySelector('.psd-cancel'); if (cancelBtn) cancelBtn.addEventListener('click', function(){ done(fields.length ? null : false); });
    wrap.querySelector('.psd-scrim').addEventListener('click', function(){ done(fields.length ? null : false); });
    form.addEventListener('input', function(){ err.hidden = true; });
    document.addEventListener('keydown', onKey, true);
    open = { cancel: function(){ done(fields.length ? null : false); } };
    setTimeout(function(){ var first = form.querySelector('input:not([type=radio]),select,textarea') || form.querySelector('input[type=radio]:checked') || form.querySelector('.psd-ok'); if (first) { first.focus(); if (first.select && first.type !== 'radio') try { first.select(); } catch (_) {} } }, 0);
  }); }
global.PoolShedDialog = {
  ask: function(opts){ return show(opts || {}); },
  confirm: function(opts){ opts = opts || {}; return show({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel || 'Yes', cancelLabel: opts.cancelLabel, danger: opts.danger, fields: [] }); },
  info: function(opts){ opts = opts || {}; return show({ title: opts.title, message: opts.message, html: opts.html, confirmLabel: opts.confirmLabel || 'Close', cancelLabel: 'Close', fields: [], infoOnly: true }); },
  reason: function(title, message, label){ return show({ title: title, message: message, fields: [{ name: 'reason', label: label || 'Reason', type: 'textarea', required: true, rows: 2 }], confirmLabel: 'Continue' }).then(function(v){ return v ? String(v.reason).trim() : null; }); }
};
})(typeof window !== 'undefined' ? window : globalThis);
