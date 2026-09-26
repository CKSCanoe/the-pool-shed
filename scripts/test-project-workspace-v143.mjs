import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const data={jobs:[{id:'J1',name:'Indoor pool refurbishment',owner:'Aaron',customerId:'C1',status:'In Progress'},{id:'J2',name:'Cover replacement',customerId:'C2',status:'On Hold'},{id:'J3',name:'Old pool',customerId:'C2',status:'Cancelled'}],customers:[{id:'C1',name:'White household'},{id:'C2',name:'Smith household'}],salesOrders:[],purchaseOrders:[],products:[],toolAssignments:[],locations:[],stock:[],allocations:[],movements:[]};
const listeners={},screen={innerHTML:''},errors=[];
const c={data,crypto:globalThis.crypto,console,currentUser:()=>({id:'u',name:'Manager'}),canAccessTab:()=>true,isAdminUser:()=>true,saveAppData:()=>true,workspaceLocalSaveFailed:false,customer:id=>data.customers.find(x=>x.id===id),money:n=>'£'+Number(n).toFixed(2),todayIso:()=>'2026-09-25',escapeHtml:v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),sidebarSubGroups:()=>[],renderJobs(){},deleteJobReference(){},psOperationalIssues:()=>[],saveJobFromForm(){},selectedSubPage:()=>'Projects',toast:m=>errors.push(m),document:{getElementById:()=>screen,addEventListener(type,fn){(listeners[type]??=[]).push(fn)}},FormData:class{constructor(f){this.values=f.values}get(k){return this.values[k]}*[Symbol.iterator](){yield* Object.entries(this.values)}}};
vm.createContext(c);vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),c);
for(const j of data.jobs){Object.assign(c.psProjectModel(j),{quoteNet:1000,quoteAccepted:true,forecastReviewedAt:new Date().toISOString()})}
vm.runInContext(fs.readFileSync('public/project-workspace.js','utf8'),c);c.render=()=>{screen.innerHTML=c.psProjectWorkspace()};c.activeSubPage={jobs:'Projects'};c.openSidebarSubGroup=c.render;vm.runInContext(fs.readFileSync('public/project-design-parity.js','utf8'),c);
async function click(attr,value=''){const key=attr.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase());const b={dataset:{[key]:value},hasAttribute:n=>n===attr};for(const fn of listeners.click||[])await fn({target:{closest:s=>s==='button'?b:null},preventDefault(){},stopImmediatePropagation(){}})}
async function search(search,filter='all'){const f={values:{search,filter}};for(const fn of listeners.submit||[])await fn({target:{closest:s=>s==='[data-project-search-form]'?f:null},preventDefault(){}})}
c.render();assert(screen.innerHTML.includes('3 of 3 projects'));
await search('white');assert(screen.innerHTML.includes('1 of 3 projects'));assert(!screen.innerHTML.includes('Cover replacement'));
await search('aaron');assert(screen.innerHTML.includes('Indoor pool refurbishment'));
await search('','closed');assert(screen.innerHTML.includes('Old pool'));assert(!screen.innerHTML.includes('Indoor pool refurbishment'));
await search('no matching project');assert(screen.innerHTML.includes('No projects match your search'));
await click('data-project-clear-search');assert(screen.innerHTML.includes('3 of 3 projects'));
await click('data-project-home-view','Stage Board');assert(screen.innerHTML.includes('<span>On Hold</span>'));assert(screen.innerHTML.includes('<span>Cancelled</span>'));assert.equal(c.psProjectStage('On Hold'),'On Hold');assert.equal(c.psProjectStage('Cancelled'),'Cancelled');
await click('data-project-open','J1');assert(!screen.innerHTML.includes('project-nav-group'));assert(!c.sidebarSubGroups('jobs').includes('Settings'));assert.deepEqual(Array.from(c.sidebarSubGroups('jobs')),['Projects','Tool Register']);assert(screen.innerHTML.includes('pl-record-nav'));assert(!screen.innerHTML.includes('project-overview-shortcuts'));assert(screen.innerHTML.includes('ps-project-lab'));assert(screen.innerHTML.includes('pl-metrics'));assert(!screen.innerHTML.includes('project-144-layout'));assert(!screen.innerHTML.includes('name="settingsReason"'));assert(screen.innerHTML.includes('pl-flow'));
for(const [tab,needle] of [['Costing & Margin','Record labour'],['Scope & Tasks','Add task'],['Materials','Save material plan'],['Procurement','No Purchase Orders'],['Settings','Project commercial settings'],['Orders & Pricing','Sales orders · cost & selling prices'],['Extras & Approvals','Extras & customer agreement'],['Correspondence','Save correspondence'],['Overview','What needs attention']]){await click('data-project-tab',tab);assert(screen.innerHTML.includes(needle),tab+' opens correctly')}
await click('data-project-tab','Settings');assert(screen.innerHTML.includes('name="settingsReason"'));await click('data-project-tab','Overview');assert(!screen.innerHTML.includes('name="settingsReason"'));assert(!screen.innerHTML.includes('data-project-form="settings"'));assert.equal(errors.length,0,errors.join('\n'));
await click('data-project-back');assert(screen.innerHTML.includes('data-project-search-form'));
assert.equal(data.jobs[0].project.costs.length,0,'Browsing does not add project costs');
await click('data-project-open','J1');
await click('data-project-tab','Settings');assert(screen.innerHTML.includes('name="settingsReason"'));
await click('data-project-tab','Costing & Margin');assert(screen.innerHTML.includes('data-pl-form="time"'));assert.equal((screen.innerHTML.match(/data-project-tab="Settings"/g)||[]).length,1);
let closed=false,removed=false;
const form={dataset:{projectForm:'time'},values:{jobId:'J1',supplier:'Team',ref:'TS-1',date:'2026-09-25',hours:2,hourlyRate:25,replaceRemaining:'no'},closest:()=>({close(){closed=true},remove(){removed=true}})};
for(const fn of listeners.submit||[])await fn({target:{closest:s=>s==='[data-project-form]'?form:null},preventDefault(){}});
assert.equal(data.jobs[0].project.costs.length,1);assert.equal(data.jobs[0].project.costs[0].net,50);assert(closed&&removed,'Successful transaction closes entry dialog');
closed=false;removed=false;form.values.hours=-1;
for(const fn of listeners.submit||[])await fn({target:{closest:s=>s==='[data-project-form]'?form:null},preventDefault(){}});
assert(!closed&&!removed,'Invalid submission keeps dialog open');assert.equal(data.jobs[0].project.costs.length,1);
c.openSidebarSubGroup('jobs','Projects');assert(screen.innerHTML.includes('data-project-search-form'));
vm.runInContext(fs.readFileSync('public/project-setup-tools.js','utf8'),c);
const setupHTML=c.psProjectSetupView();assert(setupHTML.includes('data-project-form="create"'));for(const name of ['quoteNet','quoteRef','acceptanceRef','remainingNet','minimumMargin','targetMargin'])assert(setupHTML.includes('name="'+name+'"'));
const toolsHTML=c.psProjectToolsView(data.jobs[0],c.psProjectModel(data.jobs[0]),c.psProjectSummary(data.jobs[0]));assert(toolsHTML.includes('data-project-form="tool-add"'));assert(toolsHTML.includes('Final charge date'));
assert(!fs.readFileSync('public/professional-workspace.js','utf8').includes('screen.prepend(nav)'));
assert(!fs.readFileSync('public/purchase-workspace.js','utf8').includes('data-purchase-view="suppliers">Suppliers'));
assert(fs.readFileSync('public/sales-workspace.js','utf8').includes('Items & Pricing'));


const css=fs.readFileSync('public/assets/css/system/45-project-360-command.css','utf8');assert(css.includes('.project-360-detail .project-table-compact{min-width:0'));
console.log('PASS actual project search/filter/reset handlers, customer and owner search, board lifecycle labels, grouped navigation, project tabs and return to list');
