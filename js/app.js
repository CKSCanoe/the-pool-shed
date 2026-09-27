(() => {
  let D = window.PS_DATA;
  const API = window.PoolShedAPI;
  const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const $ = (id) => document.getElementById(id);
  const toast = (msg) => {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  };

  const NAV = [
    { group: "Today" },
    { id: "dashboard", label: "Dashboard" },
    { id: "mywork", label: "My Work" },
    { group: "Commercial" },
    { id: "crm", label: "CRM" },
    { id: "quotes", label: "Quotes" },
    { id: "salesorders", label: "Sales Orders" },
    { id: "projects", label: "Projects" },
    { group: "Operations" },
    { id: "products", label: "Product Hub" },
    { id: "inventory", label: "Inventory" },
    { id: "purchasing", label: "Purchasing" },
    { id: "warehouse", label: "Warehouse" },
    { id: "fulfilment", label: "Fulfilment" },
    { group: "Control" },
    { id: "finance", label: "Finance" },
    { id: "analytics", label: "Analytics" },
    { id: "automation", label: "Automation" },
    { id: "settings", label: "Settings" }
  ];

  const META = {
    dashboard: ["Dashboard", "A live view of sales, stock, purchasing, fulfilment and anything that needs action today."],
    mywork: ["My Work", "Owned actions, approvals and operational exceptions that need attention."],
    crm: ["CRM", "Customers, contacts and the commercial history attached to each account."],
    quotes: ["Quotes · Quote Studio", "Build Quick Quotes or Project Proposals, publish a customer-safe link, then convert on acceptance."],
    salesorders: ["Sales Orders", "Website, trade and quote-converted orders with allocation and status flow."],
    projects: ["Projects", "Contract value, extras, hire, costs and projected margin on one job record."],
    products: ["Product Hub", "Catalogue, costs, sell prices, barcodes and replenishment."],
    inventory: ["Inventory", "Stock by location with value, allocation and restock alerts."],
    purchasing: ["Purchasing", "Purchase orders, supplier lead times and shortage demand from accepted work."],
    warehouse: ["Warehouse", "Goods-in, QC, putaway, counts and van stock."],
    fulfilment: ["Fulfilment", "Print, pick, pack and ship against allocated sales orders."],
    finance: ["Finance", "Invoices, stage billing, Xero drafts and stock valuation."],
    analytics: ["Analytics", "Margin, stock value, fulfilment and supplier performance."],
    automation: ["Automation", "Workflows, approvals and the Azzy assistant."],
    settings: ["Settings", "Users, roles, statuses, integrations and company defaults."]
  };

  const state = {
    page: "dashboard",
    view: "list",
    selected: null,
    quoteTab: "design",
    theme: localStorage.getItem("ps-theme") || "light",
    authed: sessionStorage.getItem("ps-auth") === "1",
    live: false,
    demoForced: sessionStorage.getItem("ps-demo") === "1",
    finance: null,
    quoteStaff: null
  };

  function setChip(label, cls) {
    const chip = $("liveChip");
    if (!chip) return;
    chip.className = "pill " + (cls || "neutral");
    chip.textContent = label;
  }

  function initials(name) {
    return String(name || "PS").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  async function hydrateLive() {
    const row = await API.loadWorkspace();
    const profile = await API.profile();
    const user = {
      name: profile?.full_name || profile?.email || API.session()?.user?.email || "Staff",
      email: profile?.email || API.session()?.user?.email || "",
      role: profile?.role || "Office",
      initials: initials(profile?.full_name || profile?.email || "PS")
    };
    if (row?.data) {
      D = window.PoolShedWorkspace.fromSnapshot(row.data, { user, revision: row.updated_at });
    } else {
      D = { ...window.PS_DATA, user, live: true, source: window.PS_DATA };
      toast("No shared snapshot yet. Showing a local working copy until the first save.");
    }
    state.live = true;
    try { state.finance = await API.finance.status(); } catch (err) { state.finance = { error: err.message }; }
    setChip("Live workspace", "ok");
    $("workspaceLabel").textContent = API.workspace();
    $("notifyBadge").textContent = D.notifications.length;
  }

  function pill(status) {
    const s = String(status).toLowerCase();
    let cls = "neutral";
    if (/accept|won|paid|ship|ready|on$|live|received|done/.test(s)) cls = "ok";
    else if (/part|sent|draft|await|qc|due|pick|pack|order/.test(s)) cls = "info";
    else if (/short|below|hold|block|review/.test(s)) cls = "warn";
    else if (/loss|overdue|fail|denied/.test(s)) cls = "bad";
    return `<span class="pill ${cls}">${status}</span>`;
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th${/value|amount|sell|cost|free|on hand/i.test(h) ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function screens() {
    return {
      dashboard() {
        return `
          <div class="metrics">
            <article class="card metric"><div class="label">Open sales orders</div><div class="value">${D.orders.filter((o)=>!/invoiced|cancel/i.test(o.status)).length}</div><div class="hint">${D.orders.filter((o)=>/pick|short/i.test(o.status+o.stock)).length} need warehouse attention</div></article>
            <article class="card metric"><div class="label">Live projects</div><div class="value">${D.projects.filter((p)=>/live|open|active/i.test(p.status)).length || D.projects.length}</div><div class="hint">${D.projects.filter((p)=>{const s=p.contract+p.extras;const c=p.costs+p.committed+p.remaining;return s&&((1-(c/s))*100)<p.target;}).length} below target</div></article>
            <article class="card metric"><div class="label">Catalogue SKUs</div><div class="value">${D.products.length}</div><div class="hint">${(D.stockAlerts||[]).length} replenishment alerts</div></article>
            <article class="card metric"><div class="label">Workspace</div><div class="value" style="font-size:18px">${state.live ? "Live API" : "Demo"}</div><div class="hint">${state.live ? (API.revision() || "snapshot loaded") : "Local sample records"}</div></article>
          </div>
          <div class="split">
            <section class="card">
              <div class="section-head"><h2>Needs action</h2><button class="btn-ghost" data-go="mywork">Open My Work</button></div>
              <div class="list">${D.work.map((w) => `
                <div class="list-row">
                  <div><strong>${w.title}</strong><div class="muted">${w.type} · ${w.owner}</div></div>
                  ${pill(w.status)}
                </div>`).join("")}</div>
            </section>
            <section class="card">
              <div class="section-head"><h2>Pipeline</h2></div>
              <div class="list">
                <div class="list-row"><span>Quotes awaiting decision</span><strong>${money(16100)}</strong></div>
                <div class="list-row"><span>Accepted, converting</span><strong>${money(28640)}</strong></div>
                <div class="list-row"><span>Open purchase demand</span><strong>${money(11040)}</strong></div>
                <div class="list-row"><span>Packed, not shipped</span><strong>1 note</strong></div>
              </div>
            </section>
          </div>
          <section class="card">
            <div class="section-head"><h2>Today in fulfilment</h2><button class="btn-secondary" data-go="fulfilment">Warehouse board</button></div>
            ${table(["Goods note", "Order", "Status", "Method"], D.goodsNotes.map((g) => `<tr data-go="fulfilment"><td class="mono">${g.id}</td><td>${g.order}</td><td>${pill(g.status)}</td><td>${g.method}</td></tr>`))}
          </section>`;
      },

      mywork() {
        return `
          <div class="metrics">
            <article class="card metric"><div class="label">Assigned to you</div><div class="value">2</div><div class="hint">1 approval · 1 billing queue</div></article>
            <article class="card metric"><div class="label">Blocked</div><div class="value">1</div><div class="hint">Shortage PO for SO-1051</div></article>
            <article class="card metric"><div class="label">Due today</div><div class="value">3</div><div class="hint">Includes warehouse pick</div></article>
            <article class="card metric"><div class="label">Team queue</div><div class="value">${D.work.length}</div><div class="hint">Across sales, warehouse and accounts</div></article>
          </div>
          <section class="card">
            ${table(["Type", "Action", "Owner", "Due", "Status"], D.work.map((w) => `<tr><td>${w.type}</td><td><strong>${w.title}</strong></td><td>${w.owner}</td><td>${w.due}</td><td>${pill(w.status)}</td></tr>`))}
            <div class="row-actions" style="margin-top:14px">
              <button class="btn-primary" data-action="approve-extra">Approve EX-12</button>
              <button class="btn-secondary" data-go="purchasing">Raise shortage PO</button>
            </div>
          </section>`;
      },

      crm() {
        if (state.selected && state.view === "record") {
          const c = D.customers.find((x) => x.id === state.selected);
          return `
            <div class="record-head">
              <div>
                <button class="btn-ghost" data-back>← Customers</button>
                <h2 style="margin-top:8px">${c.name}</h2>
                <p class="muted">${c.type} · ${c.town}</p>
              </div>
              <div class="row-actions">
                <button class="btn-secondary" data-go="quotes">New quote</button>
                <button class="btn-primary" data-go="salesorders">New sales order</button>
              </div>
            </div>
            <div class="metrics">
              <article class="card metric"><div class="label">Lifetime spend</div><div class="value">${money(c.spend)}</div></article>
              <article class="card metric"><div class="label">Open records</div><div class="value">${c.open}</div></article>
              <article class="card metric"><div class="label">Email</div><div class="value" style="font-size:16px">${c.email}</div></article>
              <article class="card metric"><div class="label">Phone</div><div class="value" style="font-size:16px">${c.phone}</div></article>
            </div>
            <section class="card">
              <h2>Connected work</h2>
              <div class="list" style="margin-top:10px">
                ${D.quotes.filter((q) => q.customer === c.name).map((q) => `<div class="list-row"><span>${q.id} · ${q.kind}</span>${pill(q.status)}</div>`).join("") || "<p class='muted'>No quotes yet.</p>"}
                ${D.orders.filter((q) => q.customer === c.name).map((q) => `<div class="list-row"><span>${q.id} · ${q.status}</span><strong>${money(q.value)}</strong></div>`).join("")}
              </div>
            </section>`;
        }
        return `
          <div class="filter-bar">
            <input id="crmSearch" placeholder="Filter customers">
            <select><option>All types</option><option>Domestic</option><option>Trade</option><option>Wholesale</option></select>
            <button class="btn-primary" data-action="new-customer">New customer</button>
          </div>
          ${table(["Customer", "Type", "Town", "Open", "Spend"], D.customers.map((c) => `<tr data-open="crm:${c.id}"><td><strong>${c.name}</strong><div class="muted">${c.email}</div></td><td>${c.type}</td><td>${c.town}</td><td>${c.open}</td><td class="num">${money(c.spend)}</td></tr>`))}`;
      },

      quotes() {
        if (state.view === "studio") {
          const q = D.quotes.find((x) => x.id === state.selected) || D.quotes[0];
          const lines = (q?.raw && window.PoolShedWorkspace.quoteLinesFrom(q.raw).length)
            ? window.PoolShedWorkspace.quoteLinesFrom(q.raw)
            : (D.quoteLines || []);
          const sell = lines.reduce((s, l) => s + l.sell * l.qty, 0);
          const cost = lines.reduce((s, l) => s + l.cost * l.qty, 0);
          const margin = Math.round((1 - cost / sell) * 1000) / 10;
          return `
            <div class="record-head">
              <div>
                <button class="btn-ghost" data-back>← Quote list</button>
                <h2 style="margin-top:8px">${q.id} · ${q.customer}</h2>
                <p class="muted">${q.kind} · staff canvas never shows supplier cost to the customer</p>
              </div>
              <div class="row-actions">
                <button class="btn-secondary" data-action="quote-staff">Staff activity</button>
                <button class="btn-secondary" data-action="preview">Customer preview</button>
                <button class="btn-primary" data-action="publish">Publish proposal</button>
              </div>
            </div>
            <div class="studio">
              <div class="studio-col">
                <h3>Library</h3>
                <p class="muted">Product Hub, media and sections</p>
                <div class="list" style="margin-top:12px">
                  ${D.products.slice(0, 4).map((p) => `<div class="list-row"><div><strong>${p.name}</strong><div class="muted">${p.sku}</div></div><button class="ghost-mini" data-action="toast:Added ${p.sku}">Add</button></div>`).join("")}
                </div>
              </div>
              <div class="studio-col">
                <div class="canvas">
                  <div class="proposal">
                    <div class="kicker" style="color:#147A89">Pool Bros proposal</div>
                    <h3>${q.customer}</h3>
                    <p class="hero-note">A complete heating, filtration and finishing specification, ready to accept.</p>
                    ${lines.map((l) => `<div class="line"><span>${l.qty} × ${l.name}</span><strong>${money(l.sell * l.qty)}</strong></div>`).join("")}
                    <div class="line"><span>Total excluding VAT</span><strong>${money(sell)}</strong></div>
                  </div>
                </div>
              </div>
              <div class="studio-col">
                <h3>Commercial</h3>
                <div class="list" style="margin-top:10px">
                  <div class="list-row"><span>Sell</span><strong>${money(sell)}</strong></div>
                  <div class="list-row"><span>Cost</span><strong>${money(cost)}</strong></div>
                  <div class="list-row"><span>Margin</span><strong>${margin}%</strong></div>
                  <div class="list-row"><span>Target</span><span>30%</span></div>
                  <div class="list-row"><span>Deposit</span><span>30% on acceptance</span></div>
                </div>
                <p class="muted" style="margin-top:12px">Accepted and Won terms stay locked. Later changes use extras on the project.</p>
              </div>
            </div>`;
        }
        return `
          <div class="filter-bar">
            <input placeholder="Search quotes">
            <select><option>All statuses</option><option>Draft</option><option>Sent</option><option>Accepted</option><option>Won</option></select>
            <button class="btn-secondary" data-action="new-quote:quick">Quick Quote</button>
            <button class="btn-primary" data-action="new-quote:project">Project Proposal</button>
          </div>
          ${table(["Quote", "Customer", "Type", "Status", "Value", "Margin"], D.quotes.map((q) => `<tr data-open="quotes:${q.id}"><td class="mono">${q.id}</td><td>${q.customer}</td><td>${q.kind}</td><td>${pill(q.status)}</td><td class="num">${money(q.value)}</td><td class="num">${q.margin}%</td></tr>`))}`;
      },

      salesorders() {
        if (state.view === "record") {
          const o = D.orders.find((x) => x.id === state.selected);
          if (o?.raw && window.PoolShedWorkspace) D.orderLines = window.PoolShedWorkspace.orderLinesFrom(o.raw);
          return `
            <div class="record-head">
              <div>
                <button class="btn-ghost" data-back>← Sales orders</button>
                <h2 style="margin-top:8px">${o.id}</h2>
                <p class="muted">${o.customer} · due ${o.due} · ${o.source}</p>
              </div>
              <div class="row-actions">
                ${pill(o.status)}
                <button class="btn-secondary" data-go="fulfilment">Create goods note</button>
                <button class="btn-primary" data-action="allocate">Allocate stock</button>
              </div>
            </div>
            <div class="grid-3">
              <article class="card kv"><span>Value ex VAT</span><strong>${money(o.value)}</strong></article>
              <article class="card kv"><span>Stock</span><strong>${o.stock}</strong></article>
              <article class="card kv"><span>Channel</span><strong>${o.source}</strong></article>
            </div>
            <section class="card">
              <h2>Lines</h2>
              <div style="margin-top:10px">
                ${table(["SKU", "Product", "Qty", "Allocated", "Location"], D.orderLines.map((l) => `<tr><td class="mono">${l.sku}</td><td>${l.name}</td><td>${l.qty}</td><td>${l.allocated}</td><td>${l.location}</td></tr>`))}
              </div>
            </section>`;
        }
        return `
          <div class="filter-bar">
            <input placeholder="Search orders">
            <select><option>Active</option><option>All</option><option>Shipped</option></select>
            <select><option>Any stock</option><option>Allocated</option><option>Short</option></select>
            <button class="btn-primary" data-action="toast:Manual order form opened">New order</button>
          </div>
          ${table(["Order", "Customer", "Status", "Stock", "Due", "Value"], D.orders.map((o) => `<tr data-open="salesorders:${o.id}"><td class="mono">${o.id}</td><td>${o.customer}</td><td>${pill(o.status)}</td><td>${o.stock}</td><td>${o.due}</td><td class="num">${money(o.value)}</td></tr>`))}`;
      },

      projects() {
        const forecast = (p) => {
          const sell = p.contract + p.extras;
          const cost = p.costs + p.committed + p.remaining;
          const profit = sell - cost;
          const margin = Math.round((profit / sell) * 1000) / 10;
          return { sell, cost, profit, margin };
        };
        if (state.view === "record") {
          const p = D.projects.find((x) => x.id === state.selected);
          const f = forecast(p);
          return `
            <div class="record-head">
              <div>
                <button class="btn-ghost" data-back>← Projects</button>
                <h2 style="margin-top:8px">${p.id} · ${p.name}</h2>
                <p class="muted">Accepted original quote is locked. Agreed changes use extras.</p>
              </div>
              ${pill(p.status)}
            </div>
            <div class="metrics">
              <article class="card metric"><div class="label">Original contract</div><div class="value">${money(p.contract)}</div></article>
              <article class="card metric"><div class="label">Approved extras</div><div class="value">${money(p.extras)}</div></article>
              <article class="card metric"><div class="label">Projected profit</div><div class="value">${money(f.profit)}</div></article>
              <article class="card metric"><div class="label">Projected margin</div><div class="value">${f.margin}%</div><div class="hint">Target ${p.target}%</div></article>
            </div>
            <div class="split">
              <section class="card">
                <h2>Cost stack</h2>
                <div class="list" style="margin-top:10px">
                  <div class="list-row"><span>Actual costs</span><strong>${money(p.costs)}</strong></div>
                  <div class="list-row"><span>Committed POs / hire</span><strong>${money(p.committed)}</strong></div>
                  <div class="list-row"><span>Remaining forecast</span><strong>${money(p.remaining)}</strong></div>
                  <div class="list-row"><span>Forecast final cost</span><strong>${money(f.cost)}</strong></div>
                </div>
                <div class="progress" style="margin-top:14px"><i style="width:${Math.min(100, (f.cost / f.sell) * 100)}%"></i></div>
              </section>
              <section class="card">
                <h2>Extras</h2>
                <div class="list" style="margin-top:10px">
                  ${D.extras.filter((e) => e.project === p.id).map((e) => `<div class="list-row"><div><strong>${e.id}</strong><div class="muted">${e.title}</div></div>${pill(e.status)}</div>`).join("") || "<p class='muted'>No extras on this job.</p>"}
                </div>
                <div class="row-actions" style="margin-top:12px">
                  <button class="btn-secondary" data-action="project-ai">Request AI review</button>
                  <button class="btn-secondary" data-action="extra-email">Email proposed extra</button>
                </div>
              </section>
            </div>`;
        }
        return `
          <div class="filter-bar">
            <input placeholder="Search projects">
            <button class="btn-primary" data-action="toast:Project create form opened">New project</button>
          </div>
          ${table(["Project", "Customer", "Status", "Selling value", "Forecast cost", "Margin"], D.projects.map((p) => {
            const f = forecast(p);
            return `<tr data-open="projects:${p.id}"><td class="mono">${p.id}<div class="muted">${p.name}</div></td><td>${p.customer}</td><td>${pill(p.status)}</td><td class="num">${money(f.sell)}</td><td class="num">${money(f.cost)}</td><td class="num">${f.margin}%</td></tr>`;
          }))}`;
      },

      products() {
        return `
          <div class="filter-bar">
            <input placeholder="Search SKU or name">
            <select><option>All brands</option>${[...new Set(D.products.map((p) => p.brand))].map((b) => `<option>${b}</option>`).join("")}</select>
            <button class="btn-primary" data-action="toast:Product profile opened">New product</button>
          </div>
          ${table(["SKU", "Product", "Brand", "Sell", "Cost", "On hand", "Free"], D.products.map((p) => `<tr><td class="mono">${p.sku}</td><td>${p.name}</td><td>${p.brand}</td><td class="num">${money(p.sell)}</td><td class="num">${money(p.cost)}</td><td class="num">${p.onHand}</td><td class="num">${p.free}</td></tr>`))}`;
      },

      inventory() {
        return `
          <div class="metrics">
            ${D.locations.slice(0, 4).map((l) => `<article class="card metric"><div class="label">${l.name}</div><div class="value">${money(l.value)}</div><div class="hint">${l.skus} SKUs · ${l.type}</div></article>`).join("")}
          </div>
          <div class="split">
            <section class="card">
              <div class="section-head"><h2>Locations</h2></div>
              ${table(["Location", "Type", "SKUs", "Value"], D.locations.map((l) => `<tr><td>${l.name}</td><td>${l.type}</td><td>${l.skus}</td><td class="num">${money(l.value)}</td></tr>`))}
            </section>
            <section class="card">
              <div class="section-head"><h2>Restock alerts</h2></div>
              <div class="list">${D.stockAlerts.map((a) => `<div class="list-row"><div><strong>${a.sku}</strong><div class="muted">${a.reason}</div></div>${pill(a.tone === "bad" ? "Zero free" : "Low")}</div>`).join("")}</div>
            </section>
          </div>`;
      },

      purchasing() {
        return `
          <div class="split">
            <section class="card">
              <div class="section-head"><h2>Purchase orders</h2><button class="btn-primary" data-action="toast:PO raised from shortage">New PO</button></div>
              ${table(["PO", "Supplier", "Status", "Due", "Linked", "Value"], D.purchaseOrders.map((p) => `<tr><td class="mono">${p.id}</td><td>${p.supplier}</td><td>${pill(p.status)}</td><td>${p.due}</td><td>${p.linked}</td><td class="num">${money(p.value)}</td></tr>`))}
            </section>
            <section class="card">
              <div class="section-head"><h2>Suppliers</h2></div>
              <div class="list">${D.suppliers.map((s) => `<div class="list-row"><div><strong>${s.name}</strong><div class="muted">Lead ${s.lead} · on time ${s.onTime}</div></div><span>${s.openPos} open</span></div>`).join("")}</div>
            </section>
          </div>`;
      },

      warehouse() {
        return `
          <section class="card">
            <div class="section-head"><h2>Warehouse board</h2><button class="btn-secondary" data-action="toast:Cycle count started">Start count</button></div>
            ${table(["Task", "Type", "Reference", "Status", "Detail"], D.warehouseQueue.map((w) => `<tr><td class="mono">${w.id}</td><td>${w.type}</td><td>${w.ref}</td><td>${pill(w.status)}</td><td>${w.detail}</td></tr>`))}
          </section>
          <section class="card">
            <h2>Receiving rules</h2>
            <p class="muted" style="margin-top:8px">Goods land in quarantine until QC. Putaway writes location, value and movement history before stock becomes available to allocate.</p>
          </section>`;
      },

      fulfilment() {
        return `
          <div class="filter-bar">
            <select><option>All notes</option><option>Ready to pick</option><option>Packed</option><option>Shipped</option></select>
            <button class="btn-primary" data-action="toast:Pick list sent to printer">Print pick list</button>
          </div>
          ${table(["Note", "Order", "Status", "Printed", "Picked", "Packed", "Method"], D.goodsNotes.map((g) => `<tr><td class="mono">${g.id}</td><td>${g.order}</td><td>${pill(g.status)}</td><td>${g.printed ? "Yes" : "No"}</td><td>${g.picked ? "Yes" : "No"}</td><td>${g.packed ? "Yes" : "No"}</td><td>${g.method}</td></tr>`))}
          <p class="muted">Print first, then pick, pack and ship. Inventory movements stay on the goods note.</p>`;
      },

      finance() {
        const f = state.finance || {};
        const docs = f.documents || D.invoices.map((i) => ({ id: i.id, xero_number: i.id, status: i.status, amount_due: i.amount, amount_paid: 0, source_id: i.customer }));
        const conn = f.connection;
        const xeroLabel = f.error ? "Unavailable" : conn?.tenant_name ? conn.tenant_name : conn ? "Connected" : state.live ? "Ready to connect" : "Demo";
        const due = docs.reduce((n, d) => n + Number(d.amount_due || 0), 0);
        const paid = docs.reduce((n, d) => n + Number(d.amount_paid || 0), 0);
        return `
          <div class="metrics">
            <article class="card metric"><div class="label">Xero</div><div class="value" style="font-size:20px">${xeroLabel}</div><div class="hint">${f.error || conn?.last_sync || "Drafts still approve in Xero"}</div></article>
            <article class="card metric"><div class="label">Amount due</div><div class="value">${money(due)}</div></article>
            <article class="card metric"><div class="label">Amount paid</div><div class="value">${money(paid)}</div></article>
            <article class="card metric"><div class="label">Open jobs</div><div class="value">${(f.jobs || []).length}</div></article>
          </div>
          <div class="row-actions">
            <button class="btn-secondary" data-action="finance-refresh">Refresh status</button>
            <button class="btn-secondary" data-action="finance-sync">Run sync</button>
            <button class="btn-primary" data-action="finance-connect">Connect Xero</button>
          </div>
          <section class="card">
            ${table(["Document", "Source", "Status", "Paid", "Due"], docs.map((i) => `<tr><td class="mono">${i.xero_number || i.id}</td><td>${i.source_id || i.customer || "—"}</td><td>${pill(i.status || "—")}</td><td class="num">${money(i.amount_paid || 0)}</td><td class="num">${money(i.amount_due || i.amount || 0)}</td></tr>`))}
          </section>`;
      },

      analytics() {
        const cards = (D.analytics && D.analytics.length) ? D.analytics : [
          { label: "Open orders", value: String(D.orders.length), hint: "From workspace snapshot" },
          { label: "Quotes", value: String(D.quotes.length), hint: "Including drafts" },
          { label: "Projects", value: String(D.projects.length), hint: "Jobs with a project record" },
          { label: "SKUs", value: String(D.products.length), hint: "Product Hub" }
        ];
        return `
          <div class="metrics">${cards.map((a) => `<article class="card metric"><div class="label">${a.label}</div><div class="value">${a.value}</div><div class="hint">${a.hint}</div></article>`).join("")}</div>
          <div class="split">
            <section class="card">
              <h2>Attention from the snapshot</h2>
              <div class="list" style="margin-top:10px">
                <div class="list-row"><span>Projects below target</span><strong>1</strong></div>
                <div class="list-row"><span>Orders missing due date</span><strong>0</strong></div>
                <div class="list-row"><span>Late purchase deliveries</span><strong>1</strong></div>
                <div class="list-row"><span>Shipped, not invoiced</span><strong>1</strong></div>
              </div>
            </section>
            <section class="card">
              <h2>How to read this</h2>
              <p class="muted" style="margin-top:8px">These are management estimates from the workspace snapshot. They are not a statutory profit and loss. Paid and due balances still come from the accounting connection when it is live.</p>
            </section>
          </div>`;
      },

      automation() {
        return `
          <section class="card">
            <div class="section-head"><h2>Workflows</h2><button class="btn-secondary" id="azzyToggle2">Ask Azzy</button></div>
            <div class="list">${D.automations.map((a) => `<div class="list-row"><div><strong>${a.name}</strong><div class="muted">${a.detail}</div></div>${pill(a.status)}</div>`).join("")}</div>
          </section>`;
      },

      settings() {
        return `
          <div class="split">
            <section class="card">
              <h2>Company</h2>
              <div class="composer" style="margin-top:12px">
                <label class="field"><span>Trading name</span><input value="${D.company?.name || ""}"></label>
                <label class="field"><span>VAT</span><input value="${D.company?.vat || ""}"></label>
                <label class="field"><span>Support email</span><input value="${D.company?.email || ""}"></label>
                <button class="btn-primary" data-action="toast:Company defaults saved">Save defaults</button>
              </div>
            </section>
            <section class="card">
              <h2>People</h2>
              <div class="list" style="margin-top:10px">${D.users.map((u) => `<div class="list-row"><div><strong>${u.name}</strong><div class="muted">${u.role}</div></div><span class="muted">${u.access}</span></div>`).join("")}</div>
            </section>
          </div>
          <section class="card">
            <h2>Integrations</h2>
            <div class="list" style="margin-top:10px">
              <div class="list-row"><div><strong>Supabase workspace</strong><div class="muted">${API.workspace()}</div></div>${pill(state.live ? "Connected" : "Demo")}</div>
              <div class="list-row"><div><strong>Xero</strong><div class="muted">/api/finance</div></div>${pill(state.finance?.connection?.tenant_name || (state.live ? "API ready" : "Offline"))}</div>
              <div class="list-row"><div><strong>Quote Studio</strong><div class="muted">/api/quote publish, send, accept, conversion</div></div>${pill(state.live ? "API ready" : "Offline")}</div>
              <div class="list-row"><div><strong>Azzy</strong><div class="muted">/api/azzy bootstrap and chat</div></div>${pill(state.live ? "API ready" : "Local replies")}</div>
            </div>
          </section>`;
      }
    };
  }

  function navCount(id) {
    if (id === "mywork") return D.work.length;
    if (id === "salesorders") return D.orders.filter((o) => !/invoiced|cancel/i.test(o.status)).length;
    if (id === "quotes") return D.quotes.filter((q) => !/won|declined|cancel/i.test(q.status)).length;
    return 0;
  }

  function renderNav() {
    $("nav").innerHTML = NAV.map((item) => {
      if (item.group) return `<div class="nav-group">${item.group}</div>`;
      const count = navCount(item.id);
      return `<button type="button" data-go="${item.id}" class="${state.page === item.id ? "active" : ""}">${item.label}${count ? `<span class="count">${count}</span>` : ""}</button>`;
    }).join("");
  }

  function renderPage() {
    const [title, intro] = META[state.page];
    $("pageTitle").textContent = title;
    $("pageIntro").textContent = intro;
    $("crumbCurrent").textContent = title.split("·")[0].trim();
    document.title = `${title} · The Pool Shed`;
    $("workspaceMain").innerHTML = screens()[state.page]();
    renderNav();
    bindDynamic();
  }

  function go(page) {
    state.page = page;
    state.view = "list";
    state.selected = null;
    renderPage();
  }

  function openRecord(page, id) {
    state.page = page;
    state.selected = id;
    state.view = page === "quotes" ? "studio" : "record";
    renderPage();
  }

  function bindDynamic() {
    document.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => go(el.dataset.go)));
    document.querySelectorAll("[data-back]").forEach((el) => el.addEventListener("click", () => go(state.page)));
    document.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => {
      const [page, id] = el.dataset.open.split(":");
      openRecord(page, id);
    }));
    document.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", () => handleAction(el.dataset.action)));
    const extra = $("azzyToggle2");
    if (extra) extra.addEventListener("click", () => $("azzyPanel").classList.remove("hidden"));
  }

  function handleAction(action) {
    if (action.startsWith("toast:")) return toast(action.slice(6));
    if (action === "approve-extra") {
      if (!D.extras[0]) return toast("No extra is waiting.");
      D.extras[0].status = "Accepted";
      if (D.projects[0]) D.projects[0].extras = D.extras[0].sell || D.projects[0].extras;
      toast(D.extras[0].id + " marked accepted locally. Live approval still requires the accepted quote conversion.");
      return renderPage();
    }
    if (action === "allocate") return toast("Available warehouse stock allocated. Shortages remain on PO.");
    if (action.startsWith("new-quote")) {
      state.page = "quotes";
      state.view = "studio";
      const match = D.quotes.find((q) => action.endsWith("quick") ? /quick/i.test(q.kind) : /project/i.test(q.kind)) || D.quotes[0];
      state.selected = match ? match.id : "";
      toast(action.endsWith("project") ? "Project Proposal studio opened" : "Quick Quote studio opened");
      return renderPage();
    }
    if (action === "publish") return publishQuote();
    if (action === "quote-staff") return loadQuoteStaff();
    if (action === "preview") return toast("Customer-safe preview uses /proposal?token= from the published link. Costs stay off that payload.");
    if (action === "finance-refresh") return refreshFinance();
    if (action === "finance-sync") return runFinance("sync");
    if (action === "finance-connect") return connectXero();
    if (action === "project-ai") return runProjectAI();
    if (action === "extra-email") return runExtraEmail();
    if (action === "retry-conversion") return retryConversion();
    if (action === "new-customer") {
      $("modalRoot").classList.remove("hidden");
      $("modalRoot").innerHTML = `
        <form class="modal composer" id="newCustomerForm">
          <h2>New customer</h2>
          <label class="field"><span>Account name</span><input name="name" required></label>
          <label class="field"><span>Type</span><select name="type"><option>Domestic</option><option>Trade</option><option>Wholesale</option></select></label>
          <label class="field"><span>Town</span><input name="town" required></label>
          <div class="row-actions">
            <button class="btn-secondary" type="button" id="modalCancel">Cancel</button>
            <button class="btn-primary" type="submit">Create customer</button>
          </div>
        </form>`;
      $("modalCancel").onclick = () => $("modalRoot").classList.add("hidden");
      $("newCustomerForm").onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        D.customers.unshift({
          id: "C" + (D.customers.length + 1),
          name: fd.get("name"),
          type: fd.get("type"),
          town: fd.get("town"),
          email: "new@example",
          phone: "—",
          spend: 0,
          open: 0
        });
        $("modalRoot").classList.add("hidden");
        toast("Customer created");
        renderPage();
      };
    }
  }

  function renderSearch(q) {
    const box = $("searchResults");
    if (!q) return box.classList.add("hidden");
    const hay = [
      ...D.orders.map((x) => ({ t: x.id, s: x.customer, go: "salesorders" })),
      ...D.quotes.map((x) => ({ t: x.id, s: x.customer, go: "quotes" })),
      ...D.products.map((x) => ({ t: x.sku, s: x.name, go: "products" })),
      ...D.customers.map((x) => ({ t: x.name, s: x.type, go: "crm" }))
    ].filter((x) => (x.t + x.s).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    box.classList.remove("hidden");
    box.innerHTML = hay.length
      ? hay.map((x) => `<button type="button" data-go="${x.go}"><strong>${x.t}</strong><small>${x.s}</small></button>`).join("")
      : `<div style="padding:12px" class="muted">No matching records</div>`;
    box.querySelectorAll("[data-go]").forEach((el) => el.onclick = () => { box.classList.add("hidden"); go(el.dataset.go); });
  }

  function renderNotices() {
    $("notifyList").innerHTML = D.notifications.map((n) => `
      <button class="card" data-go="${n.go}" style="width:100%;text-align:left">
        <strong>${n.title}</strong>
        <div class="muted">${n.detail}</div>
        <div class="muted">${n.time}</div>
      </button>`).join("");
    $("notifyList").querySelectorAll("[data-go]").forEach((el) => el.onclick = () => {
      $("notifyPanel").classList.add("hidden");
      go(el.dataset.go);
    });
  }

  async function publishQuote() {
    const q = D.quotes.find((x) => x.id === state.selected);
    if (!state.live) return toast("Publish needs the live /api/quote endpoint and a signed-in workspace.");
    if (!q?.raw) return toast("Open a workspace quote before publishing.");
    const raw = q.raw;
    const version = (raw.versions || []).slice().sort((a, b) => Number(b.number || 0) - Number(a.number || 0))[0];
    if (!version?.publicSnapshot || !version?.commercialSnapshot) {
      return toast("This quote has no published snapshot yet. Finish it in Quote Studio first.");
    }
    try {
      const result = await API.quote.publish({
        quoteId: raw.id,
        version,
        delivery: {
          expiryDays: 30,
          recipientName: q.customer,
          recipientEmail: (D.customers.find((c) => c.name === q.customer) || {}).email || "",
          permissions: "standard"
        }
      });
      toast("Published. Secure link ready.");
      $("azzyBody").insertAdjacentHTML("beforeend", `<div class="bubble">Live proposal: ${result.clientUrl || "link issued"}</div>`);
      $("azzyPanel").classList.remove("hidden");
    } catch (err) { toast(err.message); }
  }

  async function loadQuoteStaff() {
    const q = D.quotes.find((x) => x.id === state.selected);
    if (!state.live) return toast("Staff activity comes from /api/quote?action=staff after sign-in.");
    try {
      state.quoteStaff = await API.quote.staff(q?.id);
      const n = (state.quoteStaff.publications || []).length;
      toast(`${n} publication${n === 1 ? "" : "s"} loaded from Quote Studio.`);
    } catch (err) { toast(err.message); }
  }

  async function retryConversion() {
    const pub = (state.quoteStaff?.publications || []).find((p) => p.status === "accepted") || (state.quoteStaff?.publications || [])[0];
    if (!pub) return toast("Load staff activity first so the accepted publication is known.");
    try {
      await API.quote.processConversion(pub.id);
      toast("Operational handover retried.");
    } catch (err) { toast(err.message); }
  }

  async function refreshFinance() {
    if (!state.live) return toast("Finance status is served by /api/finance when signed in.");
    try {
      state.finance = await API.finance.status();
      toast("Finance status refreshed.");
      renderPage();
    } catch (err) { toast(err.message); }
  }

  async function runFinance(kind) {
    if (!state.live) return toast("Xero actions require the live finance API.");
    try {
      if (kind === "sync") await API.finance.sync();
      state.finance = await API.finance.status();
      toast("Finance sync requested.");
      renderPage();
    } catch (err) { toast(err.message); }
  }

  async function connectXero() {
    if (!state.live) return toast("Connect Xero from a signed-in live workspace.");
    try {
      const result = await API.finance.connect();
      if (result.url) location.href = result.url;
      else toast("Xero connection started.");
    } catch (err) { toast(err.message); }
  }

  async function runProjectAI() {
    if (!state.live) return toast("AI review calls /api/project-review against the saved snapshot.");
    try {
      const result = state.page === "projects" && state.selected
        ? await API.projects.review(state.selected)
        : await API.projects.dashboardReview();
      $("azzyPanel").classList.remove("hidden");
      $("azzyBody").insertAdjacentHTML("beforeend", `<div class="bubble">${result.review || "No review text."}<div class="muted">As of ${result.asOf || "now"}</div></div>`);
    } catch (err) { toast(err.message); }
  }

  async function runExtraEmail() {
    const extra = D.extras.find((e) => e.project === state.selected && e.status !== "Accepted");
    if (!state.live) return toast("Extra email uses /api/project-email after the extra is synced.");
    if (!extra) return toast("No proposed extra is sitting on this project.");
    try {
      const job = extra.job;
      const message = extra.raw;
      await API.projects.extraEmail({
        jobId: extra.project,
        extraId: extra.id,
        expected: message,
        recipient: (D.customers.find((c) => c.name === (job && (job.customer || job.name))) || {}).email
      });
      toast("Extra email request sent.");
    } catch (err) { toast(err.message); }
  }

  async function askAzzy(text) {
    const body = $("azzyBody");
    body.insertAdjacentHTML("beforeend", `<div class="bubble me">${text}</div>`);
    if (state.live) {
      try {
        const out = await API.azzy.chat(text, state.selected ? { type: state.page === "projects" ? "project" : state.page, id: state.selected } : null);
        const reply = out.reply || out.message || out.text || JSON.stringify(out).slice(0, 400);
        body.insertAdjacentHTML("beforeend", `<div class="bubble">${reply}</div>`);
        return;
      } catch (err) {
        body.insertAdjacentHTML("beforeend", `<div class="bubble">Azzy API: ${err.message}</div>`);
        return;
      }
    }
    const reply = /margin|project/i.test(text)
      ? "PR-19 is forecasting 24% against a 30% target. Remaining forecast cost is £1,800. An extra should not be treated as revenue until it is accepted."
      : "Offline demo reply. Sign in with Supabase to use /api/azzy against the live workspace.";
    body.insertAdjacentHTML("beforeend", `<div class="bubble">${reply}</div>`);
  }

  function showApp() {
    $("bootScreen").classList.add("hidden");
    $("loginScreen").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    $("userName").textContent = D.user.name;
    $("userAvatar").textContent = D.user.initials;
    if (!state.live) setChip("Offline demo", "neutral");
    renderPage();
    renderNotices();
    if (state.live) API.azzy.bootstrap().then((boot) => {
      $("azzyBody").insertAdjacentHTML("afterbegin", `<p class="azzy-note">Azzy preview · ${boot.workspaceId || API.workspace()} · writes disabled</p>`);
    }).catch((err) => {
      $("azzyBody").insertAdjacentHTML("afterbegin", `<p class="azzy-note">Azzy API not reachable: ${err.message}</p>`);
    });
  }

  function showLogin() {
    $("bootScreen").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
    $("appShell").classList.add("hidden");
    const live = API.configured();
    $("loginMode").textContent = live
      ? "Supabase is configured. Staff credentials are checked against the existing workspace."
      : "No supabaseUrl in js/config.js. Sign in opens the offline demo, or set config to use live APIs.";
    $("loginHelpNote").textContent = live ? "Connected to the existing Pool Shed APIs" : "Offline demo until config is set";
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme === "dark" ? "dark" : "light";
    $("themeToggle").textContent = state.theme === "dark" ? "☀" : "☾";
  }

  function bindChrome() {
    $("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("loginEmail").value.trim();
      const pass = $("loginPassword").value;
      if (!email.includes("@") || pass.length < 6) {
        $("loginMessage").textContent = "Use a work email and a password of at least 6 characters.";
        return;
      }
      $("loginMessage").textContent = "";
      if (API.configured() && !state.demoForced) {
        try {
          await API.signIn(email, pass);
          sessionStorage.setItem("ps-auth", "1");
          sessionStorage.removeItem("ps-demo");
          state.authed = true;
          await hydrateLive();
          toast("Signed in to the shared workspace");
          showApp();
          return;
        } catch (err) {
          $("loginMessage").textContent = err.message || "Sign-in failed.";
          return;
        }
      }
      sessionStorage.setItem("ps-auth", "1");
      sessionStorage.setItem("ps-demo", "1");
      state.authed = true;
      state.live = false;
      toast("Opened the offline demo workspace");
      showApp();
    });
    $("demoFill").onclick = () => {
      state.demoForced = true;
      sessionStorage.setItem("ps-demo", "1");
      $("loginEmail").value = window.PS_DATA.user.email;
      $("loginPassword").value = "poolbros";
      $("loginMode").textContent = "Offline demo selected. Submit to skip Supabase.";
    };
    $("togglePassword").onclick = () => {
      const input = $("loginPassword");
      input.type = input.type === "password" ? "text" : "password";
      $("togglePassword").textContent = input.type === "password" ? "Show" : "Hide";
    };
    $("themeToggle").onclick = () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("ps-theme", state.theme);
      applyTheme();
    };
    $("notifyBtn").onclick = () => $("notifyPanel").classList.toggle("hidden");
    $("notifyClose").onclick = () => $("notifyPanel").classList.add("hidden");
    $("azzyToggle").onclick = () => $("azzyPanel").classList.toggle("hidden");
    $("azzyClose").onclick = () => $("azzyPanel").classList.add("hidden");
    $("azzyForm").onsubmit = (e) => {
      e.preventDefault();
      const val = $("azzyInput").value.trim();
      if (!val) return;
      $("azzyInput").value = "";
      askAzzy(val);
    };
    $("userMenuBtn").onclick = () => $("userMenu").classList.toggle("hidden");
    $("signOutBtn").onclick = async () => {
      sessionStorage.removeItem("ps-auth");
      sessionStorage.removeItem("ps-demo");
      state.authed = false;
      state.live = false;
      state.demoForced = false;
      D = window.PS_DATA;
      $("userMenu").classList.add("hidden");
      try { await API.signOut(); } catch (_) {}
      showLogin();
    };
    $("userMenu").addEventListener("click", (e) => {
      if (e.target.dataset.go) {
        $("userMenu").classList.add("hidden");
        go(e.target.dataset.go);
      }
    });
    $("globalSearch").addEventListener("input", (e) => renderSearch(e.target.value));
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) $("searchResults").classList.add("hidden");
      if (!e.target.closest(".account")) $("userMenu").classList.add("hidden");
    });
    $("modalRoot").addEventListener("click", (e) => {
      if (e.target.id === "modalRoot") $("modalRoot").classList.add("hidden");
    });
  }

  window.__POOL_SHED_AUTH_TOKEN__ = () => API.token();
  window.__POOL_SHED_WORKSPACE_ID__ = () => API.workspace();
  window.__POOL_SHED_GET_DATA__ = () => D.source || D;

  applyTheme();
  bindChrome();
  (async () => {
    if (API.configured() && !state.demoForced) {
      try {
        const session = await API.restoreSession();
        if (session) {
          state.authed = true;
          await hydrateLive();
          showApp();
          return;
        }
      } catch (err) {
        console.warn("Session restore failed", err);
      }
    }
    setTimeout(() => {
      if (state.authed && state.demoForced) showApp();
      else showLogin();
    }, 400);
  })();
})();
