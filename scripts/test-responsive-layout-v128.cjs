const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const ROOT=process.cwd(),PUBLIC=path.join(ROOT,'public');
function inlineAppHtml(){let html=fs.readFileSync(path.join(PUBLIC,'index.html'),'utf8');const styles=[];html=html.replace(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi,(tag,href)=>{const rel=href.split('?')[0].replace(/^\.\//,'');const p=path.join(PUBLIC,rel);if(fs.existsSync(p))styles.push(fs.readFileSync(p,'utf8'));return '';});const scripts=[];html=html.replace(/<script\b([^>]*)src=["']([^"']+)["'][^>]*><\/script>/gi,(tag,attrs,src)=>{if(/^https?:/i.test(src))return '';const rel=src.split('?')[0].replace(/^\.\//,'');const p=path.join(PUBLIC,rel);if(fs.existsSync(p))scripts.push(`\n/* ${rel} */\n${fs.readFileSync(p,'utf8')}\n`);return '';});const harness=`<script>(function(){const mem=new Map();const ls={getItem:k=>mem.has(String(k))?mem.get(String(k)):null,setItem:(k,v)=>mem.set(String(k),String(v)),removeItem:k=>mem.delete(String(k)),clear:()=>mem.clear(),key:i=>Array.from(mem.keys())[i]||null,get length(){return mem.size}};try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){}window.POOL_SHED_CONFIG={};if(!window.crypto)window.crypto={};if(typeof window.crypto.randomUUID!=='function')window.crypto.randomUUID=()=>('00000000-0000-4000-8000-'+Math.random().toString(16).slice(2,14).padEnd(12,'0'));})();</script>`;html=html.replace('</head>',`<style>${styles.join('\n')}</style>${harness}</head>`);html=html.replace('</body>',`<script>${scripts.join('\n')}</script></body>`);return html;}
const widths=[1920,1440,1280,1100,768,390];
const compactWidths=[1440,768,390];
const selfManaged=new Set(['settings','automation','locations','products','fulfilment','warehouse']);
function label(el){return `${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${el.classList.length?'.'+[...el.classList].slice(0,3).join('.'):''}`;}
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|resource/i.test(m.text()))errors.push('console: '+m.text());});
 await page.setContent(inlineAppHtml(),{waitUntil:'load',timeout:30000});await page.waitForTimeout(100);
 await page.evaluate(()=>{data=normalizeAppData(JSON.parse(JSON.stringify(seed)));isAuthenticated=true;showApp();render();});
 const modules=await page.evaluate(()=>tabs.map(t=>({id:t.id,label:t.label})));
 const subgroups={};for(const m of modules)subgroups[m.id]=await page.evaluate(id=>sidebarSubGroups(id),m.id);
 Object.assign(subgroups,{
   settings:['Overview','Production Readiness','Users','Roles & Permissions','Approval Limits','Locations & Access','Financial Visibility','Automation & Assistant','Integrations','Notifications','Company Settings','Audit & Security'],
   analytics:['Overview','Sales & Margin','Projects','Operations','Customers','Suppliers','Inventory','Products','Metric Library','Reports & Data Export'],
   automation:['Automation Overview','Alerts & Escalations','Scheduled Jobs','Automation Runs','Flow Builder','Azzy Assistant'],
   accounting:['Overview','Customer Accounts','Payments & Allocations','Invoice Ready','Supplier Bills','Three-Way Match','Payment Runs','Reconciliation','Month End','Xero Sync']
 });
 const failures=[];let checks=0;
 async function inspect(module,sub,width,density,theme){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(({module,sub,density,theme})=>{active=module;if(sub)activeSubPage[module]=sub;document.documentElement.dataset.density=density;document.body.setAttribute('data-theme',theme);render();},{module,sub,density,theme});
   const info=await page.evaluate(()=>{const vw=innerWidth,s=document.getElementById('screen-'+active);const visible=e=>{const r=e.getBoundingClientRect(),st=getComputedStyle(e);return st.display!=='none'&&st.visibility!=='hidden'&&r.width>1&&r.height>1};const protectedByScroller=e=>{let a=e.parentElement;while(a&&a!==document.body){const st=getComputedStyle(a);if((st.overflowX==='auto'||st.overflowX==='scroll')&&a.scrollWidth>a.clientWidth+2)return true;a=a.parentElement;}return false};const clipped=[];const internal=[];for(const e of [...s.querySelectorAll('*')].filter(visible)){const r=e.getBoundingClientRect(),st=getComputedStyle(e);if((r.right>vw+4||r.left<-4)&&!protectedByScroller(e))clipped.push({sel:(e.tagName.toLowerCase()+'.'+[...e.classList].slice(0,2).join('.')),right:Math.round(r.right),text:(e.innerText||'').trim().slice(0,42)});if(e.scrollWidth>e.clientWidth+5){const selfScroll=st.overflowX==='auto'||st.overflowX==='scroll';const semanticWide=['TABLE','TH','TD'].includes(e.tagName);if(!selfScroll&&!semanticWide&&!protectedByScroller(e))internal.push({sel:(e.tagName.toLowerCase()+'.'+[...e.classList].slice(0,2).join('.')),cw:e.clientWidth,sw:e.scrollWidth,text:(e.innerText||'').trim().slice(0,42)});}}
     return {screenCW:s?.clientWidth||0,screenSW:s?.scrollWidth||0,docW:document.documentElement.scrollWidth,clipped:clipped.slice(0,6),internal:internal.slice(0,6),conflict:!!document.getElementById('psSyncConflict'),genericNav:s?Array.from(s.children).filter(e=>e.classList?.contains('ps-section-nav')).length:0};});
   checks++;
   const reasons=[];if(info.docW>width+3)reasons.push(`document ${info.docW}>${width}`);if(info.screenSW>info.screenCW+3)reasons.push(`screen ${info.screenSW}>${info.screenCW}`);if(info.clipped.length)reasons.push('clipped '+JSON.stringify(info.clipped));if(info.internal.length)reasons.push('internal overflow '+JSON.stringify(info.internal));if(info.conflict)reasons.push('workspace conflict banner rendered');if(selfManaged.has(module)&&info.genericNav)reasons.push('duplicate generic section nav');
   if(reasons.length)failures.push({module,sub:sub||'default',width,density,theme,reasons});
 }
 // Every top-level module, every audit width, both density modes in light theme.
 for(const m of modules)for(const density of ['compact','comfortable'])for(const width of widths)await inspect(m.id,'',width,density,'light');
 // Every discoverable subpage at desktop, tablet and phone comfortable mode.
 for(const m of modules)for(const sub of (subgroups[m.id]||[]))for(const width of [1440,768,390])await inspect(m.id,sub,width,'comfortable','light');
 // Dark-mode structural acceptance across all modules at representative widths.
 for(const m of modules)for(const width of compactWidths)await inspect(m.id,'',width,'compact','dark');
 if(errors.length)failures.push({runtime:errors});
 if(failures.length){console.error(JSON.stringify({checks,failures:failures.slice(0,80)},null,2));process.exitCode=1;return;}
 console.log(JSON.stringify({release:'1.28.0',modules:modules.length,checks,widths,densities:['compact','comfortable'],themes:['light','dark'],hardOverflow:0,duplicateNav:0,blockingConflictBanner:0,runtimeErrors:0},null,2));
 }finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exit(1)});
