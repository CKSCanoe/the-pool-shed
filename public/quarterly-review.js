/* Current order values grouped by creation quarter, not historical recognised revenue. */
(function(){
 const esc=v=>escapeHtml(String(v??''));
 let period=String(new Date().getFullYear())+'-Q'+(Math.floor(new Date().getMonth()/3)+1);
 function quarter(d){const x=/^(\d{4})-(\d{2})/.exec(d||'');return x?x[1]+'-Q'+Math.ceil(Number(x[2])/3):'';}
 function rows(){return data.salesOrders.filter(o=>quarter(o.created)===period&&!['Cancelled','Canceled'].includes(o.status)).map(o=>{
  const net=salesOrderTotals(o).net;
  let missing=0,cost=0;
  o.lines.forEach(l=>{if(l.bundleRole==='component')return;const p=product(l.productId),rate=l.unitCost!=null?Number(l.unitCost):Number(p?.cost);if(!Number.isFinite(rate)||rate===0)missing++;else cost+=rate*Number(l.qty||0);});
  return {id:o.id,status:o.status,net,cost,margin:net?(net-cost)/net*100:null,missing};
 });}
 function report(){
  const items=rows(),periods=[...new Set([period,...data.salesOrders.map(o=>quarter(o.created)).filter(Boolean)])].sort().reverse();
  const net=items.reduce((n,r)=>n+r.net,0),cost=items.reduce((n,r)=>n+r.cost,0);
  return '<section class="panel" style="grid-column:1/-1"><h2>Quarterly order review</h2><label>Orders created in<select data-quarter-period>'+periods.map(p=>'<option '+(p===period?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select></label><p>Order value '+money(net)+' · Estimated line cost '+money(cost)+' · Estimated contribution '+money(net-cost)+'</p><p class="muted">Current net values for orders created in this quarter. Not recognised revenue or company profit; excludes overheads, later cost changes and unmatched expenses. Use Projects for the full job forecast.</p><div class="ps-table-region"><table><thead><tr><th>Order</th><th>Status</th><th>Net value</th><th>Estimated cost</th><th>Checks</th></tr></thead><tbody>'+items.map(r=>'<tr><td><button data-business-open="'+esc(r.id)+'" data-business-type="order">'+esc(r.id)+'</button></td><td>'+esc(r.status)+'</td><td>'+money(r.net)+'</td><td>'+money(r.cost)+'</td><td>'+(r.missing?r.missing+' lines with missing / zero cost':'Review cost assumptions')+'</td></tr>').join('')+'</tbody></table></div><button class="secondary" data-quarter-export>Download CSV</button></section>';
 }
 const base=render;render=function(){base();if(active==='dashboard'&&dashboardView!=='restockReport'&&canAccessTab('salesorders'))document.getElementById('screen-dashboard').insertAdjacentHTML('beforeend',report());};
 document.addEventListener('change',e=>{if(e.target.matches('[data-quarter-period]')){period=e.target.value;render();}});
 document.addEventListener('click',e=>{if(!e.target.closest('[data-quarter-export]'))return;const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const content=[['Quarter','Order','Status','Net value','Estimated line cost','Missing or zero cost lines'],...rows().map(r=>[period,r.id,r.status,r.net.toFixed(2),r.cost.toFixed(2),r.missing])].map(r=>r.map(cell).join(',')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='order-review-'+period+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
})();
