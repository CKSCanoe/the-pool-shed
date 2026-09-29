export function normalizedAppOrigin(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{return new URL(raw).origin;}catch(_){return raw.replace(/\/+$/,'');}
}

function firstHeader(value){
  return String(Array.isArray(value)?value[0]:(value||'')).split(',')[0].trim();
}

export function appOriginAllowed(req,env=process.env){
  const supplied=firstHeader(req?.headers?.origin);
  if(!supplied)return true;

  const incoming=normalizedAppOrigin(supplied);
  if(!incoming)return false;

  const requestHost=firstHeader(req?.headers?.['x-forwarded-host']||req?.headers?.host).toLowerCase();
  try{
    if(requestHost&&new URL(incoming).host.toLowerCase()===requestHost)return true;
  }catch(_){}

  const allowed=new Set();
  const add=value=>{
    String(value||'').split(',').map(v=>normalizedAppOrigin(v)).filter(Boolean).forEach(v=>allowed.add(v));
  };
  add(env.APP_ORIGIN);
  add(env.APP_ORIGINS);
  if(env.VERCEL_PROJECT_PRODUCTION_URL)add('https://'+String(env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//,'').replace(/\/+$/,''));
  if(env.VERCEL_URL)add('https://'+String(env.VERCEL_URL).replace(/^https?:\/\//,'').replace(/\/+$/,''));

  if(!allowed.size)return true;
  return allowed.has(incoming);
}
