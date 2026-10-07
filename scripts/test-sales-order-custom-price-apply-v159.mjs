import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');

const priceStart=src.indexOf('      function salesOrderLinePrice(');
const marginStart=src.indexOf('      function marginCheckLinePrice(',priceStart);
const marginEnd=src.indexOf('      function vatRateForLine(',marginStart);
const priceEnd=marginStart;
const applyStart=src.indexOf('      function applyMarginPriceToSalesOrder(');
const applyEnd=src.indexOf('      function allocateSalesOrderLine(',applyStart);
assert(priceStart>0&&priceEnd>priceStart&&marginStart>0&&marginEnd>marginStart&&applyStart>0&&applyEnd>applyStart);

const productRecord={id:'CUSTOM-1',sku:'CUSTOM-1',rrp:0,trade:0,wholesale:0};
const order={
  id:'SO-1',
  priceList:'wholesale',
  lines:[{
    productId:'CUSTOM-1',
    lineType:'custom',
    qty:1,
    allocated:1,
    unitPrice:0,
    unitCost:650,
    specialPrice:0,
    marginCheckPrice:1101
  }]
};
let saves=0,notifications=0,renders=0;
const context={
  product:id=>id==='CUSTOM-1'?productRecord:null,
  orderPriceList:()=> 'wholesale',
  salesOrder:id=>id==='SO-1'?order:null,
  isNonStockSalesLine:line=>line.lineType==='custom',
  money:value=>'£'+Number(value).toFixed(2),
  addSalesOrderNotification:()=>{notifications+=1;},
  saveAppData:()=>{saves+=1;return true;},
  toast:()=>{},
  render:()=>{renders+=1;},
  Date,
  console
};
vm.createContext(context);
vm.runInContext(src.slice(priceStart,priceEnd)+src.slice(marginStart,marginEnd)+src.slice(applyStart,applyEnd),context);

assert.equal(context.salesOrderLinePrice(order,order.lines[0]),0,'before applying, original custom price should be £0');
context.applyMarginPriceToSalesOrder('SO-1','CUSTOM-1');

assert.equal(order.lines[0].specialPrice,1101,'applied Cost & Margin price must become the Sales Order override');
assert.equal(order.lines[0].unitPrice,1101,'custom line unitPrice must stay in sync with applied price');
assert.equal(order.lines[0].marginCheckPrice,undefined,'reference margin price should be cleared after it becomes the real Sales Order price');
assert.equal(context.salesOrderLinePrice(order,order.lines[0]),1101,'Items & Pricing must read £1,101 after apply');
assert.equal(saves,1,'applied price must persist immediately');
assert.equal(notifications,1,'price application must be auditable');
assert.equal(renders,1,'Items & Pricing and totals must rerender');

order.lines[0].unitPrice=25;
order.lines[0].specialPrice=40;
assert.equal(context.salesOrderLinePrice(order,order.lines[0]),40,'explicit Sales Order override must take precedence over original unit price');

console.log('PASS custom Sales Order Cost & Margin prices apply to Items & Pricing, totals and saved workspace');