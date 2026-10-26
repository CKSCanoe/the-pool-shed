import { randomBytes } from 'node:crypto';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('GET required');
  const nonce = randomBytes(16).toString('base64');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  return res.status(200).send(`<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pool Bros | iPad audit recovery</title>
<style>
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1b2634;background:#f2f5f8}*{box-sizing:border-box}body{margin:0}main{max-width:840px;margin:auto;padding:24px 18px 70px}.brand{display:flex;align-items:center;gap:13px;margin-bottom:24px}.mark{display:grid;place-items:center;width:46px;height:46px;background:#c62834;border-radius:12px;color:#fff;font-size:20px;font-weight:900}.brand strong{display:block;font-size:17px}.brand span{display:block;font-size:11px;color:#68778a;letter-spacing:.12em;font-weight:800}h1{font-size:clamp(28px,5vw,42px);letter-spacing:-.05em;line-height:1.05;margin:0 0 12px}h2{font-size:18px;margin:0 0 12px}.intro{color:#516176;line-height:1.6;font-size:15px;max-width:700px}.panel{background:#fff;border:1px solid #dfe5eb;border-radius:18px;padding:21px;margin:17px 0;box-shadow:0 8px 24px #18253609}.warning{background:#fff6dc;border-color:#e8d29b}.warning strong{display:block;margin-bottom:6px}.warning p,.panel p{line-height:1.55}.muted{color:#657489;font-size:13px}.button{min-height:46px;padding:11px 17px;border-radius:10px;border:1px solid #cbd4de;background:#fff;color:#24344a;font-size:14px;font-weight:800;cursor:pointer}.button.primary{background:#bd2935;color:#fff;border-color:#bd2935}.button:disabled{opacity:.5;cursor:not-allowed}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}.status{min-height:22px;font-size:14px;color:#39536e;margin-top:12px}.status.error{color:#a12330}select{display:block;width:100%;max-width:650px;min-height:46px;border:1px solid #cbd4de;border-radius:10px;background:#fff;padding:10px;font-size:14px}label{font-size:13px;font-weight:800;display:block;margin:15px 0 7px}.photo{display:flex;gap:13px;align-items:center;padding:12px 0;border-top:1px solid #e6ebef}.photo img{width:86px;height:86px;object-fit:cover;border-radius:9px;background:#eef2f6;flex:none}.photo .details{min-width:0;flex:1}.photo strong,.photo small{display:block;overflow-wrap:anywhere}.photo small{color:#657489;margin-top:5px}.photo .button{white-space:nowrap}#results[hidden],#auditCopy[hidden]{display:none}@media(max-width:570px){.photo{align-items:flex-start;flex-wrap:wrap}.photo .button{width:100%}}
</style></head><body><main>
<div class="brand"><div class="mark">PB</div><div><strong>Pool Bros</strong><span>DEVICE RECOVERY</span></div></div>
<h1>Protect your audit photos</h1><p class="intro">This page reads the photos already stored by Pool Shed on this iPad. It does not upload, remove or change any audit data.</p>
<section class="panel warning"><strong>Keep the original audit tab open</strong><p>First take screenshots of any answers that still appear there. Do not refresh that tab, clear Safari website data, sign out or delete Pool Shed. Open this page in a <strong>separate tab on the same iPad and in the same browser</strong>.</p></section>
<section class="panel"><h2>Find the device copy</h2><p class="muted">Tap Scan this iPad. You will then choose the visit and save the original image files to Files or Photos. A stored audit backup, if available, may be older than what is visible in the original tab.</p><button class="button primary" id="scan" type="button">Scan this iPad</button><p class="status" id="status" role="status" aria-live="polite"></p></section>
<section class="panel" id="results" hidden><h2>Stored visits and photos</h2><label for="visit">Select the Bettridge visit</label><select id="visit"></select><p class="muted" id="visitDetails"></p><div class="actions"><button class="button primary" id="saveAll" type="button">Share all photos</button><button class="button" id="auditCopy" type="button" hidden>Save stored audit copy</button></div><p class="status" id="resultStatus" role="status" aria-live="polite"></p><div id="photos"></div></section>
</main><script nonce="${nonce}">
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = (message, error) => { $('status').textContent=message; $('status').className='status'+(error?' error':''); };
  const resultStatus = (message, error) => { $('resultStatus').textContent=message; $('resultStatus').className='status'+(error?' error':''); };
  const safe = value => String(value||'audit').replace(/[^a-z0-9_-]+/gi,'-').slice(0,70);
  const groups = [];
  let objectUrls = [];

  async function readStore(name, storeName, key) {
    return new Promise((resolve, reject) => {
      const open=indexedDB.open(name);
      open.onerror=()=>reject(open.error||Error('Device storage could not be opened.'));
      open.onsuccess=()=>{
        const db=open.result;
        if(!db.objectStoreNames.contains(storeName)){db.close();resolve(key===undefined?[]:null);return;}
        const tx=db.transaction(storeName,'readonly');
        const request=key===undefined?tx.objectStore(storeName).getAll():tx.objectStore(storeName).get(key);
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>reject(request.error||Error('Device storage could not be read.'));
        tx.oncomplete=()=>db.close();
        tx.onabort=()=>db.close();
      };
    });
  }
  function directDownload(file) {
    const url=URL.createObjectURL(file),link=document.createElement('a');
    link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function saveFile(file) {
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:file.name});
      return;
    }
    directDownload(file);
  }
  function imageFile(entry, index) {
    const extension=entry.type==='image/png'?'png':'jpg';
    const name='PoolBros_'+safe(entry.auditId)+'_photo-'+String(index+1).padStart(2,'0')+'.'+extension;
    return new File([entry.blob],name,{type:entry.type||'image/jpeg'});
  }
  function chosen(){return groups[Number($('visit').value)]||null;}
  function render() {
    objectUrls.forEach(url=>URL.revokeObjectURL(url));objectUrls=[];
    const group=chosen();if(!group)return;
    $('visitDetails').textContent=group.photos.length+' original photo'+(group.photos.length===1?'':'s')+' stored on this iPad'+(group.audit?' · stored audit last updated '+(group.audit.updatedAt||'date unknown'):' · no stored audit copy found');
    $('saveAll').disabled=!group.photos.length;
    $('auditCopy').hidden=!group.audit;
    $('photos').replaceChildren();
    group.photos.forEach((entry,index)=>{
      const row=document.createElement('div');row.className='photo';
      const img=document.createElement('img');const url=URL.createObjectURL(entry.blob);objectUrls.push(url);img.src=url;img.alt='Stored evidence photo '+(index+1);
      const details=document.createElement('div');details.className='details';
      const title=document.createElement('strong');title.textContent='Photo '+(index+1);
      const meta=document.createElement('small');meta.textContent=(entry.meta&&entry.meta.notes||entry.itemId||'Audit evidence')+' · '+(entry.createdAt||'date unknown');
      details.append(title,meta);
      const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Save photo';
      button.onclick=async()=>{try{await saveFile(imageFile(entry,index));resultStatus('Photo '+(index+1)+' sent to the iPad share sheet. Confirm it is in Files or Photos.');}catch(error){if(error.name!=='AbortError')resultStatus(error.message||'Could not save this photo.',true);}};
      row.append(img,details,button);$('photos').append(row);
    });
  }
  $('scan').onclick=async()=>{
    $('scan').disabled=true;status('Reading Pool Shed device storage…');
    try{
      if(!localStorage.getItem('poolshed:v169:sessionUserId'))throw Error('No signed-in Pool Shed session was found in this browser. Leave the original tab open and contact Pool Bros support.');
      const photos=await readStore('pool-shed-audit-media-v1','photos');
      const latest=await readStore('pool-shed-live-v1.8','snapshots','latest').catch(()=>null);
      let local=null;try{local=JSON.parse(localStorage.getItem('poolshed:v172:appData')||'null');}catch(_){}
      const snapshots=[local,latest&&latest.data].filter(Boolean),customers=new Map(),audits=new Map();
      for(const snapshot of snapshots){
        for(const customer of snapshot.customers||[])customers.set(customer.id,customer.companyName||customer.name||customer.id);
        for(const audit of snapshot.poolAudits||[]){
          const old=audits.get(audit.id);
          if(!old||String(audit.updatedAt||'')>String(old.updatedAt||''))audits.set(audit.id,audit);
        }
      }
      const byKey=new Map();
      for(const entry of photos||[]){
        if(!entry||!entry.auditId||!entry.customerId||!entry.blob||!entry.blob.size)continue;
        const key=entry.customerId+'|'+entry.auditId;
        if(!byKey.has(key))byKey.set(key,{customerId:entry.customerId,auditId:entry.auditId,photos:[],audit:audits.get(entry.auditId)||null});
        byKey.get(key).photos.push(entry);
      }
      for(const audit of audits.values()){
        const key=audit.customerId+'|'+audit.id;
        if(!byKey.has(key))byKey.set(key,{customerId:audit.customerId,auditId:audit.id,photos:[],audit});
      }
      groups.splice(0,groups.length,...Array.from(byKey.values()).sort((a,b)=>{
        const aName=customers.get(a.customerId)||'',bName=customers.get(b.customerId)||'';
        return Number(/bettridge/i.test(bName))-Number(/bettridge/i.test(aName))||b.photos.length-a.photos.length;
      }));
      $('visit').replaceChildren();
      groups.forEach((group,index)=>{
        const option=document.createElement('option');option.value=String(index);
        option.textContent=(customers.get(group.customerId)||group.customerId)+' · '+(group.audit&&group.audit.metadata&&group.audit.metadata['site-name']||group.auditId)+' · '+group.photos.length+' photos';
        $('visit').append(option);
      });
      if(!groups.length)throw Error('No stored audit or photo copy was found in this browser. Keep the original audit tab open.');
      $('results').hidden=false;render();
      status('Found '+groups.length+' stored visit'+(groups.length===1?'':'s')+'. Select Bettridge School and save the photos.');
    }catch(error){status(error.message||'Could not read device storage.',true);$('scan').disabled=false;}
  };
  $('visit').onchange=()=>{resultStatus('');render();};
  $('saveAll').onclick=async()=>{
    const group=chosen();if(!group)return;
    const files=group.photos.map(imageFile);
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){
        await navigator.share({files,title:'Pool Bros audit photos'});
        resultStatus('Share sheet opened for '+files.length+' photos. Confirm all files were saved.');
      }else resultStatus('This browser cannot share all photos together. Use Save photo beside each image.',true);
    }catch(error){if(error.name!=='AbortError')resultStatus(error.message||'Use the individual Save photo buttons.',true);}
  };
  $('auditCopy').onclick=async()=>{
    const group=chosen();if(!group||!group.audit)return;
    const body=JSON.stringify({kind:'pool-bros-commercial-audit',version:1,exportedAt:new Date().toISOString(),audit:group.audit},null,2);
    const file=new File([body],'PoolBros_Stored_Audit_'+safe(group.audit.metadata&&group.audit.metadata['site-name']||group.auditId)+'.json',{type:'application/json'});
    try{await saveFile(file);resultStatus('Stored audit copy sent to Files. It may be older than the answers in the original tab.');}
    catch(error){if(error.name!=='AbortError')resultStatus(error.message||'Could not save audit copy.',true);}
  };
})();
</script></body></html>`);
}
