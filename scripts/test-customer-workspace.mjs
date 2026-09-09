import fs from "node:fs";
const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");
const required=[
  'crm-account-workspace','Account Essentials','data-crm-profile-tab="overview"',
  'data-crm-profile-tab="orders"','data-crm-profile-tab="projects"',
  'data-crm-profile-tab="people"','data-crm-profile-tab="locations"',
  'data-crm-profile-tab="finance"','data-crm-profile-tab="history"',
  'data-crm-edit-tab="account"','data-crm-edit-tab="people"',
  'data-crm-edit-tab="locations"','data-crm-edit-tab="finance"',
  'data-crm-edit-tab="site"','data-crm-edit-tab="admin"',
  'data-save-crm-customer','data-create-sales-order-customer',
  'data-crm-new-project','data-crm-add-note','crmDirectorySearch'
];
for(const token of required) if(!js.includes(token)) throw new Error("Missing customer workspace hook: "+token);
for(const token of [".crm-core-groups",".crm-edit-drawer",".crm-profile-tabs","@media(max-width:760px)"]) if(!css.includes(token)) throw new Error("Missing customer workspace style: "+token);
if(js.includes('panel("Customer Profile", "Full customer record for contact details')) throw new Error("Legacy customer mega-profile renderer remains active.");
console.log("Customer workspace checks passed: directory, account tabs, connected editor sections, actions and responsive styles present.");
