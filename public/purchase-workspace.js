[Reading 1000 lines from start (total: 1165 lines, 165 remaining)]

/* Pool Shed Purchase Order Supplier Command authority layer.
   Supplier Order Command with Sales Order layout parity.
   Legacy command labels retained for compatibility: Items & Costing, Demand Sources, Supplier Confirmation, Deliveries & Receipts, Costs & Invoice Match, Returns & Credits, Activity.
   Supplier-side mirror of Sales Order Command.
   Purchasing owns commercial intent; Warehouse owns physical stock truth.
   v2.1.0 */
(function () {
  let purchaseCommandTab = 'items';
  const poListFilters={search:'',supplier:'all',status:'all',payment:'all',receiving:'all',health:'all',expected:'all',link:'all'};
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
    let totals;
    if (typeof purchaseOrderFinancials === 'function') totals=Object.assign({},purchaseOrderFinancials(po)||{});
    else {
      totals=(po.lines||[]).reduce(function(out,line){
        const p=poLineProduct(line)||{};
        const qty=Number(line.qty||0),unit=Number(line.unitCost!=null?line.unitCost:p.cost||0),net=qty*unit;
        let vat=0;
        if(typeof vatAmount==='function') vat=Number(vatAmount(net,{taxCode:line.taxCode||p.taxCode||'20% VAT'})||0);
        else vat=/zero|0%|exempt/i.test(String(line.taxCode||p.taxCode||''))?0:net*.2;
        out.net+=net;out.vat+=vat;out.gross+=net+vat;return out;
      },{net:0,vat:0,gross:0});
      totals.paid=(po.payments||[]).reduce(function(n,payment){return n+Number(payment.amount||0);},0);
    }
    totals.net=Number(totals.net||0);
    totals.vat=Number(totals.vat||0);
    totals.gross=Number(totals.gross!=null?totals.gross:totals.net+totals.vat);
    totals.paid=Number(totals.paid!=null?totals.paid:(po.payments||[]).reduce(function(n,payment){return n+Number(payment.amount||0);},0));
    const credits=poResolvedCreditTotals(po);
    totals.originalNet=totals.net;
    totals.originalVat=totals.vat;
    totals.originalGross=totals.gross;
    totals.creditNet=credits.net;
    totals.creditVat=credits.vat;
    totals.creditGross=credits.gross;
    totals.net=Math.max(0,totals.net-credits.net);
    totals.vat=Math.max(0,totals.vat-credits.vat);
    totals.gross=Math.max(0,totals.gross-credits.gross);
    totals.balance=totals.gross-totals.paid;
    Object.keys(totals).forEach(function(key){if(typeof totals[key]==='number')totals[key]=Math.round(Number(totals[key]||0)*100)/100;});
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
    const key=String(po&&po.status||'Draft - Review');
    const authority=window.PoolShedStatusAuthority;
    if(authority&&typeof authority.purchaseDisplay==='function')return authority.purchaseDisplay(key)||key;
    return key;
  }

  function poStatusColour(po) {
    const authority=window.PoolShedStatusAuthority,key=String(po&&po.status||'Draft - Review');
    if(authority&&typeof authority.colour==='function')return authority.colour('purchase',key)||'#5C6971';
    return '#5C6971';
  }

  function poStatusTextColour(hex) {
    const h=String(hex||'#5C6971').replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(h))return '#FFFFFF';
    const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
    return ((r*299+g*587+b*114)/1000)>150?'#0F1B24':'#FFFFFF';
  }

  function poStatusPill(po) {
    const colour=poStatusColour(po);
    return '<span class="po-command-pill" style="background:'+poEsc(colour)+';color:'+poEsc(poStatusTextColour(colour))+';border-color:'+poEsc(colour)+'">'+poEsc(poStatusText(po))+'</span>';
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
    const statusControl=typeof purchaseOrderStatusPicker==='function'?purchaseOrderStatusPicker(po,'hero'):poStatusPill(po);
    return '<section class="po-command-card"><div class="po-command-card-head"><div><span>Purchase Order</span><h3>Order details</h3></div></div><div class="po-fields"><label>Status<div class="po-status-field">' + statusControl + '</div></label><label>Created<input type="date" data-po-field="' + poEsc(po.id) + '|created" value="' + poEsc(po.created || po.orderedDate || poToday()) + '"></label><label>Expected<input type="date" data-po-field="' + poEsc(po.id) + '|due" value="' + poEsc(po.due || '') + '"></label><label>Supplier reference<input data-po-field="' + poEsc(po.id) + '|supplierReference" value="' + poEsc(po.supplierReference || po.supplierRef || '') + '" placeholder="Supplier confirmation / order ref"></label><label>Delivery<select data-po-field="' + poEsc(po.id) + '|deliveryMethod"><option' + ((po.deliveryMethod || 'Warehouse') === 'Warehouse' ? ' selected' : '') + '>Warehouse</option><option' + (po.deliveryMethod === 'Direct to Project/Site' ? ' selected' : '') + '>Direct to Project/Site</option><option' + (po.deliveryMethod === 'Drop Ship to Customer' ? ' selected' : '') + '>Drop Ship to Customer</option></select></label></div></section>';
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
    const credits=poResolvedCreditTotals(po);
    const ordered = Math.max(0,poOrderValue(po)-credits.net);
    const confirmed = Math.max(0,poConfirmedValue(po)-credits.net);
    const receivedRaw = (po.lines || []).reduce(function(total,line){return total + Number(line.received||0) * Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : poLineCost(line));},0);
    const receivedValue=Math.max(0,receivedRaw-credits.net);
    const invoiceRaw = Number(po.supplierInvoiceTotal || 0);
    const invoice = Math.max(0,invoiceRaw-credits.net);
    const variance = invoiceRaw ? invoice - receivedValue : 0;
    return '<div class="po-cost-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Three-way invoice match</h3><p>Compare the Purchase Order, physical receipts, completed credits and supplier invoice before Accounting export.</p></div></div><div class="po-match-grid"><div><span>PO net after credits</span><strong>' + poMoney(ordered) + '</strong></div><div><span>Supplier confirmed</span><strong>' + poMoney(confirmed) + '</strong></div><div><span>Received net after credits</span><strong>' + poMoney(receivedValue) + '</strong></div><div><span>Completed credits</span><strong>' + poMoney(credits.net) + '</strong></div><div><span>Supplier invoice net position</span><strong>' + (invoiceRaw ? poMoney(invoice) : 'Not entered') + '</strong></div><div><span>Variance</span><strong class="' + (Math.abs(variance) > 0.01 ? 'bad-text' : 'good-text') + '">' + poMoney(variance) + '</strong></div></div><div class="po-fields"><label>Supplier invoice reference<input data-po-field="' + poEsc(po.id) + '|supplierInvoiceRef" value="' + poEsc(po.supplierInvoiceRef || '') + '"></label><label>Supplier invoice total<input type="number" step="0.01" min="0" data-po-field="' + poEsc(po.id) + '|supplierInvoiceTotal" value="' + Number(po.supplierInvoiceTotal || 0).toFixed(2) + '"></label><label>Match status<select data-po-field="' + poEsc(po.id) + '|invoiceMatchStatus"><option' + ((po.invoiceMatchStatus||'Needs review')==='Needs review'?' selected':'') + '>Needs review</option><option' + (po.invoiceMatchStatus==='Matched'?' selected':'') + '>Matched</option><option' + (po.invoiceMatchStatus==='Approved variance'?' selected':'') + '>Approved variance</option></select></label></div></section></div>';
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

  function poReturnLine(po,row) {
    if(!po||!row)return null;
    return (po.lines||[]).find(function(line){
      const token=String(line.receiptLineId||line.productId||'');
      return token===String(row.lineId||'') || String(line.productId||'')===String(row.productId||'');
    })||null;
  }

  function poReturnTreatment(line) {
    const p=line?poLineProduct(line):null;
    const words=[line&&line.receivingTreatment,line&&line.purchaseCategory,line&&line.description,p&&p.name,p&&p.category,p&&p.brand].filter(Boolean).join(' ').toLowerCase();
    const nonStock=!!(line&&(line.nonStockPurchase||line.lineType==='custom-purchase'||/non-stock|service|hire|labour|installation|delivery|freight|professional|crane/.test(words)));
    return {nonStock:nonStock,label:nonStock?'Service / non-stock':'Physical stock'};
  }

  function poReturnMatchesLine(row,po,line) {
    if(!row||!po||!line||String(row.poId||'')!==String(po.id||''))return false;
    const lineToken=String(line.receiptLineId||line.productId||'');
    return String(row.lineId||'')===lineToken || String(row.productId||'')===String(line.productId||'');
  }

  function poReturnConsumedQty(po,line,excludeId) {
    return (data.purchaseReturns||[]).filter(function(row){
      return row.id!==excludeId && row.status!=='Cancelled' && poReturnMatchesLine(row,po,line);
    }).reduce(function(n,row){return n+Number(row.qty||0);},0);
  }

  function poReturnCreditParts(line,net,vatOverride) {
    const value=Math.max(0,Number(net||0));
    const p=line?poLineProduct(line):{};
    const vat=vatOverride==null?Math.max(0,Number(poLineVat(line||{},p||{},value)||0)):Math.max(0,Number(vatOverride||0));
    return {net:Math.round(value*100)/100,vat:Math.round(vat*100)/100,gross:Math.round((value+vat)*100)/100};
  }

  function poResolvedCreditTotals(po) {
    const totals={net:0,vat:0,gross:0,count:0};
    (data.purchaseReturns||[]).filter(function(row){return String(row.poId||'')===String(po&&po.id||'')&&row.status==='Closed'&&!row.voidedAt;}).forEach(function(row){
      const line=poReturnLine(po,row),parts=poReturnCreditParts(line,row.creditNet!=null?row.creditNet:(row.creditAmount!=null?row.creditAmount:row.expectedCredit),row.creditVat);
      totals.net+=parts.net;totals.vat+=parts.vat;totals.gross+=row.creditGross!=null?Number(row.creditGross||0):parts.gross;totals.count++;
    });
    totals.net=Math.round(totals.net*100)/100;totals.vat=Math.round(totals.vat*100)/100;totals.gross=Math.round(totals.gross*100)/100;
    return totals;
  }

  function poReturnHeldStock(row) {
    if(!row||row.dispatchedAt||row.status==='Cancelled')return 0;
    if(row.stockHeld===false)return 0;
    const hold=(data.stock||[]).find(function(item){return String(item.productId||'')===String(row.productId||'')&&item.locationId==='L-RETURNS-HOLD';});
    return Math.min(Number(row.qty||0),Math.max(0,Number(hold&&hold.qty||0)));
  }

  function poMoveReturnHoldOut(row,destination,note) {
    const qty=poReturnHeldStock(row);
    if(qty<=0){row.stockHeld=false;return {ok:true,qty:0};}
    const hold=(data.stock||[]).find(function(item){return String(item.productId||'')===String(row.productId||'')&&item.locationId==='L-RETURNS-HOLD';});
    if(!hold||Number(hold.qty||0)<qty)return {ok:false,error:'The Returns Hold quantity no longer matches this return. Review stock before completing it.'};
    if(typeof removeStock==='function'){
      if(!removeStock(row.productId,'L-RETURNS-HOLD',qty))return {ok:false,error:'The Returns Hold stock could not be removed.'};
    }else hold.qty=Math.max(0,Number(hold.qty||0)-qty);
    if(destination){
      if(typeof addStock==='function')addStock(row.productId,destination,qty,0);
      else {
        let target=(data.stock||[]).find(function(item){return item.productId===row.productId&&item.locationId===destination;});
        if(!target){target={productId:row.productId,locationId:destination,qty:0,allocated:0};data.stock.push(target);}
        target.qty=Number(target.qty||0)+qty;
      }
    }
    if(typeof addMovement==='function')addMovement(destination?'Supplier Return Cancelled':'Supplier Return Dispatch',row.productId,qty,'L-RETURNS-HOLD',destination||'SUPPLIER',row.id,(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing',note||row.poId);
    row.stockHeld=false;
    return {ok:true,qty:qty};
  }

  function poReturnAudit(action,row,reason,previousValue,newValue) {
    data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
    const at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing';
    data.auditLog.push({id:'AUD-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),date:at,user:user,action:action,product:row.poId,previousValue:previousValue||'',newValue:newValue||row.id,reason:reason||row.reason||''});
    row.updatedAt=at;row.updatedBy=user;
  }

  function purchaseCreateSupplierReturn(input) {
    input = input || {};
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(input.poId) : (data.purchaseOrders || []).find(function(row){return row.id===input.poId;});
    if (!po) return {ok:false,error:'Purchase Order not found.'};
    const line = (po.lines || []).find(function(row){return String(row.productId||'')===String(input.productId||'')||String(row.receiptLineId||'')===String(input.productId||'');});
    if (!line) return {ok:false,error:'Product or service is not on this Purchase Order.'};
    const qty = Math.max(0,Number(input.qty||0));
    if (!Number.isFinite(qty)||qty<=0) return {ok:false,error:'Enter a return quantity.'};
    const received=Math.max(0,Number(line.received||0)),already=poReturnConsumedQty(po,line,'');
    if(qty>Math.max(0,received-already)+0.00001)return {ok:false,error:'Only ' + Math.max(0,received-already) + ' received unit(s) remain available for return / credit.'};
    const reason = String(input.reason || '').trim();
    if (!reason) return {ok:false,error:'Choose a return reason.'};
    const treatment=poReturnTreatment(line),sourceLocation = input.locationId || 'L-WH-A1';
    let stockHeld=false;
    if(!treatment.nonStock){
      const stockRow = (data.stock || []).find(function(row){return String(row.productId||'')===String(line.productId||'') && row.locationId===sourceLocation;});
      const free = stockRow ? (typeof available === 'function' ? Number(available(stockRow)||0) : Math.max(0,Number(stockRow.qty||0)-Number(stockRow.allocated||0))) : 0;
      if (free < qty) return {ok:false,error:'Only ' + free + ' free unit(s) are available to return from this location.'};
      ensureReturnsHoldLocation();
      if (typeof removeStock === 'function') {
        if (!removeStock(line.productId, sourceLocation, qty)) return {ok:false,error:'Stock could not be moved to Returns Hold.'};
      } else stockRow.qty = Number(stockRow.qty||0)-qty;
      if (typeof addStock === 'function') addStock(line.productId,'L-RETURNS-HOLD',qty,0);
      else {
        let hold=(data.stock||[]).find(function(row){return row.productId===line.productId&&row.locationId==='L-RETURNS-HOLD';});
        if(!hold){hold={productId:line.productId,locationId:'L-RETURNS-HOLD',qty:0,allocated:0};data.stock.push(hold);} hold.qty+=qty;
      }
      stockHeld=true;
    }
    data.purchaseReturns = data.purchaseReturns || [];
    const net=Math.round(poLineCost(line)*qty*100)/100,parts=poReturnCreditParts(line,net),now=new Date().toISOString();
    const record={id:nextPurchaseReturnId(),poId:po.id,lineId:String(line.receiptLineId||line.productId||''),receiptId:input.receiptId||'',supplier:po.supplier,productId:line.productId,supplierSku:line.supplierSku || (poLineProduct(line)||{}).supplierSku || '',qty:qty,unitCost:poLineCost(line),expectedCredit:parts.net,expectedVat:parts.vat,expectedGrossCredit:parts.gross,reason:reason,status:'Awaiting Supplier Authorisation',sourceLocationId:treatment.nonStock?'':sourceLocation,holdLocationId:treatment.nonStock?'':'L-RETURNS-HOLD',stockHeld:stockHeld,nonStock:treatment.nonStock,projectId:String(line.projectId||line.jobId||po.projectId||po.jobId||''),salesOrderId:String(line.salesOrderId||''),createdAt:now,createdBy:(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing',rma:'',history:[{at:now,status:'Awaiting Supplier Authorisation',note:reason}]};
    data.purchaseReturns.push(record);
    if (stockHeld && typeof addMovement === 'function') addMovement('Supplier Return Hold',line.productId,qty,sourceLocation,'L-RETURNS-HOLD',record.id,record.createdBy,po.id + ' · ' + reason);
    poReturnAudit('Supplier return / credit case created',record,reason,'',record.status);
    return {ok:true,return:record};
  }

  function purchaseAuthoriseSupplierReturn(returnId,input) {
    const row=(data.purchaseReturns||[]).find(function(item){return item.id===returnId;});
    if(!row)return {ok:false,error:'Supplier return not found.'};
    if(row.status==='Closed'||row.status==='Cancelled')return {ok:false,error:'This return is already closed.'};
    input=input||{};const before=row.status,now=new Date().toISOString();
    row.status='Supplier Authorised';row.authorisedAt=now;row.rma=String(input.rma||row.rma||'').trim();row.supplierAuthorisationNote=String(input.note||'').trim();
    row.history=Array.isArray(row.history)?row.history:[];row.history.push({at:now,status:row.status,note:row.rma?('RMA / authorisation '+row.rma):'Supplier authorised'});
    poReturnAudit('Supplier return authorised',row,row.supplierAuthorisationNote,before,row.status);
    return {ok:true,return:row};
  }

  function purchaseDispatchSupplierReturn(returnId) {
    const row=(data.purchaseReturns||[]).find(function(item){return item.id===returnId;});
    if(!row)return {ok:false,error:'Supplier return not found.'};
    if(row.status==='Closed'||row.status==='Cancelled')return {ok:false,error:'This return is already closed.'};
    const po=(data.purchaseOrders||[]).find(function(item){return String(item.id)===String(row.poId);}),line=poReturnLine(po,row),treatment=poReturnTreatment(line);
    if(treatment.nonStock||row.nonStock){return {ok:false,error:'This is a service / non-stock credit. There is nothing physical to dispatch; record the supplier credit or internal correction instead.'};}
    if(row.status!=='Supplier Authorised'&&row.status!=='Dispatched / Awaiting Credit')return {ok:false,error:'Record supplier authorisation before dispatching the return.'};
    if(row.dispatchedAt)return {ok:true,return:row};
    const moved=poMoveReturnHoldOut(row,'',row.poId+' · '+row.reason);
    if(!moved.ok)return moved;
    const before=row.status,now=new Date().toISOString();row.status='Dispatched / Awaiting Credit';row.dispatchedAt=now;
    row.history=Array.isArray(row.history)?row.history:[];row.history.push({at:now,status:row.status,note:'Returned to supplier'});
    poReturnAudit('Supplier return dispatched',row,row.reason,before,row.status);
    return {ok:true,return:row};
  }

  function purchaseCancelSupplierReturn(returnId,reason) {
    const row=(data.purchaseReturns||[]).find(function(item){return item.id===returnId;});
    if(!row)return {ok:false,error:'Supplier return not found.'};
    if(row.status==='Closed'||row.status==='Cancelled')return {ok:false,error:'This return is already closed.'};
    if(row.dispatchedAt)return {ok:false,error:'This return has already been dispatched. Complete the supplier credit instead of cancelling it.'};
    const before=row.status,why=String(reason||'Return cancelled').trim();
    if(poReturnHeldStock(row)>0){
      const moved=poMoveReturnHoldOut(row,row.sourceLocationId||'L-WH-A1',row.poId+' · '+why);
      if(!moved.ok)return moved;
    }
    const now=new Date().toISOString();row.status='Cancelled';row.cancelledAt=now;row.cancelReason=why;
    row.history=Array.isArray(row.history)?row.history:[];row.history.push({at:now,status:row.status,note:why});
    poReturnAudit('Supplier return cancelled',row,why,before,row.status);
    return {ok:true,return:row};
  }

  function purchaseCompleteSupplierReturn(returnId,input) {
    const row=(data.purchaseReturns||[]).find(function(item){return item.id===returnId;});
    if(!row)return {ok:false,error:'Supplier return not found.'};
    if(row.status==='Closed')return {ok:false,error:'This return / credit is already complete.'};
    if(row.status==='Cancelled')return {ok:false,error:'This return was cancelled.'};
    const po=(data.purchaseOrders||[]).find(function(item){return String(item.id)===String(row.poId);});
    if(!po)return {ok:false,error:'The original Purchase Order could not be found.'};
    const line=poReturnLine(po,row);
    if(!line)return {ok:false,error:'The original Purchase Order line could not be found.'};
    input=input||{};const resolution=String(input.resolutionType||'supplier-credit');
    if(!['supplier-credit','internal-correction'].includes(resolution))return {ok:false,error:'Choose supplier credit or internal correction.'};
    const treatment=poReturnTreatment(line),isNonStock=!!(row.nonStock||treatment.nonStock);
    if(resolution==='supplier-credit'&&!isNonStock&&!row.dispatchedAt)return {ok:false,error:'Dispatch the physical return before recording the supplier credit.'};
    if(resolution==='internal-correction'&&!isNonStock)return {ok:false,error:'Internal correction is reserved for services / non-stock entries made in error. Physical stock must follow the supplier return process.'};
    const netInput=input.creditNet!=null?Number(input.creditNet):Number(row.expectedCredit||0);
    if(!Number.isFinite(netInput)||netInput<0)return {ok:false,error:'Enter a valid credit amount.'};
    const maxNet=Math.max(Number(row.expectedCredit||0),0);
    if(netInput>maxNet+0.01)return {ok:false,error:'Credit cannot exceed the value linked to this return ('+poMoney(maxNet)+').'};
    const parts=poReturnCreditParts(line,netInput,input.creditVat);
    if(poReturnHeldStock(row)>0){
      const moved=poMoveReturnHoldOut(row,'',row.poId+' · '+(resolution==='internal-correction'?'Internal correction':'Supplier credit'));
      if(!moved.ok)return moved;
      if(!row.dispatchedAt)row.dispatchedAt=new Date().toISOString();
    }
    const before=row.status,now=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing';
    row.status='Closed';row.closedAt=now;row.closedBy=user;row.resolutionType=resolution;row.creditNet=parts.net;row.creditVat=parts.vat;row.creditGross=parts.gross;row.creditAmount=parts.net;row.creditReference=String(input.creditReference||'').trim();row.creditDate=String(input.creditDate||poToday());row.resolutionNote=String(input.note||'').trim();row.nonStock=isNonStock;
    row.history=Array.isArray(row.history)?row.history:[];row.history.push({at:now,status:'Closed',note:(resolution==='internal-correction'?'Internal correction':'Supplier credit')+(row.creditReference?' · '+row.creditReference:'')+' · '+poMoney(parts.net)+' net'});
    line.creditedQty=Math.round((Number(line.creditedQty||0)+Number(row.qty||0))*1000)/1000;
    line.creditedNet=Math.round((Number(line.creditedNet||0)+parts.net)*100)/100;
    line.creditHistory=Array.isArray(line.creditHistory)?line.creditHistory:[];
    line.creditHistory.push({returnId:row.id,at:now,type:resolution,qty:Number(row.qty||0),net:parts.net,vat:parts.vat,gross:parts.gross,reference:row.creditReference,user:user});
    if(resolution==='supplier-credit'){
      po.supplierCredits=Array.isArray(po.supplierCredits)?po.supplierCredits:[];
      po.supplierCredits.push({id:'POCREDIT-'+Date.now(),returnId:row.id,poId:po.id,supplier:po.supplier,amount:parts.net,net:parts.net,vat:parts.vat,gross:parts.gross,reference:row.creditReference,date:row.creditDate,status:'Applied to PO',createdAt:now,createdBy:user});
      data.financeCommand=data.financeCommand&&typeof data.financeCommand==='object'?data.financeCommand:{};
      data.financeCommand.supplierCredits=Array.isArray(data.financeCommand.supplierCredits)?data.financeCommand.supplierCredits:[];
      if(!data.financeCommand.supplierCredits.some(function(item){return item.returnId===row.id;}))data.financeCommand.supplierCredits.push({id:'SC-'+Date.now(),returnId:row.id,poId:po.id,supplier:po.supplier,amount:parts.gross,remaining:0,net:parts.net,vat:parts.vat,gross:parts.gross,reference:row.creditReference,date:row.creditDate,status:'Applied to PO',createdAt:now});
    }else{
      po.returnCorrections=Array.isArray(po.returnCorrections)?po.returnCorrections:[];
      po.returnCorrections.push({id:'POCORR-'+Date.now(),returnId:row.id,poId:po.id,amount:parts.net,net:parts.net,vat:parts.vat,gross:parts.gross,reason:row.resolutionNote||row.reason,date:row.creditDate,createdAt:now,createdBy:user});
    }
    po.invoiceMatchStatus='Needs review';
    poReturnAudit(resolution==='internal-correction'?'Purchase receipt/cost internally corrected':'Supplier credit completed',row,row.resolutionNote||row.reason,before,'Closed · '+poMoney(parts.net)+' net');
    return {ok:true,return:row,po:po,credit:parts};
  }

  function purchaseReturnStatusSummary(po) {
    const rows=(data.purchaseReturns||[]).filter(function(row){return !po || String(row.poId||'')===String(po.id||'');});
    const openRows=rows.filter(function(row){return !['Closed','Cancelled'].includes(row.status);});
    const closedRows=rows.filter(function(row){return row.status==='Closed'&&!row.voidedAt;});
    return {count:rows.length,open:openRows.length,expectedCredit:openRows.reduce(function(n,row){return n+Number(row.expectedCredit||0);},0),resolvedCredit:closedRows.reduce(function(n,row){return n+Number(row.creditNet!=null?row.creditNet:row.expectedCredit||0);},0)};
  }

  function poReturnActionButtons(po,row) {
    if(!row)return '';
    const line=poReturnLine(po,row),isNonStock=!!(row.nonStock||poReturnTreatment(line).nonStock),id=poEsc(row.id);
    if(row.status==='Closed')return '<span class="po-return-resolution"><strong>'+poEsc(row.resolutionType==='internal-correction'?'Corrected internally':'Credit completed')+'</strong><small>'+poEsc(row.creditReference||row.creditDate||'Closed')+'</small></span>';
    if(row.status==='Cancelled')return '<span class="muted">Cancelled</span>';
    let actions='';
    if(row.status==='Awaiting Supplier Authorisation')actions+='<button type="button" class="secondary" data-po-return-action="authorise|'+id+'">Supplier authorised</button>';
    if(row.status==='Supplier Authorised'&&!isNonStock)actions+='<button type="button" class="secondary" data-po-return-action="dispatch|'+id+'">Mark dispatched</button>';
    if((row.status==='Supplier Authorised'&&isNonStock)||row.status==='Dispatched / Awaiting Credit')actions+='<button type="button" class="primary" data-po-return-action="credit|'+id+'">Record supplier credit</button>';
    if(isNonStock&&row.status!=='Dispatched / Awaiting Credit')actions+='<button type="button" class="secondary" data-po-return-action="correct|'+id+'">Internal correction</button>';
    if(!row.dispatchedAt)actions+='<button type="button" class="danger-button" data-po-return-action="cancel|'+id+'">Cancel</button>';
    return '<div class="po-return-actions">'+actions+'</div>';
  }

  function poReturnsTab(po) {
    const returns=(data.purchaseReturns||[]).filter(function(row){return String(row.poId||'')===String(po.id||'');});
    const rows=returns.map(function(row){
      const line=poReturnLine(po,row),p=line?poLineProduct(line):(poProduct(row.productId)||{sku:row.supplierSku||row.productId,name:row.productId});
      const detail=row.status==='Closed'?((row.resolutionType==='internal-correction'?'Internal correction':'Supplier credit')+(row.creditReference?' · '+row.creditReference:'')+' · '+poMoney(row.creditNet!=null?row.creditNet:row.expectedCredit)+' net'):(row.nonStock||poReturnTreatment(line).nonStock?'Service / non-stock':'Physical return');
      return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.createdAt||'') + '</small></td><td><strong>' + poEsc(p.sku||row.supplierSku||row.productId) + '</strong><small>' + poEsc(p.name||row.productId) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '<small>'+poEsc(detail)+'</small></td><td>' + poPill(row.status,row.status==='Closed'?'good':row.status==='Cancelled'?'bad':'warn') + '</td><td class="right">' + poMoney(row.status==='Closed'?(row.creditNet!=null?row.creditNet:row.expectedCredit):row.expectedCredit) + '</td><td>'+poReturnActionButtons(po,row)+'</td></tr>';
    }).join('') || '<tr><td colspan="7" class="po-empty">No supplier returns or credits have been created for this PO.</td></tr>';
    const returnable=(po.lines||[]).filter(function(line){return Number(line.received||0)-poReturnConsumedQty(po,line,'')>0;});
    const productOptions=returnable.map(function(line){const p=poLineProduct(line),remaining=Math.max(0,Number(line.received||0)-poReturnConsumedQty(po,line,''));return '<option value="' + poEsc(line.receiptLineId||line.productId) + '">' + poEsc((p.sku||line.productId) + ' · ' + (p.name||'Item') + ' · '+remaining+' returnable') + '</option>';}).join('');
    const locationOptions=(data.locations||[]).filter(function(loc){return !['L-RECEIVING','L-QUARANTINE','L-RETURNS-HOLD'].includes(loc.id);}).map(function(loc){return '<option value="' + poEsc(loc.id) + '">' + poEsc(loc.name) + '</option>';}).join('');
    const receipts=(data.receiptEvents||[]).filter(function(event){return String(event.poId||'')===String(po.id||'');}).map(function(event){return '<option value="' + poEsc(event.id) + '">' + poEsc(event.id + ' · ' + (event.supplierReference||'No supplier ref')) + '</option>';}).join('');
    const create=returnable.length?'<div class="po-return-form" data-po-return-form="' + poEsc(po.id) + '"><label>Product / service<select data-po-return-product>' + productOptions + '</select></label><label>Quantity<input type="number" min="0.01" step="0.01" value="1" data-po-return-qty></label><label>Reason<select data-po-return-reason><option>Mis-ordered by Pool Bros</option><option>Wrong quantity ordered</option><option>Supplier sent wrong item</option><option>Supplier sent excess quantity</option><option>Damaged on arrival</option><option>Faulty / warranty</option><option>Duplicate delivery</option><option>Duplicate cost / entered in error</option><option>No longer required</option><option>Incorrect specification</option><option>Other</option></select></label><label>Current location<select data-po-return-location><option value="">Not applicable / service</option>' + locationOptions + '</select></label><label>Receipt / GRN<select data-po-return-receipt><option value="">Not specified</option>' + receipts + '</select></label><button type="button" class="primary" data-po-create-return="' + poEsc(po.id) + '">Create return / credit case</button></div>':'<div class="po-empty">No received quantity remains available for a new return or credit.</div>';
    return '<div class="po-returns-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier Returns & Credits</h3><p>Complete the whole correction here. Physical returns move through Returns Hold; service and non-stock mistakes can be corrected without inventing stock movements.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Credit net</th><th>Next action</th></tr></thead><tbody>' + rows + '</tbody></table></div></section><aside class="po-work-card po-return-create"><div class="po-work-card-head"><div><h3>Create return / credit</h3><p>Use one linked case from receipt through supplier credit or internal correction.</p></div></div>'+create+'<div class="po-rule-banner"><strong>Linked correction</strong><p>When completed, the credit is applied back to the original PO and Project cost position while the original receipt remains in the audit trail.</p></div></aside></div>';
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
    (data.purchaseReturns||[]).filter(function(row){return row.poId===po.id;}).forEach(function(row){events.push({date:row.closedAt||row.dispatchedAt||row.authorisedAt||row.createdAt||'',type:'Return / credit',detail:row.id + ' · ' + row.reason + ' · ' + row.qty + ' unit(s) · ' + (row.status||'Open') + (row.status==='Closed'?' · '+(row.resolutionType==='internal-correction'?'internal correction':'supplier credit')+' '+poMoney(row.creditNet!=null?row.creditNet:row.expectedCredit):'')});});
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
    return '<div class="purchase-command-page po-sales-parity"><header class="po-command-head"><div class="po-command-title"><button type="button" class="secondary" data-back-po-list="true">← Purchase Orders</button><div><div class="po-command-kicker">PURCHASE ORDER</div><h1>' + poEsc(po.id) + ' ' + poStatusPill(po) + '</h1><p>' + poEsc(po.supplier || 'Supplier to confirm') + ' · Expected ' + poEsc(po.due || 'not set') + ' · ' + summary.pending + ' units outstanding</p></div></div><div class="po-command-actions"><button type="button" class="secondary" data-po-save-action="email|' + poEsc(po.id) + '">Email / Print</button><button type="button" class="secondary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery</button><button type="button" class="danger-button" data-delete-po="' + poEsc(po.id) + '">Delete PO</button><button type="button" class="primary" data-po-save-action="save|' + poEsc(po.id) + '">Save PO</button></div></header>' +
      '<section class="po-health-bar"><div><span>PO health</span><strong>' + poEsc(health.label) + '</strong><small>' + poEsc(health.detail) + '</small></div><div><span>Ordered</span><strong>' + summary.ordered + '</strong><small>' + poMoney(financials.net) + ' net</small></div><div><span>Received</span><strong>' + summary.received + '</strong><small>' + summary.pending + ' pending</small></div><div><span>Supplier payment</span><strong>' + poEsc(paymentState) + '</strong><small>' + poMoney(financials.paid) + ' paid</small></div><div><span>Balance due</span><strong>' + poMoney(Math.max(0,financials.balance)) + '</strong><small>' + poMoney(financials.gross) + ' inc VAT</small></div></section>' +
      '<section class="po-command-summary">' + poSupplierCard(po,supplier) + poDetailsCard(po) + poInboundCard(po) + '</section>' + poCommandTabs(po) + '<main class="po-command-body">' + poTabContent(po) + '</main></div>';
  };

  function poFilterToday(){return new Date().toISOString().slice(0,10);}
  function poFilterDateDistance(date){
    if(!date)return null;
    const today=new Date(poFilterToday()+'T00:00:00Z'),target=new Date(String(date).slice(0,10)+'T00:00:00Z');
    if(Number.isNaN(target.getTime()))return null;
    return Math.round((target-today)/86400000);
  }
  function poFilterLinks(po){
    const lines=Array.isArray(po.lines)?po.lines:[];
    return {
      sales:lines.some(function(line){return !!String(line.salesOrderId||po.originalSalesOrderId||'').trim();}),
      project:lines.some(function(line){return !!String(line.projectId||line.jobId||po.projectId||po.jobId||'').trim();})||!!String(po.projectId||po.jobId||'').trim(),
      custom:lines.some(function(line){return !!(line.nonStockPurchase||line.lineType==='custom-purchase');})
    };
  }
  function poMatchesListFilters(po){
    const summary=poSummarySafe(po),health=purchaseOrderHealth(po),payment=poPaymentState(po),status=poStatusText(po),links=poFilterLinks(po);
    const search=String(poListFilters.search||'').trim().toLowerCase();
    if(search){
      const lineText=(po.lines||[]).map(function(line){return [line.salesOrderId,line.projectId,line.jobId,line.supplierSku,line.customProductName,line.description].join(' ');}).join(' ');
      const haystack=[po.id,po.supplier,po.source,po.supplierReference,po.supplierRef,po.projectId,po.jobId,po.originalSalesOrderId,lineText].join(' ').toLowerCase();
      if(!haystack.includes(search))return false;
    }
    if(poListFilters.supplier!=='all'&&String(po.supplier||'')!==poListFilters.supplier)return false;
    if(poListFilters.status!=='all'&&status!==poListFilters.status)return false;
    if(poListFilters.payment!=='all'&&payment!==poListFilters.payment)return false;
    if(poListFilters.health!=='all'&&health.tone!==poListFilters.health)return false;
    if(poListFilters.receiving!=='all'){
      const received=Number(summary.received||0),pending=Number(summary.pending||0);
      if(poListFilters.receiving==='not-received'&&received!==0)return false;
      if(poListFilters.receiving==='partial'&&!(received>0&&pending>0))return false;
      if(poListFilters.receiving==='outstanding'&&pending<=0)return false;
      if(poListFilters.receiving==='received'&&pending>0)return false;
    }
    if(poListFilters.expected!=='all'){
      const distance=poFilterDateDistance(po.due);
      if(poListFilters.expected==='no-date'&&distance!==null)return false;
      if(poListFilters.expected==='overdue'&&!(distance!==null&&distance<0&&summary.pending>0))return false;
      if(poListFilters.expected==='today'&&distance!==0)return false;
      if(poListFilters.expected==='7-days'&&!(distance!==null&&distance>=0&&distance<=7))return false;
      if(poListFilters.expected==='30-days'&&!(distance!==null&&distance>=0&&distance<=30))return false;
    }
    if(poListFilters.link!=='all'){
      if(poListFilters.link==='sales-order'&&!links.sales)return false;
      if(poListFilters.link==='project'&&!links.project)return false;
      if(poListFilters.link==='custom'&&!links.custom)return false;
      if(poListFilters.link==='unlinked'&&(links.sales||links.project))return false;
    }
    return true;
  }
  function poListFilterOptions(items,selected,label){
    return '<option value="all">'+poEsc(label)+'</option>'+items.map(function(value){return '<option value="'+poEsc(value)+'"'+(value===selected?' selected':'')+'>'+poEsc(value)+'</option>';}).join('');
  }
  function poListFiltersActive(){
    return Object.keys(poListFilters).some(function(key){return key==='search'?Boolean(String(poListFilters[key]||'').trim()):poListFilters[key]!=='all';});
  }
  function poListFilterBar(all,filtered){
    const suppliers=Array.from(new Set(all.map(function(po){return po.supplier||'Supplier to confirm';}))).sort();
    const statuses=Array.from(new Set(all.map(function(po){return poStatusText(po);}))).sort();
    return '<section class="po-list-filter-shell">'+
      '<div class="po-list-filter-heading"><div><span>FILTER PURCHASE ORDERS</span><strong>Find exactly the orders you need</strong><small>Supplier, status, payment, receiving, health, due date and linked demand.</small></div><div class="po-list-filter-count"><strong>'+filtered.length+'</strong><span>of '+all.length+' shown</span></div></div>'+
      '<div class="po-list-filters">'+
        '<label class="po-filter-search"><span>Search</span><div><input id="poListFilterSearch" value="'+poEsc(poListFilters.search)+'" placeholder="PO, supplier, reference, Sales Order or Project"><button type="button" class="secondary" data-po-apply-filter-search="true">Search</button></div></label>'+
        '<label><span>Supplier</span><select data-po-list-filter="supplier">'+poListFilterOptions(suppliers,poListFilters.supplier,'All suppliers')+'</select></label>'+
        '<label><span>Status</span><select data-po-list-filter="status">'+poListFilterOptions(statuses,poListFilters.status,'All statuses')+'</select></label>'+
        '<label><span>Payment</span><select data-po-list-filter="payment"><option value="all">All payments</option><option value="Unpaid"'+(poListFilters.payment==='Unpaid'?' selected':'')+'>Unpaid</option><option value="Part Paid"'+(poListFilters.payment==='Part Paid'?' selected':'')+'>Part paid</option><option value="Paid"'+(poListFilters.payment==='Paid'?' selected':'')+'>Paid</option><option value="Overpaid"'+(poListFilters.payment==='Overpaid'?' selected':'')+'>Overpaid</option><option value="Unvalued"'+(poListFilters.payment==='Unvalued'?' selected':'')+'>Unvalued</option></select></label>'+
        '<label><span>Receiving</span><select data-po-list-filter="receiving"><option value="all">All receiving</option><option value="outstanding"'+(poListFilters.receiving==='outstanding'?' selected':'')+'>Outstanding</option><option value="not-received"'+(poListFilters.receiving==='not-received'?' selected':'')+'>Not received</option><option value="partial"'+(poListFilters.receiving==='partial'?' selected':'')+'>Part received</option><option value="received"'+(poListFilters.receiving==='received'?' selected':'')+'>Fully received</option></select></label>'+
        '<label><span>Health</span><select data-po-list-filter="health"><option value="all">All health</option><option value="bad"'+(poListFilters.health==='bad'?' selected':'')+'>At risk</option><option value="warn"'+(poListFilters.health==='warn'?' selected':'')+'>Needs attention</option><option value="good"'+(poListFilters.health==='good'?' selected':'')+'>Healthy</option><option value="info"'+(poListFilters.health==='info'?' selected':'')+'>Information</option></select></label>'+
        '<label><span>Expected</span><select data-po-list-filter="expected"><option value="all">Any expected date</option><option value="overdue"'+(poListFilters.expected==='overdue'?' selected':'')+'>Overdue</option><option value="today"'+(poListFilters.expected==='today'?' selected':'')+'>Due today</option><option value="7-days"'+(poListFilters.expected==='7-days'?' selected':'')+'>Next 7 days</option><option value="30-days"'+(poListFilters.expected==='30-days'?' selected':'')+'>Next 30 days</option><option value="no-date"'+(poListFilters.expected==='no-date'?' selected':'')+'>No date</option></select></label>'+
        '<label><span>Linked to</span><select data-po-list-filter="link"><option value="all">All demand</option><option value="sales-order"'+(poListFilters.link==='sales-order'?' selected':'')+'>Sales Order</option><option value="project"'+(poListFilters.link==='project'?' selected':'')+'>Project</option><option value="custom"'+(poListFilters.link==='custom'?' selected':'')+'>Custom PO lines</option><option value="unlinked"'+(poListFilters.link==='unlinked'?' selected':'')+'>General / unlinked</option></select></label>'+
      '</div>'+
      '<div class="po-list-filter-footer"><div class="po-list-quick-filters"><button type="button" class="secondary" data-po-quick-filter="open">Open only</button><button type="button" class="secondary" data-po-quick-filter="attention">Needs attention</button><button type="button" class="secondary" data-po-quick-filter="unpaid">Unpaid</button><button type="button" class="secondary" data-po-quick-filter="overdue">Overdue</button></div>'+
      (poListFiltersActive()?'<button type="button" class="secondary po-clear-filters" data-po-clear-filters="true">Clear all filters</button>':'')+
      '</div></section>';
  }

  purchaseOrderListPage = function () {
    const all=(data.purchaseOrders||[]).slice();
    const filtered=all.filter(poMatchesListFilters);
    const sorted=filtered.slice().sort(function(a,b){const ha=purchaseOrderHealth(a),hb=purchaseOrderHealth(b);const rank={bad:0,warn:1,info:2,good:3};return rank[ha.tone]-rank[hb.tone] || String(a.due||'9999').localeCompare(String(b.due||'9999'));});
    const rows=sorted.map(function(po){const summary=poSummarySafe(po),health=purchaseOrderHealth(po),financials=poFinancialsSafe(po),paymentState=poPaymentState(po),deleteState=typeof purchaseOrderDeleteAssessment==='function'?purchaseOrderDeleteAssessment(po):{allowed:summary.received===0};return '<tr><td><button class="link-button" data-open-po-detail="' + poEsc(po.id) + '"><strong>' + poEsc(po.id) + '</strong></button><small>' + poEsc(po.source||'Manual PO') + '</small></td><td><strong>' + poEsc(po.supplier||'Supplier to confirm') + '</strong><small>' + poEsc((poSupplier(po.supplier).ordersEmail||poSupplier(po.supplier).email||'')) + '</small></td><td>' + poPill(health.label,health.tone) + '<small>' + poEsc(health.detail) + '</small></td><td>' + poStatusPill(po) + '</td><td>' + summary.received + '/' + summary.ordered + '<small>' + summary.pending + ' outstanding</small></td><td>' + poEsc(po.due||'Not set') + '</td><td>' + poPill(paymentState,paymentState==='Paid'?'good':paymentState==='Part Paid'?'warn':paymentState==='Overpaid'?'info':'bad') + '<small>' + poMoney(Math.max(0,financials.balance)) + ' due</small></td><td class="right"><strong>' + poMoney(financials.gross) + '</strong><small>' + poMoney(financials.net) + ' net</small></td><td><div class="po-list-actions"><button type="button" class="primary" data-open-po-detail="' + poEsc(po.id) + '">Open</button>' + (deleteState.allowed?'<button type="button" class="danger-button" data-delete-po="' + poEsc(po.id) + '">Delete</button>':'') + '</div></td></tr>';}).join('') || '<tr><td colspan="9" class="po-empty">'+(poListFiltersActive()?'No Purchase Orders match these filters. Clear or change a filter to see more orders.':'No Purchase Orders yet.')+'</td></tr>';
    const open=filtered.filter(function(po){return !['Received','Cancelled'].includes(po.status);});
    const pending=open.reduce(function(n,po){return n+poSummarySafe(po).pending;},0);
    const risks=open.filter(function(po){return ['bad','warn'].includes(purchaseOrderHealth(po).tone);}).length;
    const outstanding=open.reduce(function(n,po){return n+Math.max(0,poFinancialsSafe(po).balance);},0);
    const supplierCount=new Set(filtered.map(function(po){return po.supplier||'Supplier to confirm';})).size;
    return '<div class="purchase-command-page purchase-command-list po-sales-parity"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING</div><h1>Purchase Orders</h1><p>Supplier orders, commitments, receipts, payments, credits and invoice matching in one workflow.</p></div><div class="po-command-actions"><button type="button" class="primary" data-create-po-draft="true">New Purchase Order</button></div></header>'+
      '<section class="po-health-bar"><div><span>Open POs</span><strong>' + open.length + '</strong><small>in this view</small></div><div><span>Inbound units</span><strong>' + pending + '</strong><small>still expected</small></div><div><span>Needs attention</span><strong>' + risks + '</strong><small>in this view</small></div><div><span>Outstanding to suppliers</span><strong>' + poMoney(outstanding) + '</strong><small>filtered open balances</small></div><div><span>Suppliers</span><strong>' + supplierCount + '</strong><small>'+filtered.length+' of '+all.length+' POs shown</small></div></section>'+
      poListFilterBar(all,filtered)+
      '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Purchase Orders</h3><p>Showing '+filtered.length+' of '+all.length+' Purchase Orders. Open an order for receiving, payment, credits and supplier control.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>PO</th><th>Supplier</th><th>Health</th><th>Status</th><th>Receiving</th><th>Expected</th><th>Payment</th><th class="right">Total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
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
    const rows=(data.purchaseReturns||[]).slice().sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));}).map(function(row){const po=(data.purchaseOrders||[]).find(function(item){return String(item.id)===String(row.poId);}),line=poReturnLine(po,row),p=line?poLineProduct(line):(poProduct(row.productId)||{sku:row.supplierSku||row.productId,name:row.productId});return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.poId) + '</small></td><td>' + poEsc(row.supplier) + '</td><td><strong>' + poEsc(p.sku||row.productId) + '</strong><small>' + poEsc(p.name||row.productId) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '</td><td>' + poPill(row.status,row.status==='Closed'?'good':row.status==='Cancelled'?'bad':'warn') + '</td><td class="right">' + poMoney(row.status==='Closed'?(row.creditNet!=null?row.creditNet:row.expectedCredit):row.expectedCredit) + '</td><td>'+poReturnActionButtons(po,row)+'</td></tr>';}).join('') || '<tr><td colspan="8" class="po-empty">No supplier returns or credits recorded.</td></tr>';
    const summary=purchaseReturnStatusSummary();
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / RETURNS</div><h1>Supplier Returns & Credits</h1><p>One end-to-end queue for returns, service corrections, supplier credits and the linked PO / Project cost reversal.</p></div></header><section class="po-health-bar"><div><span>Return records</span><strong>' + summary.count + '</strong><small>all time</small></div><div><span>Open returns</span><strong>' + summary.open + '</strong><small>need action</small></div><div><span>Expected credits</span><strong>' + poMoney(summary.expectedCredit) + '</strong><small>still open</small></div><div><span>Completed credits</span><strong>' + poMoney(summary.resolvedCredit) + '</strong><small>applied back</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Return & credit queue</h3><p>Complete each case here; closed credits stay attached to the original Purchase Order and Project audit trail.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return / PO</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Credit net</th><th>Next action</th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
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

[executed on device: Mac (ec904dd1-f8aa-4e0b-a3e1-d58dac693c34)]