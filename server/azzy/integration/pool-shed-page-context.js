// Small browser-side helper. Call this from Pool Shed whenever the selected
// record/page changes. It contains no business data and performs no writes.
export function setAzzyPageContext(context){
  if(typeof window==='undefined')return null;
  const safe=context?.type&&context?.id?{type:String(context.type),id:String(context.id),name:context.name?String(context.name):undefined,page:context.page?String(context.page):undefined}:null;
  window.__AZZY_PAGE_CONTEXT__=safe;
  window.dispatchEvent(new CustomEvent('azzy:context-changed',{detail:safe}));
  return safe;
}
export function clearAzzyPageContext(){
  if(typeof window==='undefined')return;
  window.__AZZY_PAGE_CONTEXT__=null;
  window.dispatchEvent(new CustomEvent('azzy:context-changed',{detail:null}));
}
