import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const modulePath = 'public/warehouse-workspace.js';
const moduleSource = fs.existsSync(modulePath) ? fs.readFileSync(modulePath, 'utf8') : '';

function contextWith(data) {
  const movements = data.movements || (data.movements = []);
  const notifications = [];
  const c = {
    data,
    console,
    todayIso: () => '2026-09-15',
    currentUser: () => ({ name: 'Aaron' }),
    product: (id) => ({ id, sku: id }),
    salesOrder: (id) => data.salesOrders.find((o) => o.id === id),
    available: (row) => ['L-QUARANTINE','L-RECEIVING'].includes(row.locationId) ? 0 : Math.max(0, Number(row.qty || 0) - Number(row.allocated || 0)),
    addMovement: (type, productId, qty, from, to, ref, user, note) => movements.push({ type, productId, qty, from, to, ref, user, note }),
    addSalesOrderNotification: (order, trigger, subject, channel) => notifications.push({ orderId: order.id, trigger, subject, channel }),
    updateSalesOrderStatusAfterAllocation: (order) => {
      if (['Picking','Ready To Ship','Part Shipped','Shipped','Invoiced','Completed','Cancelled'].includes(order.status)) return false;
      const allAllocated = order.lines.length > 0 && order.lines.every((line) => Number(line.allocated || 0) >= Number(line.qty || 0));
      order.status = allAllocated ? 'Ready To Pick' : 'Part Stock';
      return true;
    },
    toast: () => {},
    render: () => {},
    saveAppData: () => {},
    escapeHtml: (value) => String(value ?? ''),
    money: (value) => `£${Number(value || 0).toFixed(2)}`,
    document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
  };
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(moduleSource, c, { filename: modulePath });
  return { c, movements, notifications };
}

{
  const data = {
    stock: [{ productId: 'P-1', locationId: 'A', qty: 5, allocated: 0 }],
    salesOrders: [
      { id: 'SO-1001', created: '2026-09-01', due: '2026-09-20', status: 'Part Stock', lines: [{ productId: 'P-1', qty: 3, allocated: 0 }] },
      { id: 'SO-1007', created: '2026-09-04', due: '2026-09-10', status: 'Part Stock', lines: [{ productId: 'P-1', qty: 2, allocated: 0 }] },
      { id: 'SO-1012', created: '2026-09-08', due: '2026-09-09', status: 'Part Stock', lines: [{ productId: 'P-1', qty: 4, allocated: 0 }] },
      { id: 'SO-OTHER-SKU', created: '2026-08-01', due: '2026-08-02', status: 'Part Stock', lines: [{ productId: 'P-2', qty: 99, allocated: 0 }] },
      { id: 'SO-CANCELLED', created: '2026-07-01', due: '2026-07-02', status: 'Cancelled', lines: [{ productId: 'P-1', qty: 99, allocated: 0 }] },
    ],
    movements: [],
    allocationEvents: [],
  };
  const po = { id: 'PO-2055', supplier: 'Certikin' };
  const line = { productId: 'P-1', salesOrderId: 'SO-1012', salesOrderAllocations: [] };
  const { c } = contextWith(data);
  assert.equal(typeof c.warehouseAllocateAcceptedStock, 'function', 'Warehouse FIFO allocation API must exist');
  const result = c.warehouseAllocateAcceptedStock(po, line, 5, 'A');
  assert.equal(result.allocated, 5);
  assert.equal(data.salesOrders[0].lines[0].allocated, 3, 'oldest order receives stock first');
  assert.equal(data.salesOrders[1].lines[0].allocated, 2, 'next-oldest order receives the remainder');
  assert.equal(data.salesOrders[2].lines[0].allocated, 0, 'PO origin order does not jump older shortages');
  assert.equal(data.salesOrders[3].lines[0].allocated, 0, 'different SKU never receives allocation');
  assert.equal(data.salesOrders[4].lines[0].allocated, 0, 'cancelled order never receives allocation');
  assert.equal(data.stock[0].allocated, 5);
  assert.deepEqual(Array.from(line.salesOrderAllocations, (a) => a.salesOrderId), ['SO-1001','SO-1007']);
  assert(line.salesOrderAllocations.every((a) => a.method === 'FIFO'));
  assert(line.salesOrderAllocations.every((a) => a.demandSourceSalesOrderId === 'SO-1012'));
  assert.equal(data.allocationEvents.length, 2);
  console.log('PASS FIFO ignores PO-origin priority and allocates exact SKU oldest-first');
}

