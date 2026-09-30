import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('public/sales-workspace.js','utf8');
const start=source.indexOf('  function so2SalesLineDeleteAssessment');
const end=source.indexOf('  function so2ProductsContent',start);
assert(start>=0&&end>start,'Sales Order controlled-delete helpers must exist');
const helpers=source.slice(start,end);

function makeApi(data,behaviour={}){
  return new Function(
    'data','isNonStockSalesLine','salesOrderLineHasFulfilmentHistory','currentUser','product',
    'releaseAllocatedStockForLine','addSalesOrderNotification','saveAppData','toast','render','prompt','confirm',
    helpers+'; return {so2SalesLineDeleteAssessment,so2RemoveSalesOrderLine};'
  )(
    data,
    behaviour.isNonStockSalesLine||((line)=>['custom','shipping'].includes(line.lineType)),
    behaviour.hasFulfilment||(()=>false),
    ()=>({name:'Manager'}),
    id=>({id,sku:id,name:'Pump'}),
    behaviour.release||((order,line,qty)=>{line.allocated=Math.max(0,Number(line.allocated||0)-qty);return qty;}),
    behaviour.notify||(()=>{}),
    behaviour.save||(()=>true),
    behaviour.toast||(()=>{}),
    behaviour.render||(()=>{}),
    behaviour.prompt||(()=>'Scope changed'),
    behaviour.confirm||(()=>true)
  );
}

{
  const data={
    purchaseOrders:[{id:'PO-1',status:'Confirmed',supplierEmailSentAt:'2026-09-30',lines:[{productId:'P',salesOrderId:'SO-1',qty:2,received:0}]}],
    receiptEvents:[],auditLog:[]
  };
  const order={id:'SO-1',status:'Open',payments:[],lines:[{productId:'P',qty:2,allocated:2,picked:0,packed:0,shipped:0}]};
  let released=0,notified=false,saved=false,rendered=false;
  const api=makeApi(data,{
    release:(o,line,qty)=>{released+=qty;line.allocated-=qty;return qty;},
    notify:()=>{notified=true;},
    save:()=>{saved=true;return true;},
    render:()=>{rendered=true;}
  });
  const line=order.lines[0],assessment=api.so2SalesLineDeleteAssessment(order,line);
  assert.equal(assessment.allowed,true,'allocated/unreceived line should be correctable');
  assert.equal(assessment.linkedPoLines.length,1);
  api.so2RemoveSalesOrderLine(order,line,assessment);
  assert.equal(released,2,'allocation must be unwound');
  assert.equal(order.lines.length,0,'Sales Order line must be removed');
  assert.equal(data.purchaseOrders[0].lines.length,0,'unreceived linked PO demand must be removed');
  assert.equal(data.purchaseOrders[0].reviewStatus,'Needs review');
  assert.equal(data.purchaseOrders[0].status,'Draft - Review');
  assert.equal(order.lineCorrections.length,1,'SO correction history must be retained');
  assert.equal(data.purchaseOrders[0].lineCorrections.length,1,'PO correction history must be retained');
  assert(data.auditLog.length>=2,'SO and PO corrections must enter audit history');
  assert(notified&&saved&&rendered,'correction must notify, save and rerender');
}

{
  const data={purchaseOrders:[{id:'PO-2',status:'Received',lines:[{productId:'P',salesOrderId:'SO-2',qty:1,received:1}]}],receiptEvents:[],auditLog:[]};
  const order={id:'SO-2',status:'Open',payments:[],lines:[{productId:'P',qty:1,allocated:0,picked:0,packed:0,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/receiving history/i);
}

{
  const data={purchaseOrders:[],receiptEvents:[],auditLog:[]};
  const order={id:'SO-3',status:'Open',payments:[],lines:[{productId:'P',qty:1,allocated:0,picked:1,packed:0,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/pick, pack or shipping history/i);
}

{
  const data={purchaseOrders:[],receiptEvents:[],auditLog:[]};
  const order={id:'SO-4',status:'Invoiced',payments:[],xeroRef:'INV-1',lines:[{productId:'P',qty:1,allocated:0,picked:0,packed:0,shipped:0}]};
  const assessment=makeApi(data).so2SalesLineDeleteAssessment(order,order.lines[0]);
  assert.equal(assessment.allowed,false);
  assert.match(assessment.reason,/payment or invoice history/i);
}

console.log('PASS Sales Order line deletion unwinds safe allocations/PO demand and protects receiving, fulfilment and accounting history');
