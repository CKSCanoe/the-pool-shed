// v1.75.0 Custom HTML in Quote Studio: an HTML section and a full HTML page, cleaned (scripts removed) when published
// and again when shown, with placeholders filled from the proposal page's own values.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const safe = read('public/quote-html-safe.js'), portal = read('public/quote-customer-portal.js'), eng = read('public/quote-studio-engine.js'), ed = read('public/quote-brochure-editor.js');
const index = read('public/index.html'), prop = read('public/proposal.html'), sw = read('public/service-worker.js');

// The cleaner: an allow-list of plain content tags; dangerous ones dropped with their content.
for (const t of ['script','iframe','object','embed','form','input','button','svg','math','link','meta','base','template','noscript']) assert.ok(new RegExp("DROP_WITH_CONTENT=new Set\\(\\[[^\\]]*'" + t + "'").test(safe), 'drops ' + t);
for (const t of ['script','iframe','form','svg','button','input','style']) assert.ok(!new RegExp("const TAGS=new Set\\(\\[[^\\]]*'" + t + "'").test(safe), t + ' not allowed as a tag');
assert.ok(!/'on/.test(safe.match(/const ATTRS=new Set\(\[[^\]]*\]\)/)[0]), 'no event handler attributes');
assert.ok(!safe.match(/const ATTRS=new Set\(\[[^\]]*\]\)/)[0].includes("'data-"), 'no data- attributes');
assert.ok(safe.includes("if(/^https:\\/\\//i.test(u))return u;"), 'links and pictures must be https');
assert.ok(safe.includes("if(name==='id'&&/^(?:pc|ps|be|qs)/i.test(v))continue;"), 'no ids that clash with the page');
assert.ok(safe.includes("el.setAttribute('rel','noopener noreferrer')"));
assert.ok(/function safeCss\(v\)\{[^\n]*expression[^\n]*javascript:[^\n]*@import/.test(safe));
assert.ok(safe.includes("s.replace(/@import[^;]*;?/gi,'')"), 'style blocks lose @import');
assert.ok(safe.includes("const LIMIT=100000;"));
// Placeholders: words go in as text (escaped by the browser), live parts only as the page's own HTML.
assert.ok(safe.includes("frag.appendChild(doc.createTextNode(fill(p)))"));
assert.ok(safe.includes("const BLOCKS=['pool_specs','investment','accept_button','documents','pool_layout'];"));

// Customer page cleans again before showing, style blocks only in full-page mode, accepting always reachable.
assert.ok(portal.includes("return safe.render(src||'',htmlValues(),htmlBlocks(),{allowStyle:!!fullPage})"));
assert.ok(portal.includes("const r=customHtml(s.html,false);"));
assert.ok(portal.includes("(r.used.has('accept_button')?'':acceptanceCta())"));
assert.ok(portal.includes("const custom=p.brochure?fullHtmlPage():null;"), 'older published versions never switch to HTML');
assert.ok(prop.indexOf('quote-html-safe.js') > 0 && prop.indexOf('quote-html-safe.js') < prop.indexOf('quote-customer-portal.js'));

// Published copy is cleaned; the full page only goes out when switched on.
assert.ok(eng.includes("pages:safePages(clone((q.pages||[]).filter(p=>p.visible!==false))),"));
assert.ok(eng.includes("presentation:safePresentation(clone(q.presentation)),"));
assert.ok(eng.includes("if(pr.htmlPageOn!=='1')delete pr.htmlPage;"));
assert.ok(eng.includes("return S?S.clean(String(v||''),{allowStyle:!!style}):''"), 'without the cleaner nothing is published');
assert.ok(eng.includes("{type:'html',title:'Custom HTML'"));

// Editor.
assert.ok(ed.includes("'htmlPage','htmlPageOn'].includes(k[1])"));
assert.ok(ed.includes("case 'html':body=") && ed.includes('function placeholderHelp()'));
assert.ok(index.indexOf('quote-html-safe.js') < index.indexOf('quote-studio-engine.js'));
assert.ok(sw.includes('./quote-html-safe.js?v='));
console.log('Quote custom HTML v1.75: HTML section and full page, cleaned on publish and on show, placeholders filled safely.');
