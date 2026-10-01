/* Pool Shed Purchase Order Supplier Command authority layer.
   Supplier Order Command with Sales Order layout parity.
   Legacy command labels retained for compatibility: Items & Costing, Demand Sources, Supplier Confirmation, Deliveries & Receipts, Costs & Invoice Match, Returns & Credits, Activity.
   Supplier-side mirror of Sales Order Command.
   Purchasing owns commercial intent; Warehouse owns physical stock truth.
   v2.0.0 */
(function () {
  let purchaseCommandTab = 'items';
  const legacyPurchaseOrderDetailPage = typeof purchaseOrderDetailPage === 'function' ? purchaseOrderDetailPage : null;
  const legacyPurchaseOrderListPage = typeof purchaseOrderListPage === 'function' ? purchaseOrderListPage : null;
  const legacyBindPurchase = typeof bindPurchase === 'function' ? bindPurchase : null;
  const legacyRenderPurchase = typeof renderPurchase === 'function' ? renderPurchase : null;
  const legacySidebarSubGroups = typeof sidebarSubGroups === 'function' ? sidebarSubGroups : null;
  const legacyDefaultSubPage = typeof defaultSubPage === 'function' ? defaultSubPage : null;
  const legacyOpenSidebarSubGroup = typeof openSidebarSubGroup === 'function' ? openSidebarSubGroup : null;

  function poEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value == null ? '' : value)) : String(value == null ? '' : value);
  }

  function poMoney(value) {
    return typeof money === 'function' ? money(Number(value || 0)) : '£' + Number(value || 0).toFixed(2);
  }

  function poFinancialsSafe(po) {
    if (typeof purchaseOrderFinancials === 'function') return purchaseOrderFinancials(po);
    const totals=(po.lines||[]).reduce(function(out,line){
      const p=poProduct(line.productId)||{};
      const qty=Number(line.qty||0),unit=Number(line.unitCost!=null?line.unitCost:p.cost||0),net=qty*unit;
      let vat=0;
      if(typeof vatAmount==='function') vat=Number(vatAmount(net,{taxCode:line.taxCode||p.taxCode||'20% VAT'})||0);
      else vat=/zero|0%|exempt/i.test(String(line.taxCode||p.taxCode||''))?0:net*.2;
      out.net+=net;out.vat+=vat;out.gross+=net+vat;return out;
    },{net:0,vat:0,gross:0});
    totals.paid=(po.payments||[]).reduce(function(n,payment){return n+Number(payment.amount||0);},0);
    totals.balance=totals.gross-totals.paid;
    Object.keys(totals).forEach(function(key){totals[key]=Math.round(Number(totals[key]||0)*100)/100;});
    return totals;
  }

  function poPaymentState(po) {
    if (typeof purchaseOrderPaymentStatus === 'function') return purchaseOrderPaymentStatus(po);
    const totals=poFinancialsSafe(po);
    if(totals.gross<=0&&totals.paid<=0)return 'Unvalued';
    if(totals.paid<=0)return 'Unpaid';
    if(totals.paid>totals.gross+.005)return 'Overpaid';
    if(totals.paid+.005<totals.gross)return 'Part Paid';
    return 'Paid';
  }

  function poProductThumb(p) {
    const image=p&&(p.image||p.imageUrl||p.thumbnail||p.photo);
    return image
      ? '<span class="po-line-thumb has-image" style="background-image:url(&quot;' + poEsc(image) + '&quot;)"></span>'
      : '<span class="po-line-thumb">PB</span>';
  }

  function poLineVat(line,p,net) {
    if(typeof vatAmount==='function') return Number(vatAmount(net,{taxCode:line.taxCode||p.taxCode||'20% VAT'})||0);
    const code=String(line.taxCode||p.taxCode||'20% VAT').toLowerCase();
    if(/zero|exempt|not rated/.test(code)||/^\s*0(?:\.0+)?\s*%/.test(code))return 0;
    const match=code.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? net*(Number(match[1])/100) : net*.2;
  }

  function poLineDeleteAssessment(po,line) {
    const received=Number(line&&line.received||0);
    const receiptLinked=(data.receiptEvents||[]).some(function(event){
      return String(event.poId||'')===String(po.id||'') && String(event.productId||'')===String(line.productId||'');
    });
    const accountingTouched=(po.payments||[]).length>0 || Number(po.supplierInvoiceTotal||0)>0 || !!po.supplierInvoiceRef;
    const supplierCommitted=!!(po.supplierEmailSentAt||po.supplierConfirmedAt||String(po.status||'').toLowerCase().includes('confirmed'));
    return {allowed:received===0&&!receiptLinked,received,receiptLinked,accountingTouched,supplierCommitted};
  }

  function removePurchaseOrderLine(poId,index) {
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return row.id===poId;});
    const line=po&&po.lines&&po.lines[Number(index)];
    if(!po||!line)return typeof toast==='function'?toast('Purchase Order line not found.'):undefined;
    const check=poLineDeleteAssessment(po,line),p=poLineProduct(line);
    if(!check.allowed){
      purchaseCommandTab='connections';
      if(typeof toast==='function')toast('This line has receiving history. Keep it on the PO and use Supplier Returns & Credits instead.');
      if(typeof render==='function')render();
      return;
    }
    const reason=String(prompt('Reason for removing ' + (p.sku||p.name||'this line') + ' from ' + po.id + ' (required)')||'').trim();
    if(!reason)return typeof toast==='function'?toast('A removal reason is required.'):undefined;
    let warning='Remove this unreceived line from ' + po.id + '? The correction will stay in the PO activity history.';
    if(check.supplierCommitted)warning+=' The supplier has already seen or confirmed this PO, so it will return to review.';
    if(check.accountingTouched)warning+=' This PO already has accounting activity; its paid/balance position will recalculate after the line is removed.';
    if(!confirm(warning))return;
    const removed=JSON.parse(JSON.stringify(line));
    po.lines.splice(Number(index),1);
    po.lineCorrections=Array.isArray(po.lineCorrections)?po.lineCorrections:[];
    const at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing';
    po.lineCorrections.push({id:'POLINE-'+Date.now(),type:'Line removed before receipt',at,user,reason,line:removed,sku:p.sku||line.productId,name:p.name||''});
    if(check.supplierCommitted){
      po.reviewStatus='Needs review';
      po.supplierEmailStatus='Changes pending';
      if(!['Cancelled','Received'].includes(po.status))po.status='Draft - Review';
    }
    data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
    data.auditLog.push({id:'AUD-'+Date.now(),date:at,user,action:'Purchase order line removed',product:po.id,previousValue:removed,newValue:'Removed before receipt',reason});
    if(typeof saveAppData==='function')saveAppData();
    if(typeof toast==='function')toast((p.sku||p.name||'PO line') + ' removed from ' + po.id + ' and retained in audit history.');
    if(typeof render==='function')render();
  }

  function poProduct(id) {
    return typeof product === 'function' ? product(id) : ((data.products || []).find(function (item) { return item.id === id; }) || null);
  }

  function poIsCustomPurchaseLine(line) {
    return !!(line && (line.nonStockPurchase || line.lineType === 'custom-purchase'));
  }

  function poLineProduct(line) {
    if (poIsCustomPurchaseLine(line)) return {
      id:line.productId,
      sku:line.supplierSku || line.customReference || 'CUSTOM',
      name:line.customProductName || line.description || 'Custom PO line',
      supplierSku:line.supplierSku || '',
      brand:line.purchaseCategory || 'Custom purchase',
      category:line.purchaseCategory || 'Custom purchase',
      taxCode:line.taxCode || '20% VAT',
      cost:Number(line.unitCost || 0)
    };
    return poProduct(line && line.productId) || {sku:line && line.productId || 'Missing',name:'Missing product'};
  }

  function poProjectOptions(selected) {
    const current=String(selected||'');
    const jobs=(data.jobs||[]).filter(function(job){return job && !['Cancelled','Completed','Invoiced'].includes(job.status);});
    return '<option value="">General business purchase / no project</option>' + jobs.map(function(job){
      return '<option value="' + poEsc(job.id) + '"' + (String(job.id)===current?' selected':'') + '>' + poEsc((job.name||job.id) + ' · ' + job.id) + '</option>';
    }).join('');
  }

  function poCustomLineComposer(po) {
    return '<details class="po-custom-line-composer"><summary><span><strong>+ Add custom PO line</strong><small>Building materials, consumables, one-off supplier items and project costs that do not need a Sales Order.</small></span><span class="po-custom-summary-pill">PO-only purchase</span></summary>' +
      '<div class="po-custom-line-form" data-po-custom-line-form="' + poEsc(po.id) + '">' +
        '<label class="span-2">Item / service<input data-po-custom-name maxlength="180" placeholder="e.g. MOT Type 1, cement, timber, fixings, plant consumables"></label>' +
        '<label class="span-2">Detailed description<textarea data-po-custom-description rows="2" maxlength="1000" placeholder="What exactly are we buying? Include size, grade, specification or other supplier detail."></textarea></label>' +
        '<label>Supplier SKU / reference<input data-po-custom-sku maxlength="120" placeholder="Optional supplier code"></label>' +
        '<label>Purchase category<select data-po-custom-category><option>Building materials</option><option>Groundworks</option><option>Plant & hire</option><option>Electrical</option><option>Plumbing</option><option>Pool equipment</option><option>Consumables</option><option>Delivery / freight</option><option>Professional services</option><option>Other</option></select></label>' +
        '<label>Quantity<input data-po-custom-qty type="number" min="0.01" step="0.01" value="1"></label>' +
        '<label>Unit<select data-po-custom-uom><option>each</option><option>bag</option><option>pack</option><option>box</option><option>tonne</option><option>kg</option><option>m</option><option>m²</option><option>m³</option><option>litre</option><option>load</option><option>day</option><option>job</option></select></label>' +
        '<label>Unit cost net (£)<input data-po-custom-cost type="number" min="0" step="0.01" placeholder="0.00"></label>' +
        '<label>VAT<select data-po-custom-vat><option>20% VAT</option><option>5% VAT</option><option>Zero Rated</option></select></label>' +
        '<label class="span-2">Allocate cost to Project<select data-po-custom-project>' + poProjectOptions('') + '</select><small>Optional. If selected, this PO line becomes part of that Project\'s live cost and profit position.</small></label>' +
        '<label>Expected / required date<input data-po-custom-date type="date" value="' + poEsc(po.due||'') + '"></label>' +
        '<label>Receiving treatment<span class="po-custom-readonly"><strong>Non-stock direct purchase</strong><small>Receipt updates the PO/project cost but does not create warehouse stock.</small></span></label>' +
        '<label class="span-2">Internal purchasing note<textarea data-po-custom-note rows="2" maxlength="1000" placeholder="Delivery instructions, site use, supplier notes, why this is being purchased..."></textarea></label>' +
        '<div class="po-custom-line-actions span-2"><div><strong>No Sales Order required</strong><small>Use a Product Hub item instead if the item needs to become warehouse stock.</small></div><button type="button" class="primary" data-po-add-custom-line="' + poEsc(po.id) + '">Add custom line</button></div>' +
      '</div></details>';
  }

  function purchaseAddCustomPoLine(poId, payload) {
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(poId);});
    if(!po)return {ok:false,error:'Purchase Order not found.'};
    const name=String(payload.name||'').trim(),description=String(payload.description||'').trim(),qty=Number(payload.qty),unitCost=Number(payload.unitCost),projectId=String(payload.projectId||'').trim();
    if(!name)return {ok:false,error:'Enter the custom item / service name.'};
    if(!Number.isFinite(qty)||qty<=0)return {ok:false,error:'Enter a quantity greater than zero.'};
    if(!Number.isFinite(unitCost)||unitCost<0)return {ok:false,error:'Enter a valid unit cost.'};
    if(projectId && !(data.jobs||[]).some(function(job){return String(job.id)===projectId;}))return {ok:false,error:'Choose a valid Project or leave Project blank.'};
    const token='POCUSTOM-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),now=new Date().toISOString();
    const line={
      productId:token,
      receiptLineId:token,
      lineType:'custom-purchase',
      nonStockPurchase:true,
      customProductName:name,
      description:description,
      supplierSku:String(payload.supplierSku||'').trim(),
      customReference:String(payload.supplierSku||'').trim(),
      purchaseCategory:String(payload.purchaseCategory||'Other'),
      qty:Math.round(qty*100)/100,
      uom:String(payload.uom||'each'),
      unitCost:Math.round(unitCost*100)/100,
      taxCode:String(payload.taxCode||'20% VAT'),
      projectId:projectId,
      salesOrderId:'',
      received:0,
      orderedDate:poToday(),
      dueDate:String(payload.dueDate||po.due||''),
      supplierNotes:String(payload.note||'').trim(),
      internalNote:String(payload.note||'').trim(),
      receivingTreatment:'Non-stock direct purchase',
      createdAt:now,
      createdBy:(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing'
    };
    po.lines=Array.isArray(po.lines)?po.lines:[];
    po.lines.push(line);
    if(po.supplierEmailSentAt||po.supplierConfirmedAt){
      po.reviewStatus='Needs review';
      po.supplierEmailStatus='Changes pending';
      if(!['Cancelled','Received'].includes(po.status))po.status='Draft - Review';
    }
    data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
    data.auditLog.push({id:'AUD-'+Date.now(),date:now,user:line.createdBy,action:'Custom purchase order line added',product:po.id,newValue:JSON.parse(JSON.stringify(line)),reason:projectId?'PO-only project purchase':'PO-only general purchase'});
    if(typeof saveAppData==='function')saveAppData();
    return {ok:true,po:po,line:line};
  }

  function poSupplier(name) {
    if (typeof supplierProfile === 'function') return supplierProfile(name);
    return (data.suppliers || []).find(function (item) { return item.name === name; }) || { name:name || 'Supplier to confirm' };
  }

  function poSupplierAddressText(supplier) {
    const a=(supplier&&supplier.address)||{};
    return [a.line1||supplier.addressLine1,a.line2||supplier.addressLine2,a.city||supplier.city,a.county||supplier.county,a.postcode||supplier.postcode,a.country||supplier.country].filter(Boolean).join(', ');
  }

  function poSupplierFundingState(po) {
    const engine=window.PoolShedSupplierCommand;
    if(!po||!engine||typeof engine.fundingControl!=='function')return null;
    const funding=engine.fundingControl(po.supplier,{today:poToday()});
    const row=(funding.rows||[]).find(function(item){return String(item.poId)===String(po.id);})||null;
    return {funding:funding,row:row};
  }

  function poSupplierOptions(selected) {
    const current=String(selected||'').trim();
    const names=(data.suppliers||[]).map(function(item){return String(item.name||'').trim();}).filter(Boolean);
    if(current&&!names.some(function(name){return name===current;}))names.push(current);
    names.sort(function(a,b){return a.localeCompare(b);});
    return '<option value="">Select supplier</option>' + names.map(function(name){
      return '<option value="' + poEsc(name) + '"' + (name===current?' selected':'') + '>' + poEsc(name) + '</option>';
    }).join('');
  }

  function changePurchaseOrderSupplier(poId,newSupplier) {
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return row.id===poId;});
    if(!po)return typeof toast==='function'?toast('Purchase Order not found.'):false;
    const next=String(newSupplier||'').trim(),previous=String(po.supplier||'').trim();
    if(!next){
      if(typeof toast==='function')toast('Choose a supplier.');
      if(typeof render==='function')render();
      return false;
    }
    if(next===previous)return true;
    const summary=poSummarySafe(po);
    const receiptCount=(data.receiptEvents||[]).filter(function(event){return String(event.poId||'')===String(po.id||'');}).length;
    const hasReceiving=summary.received>0||receiptCount>0;
    if(hasReceiving&&!confirm('This PO already has received stock. Change the supplier name/account only? Receiving quantities, Goods In, costs and stock history will stay exactly as they are.')) {
      if(typeof render==='function')render();
      return false;
    }
    const at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing';
    po.supplierCorrections=Array.isArray(po.supplierCorrections)?po.supplierCorrections:[];
    po.supplierCorrections.push({id:'POSUP-'+Date.now(),at,user,from:previous||'Not set',to:next,receivedUnits:summary.received,receiptCount:receiptCount,reason:hasReceiving?'Supplier corrected after receipt / custom-line import':'Supplier changed before receipt'});
    po.supplier=next;
    if(!hasReceiving&&(po.supplierEmailSentAt||po.supplierConfirmedAt)){
      po.reviewStatus='Needs review';
      po.supplierEmailStatus='Changes pending';
      if(!['Cancelled','Received'].includes(po.status))po.status='Draft - Review';
    }
    data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
    data.auditLog.push({id:'AUD-'+Date.now(),date:at,user,action:'Purchase order supplier corrected',product:po.id,previousValue:previous||'Not set',newValue:next,reason:hasReceiving?'Post-receipt supplier metadata correction':'Supplier changed'});
    if(typeof saveAppData==='function')saveAppData();
    if(typeof toast==='function')toast(po.id + ' supplier updated to ' + next + (hasReceiving?' without changing receiving history.':'.'));
    if(typeof render==='function')render();
    return true;
  }

  function poLineCost(line) {
    const p = poProduct(line.productId) || {};
    return Number(line.unitCost != null ? line.unitCost : p.cost || 0);
  }

  function poSummarySafe(po) {
    if (typeof poSummary === 'function') return poSummary(po);
    return (po.lines || []).reduce(function (summary, line) {
      const ordered = Number(line.qty || 0);
      const received = Number(line.received || 0);
      summary.ordered += ordered;
      summary.received += received;
      summary.pending += Math.max(0, ordered - received);
      summary.pendingCost += Math.max(0, ordered - received) * poLineCost(line);
      return summary;
    }, { ordered:0, received:0, pending:0, pendingCost:0 });
  }

  function poOrderValue(po) {
    return (po.lines || []).reduce(function (total, line) { return total + Number(line.qty || 0) * poLineCost(line); }, 0);
  }

  function poConfirmedValue(po) {
    return (po.lines || []).reduce(function (total, line) {
      const qty = Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0);
      const cost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : poLineCost(line));
      return total + qty * cost;
    }, 0);
  }

  function poToday() {
    return typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10);
  }

  function purchaseOrderHealth(po) {
    const summary = poSummarySafe(po);
    const late = summary.pending > 0 && po.due && String(po.due) < poToday();
    const exceptionLines = (po.lines || []).filter(function (line) {
      const confirmedQty = Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0);
      const ordered = Number(line.qty || 0);
      const expected = poLineCost(line);
      const confirmedCost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : expected);
      return line.warehouseException || line.backorder || confirmedQty < ordered || (expected > 0 && Math.abs(confirmedCost - expected) / expected >= 0.05);
    }).length;
    if (late) return { label:'At risk', tone:'bad', detail:'Outstanding stock is past the requested date.' };
    if (exceptionLines) return { label:'Exception', tone:'warn', detail:exceptionLines + ' line exception' + (exceptionLines === 1 ? '' : 's') + ' need review.' };
    if (['Draft - Review','Ready To Email'].includes(po.status)) return { label:'Needs attention', tone:'info', detail:'PO has not completed supplier commitment.' };
    if (summary.pending === 0 && summary.ordered > 0) return { label:'Complete', tone:'good', detail:'All ordered units have been physically received.' };
    return { label:'Healthy', tone:'good', detail:'Supplier commitment and inbound position are within plan.' };
  }

  function purchaseDemandSources(po) {
    const sources = [];
    (po.lines || []).forEach(function (line) {
      const p = poLineProduct(line);
      if (line.salesOrderId) sources.push({ type:'Sales Order', ref:line.salesOrderId, productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Demand source only. FIFO decides physical allocation after QC.' });
      else if (line.projectId || po.projectId || po.jobId) sources.push({ type:'Project', ref:line.projectId || po.projectId || po.jobId, productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:poIsCustomPurchaseLine(line)?'PO-only non-stock cost allocated directly to this Project.':'Project procurement demand.' });
      else if(poIsCustomPurchaseLine(line)) sources.push({ type:'Direct purchase', ref:'PO-only', productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Non-stock supplier purchase. No Sales Order link required and no warehouse stock is created.' });
      else sources.push({ type:'Replenishment / stock', ref:'General stock', productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Warehouse or replenishment demand.' });
    });
    return sources;
  }

  function poPill(text, tone) {
    return '<span class="po-command-pill ' + (tone || 'info') + '">' + poEsc(text) + '</span>';
  }

  function poStatusText(po) {
    return po.status === 'Draft - Review' ? 'Draft' : po.status === 'Ready To Email' ? 'Ready to Send' : po.status || 'Draft';
  }

  function poCommandTabs(po) {
    const alias={demand:'connections',confirmation:'fulfilment',receipts:'fulfilment',returns:'connections',supplier:'more',payments:'costs'};
    const activeTab=alias[purchaseCommandTab]||purchaseCommandTab;
    const tabs = [
      ['items','Items & Costing'],
      ['fulfilment','Fulfilment'],
      ['addresses','Addresses'],
      ['costs','Cost & Payments'],
      ['connections','Sales Orders & Credits'],
      ['activity','Activity & Payments'],
      ['more','More']
    ];
    return '<div class="po-tabs-shell"><nav class="po-command-tabs" aria-label="Purchase Order sections">' + tabs.map(function (tab) {
      return '<button type="button" class="' + (activeTab === tab[0] ? 'active' : '') + '" data-po-command-tab="' + tab[0] + '|' + poEsc(po.id) + '">' + tab[1] + '</button>';
    }).join('') + '</nav></div>';
  }

  function poSupplierCard(po, supplier) {
    const openPos = (data.purchaseOrders || []).filter(function (other) { return other.supplier === po.supplier && !['Received','Cancelled'].includes(other.status); }).length;
    const known=(data.suppliers||[]).some(function(item){return item.name===po.supplier;});
    const corrected=(po.supplierCorrections||[]).length>0;
    return '<section class="po-command-card po-supplier-card"><div class="po-command-card-head"><div><span>Supplier</span><h3>' + poEsc(supplier.name || po.supplier || 'Supplier to confirm') + '</h3></div>' + (known?'<button type="button" class="secondary" data-open-supplier-profile="' + poEsc(po.supplier || '') + '">Open supplier</button>':poPill('Custom / imported','warn')) + '</div>' +
      '<div class="po-supplier-correction"><label>Supplier account<select data-po-supplier-change="' + poEsc(po.id) + '">' + poSupplierOptions(po.supplier) + '</select></label><small>' + (poSummarySafe(po).received>0?'Supplier can still be corrected after receipt. Goods In and stock history will not be changed.':'Choose the supplier responsible for this PO.') + '</small>' + (corrected?'<span class="po-supplier-corrected">Corrected ' + (po.supplierCorrections||[]).length + ' time' + ((po.supplierCorrections||[]).length===1?'':'s') + '</span>':'') + '</div>' +
      '<div class="po-supplier-identity"><div class="po-supplier-avatar">' + poEsc((po.supplier || 'S').slice(0,2).toUpperCase()) + '</div><div><strong>' + poEsc(supplier.contact || 'Purchasing') + '</strong><small>' + poEsc(supplier.ordersEmail || supplier.email || 'No ordering email') + '</small><small>' + poEsc(supplier.phone || 'No telephone') + '</small><small class="po-supplier-address">' + poEsc(poSupplierAddressText(supplier) || 'Supplier address not set') + '</small></div>' + poPill((supplier.preferred ? 'Preferred' : known ? 'Active' : 'Needs supplier'), supplier.preferred ? 'good' : known ? 'info' : 'warn') + '</div><div class="po-mini-grid"><div><span>Account</span><strong>' + poEsc(supplier.accountNumber || supplier.code || 'Not set') + '</strong></div><div><span>Terms</span><strong>' + poEsc(supplier.terms || 'Not set') + '</strong></div><div><span>Lead time</span><strong>' + Number(supplier.leadTimeDays || 0) + ' days</strong></div><div><span>Open POs</span><strong>' + openPos + '</strong></div></div>' + (function(){const state=poSupplierFundingState(po),row=state&&state.row,funding=state&&state.funding;if(!funding)return '';const tone=row&&row.customerShortfall>0?'warn':'good';return '<div class="po-funding-control '+tone+'"><div><span>SUPPLIER FUNDING</span><strong>'+poEsc(funding.accountType)+(row&&row.salesOrderIds.length?' · linked '+poEsc(row.salesOrderIds.join(', ')):'')+'</strong><small>'+(row?poMoney(row.customerCover)+' customer cash cover · '+poMoney(row.customerShortfall)+' short':'No linked customer-funded demand')+'</small></div><button type="button" class="secondary" data-po-open-supplier-funding="'+poEsc(po.supplier||'')+'">Open funding</button></div>';})() + '</section>';
  }

  function poDetailsCard(po) {
    return '<section class="po-command-card"><div class="po-command-card-head"><div><span>Purchase Order</span><h3>Order details</h3></div></div><div class="po-fields"><label>Created<input type="date" data-po-field="' + poEsc(po.id) + '|created" value="' + poEsc(po.created || po.orderedDate || poToday()) + '"></label><label>Expected<input type="date" data-po-field="' + poEsc(po.id) + '|due" value="' + poEsc(po.due || '') + '"></label><label>Supplier reference<input data-po-field="' + poEsc(po.id) + '|supplierReference" value="' + poEsc(po.supplierReference || po.supplierRef || '') + '" placeholder="Supplier confirmation / order ref"></label><label>Delivery<select data-po-field="' + poEsc(po.id) + '|deliveryMethod"><option' + ((po.deliveryMethod || 'Warehouse') === 'Warehouse' ? ' selected' : '') + '>Warehouse</option><option' + (po.deliveryMethod === 'Direct to Project/Site' ? ' selected' : '') + '>Direct to Project/Site</option><option' + (po.deliveryMethod === 'Drop Ship to Customer' ? ' selected' : '') + '>Drop Ship to Customer</option></select></label></div></section>';
  }

  function poInboundCard(po) {
    const summary = poSummarySafe(po);
    const receipts = (data.receiptEvents || []).filter(function (event) { return event.poId === po.id; });
    const qc = (data.warehouseQcEvents || []).filter(function (event) { return event.poId === po.id; });
    const accepted = qc.filter(function (event) { return event.type === 'QC_RELEASE' && event.decision === 'Accepted'; }).reduce(function (n,event) { return n + Number(event.qty || 0); }, 0);
    const quarantine = qc.filter(function (event) { return event.type === 'QC_RELEASE' && ['Damaged','Wrong item'].includes(event.decision); }).reduce(function (n,event) { return n + Number(event.qty || 0); }, 0);
    const confirmed = (po.lines || []).reduce(function (n,line) { return n + Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0); }, 0);
    return '<section class="po-command-card"><div class="po-command-card-head"><div><span>Inbound & Receiving</span><h3>Supplier commitment</h3></div><button type="button" class="secondary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery</button></div><div class="po-inbound-progress"><div><span>Ordered</span><strong>' + summary.ordered + '</strong></div><div><span>Confirmed</span><strong>' + confirmed + '</strong></div><div><span>Received</span><strong>' + summary.received + '</strong></div><div><span>QC Passed</span><strong>' + accepted + '</strong></div><div><span>Quarantine</span><strong>' + quarantine + '</strong></div><div><span>Outstanding</span><strong>' + summary.pending + '</strong></div></div><p class="po-command-note">' + receipts.length + ' receipt' + (receipts.length === 1 ? '' : 's') + '. Physical quantities are written only by Warehouse booking-in.</p></section>';
  }

  function poLiveTotalsCard(po) {
    const financials=poFinancialsSafe(po),balance=Math.max(0,financials.balance),state=poPaymentState(po);
    return '<aside class="po-live-totals-card"><div class="po-live-totals-head"><span>ORDER VALUE</span><strong>Live totals</strong><small>Net, VAT, supplier payments and balance.</small></div><div class="po-live-totals-body">' +
      '<div class="po-live-total-row"><span>Net</span><strong>' + poMoney(financials.net) + '</strong></div>' +
      '<div class="po-live-total-row"><span>VAT</span><strong>' + poMoney(financials.vat) + '</strong></div>' +
      '<div class="po-live-total-row grand"><span>Total inc VAT</span><strong>' + poMoney(financials.gross) + '</strong></div>' +
      '<div class="po-live-total-row"><span>Paid to supplier</span><strong>' + poMoney(financials.paid) + '</strong></div>' +
      '<div class="po-live-total-row"><span>' + (financials.balance<0?'Overpaid':'Balance due') + '</span><strong>' + poMoney(Math.abs(financials.balance)) + '</strong></div>' +
      '<div class="po-live-payment-state">' + poPill(state,state==='Paid'?'good':state==='Part Paid'?'warn':state==='Overpaid'?'info':'bad') + '</div>' +
      '<div class="po-live-payment-actions"><button type="button" class="primary" data-po-command-tab="costs|' + poEsc(po.id) + '">Record supplier payment</button><button type="button" class="secondary" data-po-command-tab="activity|' + poEsc(po.id) + '">View payment history</button></div>' +
      '<p>Supplier payments update the financial record only. Receiving and stock history remain controlled by Goods In.</p>' +
    '</div></aside>';
  }

  function poItemsTab(po) {
    const financials=poFinancialsSafe(po);
    const units=(po.lines||[]).reduce(function(n,line){return n+Number(line.qty||0);},0);
    const receivedUnits=(po.lines||[]).reduce(function(n,line){return n+Number(line.received||0);},0);
    const rows = (po.lines || []).map(function (line, index) {
      const p = poLineProduct(line);
      const pending = Math.max(0, Number(line.qty || 0) - Number(line.received || 0));
      const demand = line.salesOrderId ? line.salesOrderId : (line.projectId || po.projectId || po.jobId || (poIsCustomPurchaseLine(line)?'PO-only purchase':'General stock'));
      const cost = poLineCost(line),qty=Number(line.qty||0),lineNet=cost*qty,lineVat=poLineVat(line,p,lineNet),lineGross=lineNet+lineVat,vatPct=lineNet>0?Math.round(lineVat/lineNet*100):0;
      const check=poLineDeleteAssessment(po,line);
      const menuId='po-line-menu-' + String(po.id+'-'+index).replace(/[^a-z0-9_-]/gi,'-');
      const custom=poIsCustomPurchaseLine(line);
      return '<tr class="po-line-row' + (custom?' po-custom-line-row':'') + '"><td class="po-product-cell"><div class="po-line-product">' + (custom?'<span class="po-line-thumb po-custom-thumb">PO</span>':poProductThumb(p)) + '<div><strong>' + poEsc(p.name || p.sku || 'Product') + '</strong><small>' + (custom?'<span class="po-custom-line-badge">CUSTOM PO LINE</span> · '+poEsc(line.uom||'each')+(line.description?' · '+poEsc(line.description):''):poEsc(p.sku || line.productId || '')) + '</small></div></div></td>' +
        '<td><strong>' + poEsc(line.supplierSku || p.supplierSku || '—') + '</strong><small>' + poEsc(custom?(line.purchaseCategory||'Custom purchase'):(p.brand || p.category || 'Supplier item')) + (custom&&line.internalNote?'<br>'+poEsc(line.internalNote):'') + '</small></td>' +
        '<td><button type="button" class="link-button" data-po-command-tab="connections|' + poEsc(po.id) + '">' + poEsc(demand) + '</button></td>' +
        '<td><div class="po-receiving-cell"><strong>' + Number(line.received || 0) + ' / ' + qty + '</strong><small>' + pending + ' outstanding' + (custom?' · non-stock':'') + '</small></div></td>' +
        '<td><input class="po-qty" data-po-line-qty="' + poEsc(po.id) + '|' + poEsc(line.productId) + '" type="number" min="' + Number(line.received || 0) + '" step="' + (custom?'0.01':'1') + '" value="' + qty + '"><small>' + poEsc(custom?(line.uom||'each'):'units') + '</small></td>' +
        '<td class="right"><input class="po-cost-input" type="number" step="0.01" min="0" data-po-line-cost="' + poEsc(po.id) + '|' + index + '" value="' + cost.toFixed(2) + '"><small>net unit</small></td>' +
        '<td class="po-vat">' + vatPct + '%</td>' +
        '<td class="right po-line-total"><strong>' + poMoney(lineGross) + '</strong><small>inc VAT</small></td>' +
        '<td class="po-line-actions"><button type="button" class="secondary po-line-menu-button" data-po-line-menu="' + menuId + '" aria-haspopup="menu" aria-expanded="false">•••</button><div id="' + menuId + '" class="po-line-menu" role="menu" hidden>' +
          (check.allowed ? '<button type="button" role="menuitem" class="danger-button" data-po-remove-line="' + poEsc(po.id) + '|' + index + '">Delete line</button><small>Allowed because nothing has been received.</small>' : '<button type="button" role="menuitem" data-po-line-credit="' + poEsc(po.id) + '|' + index + '">Return / credit</button><small>Receiving history is protected.</small>') +
        '</div></td></tr>';
    }).join('') || '<tr><td colspan="9" class="po-empty">No supplier lines yet. Select a supplier and add products.</td></tr>';
    return '<section class="po-work-card po-items-card"><div class="po-items-toolbar"><div><span>ORDER LINES</span><strong>' + (po.lines||[]).length + ' lines · ' + units + ' units</strong><small>' + receivedUnits + ' received</small></div><div class="po-line-add"><input id="poProductSearch" data-po-id="' + poEsc(po.id) + '" placeholder="Search supplier product, Pool Shed SKU, supplier SKU or barcode"><input id="poProductQty" type="number" min="1" value="1"><button type="button" class="primary" data-add-po-selected="' + poEsc(po.id) + '">Add line</button><div id="poProductResults" class="po-product-results" hidden></div></div></div>' +
      poCustomLineComposer(po) + '<div class="po-table-wrap"><table class="po-command-table po-items-table"><thead><tr><th>Product</th><th>Supplier item</th><th>Demand / link</th><th>Receiving</th><th>Qty</th><th class="right">Unit net</th><th>VAT</th><th class="right">Line total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="po-items-lower-grid"><section class="po-items-commercial-card"><div><span>SUPPLIER ORDER CONTROL</span><strong>Commercial record</strong><p>Keep supplier cost, receiving and payment status connected to this PO. The PO remains the cost authority for linked Sales Orders and Projects.</p></div><div class="po-financial-strip"><div><span>Subtotal net</span><strong>' + poMoney(financials.net) + '</strong></div><div><span>VAT</span><strong>' + poMoney(financials.vat) + '</strong></div><div class="grand"><span>Total inc VAT</span><strong>' + poMoney(financials.gross) + '</strong></div></div><div class="po-line-rule"><strong>Clean-up rule:</strong> unreceived lines can be deleted with a reason. Once stock has been received, the line remains permanent and must use the return / credit process.</div></section>' + poLiveTotalsCard(po) + '</div></section>';
  }

  function poDemandTab(po) {
    const sources = purchaseDemandSources(po);
    const rows = sources.map(function (source) { const ref=source.type==='Sales Order'?'<button type="button" class="link-button" data-po-open-sales-order="' + poEsc(source.ref) + '"><strong>' + poEsc(source.ref) + '</strong></button>':'<strong>' + poEsc(source.ref) + '</strong>'; return '<tr><td>' + poPill(source.type, source.type === 'Sales Order' ? 'info' : source.type === 'Project' ? 'warn' : 'good') + '</td><td>' + ref + '</td><td><strong>' + poEsc(source.sku) + '</strong><small>' + poEsc(source.name) + '</small></td><td>' + source.qty + '</td><td>' + poEsc(source.note) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="po-empty">No demand source links recorded.</td></tr>';
    const fundingState=poSupplierFundingState(po),funding=fundingState&&fundingState.funding,fundingRow=fundingState&&fundingState.row;
    const fundingCard=funding?'<div class="po-funding-banner '+(fundingRow&&fundingRow.customerShortfall>0?'warn':'good')+'"><div><strong>'+poEsc(funding.accountType)+' supplier funding</strong><p>'+(fundingRow?(poMoney(fundingRow.customerCover)+' customer cash allocated to '+poMoney(fundingRow.linkedRequirement)+' linked demand. '+(fundingRow.customerShortfall>0?poMoney(fundingRow.customerShortfall)+' still needs funding.':'Linked customer-funded demand is covered.')):'This PO has no Sales Order-linked demand to fund.')+'</p></div><button type="button" class="secondary" data-po-open-supplier-funding="'+poEsc(po.supplier||'')+'">Open supplier funding</button></div>':'';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Demand sources</h3><p>Shows why stock was purchased without granting ownership of the physical receipt.</p></div>' + poPill('FIFO protected','good') + '</div>'+fundingCard+'<div class="po-rule-banner"><strong>Demand source ≠ allocation ownership</strong><p>When stock passes Warehouse QC, exact-SKU FIFO allocates to the oldest eligible Sales Orders first. The PO link remains traceability only.</p></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Source</th><th>Reference</th><th>Item</th><th>Qty</th><th>Allocation rule</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poConfirmationTab(po) {
    const rows = (po.lines || []).map(function (line,index) {
      const p = poLineProduct(line);
      const ordered = Number(line.qty || 0);
      const confirmed = Number(line.confirmedQty != null ? line.confirmedQty : ordered);
      const baseCost = poLineCost(line);
      const confirmedCost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : baseCost);
      const qtyIssue = confirmed < ordered;
      const costPct = baseCost > 0 ? ((confirmedCost-baseCost)/baseCost)*100 : 0;
      return '<tr><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + ordered + '</td><td><input class="po-qty" data-po-confirmed-qty="' + poEsc(po.id) + '|' + index + '" type="number" min="0" value="' + confirmed + '"></td><td><input type="date" data-po-confirmed-eta="' + poEsc(po.id) + '|' + index + '" value="' + poEsc(line.confirmedEta || line.dueDate || po.due || '') + '"></td><td class="right"><input class="po-cost-input" type="number" step="0.01" min="0" data-po-confirmed-cost="' + poEsc(po.id) + '|' + index + '" value="' + confirmedCost.toFixed(2) + '"></td><td>' + (qtyIssue ? poPill((ordered-confirmed) + ' backordered','warn') : costPct >= 5 ? poPill('Cost +' + costPct.toFixed(1) + '%','warn') : poPill('Confirmed','good')) + '</td><td><input data-po-confirmation-note="' + poEsc(po.id) + '|' + index + '" value="' + poEsc(line.supplierConfirmationNote || '') + '" placeholder="Supplier note / substitution"></td></tr>';
    }).join('') || '<tr><td colspan="7" class="po-empty">Add PO lines before recording supplier confirmation.</td></tr>';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier Confirmation</h3><p>Record what the supplier actually committed to: quantity, ETA, cost and any backorder/substitution.</p></div><button type="button" class="secondary" data-po-mark-confirmed="' + poEsc(po.id) + '">Mark supplier confirmed</button></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Item</th><th>Ordered</th><th>Confirmed</th><th>ETA</th><th class="right">Confirmed cost</th><th>Exception</th><th>Supplier note</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poReceiptsTab(po) {
    const physical=(data.receiptEvents||[]).filter(function(event){return event.poId===po.id;}).map(function(event){return Object.assign({nonStockPurchase:false},event);});
    const direct=(po.nonStockReceipts||[]).map(function(event){return Object.assign({nonStockPurchase:true},event);});
    const receipts=physical.concat(direct).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    const rows=receipts.map(function(event){
      const line=(po.lines||[]).find(function(item){return String(item.receiptLineId||item.productId)===String(event.lineId||event.productId);});
      const p=line?poLineProduct(line):(poProduct(event.productId)||{sku:event.productId,name:event.customProductName||event.productId});
      if(event.nonStockPurchase)return '<tr><td><strong>' + poEsc(event.id) + '</strong><small>' + poEsc(event.date||'') + '</small></td><td><strong>' + poEsc(p.sku||'CUSTOM') + '</strong><small>' + poEsc(p.name||'Custom purchase') + '</small></td><td>' + Number(event.qty||0) + '</td><td>' + poEsc(event.supplierReference||'—') + '</td><td>' + poPill(event.decision||'Received · non-stock',event.decision==='Damaged'?'bad':'good') + '</td><td>' + poEsc(line&&line.projectId ? 'Project '+line.projectId : 'Direct / expense') + '</td></tr>';
      const qc=(data.warehouseQcEvents||[]).filter(function(q){return q.receiptId===event.id;}).slice(-1)[0];
      return '<tr><td><strong>' + poEsc(event.id) + '</strong><small>' + poEsc(event.date || '') + '</small></td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + Number(event.qty || 0) + '</td><td>' + poEsc(event.supplierReference || '—') + '</td><td>' + poPill(qc ? qc.decision : 'Awaiting QC', qc && qc.decision === 'Accepted' ? 'good' : qc && ['Damaged','Wrong item'].includes(qc.decision) ? 'bad' : 'warn') + '</td><td>' + poEsc(event.locationId || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="po-empty">No deliveries have been booked in yet.</td></tr>';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Deliveries & Receipts</h3><p>Physical stock receipts come from Warehouse. Custom PO-only lines are recorded as non-stock receipts and never create warehouse inventory.</p></div><button type="button" class="primary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery in Warehouse</button></div><div class="po-rule-banner"><strong>One receipt truth, two treatments</strong><p>Catalogue stock follows Receiving → QC → Putaway. Custom non-stock purchases only update the PO/project receipt history.</p></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Receipt / GRN</th><th>Item</th><th>Qty</th><th>Supplier ref</th><th>QC / treatment</th><th>Location / cost destination</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poCostsTab(po) {
    const ordered = poOrderValue(po);
    const confirmed = poConfirmedValue(po);
    const receivedValue = (po.lines || []).reduce(function(total,line){return total + Number(line.received||0) * Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : poLineCost(line));},0);
    const invoice = Number(po.supplierInvoiceTotal || 0);
    const variance = invoice ? invoice - receivedValue : 0;
    return '<div class="po-cost-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Three-way invoice match</h3><p>Compare the Purchase Order, physical receipts and supplier invoice before Accounting export.</p></div></div><div class="po-match-grid"><div><span>PO ordered</span><strong>' + poMoney(ordered) + '</strong></div><div><span>Supplier confirmed</span><strong>' + poMoney(confirmed) + '</strong></div><div><span>Physically received</span><strong>' + poMoney(receivedValue) + '</strong></div><div><span>Supplier invoice</span><strong>' + (invoice ? poMoney(invoice) : 'Not entered') + '</strong></div><div><span>Variance</span><strong class="' + (Math.abs(variance) > 0.01 ? 'bad-text' : 'good-text') + '">' + poMoney(variance) + '</strong></div></div><div class="po-fields"><label>Supplier invoice reference<input data-po-field="' + poEsc(po.id) + '|supplierInvoiceRef" value="' + poEsc(po.supplierInvoiceRef || '') + '"></label><label>Supplier invoice total<input type="number" step="0.01" min="0" data-po-field="' + poEsc(po.id) + '|supplierInvoiceTotal" value="' + Number(po.supplierInvoiceTotal || 0).toFixed(2) + '"></label><label>Match status<select data-po-field="' + poEsc(po.id) + '|invoiceMatchStatus"><option' + ((po.invoiceMatchStatus||'Needs review')==='Needs review'?' selected':'') + '>Needs review</option><option' + (po.invoiceMatchStatus==='Matched'?' selected':'') + '>Matched</option><option' + (po.invoiceMatchStatus==='Approved variance'?' selected':'') + '>Approved variance</option></select></label></div></section></div>';
  }

  function ensureReturnsHoldLocation() {
    data.locations = data.locations || [];
    if (!data.locations.some(function(loc){return loc.id === 'L-RETURNS-HOLD';})) data.locations.push({id:'L-RETURNS-HOLD',name:'Supplier Returns Hold',type:'Returns Hold',owner:'Warehouse',barcode:'LOC-RETURNS-HOLD'});
  }

  function nextPurchaseReturnId() {
    data.purchaseReturns = data.purchaseReturns || [];
    const next = data.purchaseReturns.reduce(function(max,row){const m=String(row.id||'').match(/(\d+)/);return Math.max(max,m?Number(m[1]):0);},0)+1;
    return 'PR-' + String(next).padStart(5,'0');
  }

  function purchaseCreateSupplierReturn(input) {
    input = input || {};
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(input.poId) : (data.purchaseOrders || []).find(function(row){return row.id===input.poId;});
    if (!po) return {ok:false,error:'Purchase Order not found.'};
    const line = (po.lines || []).find(function(row){return row.productId===input.productId;});
    if (!line) return {ok:false,error:'Product is not on this Purchase Order.'};
    const qty = Math.max(0,Math.floor(Number(input.qty||0)));
    if (!qty) return {ok:false,error:'Enter a return quantity.'};
    const reason = String(input.reason || '').trim();
    if (!reason) return {ok:false,error:'Choose a return reason.'};
    const sourceLocation = input.locationId || 'L-WH-A1';
    const stockRow = (data.stock || []).find(function(row){return row.productId===input.productId && row.locationId===sourceLocation;});
    const free = stockRow ? (typeof available === 'function' ? Number(available(stockRow)||0) : Math.max(0,Number(stockRow.qty||0)-Number(stockRow.allocated||0))) : 0;
    if (free < qty) return {ok:false,error:'Only ' + free + ' free unit(s) are available to return from this location.'};
    ensureReturnsHoldLocation();
    if (typeof removeStock === 'function') {
      if (!removeStock(input.productId, sourceLocation, qty)) return {ok:false,error:'Stock could not be moved to Returns Hold.'};
    } else {
      stockRow.qty = Number(stockRow.qty||0)-qty;
    }
    if (typeof addStock === 'function') addStock(input.productId,'L-RETURNS-HOLD',qty,0);
    else {
      let hold=(data.stock||[]).find(function(row){return row.productId===input.productId&&row.locationId==='L-RETURNS-HOLD';});
      if(!hold){hold={productId:input.productId,locationId:'L-RETURNS-HOLD',qty:0,allocated:0};data.stock.push(hold);} hold.qty+=qty;
    }
    data.purchaseReturns = data.purchaseReturns || [];
    const record={id:nextPurchaseReturnId(),poId:po.id,receiptId:input.receiptId||'',supplier:po.supplier,productId:input.productId,supplierSku:line.supplierSku || (poProduct(input.productId)||{}).supplierSku || '',qty:qty,unitCost:poLineCost(line),expectedCredit:poLineCost(line)*qty,reason:reason,status:'Awaiting Supplier Authorisation',sourceLocationId:sourceLocation,holdLocationId:'L-RETURNS-HOLD',createdAt:new Date().toISOString(),createdBy:(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing',rma:''};
    data.purchaseReturns.push(record);
    if (typeof addMovement === 'function') addMovement('Supplier Return Hold',input.productId,qty,sourceLocation,'L-RETURNS-HOLD',record.id,record.createdBy,po.id + ' · ' + reason);
    return {ok:true,return:record};
  }

  function purchaseReturnStatusSummary(po) {
    const rows=(data.purchaseReturns||[]).filter(function(row){return !po || row.poId===po.id;});
    return {count:rows.length,open:rows.filter(function(row){return row.status!=='Closed';}).length,expectedCredit:rows.reduce(function(n,row){return n+Number(row.expectedCredit||0);},0)};
  }

  function poReturnsTab(po) {
    const returns=(data.purchaseReturns||[]).filter(function(row){return row.poId===po.id;});
    const rows=returns.map(function(row){const p=poProduct(row.productId)||{sku:row.productId,name:row.productId};return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.createdAt||'') + '</small></td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '</td><td>' + poPill(row.status,row.status==='Closed'?'good':'warn') + '</td><td class="right">' + poMoney(row.expectedCredit) + '</td></tr>';}).join('') || '<tr><td colspan="6" class="po-empty">No supplier returns have been created for this PO.</td></tr>';
    const returnable=(po.lines||[]).filter(function(line){return Number(line.received||0)>0;});
    const productOptions=returnable.map(function(line){const p=poProduct(line.productId)||{sku:line.productId,name:line.productId};return '<option value="' + poEsc(line.productId) + '">' + poEsc(p.sku + ' · ' + p.name) + '</option>';}).join('');
    const locationOptions=(data.locations||[]).filter(function(loc){return !['L-RECEIVING','L-QUARANTINE','L-RETURNS-HOLD'].includes(loc.id);}).map(function(loc){return '<option value="' + poEsc(loc.id) + '">' + poEsc(loc.name) + '</option>';}).join('');
    const receipts=(data.receiptEvents||[]).filter(function(event){return event.poId===po.id;}).map(function(event){return '<option value="' + poEsc(event.id) + '">' + poEsc(event.id + ' · ' + (event.supplierReference||'No supplier ref')) + '</option>';}).join('');
    return '<div class="po-returns-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier Returns & Credits</h3><p>Mis-orders, supplier errors, damage, warranty and duplicate deliveries remain linked to the original PO and receipt.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Expected credit</th></tr></thead><tbody>' + rows + '</tbody></table></div></section><aside class="po-work-card po-return-create"><div class="po-work-card-head"><div><h3>Create supplier return</h3><p>Only free stock can be moved to Returns Hold.</p></div></div><div class="po-return-form" data-po-return-form="' + poEsc(po.id) + '"><label>Product<select data-po-return-product>' + productOptions + '</select></label><label>Quantity<input type="number" min="1" value="1" data-po-return-qty></label><label>Reason<select data-po-return-reason><option>Mis-ordered by Pool Bros</option><option>Wrong quantity ordered</option><option>Supplier sent wrong item</option><option>Supplier sent excess quantity</option><option>Damaged on arrival</option><option>Faulty / warranty</option><option>Duplicate delivery</option><option>No longer required</option><option>Incorrect specification</option><option>Other</option></select></label><label>Current location<select data-po-return-location>' + locationOptions + '</select></label><label>Receipt / GRN<select data-po-return-receipt><option value="">Not specified</option>' + receipts + '</select></label><button type="button" class="primary" data-po-create-return="' + poEsc(po.id) + '">Move to Returns Hold</button></div><div class="po-rule-banner"><strong>Stock effect</strong><p>On Hand remains physical stock. Returned quantity is removed from Available and moved to Supplier Returns Hold until dispatched/credited.</p></div></aside></div>';
  }

  function poSupplierPaymentHistory(po) {
    const rows=(po.payments||[]).slice().sort(function(a,b){return String(b.date||b.recordedAt||'').localeCompare(String(a.date||a.recordedAt||''));}).map(function(payment){
      return '<tr><td>' + poEsc(payment.date||'—') + '</td><td>' + poEsc(payment.type||'Other') + '</td><td>' + poEsc(payment.reference||'—') + '</td><td>' + poEsc(payment.recordedBy||'Office') + '</td><td class="right"><strong>' + poMoney(payment.amount) + '</strong></td><td class="right"><button type="button" class="danger-button" data-delete-po-payment="' + poEsc(po.id+'|'+payment.id) + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="6" class="po-empty">No supplier payments recorded yet.</td></tr>';
    return '<section class="po-work-card po-payment-history-card"><div class="po-work-card-head"><div><h3>Supplier payment history</h3><p>Every payment made to this supplier against ' + poEsc(po.id) + ' stays attached to the Purchase Order and its audit trail.</p></div><button type="button" class="primary" data-po-command-tab="costs|' + poEsc(po.id) + '">Record supplier payment</button></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Date paid</th><th>Payment type</th><th>Reference</th><th>Recorded by</th><th class="right">Amount</th><th class="right">Action</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poActivityTab(po) {
    const events=[];
    events.push({date:po.createdAt||po.created||po.orderedDate||'',type:'Created',detail:'Purchase Order created'});
    if(po.reviewedAt)events.push({date:po.reviewedAt,type:'Reviewed',detail:'Reviewed by ' + (po.reviewedBy||'Purchasing')});
    if(po.supplierEmailSentAt)events.push({date:po.supplierEmailSentAt,type:'Sent',detail:'Supplier PO sent'});
    (po.payments||[]).forEach(function(payment){events.push({date:payment.date||payment.recordedAt||'',type:'Payment',detail:poMoney(payment.amount) + ' · ' + (payment.type||'Other') + (payment.reference?' · '+payment.reference:'')});});
    (po.paymentCorrections||[]).forEach(function(row){events.push({date:row.correctedAt||'',type:'Payment correction',detail:poMoney(row.amount||0) + ' removed · ' + (row.reason||'Correction')});});
    (po.supplierCorrections||[]).forEach(function(row){events.push({date:row.at||'',type:'Supplier correction',detail:(row.from||'Not set') + ' → ' + (row.to||'Supplier') + (row.receivedUnits?' · ' + row.receivedUnits + ' units already received; physical history unchanged':'')});});
    (po.lineCorrections||[]).forEach(function(row){events.push({date:row.at||'',type:'Line correction',detail:(row.sku||row.line?.productId||'Item') + ' removed before receipt · ' + (row.reason||'Correction')});});
    (data.receiptEvents||[]).filter(function(event){return event.poId===po.id;}).forEach(function(event){events.push({date:event.date||'',type:'Receipt',detail:event.id + ' · ' + event.productId + ' × ' + event.qty});});
    (data.warehouseQcEvents||[]).filter(function(event){return event.poId===po.id;}).forEach(function(event){events.push({date:event.date||'',type:'QC',detail:(event.decision||'') + ' · ' + (event.productId||'') + ' × ' + Number(event.qty||0)});});
    (data.purchaseReturns||[]).filter(function(row){return row.poId===po.id;}).forEach(function(row){events.push({date:row.createdAt||'',type:'Return / credit',detail:row.id + ' · ' + row.reason + ' · ' + row.qty + ' unit(s)'});});
    events.sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
    return '<div class="po-tab-stack">' + poSupplierPaymentHistory(po) + '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Purchase Order activity</h3><p>Payments, supplier changes, receiving, QC, line corrections and credits in one permanent chronology.</p></div></div><div class="po-activity">' + (events.map(function(event){const tone=/payment/i.test(event.type)?' payment':/return|credit|correction/i.test(event.type)?' correction':/receipt|qc/i.test(event.type)?' receipt':'';return '<div class="' + tone.trim() + '"><span></span><section><strong>' + poEsc(event.type) + '</strong><small>' + poEsc(event.date||'') + '</small><p>' + poEsc(event.detail) + '</p></section></div>';}).join('') || '<p class="po-empty">No activity recorded.</p>') + '</div></section></div>';
  }

  function poAddressesTab(po) {
    const supplier=poSupplier(po.supplier);
    const locations=(data.locations||[]).filter(function(loc){return !['Returns Hold','Quarantine'].includes(loc.type);});
    const locationOptions='<option value="">Main Warehouse / not specified</option>'+locations.map(function(loc){return '<option value="' + poEsc(loc.id) + '"' + (String(po.receivingLocationId||'')===String(loc.id)?' selected':'') + '>' + poEsc(loc.name||loc.id) + '</option>';}).join('');
    return '<div class="po-dual-tab"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Delivery address</h3><p>Where the supplier should send this Purchase Order.</p></div></div><div class="po-fields po-address-fields"><label>Delivery method<select data-po-field="' + poEsc(po.id) + '|deliveryMethod"><option' + ((po.deliveryMethod||'Warehouse')==='Warehouse'?' selected':'') + '>Warehouse</option><option' + (po.deliveryMethod==='Direct to Project/Site'?' selected':'') + '>Direct to Project/Site</option><option' + (po.deliveryMethod==='Drop Ship to Customer'?' selected':'') + '>Drop Ship to Customer</option></select></label><label>Receiving location<select data-po-field="' + poEsc(po.id) + '|receivingLocationId">' + locationOptions + '</select></label><label class="wide">Deliver to / site address<input data-po-field="' + poEsc(po.id) + '|customerShipTo" value="' + poEsc(po.customerShipTo||'') + '" placeholder="Main Warehouse or full project/customer delivery address"></label><label class="wide">Delivery instructions<input data-po-field="' + poEsc(po.id) + '|deliveryInstructions" value="' + poEsc(po.deliveryInstructions||'') + '" placeholder="Access, contact, unloading or booking instructions"></label></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier address & contact</h3><p>Ordering details remain owned by the supplier record.</p></div><button type="button" class="secondary" data-open-supplier-profile="' + poEsc(po.supplier||'') + '">Open supplier</button></div><div class="po-address-summary"><strong>' + poEsc(supplier.name||po.supplier||'Supplier') + '</strong><p>' + poEsc(supplier.hqAddress||supplier.shippingAddress||'Supplier address not recorded') + '</p><small>' + poEsc(supplier.ordersEmail||supplier.email||'No ordering email') + (supplier.phone?' · '+poEsc(supplier.phone):'') + '</small></div></section></div>';
  }

  function poFulfilmentTab(po) {
    return '<div class="po-tab-stack">' + poConfirmationTab(po) + poReceiptsTab(po) + '</div>';
  }

  function poCostPaymentsTab(po) {
    const payment=typeof purchaseOrderPaymentsSection==='function'?purchaseOrderPaymentsSection(po,poSupplier(po.supplier)):'';
    return '<div class="po-tab-stack">' + poCostsTab(po) + payment + '</div>';
  }

  function poConnectionsTab(po) {
    return '<div class="po-tab-stack">' + poDemandTab(po) + poReturnsTab(po) + '</div>';
  }

  function poMoreTab(po) {
    return '<div class="po-dual-tab">' + poSupplierCard(po,poSupplier(po.supplier)) + poDetailsCard(po) + '</div>';
  }

  function poTabContent(po) {
    if (['demand','returns','connections'].includes(purchaseCommandTab)) return poConnectionsTab(po);
    if (['confirmation','receipts','fulfilment'].includes(purchaseCommandTab)) return poFulfilmentTab(po);
    if (purchaseCommandTab === 'addresses') return poAddressesTab(po);
    if (['costs','payments'].includes(purchaseCommandTab)) return poCostPaymentsTab(po);
    if (purchaseCommandTab === 'activity') return poActivityTab(po);
    if (['supplier','more'].includes(purchaseCommandTab)) return poMoreTab(po);
    return poItemsTab(po);
  }

  purchaseOrderDetailPage = function (po) {
    if (!po) return legacyPurchaseOrderListPage ? legacyPurchaseOrderListPage() : '<div class="po-empty">No Purchase Order selected.</div>';
    const supplier=poSupplier(po.supplier),summary=poSummarySafe(po),health=purchaseOrderHealth(po),financials=poFinancialsSafe(po),paymentState=poPaymentState(po);
    return '<div class="purchase-command-page po-sales-parity"><header class="po-command-head"><div class="po-command-title"><button type="button" class="secondary" data-back-po-list="true">← Purchase Orders</button><div><div class="po-command-kicker">PURCHASE ORDER</div><h1>' + poEsc(po.id) + ' ' + poPill(poStatusText(po), po.status === 'Received' ? 'good' : po.status === 'Cancelled' ? 'bad' : 'info') + '</h1><p>' + poEsc(po.supplier || 'Supplier to confirm') + ' · Expected ' + poEsc(po.due || 'not set') + ' · ' + summary.pending + ' units outstanding</p></div></div><div class="po-command-actions"><button type="button" class="secondary" data-po-save-action="email|' + poEsc(po.id) + '">Email / Print</button><button type="button" class="secondary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery</button><button type="button" class="danger-button" data-delete-po="' + poEsc(po.id) + '">Delete PO</button><button type="button" class="primary" data-po-save-action="save|' + poEsc(po.id) + '">Save PO</button></div></header>' +
      '<section class="po-health-bar"><div><span>PO health</span><strong>' + poEsc(health.label) + '</strong><small>' + poEsc(health.detail) + '</small></div><div><span>Ordered</span><strong>' + summary.ordered + '</strong><small>' + poMoney(financials.net) + ' net</small></div><div><span>Received</span><strong>' + summary.received + '</strong><small>' + summary.pending + ' pending</small></div><div><span>Supplier payment</span><strong>' + poEsc(paymentState) + '</strong><small>' + poMoney(financials.paid) + ' paid</small></div><div><span>Balance due</span><strong>' + poMoney(Math.max(0,financials.balance)) + '</strong><small>' + poMoney(financials.gross) + ' inc VAT</small></div></section>' +
      '<section class="po-command-summary">' + poSupplierCard(po,supplier) + poDetailsCard(po) + poInboundCard(po) + '</section>' + poCommandTabs(po) + '<main class="po-command-body">' + poTabContent(po) + '</main></div>';
  };

  purchaseOrderListPage = function () {
    const rows=(data.purchaseOrders||[]).slice().sort(function(a,b){const ha=purchaseOrderHealth(a),hb=purchaseOrderHealth(b);const rank={bad:0,warn:1,info:2,good:3};return rank[ha.tone]-rank[hb.tone] || String(a.due||'9999').localeCompare(String(b.due||'9999'));}).map(function(po){const summary=poSummarySafe(po),health=purchaseOrderHealth(po),financials=poFinancialsSafe(po),paymentState=poPaymentState(po),deleteState=typeof purchaseOrderDeleteAssessment==='function'?purchaseOrderDeleteAssessment(po):{allowed:summary.received===0};return '<tr><td><button class="link-button" data-open-po-detail="' + poEsc(po.id) + '"><strong>' + poEsc(po.id) + '</strong></button><small>' + poEsc(po.source||'Manual PO') + '</small></td><td><strong>' + poEsc(po.supplier||'Supplier to confirm') + '</strong><small>' + poEsc((poSupplier(po.supplier).ordersEmail||poSupplier(po.supplier).email||'')) + '</small></td><td>' + poPill(health.label,health.tone) + '<small>' + poEsc(health.detail) + '</small></td><td>' + poEsc(poStatusText(po)) + '</td><td>' + summary.received + '/' + summary.ordered + '<small>' + summary.pending + ' outstanding</small></td><td>' + poEsc(po.due||'Not set') + '</td><td>' + poPill(paymentState,paymentState==='Paid'?'good':paymentState==='Part Paid'?'warn':paymentState==='Overpaid'?'info':'bad') + '<small>' + poMoney(Math.max(0,financials.balance)) + ' due</small></td><td class="right"><strong>' + poMoney(financials.gross) + '</strong><small>' + poMoney(financials.net) + ' net</small></td><td><div class="po-list-actions"><button type="button" class="primary" data-open-po-detail="' + poEsc(po.id) + '">Open</button>' + (deleteState.allowed?'<button type="button" class="danger-button" data-delete-po="' + poEsc(po.id) + '">Delete</button>':'') + '</div></td></tr>';}).join('') || '<tr><td colspan="9" class="po-empty">No Purchase Orders yet.</td></tr>';
    const open=(data.purchaseOrders||[]).filter(function(po){return !['Received','Cancelled'].includes(po.status);});
    const pending=open.reduce(function(n,po){return n+poSummarySafe(po).pending;},0);
    const risks=open.filter(function(po){return ['bad','warn'].includes(purchaseOrderHealth(po).tone);}).length;
    const outstanding=open.reduce(function(n,po){return n+Math.max(0,poFinancialsSafe(po).balance);},0);
    return '<div class="purchase-command-page purchase-command-list po-sales-parity"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING</div><h1>Purchase Orders</h1><p>Supplier orders, commitments, receipts, payments, credits and invoice matching in one workflow.</p></div><div class="po-command-actions"><button type="button" class="primary" data-create-po-draft="true">New Purchase Order</button></div></header><section class="po-health-bar"><div><span>Open POs</span><strong>' + open.length + '</strong><small>not complete</small></div><div><span>Inbound units</span><strong>' + pending + '</strong><small>still expected</small></div><div><span>Needs attention</span><strong>' + risks + '</strong><small>late or exception</small></div><div><span>Outstanding to suppliers</span><strong>' + poMoney(outstanding) + '</strong><small>open PO balances</small></div><div><span>Suppliers</span><strong>' + (data.suppliers||[]).length + '</strong><small>supplier accounts</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Purchase Orders</h3><p>Open a PO for the same line-first workflow used by Sales Orders. Unreceived erroneous POs can be removed; received history remains permanent.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>PO</th><th>Supplier</th><th>Health</th><th>Status</th><th>Receiving</th><th>Expected</th><th>Payment</th><th class="right">Total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  };

  function saveLineField(datasetValue, fieldName, value) {
    const parts=String(datasetValue||'').split('|');
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(parts[0]):(data.purchaseOrders||[]).find(function(row){return row.id===parts[0];});
    const index=Number(parts[1]);
    const line=po && po.lines && po.lines[index];
    if(!line)return;
    line[fieldName]=value;
    if(typeof saveAppData==='function')saveAppData();
  }

  const purchaseWorkspaceSections = ['Purchase Orders','Procurement Demand','Suppliers','Supplier Returns & Credits','Invoice Matching'];

  function purchasePendingLinkedQty(orderId, productId) {
    return (data.purchaseOrders || []).reduce(function(total, po) {
      if (['Cancelled','Received'].includes(po.status)) return total;
      return total + (po.lines || []).filter(function(line){return line.productId === productId && String(line.salesOrderId || po.originalSalesOrderId || '') === String(orderId);}).reduce(function(n,line){return n + Math.max(0,Number(line.qty||0)-Number(line.received||0));},0);
    },0);
  }

  function procurementDemandRows() {
    const rows=[];
    (data.salesOrders || []).forEach(function(order){
      if (['Cancelled','Completed','Shipped','Invoiced'].includes(order.status)) return;
      (order.lines || []).forEach(function(line){
        const shortage=Math.max(0,Number(line.qty||0)-Number(line.allocated||0));
        if(!shortage)return;
        const inbound=purchasePendingLinkedQty(order.id,line.productId);
        const toBuy=Math.max(0,shortage-inbound);
        if(!toBuy)return;
        const p=poProduct(line.productId)||{sku:line.productId,name:line.productId,supplier:'Supplier to confirm'};
        rows.push({order:order,line:line,p:p,shortage:shortage,inbound:inbound,toBuy:toBuy,supplier:p.supplier||'Supplier to confirm'});
      });
    });
    rows.sort(function(a,b){return String(a.order.created||'9999').localeCompare(String(b.order.created||'9999')) || String(a.order.due||'9999').localeCompare(String(b.order.due||'9999'));});
    return rows;
  }

  function purchaseCreateOrMergeDemandPo(orderId, productId, qty) {
    const order=(data.salesOrders||[]).find(function(row){return row.id===orderId;});
    const p=poProduct(productId);
    const amount=Math.max(0,Math.floor(Number(qty||0)));
    if(!order||!p||!amount)return {ok:false,error:'Demand line is no longer available.'};
    const supplier=p.supplier||'Supplier to confirm';
    let po=(data.purchaseOrders||[]).find(function(row){return row.supplier===supplier && row.status==='Draft - Review';});
    if(!po){
      const id=typeof nextPurchaseOrderId==='function'?nextPurchaseOrderId():'PO-'+String(1000+(data.purchaseOrders||[]).length+1);
      po={id:id,supplier:supplier,status:'Draft - Review',due:order.due||'',source:'Consolidated procurement demand',reviewStatus:'Needs review',supplierEmailStatus:'Blocked until reviewed',lines:[]};
      data.purchaseOrders.unshift(po);
    }
    let line=(po.lines||[]).find(function(row){return row.productId===productId && row.salesOrderId===orderId;});
    if(line) line.qty=Number(line.qty||0)+amount;
    else po.lines.push({productId:productId,qty:amount,received:0,salesOrderId:orderId,supplierSku:p.supplierSku||'',unitCost:Number(p.cost||0),orderedDate:poToday(),dueDate:order.due||'',chaseStatus:'Waiting',supplierNotes:'Consolidated from Procurement Demand'});
    return {ok:true,po:po};
  }

  function purchaseProcurementDemandPage() {
    const demand=procurementDemandRows();
    const rows=demand.map(function(row){return '<tr><td><strong>' + poEsc(row.order.id) + '</strong><small>' + poEsc(row.order.due||'No due date') + '</small></td><td><strong>' + poEsc(row.p.sku) + '</strong><small>' + poEsc(row.p.name) + '</small></td><td>' + poEsc(row.supplier) + '</td><td>' + row.shortage + '</td><td>' + row.inbound + '</td><td><strong>' + row.toBuy + '</strong></td><td><button type="button" class="primary" data-po-create-demand="' + poEsc(row.order.id + '|' + row.productId) + '" data-po-create-demand-qty="' + row.toBuy + '">Add to supplier PO</button></td></tr>';}).join('') || '<tr><td colspan="7" class="po-empty">No uncovered Sales Order shortages need purchasing.</td></tr>';
    const units=demand.reduce(function(n,row){return n+row.toBuy;},0);
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / PROCUREMENT DEMAND</div><h1>Procurement Demand</h1><p>Uncovered customer demand after current allocation and linked inbound stock.</p></div></header><section class="po-health-bar"><div><span>Demand lines</span><strong>' + demand.length + '</strong><small>need purchasing</small></div><div><span>Units to buy</span><strong>' + units + '</strong><small>after linked inbound</small></div><div><span>Allocation rule</span><strong>FIFO</strong><small>on physical receipt</small></div><div><span>PO creation</span><strong>Consolidated</strong><small>by supplier draft</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Demand needing purchase</h3><p>Adding demand merges it into an existing Draft PO for the same supplier where possible.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Sales Order</th><th>Item</th><th>Supplier</th><th>Shortage</th><th>Already inbound</th><th>To buy</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  function purchaseReturnsOverviewPage() {
    const rows=(data.purchaseReturns||[]).slice().sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));}).map(function(row){const p=poProduct(row.productId)||{sku:row.productId,name:row.productId};return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.poId) + '</small></td><td>' + poEsc(row.supplier) + '</td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '</td><td>' + poPill(row.status,row.status==='Closed'?'good':'warn') + '</td><td class="right">' + poMoney(row.expectedCredit) + '</td></tr>';}).join('') || '<tr><td colspan="7" class="po-empty">No supplier returns or credits recorded.</td></tr>';
    const summary=purchaseReturnStatusSummary();
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / RETURNS</div><h1>Supplier Returns & Credits</h1><p>Mis-orders, supplier errors, damage, warranties and outstanding supplier credits.</p></div></header><section class="po-health-bar"><div><span>Return records</span><strong>' + summary.count + '</strong><small>all time</small></div><div><span>Open returns</span><strong>' + summary.open + '</strong><small>not closed</small></div><div><span>Expected credits</span><strong>' + poMoney(summary.expectedCredit) + '</strong><small>supplier value</small></div><div><span>Stock location</span><strong>Returns Hold</strong><small>excluded from Available</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Return & credit queue</h3><p>Create a return from the original Purchase Order so cost, receipt and stock history remain linked.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return / PO</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Expected credit</th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  function purchaseInvoiceMatchingPage() {
    const rows=(data.purchaseOrders||[]).filter(function(po){return po.supplierInvoiceRef || Number(po.supplierInvoiceTotal||0)>0 || poSummarySafe(po).received>0;}).map(function(po){const received=(po.lines||[]).reduce(function(n,line){return n+Number(line.received||0)*Number(line.confirmedUnitCost!=null?line.confirmedUnitCost:poLineCost(line));},0);const invoice=Number(po.supplierInvoiceTotal||0);const variance=invoice?invoice-received:0;return '<tr><td><button class="link-button" data-open-po-detail="' + poEsc(po.id) + '"><strong>' + poEsc(po.id) + '</strong></button></td><td>' + poEsc(po.supplier) + '</td><td>' + poMoney(received) + '</td><td>' + (invoice?poMoney(invoice):'Not entered') + '</td><td class="right"><strong class="' + (Math.abs(variance)>.01?'bad-text':'good-text') + '">' + poMoney(variance) + '</strong></td><td>' + poPill(po.invoiceMatchStatus||'Needs review',po.invoiceMatchStatus==='Matched'?'good':'warn') + '</td></tr>';}).join('') || '<tr><td colspan="6" class="po-empty">No received Purchase Orders are waiting for invoice matching.</td></tr>';
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / ACCOUNTS CONTROL</div><h1>Invoice Matching</h1><p>Three-way view of Purchase Order value, received stock and supplier invoice.</p></div></header><section class="po-work-card"><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>PO</th><th>Supplier</th><th>Received value</th><th>Supplier invoice</th><th class="right">Variance</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  sidebarSubGroups = function(tabId){
    if(tabId==='purchase') return purchaseWorkspaceSections.slice();
    return legacySidebarSubGroups ? legacySidebarSubGroups(tabId) : [];
  };
  defaultSubPage = function(tabId){
    if(tabId==='purchase') return 'Purchase Orders';
    return legacyDefaultSubPage ? legacyDefaultSubPage(tabId) : '';
  };
  openSidebarSubGroup = function(tabId,subgroup){
    if(tabId!=='purchase') return legacyOpenSidebarSubGroup ? legacyOpenSidebarSubGroup(tabId,subgroup) : undefined;
    active='purchase'; activeSubPage.purchase=subgroup;
    if(subgroup==='Purchase Orders') purchaseOrderView='list';
    if(subgroup==='Suppliers') purchaseOrderView='suppliers';
    if(typeof render==='function') render();
  };

  renderPurchase = function(){
    const sub=typeof selectedSubPage==='function'?selectedSubPage('purchase'):(activeSubPage.purchase||'Purchase Orders');
    const selectedPo=typeof purchaseOrderById==='function'?purchaseOrderById(selectedPurchaseOrderId):(data.purchaseOrders||[])[0];
    let content;
    if(purchaseOrderView==='detail' && selectedPo) content=purchaseOrderDetailPage(selectedPo);
    else if(purchaseOrderView==='supplier-profile' && typeof supplierProfilePage==='function') content=supplierProfilePage(selectedSupplierName);
    else if(purchaseOrderView==='supplier-catalogue' && typeof supplierCataloguePage==='function') content=supplierCataloguePage(selectedSupplierName);
    else if(sub==='Procurement Demand') content=purchaseProcurementDemandPage();
    else if(sub==='Supplier Returns & Credits') content=purchaseReturnsOverviewPage();
    else if(sub==='Invoice Matching') content=purchaseInvoiceMatchingPage();
    else if(sub==='Suppliers' || purchaseOrderView==='suppliers') content=typeof supplierManagementPage==='function'?supplierManagementPage():purchaseOrderListPage();
    else content=purchaseOrderListPage();
    const screen=document.getElementById('screen-purchase'); if(screen) screen.innerHTML=content;
    bindPurchase();
  };

  globalThis.openPurchaseOrderTab = function(poId, tab){
    selectedPurchaseOrderId=poId;
    purchaseOrderView='detail';
    purchaseCommandTab=tab||'items';
    active='purchase';
    activeSubPage.purchase='Purchase Orders';
    if(typeof render==='function') render();
  };
  globalThis.purchaseCreateOrMergeDemandPo = purchaseCreateOrMergeDemandPo;
  globalThis.purchaseAddCustomPoLine = purchaseAddCustomPoLine;

  function bindPurchaseCommand() {
    document.querySelectorAll('[data-po-add-custom-line]').forEach(function(button){button.addEventListener('click',function(){
      const form=button.closest('[data-po-custom-line-form]');if(!form)return;
      const value=function(selector){const el=form.querySelector(selector);return el?el.value:'';};
      const result=purchaseAddCustomPoLine(button.dataset.poAddCustomLine,{
        name:value('[data-po-custom-name]'),
        description:value('[data-po-custom-description]'),
        supplierSku:value('[data-po-custom-sku]'),
        purchaseCategory:value('[data-po-custom-category]'),
        qty:value('[data-po-custom-qty]'),
        uom:value('[data-po-custom-uom]'),
        unitCost:value('[data-po-custom-cost]'),
        taxCode:value('[data-po-custom-vat]'),
        projectId:value('[data-po-custom-project]'),
        dueDate:value('[data-po-custom-date]'),
        note:value('[data-po-custom-note]')
      });
      if(!result.ok)return typeof toast==='function'?toast(result.error):undefined;
      if(typeof toast==='function')toast((result.line.customProductName||'Custom line')+' added to '+result.po.id+'. No Sales Order link required.');
      if(typeof render==='function')render();
    });});
    document.querySelectorAll('[data-po-create-demand]').forEach(function(button){button.addEventListener('click',function(){const parts=button.dataset.poCreateDemand.split('|');const result=purchaseCreateOrMergeDemandPo(parts[0],parts[1],button.dataset.poCreateDemandQty);if(!result.ok)return typeof toast==='function'?toast(result.error):undefined;selectedPurchaseOrderId=result.po.id;purchaseOrderView='detail';activeSubPage.purchase='Purchase Orders';if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast('Demand added to ' + result.po.id + '.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-command-tab]').forEach(function(button){button.addEventListener('click',function(){purchaseCommandTab=button.dataset.poCommandTab.split('|')[0];if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-open-receiving]').forEach(function(button){button.addEventListener('click',function(){selectedGoodsInPoId=button.dataset.poOpenReceiving;warehousePoView='list';active='warehouse';activeSubPage.warehouse='Inbound';if(typeof toast==='function')toast('Opened easy booking-in for ' + selectedGoodsInPoId + '.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-supplier-change]').forEach(function(select){select.addEventListener('change',function(){changePurchaseOrderSupplier(select.dataset.poSupplierChange,select.value);});});
    document.querySelectorAll('[data-po-line-cost]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poLineCost,'unitCost',Math.max(0,Number(input.value||0)));if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-open-sales-order]').forEach(function(button){button.addEventListener('click',function(){selectedSalesOrderId=button.dataset.poOpenSalesOrder;salesOrderView='detail';if(typeof salesOrderTab!=='undefined')salesOrderTab='connections';activeSubPage.salesorders='Sales Orders';active='salesorders';if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-open-supplier-funding]').forEach(function(button){button.addEventListener('click',function(){const supplier=button.dataset.poOpenSupplierFunding||'';if(typeof globalThis.openSupplierCommand==='function'){globalThis.openSupplierCommand(supplier,'Overview');return;}selectedSupplierName=supplier;purchaseOrderView='suppliers';activeSubPage.purchase='Suppliers';active='purchase';if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-confirmed-qty]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedQty,'confirmedQty',Math.max(0,Math.floor(Number(input.value||0))));});});
    document.querySelectorAll('[data-po-confirmed-cost]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedCost,'confirmedUnitCost',Math.max(0,Number(input.value||0)));});});
    document.querySelectorAll('[data-po-confirmed-eta]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedEta,'confirmedEta',input.value);});});
    document.querySelectorAll('[data-po-confirmation-note]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmationNote,'supplierConfirmationNote',input.value);});});
    document.querySelectorAll('[data-po-mark-confirmed]').forEach(function(button){button.addEventListener('click',function(){const po=typeof purchaseOrderById==='function'?purchaseOrderById(button.dataset.poMarkConfirmed):null;if(!po)return;const fundingState=poSupplierFundingState(po),funding=fundingState&&fundingState.funding,row=fundingState&&fundingState.row;if(funding&&funding.proForma&&row&&row.linkedRequirement>0&&row.customerShortfall>0){purchaseCommandTab='connections';if(typeof toast==='function')toast('Pro Forma funding shortfall: '+poMoney(row.customerShortfall)+' still needs customer funding before supplier release / confirmation.');if(typeof render==='function')render();return;}po.status='Supplier Confirmed';po.supplierConfirmedAt=new Date().toISOString();po.lines.forEach(function(line){if(line.confirmedQty==null)line.confirmedQty=Number(line.qty||0);if(line.confirmedUnitCost==null)line.confirmedUnitCost=poLineCost(line);if(!line.confirmedEta)line.confirmedEta=po.due||'';});if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast(po.id + ' marked Supplier Confirmed.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-create-return]').forEach(function(button){button.addEventListener('click',function(){const form=button.closest('[data-po-return-form]');if(!form)return;const result=purchaseCreateSupplierReturn({poId:button.dataset.poCreateReturn,productId:form.querySelector('[data-po-return-product]').value,qty:form.querySelector('[data-po-return-qty]').value,reason:form.querySelector('[data-po-return-reason]').value,locationId:form.querySelector('[data-po-return-location]').value,receiptId:form.querySelector('[data-po-return-receipt]').value});if(!result.ok)return typeof toast==='function'?toast(result.error):undefined;if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast(result.return.id + ' created and stock moved to Supplier Returns Hold.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-line-menu]').forEach(function(button){button.addEventListener('click',function(event){event.stopPropagation();const menu=document.getElementById(button.dataset.poLineMenu);document.querySelectorAll('.po-line-menu').forEach(function(other){if(other!==menu)other.hidden=true;});if(menu){menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));}});});
    document.querySelectorAll('[data-po-remove-line]').forEach(function(button){button.addEventListener('click',function(){const parts=String(button.dataset.poRemoveLine||'').split('|');removePurchaseOrderLine(parts[0],parts[1]);});});
    document.querySelectorAll('[data-po-line-credit]').forEach(function(button){button.addEventListener('click',function(){purchaseCommandTab='connections';if(typeof toast==='function')toast('Received PO lines stay in history. Use Supplier Returns & Credits to correct them.');if(typeof render==='function')render();});});
  }

  function poProFormaFundingGap(po) {
    const state=poSupplierFundingState(po),funding=state&&state.funding,row=state&&state.row;
    if(!funding||!funding.proForma||!row||Number(row.linkedRequirement||0)<=0||Number(row.customerShortfall||0)<=0)return null;
    return {funding:funding,row:row,shortfall:Number(row.customerShortfall||0)};
  }

  function poBlockUnfundedProFormaRelease(po,actionLabel) {
    const gap=poProFormaFundingGap(po);
    if(!gap)return false;
    purchaseCommandTab='connections';
    if(typeof toast==='function')toast('Pro Forma funding shortfall: '+poMoney(gap.shortfall)+' still needs customer funding before '+actionLabel+'.');
    if(typeof render==='function')render();
    return true;
  }

  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-po-save-action],[data-prepare-po-email],[data-send-po-email]');
    if(!button)return;
    let poId='',release=false,label='supplier release';
    if(button.dataset.poSaveAction!==undefined){
      const parts=String(button.dataset.poSaveAction||'').split('|');
      poId=parts[1]||'';
      release=parts[0]==='email';
      label='supplier email preparation';
    }else if(button.dataset.preparePoEmail!==undefined){
      poId=button.dataset.preparePoEmail;release=true;label='supplier email preparation';
    }else if(button.dataset.sendPoEmail!==undefined){
      poId=button.dataset.sendPoEmail;release=true;label='marking the supplier PO sent';
    }
    if(!release)return;
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(poId);});
    if(po&&poBlockUnfundedProFormaRelease(po,label)){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('change',function(event){
    const select=event.target.closest('[data-po-status]');
    if(!select||!['Ready To Email','Sent','Ordered'].includes(String(select.value||'')))return;
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(select.dataset.poStatus):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(select.dataset.poStatus);});
    if(po&&poBlockUnfundedProFormaRelease(po,'moving the PO to '+select.value)){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('submit',function(event){
    const form=event.target.closest('[data-po-payment-form]');
    if(!form)return;
    const poId=form.dataset.poPaymentForm,po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(poId);});
    const gap=po&&poProFormaFundingGap(po);
    if(!gap)return;
    const ok=confirm('This is a Pro Forma supplier and linked customer cash is '+poMoney(gap.shortfall)+' short. Record this supplier payment using internal business funds anyway?');
    if(!ok){
      event.preventDefault();
      event.stopImmediatePropagation();
      purchaseCommandTab='connections';
      if(typeof toast==='function')toast('Supplier payment not recorded. Review the linked Sales Order customer funding first.');
      if(typeof render==='function')render();
    }
  },true);

  function poProFormaFundingGap(po) {
    const state=poSupplierFundingState(po),funding=state&&state.funding,row=state&&state.row;
    if(!funding||!funding.proForma||!row||Number(row.linkedRequirement||0)<=0||Number(row.customerShortfall||0)<=0)return null;
    return {funding:funding,row:row,shortfall:Number(row.customerShortfall||0)};
  }

  function poBlockUnfundedProFormaRelease(po,actionLabel) {
    const gap=poProFormaFundingGap(po);
    if(!gap)return false;
    purchaseCommandTab='connections';
    if(typeof toast==='function')toast('Pro Forma funding shortfall: '+poMoney(gap.shortfall)+' still needs customer funding before '+actionLabel+'.');
    if(typeof render==='function')render();
    return true;
  }

  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-po-save-action],[data-prepare-po-email],[data-send-po-email]');
    if(!button)return;
    let poId='',release=false,label='supplier release';
    if(button.dataset.poSaveAction!==undefined){
      const parts=String(button.dataset.poSaveAction||'').split('|');
      poId=parts[1]||'';
      release=parts[0]==='email';
      label='supplier email preparation';
    }else if(button.dataset.preparePoEmail!==undefined){
      poId=button.dataset.preparePoEmail;release=true;label='supplier email preparation';
    }else if(button.dataset.sendPoEmail!==undefined){
      poId=button.dataset.sendPoEmail;release=true;label='marking the supplier PO sent';
    }
    if(!release)return;
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(poId);});
    if(po&&poBlockUnfundedProFormaRelease(po,label)){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('change',function(event){
    const select=event.target.closest('[data-po-status]');
    if(!select||!['Ready To Email','Sent','Ordered'].includes(String(select.value||'')))return;
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(select.dataset.poStatus):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(select.dataset.poStatus);});
    if(po&&poBlockUnfundedProFormaRelease(po,'moving the PO to '+select.value)){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('submit',function(event){
    const form=event.target.closest('[data-po-payment-form]');
    if(!form)return;
    const poId=form.dataset.poPaymentForm,po=typeof purchaseOrderById==='function'?purchaseOrderById(poId):(data.purchaseOrders||[]).find(function(row){return String(row.id)===String(poId);});
    const gap=po&&poProFormaFundingGap(po);
    if(!gap)return;
    const ok=confirm('This is a Pro Forma supplier and linked customer cash is '+poMoney(gap.shortfall)+' short. Record this supplier payment using internal business funds anyway?');
    if(!ok){
      event.preventDefault();
      event.stopImmediatePropagation();
      purchaseCommandTab='connections';
      if(typeof toast==='function')toast('Supplier payment not recorded. Review the linked Sales Order customer funding first.');
      if(typeof render==='function')render();
    }
  },true);

  bindPurchase = function () {
    if (legacyBindPurchase) legacyBindPurchase();
    bindPurchaseCommand();
  };

  globalThis.purchaseOrderHealth = purchaseOrderHealth;
  globalThis.purchaseDemandSources = purchaseDemandSources;
  globalThis.purchaseCreateSupplierReturn = purchaseCreateSupplierReturn;
  globalThis.purchaseReturnStatusSummary = purchaseReturnStatusSummary;
  globalThis.purchaseOrderLineDeleteAssessment = poLineDeleteAssessment;
  globalThis.removePurchaseOrderLine = removePurchaseOrderLine;
  globalThis.changePurchaseOrderSupplier = changePurchaseOrderSupplier;
  globalThis.bindPurchaseCommand = bindPurchaseCommand;
})();

