window.PoolShedWorkspace = (function () {
  const moneyNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const nameOf = (row) => row?.name || row?.companyName || row?.fullName || row?.id || "—";
  const fmtDay = (value) => {
    if (!value) return "—";
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return String(value).slice(0, 10);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(t));
  };

  function customerName(data, id) {
    const c = (data.customers || []).find((x) => x.id === id);
    return c ? nameOf(c) : id || "—";
  }

  function quoteValue(q) {
    const versions = q.versions || [];
    const published = versions.find((v) => Number(v.number) === Number(q.publishedVersion));
    const latest = published || versions[versions.length - 1];
    const totals = latest?.commercialSnapshot?.totals || q.conversion?.acceptedTotals || {};
    return moneyNum(totals.net || q.value || 0);
  }

  function quoteCost(q) {
    const versions = q.versions || [];
    const published = versions.find((v) => Number(v.number) === Number(q.publishedVersion));
    const latest = published || versions[versions.length - 1];
    const totals = latest?.commercialSnapshot?.totals || q.conversion?.acceptedTotals || {};
    return moneyNum(totals.cost || 0);
  }

  function quoteMargin(q) {
    const sell = quoteValue(q);
    const cost = quoteCost(q);
    if (!sell) return null;
    return Math.round((1 - cost / sell) * 1000) / 10;
  }

  function projectView(job, data) {
    const p = job.project || {};
    const extras = (p.variations || []).filter((v) => v.status === "Approved");
    const extraNet = extras.reduce((n, v) => n + moneyNum(v.sellNet), 0);
    const costs = (p.costs || []).filter((c) => !c.voidedAt).reduce((n, c) => n + moneyNum(c.actualNet || c.net || 0), 0);
    const remaining = moneyNum(p.remainingNet);
    return {
      id: job.id,
      name: job.name || job.title || job.id,
      customer: customerName(data, job.customerId),
      status: job.status || (p.quoteAccepted ? "Live" : "Planning"),
      contract: moneyNum(p.quoteNet),
      extras: extraNet,
      costs,
      committed: 0,
      remaining,
      target: Number(p.targetMargin || 30),
      raw: job
    };
  }

  function extraViews(data) {
    const rows = [];
    (data.jobs || []).forEach((job) => {
      ((job.project && job.project.variations) || []).forEach((v) => {
        rows.push({
          id: v.id,
          project: job.id,
          title: v.title || v.id,
          status: v.status === "Approved" ? "Accepted" : v.status === "Rejected" ? "Rejected" : "Awaiting approval",
          sell: moneyNum(v.sellNet),
          cost: moneyNum(v.costNet),
          raw: v,
          job
        });
      });
    });
    return rows;
  }

  function stockFor(data, productId) {
    const rows = (data.stock || []).filter((s) => s.productId === productId);
    const onHand = rows.reduce((n, r) => n + moneyNum(r.qty || r.quantity), 0);
    const allocated = (data.allocations || [])
      .filter((a) => a.productId === productId && !["Cancelled", "Canceled", "Released"].includes(a.status))
      .reduce((n, a) => n + moneyNum(a.qty), 0);
    return { onHand, allocated, free: Math.max(0, onHand - allocated) };
  }

  function fromSnapshot(snapshot, meta) {
    const data = snapshot || {};
    const customers = (data.customers || []).map((c) => ({
      id: c.id,
      name: nameOf(c),
      type: c.type || c.tag || c.group || "Customer",
      town: c.town || c.city || c.address?.city || "",
      email: c.email || "",
      phone: c.phone || "",
      spend: moneyNum(c.lifetimeValue || c.spend || 0),
      open: (data.salesOrders || []).filter((o) => o.customerId === c.id && !["Invoiced", "Cancelled", "Canceled"].includes(o.status)).length,
      raw: c
    }));

    const quotes = (data.quotes || []).map((q) => ({
      id: q.id,
      customer: customerName(data, q.customerId),
      kind: q.workflow === "quick" ? "Quick Quote" : "Project Proposal",
      status: q.status || "Draft",
      value: quoteValue(q),
      margin: quoteMargin(q),
      updated: fmtDay(q.updatedAt || q.createdAt),
      raw: q
    }));

    const orders = (data.salesOrders || []).map((o) => ({
      id: o.id,
      customer: customerName(data, o.customerId),
      status: o.status || "New Order",
      value: moneyNum(o.totalNet || o.value || o.goodsTotal),
      due: fmtDay(o.due || o.dueDate),
      stock: o.stockStatus || o.allocation || "Review",
      source: o.source || o.channel || "Manual",
      raw: o
    }));

    const projects = (data.jobs || []).filter((j) => j.project || j.type === "Project").map((j) => projectView(j, data));

    const products = (data.products || []).map((p) => {
      const stock = stockFor(data, p.id);
      return {
        sku: p.sku || p.id,
        name: p.name || p.title || p.sku,
        brand: p.brand || p.vendor || "",
        group: p.group || p.category || "",
        sell: moneyNum(p.price || p.sell || p.sellPrice),
        cost: moneyNum(p.cost || p.costPrice),
        onHand: stock.onHand,
        allocated: stock.allocated,
        free: stock.free,
        raw: p
      };
    });

    const locations = (data.locations || []).map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type || "Location",
      value: moneyNum(l.value),
      skus: (data.stock || []).filter((s) => s.locationId === l.id).length,
      raw: l
    }));

    const purchaseOrders = (data.purchaseOrders || []).map((p) => ({
      id: p.id,
      supplier: p.supplierName || p.supplier || p.vendor || "Supplier",
      status: p.status || "Draft",
      value: moneyNum(p.totalNet || p.value),
      due: fmtDay(p.due || p.expected),
      linked: p.salesOrderId || p.jobId || "—",
      raw: p
    }));

    const goodsNotes = (data.goodsNotes || []).map((g) => ({
      id: g.id,
      order: g.salesOrderId || g.orderId || "—",
      status: g.status || "Open",
      method: g.method || g.shippingMethod || "—",
      printed: !!g.printedAt || !!g.printed,
      picked: !!g.pickedAt || g.status === "Picked" || g.status === "Packed" || g.status === "Shipped",
      packed: !!g.packedAt || g.status === "Packed" || g.status === "Shipped",
      raw: g
    }));

    const notifications = (data.notifications || []).slice(0, 12).map((n, i) => ({
      id: n.id || "N" + i,
      title: n.title || n.message || "Notification",
      detail: n.detail || n.body || "",
      time: fmtDay(n.date || n.createdAt),
      tone: n.tone || "info",
      go: n.tab || "dashboard"
    }));

    const users = (meta?.users || []).map((u) => ({
      name: u.full_name || u.name || u.email,
      role: u.role || "Office",
      access: u.job_title || "Workspace"
    }));

    return {
      live: true,
      revision: meta?.revision || null,
      company: data.companySettings || { name: "Pool Bros" },
      user: meta?.user || { name: "Staff", email: "", role: "Office", initials: "PS" },
      notifications: notifications.length ? notifications : window.PS_DATA.notifications,
      work: deriveWork(orders, projects, extraViews(data)),
      customers,
      quotes,
      quoteLines: [],
      orders,
      orderLines: [],
      projects,
      extras: extraViews(data),
      products,
      locations,
      stockAlerts: products.filter((p) => p.free <= 0 || p.onHand <= 1).slice(0, 8).map((p) => ({
        sku: p.sku,
        name: p.name,
        reason: p.free <= 0 ? "Free stock is zero" : "Low remaining stock",
        tone: p.free <= 0 ? "bad" : "warn"
      })),
      purchaseOrders,
      suppliers: (data.suppliers || []).map((s) => ({
        name: nameOf(s),
        lead: s.leadTime || s.lead || "—",
        openPos: (data.purchaseOrders || []).filter((p) => p.supplierId === s.id && !["Received", "Cancelled"].includes(p.status)).length,
        onTime: s.onTime || "—"
      })),
      warehouseQueue: (data.warehouseTasks || data.movements || []).slice(0, 8).map((w, i) => ({
        id: w.id || "WH-" + i,
        type: w.type || "Movement",
        ref: w.ref || w.purchaseOrderId || w.salesOrderId || "—",
        status: w.status || "Open",
        detail: w.note || w.detail || ""
      })),
      goodsNotes,
      invoices: [],
      analytics: [],
      automations: window.PS_DATA.automations,
      users,
      source: data
    };
  }

  function deriveWork(orders, projects, extras) {
    const rows = [];
    extras.filter((e) => e.status !== "Accepted" && e.status !== "Rejected").forEach((e) => {
      rows.push({ id: e.id, type: "Approval", title: "Review extra " + e.id + " · " + e.title, owner: "Projects", due: "Today", status: "Needs you" });
    });
    orders.filter((o) => /pick|ready to pick/i.test(o.status)).forEach((o) => {
      rows.push({ id: o.id, type: "Pick", title: "Pick " + o.id, owner: "Warehouse", due: o.due, status: o.status });
    });
    projects.filter((p) => p.remaining > 0 && p.status === "Live").slice(0, 2).forEach((p) => {
      rows.push({ id: p.id, type: "Forecast", title: "Review remaining cost on " + p.id, owner: "Projects", due: "This week", status: "Open" });
    });
    return rows.slice(0, 8);
  }

  function quoteLinesFrom(raw) {
    const section = (raw.sections || [])[0] || {};
    return (section.options || section.lines || []).map((l) => ({
      sku: l.sku || l.productId || "",
      name: l.name || l.title || l.label || "Line",
      qty: moneyNum(l.qty || l.quantity || 1),
      sell: moneyNum(l.sell || l.price || l.unitSell),
      cost: moneyNum(l.cost || l.unitCost)
    }));
  }

  function orderLinesFrom(raw) {
    return (raw.lines || raw.items || []).map((l) => ({
      sku: l.sku || l.productId || "",
      name: l.name || l.title || "Line",
      qty: moneyNum(l.qty || l.quantity || 1),
      allocated: moneyNum(l.allocated || l.qtyAllocated || 0),
      location: l.location || l.locationId || "—"
    }));
  }

  return { fromSnapshot, quoteLinesFrom, orderLinesFrom, quoteValue };
})();
