import fs from "node:fs";

const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");

const structural=[
  'class="crm-master-detail"',
  'class="crm-directory"',
  'class="crm-profile"',
  'class="crm-hero"',
  'class="crm-summary"',
  'class="crm-grid crm-account-overview-grid"',
  'class="crm-card crm-core-account"',
  'Account Essentials',
  'Contact &amp; ownership',
  'Primary addresses',
  'Commercial account',
  'Recent activity',
  'People &amp; locations',
  'Data quality &amp; controls',
  'Smart defaults:',
  'class="crm-depth-card"',
  'data-crm-profile-tab="overview"',
  'data-crm-profile-tab="orders"',
  'data-crm-profile-tab="projects"',
  'data-crm-profile-tab="people"',
  'data-crm-profile-tab="locations"',
  'data-crm-profile-tab="finance"',
  'data-crm-profile-tab="history"'
];
for(const token of structural) if(!js.includes(token)) throw new Error("Missing Design Lab structure: "+token);

const styling=[
  '.crm-master-detail{display:grid;grid-template-columns:290px',
  '.crm-hero{background:#fff',
  '.crm-profile-tabs',
  '.crm-summary{display:grid;grid-template-columns:repeat(4',
  '.crm-core-account{background:#fff',
  '.crm-core-sections{display:grid;grid-template-columns:',
  '.crm-edit-drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,94vw)',
  '@media(max-width:900px)',
  '@media(max-width:700px)'
];
for(const token of styling) if(!css.includes(token)) throw new Error("Missing Design Lab parity style: "+token);

if(js.includes('class="crm-account-header"')) throw new Error("Old dark account header is still rendered.");
if(js.includes('class="crm-directory-shell"')) throw new Error("Old separate directory page is still rendered.");
if(css.includes('.crm-account-header{padding:12px 14px;background:#102b3a')) throw new Error("Old dark CRM header styling remains.");
if(!js.includes('data-crm-copy=')) throw new Error("Core record copy actions are not connected.");

console.log("Customer Design Lab parity checks passed: master-detail directory, light account header, dashboard-aligned tabs/summary, readable core record, supporting overview cards, depth cards, 560px editor and responsive structure are present.");
