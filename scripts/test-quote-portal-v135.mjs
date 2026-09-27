import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('public/quote-customer-portal.css','utf8');
const js=fs.readFileSync('public/quote-customer-portal.js','utf8');
const html=fs.readFileSync('public/proposal.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.version,'1.45.1');
for(const token of [
  'var(--color-surface-default)','var(--color-shell)','var(--color-action-primary)',
  '.pc-nav{height:74px','.pc-hero{min-height:665px','.pc-project-bar{position:sticky',
  '.pc-section-intro{display:grid','.pc-confidence{display:grid','.pc-accept-wrap{max-width:920px',
  '.pc-investment{background:var(--color-text-primary)','.pc-options.layout-rows .pc-option'
]) assert(css.includes(token),'Private-client portal CSS missing '+token);
assert(!/#(?:[0-9a-fA-F]{3}){1,2}\b/.test(css),'Customer portal CSS must consume the central semantic palette, not fixed hex colours');
assert(!/--(?:paper|forest|gold|water|sage)\b/.test(css),'Retired customer-portal palette variables must stay removed');
for(const token of [
  'brandDescriptor','Private Client Proposal','Private for ','pc-scroll-cue','Designed carefully. Delivered properly.',
  'pc-confidence','pc-project-bar','Review ','pc-accept-stepbar',
  "await api('accept'","await api('decline'","await api('question'","await api('choice'",
  'canInteract()','observeSections()','startEngagement()'
]) assert(js.includes(token),'V9.2 portal behaviour missing '+token);
assert(html.includes('assets/css/system/00-color-tokens.css?v=1.45.1'));
assert(html.includes('quote-customer-portal.css?v=1.45.1'));
assert(html.includes('quote-customer-portal.js?v=1.45.1'));
assert(!js.includes('supplier cost')&&!js.includes('unitCost'),'Customer portal must not introduce internal commercial fields');
console.log('PASS v1.45.1 V9.2 private-client proposal design with preserved secure customer interactions');
