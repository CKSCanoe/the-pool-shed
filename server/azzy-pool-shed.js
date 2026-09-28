const WORKSPACE_ID=process.env.POOL_SHED_WORKSPACE_ID||'pool-bros-main';
const ROLE_IDS=['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office'];
const VIEW_DEFAULTS={
  Admin:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:true,accounting:true,analytics:true,automation:true,settings:true},
  Management:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:true,accounting:true,analytics:true,automation:true,settings:true},
  Accounts:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:true,accounting:true,analytics:true,automation:true,settings:true},
  Sales:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:false,warehouse:false,fulfilment:true,accounting:true,analytics:true,automation:true,settings:true},
  Purchasing:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:false,accounting:true,analytics:true,automation:true,settings:true},
  Warehouse:{dashboard:true,mywork:true,crm:false,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:true,accounting:false,analytics:true,automation:true,settings:true},
  Engineer:{dashboard:true,mywork:true,crm:false,jobs:true,salesorders:false,quotes:false,products:false,locations:true,purchase:false,warehouse:true,fulfilment:true,accounting:false,analytics:false,automation:true,settings:true},
  Office:{dashboard:true,mywork:true,crm:true,jobs:true,salesorders:true,quotes:true,products:true,locations:true,purchase:true,warehouse:true,fulfilment:true,accounting:false,analytics:true,automation:true,settings:true}
};
const FINANCE_DEFAULTS={
  Admin:{customerBalances:true,customerCreditLimits:true,supplierCosts:true,productMargins:true,supplierBills:true,paymentRuns:true,projectMargins:true,financialExports:true},
  Management:{customerBalances:true,customerCreditLimits:true,supplierCosts:true,productMargins:true,supplierBills:true,paymentRuns:true,projectMargins:true,financialExports:true},
  Accounts:{customerBalances:true,customerCreditLimits:true,supplierCosts:true,productMargins:true,supplierBills:true,paymentRuns:true,projectMargins:true,financialExports:false},
  Sales:{customerBalances:true,customerCreditLimits:true,supplierCosts:false,productMargins:true,supplierBills:false,paymentRuns:false,projectMargins:true,financialExports:false},
  Purchasing:{customerBalances:false,customerCreditLimits:false,supplierCosts:true,productMargins:true,supplierBills:true,paymentRuns:false,projectMargins:true,financialExports:false},
  Warehouse:{customerBalances:false,customerCreditLimits:false,supplierCosts:false,productMargins:false,supplierBills:false,paymentRuns:false,projectMargins:false,financialExports:false},
  Engineer:{customerBalances:false,customerCreditLimits:false,supplierCosts:false,productMargins:false,supplierBills:false,paymentRuns:false,projectMargins:false,financialExports:false},
  Office:{customerBalances:false,customerCreditLimits:false,supplierCosts:false,productMargins:false,supplierBills:false,paymentRuns:false,projectMargins:false,financialExports:false}
};

