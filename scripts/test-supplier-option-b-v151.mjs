import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/supplier-command-workspace.js','utf8');
const engineJs=fs.readFileSync('public/supplier-command-engine.js','utf8');
const css=fs.readFileSync('public/assets/css/system/49-supplier-command.css','utf8');
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');
const sales=fs.readFileSync('public/sales-workspace.js','utf8');
const build=fs.readFileSync('scripts/build.sh','utf8');

for(const token of [
  'SUPPLIER DIRECTORY','Open Profile','SUPPLIER PROFILE','SUPPLIER OPERATIONS',
  'CUSTOMER CASH COVER','BILLS & COMMITMENTS DUE','SUPPLIER PAYMENT TIMELINE',
  'scSupplierAccountType','data-sc-open-sales-order','data-sc-open-po',
  'openSupplierCommand','openSupplierProfile','data-sc-open-profile','data-sc-back-suppliers',
  'data-sc-delete-supplier','data-sc-confirm-delete-supplier','Are you sure?'
]) assert(js.includes(token),'Supplier architecture missing '+token);

for(const column of ['Account','Health','Open POs','Bills due','Exposure','Lead / delivery','Attention','Action'])
  assert(js.includes(column),'Supplier directory missing '+column+' column');

for(const tab of ['Overview','Purchase Orders','Bills & Credits','Products & Price Lists','Late & Backorders','Returns & Credits','Spend & Performance','Contacts','Notes & Activity'])
  assert(js.includes(tab),'Supplier tab missing '+tab);

for(const route of [
  "scState.tab==='Contacts')return contacts(name)",
  "scState.tab==='Products & Price Lists')return products(name)",
  "scState.tab==='Purchase Orders')return purchaseOrders(name)",
  "scState.tab==='Bills & Credits')return billsCredits(name)",
  "scState.tab==='Notes & Activity')return notesActivity(name)",
  "return overview(name)"
]) assert(js.includes(route),'Supplier tab dispatcher missing '+route);

const command=js.slice(js.indexOf('function commandPage()'),js.indexOf('supplierManagementPage = function'));
assert(command.includes("commandMetrics()+queue()"),'Supplier directory page must contain metrics + supplier list');
assert(!command.includes('supplierDetails('),'Supplier directory must not render detached supplier operations');

const profile=js.slice(js.indexOf('function supplierProfilePageView(name)'),js.indexOf('function commandPage()'));
assert(profile.includes("supplierDetails(name)"),'Supplier Operations must render inside the Supplier Profile');
assert(profile.includes('Company identity')&&profile.includes('Contact & ordering')&&profile.includes('Business address')&&profile.includes('Commercial & purchasing'),'Supplier Profile master-data sections are incomplete');
assert(profile.includes('Review payment terms'),'Pro Forma / credit-term mismatch warning must remain');

assert(js.includes("globalThis.openSupplierCommand=function(name,tab){if(name)selectedSupplierName=name;scState.tab=tabs.includes(tab)?tab:'Overview';purchaseOrderView='supplier-profile'"),'Deep supplier links must open the Supplier Profile');
assert(js.includes("supplierCataloguePage = function(name){if(name)selectedSupplierName=name;scState.tab='Products & Price Lists';return supplierProfilePageView"),'Supplier catalogue shortcut must stay inside Supplier Profile');
assert(js.includes("document.addEventListener('keydown'"),'Supplier directory rows must support keyboard opening');
assert(!js.includes('function supplierProfilePane('),'Retired embedded supplier side profile must not return');
assert(!js.includes('function attentionRail('),'Retired Supplier attention rail must not return');

assert(css.includes('Supplier workspace v3: PO-style directory -> full profile -> embedded operations'),'Supplier v3 CSS marker missing');
assert(css.includes('.supplier-directory-row'),'PO-style Supplier Directory styling missing');
assert(css.includes('.sc-profile-operations-divider'),'Supplier Profile / Operations hierarchy styling missing');
assert(css.includes('.sc-remove-supplier'),'Supplier removal control styling missing');

assert.match(purchase,/data-po-open-supplier-funding[\s\S]*purchaseOrderView='supplier-profile'/,'PO fallback supplier navigation must open Supplier Profile');
assert.match(sales,/data-so-open-supplier-funding[\s\S]*purchaseOrderView='supplier-profile'/,'Sales Order fallback supplier navigation must open Supplier Profile');

assert(build.includes('test-supplier-option-b-v151.mjs'),'Supplier architecture regression guard must run on every production build');

const deletionData={
  suppliers:[{name:'Unused Supplier'},{name:'Used Supplier'}],
  purchaseOrders:[
    {id:'PO-USED',supplier:'Used Supplier',lines:[{productId:'P1',qty:1}]},
    {id:'PO-EMPTY',supplier:'Unused Supplier',lines:[]}
  ],
  products:[{id:'P2',name:'Loose product',supplier:'Unused Supplier',preferredSupplier:'Unused Supplier'}],
  supplierProducts:[{id:'SP-1',supplier:'Unused Supplier',productId:'P2'}]
};
let saveCount=0;
const context={window:{__POOL_SHED_GET_DATA__:()=>deletionData,saveAppData:()=>{saveCount++;}},console};
vm.createContext(context);vm.runInContext(engineJs,context);
const supplierEngine=context.window.PoolShedSupplierCommand;
const blocked=supplierEngine.supplierDeletionCheck('Used Supplier');
assert.equal(blocked.canDelete,false,'Supplier with PO lines must be protected');
assert.equal(blocked.lineCount,1,'PO line blocker count must be reported');
assert.equal(blocked.purchaseOrders[0].poId,'PO-USED','Blocking PO must be identified');
assert.equal(supplierEngine.deleteSupplier('Used Supplier').deleted,false,'Protected supplier delete must fail in the engine');
assert(deletionData.suppliers.some(s=>s.name==='Used Supplier'),'Blocked supplier must remain in supplier master data');

const allowed=supplierEngine.supplierDeletionCheck('Unused Supplier');
assert.equal(allowed.canDelete,true,'Supplier without PO lines should be removable');
const removed=supplierEngine.deleteSupplier('Unused Supplier');
assert.equal(removed.deleted,true,'Unreferenced supplier should delete');
assert(!deletionData.suppliers.some(s=>s.name==='Unused Supplier'),'Deleted supplier master record must be removed');
assert.equal(deletionData.purchaseOrders.find(po=>po.id==='PO-EMPTY').supplier,'','Empty PO supplier reference must be cleared');
assert.equal(deletionData.products[0].supplier,'','Products must become unassigned when their supplier is removed');
assert.equal(deletionData.products[0].preferredSupplier,'','Preferred supplier pointer must also be cleared');
assert.equal(deletionData.supplierProducts.length,0,'Supplier catalogue offers must be removed with supplier');
assert.equal(saveCount,1,'Successful supplier deletion must persist once');

console.log('PASS Supplier Directory -> Supplier Profile -> embedded Supplier Operations architecture, cross-links and protected supplier deletion');
