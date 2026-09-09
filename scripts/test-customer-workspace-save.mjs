import fs from "node:fs";

const source=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
function extractFunction(name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0) throw new Error(`Missing ${name}`);
  const brace=source.indexOf("{",start);
  let depth=0, quote=null, escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped) escaped=false;
      else if(ch==="\\") escaped=true;
      else if(ch===quote) quote=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`') quote=ch;
    else if(ch==="{") depth++;
    else if(ch==="}" && --depth===0) return source.slice(start,i+1);
  }
  throw new Error(`Unclosed ${name}`);
}

const fnSource=extractFunction("saveCrmCustomer");
const customers=[
  {
    id:"C-1", name:"Aqua Ltd", companyName:"Aqua Ltd", firstName:"Louise", lastName:"Daniel",
    email:"sales@aqua.test", phone:"01482", mobile:"", code:"CUST-1",
    brightpearlContactId:"BP-1", shopifyCustomerId:"", xeroContactId:"XR-1",
    addresses:{primary:{line1:"1 Old Rd"},billing:{line1:"1 Old Rd"},delivery:{line1:"2 Dock Rd"}},
    customFields:{accessNotes:"Call first"}, matrix:{brightpearl:"Linked",shopify:"Not linked",xero:"Linked"}
  },
  {id:"C-2",name:"Other Ltd",companyName:"Other Ltd",email:"other@test",code:"CUST-2",addresses:{},customFields:{},matrix:{}}
];
let syncCount=0,saveCount=0,renderCount=0,lastToast="";
const data={customers};
const customer=id=>data.customers.find(c=>c.id===id);
const syncCustomerMasterAddressToOrders=()=>{syncCount++};
const saveAppData=()=>{saveCount++};
const render=()=>{renderCount++};
const toast=message=>{lastToast=message};

function field(dataset,value,type="text"){ return {dataset,value,type}; }
let crmFields=[
  field({crmField:"C-1|companyName"},"Aqua Living Ltd"),
  field({crmField:"C-1|email"},"new@aqua.test"),
  field({crmField:"C-1|creditLimit"},"15000","number"),
  field({crmField:"C-1|customFields.accessNotes"},"Call before delivery")
];
let crmAddresses=[field({crmAddress:"C-1|delivery|line1"},"Unit 4 East Dock")];
const scope={
  querySelectorAll(selector){
    if(selector.includes("data-crm-field")) return crmFields;
    if(selector.includes("data-crm-address")) return crmAddresses;
    return [];
  }
};
const document={
  querySelector(selector){ return selector===".crm-edit-drawer" ? scope : null; }
};

const saveCrmCustomer=eval(`(${fnSource})`);
saveCrmCustomer("C-1");
if(customers[0].companyName!=="Aqua Living Ltd" || customers[0].email!=="new@aqua.test") throw new Error("Edited master fields were not saved.");
if(customers[0].creditLimit!==15000) throw new Error("Numeric CRM field did not save as a number.");
if(customers[0].customFields.accessNotes!=="Call before delivery") throw new Error("Nested custom field was not saved.");
if(customers[0].addresses.delivery.line1!=="Unit 4 East Dock") throw new Error("Delivery address did not save.");
if(customers[0].name!=="Aqua Living Ltd") throw new Error("Display name did not refresh from company name.");
if(syncCount!==1 || saveCount!==1 || renderCount!==1) throw new Error("Successful save did not sync/persist/render exactly once.");

const snapshot=JSON.stringify(customers[0]);
crmFields=[field({crmField:"C-1|email"},"other@test")];
crmAddresses=[];
saveCrmCustomer("C-1");
if(JSON.stringify(customers[0])!==snapshot) throw new Error("Duplicate-email validation mutated the customer before rejecting.");
if(syncCount!==1 || saveCount!==1 || renderCount!==1) throw new Error("Rejected duplicate save triggered persistence/sync/render.");
if(!lastToast.includes("already uses")) throw new Error("Duplicate-email rejection did not provide a useful message.");

crmFields=[
  field({crmField:"C-1|companyName"},""),
  field({crmField:"C-1|firstName"},""),
  field({crmField:"C-1|lastName"},"")
];
saveCrmCustomer("C-1");
if(JSON.stringify(customers[0])!==snapshot) throw new Error("Invalid blank-name save mutated the customer.");
if(!lastToast.includes("company name or customer person name")) throw new Error("Blank-name validation did not provide a useful message.");

console.log("Customer save-flow checks passed: scoped edits, nested fields, addresses, numeric fields, duplicate protection, validation, sync and persistence.");
