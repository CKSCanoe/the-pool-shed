window.PS_DATA = {
  company: {
    name: "Pool Bros",
    workspace: "The Pool Shed",
    vat: "GB 123 4567 89",
    phone: "0121 496 0800",
    email: "hello@poolbros.co.uk"
  },
  user: { name: "Aaron Boyer", email: "aaron@poolbros.co.uk", role: "Director", initials: "AB" },
  notifications: [
    { id: "N1", title: "SO-1048 is overdue for pick", detail: "Fairland heat pump kit waiting in Main Warehouse A1", time: "12m", tone: "warn", go: "fulfilment" },
    { id: "N2", title: "PO-772 part received", detail: "2 of 4 Maytronics Dolphin units arrived", time: "1h", tone: "info", go: "warehouse" },
    { id: "N3", title: "Quote Q-221 accepted", detail: "Hampton Pool House signed. Handover ready.", time: "3h", tone: "ok", go: "quotes" },
    { id: "N4", title: "Project PR-19 below target margin", detail: "Forecast 24% vs 30% target after hire extra", time: "yesterday", tone: "bad", go: "projects" }
  ],
  work: [
    { id: "W1", type: "Approval", title: "Approve extra EX-12 · coping upgrade", owner: "You", due: "Today", status: "Needs you" },
    { id: "W2", type: "Pick", title: "Pick SO-1048 Fairland kit", owner: "Warehouse", due: "Today", status: "Ready" },
    { id: "W3", type: "Billing", title: "Queue stage 2 invoice · PR-18", owner: "Accounts", due: "Tomorrow", status: "Ready" },
    { id: "W4", type: "Purchase", title: "Raise shortage PO for SO-1051", owner: "Buying", due: "Today", status: "Blocked" }
  ],
  customers: [
    { id: "C1", name: "Hampton Pool House", type: "Domestic", town: "Solihull", email: "james@hamptonpool.example", phone: "07700 900112", spend: 28640, open: 1 },
    { id: "C2", name: "AquaTrade Midlands", type: "Trade", town: "Birmingham", email: "orders@aquatrade.example", phone: "0121 496 0192", spend: 91420, open: 3 },
    { id: "C3", name: "Lakeside Leisure", type: "Wholesale", town: "Worcester", email: "ops@lakeside.example", phone: "01905 496221", spend: 54080, open: 2 },
    { id: "C4", name: "Priory Swim Club", type: "Domestic", town: "Sutton Coldfield", email: "club@prioryswim.example", phone: "0121 496 4410", spend: 12890, open: 1 }
  ],
  quotes: [
    { id: "Q-221", customer: "Hampton Pool House", kind: "Project Proposal", status: "Accepted", value: 28640, margin: 32, updated: "27 Sep" },
    { id: "Q-224", customer: "Priory Swim Club", kind: "Quick Quote", status: "Sent", value: 4860, margin: 29, updated: "26 Sep" },
    { id: "Q-225", customer: "AquaTrade Midlands", kind: "Quick Quote", status: "Draft", value: 11240, margin: 18, updated: "26 Sep" },
    { id: "Q-219", customer: "Lakeside Leisure", kind: "Project Proposal", status: "Won", value: 54080, margin: 31, updated: "12 Sep" }
  ],
  quoteLines: [
    { sku: "FA-HP-21", name: "Fairland InverX 21kW heat pump", qty: 1, sell: 2895, cost: 1980 },
    { sku: "CERT-KIT", name: "Certikin filtration package", qty: 1, sell: 1640, cost: 980 },
    { sku: "LAB-INST", name: "Installation and commissioning", qty: 1, sell: 4200, cost: 2100 },
    { sku: "STONE-COP", name: "Natural stone coping, 24 lm", qty: 24, sell: 86, cost: 41 }
  ],
  orders: [
    { id: "SO-1048", customer: "AquaTrade Midlands", status: "Ready To Pick", value: 4120, due: "27 Sep", stock: "Allocated", source: "Website" },
    { id: "SO-1049", customer: "Hampton Pool House", status: "Part Stock", value: 28640, due: "4 Oct", stock: "Short", source: "Quote" },
    { id: "SO-1050", customer: "Lakeside Leisure", status: "Ready To Ship", value: 1980, due: "28 Sep", stock: "Allocated", source: "Trade" },
    { id: "SO-1051", customer: "Priory Swim Club", status: "Ordered", value: 4860, due: "9 Oct", stock: "On PO", source: "Quote" },
    { id: "SO-1042", customer: "AquaTrade Midlands", status: "Shipped", value: 960, due: "22 Sep", stock: "Gone", source: "Website" }
  ],
  orderLines: [
    { sku: "FA-HP-21", name: "Fairland InverX 21kW", qty: 1, allocated: 1, location: "A1" },
    { sku: "BAY-CHLOR", name: "Bayrol Chloriliquide 20L", qty: 6, allocated: 6, location: "CHEM-02" },
    { sku: "MAY-S300", name: "Maytronics Dolphin S300", qty: 2, allocated: 0, location: "—" }
  ],
  projects: [
    { id: "PR-18", name: "Hampton Pool House", customer: "Hampton Pool House", status: "Live", contract: 28640, extras: 1840, costs: 18420, committed: 3120, remaining: 2100, target: 30 },
    { id: "PR-19", name: "Priory plant room", customer: "Priory Swim Club", status: "Live", contract: 12890, extras: 0, costs: 7920, committed: 2100, remaining: 1800, target: 30 },
    { id: "PR-16", name: "Lakeside refurb phase 1", customer: "Lakeside Leisure", status: "Handover", contract: 54080, extras: 4200, costs: 37110, committed: 0, remaining: 800, target: 30 }
  ],
  extras: [
    { id: "EX-12", project: "PR-18", title: "Coping upgrade to honed limestone", status: "Awaiting approval", sell: 1840, cost: 920 },
    { id: "EX-09", project: "PR-16", title: "Additional LED swim lane lights", status: "Accepted", sell: 4200, cost: 2460 }
  ],
  products: [
    { sku: "FA-HP-21", name: "Fairland InverX 21kW heat pump", brand: "Fairland", group: "Heating", sell: 2895, cost: 1980, onHand: 3, allocated: 1, free: 2 },
    { sku: "MAY-S300", name: "Maytronics Dolphin S300", brand: "Maytronics", group: "Cleaning", sell: 1140, cost: 780, onHand: 2, allocated: 2, free: 0 },
    { sku: "BAY-CHLOR", name: "Bayrol Chloriliquide 20L", brand: "Bayrol", group: "Chemicals", sell: 42, cost: 24, onHand: 48, allocated: 6, free: 42 },
    { sku: "CERT-PMP", name: "Certikin Econopump 1.0hp", brand: "Certikin", group: "Circulation", sell: 365, cost: 210, onHand: 7, allocated: 1, free: 6 },
    { sku: "BEH-UV", name: "Behncke AQA UV 75", brand: "Behncke", group: "Treatment", sell: 1890, cost: 1240, onHand: 1, allocated: 0, free: 1 }
  ],
  locations: [
    { id: "L-WH-MAIN", name: "Main Warehouse", type: "Warehouse", value: 186420, skus: 412 },
    { id: "L-WH-A1", name: "Aisle A1", type: "Bin", value: 41280, skus: 38 },
    { id: "L-CHEM", name: "Chemical cage", type: "Restricted", value: 9640, skus: 22 },
    { id: "L-VAN-02", name: "Van 02 · James", type: "Van", value: 2140, skus: 9 },
    { id: "L-QUAR", name: "Quarantine hold", type: "Quarantine", value: 780, skus: 2 }
  ],
  stockAlerts: [
    { sku: "MAY-S300", name: "Maytronics Dolphin S300", reason: "Free stock is zero", tone: "bad" },
    { sku: "FA-HP-21", name: "Fairland InverX 21kW", reason: "Below restock of 4", tone: "warn" },
    { sku: "BEH-UV", name: "Behncke AQA UV 75", reason: "Single unit remaining", tone: "warn" }
  ],
  purchaseOrders: [
    { id: "PO-772", supplier: "Maytronics UK", status: "Part Received", value: 3120, due: "27 Sep", linked: "SO-1051" },
    { id: "PO-775", supplier: "Fairland Europe", status: "Sent", value: 7920, due: "3 Oct", linked: "PR-18" },
    { id: "PO-769", supplier: "Bayrol UK", status: "Received", value: 860, due: "21 Sep", linked: "—" }
  ],
  suppliers: [
    { name: "Maytronics UK", lead: "5 days", openPos: 1, onTime: "94%" },
    { name: "Fairland Europe", lead: "12 days", openPos: 1, onTime: "88%" },
    { name: "Bayrol UK", lead: "3 days", openPos: 0, onTime: "99%" },
    { name: "Certikin", lead: "4 days", openPos: 0, onTime: "96%" }
  ],
  warehouseQueue: [
    { id: "GIN-441", type: "Goods in", ref: "PO-772", status: "QC", detail: "2 Dolphin S300 to putaway" },
    { id: "PUT-118", type: "Putaway", ref: "PO-769", status: "Done", detail: "Chemicals into CHEM-02" },
    { id: "CNT-031", type: "Count", ref: "Aisle A1", status: "Due", detail: "Weekly cycle count" }
  ],
  goodsNotes: [
    { id: "GN-908", order: "SO-1048", status: "Ready to pick", method: "Pallet", printed: true, picked: false, packed: false },
    { id: "GN-909", order: "SO-1050", status: "Packed", method: "Van", printed: true, picked: true, packed: true },
    { id: "GN-902", order: "SO-1042", status: "Shipped", method: "Carrier", printed: true, picked: true, packed: true }
  ],
  invoices: [
    { id: "INV-3312", customer: "AquaTrade Midlands", amount: 1152, status: "Paid", due: "20 Sep" },
    { id: "INV-3318", customer: "Lakeside Leisure", amount: 2376, status: "Awaiting payment", due: "4 Oct" },
    { id: "DRAFT-19", customer: "Hampton Pool House", amount: 8580, status: "Xero draft", due: "Stage 1" }
  ],
  analytics: [
    { label: "Month sales", value: "£128,400", hint: "+11% vs last month" },
    { label: "Gross margin", value: "29.4%", hint: "Target 30%" },
    { label: "Stock value", value: "£186,420", hint: "Main warehouse 78%" },
    { label: "On-time despatch", value: "93%", hint: "2 late this week" }
  ],
  automations: [
    { name: "Accepted quote → sales order", status: "On", detail: "Creates SO, allocates stock, flags shortages" },
    { name: "Project proposal → project + SO", status: "On", detail: "Locks accepted specification into the job" },
    { name: "Packed goods note → customer email", status: "On", detail: "Sends courier and tracking if configured" },
    { name: "Margin below 5% → director approval", status: "On", detail: "Blocks publish until Aaron approves" }
  ],
  users: [
    { name: "Aaron Boyer", role: "Director", access: "All modules" },
    { name: "Priya Shah", role: "Accounts", access: "Finance, projects, sales" },
    { name: "James Cole", role: "Warehouse", access: "Warehouse, fulfilment, inventory" },
    { name: "Ellie Ward", role: "Sales", access: "CRM, quotes, sales orders" }
  ]
};
