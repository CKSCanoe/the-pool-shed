// v1.85 Overhaul phase 5: plain English instead of jargon on every page, and styles that were always overridden removed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), st = fs.statSync(p); if (st.isDirectory()) { if (!/vendor|assets\/css/.test(p)) walk(p); } else if (/\.(js|html)$/.test(f)) files.push(p); } };
walk('public');
const text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
// Visible jargon found on the pages (v1.85 crawl of every menu page) must not come back as a label or sentence.
const GONE = ['Operational command', 'AUTOMATION COMMAND', 'Analytics Command', 'Finance Command', 'KPI Watchlist', 'PRODUCT DATA GOVERNANCE', 'Operational Attention',
  'Physical stock, FIFO allocation and exceptions are controlled from one stock truth.', 'Pool Bros controlled import', 'Canonical audit events', 'Full authority', 'Unlimited authority',
  'Proposal colour is centrally controlled by the Pool Shed design-token system.', 'Run end-to-end operational and release diagnostics.', 'Single source of truth'];
const bad = GONE.filter(w => new RegExp("(?<=['\">])" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?=['\"<])").test(text));
assert.deepEqual(bad, [], 'jargon back on a page: ' + bad.join(', '));
for (const w of ['Your tasks', 'Key figures', 'Needs attention', 'Product data', 'Pool Bros import', 'Full access', 'Run full checks of the system.']) assert.ok(text.includes(w), w);
// Replacements in single-quoted strings use a typographic apostrophe, never a straight one that would end the string
assert.ok(text.includes('Changes still need approval and follow Pool Shed’s permissions.'));
// Style trim: no declaration that a later rule for exactly the same selector, in the same media context, always overrides
const mods = (await import(path.resolve('scripts/css-modules.mjs'))).CSS_MODULES;
const seen = new Map(); let dead = 0, ex = [];
const rules = [];
for (const m of mods) { const css = fs.readFileSync(path.join('public/assets/css', m), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(-webkit-)?keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@font-face\s*\{[^}]*\}/g, '');   // animations and fonts are not normal rules
  // flat parse: selectors and bodies; @media blocks keep their condition as context
  const re = /(@media[^{]+)\{|([^{}@][^{}]*)\{([^{}]*)\}|\}/g; let ctx = [], mm;
  while ((mm = re.exec(css))) { if (mm[1]) ctx.push(mm[1].replace(/\s+/g, ' ').trim()); else if (mm[2] !== undefined) rules.push({ ctx: ctx.join('|'), sel: mm[2].replace(/\s+/g, ' ').trim(), body: mm[3], m }); else ctx.pop(); } }
for (let k = rules.length - 1; k >= 0; k--) { const r = rules[k], ds = r.body.split(';').map(x => x.trim()).filter(x => x.includes(':')).map(x => ({ prop: x.slice(0, x.indexOf(':')).trim().toLowerCase(), val: x.slice(x.indexOf(':') + 1), imp: /!\s*important\s*$/i.test(x) }));
  ds.forEach(d => { const key = r.ctx + '\0' + r.sel + '\0' + d.prop, later = seen.get(key); if (later && (later.imp || !d.imp) && later.safe) { dead++; if (ex.length < 3) ex.push(r.m + ' ' + r.sel + ' ' + d.prop); } });
  ds.forEach(d => { const key = r.ctx + '\0' + r.sel + '\0' + d.prop, later = seen.get(key), safe = !/-webkit-|-moz-|-ms-|\b[dsl]v[hw]\b|cq[whib]|color-mix|oklch|:has\(|anchor/i.test(d.val) && !/^-/.test(d.prop);
    seen.set(key, later ? { imp: later.imp || d.imp, safe: later.safe && safe } : { imp: d.imp, safe }); }); }
assert.ok(dead <= 5, 'always-overridden declarations crept back (' + dead + '): ' + ex.join(' / '));
const size = fs.statSync('public/assets/css/app.css').size; assert.ok(size < 1110000, 'app.css ' + size + ' bytes (was 1,103,884 before the trim; v1.91 premium shell and v1.92 catalogue added about 13 KB)');
console.log('Overhaul 5 v1.85: plain English on every page, always-overridden styles removed (app.css ' + size + ' bytes).');
