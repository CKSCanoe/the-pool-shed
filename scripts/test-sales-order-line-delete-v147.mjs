import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('public/sales-workspace.js','utf8');
const start=source.indexOf('  function so2SalesLineDeleteAssessment');
const end=source.indexOf('  function so2ProductsContent',start);
assert(start>=0&&end>start,'Sales Order controlled-delete helpers must exist');
const helpers=source.slice(start,end);

function makeApi(data,behaviour={}){
  return new Function(
    'data','isNonStockSalesLine','currentUser','product',
    'releaseAllocatedStockForLine','addSalesOrderNotification','saveAppData','toast','render','prompt','confirm',
    helpers+'; return {so2SalesLineDeleteAssessment,so2RemoveSalesOrderLine};'
  )(
    data,
    behaviour.isNonStockSalesLine||((line)=>['custom','shipping'].includes(line.lineType)),
    ()=>({name:'Manager'}),
    id=>({id,sku:id,name:'Pump'}),
    behaviour.release||((order,line,qty)=>{line.allocated=Math.max(0,Number(line.allocated||0)-qty);return qty;}),
    behaviour.notify||(()=>{}),
    behaviour.save||(()=>true),
    behaviour.toast||(()=>{}),
    behaviour.render||(()=>{}),
    behaviour.prompt||(()=>'Human entry error'),
    behaviour.confirm||(()=>true)
  );
}

{
  const data={
    purchaseOrders:[{id:'PO-1',status:'Confirmed',supplierEmailSentAt:'2026-09-30',lines:[{productId:'P',salesOrderId:'SO-1',qty:2,received:0}]}],
    goodsNotes:[{id:'GN-1',salesOrderId:'SO-1',picked:true,packed:true,shipped:false,stockDeducted:false,lines:[{productId:'P',qty:2,picked:2,packed:2,shipped:0}]}],
    receiptEvents:[],movements:[],auditLog:[]
  };
  const order={id:'SO-1',status:'Ready To Ship',payments:[],xeroRef:'Draft',tags:[],lines:[{productId:'P',qty:2,allocated:2,picked:2,packed:2,shipped:0}]};
  let released=0,notified=false,saved=false,rendered=false;
  const api=makeApi(data,{
    release:(o,line,qty)=>{released+=qty;line.allocated-=qty;return qty;},
    notify:()=>{notified=true;},
    save:()=>{saved=true;return true;},
    render:()=>{rendered=true;}
  });
  const line=order.lines[0],assessment=api.so2SalesLineDeleteAssessment(order,line);
  assert.equal(assessment.allowed,true,'allocated/picked/packed line should be undoable before shipment or invoice');
  assert.equal(assessment.linkedPoLines.length,1);
  assert.equal(assessment.linkedGoodsNotes.length,1);
  api.so2RemoveSalesOrderLine(order,line,assessment);
  assert.equal(released,2,'allocation must be unwound');
  assert.equal(order.lines.length,0,'Sales Order line must be removed');
  assert.equal(data.goodsNotes.length,0,'empty pre-shipment goods note must be removed');
  assert.equal(data.purchaseOrders[0].lines.length,0,'unreceived linked PO demand must be removed');
  assert.equal(data.purchaseOrders[0].reviewStatus,'Needs review');
  assert.equal(data.purchaseOrders[0].status,'Draft - Review');
  assert.equal(order.lineCorrections.length,1,'SO correction history must be retained');
  assert.equal(data.purchaseOrders[0].lineCorrections.length,1,'PO correction history must be retained');
  assert(data.auditLog.length>=3,'SO, PO and fulfilment corrections must enter audit history');
  assert(notified&&saved&&rendered,'correction must notify, save and rerender');
}

{
  const data={purchaseOrders:[],goodsNotes:[{id:'GN-2',salesOrderId:'SO-2',picked:true,packed:true,shipped:false,stockDeducted:false,lines:[{productId:'P',qty:1,picked:1,packed:1,shipped:0},{productId:'Q',qty:1,picked:1,packed:1,shipped:0}]}],receiptEvents:[],movements:[],auditLog:[]};
  const order={id:'SO-2',status:'Ready To Ship',payments:[],xeroRef:'Draft',tags:[],lines:[{productId:'P',qty:1,allocated:1,picked:1,packed:1,shipped:0},{productId:'Q',qty:1,allocated:1,picked:1,packed:1,shipped:0}]};
  const api=makeApi(data);
  const assessment=api.so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,true,'pick/pack workflow alone must not lock a mistaken line');
  api.so2RemoveSalesOrderLine(order,order.lines[0],assessment);
  assert.equal(data.goodsNotes.length,1);
  assert.deepEqual(data.goodsNotes[0].lines.map(x=>x.productId),['Q'],'remaining goods note lines must stay intact');
  assert.equal(data.goodsNotes[0].picked,true);
  assert.equal(data.goodsNotes[0].packed,true);
}

{
  const data={purchaseOrders:[{id:'PO-2',status:'Received',lines:[{productId:'P',salesOrderId:'SO-3',qty:1,received:1}]}],goodsNotes:[],receiptEvents:[],movements:[],auditLog:[]};
  const order={id:'SO-3',status:'Open',payments:[],xeroRef:'Draft',tags:[],lines:[{productId:'P',qty:1,allocated:0,picked:0,packed:0,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/physically moved|received/i);
}

{
  const data={purchaseOrders:[],goodsNotes:[{id:'GN-4',salesOrderId:'SO-4',shipped:true,stockDeducted:true,shipmentLocked:true,lines:[{productId:'P',qty:1,picked:1,packed:1,shipped:1}]}],receiptEvents:[],movements:[{type:'Goods Out',productId:'P',ref:'GN-4'}],auditLog:[]};
  const order={id:'SO-4',status:'Shipped',payments:[],xeroRef:'Draft',tags:[],lines:[{productId:'P',qty:1,allocated:0,picked:1,packed:1,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/shipped|deducted/i);
}

{
  const data={purchaseOrders:[],goodsNotes:[],receiptEvents:[],movements:[],auditLog:[]};
  const order={id:'SO-5',status:'Invoiced',payments:[],xeroRef:'INV-1',tags:['Invoiced'],lines:[{productId:'P',qty:1,allocated:0,picked:0,packed:0,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/invoiced/i);
}

{
  const data={purchaseOrders:[],goodsNotes:[],receiptEvents:[],movements:[],auditLog:[]};
  const order={id:'SO-6',status:'Needs Review',payments:[{amount:500}],xeroRef:'Draft',tags:[],lines:[{productId:'P',qty:1,allocated:0,picked:0,packed:0,shipped:0}]};
  const api=makeApi(data),assessment=api.so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,true,'a recorded payment alone must not prevent correcting a non-invoiced line');
}


assert.match(source,/data-delete-selected-sales-lines=/,'Items & Pricing toolbar must expose Delete selected');
assert.match(source,/data-selected-sales-line-count=/,'selected line count must be visible in the toolbar');
assert.match(source,/function so2UpdateSelectedLineToolbar/,'checkbox selection must update the toolbar');
assert.match(source,/function so2RemoveSelectedSalesOrderLines/,'bulk selected-line undo handler must exist');
assert.match(source,/Delete selected \('/,'selected delete button must show the selected count');

console.log('PASS Sales Order line undo allows human-error corrections until invoice or physical stock movement and preserves audit history');
