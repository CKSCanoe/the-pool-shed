// v1.77 Style hygiene. Fails the build if a rule in public/assets/css/system/*.css cannot match anything ( a class or id outside any
// a class or id outside parentheses that appears nowhere in the app's code), if a fixed colour appears outside
// 00-color-tokens.css, or if app.css grows past its budget. Conservative: dynamic prefixes ("pill-"+x) keep a class.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd(), WRITE = false;
const walk = (d, out = []) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), s = fs.statSync(p);
  if (s.isDirectory()) { if (!/node_modules|\.git|backups|dist/.test(p)) walk(p, out); } else if (/\.(js|mjs|html|json)$/.test(f) && !/\/scripts\//.test(p)) out.push(p); } return out; };
const files = [...walk(path.join(ROOT, 'public')), ...walk(path.join(ROOT, 'server')), ...walk(path.join(ROOT, 'api'))].filter(f => !/service-worker\.js$/.test(f));
const tokens = new Set(); const prefixes = new Set();
for (const f of files) { const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/[A-Za-z_][\w-]*/g)) tokens.add(m[0]);
  // dynamic: 'prefix-'+x  "prefix-"+x  `prefix-${x}`  prefix_${
  for (const m of t.matchAll(/([A-Za-z_][\w-]*[-_])(?:['"]\s*\+|\$\{)/g)) prefixes.add(m[1]);
  // class names built from template parts: 'a-'+b+'-c' keeps "a-"; also keep words split by '-' joins via join('-')
}
const used = name => { if (tokens.has(name)) return true; for (let i = name.length - 1; i > 0; i--) if ((name[i] === '-' || name[i] === '_') && prefixes.has(name.slice(0, i + 1))) return true; return false; };
// split top-level comma list
const splitList = s => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(' || ch === '[') d++; if (ch === ')' || ch === ']') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const outside = s => { let d = 0, b = 0, o = ''; for (const ch of s) { if (ch === '(') d++; if (ch === '[') b++; if (d === 0 && b === 0) o += ch; else o += ' '; if (ch === ')') d--; if (ch === ']') b--; } return o; };
const deadSel = sel => { const o = outside(sel); for (const m of o.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) if (!used(m[1])) return m[1]; for (const m of o.matchAll(/#(-?[A-Za-z_][\w-]*)/g)) if (!used(m[1])) return '#' + m[1]; return null; };
// minimal block parser: returns edits for one css text
function prune(css) {
  const edits = []; let i = 0, n = css.length, stats = { rules: 0, dead: 0, trimmed: 0, bytes: 0 };
  function skipComment() { if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; return true; } return false; }
  function block(depthEnd) { // parse until matching }
    while (i < n) {
      if (skipComment()) continue;
      const ch = css[i];
      if (ch === '}') { i++; return; }
      if (/\s/.test(ch)) { i++; continue; }
      // read prelude up to { or ;
      const start = i; let d = 0, q = null;
      while (i < n) { const c = css[i]; if (q) { if (c === '\\') { i += 2; continue; } if (c === q) q = null; i++; continue; }
        if (c === '"' || c === "'") { q = c; i++; continue; } if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
        if (c === '(') d++; if (c === ')') d--; if (d === 0 && (c === '{' || c === ';')) break; i++; }
      const prelude = css.slice(start, i).trim();
      if (css[i] === ';') { i++; continue; }
      i++; // {
      if (prelude.startsWith('@')) { if (/^@(media|supports|layer|container|document)/.test(prelude)) block(); else { // keyframes, font-face etc: skip body
          let d2 = 1; while (i < n && d2 > 0) { if (skipComment()) continue; if (css[i] === '{') d2++; else if (css[i] === '}') d2--; i++; } }
        continue; }
      // style rule body
      const bodyStart = i; let d3 = 1, q2 = null; while (i < n && d3 > 0) { const c = css[i]; if (q2) { if (c === '\\') { i += 2; continue; } if (c === q2) q2 = null; i++; continue; } if (c === '"' || c === "'") { q2 = c; i++; continue; } if (c === '{') d3++; else if (c === '}') d3--; i++; }
      const end = i; stats.rules++;
      const sels = splitList(prelude.replace(/\/\*[\s\S]*?\*\//g, '')); const keep = sels.filter(s => !deadSel(s.trim()));
      if (!keep.length) { edits.push([start, end, '']); stats.dead++; stats.bytes += end - start; }
      else if (keep.length < sels.length) { edits.push([start, bodyStart - 1, keep.map(s => s.trim()).join(', ') + ' ']); stats.trimmed++; stats.bytes += (bodyStart - 1 - start) - (keep.join(', ').length + 1); }
    }
  }
  block();
  let out = css; edits.sort((a, b) => b[0] - a[0]).forEach(([s, e, r]) => { out = out.slice(0, s) + r + out.slice(e); });
  out = out.replace(/@media[^{]*\{\s*\}/g, '').replace(/\n{3,}/g, '\n\n');
  return { out, stats };
}
const dir = path.join(ROOT, 'public/assets/css/system'); let total = { rules: 0, dead: 0, trimmed: 0, bytes: 0 }; const problems = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.css')).sort()) {
  if (f === '00-color-tokens.css') continue;
  const css = fs.readFileSync(path.join(dir, f), 'utf8'), { out, stats } = prune(css);
  for (const k in total) total[k] += stats[k];
  if (stats.dead || stats.trimmed) problems.push(f + ': ' + (stats.dead + stats.trimmed) + ' rule(s) for classes the app never uses — remove them');
  const hex = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-f]{3,8}\b/gi) || [];
  if (hex.length) problems.push(f + ': fixed colour ' + hex.slice(0, 3).join(', ') + ' — use a --color-* token from 00-color-tokens.css');
  if (WRITE) fs.writeFileSync(path.join(dir, f), out);
}
const size = fs.statSync(path.join(ROOT, 'public/assets/css/app.css')).size, BUDGET = 1100000;   // v1.85: back to 1.1 MB after the phase 5 trim (1.08 MB)
if (size > BUDGET) problems.push('app.css is ' + size + ' bytes, over the ' + BUDGET + ' budget');
const kit = fs.readFileSync(path.join(dir, '68-pool-shed-kit.css'), 'utf8');
if (/:is\(#screen-dashboard/.test(kit)) problems.push('68-pool-shed-kit.css: use .ps-kit-scope:not(#ps-kit-none) instead of the long screen list');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Style hygiene v1.77: ' + total.rules + ' rules all reachable, colours only from tokens, app.css ' + size + ' bytes (budget ' + BUDGET + ').');
