import { EventEmitter } from 'node:events';

const today = '2026-09-27';
const initial = {
  meta: { mode: 'sandbox', revision: 17, updatedAt: '2026-09-27T06:55:00+01:00', today },
  users: {
    aaron: { id:'aaron', name:'Aaron', role:'manager', permissions:['projects.read','finance.read','stock.read','purchasing.read','customers.read','knowledge.read','actions.prepare','actions.approve'] },
    charlotte: { id:'charlotte', name:'Charlotte', role:'operations', permissions:['projects.read','stock.read','purchasing.read','customers.read','knowledge.read','actions.prepare'] },
    dave: { id:'dave', name:'Dave', role:'engineer', permissions:['projects.read','stock.read','knowledge.read'] },
    warehouse: { id:'warehouse', name:'Warehouse', role:'warehouse', permissions:['stock.read','purchasing.read','knowledge.read','actions.prepare'] }
  },
  projects: {
    'PRJ-1042': { id:'PRJ-1042', name:'Williams Pool Refurb', customerId:'CUS-WILLIAMS', status:'Active', stage:'Construction', progress:68, dueDate:'2026-10-02', targetMarginPct:32, quotedNet:38500, committedCost:24980, actualCost:13110, forecastCost:27800, salesOrderIds:['SO-411'], poIds:['PO-219','PO-230'], hireIds:['HIRE-31'], extraIds:['EXT-77'], notes:['Pool shell complete','Plant room first fix underway'], owner:'Aaron' },
    'PRJ-1051': { id:'PRJ-1051', name:'Brown Liner Replacement', customerId:'CUS-BROWN', status:'Active', stage:'Prep', progress:42, dueDate:'2026-10-08', targetMarginPct:30, quotedNet:12400, committedCost:7100, actualCost:3920, forecastCost:8200, salesOrderIds:['SO-419'], poIds:['PO-231'], hireIds:[], extraIds:[], notes:['Pressure test complete','Liner measurement confirmed'], owner:'Charlotte' },
    'PRJ-1060': { id:'PRJ-1060', name:'Jones Natural Pool', customerId:'CUS-JONES', status:'Active', stage:'Groundworks', progress:54, dueDate:'2026-10-16', targetMarginPct:28, quotedNet:27400, committedCost:17100, actualCost:14690, forecastCost:21180, salesOrderIds:['SO-421'], poIds:['PO-244'], hireIds:['HIRE-44'], extraIds:['EXT-91'], notes:['Regeneration zone profile changed','Liner supplier chased'], owner:'Aaron' }
  },
  purchaseOrders: {
    'PO-219': { id:'PO-219', supplierId:'SUP-CERT', supplier:'Certikin', projectId:'PRJ-1042', status:'Part received', orderedDate:'2026-09-18', expectedDate:'2026-09-24', lines:[
      { sku:'PB-VLV-015', name:'1½ inch double union ball valve', qty:6, received:4, unitCost:18.50 },
      { sku:'PB-UNI-015', name:'1½ inch union', qty:12, received:12, unitCost:4.80 }
    ] },
    'PO-230': { id:'PO-230', supplierId:'SUP-CERT', supplier:'Certikin', projectId:'PRJ-1042', status:'Ordered', orderedDate:'2026-09-25', expectedDate:'2026-09-30', lines:[{ sku:'PB-PUMP-021', name:'Circulation pump', qty:1, received:0, unitCost:620 }] },
    'PO-231': { id:'PO-231', supplierId:'SUP-LIGHT', supplier:'Lighthouse Pools', projectId:'PRJ-1051', status:'Ordered', orderedDate:'2026-09-23', expectedDate:'2026-09-29', lines:[{ sku:'PB-LINER-04', name:'Bag liner', qty:1, received:0, unitCost:1760 }] },
    'PO-244': { id:'PO-244', supplierId:'SUP-CETCO', supplier:'CETCO', projectId:'PRJ-1060', status:'Ordered', orderedDate:'2026-09-20', expectedDate:null, lines:[{ sku:'PB-NAT-ROLL', name:'Natural Pool liner roll', qty:3, received:0, unitCost:940 }] }
  },
  products: {
    'PB-VLV-015': { sku:'PB-VLV-015', name:'1½ inch double union ball valve', supplierId:'SUP-CERT', supplierSku:'VLV-DU-015', bin:'B-14', onHand:7, allocated:4, onOrder:2, reorderLevel:3, unitCost:18.50 },
    'PB-UNI-015': { sku:'PB-UNI-015', name:'1½ inch union', supplierId:'SUP-CERT', supplierSku:'UNI-015', bin:'B-12', onHand:20, allocated:12, onOrder:0, reorderLevel:6, unitCost:4.80 },
    'PB-PUMP-021': { sku:'PB-PUMP-021', name:'Circulation pump', supplierId:'SUP-CERT', supplierSku:'PUMP-021', bin:'P-02', onHand:0, allocated:0, onOrder:1, reorderLevel:0, unitCost:620 },
    'PB-LINER-04': { sku:'PB-LINER-04', name:'Bag liner', supplierId:'SUP-LIGHT', supplierSku:'LINER-CUSTOM', bin:'Special order', onHand:0, allocated:0, onOrder:1, reorderLevel:0, unitCost:1760 },
    'PB-NAT-ROLL': { sku:'PB-NAT-ROLL', name:'Natural Pool liner roll', supplierId:'SUP-CETCO', supplierSku:'NAT-ROLL', bin:'Special order', onHand:0, allocated:0, onOrder:3, reorderLevel:0, unitCost:940 },
    'PB-PIPE-015': { sku:'PB-PIPE-015', name:'1½ inch PVC pressure pipe 3 m', supplierId:'SUP-CPC', supplierSku:'PVC15-3M', bin:'PIPE-01', onHand:9, allocated:6, onOrder:0, reorderLevel:8, unitCost:12.40, equivalenceKey:'pipe-pvc-pressure-1.5in-3m', category:'Pipework' },
    'PB-ELB-015': { sku:'PB-ELB-015', name:'1½ inch 90° pressure elbow', supplierId:'SUP-CERT', supplierSku:'ELB90-015', bin:'B-08', onHand:14, allocated:10, onOrder:0, reorderLevel:12, unitCost:2.65, equivalenceKey:'elbow-90-pressure-1.5in', category:'Pipework' },
    'PB-CHL-20': { sku:'PB-CHL-20', name:'Liquid Chlorine 14-15% 20 L', supplierId:'SUP-CPC', supplierSku:'LC-20', bin:'CHEM-02', onHand:8, allocated:3, onOrder:0, reorderLevel:10, unitCost:27.25, equivalenceKey:'liquid-chlorine-14.5-20l', category:'Chemicals', safetyDocIds:['SDS-CHL-01'] }
  },
  salesOrders: {
    'SO-411': { id:'SO-411', projectId:'PRJ-1042', status:'Part allocated', totalNet:4880, lines:[{sku:'PB-VLV-015',name:'1½ inch double union ball valve',qty:4,allocatedQty:4},{sku:'PB-UNI-015',name:'1½ inch union',qty:12,allocatedQty:12},{sku:'PB-PIPE-015',name:'1½ inch PVC pressure pipe 3 m',qty:8,allocatedQty:6}] },
    'SO-419': { id:'SO-419', projectId:'PRJ-1051', status:'Ready to pick', totalNet:2260, lines:[{sku:'PB-LINER-04',name:'Bag liner',qty:1,allocatedQty:0}] },
    'SO-421': { id:'SO-421', projectId:'PRJ-1060', status:'Waiting stock', totalNet:3140, lines:[{sku:'PB-NAT-ROLL',name:'Natural Pool liner roll',qty:3,allocatedQty:0}] }
  },
  hires: {
    'HIRE-31': { id:'HIRE-31', projectId:'PRJ-1042', description:'3-ton excavator', supplier:'Local Plant Hire', dailyRate:165, accruedDays:11, accruedCost:1815, purchaseEquivalent:4200, active:true },
    'HIRE-44': { id:'HIRE-44', projectId:'PRJ-1060', description:'3-ton excavator', supplier:'Local Plant Hire', dailyRate:155, accruedDays:16, accruedCost:2480, purchaseEquivalent:4200, active:true }
  },
  extras: {
    'EXT-77': { id:'EXT-77', projectId:'PRJ-1042', description:'Additional groundwork and two digger days', cost:1240, sellPrice:0, approved:false },
    'EXT-91': { id:'EXT-91', projectId:'PRJ-1060', description:'Regeneration zone profile alteration', cost:620, sellPrice:0, approved:false }
  },
  customers: {
    'CUS-WILLIAMS': { id:'CUS-WILLIAMS', name:'Williams Family', projectIds:['PRJ-1042'], waitingOnUs:['Confirm valve delivery position'], waitingOnCustomer:[] },
    'CUS-BROWN': { id:'CUS-BROWN', name:'Brown Family', projectIds:['PRJ-1051'], waitingOnUs:[], waitingOnCustomer:['Approve coping colour'] },
    'CUS-JONES': { id:'CUS-JONES', name:'Tom Jones', projectIds:['PRJ-1060'], waitingOnUs:['Confirm liner ETA'], waitingOnCustomer:[] }
  },
  suppliers: {
    'SUP-CERT': { id:'SUP-CERT', name:'Certikin', creditLimit:18000, outstandingBalance:9230, performance:{orders:18,onTime:15,late:3,shortDeliveries:1,damagedDeliveries:0,avgLeadTimeDays:3.1} },
    'SUP-LIGHT': { id:'SUP-LIGHT', name:'Lighthouse Pools', creditLimit:8000, outstandingBalance:2140, performance:{orders:9,onTime:7,late:2,shortDeliveries:1,damagedDeliveries:0,avgLeadTimeDays:4.0} },
    'SUP-CETCO': { id:'SUP-CETCO', name:'CETCO', creditLimit:6000, outstandingBalance:2820, performance:{orders:4,onTime:2,late:1,shortDeliveries:0,damagedDeliveries:0,avgLeadTimeDays:7.0} },
    'SUP-CPC': { id:'SUP-CPC', name:'CPC', creditLimit:10000, outstandingBalance:1640, performance:{orders:14,onTime:13,late:1,shortDeliveries:0,damagedDeliveries:1,avgLeadTimeDays:2.2} }
  },
  supplierBills: {
    'BILL-810': { id:'BILL-810', supplierId:'SUP-CERT', supplier:'Certikin', invoiceNumber:'C-88421', projectId:'PRJ-1042', amountNet:3420, vat:684, dueDate:'2026-09-29', status:'Unpaid', linkedPoIds:['PO-219','PO-230'], lines:[{sku:'PB-VLV-015',qty:6,unitCost:18.50},{sku:'PB-UNI-015',qty:12,unitCost:4.80},{sku:'PB-PUMP-021',qty:1,unitCost:620},{sku:'MISC-FREIGHT',qty:1,unitCost:2631.40}] },
    'BILL-811': { id:'BILL-811', supplierId:'SUP-LIGHT', supplier:'Lighthouse Pools', invoiceNumber:'LP-11780', projectId:'PRJ-1051', amountNet:1760, vat:352, dueDate:'2026-10-03', status:'Unpaid', linkedPoIds:['PO-231'], lines:[{sku:'PB-LINER-04',qty:1,unitCost:1760}] },
    'BILL-812': { id:'BILL-812', supplierId:'SUP-CETCO', supplier:'CETCO', invoiceNumber:'CT-5419', projectId:'PRJ-1060', amountNet:2820, vat:564, dueDate:'2026-09-30', status:'Unpaid', linkedPoIds:['PO-244'], lines:[{sku:'PB-NAT-ROLL',qty:3,unitCost:940}] },
    'BILL-813': { id:'BILL-813', supplierId:'SUP-CERT', supplier:'Certikin', invoiceNumber:'C-88421', projectId:'PRJ-1042', amountNet:3420, vat:684, dueDate:'2026-10-04', status:'Review', linkedPoIds:['PO-219'] }
  },
  customerInvoices: {
    'INV-501': { id:'INV-501', projectId:'PRJ-1042', customerId:'CUS-WILLIAMS', amountNet:6500, dueDate:'2026-10-01', status:'Sent', expectedPaymentDate:'2026-10-01' },
    'INV-509': { id:'INV-509', projectId:'PRJ-1051', customerId:'CUS-BROWN', amountNet:3100, dueDate:'2026-09-28', status:'Paid', expectedPaymentDate:'2026-09-27' },
    'INV-512': { id:'INV-512', projectId:'PRJ-1060', customerId:'CUS-JONES', amountNet:4200, dueDate:'2026-10-06', status:'Draft', expectedPaymentDate:null }
  },
  supplierOffers: {
    'OFFER-CHL-CERT': { id:'OFFER-CHL-CERT', productFamily:'liquid chlorine', productName:'Liquid Chlorine 14-15% Sodium Hypochlorite', searchText:'chlorine liquid chlorine sodium hypochlorite 14 15 percent 20 litre 20l', supplierId:'SUP-CERT', supplier:'Certikin', supplierSku:'CHL-20L', packLitres:20, concentrationPct:14.5, unitNet:28.50, carriageNet:20, freeCarriageThreshold:250, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-15', previousNet:27.10, previousDate:'2026-06-12', approved:true },
    'OFFER-CHL-CPC': { id:'OFFER-CHL-CPC', productFamily:'liquid chlorine', productName:'Liquid Chlorine 14-15% Sodium Hypochlorite', searchText:'chlorine liquid chlorine sodium hypochlorite 14 15 percent 20 litre 20l', supplierId:'SUP-CPC', supplier:'CPC', supplierSku:'LC-20', packLitres:20, concentrationPct:14.5, unitNet:27.25, carriageNet:18, freeCarriageThreshold:200, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-18', previousNet:26.40, previousDate:'2026-06-20', approved:true },
    'OFFER-CHL-LIGHT': { id:'OFFER-CHL-LIGHT', productFamily:'liquid chlorine', productName:'Liquid Chlorine 14-15% Sodium Hypochlorite', searchText:'chlorine liquid chlorine sodium hypochlorite 14 15 percent 20 litre 20l', supplierId:'SUP-LIGHT', supplier:'Lighthouse Pools', supplierSku:'CHEM-LC20', packLitres:20, concentrationPct:14.5, unitNet:29.10, carriageNet:22, freeCarriageThreshold:280, minQty:1, leadTimeDays:3, availability:'In stock', lastUpdated:'2026-08-30', previousNet:28.20, previousDate:'2026-06-01', approved:true, poolSku:'PB-CHL-20', equivalenceKey:'liquid-chlorine-14.5-20l', matchType:'exact' },
    'OFFER-PIPE-CERT': { id:'OFFER-PIPE-CERT', productFamily:'1.5 inch pressure pipe', productName:'PVC-U Pressure Pipe 1½ inch · 3 m', searchText:'1.5 1½ inch imperial pvc u pressure pipe 3m pipework', supplierId:'SUP-CERT', supplier:'Certikin', supplierSku:'PIPE15-3M', unitNet:13.20, carriageNet:25, freeCarriageThreshold:300, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-20', approved:true, poolSku:'PB-PIPE-015', equivalenceKey:'pipe-pvc-pressure-1.5in-3m', matchType:'exact' },
    'OFFER-PIPE-CPC': { id:'OFFER-PIPE-CPC', productFamily:'1.5 inch pressure pipe', productName:'1½ inch PVC Pressure Pipe · 3 m', searchText:'1.5 1½ inch imperial pvc pressure pipe 3m pipework', supplierId:'SUP-CPC', supplier:'CPC', supplierSku:'PVC15-3M', unitNet:12.40, carriageNet:18, freeCarriageThreshold:200, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-23', approved:true, poolSku:'PB-PIPE-015', equivalenceKey:'pipe-pvc-pressure-1.5in-3m', matchType:'exact' },
    'OFFER-PIPE-LIGHT': { id:'OFFER-PIPE-LIGHT', productFamily:'1.5 inch pressure pipe', productName:'Imperial Pressure Pipe 1½ inch · 3 m', searchText:'1.5 1½ inch imperial pvc u pressure pipe 3m pipework', supplierId:'SUP-LIGHT', supplier:'Lighthouse Pools', supplierSku:'PP-15-3', unitNet:12.95, carriageNet:22, freeCarriageThreshold:280, minQty:1, leadTimeDays:3, availability:'In stock', lastUpdated:'2026-09-10', approved:true, poolSku:'PB-PIPE-015', equivalenceKey:'pipe-pvc-pressure-1.5in-3m', matchType:'approved_equivalent' },
    'OFFER-ELB-CERT': { id:'OFFER-ELB-CERT', productFamily:'1.5 inch 90 elbow', productName:'1½ inch 90° Pressure Elbow', searchText:'1.5 1½ inch pvc pressure elbow 90 pipework fitting', supplierId:'SUP-CERT', supplier:'Certikin', supplierSku:'ELB90-015', unitNet:2.65, carriageNet:25, freeCarriageThreshold:300, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-20', approved:true, poolSku:'PB-ELB-015', equivalenceKey:'elbow-90-pressure-1.5in', matchType:'exact' },
    'OFFER-ELB-CPC': { id:'OFFER-ELB-CPC', productFamily:'1.5 inch 90 elbow', productName:'1½ inch 90° Pressure Elbow', searchText:'1.5 1½ inch pvc pressure elbow 90 pipework fitting', supplierId:'SUP-CPC', supplier:'CPC', supplierSku:'90ELB15', unitNet:2.48, carriageNet:18, freeCarriageThreshold:200, minQty:1, leadTimeDays:2, availability:'In stock', lastUpdated:'2026-09-23', approved:true, poolSku:'PB-ELB-015', equivalenceKey:'elbow-90-pressure-1.5in', matchType:'approved_equivalent' }
  },
  goodsReceipts: {
    'GR-219-A': { id:'GR-219-A', poId:'PO-219', supplierId:'SUP-CERT', receivedAt:'2026-09-22T10:15:00+01:00', lines:[{sku:'PB-VLV-015',qty:4,unitCost:18.50,qc:'Accepted'},{sku:'PB-UNI-015',qty:12,unitCost:4.80,qc:'Accepted'}] }
  },
  safetyDocuments: {
    'SDS-CHL-01': { id:'SDS-CHL-01', sku:'PB-CHL-20', title:'Liquid Chlorine Safety Data Sheet', revisionDate:'2026-05-01', documentType:'SDS', status:'Current', controls:['Wear suitable eye and hand protection','Keep in ventilated chemical storage','Do not mix with acids'], notes:'Use the Pool Shed COSHH assessment for task-specific controls.' }
  },
  stockCounts: [
    { id:'COUNT-41', sku:'PB-VLV-015', countedAt:'2026-09-15T09:00:00+01:00', expected:7, actual:7 },
    { id:'COUNT-42', sku:'PB-PIPE-015', countedAt:'2026-08-20T09:00:00+01:00', expected:11, actual:10 }
  ],
  knowledge: [
    { id:'KB-01', title:'Booking rule', tags:['booking','parts','policy'], text:'Do not book installation work until required parts have arrived and been checked.' },
    { id:'KB-02', title:'Deposit rule', tags:['deposit','quote','booking'], text:'A 50% deposit secures the booking and quoted price unless a proposal states otherwise.' },
    { id:'KB-03', title:'Goods-in allocation', tags:['goods-in','stock','fifo'], text:'Goods-in should allocate to the oldest eligible sales orders first, with a manual override available to authorised users.' },
    { id:'KB-04', title:'Payment safety', tags:['bills','payments','finance'], text:'Azzy may analyse, group and prepare supplier bills for review, but must never execute a bank payment.' }
  ],
  events: [
    { id:'EVT-901', at:'2026-09-27T06:31:00+01:00', type:'goods_in', entityType:'po', entityId:'PO-219', projectId:'PRJ-1042', summary:'4 of 6 valves booked in against PO-219.' },
    { id:'EVT-902', at:'2026-09-27T06:42:00+01:00', type:'project_cost', entityType:'project', entityId:'PRJ-1042', projectId:'PRJ-1042', summary:'£330 hire cost added to Williams Pool Refurb.' },
    { id:'EVT-903', at:'2026-09-27T06:48:00+01:00', type:'customer_payment', entityType:'invoice', entityId:'INV-509', projectId:'PRJ-1051', summary:'Brown Family invoice INV-509 marked paid.' },
    { id:'EVT-904', at:'2026-09-27T06:52:00+01:00', type:'supplier_bill', entityType:'bill', entityId:'BILL-813', projectId:'PRJ-1042', summary:'Possible duplicate Certikin bill entered and placed in review.' },
    { id:'EVT-905', at:'2026-09-27T07:04:00+01:00', type:'sales_order', entityType:'sales_order', entityId:'SO-411', projectId:'PRJ-1042', summary:'SO-411 has 2 lengths of 1½ inch pressure pipe still unallocated.' }
  ]
};

class DemoStore extends EventEmitter {
  constructor(){ super(); this.data=structuredClone(initial); }
  snapshot(){ return this.data; }
  revision(){ return this.data.meta.revision; }
  touch(summary, evt={}){
    this.data.meta.revision += 1;
    this.data.meta.updatedAt = new Date().toISOString();
    const event={ id:`EVT-${900+this.data.meta.revision}`, at:new Date().toISOString(), summary, ...evt };
    this.data.events.push(event); this.emit('change',event); return event;
  }
  approveSandboxAction(action){
    return this.touch(`Sandbox approval recorded for ${action.type}. No live business record changed.`, {type:'sandbox_approval',entityType:'action',entityId:action.id,projectId:action.projectId||null});
  }
}

export const store = new DemoStore();
