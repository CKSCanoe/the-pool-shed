/* Shared read-only snapshot summary for dashboard advice. No customer contacts or files. */
(function(root){
 function summary(source,now=Date.now()) {
  const d=source||{},day=new Date(now).toISOString().slice(0,10),closed=new Set(['Cancelled','Canceled','Completed','Invoiced']);
  const orders=(d.salesOrders||[]).filter(o=>!closed.has(o.status));
  const last=new Map();(d.notifications||[]).forEach(n=>{const t=Date.parse(n.date);if(Number.isFinite(t))last.set(n.salesOrderId,Math.max(last.get(n.salesOrderId)||0,t));});
  let overdue=0,dormant=0,missing=0,shippedAwaitingInvoice=0;
  orders.forEach(o=>{if(o.due&&o.due<day)overdue++;if(!o.customerId||!o.due)missing++;const t=Math.max(Date.parse(o.updatedAt)||0,Date.parse(o.created)||0,last.get(o.id)||0);if(t&&t<now-30*86400000)dormant++;if(o.status==='Shipped')shippedAwaitingInvoice++;});
  const purchase=(d.purchaseOrders||[]).filter(p=>!['Cancelled','Canceled','Received'].includes(p.status));
  const project=(d.jobs||[]).filter(j=>j.project&&!closed.has(j.status));
  const margins=project.map(j=>root.PoolShedProjectEngine.summary(j,d));
  return {asOfDay:day,openOrders:orders.length,overdueOrderDates:overdue,ordersWithNoRecentDatedActivity:dormant,ordersMissingCustomerOrDueDate:missing,shippedOrdersToReviewForBilling:shippedAwaitingInvoice,latePurchaseDeliveries:purchase.filter(p=>p.due&&p.due<day).length,openProjects:project.length,projectsBelowTarget:margins.filter(s=>s.margin!==null&&s.margin<s.target).length,projectsForecastingLoss:margins.filter(s=>s.profit<0).length,readyUnqueuedBillingStages:project.reduce((n,j)=>n+(j.project.phases||[]).filter(p=>p.ready&&!p.invoiceRequested).length,0),limitations:['Snapshot counts; no live bank or invoice balances.','Purchase delivery dates are not supplier payment deadlines.','Dormancy is inferred from available dated records.','Ready billing stages still require agreement and completion checks.']};
 }
 root.PoolShedDashboardReview={summary};
})(globalThis);
