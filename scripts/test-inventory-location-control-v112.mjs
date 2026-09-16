import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/inventory-workspace.js'),'Inventory workspace authority must exist');
const js=fs.readFileSync('public/inventory-workspace.js','utf8');
for(const token of ['Overview','Stock','Locations','Engineer Vans','Project Stock','Transfers & Top-Ups','Cycle Counts','Missing / Damaged','Stock Movements','Exceptions & Alerts']) assert(js.includes(token),`Inventory navigation missing ${token}`);
for(const token of ['On Hand','Allocated','Available','Min','Target','Max','Upcoming Demand','Suggested Move','Count Due','Create Top-Up Transfer','Return excess stock','Smart Min','Project demand']) assert(js.includes(token),`Location Control missing ${token}`);
for(const hook of ['data-inv-open-location','data-inv-topup','data-inv-return','data-inv-open-product','data-inv-open-project','data-inv-open-replenishment','data-inv-start-count']) assert(js.includes(hook),`Inventory connection/action missing ${hook}`);
assert(js.includes("renderLocations=function"),'Inventory workspace must own the Inventory render surface');
console.log('PASS Inventory Option C Location Control structure and connected actions');
