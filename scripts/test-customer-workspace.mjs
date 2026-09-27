import fs from "node:fs";
const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");

const required=[
  'crm-master-detail','Account Essentials','data-crm-profile-tab="overview"',
  'data-crm-profile-tab="orders"','data-crm-profile-tab="projects"',
  'data-crm-profile-tab="people"','data-crm-profile-tab="locations"',
  'data-crm-profile-tab="finance"','data-crm-profile-tab="history"',
  'data-crm-edit-tab="account"','data-crm-edit-tab="people"',
  'data-crm-edit-tab="locations"','data-crm-edit-tab="finance"',
  'data-crm-edit-tab="site"','data-crm-edit-tab="admin"',
  'data-save-crm-customer','data-create-sales-order-customer',
  'data-crm-new-project','data-crm-open-job','data-crm-add-note',
  'crmDirectorySearch','data-crm-search','data-crm-attention',
  'jobCreateCustomerId','Discard unsaved customer changes?'
];
for(const token of required) if(!js.includes(token)) throw new Error("Missing customer workspace hook: "+token);

for(const token of [".crm-core-sections",".crm-edit-drawer",".crm-profile-tabs","@media(max-width:700px)"])
  if(!css.includes(token)) throw new Error("Missing customer workspace style: "+token);

if(js.includes('crm: ["All Customers", "Create Customer", "Profile Details"'))
  throw new Error("Legacy CRM sidebar subpages still exposed.");
if(js.includes('active = "engineerorders"'))
  throw new Error("CRM project action still routes to a non-authoritative/invalid project workspace.");
if(js.includes('panel("Customer Profile", "Full customer record for contact details'))
  throw new Error("Legacy customer mega-profile renderer remains active.");

const mega=js.slice(js.indexOf("function customerMegaProfile"),js.indexOf("function customerCreateProfile"));
const uniqueFields=["companyName","code","customerType","status","owner","website","companyNumber","vatNumber","firstName","lastName","title","email","email2","email3","phone","mobile","communicationPreference","priceList","discount","creditLimit","creditDays","creditTermType","nominalCode","taxCode","currency","brightpearlContactId","xeroContactId","leadSource","newsletter","memo"];
for(const field of uniqueFields){
  const helperNeedle=`crmField(c,"${field}"`;
  const literalNeedle=`data-crm-field="'+c.id+'|${field}"`;
  const count=mega.split(helperNeedle).length-1 + mega.split(literalNeedle).length-1;
  if(count>1) throw new Error(`Customer editor field ${field} is rendered more than once; duplicate editors can overwrite each other.`);
}

const requiredHardening=[
  'activeSubPage.crm = "Create Customer";',
  'activeSubPage.crm = "All Customers";',
  'const scope = document.querySelector(".crm-edit-drawer") || document;',
  'const candidate = Object.assign({}, c,',
  'Keep a company name or customer person name before saving.',
  'Another customer already uses that primary email.',
  'c.priceList = c.priceList || "rrp";'
];
for(const token of requiredHardening) if(!js.includes(token)) throw new Error("Missing CRM hardening: "+token);
if(js.includes('activeSubPage.crm = "Profile Details"')) throw new Error("Stale legacy CRM route remains.");
const createFn=js.slice(js.indexOf("function createCrmCustomerProfile"),js.indexOf("function nextCustomerId"));
if(!createFn.includes('activeSubPage.crm = "All Customers";')) throw new Error("Created customer does not leave the Create Customer subpage.");
const bindFn=js.slice(js.indexOf("function bindCrm()"),js.indexOf("function crmCreateStepList"));
if(!bindFn.includes('activeSubPage.crm = "All Customers";')) throw new Error("Back/open customer navigation does not normalise CRM subpage state.");

console.log("Customer workspace checks passed: authoritative tabs, unique editor fields, search/filter metadata, job routing, create/back routing, validated scoped saves, imported-record defaults, dirty-state guard and responsive styles present.");
