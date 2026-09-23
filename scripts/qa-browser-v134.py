from pathlib import Path
import re, json, sys
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
ART=ROOT/'qa-v134'; ART.mkdir(exist_ok=True)
IMG=ART/'product-media-test.jpg'
im=Image.new('RGB',(1000,700),(217,231,232)); d=ImageDraw.Draw(im); d.rectangle((80,80,920,620),fill=(93,150,160)); d.text((110,110),'Pool Bros secure product/customer media QA',fill=(24,48,54)); im.save(IMG,quality=88)

def inline_internal():
    html=(PUBLIC/'index.html').read_text()
    styles=[]
    def css(m):
        src=m.group(1)
        if src.startswith('http'): return ''
        p=PUBLIC/src.split('?')[0].replace('./','')
        if p.exists(): styles.append(p.read_text())
        return ''
    html=re.sub(r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',css,html,flags=re.I)
    scripts=[]
    def js(m):
        src=m.group(2)
        if src.startswith('http'): return ''
        p=PUBLIC/src.split('?')[0].replace('./','')
        if p.exists(): scripts.append('\n/* '+p.name+' */\n'+p.read_text()+'\n')
        return ''
    html=re.sub(r'<script\b([^>]*)src=["\']([^"\']+)["\'][^>]*></script>',js,html,flags=re.I)
    harness="""<script>(function(){const mem=new Map();const ls={getItem:k=>mem.has(String(k))?mem.get(String(k)):null,setItem:(k,v)=>mem.set(String(k),String(v)),removeItem:k=>mem.delete(String(k)),clear:()=>mem.clear(),key:i=>Array.from(mem.keys())[i]||null,get length(){return mem.size}};try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){}window.POOL_SHED_CONFIG={};if(!window.crypto)window.crypto={};if(typeof window.crypto.randomUUID!=='function')window.crypto.randomUUID=()=>('00000000-0000-4000-8000-'+Math.random().toString(16).slice(2,14).padEnd(12,'0'));})();</script>"""
    return html.replace('</head>','<style>'+''.join(styles)+'</style>'+harness+'</head>').replace('</body>','<script>'+''.join(scripts)+'</script></body>')

errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1536,'height':1100})
    page=ctx.new_page()
    page.on('pageerror',lambda e:errors.append('pageerror: '+str(e)))
    page.on('console',lambda m:errors.append('console: '+m.text) if m.type=='error' and 'favicon' not in m.text.lower() else None)
    page.set_content(inline_internal(),wait_until='load',timeout=30000)
    page.evaluate("""()=>{
      data=normalizeAppData(JSON.parse(JSON.stringify(seed)));isAuthenticated=true;showApp();
      data.products.push({id:'P-MEDIA',sku:'PB-MEDIA-1',name:'Premium Pool Pump',category:'Plant',supplier:'Pool Supplier',supplierSku:'SUP-PP-1',cost:500,rrp:1195,description:'Quiet premium circulation pump'});
      data.customers.push({id:'C-MEDIA',name:'Media Test Customer',email:'media@example.invalid',priceList:'rrp'});
      window.__POOL_SHED_AUTH_TOKEN__=async()=> 'qa-token';
      let no=0; const urls={};
      window.fetch=async function(url,opts){
        const s=String(url), u=new URL(s,'https://qa.invalid'), a=u.searchParams.get('action')||'';
        if(a==='product-upload'||a==='customer-upload'){
          no++; const id=(no===1?'11111111-1111-4111-8111-111111111111':no===2?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333');
          const domain=a.startsWith('product')?'product':'customer', ref=domain+'-media:'+id;
          const preview='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"%3E%3Crect width="1000" height="700" fill="%235e97a0"/%3E%3C/svg%3E'; urls[ref]=preview;
          const kind=u.searchParams.get('kind')||'other';
          return new Response(JSON.stringify({media:{id,ref,domain,entityId:u.searchParams.get(domain==='product'?'productId':'customerId'),kind,name:'qa-media.jpg',type:'image/jpeg',size:12345,title:'QA media',previewUrl:preview}}),{status:201,headers:{'Content-Type':'application/json'}});
        }
        if(a==='sign'){
          const refs=(u.searchParams.get('refs')||'').split(',').filter(Boolean), out={};refs.forEach(r=>out[r]=urls[r]||'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3C/svg%3E');
          return new Response(JSON.stringify({urls:out}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(a==='archive')return new Response(JSON.stringify({archived:true}),{status:200,headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}});
      };
      active='products';productView='list';render();
    }""")

    page.locator('[data-ph-open-product="P-MEDIA"]').click(); page.wait_for_timeout(80)
    page.locator('[data-ph-product-tab="Media & Docs"]').click(); page.wait_for_timeout(80)
    assert page.get_by_text('Product presentation',exact=True).count()==1
    with page.expect_file_chooser() as fc:
        page.locator('[data-ph-media-upload="main_image"]').click()
    fc.value.set_files(str(IMG)); page.wait_for_timeout(250)
    product_state=page.evaluate("""()=>{const p=data.products.find(x=>x.id==='P-MEDIA');return {image:p.imageUrl||'',gallery:p.galleryImages||[],brochure:p.brochureUrl||''}}""")
    assert product_state['image'].startswith('product-media:'), product_state

    # Upload a brochure using the same supported image mime to exercise secure doc slot.
    with page.expect_file_chooser() as fc2:
        page.locator('[data-ph-media-upload="brochure"]').click()
    fc2.value.set_files(str(IMG)); page.wait_for_timeout(250)
    product_state=page.evaluate("""()=>{const p=data.products.find(x=>x.id==='P-MEDIA');return {image:p.imageUrl||'',brochure:p.brochureUrl||''}}""")
    assert product_state['brochure'].startswith('product-media:'), product_state
    page.screenshot(path=str(ART/'product-hub-media.png'),full_page=True)

    # CRM Files tab and customer/site upload.
    page.evaluate("""()=>{active='crm';selectedCrmCustomerId='C-MEDIA';render();}"""); page.wait_for_timeout(100)
    page.locator('[data-crm-profile-tab="files"]').click(); page.wait_for_timeout(50)
    assert page.get_by_text('Files & Site Media',exact=True).count()==1
    with page.expect_file_chooser() as fc3:
        page.locator('[data-crm-media-upload="site_photo"]').click()
    fc3.value.set_files(str(IMG)); page.wait_for_timeout(250)
    customer_state=page.evaluate("""()=>{const c=data.customers.find(x=>x.id==='C-MEDIA');return c.mediaAttachments||[]}""")
    assert len(customer_state)==1 and customer_state[0]['ref'].startswith('customer-media:'), customer_state
    page.screenshot(path=str(ART/'crm-customer-files.png'),full_page=True)

    # Quote Studio must inherit approved Product Hub image + brochure refs.
    inherited=page.evaluate("""()=>{const q=PoolShedQuoteStudio.createQuote({customerId:'C-MEDIA',projectName:'Media inheritance quote',workflow:'quick'});const s=q.sections[0];const o=PoolShedQuoteStudio.addProductOption(q.id,s.id,'P-MEDIA');return {image:o.image,brochure:o.brochure};}""")
    assert inherited['image'].startswith('product-media:'), inherited
    assert inherited['brochure'].startswith('product-media:'), inherited

    browser.close()

if errors:
    print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print(json.dumps({'browser':'Chromium','ProductHubSecureUpload':'PASS','ProductDocsUpload':'PASS','CRMCustomerFiles':'PASS','QuoteStudioProductMediaInheritance':'PASS','RuntimeErrors':0,'screenshots':str(ART)},indent=2))
