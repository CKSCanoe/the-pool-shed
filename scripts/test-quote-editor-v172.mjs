// v1.72 Quote Studio brochure editor: ordered sections, click-to-edit preview, safe settings, framing only by Pool Shed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read = f => fs.readFileSync(f, 'utf8');
const ed = read('public/quote-brochure-editor.js'), eng = read('public/quote-studio-engine.js'), ws = read('public/quote-studio-workspace.js');
const portal = read('public/quote-customer-portal.js'), pcss = read('public/quote-customer-portal.css'), html = read('public/index.html');
const vercel = JSON.parse(read('vercel.json')), mods = read('scripts/css-modules.mjs'), sw = read('public/service-worker.js');

// Engine: section library, add/move/remove, every page keeps its settings, snapshot marks the new order.
for (const t of ['welcome','letter','about','options','gallery','text','layout','timeline','documents','reviews','faqs','investment','terms','acceptance']) assert.ok(eng.includes("{type:'" + t + "'"), 'library has ' + t);
for (const f of ['brochureLibrary','brochurePages','addPage','movePage','removePage','duplicatePage']) assert.ok(eng.includes('function ' + f + '('), f);
assert.ok(eng.includes('brochure:1,quoteId:q.id'), 'snapshot tells the page to follow the set order');
assert.ok(eng.includes('brochurePages(q);commercialPolicy(q)') || /theme=Object\.assign[^;]*;brochurePages\(q\)/.test(eng), 'old quotes get settings on open');

// Workspace: quotes open on the editor; the old builder is still one click away.
assert.ok(ws.includes("detailTab=global.PoolShedBrochureEditor?'Design':'Options & Packages'"));
assert.ok(ws.includes("['Design','✦','Design brochure'"));
assert.ok(ws.includes('uploadImage:function(file){return storeQuoteImage(file)}') && ws.includes('openBuilder:function(sectionId)'));
assert.ok(html.indexOf('quote-brochure-editor.js') > html.indexOf('quote-studio-workspace.js'), 'editor loads after the workspace');
assert.ok(sw.includes('./quote-brochure-editor.js?v='), 'editor is in the offline cache list');

// Customer page: older published versions keep their fixed order; new ones follow the list; edit mode only inside Pool Shed.
assert.ok(portal.includes("if(!p.brochure)return parts.welcome+parts.about+(p.sections||[]).map(sectionHtml).join('')+parts.layout+parts.documents+parts.investment+acceptanceCta();"));
assert.ok(portal.includes("const editMode=preview&&params.get('edit')==='1'&&window.parent!==window"), 'edit mode needs a staff preview inside a frame');
assert.ok(portal.includes('e.origin!==location.origin||e.source!==window.parent'), 'only Pool Shed itself can drive the editor page');
assert.ok(portal.includes("if(!editMode||editLocked||!path)return '<'+tag+c+'>'+esc(text)"), 'customers never get editable text');
assert.ok(/function extraPage\(pg\)[\s\S]*pc-timeline[\s\S]*pc-reviews[\s\S]*pc-faq[\s\S]*pc-terms/.test(portal));
assert.ok(!/innerHTML\s*=\s*[^;]*settings/.test(portal), 'settings are never written as raw HTML');
for (const c of ['.pc-zone','.pc-timeline','.pc-reviews','.pc-gallery-grid','.pc-split']) assert.ok(pcss.includes(c), c);

// Editor: postMessage only to/from the same site, setting paths are checked, accepted quotes are read only.
assert.ok(ed.includes("postMessage({type:'ps-brochure',proposal:payload,page:S.page,scroll:!!scroll},location.origin)"));
assert.ok(ed.includes('e.source!==fr.contentWindow||e.origin!==location.origin'));
assert.ok(ed.includes("BLOCKED=new Set(['constructor','prototype'"));
assert.ok(ed.includes("if(!qt||locked(qt)||!k.every(x=>SAFE.test(x)))return false"));

// Run setPath against a small quote.
const ctx = { console, location: { origin: 'http://x' }, localStorage: { getItem(){ return null; }, removeItem(){} }, document: { addEventListener(){}, getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; } }, CSS: { escape: s => s } };
ctx.addEventListener = () => {};
const quote = { id: 'Q-1', status: 'Draft', presentation: { theme: {} }, pages: [{ id: 'PAGE-A1', type: 'timeline', visible: true, settings: { steps: [{ title: 'a', text: '' }] } }], sections: [{ id: 'SEC-B2', rule: 'single', options: [{ id: 'OPT-1', title: 'x', unitPrice: 0, selected: true }, { id: 'OPT-2', title: 'y', unitPrice: 0 }] }] };
ctx.PoolShedQuoteStudio = { brochurePages: q => q.pages, brochureLibrary: () => [], getQuote: () => quote, mediaUrl: (q, r) => r };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(ed, ctx);
const E = ctx.PoolShedBrochureEditor;
assert.equal(E.setPath(quote, 'option.SEC-B2.OPT-2.unitPrice', '£4,250'), true); assert.equal(quote.sections[0].options[1].unitPrice, 4250);
assert.equal(E.setPath(quote, 'option.SEC-B2.OPT-2.selected', true), true); assert.equal(quote.sections[0].options[0].selected, false, 'pick one stays pick one');
assert.equal(E.setPath(quote, 'page.PAGE-A1.steps.0.title', 'Survey'), true); assert.equal(quote.pages[0].settings.steps[0].title, 'Survey');
assert.equal(E.setPath(quote, 'page.PAGE-A1.constructor.prototype.bad', 1), false); assert.equal(({}).bad, undefined);
assert.equal(E.setPath(quote, 'page.PAGE-A1.__proto__.bad', 1), false);
assert.equal(E.setPath(quote, 'presentation.secret', 'x'), false, 'only known presentation fields');
quote.status = 'Accepted'; assert.equal(E.setPath(quote, 'presentation.heroTitle', 'x'), false, 'accepted quotes are read only');

// Framing: the customer page may only be framed by Pool Shed itself.
const prop = vercel.headers.filter(h => h.source === '/proposal' || h.source === '/proposal.html');
assert.equal(prop.length, 2);
for (const h of prop) { const get = k => h.headers.find(x => x.key === k)?.value || '';
  assert.equal(get('X-Frame-Options'), 'SAMEORIGIN'); assert.ok(get('Content-Security-Policy').includes("frame-ancestors 'self'")); assert.ok(!get('Content-Security-Policy').includes("frame-ancestors *")); }
assert.ok(mods.indexOf('69-quote-brochure-editor.css') > 0 && mods.indexOf('69-quote-brochure-editor.css') < mods.indexOf('68-pool-shed-kit.css'));
console.log('Quote Studio editor v1.72: ordered brochure sections, click-to-edit preview, safe settings, same-site framing only.');
