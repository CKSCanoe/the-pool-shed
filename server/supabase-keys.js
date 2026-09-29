// Server-side Supabase API-key compatibility helpers.
// Prefer the modern sb_secret_* key while retaining legacy service_role support.
export function supabaseServerKey(env=process.env){
  return String(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
}

export function supabasePublicKey(env=process.env){
  return String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
}

export function supabaseApiKey(env=process.env,{preferServer=true}={}){
  return preferServer ? (supabaseServerKey(env)||supabasePublicKey(env)) : (supabasePublicKey(env)||supabaseServerKey(env));
}

export function isLegacyJwtApiKey(value){
  return /^eyJ[A-Za-z0-9_-]+\./.test(String(value||'').trim());
}

export function elevatedSupabaseHeaders(env=process.env,extra={}){
  const key=supabaseServerKey(env);
  if(!key)throw Object.assign(new Error('Supabase server key is not configured.'),{statusCode:503});
  const headers={apikey:key,...extra};
  // Modern sb_secret_* keys belong on apikey, not Authorization: Bearer.
  // Legacy service_role JWTs still need the bearer header for PostgREST role selection.
  if(isLegacyJwtApiKey(key))headers.Authorization='Bearer '+key;
  return headers;
}
