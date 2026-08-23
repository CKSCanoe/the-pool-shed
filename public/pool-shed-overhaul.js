(function(){
  'use strict';
  var scheduled=false;
  var bootDone=false;
  var saveTimer=null;

  function store(){
    try{return window.__POOL_SHED_GET_DATA__?window.__POOL_SHED_GET_DATA__():(window.data||{});}catch(_){return window.data||{};}
  }
  function save(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){try{if(typeof window.saveAppData==='function')window.saveAppData();}catch(_){}},80);
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]});}

  function finishBoot(){
    if(bootDone)return;bootDone=true;
    var boot=document.getElementById('psBootScreen');
    if(boot){boot.classList.add('is-ready');setTimeout(function(){if(boot&&boot.parentNode)boot.parentNode.removeChild(boot);},260);}
    document.documentElement.classList.remove('ps-booting');
  }

  function removeVisibleVersionText(root){
    (root||document).querySelectorAll('.eyebrow,.so-search-diagnostics,.import-admin-banner p').forEach(function(el){
      var txt=String(el.textContent||'');
      if(/^\s*VERSION\s+[0-9]/i.test(txt))el.textContent='POOL SHED';
      if(/Search engine v[0-9]/i.test(txt))el.textContent=txt.replace(/\s*·?\s*Search engine v[\w.\-]+/ig,'');
      if(/Version\s+[0-9][\w.\-]*\s+protects/i.test(txt))el.textContent='Every committed upload is protected, audited and recoverable.';
    });
  }

  function normaliseBundleComponentCosts(){
    var d=store(),changed=false;
    (d.salesOrders||[]).forEach(function(order){
      (order.lines||[]).forEach(function(line){
        if(line&&line.bundleRole==='component'){
          if(line.unitCost!==0){
            if(!line.bundleComponentSnapshot)line.bundleComponentSnapshot={};
            if(line.bundleComponentSnapshot.cost==null&&Number.isFinite(Number(line.unitCost)))line.bundleComponentSnapshot.cost=Number(line.unitCost||0);
            line.unitCost=0;changed=true;
          }
          if(line.unitPrice!==0){line.unitPrice=0;changed=true;}
        }
      });
    });
    if(changed)save();
  }

  function currentSalesOrder(){
    var d=store();
    var id=window.selectedSalesOrderId||'';
    return (d.salesOrders||[]).find(function(o){return String(o.id)===String(id);})||null;
  }
  function productById(id){
    var d=store();return (d.products||[]).find(function(p){return String(p.id)===String(id);})||null;
  }

  function decorateSalesToolbar(){
    var screen=document.getElementById('screen-salesorders');if(!screen)return;
    var top=screen.querySelector('.record-card.sales-order-compact > .record-top');if(!top)return;
    var print=top.querySelector('[data-email-print-order]');if(print){print.textContent='Email / Print';print.title='Email or print the sales order';}
    var alloc=top.querySelector('[data-allocate-order]');if(alloc){alloc.textContent='Allocate all';alloc.title='Allocate available stock';}
    var fulfil=top.querySelector('[data-fulfil-order]');if(fulfil){fulfil.textContent='Create shipment';fulfil.title='Print, pick, pack and ship';}
    var invoice=top.querySelector('[data-open-invoice-confirm]');if(invoice){invoice.textContent='Invoice';}
    var saveBtn=top.querySelector('[data-save-order]');if(saveBtn){saveBtn.textContent='Save changes';}
    var adv=screen.querySelector('[data-selected-line-action="advancedFulfil"]');if(adv){adv.textContent='Print · Pick · Pack · Ship';}
  }

  function decorateBundleRows(){
    var screen=document.getElementById('screen-salesorders');if(!screen)return;
    var order=currentSalesOrder();if(!order)return;
    var rows=Array.from(screen.querySelectorAll('.order-lines-table tbody tr'));
    if(!rows.length)return;
    var groups={};
    (order.lines||[]).forEach(function(line){
      if(!line.bundleInstanceId)return;
      if(!groups[line.bundleInstanceId])groups[line.bundleInstanceId]={head:null,children:[]};
      if(line.bundleRole==='head')groups[line.bundleInstanceId].head=line;
      else if(line.bundleRole==='component')groups[line.bundleInstanceId].children.push(line);
    });
    rows.forEach(function(tr){
      var skuText=tr.cells[2]?String(tr.cells[2].innerText||''):'';
      var line=(order.lines||[]).find(function(l){var p=productById(l.productId);return p&&skuText.indexOf(String(p.sku||''))>=0;});
      if(!line||!line.bundleInstanceId)return;
      tr.dataset.bundleInstance=line.bundleInstanceId;
      if(line.bundleRole==='head'){
        tr.classList.add('bundle-line-head');
        var detail=tr.cells[3];
        if(detail&&!detail.querySelector('.ps-bundle-toggle')){
          var count=(groups[line.bundleInstanceId]||{children:[]}).children.length;
          var button=document.createElement('button');button.type='button';button.className='ps-bundle-toggle';button.dataset.psBundleToggle=line.bundleInstanceId;button.innerHTML='<span>▾</span> '+count+' component'+(count===1?'':'s');
          detail.appendChild(document.createElement('br'));detail.appendChild(button);
        }
      }else if(line.bundleRole==='component'){
        tr.classList.add('bundle-line-child');
        var priceCell=tr.cells[10];if(priceCell&&!priceCell.querySelector('.ps-bundle-cost-note')){
          var note=document.createElement('span');note.className='ps-bundle-cost-note';note.textContent='Included in bundle price';priceCell.appendChild(note);
        }
      }
    });
  }

  function setupComposer(){
    var comp=document.querySelector('#screen-salesorders .so-line-composer');if(!comp)return;
    var head=comp.querySelector('.so-line-composer-head');if(!head)return;
    if(!head.querySelector('.ps-line-composer-toggle')){
      var btn=document.createElement('button');btn.type='button';btn.className='ps-line-composer-toggle';btn.dataset.psLineComposer='toggle';btn.title='Add custom or delivery charge';btn.setAttribute('aria-label','Add custom or delivery charge');btn.textContent='+';head.appendChild(btn);
    }
  }

  function refineFulfilment(){
    var title=document.getElementById('pageTitle');
    if(title&&/Pick,?\s*Pack/i.test(title.textContent||''))title.textContent='Print, Pick, Pack & Ship';
    var intro=document.getElementById('pageIntro');
    if(intro&&/Pick lists|partial fulfilment/i.test(intro.textContent||''))intro.textContent='Print the picking list first, then confirm pick, pack and shipment against the real stock-controlled SKUs.';
  }

  function refineAccounting(){
    var screen=document.getElementById('screen-accounting');if(!screen||screen.classList.contains('hidden'))return;
    if(screen.querySelector('.ps-accounting-strip'))return;
    var d=store(),orders=d.salesOrders||[];
    var invoiceReady=orders.filter(function(o){return (o.tags||[]).indexOf('Invoice Ready')>=0;}).length;
    var invoiced=orders.filter(function(o){return o.status==='Invoiced'||(o.tags||[]).indexOf('Invoiced')>=0||String(o.xeroRef||'Draft')!=='Draft';}).length;
    var linked=orders.filter(function(o){return o.xeroRef&&o.xeroRef!=='Draft';}).length;
    var strip=document.createElement('section');strip.className='ps-accounting-strip profile-stat-grid';
    strip.innerHTML='<div class="profile-stat"><span>Invoice ready</span><strong>'+invoiceReady+'</strong><small>Ready for finance review</small></div><div class="profile-stat"><span>Invoiced</span><strong>'+invoiced+'</strong><small>Historical invoice records</small></div><div class="profile-stat"><span>Xero references</span><strong>'+linked+'</strong><small>Orders with accounting references</small></div><div class="profile-stat"><span>Connection</span><strong>Operational</strong><small>Uses configured Xero references and export workflow</small></div>';
    screen.insertBefore(strip,screen.firstChild);
  }

  function refineJobs(){
    var screen=document.getElementById('screen-jobs');if(!screen||screen.classList.contains('hidden'))return;
    if(screen.querySelector('.ps-jobs-note'))return;
    var first=screen.firstElementChild;if(!first)return;
    var note=document.createElement('div');note.className='ps-jobs-note';note.style.cssText='padding:10px 14px;border:1px solid #d6e8ee;border-radius:12px;background:#f5fafc;color:#496b7a;font-size:.82rem;';
    note.innerHTML='<strong style="color:#163b4a">Project control</strong> · Keep customer, site, sales order, purchase orders, engineer requests, files and invoice references linked to the same job record.';
    screen.insertBefore(note,first);
  }

  function searchWatchdog(){
    var input=document.querySelector('#screen-salesorders #salesOrderProductSearch');if(!input||input.dataset.psWatchdog==='1')return;
    input.dataset.psWatchdog='1';
    input.addEventListener('input',function(){
      var self=this;
      clearTimeout(self._psSearchTimer);
      self._psSearchTimer=setTimeout(function(){
        if(!self.value.trim())return;
        var visible=document.querySelector('.so-search-popover:not([hidden])');
        if(!visible){self.dispatchEvent(new FocusEvent('focus',{bubbles:true}));}
      },190);
    });
  }

  function polish(){
    removeVisibleVersionText(document);
    normaliseBundleComponentCosts();
    decorateSalesToolbar();
    decorateBundleRows();
    setupComposer();
    refineFulfilment();
    refineAccounting();
    refineJobs();
    searchWatchdog();
    finishBoot();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;polish();});}

  document.addEventListener('click',function(e){
    var toggle=e.target.closest&&e.target.closest('[data-ps-line-composer="toggle"]');
    if(toggle){var comp=toggle.closest('.so-line-composer');if(comp){var open=comp.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));}return;}
    var bundle=e.target.closest&&e.target.closest('[data-ps-bundle-toggle]');
    if(bundle){var id=bundle.dataset.psBundleToggle;var screen=document.getElementById('screen-salesorders');var rows=screen?screen.querySelectorAll('tr.bundle-line-child[data-bundle-instance="'+CSS.escape(id)+'"]'):[];var hidden=false;rows.forEach(function(r){r.classList.toggle('ps-bundle-collapsed');hidden=r.classList.contains('ps-bundle-collapsed');});bundle.innerHTML='<span>'+(hidden?'▸':'▾')+'</span> '+rows.length+' component'+(rows.length===1?'':'s');return;}
  },true);

  var observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',function(){schedule();setTimeout(schedule,220);setTimeout(finishBoot,1800);});
  window.addEventListener('load',function(){setTimeout(finishBoot,80);});
  setTimeout(finishBoot,2600);
  window.PoolShedProductionPolish={refresh:schedule,normaliseBundleCosts:normaliseBundleComponentCosts};
})();
