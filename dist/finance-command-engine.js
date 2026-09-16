/* Pool Shed v1.16.0 Finance Command calculation authority. Xero remains the accounting ledger. */
(function(global){
  'use strict';
  var DAY=86400000;
  function store(){try{return global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():(global.data||{});}catch(_){return global.data||{};}}
  function finance(){try{return typeof global.psFinanceSnapshot==='function'?(global.psFinanceSnapshot()||{}):{};}catch(_){return {};}}
  function num(v){v=Number(v);return Number.isFinite(v)?v:0;}
  function text(v){return String(v==null?'':v).trim();}
  function arr(v){return Array.isArray(v)?v:[];}
  function round(v){return Math.round((num(v)+Number.EPSILON)*100)/100;}
  function isoDate(v){
    if(!v)return '';
    var s=String(v),m=s.match(/\/Date\((\d+)/);if(m)return new Date(Number(m[1])).toISOString().slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
    var d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
  }
  function today(opts){return isoDate(opts&&opts.today)||new Date().toISOString().slice(0,10);}
  function days(a,b){var x=Date.parse(isoDate(a)),y=Date.parse(isoDate(b));return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/DAY):0;}
  function customerId(order){return text(order&& (order.customerId||order.customer_id||order.customer?.id||order.customer));}
  function productLineValue(line){return num(line&&line.qty)*num(line&&(line.unitPrice!=null?line.unitPrice:line.price!=null?line.price:line.sellPrice!=null?line.sellPrice:line.rrp));}
  function orderValue(order){
    if(!order)return 0;
    for(var key of ['totalIncVat','grandTotal','total','value','orderTotal'])if(Number.isFinite(Number(order[key])))return round(order[key]);
    return round(arr(order.lines).reduce(function(s,l){return s+productLineValue(l);},0));
  }
  function poValue(po){return round(arr(po&&po.lines).reduce(function(s,l){return s+num(l.qty)*num(l.unitCost!=null?l.unitCost:l.cost);},0));}
  function allDocuments(){return arr(finance().documents);}
  function documentForSource(sourceId,kind){return allDocuments().find(function(d){return d&&d.source_id===sourceId&&(!kind||d.kind===kind);})||null;}
  function docDueDate(doc){return isoDate(doc&&doc.remote&&(doc.remote.DueDate||doc.remote.DueDateString))||isoDate(doc&&doc.due_date)||'';}
  function docTotal(doc){if(!doc)return 0;if(doc.remote&&Number.isFinite(Number(doc.remote.Total)))return round(doc.remote.Total);return round(num(doc.amount_due)+num(doc.amount_paid)+num(doc.amount_credited));}
  function dueOutstanding(doc){return Math.max(0,round(doc&&doc.amount_due));}
  function customerOrders(id){return arr(store().salesOrders).filter(function(o){return customerId(o)===id;});}
  function customerDocs(id){var ids=new Set(customerOrders(id).map(function(o){return o.id;}));return allDocuments().filter(function(d){return d.kind==='ACCREC'&&ids.has(d.source_id);});}
  function supplierPos(name){return arr(store().purchaseOrders).filter(function(po){return text(po.supplier)===name;});}
  function supplierDocs(name){var ids=new Set(supplierPos(name).map(function(po){return po.id;}));return allDocuments().filter(function(d){return d.kind==='ACCPAY'&&ids.has(d.source_id);});}
  function operationalComplete(order){
    if(!order)return false;
    if(arr(order.tags).includes('Invoice Ready'))return true;
    var s=text(order.status).toLowerCase();if(['shipped','completed','complete','fulfilled','invoiced'].includes(s))return true;
    return arr(store().goodsNotes).some(function(n){return (n.salesOrderId===order.id||n.orderId===order.id)&&!!n.shipped;});
  }
  function invoiceReady(order){
    if(!order||documentForSource(order.id,'ACCREC'))return false;
    var job=arr(store().jobs).find(function(j){return j.id===order.jobId;});
    if(job&&job.project&&job.project.billingMode==='phases')return false;
    return operationalComplete(order);
  }
  function financeCommand(){var d=store();if(!d.financeCommand||typeof d.financeCommand!=='object')d.financeCommand={};var fc=d.financeCommand;fc.customerPolicies=fc.customerPolicies||{};fc.unallocatedPayments=arr(fc.unallocatedPayments);fc.customerCredits=arr(fc.customerCredits);fc.supplierCredits=arr(fc.supplierCredits);fc.chases=arr(fc.chases);fc.allocations=arr(fc.allocations);fc.paymentRuns=arr(fc.paymentRuns);fc.acknowledgedExceptions=arr(fc.acknowledgedExceptions);return fc;}
  function customerPolicy(id){var d=store(),c=arr(d.customers).find(function(x){return x.id===id;})||{},p=financeCommand().customerPolicies[id]||{};return {creditLimit:num(p.creditLimit!=null?p.creditLimit:c.creditLimit),watchPct:num(p.watchPct||70),warningPct:num(p.warningPct||85),holdPct:num(p.holdPct||100),hold:!!p.hold,holdReason:text(p.holdReason)};}
  function creditSeverity(pct,p){if(!p.creditLimit)return 'neutral';if(pct>=p.holdPct)return 'critical';if(pct>=p.warningPct)return 'warning';if(pct>=p.watchPct)return 'watch';return 'good';}
  function customerAccount(id,opts){
    var t=today(opts),docs=customerDocs(id),orders=customerOrders(id),fc=financeCommand(),p=customerPolicy(id);
    var outstanding=round(docs.reduce(function(s,d){return s+dueOutstanding(d);},0));
    var overdue=round(docs.reduce(function(s,d){var due=docDueDate(d);return s+(due&&due<t?dueOutstanding(d):0);},0));
    var dueThisWeek=round(docs.reduce(function(s,d){var due=docDueDate(d),dd=due?days(t,due):999;return s+(dd>=0&&dd<=7?dueOutstanding(d):0);},0));
    var openOrderExposure=round(orders.reduce(function(s,o){var st=text(o.status).toLowerCase();if(['cancelled','canceled','closed'].includes(st))return s;if(documentForSource(o.id,'ACCREC'))return s;return s+orderValue(o);},0));
    var unallocatedPayments=round(fc.unallocatedPayments.filter(function(x){return x.customerId===id;}).reduce(function(s,x){return s+Math.max(0,num(x.remaining!=null?x.remaining:x.amount));},0));
    var unallocatedCredits=round(fc.customerCredits.filter(function(x){return x.customerId===id;}).reduce(function(s,x){return s+Math.max(0,num(x.remaining!=null?x.remaining:x.amount));},0));
    var projected=round(outstanding+openOrderExposure),pct=p.creditLimit?Math.round(projected/p.creditLimit*100):0;
    var chases=fc.chases.filter(function(x){return x.customerId===id;}).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    return {customerId:id,outstanding:outstanding,overdue:overdue,dueThisWeek:dueThisWeek,unallocatedPayments:unallocatedPayments,unallocatedCredits:unallocatedCredits,openOrderExposure:openOrderExposure,projectedExposure:projected,creditLimit:p.creditLimit,availableCredit:Math.max(0,round(p.creditLimit-outstanding)),projectedHeadroom:round(p.creditLimit-projected),creditPct:pct,creditSeverity:creditSeverity(pct,p),creditHold:p.hold,lastChase:chases[0]||null};
  }
  function salesOrderFinanceStatus(orderId,opts){
    var o=arr(store().salesOrders).find(function(x){return x.id===orderId;});if(!o)return {state:'Unknown',orderId:orderId};
    var d=documentForSource(orderId,'ACCREC'),t=today(opts);if(!d)return {state:invoiceReady(o)?'Invoice Ready':'Not Invoiced',orderId:orderId,order:o};
    var due=dueOutstanding(d),paid=num(d.amount_paid),credited=num(d.amount_credited),dueDate=docDueDate(d);var state='Awaiting Payment';
    if(due<=0&&paid>0)state='Paid';else if(due<=0&&credited>0)state='Credit Balance';else if(dueDate&&dueDate<t&&due>0)state='Overdue';else if(paid>0||credited>0)state='Part Paid';
    return {state:state,orderId:orderId,document:d,amountDue:due,amountPaid:paid,amountCredited:credited,dueDate:dueDate};
  }
  function invoiceRows(id,opts){
    var t=today(opts);return customerDocs(id).map(function(d){var due=dueOutstanding(d),dueDate=docDueDate(d);return {documentId:d.id,sourceId:d.source_id,xeroId:d.xero_id||'',number:d.xero_number||d.remote?.InvoiceNumber||'Awaiting Xero number',total:docTotal(d),paid:num(d.amount_paid),credited:num(d.amount_credited),outstanding:due,dueDate:dueDate,overdue:!!(due&&dueDate&&dueDate<t),status:d.status||''};}).sort(function(a,b){return String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'));});
  }
  function suggestAllocation(id,opts){
    var fc=financeCommand(),sources=[];
    fc.unallocatedPayments.filter(function(x){return x.customerId===id&&num(x.remaining!=null?x.remaining:x.amount)>0;}).forEach(function(x){sources.push({sourceType:'payment',sourceId:x.id,available:round(x.remaining!=null?x.remaining:x.amount)});});
    fc.customerCredits.filter(function(x){return x.customerId===id&&num(x.remaining!=null?x.remaining:x.amount)>0;}).forEach(function(x){sources.push({sourceType:'credit',sourceId:x.id,available:round(x.remaining!=null?x.remaining:x.amount)});});
    var invoices=invoiceRows(id,opts).filter(function(x){return x.outstanding>0;}),alloc=[];
    sources.forEach(function(src){var left=src.available;for(var i=0;i<invoices.length&&left>0;i++){var already=alloc.filter(function(a){return a.documentId===invoices[i].documentId;}).reduce(function(s,a){return s+a.amount;},0),need=Math.max(0,invoices[i].outstanding-already),take=Math.min(left,need);if(take>0){alloc.push({sourceType:src.sourceType,sourceId:src.sourceId,documentId:invoices[i].documentId,invoiceNumber:invoices[i].number,amount:round(take)});left=round(left-take);}}});
    return {customerId:id,available:round(sources.reduce(function(s,x){return s+x.available;},0)),allocations:alloc,unallocatedAfter:round(sources.reduce(function(s,x){return s+x.available;},0)-alloc.reduce(function(s,x){return s+x.amount;},0))};
  }
  function receivedQty(po,line){var events=arr(store().receiptEvents).filter(function(e){return e.poId===po.id&&(!line.productId||e.productId===line.productId);});if(events.length)return events.reduce(function(s,e){return s+num(e.qty);},0);return num(line.received);}
  function threeWayRows(opts){
    return arr(store().purchaseOrders).map(function(po){var bill=documentForSource(po.id,'ACCPAY'),ordered=arr(po.lines).reduce(function(s,l){return s+num(l.qty);},0),received=arr(po.lines).reduce(function(s,l){return s+receivedQty(po,l);},0),missing=Math.max(0,round(ordered-received)),pv=poValue(po),bv=bill?docTotal(bill):num(po.supplierInvoiceTotal),variance=round(bv-pv),status='Awaiting Bill',reasons=[];
      if(bill){if(missing>0)reasons.push(missing+' unit'+(missing===1?'':'s')+' not received');if(Math.abs(variance)>0.01)reasons.push('bill differs from PO by '+Math.abs(variance).toFixed(2));status=reasons.length?'BLOCK PAYMENT':'Matched';}
      return {poId:po.id,supplier:text(po.supplier),orderedQty:ordered,receivedQty:received,missingQty:missing,poValue:pv,billValue:bv,valueVariance:variance,billId:bill&&bill.id,billNumber:bill&&(bill.xero_number||bill.remote?.InvoiceNumber)||po.supplierInvoiceRef||'',amountDue:bill?dueOutstanding(bill):0,dueDate:docDueDate(bill),status:status,reasons:reasons};
    });
  }
  function supplierAccount(name,opts){var t=today(opts),docs=supplierDocs(name),fc=financeCommand();var outstanding=round(docs.reduce(function(s,d){return s+dueOutstanding(d);},0)),overdue=round(docs.reduce(function(s,d){var due=docDueDate(d);return s+(due&&due<t?dueOutstanding(d):0);},0));var returnCredits=arr(store().purchaseReturns).filter(function(r){return text(r.supplier)===name&&/awaiting|expected|open/i.test(text(r.status));}).reduce(function(s,r){return s+num(r.expectedCredit||r.creditValue||r.amount);},0),manual=fc.supplierCredits.filter(function(c){return text(c.supplier)===name;}).reduce(function(s,c){return s+num(c.remaining!=null?c.remaining:c.amount);},0);return {supplier:name,outstanding:outstanding,overdue:overdue,availableCredits:round(returnCredits+manual),billCount:docs.filter(function(d){return dueOutstanding(d)>0;}).length};}
  function invoiceReadyRows(opts){return arr(store().salesOrders).filter(invoiceReady).map(function(o){var c=arr(store().customers).find(function(x){return x.id===customerId(o);})||{};return {orderId:o.id,customerId:customerId(o),customerName:c.name||o.customerName||customerId(o),value:orderValue(o),status:text(o.status),goodsNotes:arr(store().goodsNotes).filter(function(n){return n.salesOrderId===o.id||n.orderId===o.id;}).map(function(n){return n.id;})};});}
  function reconciliationRows(opts){
    var out=[],f=finance(),fc=financeCommand();
    arr(f.jobs).filter(function(j){return j.state==='review';}).forEach(function(j){var d=allDocuments().find(function(x){return x.id===j.document_id;});out.push({type:'sync-review',sourceId:d&&d.source_id||j.document_id,documentId:j.document_id,title:'Xero sync needs review',detail:j.last_error||'Linked finance record needs review'});});
    allDocuments().forEach(function(d){var local=0;if(d.kind==='ACCREC'){var o=arr(store().salesOrders).find(function(x){return x.id===d.source_id;});local=orderValue(o);}else{var p=arr(store().purchaseOrders).find(function(x){return x.id===d.source_id;});local=poValue(p);}var remote=docTotal(d);if(local&&remote&&Math.abs(local-remote)>0.01)out.push({type:'value-mismatch',sourceId:d.source_id,documentId:d.id,title:'Pool Shed and Xero totals differ',poolShed:local,xero:remote,difference:round(remote-local)});});
    fc.unallocatedPayments.filter(function(x){return num(x.remaining!=null?x.remaining:x.amount)>0;}).forEach(function(x){out.push({type:'customer-payment-allocation',sourceId:x.id,customerId:x.customerId,title:'Customer payment needs allocation',amount:num(x.remaining!=null?x.remaining:x.amount)});});
    fc.customerCredits.filter(function(x){return num(x.remaining!=null?x.remaining:x.amount)>0;}).forEach(function(x){out.push({type:'customer-credit-allocation',sourceId:x.id,customerId:x.customerId,title:'Customer credit needs allocation',amount:num(x.remaining!=null?x.remaining:x.amount)});});
    return out;
  }
  function monthEndRows(opts){var t=today(opts),customers=arr(store().customers),suppliers=arr(store().suppliers),tw=threeWayRows(opts),ready=invoiceReadyRows(opts),rec=reconciliationRows(opts),fc=financeCommand();var ar=round(customers.reduce(function(s,c){return s+customerAccount(c.id,opts).overdue;},0)),ap=round(suppliers.reduce(function(s,x){return s+supplierAccount(x.name||x.supplier,opts).overdue;},0));var cash=round(fc.unallocatedPayments.reduce(function(s,x){return s+num(x.remaining!=null?x.remaining:x.amount);},0)+fc.customerCredits.reduce(function(s,x){return s+num(x.remaining!=null?x.remaining:x.amount);},0));return [
    {code:'overdue-ar',title:'Overdue customer debt',count:customerDocsCountOverdue(t),amount:ar,clear:ar<=0},
    {code:'overdue-ap',title:'Overdue supplier bills',count:supplierDocsCountOverdue(t),amount:ap,clear:ap<=0},
    {code:'three-way',title:'Supplier bills blocked by match exceptions',count:tw.filter(function(r){return r.status==='BLOCK PAYMENT';}).length,clear:!tw.some(function(r){return r.status==='BLOCK PAYMENT';})},
    {code:'unallocated-cash',title:'Unallocated customer cash and credits',count:fc.unallocatedPayments.length+fc.customerCredits.length,amount:cash,clear:cash<=0},
    {code:'invoice-ready',title:'Orders ready to invoice',count:ready.length,clear:ready.length===0},
    {code:'sync-exceptions',title:'Xero and reconciliation exceptions',count:rec.length,clear:rec.length===0}
  ];}
  function customerDocsCountOverdue(t){return allDocuments().filter(function(d){return d.kind==='ACCREC'&&dueOutstanding(d)>0&&docDueDate(d)&&docDueDate(d)<t;}).length;}
  function supplierDocsCountOverdue(t){return allDocuments().filter(function(d){return d.kind==='ACCPAY'&&dueOutstanding(d)>0&&docDueDate(d)&&docDueDate(d)<t;}).length;}
  function snapshot(opts){var t=today(opts),customers=arr(store().customers),suppliers=arr(store().suppliers),ready=invoiceReadyRows(opts),rec=reconciliationRows(opts),tw=threeWayRows(opts);var customerAccounts=customers.map(function(c){return customerAccount(c.id,opts);}),supplierAccounts=suppliers.map(function(s){return supplierAccount(s.name||s.supplier,opts);});var metrics={customersOweUs:round(customerAccounts.reduce(function(s,x){return s+x.outstanding;},0)),customersOverdue:round(customerAccounts.reduce(function(s,x){return s+x.overdue;},0)),dueThisWeek:round(customerAccounts.reduce(function(s,x){return s+x.dueThisWeek;},0)),supplierBillsDue:round(supplierAccounts.reduce(function(s,x){return s+x.outstanding;},0)),supplierBillsOverdue:round(supplierAccounts.reduce(function(s,x){return s+x.overdue;},0)),unallocatedCredits:round(financeCommand().customerCredits.reduce(function(s,x){return s+num(x.remaining!=null?x.remaining:x.amount);},0)),invoiceReady:ready.length,xeroExceptions:rec.length};var attention=[];
    customerAccounts.filter(function(x){return x.overdue>0;}).forEach(function(x){attention.push({type:'customer-overdue',severity:'critical',customerId:x.customerId,title:'Customer payment overdue',amount:x.overdue,action:'Open customer'});});
    supplierAccounts.filter(function(x){return x.overdue>0;}).forEach(function(x){attention.push({type:'supplier-overdue',severity:'critical',supplier:x.supplier,title:'Supplier bill overdue',amount:x.overdue,action:'Open supplier bill'});});
    tw.filter(function(x){return x.status==='BLOCK PAYMENT';}).forEach(function(x){attention.push({type:'three-way',severity:'critical',poId:x.poId,title:'Supplier bill blocked',detail:x.reasons.join(', '),action:'Review match'});});
    ready.forEach(function(x){attention.push({type:'invoice-ready',severity:'warning',orderId:x.orderId,title:'Sales Order ready to invoice',amount:x.value,action:'Create invoice'});});
    rec.filter(function(x){return x.type==='sync-review'||x.type==='value-mismatch';}).forEach(function(x){attention.push({type:'reconciliation',severity:'warning',sourceId:x.sourceId,title:x.title,action:'Review reconciliation'});});
    return {today:t,metrics:metrics,attention:attention,connection:finance().connection||null,integration:finance().integration||{},monthEnd:monthEndRows(opts)};
  }
  global.PoolShedFinanceCommand={store:store,financeSnapshot:finance,financeCommand:financeCommand,orderValue:orderValue,poValue:poValue,documentForSource:documentForSource,customerAccount:customerAccount,customerInvoices:invoiceRows,salesOrderFinanceStatus:salesOrderFinanceStatus,suggestAllocation:suggestAllocation,threeWayRows:threeWayRows,supplierAccount:supplierAccount,invoiceReadyRows:invoiceReadyRows,reconciliationRows:reconciliationRows,monthEndRows:monthEndRows,snapshot:snapshot,customerPolicy:customerPolicy};
})(typeof globalThis!=='undefined'?globalThis:window);