const enc=v=>encodeURIComponent(String(v??''));
const arr=v=>Array.isArray(v)?v:[];
const text=v=>String(v??'').trim();
function httpError(message,statusCode){const e=Error(message);e.statusCode=statusCode;return e;}
function apiKey(){return process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';}
function requireBackend(){if(!process.env.SUPABASE_URL||!apiKey())throw httpError('Azzy secure backend is not configured.',503);}
function requestAuthorization(req){const authorization=req?.headers?.authorization||'';return authorization.startsWith('Bearer ')?authorization:'';}
async function rest(path,{timeout=12000,authorization='',optional=false}={}){
  requireBackend();
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  const auth=service?`Bearer ${service}`:authorization;
  if(!auth)throw httpError('Sign in first.',401);
  try{
    const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:apiKey(),Authorization:auth,Accept:'application/json'},signal:AbortSignal.timeout(timeout)});
    if(!r.ok){if(optional)return null;throw httpError(`Pool Shed data service failed (${r.status}).`,r.status===401||r.status===403?r.status:502);}
    return r.status===204?null:await r.json();
  }catch(e){if(optional)return null;throw e;}
}
async function authUser(req){
  requireBackend();
  const authorization=requestAuthorization(req);if(!authorization)throw httpError('Sign in first.',401);
  const r=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:apiKey(),Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw httpError('Sign in first.',401);
  return r.json();
}
function normalizeRole(role){const raw=text(role)==='User'?'Office':text(role);return ROLE_IDS.includes(raw)?raw:'Office';}
function security(workspace){const s=workspace?.securityControl;return s&&typeof s==='object'?s:{};}
function explicitOverride(workspace,user,module,op='view'){
  const value=security(workspace)?.userOverrides?.[String(user.id)]?.[module]?.[op];
  return typeof value==='boolean'?value:undefined;
}
function canModule(workspace,user,module,op='view'){
  const role=normalizeRole(user.role);if(role==='Admin'||module==='dashboard')return true;
  const explicit=explicitOverride(workspace,user,module,op);if(explicit!==undefined)return explicit;
  const custom=security(workspace)?.rolePermissions?.[role]?.[module]?.[op];
  if(typeof custom==='boolean')return custom;
  if(op!=='view'){
    const view=canModule(workspace,user,module,'view');
    if(!view)return false;
    if(op==='approve'||op==='override'||op==='configure')return role==='Management'||role==='Accounts'||role==='Purchasing';
    return role!=='Engineer';
  }
  const profile=user.permissions&&Object.prototype.hasOwnProperty.call(user.permissions,module)?user.permissions[module]:undefined;
  if(profile===false)return false;if(profile===true)return true;
  return Boolean(VIEW_DEFAULTS[role]?.[module]);
}
function canFinancial(workspace,user,field){
  const role=normalizeRole(user.role);if(role==='Admin')return true;
  const explicit=explicitOverride(workspace,user,`financial:${field}`,'view');if(explicit!==undefined)return explicit;
  const custom=security(workspace)?.financialVisibility?.[role]?.[field];
  return typeof custom==='boolean'?custom:Boolean(FINANCE_DEFAULTS[role]?.[field]);
}
export function deriveAzzyPermissions(workspace,user){
  const permissions=[];
  if(canModule(workspace,user,'jobs'))permissions.push('projects.read');
  if(canModule(workspace,user,'products')||canModule(workspace,user,'locations')||canModule(workspace,user,'warehouse'))permissions.push('stock.read');
  if(canModule(workspace,user,'purchase'))permissions.push('purchasing.read');
  if(canModule(workspace,user,'crm'))permissions.push('customers.read');
  if(canModule(workspace,user,'automation'))permissions.push('knowledge.read');
  const broadFinance=['customerBalances','customerCreditLimits','supplierCosts','productMargins','supplierBills','projectMargins'].every(field=>canFinancial(workspace,user,field));
  if(canModule(workspace,user,'accounting')&&broadFinance)permissions.push('finance.read');
  const canPrepare=canModule(workspace,user,'purchase','create')||canModule(workspace,user,'warehouse','edit')||canModule(workspace,user,'jobs','edit')||canModule(workspace,user,'accounting','edit');
  if(canPrepare)permissions.push('actions.prepare');
  if(normalizeRole(user.role)==='Admin'||normalizeRole(user.role)==='Management')permissions.push('actions.approve');
  return [...new Set(permissions)];
}
function xeroDate(value){
  if(!value)return null;const s=String(value),m=s.match(/\/Date\((\d+)/);if(m)return new Date(Number(m[1])).toISOString().slice(0,10);
  const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):s.slice(0,10);
}
function financeDocumentRows(workspace,documents){
  const pos=new Map(arr(workspace.purchaseOrders).map(x=>[String(x.id),x])),orders=new Map(arr(workspace.salesOrders).map(x=>[String(x.id),x]));
  const supplierBills=[],customerInvoices=[];
  for(const d of documents||[]){
    const remote=d.remote||{},payload=d.payload||{},gross=Number(remote.Total??payload.Total??((Number(d.amount_due||0)+Number(d.amount_paid||0)+Number(d.amount_credited||0))||0)),vat=Number(remote.TotalTax??payload.TotalTax??0),net=Number(remote.SubTotal??payload.SubTotal??Math.max(0,gross-vat));
    if(d.kind==='ACCPAY'){
      const po=pos.get(String(d.source_id))||{};
      supplierBills.push({id:d.id,supplier:po.supplier||remote.Contact?.Name||payload.Contact?.Name||'',invoiceNumber:d.xero_number||remote.InvoiceNumber||payload.InvoiceNumber||d.id,projectId:po.projectId||po.jobId||'',amountNet:net,vat,dueDate:xeroDate(remote.DueDate||remote.DueDateString||payload.DueDate),status:d.status||remote.Status||'Unpaid',linkedPoIds:d.source_id?[d.source_id]:[]});
    }else if(d.kind==='ACCREC'){
      const order=orders.get(String(d.source_id))||{};
      customerInvoices.push({id:d.id,projectId:order.projectId||order.jobId||'',customerId:order.customerId||'',amountNet:net,dueDate:xeroDate(remote.DueDate||remote.DueDateString||payload.DueDate),status:d.status||remote.Status||'Draft',expectedPaymentDate:null});
    }
  }
  return {supplierBills,customerInvoices};
}
async function enrichFinance(workspace,workspaceId,authorization){
  const documents=await rest(`ps_finance_documents?workspace_id=eq.${enc(workspaceId)}&select=id,source_id,kind,xero_number,status,amount_due,amount_paid,amount_credited,payload,remote,updated_at&order=created_at.desc&limit=500`,{authorization,optional:true});
  if(!documents)return workspace;
  const rows=financeDocumentRows(workspace,documents),copy=structuredClone(workspace);
  copy.supplierBills=[...arr(copy.supplierBills),...rows.supplierBills];
  copy.customerInvoices=[...arr(copy.customerInvoices),...rows.customerInvoices];
  return copy;
}
export async function loadAzzyPoolShedContext(req){
  const auth=await authUser(req),workspaceId=WORKSPACE_ID,authorization=requestAuthorization(req);
  const [members,profiles,snapshots,revisions]=await Promise.all([
    rest(`ps_workspace_members?workspace_id=eq.${enc(workspaceId)}&user_id=eq.${enc(auth.id)}&select=workspace_id,user_id,role&limit=1`,{authorization}),
    rest(`user_profiles?id=eq.${enc(auth.id)}&select=id,full_name,email,role,active,permissions&limit=1`,{authorization}),
    rest(`workspace_snapshots?workspace_id=eq.${enc(workspaceId)}&select=data,updated_at&limit=1`,{authorization}),
    rest(`ps_workspace_revisions?workspace_id=eq.${enc(workspaceId)}&select=id&order=id.desc&limit=1`,{authorization,optional:true})
  ]);
  const member=members?.[0];if(!member)throw httpError('Azzy access denied for this workspace.',403);
  const profile=profiles?.[0]||{};if(profile.active===false)throw httpError('This Pool Shed account is inactive.',403);
  const snapshot=snapshots?.[0];if(!snapshot?.data)throw httpError('Pool Shed workspace data is unavailable.',503);
  const user={id:auth.id,full_name:profile.full_name||auth.user_metadata?.full_name||auth.email||'Pool Shed user',email:profile.email||auth.email||'',role:normalizeRole(profile.role||member.role),permissions:profile.permissions&&typeof profile.permissions==='object'?profile.permissions:{}};
  const permissions=deriveAzzyPermissions(snapshot.data,user),revision=Number(revisions?.[0]?.id||0)+1;
  let workspace=snapshot.data;
  if(permissions.includes('finance.read'))workspace=await enrichFinance(workspace,workspaceId,authorization);
  return {workspaceId,workspace,user,permissions,revision,updatedAt:snapshot.updated_at,membershipRole:member.role};
}
function normalizedOrigin(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{return new URL(raw).origin;}catch(_){return raw.replace(/\/+$/,'');}
}
function firstHeader(value){return String(Array.isArray(value)?value[0]:(value||'')).split(',')[0].trim();}
export function azzyOriginAllowed(req){
  const supplied=firstHeader(req?.headers?.origin);
  if(!supplied)return true;
  const incoming=normalizedOrigin(supplied);
  if(!incoming)return false;

  // Azzy is called by the Pool Shed browser on the same host as /api/azzy.
  // Accept that same-origin request even when Vercel is serving an alias or
  // Preview hostname that does not exactly match APP_ORIGIN.
  const requestHost=firstHeader(req?.headers?.['x-forwarded-host']||req?.headers?.host).toLowerCase();
  try{
    if(requestHost&&new URL(incoming).host.toLowerCase()===requestHost)return true;
  }catch(_){}

  const allowed=new Set();
  const add=value=>{
    String(value||'').split(',').map(v=>normalizedOrigin(v)).filter(Boolean).forEach(v=>allowed.add(v));
  };
  add(process.env.APP_ORIGIN);
  add(process.env.APP_ORIGINS);
  if(process.env.VERCEL_PROJECT_PRODUCTION_URL)add('https://'+String(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//,'').replace(/\/+$/,''));
  if(process.env.VERCEL_URL)add('https://'+String(process.env.VERCEL_URL).replace(/^https?:\/\//,'').replace(/\/+$/,''));

  // Preserve the previous local-development behaviour when no origin policy is
  // configured. Production Vercel requests are still covered by the host check.
  if(!allowed.size)return true;
  return allowed.has(incoming);
}
