(function(){
  function escTitle(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
  function liveProducts(){return (data.products||[]).filter(function(x){return x&&!x.deleted})}
  function sameGroup(p){
    var key=String(p.parentSku||p.parent_sku||p.variantGroup||'').trim();
    if(!key) return [p];
    return liveProducts().filter(function(x){return String(x.parentSku||x.parent_sku||x.variantGroup||'').trim()===key});
  }
  function isTrueGroup(p){return sameGroup(p).length>1 || !!String(p.parentSku||p.parent_sku||'').trim()}
  function syncCatalogueTitle(p,newValue){
    var value=String(newValue||'').trim();
    if(!value)return;
    var members=sameGroup(p);
    if(members.length<=1){p.name=value;p.parentName=value;p.parent_name=value;return;}
    members.forEach(function(x){x.parentName=value;x.parent_name=value});
  }
  var originalProductInfoTab=productInfoTab;
  productInfoTab=function(p){
    var grouped=isTrueGroup(p), members=sameGroup(p), parentTitle=String(p.parentName||p.parent_name||p.name||'');
    var titleBlock='<section class="product-title-management">'+
      '<div><span class="title-badge">'+(grouped?'Parent catalogue title':'Catalogue title')+'</span><label style="margin-top:.65rem">'+(grouped?'Parent product name':'Product display name')+'<input data-product-parent-title="'+p.id+'" value="'+escTitle(parentTitle)+'" autocomplete="off"></label><p class="title-help">'+(grouped?'This is the title shown on the main Product Hub row. It is shared across '+members.length+' variants.':'This is the title shown throughout the Product Hub, Sales Orders and Purchase Orders.')+'</p><div class="product-title-save-state">Saved to the shared workspace when you press Save changes</div></div>'+
      '<div><span class="title-badge">'+(grouped?'Variant title':'Stock-controlled item')+'</span><label style="margin-top:.65rem">'+(grouped?'Variant / item name':'Item name')+'<input data-product-field="'+p.id+'|name" value="'+escTitle(p.name||'')+'" autocomplete="off"></label><p class="title-help">'+(grouped?'Use this when the exact size or variant needs a different name. Changing it will not rename the other variants.':'This is the stock-controlled item name connected to SKU '+escTitle(p.sku||'')+'.')+'</p></div>'+
    '</section>';
    var base=originalProductInfoTab(p);
    return titleBlock+base.replace(/<label>Item name<input[^>]*data-product-field="[^"]+\|name"[^>]*>[^<]*<\/label>/,'');
  };
  var originalSaveProductProfileField=saveProductProfileField;
  saveProductProfileField=function(field){
    if(field&&field.dataset&&field.dataset.productParentTitle){
      var p=product(field.dataset.productParentTitle);if(!p)return;
      var before=String(p.parentName||p.parent_name||p.name||'');
      syncCatalogueTitle(p,field.value);
      p.updatedAt=new Date().toISOString();
      if(before!==String(field.value||'').trim()){
        if(!Array.isArray(data.auditLog))data.auditLog=[];
        data.auditLog.push({id:'AUD-'+Date.now(),date:p.updatedAt,user:'Current user',action:'Product catalogue title changed',product:String(field.value||'').trim(),variant:p.name||'',previousValue:before,newValue:String(field.value||'').trim(),reason:'Product profile edit'});
      }
      return;
    }
    originalSaveProductProfileField(field);
    if(!field||!field.dataset)return;
    var token=field.dataset.productField||field.dataset.productNumberField||'';
    var parts=token.split('|');
    if(parts[1]==='name'){
      var item=product(parts[0]);
      if(item){item.updatedAt=new Date().toISOString();if(sameGroup(item).length<=1)syncCatalogueTitle(item,item.name);}
    }
  };
  var oldSaveVisible=saveVisibleProductProfileFields;
  saveVisibleProductProfileFields=function(){document.querySelectorAll('[data-product-parent-title]').forEach(function(field){saveProductProfileField(field)});oldSaveVisible();};
  var oldBind=bindProductProfile;
  bindProductProfile=function(){
    oldBind();
    document.querySelectorAll('[data-product-parent-title]').forEach(function(field){
      field.addEventListener('input',function(){saveProductProfileField(field)});
      field.addEventListener('change',function(){saveProductProfileField(field);saveAppData()});
    });
  };
})();