{
  const data = {
    stock: [{ productId: 'P', locationId: 'A', qty: 4, allocated: 0 }],
    salesOrders: [
      { id: 'SO-3', created: '2026-09-01', due: '2026-09-12', status: 'Part Stock', lines: [{ productId: 'P', qty: 1, allocated: 0 }] },
      { id: 'SO-2', created: '2026-09-01', due: '2026-09-10', status: 'Part Stock', lines: [{ productId: 'P', qty: 1, allocated: 0 }] },
      { id: 'SO-1', created: '2026-09-01', due: '2026-09-10', status: 'Part Stock', lines: [{ productId: 'P', qty: 1, allocated: 0 }] },
    ],
    movements: [], allocationEvents: [],
  };
  const { c } = contextWith(data);
  const po = { id: 'PO-TIE' };
  const line = { productId: 'P', salesOrderAllocations: [] };
  const result = c.warehouseAllocateAcceptedStock(po, line, 2, 'A');
  assert.equal(result.allocated, 2);
  assert.deepEqual(Array.from(line.salesOrderAllocations, (a) => a.salesOrderId), ['SO-1','SO-2'], 'ties use earliest due then lowest SO id');
  assert.equal(data.stock[0].allocated, 2);
  assert.equal(data.stock[0].qty - data.stock[0].allocated, 2, 'unused accepted stock remains available');
  console.log('PASS FIFO tie-break is due-date then Sales Order ID and leaves surplus free');
}

{
  for (const blockedLocation of ['L-RECEIVING','L-QUARANTINE']) {
    const data = {
      stock: [{ productId: 'P', locationId: blockedLocation, qty: 3, allocated: 0 }],
      salesOrders: [{ id: 'SO', created: '2026-09-01', due: '2026-09-02', status: 'Part Stock', lines: [{ productId: 'P', qty: 3, allocated: 0 }] }],
      movements: [], allocationEvents: [],
    };
    const { c } = contextWith(data);
    const result = c.warehouseAllocateAcceptedStock({ id: 'PO' }, { productId: 'P', salesOrderAllocations: [] }, 3, blockedLocation);
    assert.equal(result.allocated, 0);
    assert.equal(data.salesOrders[0].lines[0].allocated, 0);
  }
  console.log('PASS Receiving and Quarantine never hard-allocate');
}

{
  const data = {
    stock: [{ productId: 'P', locationId: 'A', qty: 1, allocated: 1 }],
    salesOrders: [
      { id: 'SO-OLD', created: '2026-09-01', due: '2026-09-20', status: 'Ready To Pick', lines: [{ productId: 'P', qty: 1, allocated: 1 }] },
      { id: 'SO-NEW', created: '2026-09-02', due: '2026-09-03', status: 'Part Stock', lines: [{ productId: 'P', qty: 1, allocated: 0 }] },
    ],
    movements: [], allocationEvents: [],
  };
  const { c, movements } = contextWith(data);
  assert.equal(typeof c.warehouseReallocateSalesStock, 'function', 'Controlled reallocation API must exist');
  assert.equal(c.warehouseReallocateSalesStock('P','SO-OLD','SO-NEW',1,'').ok, false, 'reason is required');
  const moved = c.warehouseReallocateSalesStock('P','SO-OLD','SO-NEW',1,'Complete SO-NEW while SO-OLD remains blocked by other inbound items');
  assert.equal(moved.ok, true);
  assert.equal(data.salesOrders[0].lines[0].allocated, 0);
  assert.equal(data.salesOrders[1].lines[0].allocated, 1);
  assert.equal(data.stock[0].allocated, 1, 'reallocation does not change physical allocated total');
  assert.equal(data.salesOrders[0].status, 'Part Stock');
  assert.equal(data.salesOrders[1].status, 'Ready To Pick');
  assert.equal(movements.at(-1).type, 'Allocation Reallocation');
  assert.match(movements.at(-1).note, /Complete SO-NEW/);
  assert.equal(c.warehouseReallocateSalesStock('P','SO-OLD','SO-NEW',1,'Again').ok, false, 'cannot move allocation the source no longer owns');
  console.log('PASS manual reallocation is reason-required, quantity-safe, status-aware and auditable');
}
