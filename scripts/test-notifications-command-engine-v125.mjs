import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const file='public/notifications-command-engine.js';
assert.ok(fs.existsSync(file),'Notifications Command engine missing');
const source=fs.readFileSync(file,'utf8');

const data={
  notifications:[
    {id:'N-SO',salesOrderId:'SO-100',customerId:'C-1',trigger:'Status changed',subject:'SO-100 moved to Ready To Pick',body:'Order is ready for warehouse action.',status:'Needs review',date:'2026-09-17 12:30'},
    {id:'N-PO',purchaseOrderId:'PO-9',type:'Supplier',message:'PO-9 is late',status:'Needs review',createdAt:'2026-09-17T10:00:00Z'},
    {id:'N-STOCK',type:'Stock',message:'Valve stock needs review',status:'Needs review',created:'2026-09-17 09:15'},
    {id:'N-DUP',salesOrderId:'SO-100',trigger:'Status changed',subject:'SO-100 moved to Ready To Pick',body:'Order is ready for warehouse action.',status:'Needs review',date:'2026-09-17 12:30'},
    {id:'N-OLD',salesOrderId:'SO-OLD',trigger:'Manual note',subject:'Historic internal note',body:'Old neutral history',status:'Saved',date:'2025-01-10 09:00'}
  ],
  adminNotifications:[{id:'ADM-1',type:'Security',message:'Admin review required',createdAt:'2026-09-17T11:00:00Z'}],
  automationCommand:{alerts:[{id:'AUTO-A1',title:'Late PO workflow failed',message:'Automation could not create supplier chase',status:'Failed',createdAt:'2026-09-17T13:00:00Z'}],runs:[]},
  automationLogs:[{id:'AUTO-L1',name:'Invoice ready',status:'Failed',message:'Action failed',createdAt:'2026-09-17T08:00:00Z'}]
};
const saved=[];
const user={id:'user-sales',name:'Sales User',role:'Sales'};
const allowed=new Set(['dashboard','salesorders','crm','settings']);
const context={console,Date,Set,Map,JSON,Math,Intl,globalThis:null,window:null};
context.globalThis=context;context.window=context;
context.__POOL_SHED_GET_DATA__=()=>data;
context.__POOL_SHED_CURRENT_USER__=()=>user;
context.__POOL_SHED_CAN_ACCESS__=(module)=>allowed.has(module);
context.__POOL_SHED_IS_ADMIN__=()=>user.role==='Admin';
context.saveAppData=()=>saved.push(JSON.stringify(data.notificationCommand||{}));
vm.createContext(context);
vm.runInContext(source,context,{filename:file});
const nc=context.PoolShedNotificationsCommand;
assert.ok(nc,'PoolShedNotificationsCommand global missing');
for(const fn of ['list','unreadCount','markRead','markAllRead','archive','create','get','filters','summary']) assert.equal(typeof nc[fn],'function',`missing ${fn}`);

const visible=nc.list();
assert.ok(visible.some(n=>n.id==='N-SO'),'Sales Order notification should be visible to Sales');
assert.ok(!visible.some(n=>n.id==='N-PO'),'Purchasing notification must be permission-filtered');
assert.ok(!visible.some(n=>n.id==='N-STOCK'),'Stock notification must be permission-filtered');
assert.ok(!visible.some(n=>n.id==='ADM-1'),'Admin notification must be hidden from non-admin');
assert.ok(!visible.some(n=>n.id==='AUTO-A1'||n.id==='AUTO-L1'),'Automation failures must be hidden without automation access');
assert.equal(visible.filter(n=>n.sourceId==='SO-100').length,1,'duplicate source events should collapse to one view item');
const so=visible.find(n=>n.id==='N-SO');
assert.equal(so.category,'Orders');
assert.equal(so.sourceModule,'salesorders');
assert.equal(so.route.module,'salesorders');
assert.equal(so.route.recordId,'SO-100');
assert.equal(so.unread,true);
assert.ok(['warning','critical','info','neutral','success'].includes(so.severity));
assert.equal(nc.get('N-OLD').unread,false,'historic neutral records should not become unread during v1.25 upgrade');
assert.equal(nc.unreadCount(),1);

assert.equal(nc.markRead('N-SO',true).ok,true);
assert.equal(nc.get('N-SO').unread,false);
assert.equal(nc.unreadCount(),0);
assert.ok(saved.length>0,'markRead must persist lifecycle state');
assert.equal(nc.markRead('N-SO',false).ok,true);
assert.equal(nc.unreadCount(),1);
assert.equal(nc.markAllRead().ok,true);
assert.equal(nc.unreadCount(),0);
assert.equal(nc.archive('N-SO',true).ok,true);
assert.equal(nc.list().some(n=>n.id==='N-SO'),false,'archived items excluded from active list');
assert.equal(nc.list({includeArchived:true}).some(n=>n.id==='N-SO'),true,'history includes archived items');

user.role='Admin';
['purchase','locations','warehouse','automation','accounting','jobs'].forEach(x=>allowed.add(x));
const adminVisible=nc.list({includeArchived:true});
assert.ok(adminVisible.some(n=>n.id==='ADM-1'),'Admin notification should be visible to Admin');
assert.ok(adminVisible.some(n=>n.id==='AUTO-A1'),'Automation alert should be visible with permission');
assert.ok(adminVisible.some(n=>n.id==='AUTO-L1'),'Failed automation log should be normalized');
assert.ok(adminVisible.some(n=>n.id==='N-PO'),'PO alert should be visible with purchase permission');
assert.ok(adminVisible.some(n=>n.id==='N-STOCK'),'Stock alert should be visible with inventory permission');

const created=nc.create({category:'Projects',title:'Margin review',message:'Project J-10 is below margin threshold',severity:'warning',sourceModule:'jobs',sourceType:'project',sourceId:'J-10',route:{module:'jobs',recordType:'project',recordId:'J-10'},audience:{roles:['Admin']},dedupeKey:'project-margin:J-10'});
assert.equal(created.ok,true);
assert.ok(data.notifications.some(n=>n.id===created.notification.id),'create writes canonical notification stream');
const len=data.notifications.length;
const duplicate=nc.create({category:'Projects',title:'Margin review',message:'Duplicate',severity:'warning',sourceModule:'jobs',sourceId:'J-10',route:{module:'jobs',recordId:'J-10'},dedupeKey:'project-margin:J-10'});
assert.equal(duplicate.ok,true);
assert.equal(duplicate.deduped,true);
assert.equal(data.notifications.length,len,'deduped notification must not create second record');
assert.ok(nc.filters().some(f=>f.id==='unread'));
assert.equal(typeof nc.summary().unread,'number');
console.log('PASS Notifications Command engine normalization, lifecycle, permissions and dedupe');
