import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const handlers={},seen=[];
const c={PoolShedInventoryControl:{},inventoryView:'overview',activeSubPage:{locations:'Locations'},active:'locations',selectedInventoryLocationId:'',data:{},renderLocations(){seen.push({view:c.inventoryView,id:c.selectedInventoryLocationId})},render(){c.renderLocations()},document:{addEventListener(t,fn){(handlers[t]??=[]).push(fn)},getElementById(){return {classList:{add(){}}}}}};
vm.createContext(c);vm.runInContext(fs.readFileSync('public/inventory-workspace.js','utf8'),c);
function click(attr,value){const key=attr.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase());const button={hasAttribute:a=>a===attr,dataset:{[key]:value}};for(const fn of handlers.click)fn({target:{closest:s=>s==='button'?button:null}})}
click('data-inv-manage-locations','');assert.equal(seen.at(-1).view,'manage-locations');
click('data-inv-start-count','L-1');assert.deepEqual(seen.at(-1),{view:'location',id:'L-1'});
c.inventoryView='stocktake';c.renderLocations();assert.equal(seen.at(-1).view,'location','Old deep link aliases remain compatible');
c.inventoryView='manager';c.renderLocations();assert.equal(seen.at(-1).view,'manage-locations');
for(const [file,marker] of [['inventory-workspace.js','<nav class="inventory-subnav"'],['product-hub-workspace.js','<div class="ph-section-nav"'],['fulfilment-workspace.js','<nav class="ff-subnav"'],['warehouse-workspace.js','<div class="warehouse-precision-tabs"']])assert(!fs.readFileSync('public/'+file,'utf8').includes(marker),'Sidebar destinations duplicated in '+file);
assert(fs.readFileSync('public/sales-workspace.js','utf8').includes('Items & Pricing'));
assert(fs.readFileSync('public/purchase-workspace.js','utf8').includes('Purchase Order sections'));
assert(fs.readFileSync('public/project-design-parity.js','utf8').includes('aria-label="This project"'));
for(const name of ['61-project-design-parity.css','62-record-controls.css','63-workspace-compatibility.css'])assert(!/#[0-9a-f]{3,8}\b/i.test(fs.readFileSync('public/assets/css/system/'+name,'utf8')),'Workspace must inherit theme tokens: '+name);
const source=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8'),start=source.indexOf('      function saveJobFromForm(form) {'),end=source.indexOf('\n      }',start)+8;
const j={id:'J1',name:'Original',customerId:'C',status:'Planning'},messages=[],ctx={data:{jobs:[j]},isAdminUser:()=>true,FormData:class{constructor(f){this.f=f}entries(){return Object.entries(this.f)}},currentUser:()=>({name:'Manager'}),todayIso:()=> '2026-09-26',saveAppData:()=>false,workspaceLocalSaveFailed:true,toast:m=>messages.push(m),render:()=>{},selectedJobId:'J1',activeSubPage:{jobs:'Create Job'},jobCreateCustomerId:'',nextJobId:()=> 'J2'};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);ctx.saveJobFromForm({id:'J1',name:'Changed',customerId:'C',status:'Planning'});assert.equal(ctx.data.jobs[0].name,'Original');assert.equal(ctx.selectedJobId,'J1');assert(messages.at(-1).includes('not saved'));
console.log('PASS inventory manager/count routing, old-link compatibility, single module navigation, preserved record tabs, theme token ownership and project-edit save rollback');
