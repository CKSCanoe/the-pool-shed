import '../public/project-engine.js';
import {db,eq,audit,hash} from '../server/accounting.js';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!process.env.APP_ORIGIN||req.headers.origin!==process.env.APP_ORIGIN)return res.status(403).json({error:'Invalid origin'});
 try{
  const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))throw Error('Sign in first');
  const ur=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!ur.ok)return res.status(401).json({error:'Sign in first'});const user=await ur.json();
  let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>24000)return res.status(413).json({error:'Request too large'});chunks.push(chunk)}const body=JSON.parse(Buffer.concat(chunks).toString()||'{}'),w=String(body.workspace||'pool-bros-main');
  const members=await db('ps_workspace_members?workspace_id=eq.'+eq(w)+'&user_id=eq.'+eq(user.id));if(!members.some(m=>m.role==='admin'))return res.status(403).json({error:'Project administrator access required'});
  const [snapshot]=await db('workspace_snapshots?workspace_id=eq.'+eq(w)),source=snapshot?.data,job=source?.jobs?.find(j=>j.id===body.jobId),extra=job?.project?.variations?.find(v=>v.id===body.extraId);if(!extra||extra.status!=='Proposed')throw Error('Sync the current proposed extra before sending.');
  const customer=source.customers?.find(c=>c.id===job.customerId),recipient=String(customer?.email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw Error('Set a valid email on the project customer record first.');
  const message=globalThis.PoolShedProjectEngine.extraMessage(job,extra);if(JSON.stringify(message)!==body.expected||recipient!==body.recipient)throw Error('Project, price or recipient changed. Refresh and review the email again.');
  globalThis.PoolShedProjectEngine.extraCheck(job,extra,source);
  const key=hash(w+'|'+recipient+'|'+JSON.stringify(message));const previous=await db('ps_finance_audit?workspace_id=eq.'+eq(w)+'&action=eq.project_extra_email&detail->>key=eq.'+eq(key)+'&limit=1');if(previous[0]?.detail?.result)return res.status(200).json({...previous[0].detail.result,alreadySent:true});
  if(!process.env.RESEND_API_KEY||!process.env.QUOTE_FROM_EMAIL)return res.status(503).json({error:'Project email is not configured. Set RESEND_API_KEY and QUOTE_FROM_EMAIL in Vercel. No email was sent.'});
  const cash=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n),vat=Math.round(message.sellNet*message.vatRate)/100;
  const text=`Hello ${customer.name||''},\n\nFollowing your request, please review this extra for ${message.projectName}.\n\n${message.title}\n${message.scope}\n\nAdditional selling price: ${cash(message.sellNet)} excluding VAT\nVAT (${message.vatRate}%): ${cash(vat)}\nTotal: ${cash(message.sellNet+vat)}\n\nProgramme impact: ${message.programmeImpact}\n${message.approvalDue?'Please reply by '+message.approvalDue+'.\n':''}\nThis is additional to ${message.quoteRef||'your original agreement'}. Please reply to confirm approval or ask any questions, quoting ${message.extraId}, version ${message.version}. We will record your agreement before proceeding with this extra. Payment will follow the agreed billing schedule.\n\nKind regards,\nPool Bros`;
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'project-extra-'+key},body:JSON.stringify({from:process.env.QUOTE_FROM_EMAIL,to:[recipient],subject:'Pool Bros · Extra for approval · '+message.projectName,text}),signal:AbortSignal.timeout(15000)});const result=await sent.json();if(!sent.ok)throw Error(result.message||'Email provider rejected the request.');
  const response={sent:true,status:'provider_accepted',messageId:result.id,recipient,sentAt:new Date().toISOString()};await audit(w,user.id,'project_extra_email',{key,jobId:job.id,extraId:extra.id,version:message.version,result:response});return res.status(200).json(response);
 }catch(e){return res.status(400).json({error:e.message||'Project email failed'})}
}
