(function(){
  const VERSION='1.11.4';
  const previousRenderProducts=renderProducts;
  const originalAddStock=addStock;
  const hubState=window.poolShedProductHubState||{query:'',category:'',supplier:'',stock:'',kind:'',sort:'name',compare:[]};
  window.poolShedProductHubState=hubState;
  const expanded=window.poolShedExpandedProductGroups||new Set(); window.poolShedExpandedProductGroups=expanded;
  function norm(v){return String(v==null?'':v).trim().toLowerCase()}
  function esc(v){return escapeHtml(String(v==null?'':v))}
  function skuKey(p){return norm(p&&p.sku)}
  function refsFor(id){let n=0;(data.stock||[]).forEach(x=>{if(x.productId===id)n+=10});(data.purchaseOrders||[]).forEach(o=>(o.lines||[]).forEach(x=>{if(x.productId===id)n+=3}));(data.salesOrders||[]).forEach(o=>(o.lines||[]).forEach(x=>{if(x.productId===id)n+=3}));(data.movements||[]).forEach(x=>{if(x.productId===id)n+=1});return n}
  function mergeMissing(target,source){Object.keys(source||{}).forEach(function(k){if((target[k]===undefined||target[k]===null||target[k]==='')&&source[k]!==undefined&&source[k]!==null&&source[k]!=='')target[k]=source[k]})}
  function repoint(oldId,newId){
    ['stock','restockRules','allocations','movements'].forEach(function(key){(data[key]||[]).forEach(function(x){if(x.productId===oldId)x.productId=newId})});
    ['purchaseOrders','salesOrders','goodsNotes','salesCredits','engineerRequests'].forEach(function(key){(data[key]||[]).forEach(function(o){(o.lines||[]).forEach(function(x){if(x.productId===oldId)x.productId=newId})})});
  }
  function consolidateStock(){const map=new Map();(data.stock||[]).forEach(function(r){if(!r||!r.productId||!r.locationId)return;const k=r.productId+'|'+r.locationId;if(!map.has(k))map.set(k,{productId:r.productId,locationId:r.locationId,qty:0,allocated:0});const x=map.get(k);x.qty+=Number(r.qty||0);x.allocated+=Number(r.allocated||0)});data.stock=Array.from(map.values()).map(function(r){r.qty=Math.max(0,r.qty);r.allocated=Math.max(0,Math.min(r.qty,r.allocated));return r})}
  function reconcileInventory(reason){
    const groups=new Map();(data.products||[]).filter(Boolean).forEach(function(p){const k=skuKey(p);if(!k)return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)});
    let merged=0;
    groups.forEach(function(list){if(list.length<2)return;list.sort(function(a,b){return refsFor(b.id)-refsFor(a.id)||(a.deleted?1:0)-(b.deleted?1:0)});const canonical=list[0];list.slice(1).forEach(function(dup){mergeMissing(canonical,dup);repoint(dup.id,canonical.id);dup.deleted=true;dup.active=false;dup.mergedIntoProductId=canonical.id;merged++})});
    consolidateStock();
    (data.restockRules||[]).forEach(function(rule){const p=product(rule.productId);if(p)rule.current=stockBalance(p.id,rule.locationId)});
    data.inventorySync={lastRun:new Date().toISOString(),reason:reason||'Automatic reconciliation',duplicatesMerged:merged,stockRows:(data.stock||[]).length};
    return data.inventorySync;
  }
  window.reconcilePoolShedInventory=reconcileInventory;
  addStock=function(productId,locationId,qty,allocated){
    const p=product(productId);const same=p&&(data.products||[]).filter(x=>!x.deleted&&skuKey(x)===skuKey(p)).sort((a,b)=>refsFor(b.id)-refsFor(a.id))[0];
    originalAddStock(same?same.id:productId,locationId,Number(qty||0),Number(allocated||0));
    consolidateStock();
  };
  function tokens(q){return norm(q).replace(/([0-9])([a-z])/g,'$1 $2').replace(/([a-z])([0-9])/g,'$1 $2').split(/\s+/).filter(Boolean)}
  function distance(a,b){if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
  function fuzzyTokenMatch(t,words){if(words.some(w=>w.includes(t)||t.includes(w)))return true;if(t.length<4)return false;return words.some(w=>Math.abs(w.length-t.length)<=2&&distance(t,w)<=Math.max(1,Math.floor(t.length*.28)))}
  function searchable(p){return [p.parentName,p.parentSku,p.name,p.variantName,p.variantValue,p.variantLabel,p.sku,p.supplierSku,p.barcode,p.brand,p.category,p.supplier,p.description,p.packSize,p.unit].filter(Boolean).join(' ')}
  function fuzzyMatch(p,q){const ts=tokens(q);if(!ts.length)return true;const words=tokens(searchable(p));return ts.every(t=>fuzzyTokenMatch(t,words))}
  function groupKey(p){return String(p.parentSku||p.parent_sku||p.sisterKey||p.sku||p.id)}
  function groupName(p){return p.parentName||p.parent_name||p.variantGroup||p.name}
  function variantName(p){return p.variantValue||p.variantLabel||p.variant||p.packSize||(p.isVariant?p.name:'Default')}
  function groups(){const m=new Map();(data.products||[]).filter(p=>p&&!p.deleted).forEach(function(p){const k=groupKey(p);if(!m.has(k))m.set(k,{key:k,name:groupName(p),products:[]});const g=m.get(k);g.products.push(p);if(p.parentName)g.name=p.parentName});return Array.from(m.values())}
  function summary(g){const x={on:0,al:0,av:0};g.products.forEach(function(p){const s=productStockSummary(p.id);x.on+=s.onHand;x.al+=s.allocated;x.av+=s.available});const rrps=g.products.map(p=>Number(p.rrp||0));const suppliers=[...new Set(g.products.map(p=>p.supplier).filter(Boolean))];return Object.assign(x,{min:rrps.length?Math.min(...rrps):0,max:rrps.length?Math.max(...rrps):0,suppliers:suppliers})}
  function stockStatus(s,g){const reorder=g.products.reduce((n,p)=>n+Number(p.reorder||0),0);if(s.on<=0)return ['bad','Out of stock'];if(s.av<=reorder)return ['warn','Low stock'];if(s.al>0)return ['blue','Allocated'];return ['good','In stock']}
  function filterGroups(){
    let list=groups().filter(function(g){const first=g.products[0]||{};const s=summary(g);if(hubState.query&&!g.products.some(p=>fuzzyMatch(p,hubState.query)))return false;if(hubState.category&&!g.products.some(p=>p.category===hubState.category))return false;if(hubState.supplier&&!g.products.some(p=>p.supplier===hubState.supplier))return false;if(hubState.kind==='grouped'&&g.products.length<2)return false;if(hubState.kind==='standalone'&&g.products.length!==1)return false;if(hubState.stock==='in'&&s.av<=0)return false;if(hubState.stock==='low'&&!(s.on>0&&s.av<=g.products.reduce((n,p)=>n+Number(p.reorder||0),0)))return false;if(hubState.stock==='out'&&s.on>0)return false;if(hubState.stock==='allocated'&&s.al<=0)return false;return true});
    list.sort(function(a,b){const sa=summary(a),sb=summary(b);if(hubState.sort==='stock')return sb.av-sa.av;if(hubState.sort==='rrp')return sa.min-sb.min;if(hubState.sort==='variants')return b.products.length-a.products.length;return a.name.localeCompare(b.name)});return list
  }
  function options(values,selected,label){return '<option value="">'+label+'</option>'+[...new Set(values.filter(Boolean))].sort().map(v=>'<option'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('')}
  function variantRows(g){return g.products.slice().sort((a,b)=>Number(a.variantSortOrder||0)-Number(b.variantSortOrder||0)||variantName(a).localeCompare(variantName(b))).map(function(p){const s=productStockSummary(p.id),locs=stockRowsForProduct(p.id).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty),loc=locs[0]&&locationById(locs[0].locationId),hit=hubState.query&&fuzzyMatch(p,hubState.query);return '<tr class="'+(hit?'variant-highlight':'')+'"><td><label class="compare-toggle"><input type="checkbox" data-compare-product="'+p.id+'" '+(hubState.compare.includes(p.id)?'checked':'')+'> Compare</label></td><td><div class="variant-image-cell">'+(window.PoolShedProductImages?window.PoolShedProductImages.markup(p,{mode:'variant',className:'variant-row-image',size:'sm',alt:p.name}):'<span class="pb-product-image pb-product-image-sm is-fallback"><span class="pb-product-image-fallback">PB</span></span>')+'<strong>'+esc(variantName(p))+'</strong></div></td><td><button class="link-button" data-product-profile="'+p.id+'">'+esc(p.sku)+'</button><br><span class="muted">'+esc(p.supplierSku||'No supplier SKU')+'</span></td><td>'+esc(p.brand||'—')+'</td><td class="right">'+money(Number(p.cost||0))+'</td><td class="right">'+money(Number(p.rrp||0))+'</td><td class="right"><strong>'+s.onHand+'</strong></td><td class="right">'+s.allocated+'</td><td class="right"><strong>'+s.available+'</strong></td><td>'+esc(loc?loc.name:'Not assigned')+'</td><td><button class="secondary" data-product-profile="'+p.id+'">Open</button></td></tr>'}).join('')}
  function comparePanel(){const ps=hubState.compare.map(id=>product(id)).filter(Boolean);if(!ps.length)return '';const rows=[['Variant',p=>variantName(p)],['SKU',p=>p.sku],['Supplier SKU',p=>p.supplierSku||'—'],['Supplier',p=>p.supplier||'—'],['Cost',p=>money(Number(p.cost||0))],['RRP',p=>money(Number(p.rrp||0))],['Physical stock',p=>productStockSummary(p.id).onHand],['Allocated',p=>productStockSummary(p.id).allocated],['Available',p=>productStockSummary(p.id).available],['Reorder level',p=>Number(p.reorder||0)]];return '<div class="compare-drawer"><div class="group-toolbar"><div><strong>Product comparison</strong><p class="muted">Compare up to four similar variants side by side.</p></div><button class="secondary" data-clear-compare="true">Clear comparison</button></div><div class="compare-grid" style="--compare-count:'+ps.length+'"><div class="compare-label">Field</div>'+ps.map(p=>'<div><strong>'+esc(p.parentName||p.name)+'</strong></div>').join('')+rows.map(r=>'<div class="compare-label">'+r[0]+'</div>'+ps.map(p=>'<div>'+esc(r[1](p))+'</div>').join('')).join('')+'</div></div>'}
  function renderList(){
    const list=filterGroups(),cats=(data.products||[]).filter(p=>!p.deleted).map(p=>p.category),sups=(data.products||[]).filter(p=>!p.deleted).map(p=>p.supplier);
    const controls='<div class="product-hub-command"><label class="product-hub-search"><span>Smart product search</span><small>Works offline and searches names, variants, SKUs, supplier codes and barcodes</small><input data-hub-filter="query" value="'+esc(hubState.query)+'" placeholder="Try chlorine 5kg, clorine tabs, SKU or barcode"></label><label>Category<select data-hub-filter="category">'+options(cats,hubState.category,'All categories')+'</select></label><label>Supplier<select data-hub-filter="supplier">'+options(sups,hubState.supplier,'All suppliers')+'</select></label><label>Stock status<select data-hub-filter="stock">'+optionList(['','in','low','out','allocated'],hubState.stock).replace('value="">','value="">All stock statuses</option><option style="display:none" value="">')+'</select></label><label>Product structure<select data-hub-filter="kind">'+optionList(['','grouped','standalone'],hubState.kind).replace('value="">','value="">All products</option><option style="display:none" value="">')+'</select></label><label>Sort by<select data-hub-filter="sort">'+optionList(['name','stock','rrp','variants'],hubState.sort)+'</select></label></div><div class="product-hub-actions"><span class="result-count">'+list.length+' product group'+(list.length===1?'':'s')+'</span><button data-add-standalone="true">Add standalone product</button><button data-add-grouped="true">Add grouped product</button><button class="secondary" data-product-view="bulk">Import catalogue</button><button class="secondary" data-reset-hub="true">Clear filters</button></div>';
    const cards=list.map(function(g){const s=summary(g),st=stockStatus(s,g),open=expanded.has(g.key),first=g.products[0]||{};return '<article class="catalogue-row"><div class="catalogue-row-main"><div class="catalogue-identity">'+(window.PoolShedProductImages?window.PoolShedProductImages.markup(first,{mode:'parent',className:'catalogue-mark',size:'md',alt:g.name}):'<div class="catalogue-mark">PB</div>')+'<div class="catalogue-title"><strong title="'+esc(g.name)+'">'+esc(g.name)+'</strong><span title="'+esc([first.brand||first.supplier,first.category,g.products.length+' variant'+(g.products.length===1?'':'s')].filter(Boolean).join(' · '))+'">'+esc([first.brand||first.supplier,first.category,g.products.length+' variant'+(g.products.length===1?'':'s')].filter(Boolean).join(' · '))+'</span></div></div><div class="catalogue-metric"><span>Physical</span><strong>'+s.on+'</strong></div><div class="catalogue-metric"><span>Allocated</span><strong>'+s.al+'</strong></div><div class="catalogue-metric"><span>Available</span><strong>'+s.av+'</strong></div><div class="catalogue-metric"><span>RRP</span><strong>'+money(s.min)+(s.max!==s.min?' – '+money(s.max):'')+'</strong><small class="group-status '+st[0]+'">'+st[1]+'</small></div><button class="secondary catalogue-expand" data-v1100-toggle="'+esc(g.key)+'" aria-expanded="'+open+'">'+(open?'−':'+')+'</button></div><div class="catalogue-variants" '+(open?'':'hidden')+'><div class="group-toolbar"><div><strong>'+g.products.length+' stock-controlled variant'+(g.products.length===1?'':'s')+'</strong><p class="muted">Stock shown below is calculated from the live location ledger.</p></div><button data-add-variant="'+esc(g.key)+'">Add variant</button></div><div class="table-scroll"><table><thead><tr><th>Compare</th><th>Size / variant</th><th>Pool Bros SKU</th><th>Brand</th><th class="right">Cost</th><th class="right">RRP</th><th class="right">Physical</th><th class="right">Allocated</th><th class="right">Available</th><th>Primary location</th><th>Action</th></tr></thead><tbody>'+variantRows(g)+'</tbody></table></div></div></article>'}).join('')||'<div class="empty-state"><strong>No catalogue matches</strong><p>Check spelling, remove a filter, or search by SKU, barcode, supplier SKU, size or description.</p></div>';
    return panel('Product Hub','Fast catalogue search, grouped variants, stock visibility and commercial comparison.','<div class="group-toolbar"><div><span class="eyebrow">VERSION '+VERSION+'</span><h2>Products, variants and catalogue intelligence</h2><p class="muted">Search, compare, price and manage every stock-controlled variant from one streamlined workspace.</p></div><span class="stock-ledger-badge">● Catalogue & stock live</span></div>'+controls+'<div class="catalogue-compact">'+cards+'</div>'+comparePanel())
  }
  renderProducts=function(){
    const sub=selectedSubPage('products');const listMode=productView==='list'&&!['Create Product','Import Catalogue','Bulk Create','Pricing','Prices','Catalogue Health'].includes(sub);
    if(!listMode)return previousRenderProducts();
    const screen=document.getElementById('screen-products');const content=renderList();if(screen)screen.innerHTML=content;
    document.querySelectorAll('[data-product-profile]').forEach(b=>b.addEventListener('click',function(){selectedProductId=b.dataset.productProfile;productView='profile';productTab='info';render()}));
    document.querySelectorAll('[data-product-view]').forEach(b=>b.addEventListener('click',function(){productView=b.dataset.productView;render()}));
    return content
  };
  let hubRenderTimer=null;
  function scheduleHubRender(delay){
    clearTimeout(hubRenderTimer);
    const active=document.activeElement;
    const field=active&&active.matches&&active.matches('[data-hub-filter]')?active.dataset.hubFilter:'';
    const start=active&&typeof active.selectionStart==='number'?active.selectionStart:null;
    const end=active&&typeof active.selectionEnd==='number'?active.selectionEnd:null;
    hubRenderTimer=setTimeout(function(){
      if(activeTab!=='products'||productView!=='list')return;
      renderProducts();
      if(field){
        const replacement=document.querySelector('[data-hub-filter="'+field+'"]');
        if(replacement){
          replacement.focus({preventScroll:true});
          if(start!==null&&replacement.setSelectionRange){
            const pos=Math.min(start,replacement.value.length);
            replacement.setSelectionRange(pos,Math.min(end===null?pos:end,replacement.value.length));
          }
        }
      }
    },delay||0);
  }
  document.addEventListener('input',function(e){const f=e.target.closest('[data-hub-filter]');if(!f)return;hubState[f.dataset.hubFilter]=f.value;scheduleHubRender(f.dataset.hubFilter==='query'?180:0)});
  document.addEventListener('change',function(e){const f=e.target.closest('[data-hub-filter]');if(f){hubState[f.dataset.hubFilter]=f.value;scheduleHubRender(0);return}const c=e.target.closest('[data-compare-product]');if(c){const id=c.dataset.compareProduct;if(c.checked){if(hubState.compare.length>=4){c.checked=false;return toast('Compare up to four variants at a time.')}if(!hubState.compare.includes(id))hubState.compare.push(id)}else hubState.compare=hubState.compare.filter(x=>x!==id);scheduleHubRender(0)}});
  document.addEventListener('click',function(e){const t=e.target.closest('[data-v1100-toggle]');if(t){expanded.has(t.dataset.v1100Toggle)?expanded.delete(t.dataset.v1100Toggle):expanded.add(t.dataset.v1100Toggle);render();return}if(e.target.closest('[data-reset-hub]')){Object.assign(hubState,{query:'',category:'',supplier:'',stock:'',kind:'',sort:'name'});render();return}if(e.target.closest('[data-clear-compare]')){hubState.compare=[];render();return}if(e.target.closest('[data-reconcile-inventory]')){const result=reconcileInventory('Manual administrator check');saveAppData();toast('Inventory synchronised. '+result.stockRows+' stock location rows checked'+(result.duplicatesMerged?', '+result.duplicatesMerged+' duplicate product record(s) safely merged.':'.'));render();return}});
  setTimeout(function(){const r=reconcileInventory('v1.10.3 startup reconciliation');if(r.duplicatesMerged)saveAppData();if(activeTab==='products')render()},150);
})();
