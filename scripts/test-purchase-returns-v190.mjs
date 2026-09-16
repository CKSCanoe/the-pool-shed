import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const path='public/purchase-workspace.js';
assert(fs.existsSync(path),'Purchase workspace must exist');
const source=fs.readFileSync(path,'utf8');
const data={
 locations:[{id:'L-WH-A1',name:'Main Warehouse A1'}],
 stock:[{productId:'P-1',locationId:'L-WH-A1',qty:5,allocated:1}],
 products:[{id:'P-1',sku:'VALVE-1',name:'Valve',cost:20,supplier:'Certikin',supplierSku:'CERT-V1'}],
 purchaseOrders:[{id:'PO-1',supplier:'Certikin',status:'Received',lines:[{productId:'P-1',qty:5,received:5,unitCost:20,supplierSku:'CERT-V1'}]}],
 purchaseReturns:[],movements:[],salesOrders:[],receiptEvents:[{id:'GRN-1',poId:'PO-1',productId:'P-1',qty:5,locationId:'L-WH-A1'}]
};
function row(pid,loc){let r=data.stock.find(x=>x.productId===pid&&x.locationId===loc);if(!r){r={productId:pid,locationId:loc,qty:0,allocated:0};data.stock.push(r);}return r;}
const c={data,console,crypto:{randomUUID:()=>`id-${Math.random()}`},currentUser:()=>({name:'Aaron'}),
 product:(id)=>data.products.find(p=>p.id===id),purchaseOrderById:(id)=>data.purchaseOrders.find(p=>p.id===id),
 available:(r)=>Math.max(0,r.qty-r.allocated),addStock:(pid,loc,qty)=>{row(pid,loc).qty+=qty;},removeStock:(pid,loc,qty)=>{const r=row(pid,loc);if(r.qty-r.allocated<qty)return false;r.qty-=qty;return true;},
 addMovement:(type,productId,qty,from,to,ref,user,note)=>data.movements.push({type,productId,qty,from,to,ref,user,note}),
 saveAppData:()=>{},render:()=>{},toast:()=>{},escapeHtml:(v)=>String(v??''),money:(v)=>`£${Number(v||0).toFixed(2)}`,
 document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null}
};c.globalThis=c;vm.createContext(c);vm.runInContext(source,c,{filename:path});
assert.equal(typeof c.purchaseCreateSupplierReturn,'function','Supplier return API must exist');
const beforeOnHand=data.stock.reduce((n,r)=>n+r.qty,0);
const result=c.purchaseCreateSupplierReturn({poId:'PO-1',productId:'P-1',qty:2,reason:'Mis-ordered by Pool Bros',locationId:'L-WH-A1',receiptId:'GRN-1'});
assert.equal(result.ok,true);
assert.equal(data.purchaseReturns.length,1);
assert.equal(data.purchaseReturns[0].status,'Awaiting Supplier Authorisation');
assert.equal(data.purchaseReturns[0].expectedCredit,40);
assert.equal(row('P-1','L-WH-A1').qty,3);
assert.equal(row('P-1','L-RETURNS-HOLD').qty,2);
assert.equal(data.stock.reduce((n,r)=>n+r.qty,0),beforeOnHand,'return hold preserves physical On Hand total');
assert.equal(data.movements.at(-1).type,'Supplier Return Hold');
console.log('PASS supplier mis-order return moves only free stock to Returns Hold with full PO/cost traceability');
