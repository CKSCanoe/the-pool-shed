import assert from 'node:assert/strict';
const old={...process.env};process.env.SUPABASE_URL='https://example.supabase.test';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';delete process.env.SUPABASE_SECRET_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const calls=[],originalFetch=global.fetch;global.fetch=async(url)=>{url=String(url);calls.push(url);const json=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
 if(url.includes('/auth/v1/user'))return json(200,{id:'11111111-1111-1111-1111-111111111111',email:'aaron@example.test',user_metadata:{full_name:'Aaron'}});
 if(url.includes('/rest/v1/ps_workspace_members'))throw new Error('Authenticated runtime must not query hardened member table');
 if(url.includes('/rest/v1/user_profiles'))return json(200,[{id:'11111111-1111-1111-1111-111111111111',full_name:'Aaron',email:'aaron@example.test',role:'Admin',active:true,permissions:{}}]);
 if(url.includes('/rest/v1/workspace_snapshots'))return json(200,[{data:{jobs:[],products:[],stock:[],salesOrders:[],purchaseOrders:[],suppliers:[],customers:[]},updated_at:'2026-10-01T10:00:00Z'}]);
 if(url.includes('/rest/v1/ps_workspace_revisions'))return json(403,{});
 if(url.includes('/rest/v1/ps_finance_documents'))return json(403,{});
 return json(404,{});
};
try{
 const mod=await import('../server/azzy-pool-shed.js?workspace-access='+Date.now());
 const ctx=await mod.loadAzzyPoolShedContext({headers:{authorization:'Bearer user-jwt'}});
 assert.equal(ctx.accessMode,'authenticated-rls');assert.equal(ctx.user.role,'Admin');assert.equal(ctx.workspaceId,'pool-bros-main');
 assert(!calls.some(x=>x.includes('ps_workspace_members')),'No-server-key Azzy path must rely on workspace snapshot RLS membership proof');
 assert(calls.some(x=>x.includes('workspace_snapshots')),'Azzy must read the authorised workspace snapshot');
 console.log('PASS Azzy authenticated-RLS workspace access works without a Supabase server secret');
}finally{global.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
