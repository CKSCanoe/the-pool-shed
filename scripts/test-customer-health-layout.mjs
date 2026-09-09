import fs from "node:fs";

const css=fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");
const js=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");

const requiredCss=[
  ".crm-account-overview-grid{grid-template-columns:minmax(0,1fr)",
  ".crm-account-health-card .crm-cardbody{display:grid;grid-template-columns:minmax(260px,.78fr) minmax(0,1.22fr)",
  ".crm-account-health-card .crm-attention-row{margin:0;padding:0 0 0 18px;border-top:0;border-left:1px solid #d7e0e5",
  ".crm-core-sections{display:grid;grid-template-columns:minmax(210px,1fr) minmax(300px,1.35fr) minmax(210px,1fr)",
  "@media(max-width:980px)",
  ".crm-account-health-card .crm-cardbody{grid-template-columns:1fr"
];
for(const token of requiredCss) if(!css.includes(token)) throw new Error("Missing approved customer health/core layout rule: "+token);

const coreIndex=js.indexOf('crm-card crm-core-account');
const healthIndex=js.indexOf('crm-card crm-account-health-card');
const recentIndex=js.indexOf('Recent activity');
if(coreIndex < 0 || healthIndex < 0 || recentIndex < 0) throw new Error("Expected customer overview sections are missing.");
if(!(coreIndex < healthIndex && healthIndex < recentIndex)) throw new Error("Account Health must remain immediately after Account Essentials and before supporting overview cards.");

if(css.includes(".crm-account-overview-grid{grid-template-columns:minmax(0,1.7fr)"))
  throw new Error("Old squeezed Account Essentials + side health split remains.");

console.log("Customer health layout checks passed: Account Essentials is full width, Account Health is a horizontal row beneath it, core groups are rebalanced and narrow screens stack safely.");
