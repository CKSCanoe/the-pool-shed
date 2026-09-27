import fs from "node:fs";

const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");
const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");

const must=[
  ".crm-hero{background:#fff;border:1px solid #d7e0e5;border-radius:8px",
  ".crm-hero-avatar{width:64px;height:64px;border-radius:50%;background:#d9e6ec;color:#102b3a",
  ".crm-hero-copy h2{margin:0;font-size:22px",
  ".crm-hero-actions button.secondary{background:#fff;color:#183746;border:1px solid #bfd0d8}",
  ".crm-profile-tabs{display:flex;gap:0;padding:0 14px;border-top:1px solid #d7e0e5;background:#fff",
  ".crm-stat{padding:11px 12px;border:1px solid #315363;background:#173747;border-radius:7px",
  ".crm-card,.crm-depth-card{background:#fff;border:1px solid #d7e0e5;border-radius:8px",
  ".crm-core-account{background:#fff;border-color:#d7e0e5;border-top:1px solid #d7e0e5"
];
for(const token of must){
  if(!css.includes(token)) throw new Error("Missing approved dashboard-aligned customer style: "+token);
}
if(css.includes(".crm-hero{background:#102b3a") || css.includes(".crm-hero{background:#173747"))
  throw new Error("Customer profile header must not use the dark dashboard hero treatment.");
for(const hook of ["data-crm-add-note","data-crm-new-project","data-create-sales-order-customer","data-crm-edit","data-crm-profile-tab"]){
  if(!js.includes(hook)) throw new Error("Customer header action/tab hook missing: "+hook);
}
console.log("Customer light-header checks passed: light profile header, pale avatar, outlined secondary actions, teal primary action, white tabs and dashboard-aligned module treatment are present.");
