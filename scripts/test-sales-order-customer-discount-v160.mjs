import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const workspace=fs.readFileSync('public/sales-workspace.js','utf8');
const css=fs.readFileSync('public/assets/css/system/42-sales-order-parity.css','utf8');

assert.match(workspace,/CRM discount \('/,'Live totals must show the CRM discount rate');
assert.match(workspace,/Price list subtotal/,'Live totals must show the pre-discount subtotal');
assert.match(workspace,/Net after discount/,'Live totals must show the discounted net');
assert.match(workspace,/% CRM discount/,'Customer card must surface the CRM discount');
assert.match(workspace,/before · .*% CRM/,'Line unit price must explain the CRM discount');
assert.match(css,/\.so2-discount-row/,'CRM discount needs dedicated visual treatment');
assert.match(legacy,/customerDiscountRate: normaliseSalesOrderDiscountRate\(c\.discount\)/,'new manual Sales Orders must snapshot the CRM discount');
assert.match(legacy,/order\.customerDiscountRate = normaliseSalesOrderDiscountRate\(nextCustomer\.discount\)/,'changing the Sales Order customer must carry the CRM discount');
assert.match(legacy,/CRM commercial profile synced/,'CRM commercial edits must sync to open draft Sales Orders');
assert.match(legacy,/accepted quote snapshot/,'accepted quote snapshots must be protected from an extra CRM discount');

const helperStart=legacy.indexOf('      function normaliseSalesOrderDiscountRate(');
const helperEnd=legacy.indexOf('      function customerFinancialSummary(',helperStart);
const orderPriceStart=legacy.indexOf('      function orderPriceList(',helperEnd);
const orderPriceEnd=legacy.indexOf('      function isNonStockSalesLine(',orderPriceStart);
const priceStart=legacy.indexOf('      function salesOrderLineBasePrice(',orderPriceEnd);
const priceEnd=legacy.indexOf('      function marginCheckLinePrice(',priceStart);
assert(helperStart>0&&helperEnd>helperStart&&orderPriceStart>0&&orderPriceEnd>orderPriceStart&&priceStart>0&&priceEnd>priceStart);

const customers={
  C1:{id:'C1',name:'Regency High School',priceList:'trade',discount:20},
  C2:{id:'C2',name:'Retail Customer',priceList:'rrp',discount:0}
};
const products={
  P1:{id:'P1',sku:'P1',rrp:125,trade:100,wholesale:90},
  CUSTOM:{id:'CUSTOM',sku:'CUSTOM',rrp:0,trade:0,wholesale:0},
  SHIP:{id:'SHIP',sku:'SHIP',rrp:50,trade:50,wholesale:50}
};
const context={
  customer:id=>customers[id]||null,
  product:id=>products[id]||null,
  vatAmount:(net,line)=>String(line.taxCode||'20% VAT').toLowerCase().includes('20')?Number(net)*0.2:0,
  console,
  Number
};
vm.createContext(context);
vm.runInContext(
  legacy.slice(helperStart,helperEnd)+
  legacy.slice(orderPriceStart,orderPriceEnd)+
  legacy.slice(priceStart,priceEnd),
  context
);

const order={
  id:'SO-REG',
  customerId:'C1',
  priceList:'trade',
  lines:[
    {productId:'P1',qty:2,taxCode:'20% VAT'},
    {productId:'CUSTOM',lineType:'custom',qty:1,specialPrice:1101,unitPrice:1101,taxCode:'20% VAT'},
    {productId:'SHIP',lineType:'shipping',qty:1,specialPrice:50,unitPrice:50,taxCode:'20% VAT'}
  ],
  payments:[]
};

assert.equal(context.salesOrderCustomerDiscountRate(order),20,'Regency CRM profile should provide a 20% Sales Order discount');
assert.equal(context.salesOrderLineBasePrice(order,order.lines[0]),100,'Trade price should be the pre-discount base');
assert.equal(context.salesOrderLinePrice(order,order.lines[0]),80,'20% CRM discount should reduce £100 trade price to £80');
assert.equal(context.salesOrderLinePrice(order,order.lines[1]),880.8,'20% CRM discount should apply to a custom £1,101 net item');
assert.equal(context.salesOrderLinePrice(order,order.lines[2]),50,'Shipping should remain exempt from the CRM customer discount');

const totals=context.salesOrderTotals(order);
assert.equal(Number(totals.subtotal.toFixed(2)),1351,'pre-discount subtotal should include trade/custom/shipping values');
assert.equal(Number(totals.discount.toFixed(2)),260.2,'CRM discount should be visible as a separate monetary amount');
assert.equal(Number(totals.net.toFixed(2)),1090.8,'discounted Sales Order net should be correct');
assert.equal(Number(totals.vat.toFixed(2)),218.16,'VAT must be calculated after the CRM discount');
assert.equal(Number(totals.gross.toFixed(2)),1308.96,'gross total must use discounted net plus VAT');

const quoteOrder={id:'SO-Q',customerId:'C1',priceList:'Accepted quote snapshot',lines:[{productId:'P1',qty:1,specialPrice:100,taxCode:'20% VAT'}],payments:[]};
assert.equal(context.salesOrderCustomerDiscountRate(quoteOrder),0,'accepted quote snapshot must not receive a second CRM discount');
assert.equal(context.salesOrderLinePrice(quoteOrder,quoteOrder.lines[0]),100,'accepted quote price must remain frozen');

const overrideOrder={id:'SO-O',customerId:'C1',priceList:'trade',customerDiscountRate:10,lines:[{productId:'P1',qty:1,taxCode:'20% VAT'}],payments:[]};
assert.equal(context.salesOrderLinePrice(overrideOrder,overrideOrder.lines[0]),90,'Sales Order discount snapshot should take precedence over later CRM changes');

console.log('PASS CRM profile discount flows through Sales Order line pricing, VAT, live totals, custom lines and quote protection');