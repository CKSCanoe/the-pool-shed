// Server-side tool. Never put the service role key in public/config.js.
import {writeFile,readFile} from 'node:fs/promises';
import {db,hash,seal,unseal} from '../server/accounting.js';
const [mode,path]=process.argv.slice(2);
if(!path||!['export','verify'].includes(mode))throw Error('Usage: node scripts/accounting-backup.mjs export|verify /secure/path/backup.json');
if(!process.env.BACKUP_ENCRYPTION_KEY)throw Error('Set a separate BACKUP_ENCRYPTION_KEY (32 random bytes, base64)');
if(mode==='export'){
 const workspace=process.env.FINANCE_WORKSPACE_ID||'pool-bros-main',tables={};
 for(const table of ['workspace_snapshots','ps_finance_members','ps_finance_documents','ps_finance_jobs','ps_finance_audit']){
  const rows=[];let offset=0;
  while(true){const batch=await db(table+'?workspace_id=eq.'+encodeURIComponent(workspace)+'&order='+(table==='workspace_snapshots'?'workspace_id':table==='ps_finance_members'?'user_id':'id')+'&limit=500&offset='+offset);rows.push(...batch);if(batch.length<500)break;offset+=500;}
  tables[table]=rows;
 }
 const payload=JSON.stringify({version:1,workspace,createdAt:new Date().toISOString(),tables});
 await writeFile(path,JSON.stringify({sha256:hash(payload),encrypted:seal(payload,process.env.BACKUP_ENCRYPTION_KEY)}),{mode:0o600,flag:'wx'});
 console.log('Encrypted export written. This is not a transaction-consistent database backup; pause writes for a coherent export. Run verify, and retain managed database backups separately.');
}else{
 const file=JSON.parse(await readFile(path,'utf8')),payload=unseal(file.encrypted,process.env.BACKUP_ENCRYPTION_KEY);if(hash(payload)!==file.sha256)throw Error('Checksum mismatch');
 const data=JSON.parse(payload);if(data.version!==1||!data.tables)throw Error('Unsupported backup');
 const docs=new Set(data.tables.ps_finance_documents.map(d=>d.id));for(const job of data.tables.ps_finance_jobs)if(!docs.has(job.document_id))throw Error('Orphaned accounting job');
 console.log('Encryption, checksum and document/job links verified. No live data changed. A real restore drill remains required.');
}
