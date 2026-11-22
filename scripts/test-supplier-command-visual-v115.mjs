import fs from 'node:fs';import assert from 'node:assert/strict';
// v1.77: rules for classes the app no longer creates were removed (see test-css-hygiene-v177); only check live ones.
const __appCode = ['public','server','api'].flatMap(d => { const out = []; const walk = p => { for (const f of fs.readdirSync(p)) { const q = p + '/' + f, st = fs.statSync(q); if (st.isDirectory()) { if (!/css|node_modules/.test(f)) walk(q); } else if (/\.(js|html)$/.test(f) && !/service-worker/.test(f)) out.push(fs.readFileSync(q, 'utf8')); } }; walk(d); return out; }).join('\n');
const __live = sel => (sel.match(/\.([A-Za-z_][\w-]*)/g) || []).every(c => new RegExp('(^|[^\\w-])' + c.slice(1).replace(/[-]/g, '\\-') + '([^\\w-]|$)').test(__appCode));
const path='public/assets/css/system/49-supplier-command.css';assert(fs.existsSync(path),'Supplier Command CSS authority must exist');const css=fs.readFileSync(path,'utf8');
for(const token of ['.supplier-command-page','.supplier-command-grid','.supplier-command-queue','.supplier-details-card','.supplier-attention-rail','.supplier-credit-meter','.supplier-smart-flag','.supplier-product-table','.supplier-detail-tabs'])assert(css.includes(token)||!__live(token),`missing Supplier Command selector ${token}`);
assert(css.includes('var(--color-text-primary)')&&css.includes('var(--color-action-ink)')&&css.includes('var(--color-surface-default)'),'Supplier Command must use governed semantic design tokens');
console.log('PASS Supplier Command Option C visual authority selectors');
