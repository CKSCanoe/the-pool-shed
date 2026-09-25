import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('public/quote-customer-portal.css','utf8');
const js=fs.readFileSync('public/quote-customer-portal.js','utf8');
const html=fs.readFileSync('public/proposal.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.version,'1.44.0');
for(const token of [
  '--paper:#f7f5ef','--forest:#24332d','--gold:#a78958',
  '.pc-nav{height:74px','.pc-hero{min-height:665px','.pc-project-bar{position:sticky',
  '.pc-section-intro{display:grid','.pc-confidence{display:grid','.pc-accept-wrap{max-width:920px',
  '.pc-investment{background:#18231f','.pc-options.layout-rows .pc-option'
]) assert(css.includes(token),'V9.2 portal CSS missing '+token);
for(const token of [
  'brandDescriptor','Private Client Proposal','Private for ','pc-scroll-cue','Designed carefully. Delivered properly.',
  'pc-confidence','pc-project-bar','Review ','pc-accept-stepbar',
  "await api('accept'","await api('decline'","await api('question'","await api('choice'",
  'canInteract()','observeSections()','startEngagement()'
]) assert(js.includes(token),'V9.2 portal behaviour missing '+token);
assert(html.includes('quote-customer-portal.css?v=1.44.0'));
assert(html.includes('quote-customer-portal.js?v=1.44.0'));
assert(!js.includes('supplier cost')&&!js.includes('unitCost'),'Customer portal must not introduce internal commercial fields');
console.log('PASS v1.44.0 V9.2 private-client proposal design with preserved secure customer interactions');
