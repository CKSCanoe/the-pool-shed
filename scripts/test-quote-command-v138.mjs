import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const eng=read('public/quote-studio-engine.js');
const ws=read('public/quote-studio-workspace.js');
const css=read('public/assets/css/system/59-quote-studio.css');
const publicCss=read('public/quote-studio.css');
const portal=read('public/quote-customer-portal.js');
const portalCss=read('public/quote-customer-portal.css');
const index=read('public/index.html');
const proposal=read('public/proposal.html');

assert.equal(pkg.version,'1.45.0');
assert.match(eng,/const VERSION='1\.45\.0'/);

// Navigation authority
assert.match(ws,/qs-globalbar/,'Quote Studio pages must own a persistent navigation bar');
assert.match(ws,/data-qs-action="exit-quote-studio"/,'Every quote surface must provide an explicit Pool Shed exit');
assert.match(ws,/qs-commanddeck/,'Quote detail must use the non-compressing command deck');
assert.match(css,/\.qs-commanddeck-main\{display:grid;grid-template-columns:minmax\(320px,/,'Desktop command deck must reserve a real identity column');
assert.match(css,/body:has\(#screen-quotes:not\(\.hidden\)\) \.subnav\{display:none!important\}/,'Legacy Pool Shed quote subnav must not compete with Quote Studio navigation');

// Bespoke per-quote commercial authority
assert.match(eng,/function defaultCommercialPolicy/);
assert.match(eng,/function commercialPolicy/);
assert.match(eng,/depositType:\['percent','fixed','full','none'\]/);
assert.match(eng,/function depositDue/);
assert.match(eng,/function paymentPlan/);
assert.match(ws,/COMMERCIAL CONTROL CENTRE/);
assert.match(ws,/Bespoke quote strategy/);
assert.match(ws,/Approval floor %/);
assert.match(ws,/Fixed deposit £/);
assert.match(ws,/Installation milestone %/);
assert.match(ws,/Apply target sell/);
assert.match(ws,/qs-margin-band/);

// Per-quote presentation authority
assert.match(ws,/Client-facing brand/);
assert.match(ws,/Proposal style/);
assert.match(ws,/Proposal primary/);
assert.match(ws,/Proposal accent/);
assert.match(ws,/Proposal paper/);
assert.match(portal,/themeVars='--pc-primary:/);
assert.match(portalCss,/v1\.38 per-quote portal theming/);
assert.match(portalCss,/var\(--pc-primary/);
assert.match(portalCss,/var\(--pc-accent/);
assert.match(portalCss,/theme-waterline/);
assert.match(portalCss,/theme-minimal/);
assert.match(portalCss,/theme-contrast/);

// Preview must cross tabs without treating a fresh staff preview as expired.
assert.match(eng,/localStorage\.setItem\('poolShedQuotePreview:'\+id/);
assert.doesNotMatch(eng,/sessionStorage\.setItem\('poolShedQuotePreview'/);
assert.match(ws,/\/proposal\?preview='\+encodeURIComponent\(id\)/);
assert.match(portal,/localStorage\.getItem\('poolShedQuotePreview:'\+previewId\)/);

// Customer payload exposes payment/presentation only, not internal strategy/stock/purchasing.
assert.match(eng,/schema:5/);
assert.match(eng,/payment:\{mode:pay\.mode/);
assert.match(eng,/investment:\{net:t\.net,vat:t\.vat,gross:t\.gross,deposit:t\.deposit/);
const snapshotStart=eng.indexOf('function customerSnapshot');
const snapshotEnd=eng.indexOf('\nfunction ',snapshotStart+10);
const snapshot=eng.slice(snapshotStart,snapshotEnd);
assert.doesNotMatch(snapshot,/minimumMargin/);
assert.doesNotMatch(snapshot,/targetMargin/);
assert.doesNotMatch(snapshot,/supplierSku/);
assert.doesNotMatch(snapshot,/costSnapshot/);

// CSS authority stays single-source and assets are current.
assert.equal(css,publicCss);
assert(index.includes('app.css?v=1.45.0'));
assert(proposal.includes('quote-customer-portal.css?v=1.45.0'));
assert(proposal.includes('quote-customer-portal.js?v=1.45.0'));

console.log('Pool Shed v1.38 Quote Studio Command, bespoke commercial control, theming and cross-tab preview: PASS');
