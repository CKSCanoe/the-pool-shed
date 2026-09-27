export function projectGraph(db,projectId){
  const p=db.projects[projectId]; if(!p) return null;
  return {
    project:p,
    customer:db.customers[p.customerId]||null,
    purchaseOrders:(p.poIds||[]).map(id=>db.purchaseOrders[id]).filter(Boolean),
    salesOrders:(p.salesOrderIds||[]).map(id=>db.salesOrders[id]).filter(Boolean),
    hires:(p.hireIds||[]).map(id=>db.hires[id]).filter(Boolean),
    extras:(p.extraIds||[]).map(id=>db.extras[id]).filter(Boolean),
    supplierBills:Object.values(db.supplierBills).filter(x=>x.projectId===projectId),
    customerInvoices:Object.values(db.customerInvoices).filter(x=>x.projectId===projectId),
    events:db.events.filter(x=>x.projectId===projectId)
  };
}
