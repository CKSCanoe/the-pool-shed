import fs from "node:fs";

const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");

const jsRequired=[
  'class="crm-core-sections crm-readable-core"',
  'class="crm-core-band"',
  'class="crm-core-band-head"',
  'class="crm-core-band-grid"',
  'class="crm-core-field"',
  'class="crm-address-list"',
  'class="crm-address-row"',
  'class="crm-address-row-label"',
  'class="crm-address-row-value"',
  'Contact &amp; ownership',
  'Primary addresses',
  'Commercial account'
];
for(const token of jsRequired) if(!js.includes(token)) throw new Error("Missing readable Account Essentials structure: "+token);

const cssRequired=[
  '.crm-core-sections{display:grid;grid-template-columns:1fr;gap:8px}',
  '.crm-core-band{min-width:0;background:#fff;border:1px solid #d7e5ea;border-radius:6px;overflow:hidden}',
  '.crm-core-band-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}',
  '.crm-core-field strong{display:block;color:#17252e;font-size:12px;line-height:1.45',
  '.crm-address-row{display:grid;grid-template-columns:155px minmax(0,1fr) auto',
  '@media(max-width:700px)',
  '.crm-core-band-grid{grid-template-columns:1fr}',
  '.crm-address-row{grid-template-columns:1fr auto;align-items:start'
];
for(const token of cssRequired) if(!css.includes(token)) throw new Error("Missing readable Account Essentials style: "+token);

for(const stale of ['class="crm-core-group"','class="crm-address-block"']){
  if(js.includes(stale)) throw new Error("Old squeezed Account Essentials structure remains rendered: "+stale);
}
if(!js.includes('data-crm-copy=')) throw new Error("Copy actions were lost during Account Essentials refinement.");
if(!js.includes('data-crm-edit="') || !js.includes('|account')) throw new Error("Quick Edit account hook was lost.");

console.log("Customer Account Essentials readability checks passed: full-width bands, two-column detail fields, readable address rows, preserved copy/edit hooks and mobile stacking are present.");
