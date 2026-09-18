from pathlib import Path
import json, re, sys
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
ART=ROOT/'qa-v132'; ART.mkdir(exist_ok=True)
IMG=ART/'pool-visual.jpg'
im=Image.new('RGB',(1200,800),(218,232,232));d=ImageDraw.Draw(im);d.rectangle((90,140,1110,660),fill=(94,151,160));d.rectangle((160,200,1040,600),fill=(150,205,212));d.text((110,90),'Pool Bros project visual',fill=(30,55,50));im.save(IMG,quality=88)

def inline_internal():
    html=(PUBLIC/'index.html').read_text()
    styles=[]
    def css(m):
        p=PUBLIC/m.group(1).split('?')[0].replace('./','')
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

def inline_customer(public_payload):
    html=(PUBLIC/'proposal.html').read_text();css=(PUBLIC/'quote-customer-portal.css').read_text();js=(PUBLIC/'quote-customer-portal.js').read_text()
    html=re.sub(r'<link\b[^>]*href=["\']\./quote-customer-portal\.css[^"\']*["\'][^>]*>','<style>'+css+'</style>',html,flags=re.I)
    payload={'proposal':public_payload,'publication':{'id':'P1','quoteId':public_payload['quoteId'],'version':1,'status':'live','expiresAt':'2026-10-18','accepted':False},'customerState':{'selections':{}}}
    accepted={'ok':True,'accepted':True,'id':'A1','acceptedAt':'2026-09-18T16:00:00Z','conversion':{'workflow':'quick','projectCreated':False,'salesOrderCreated':True,'paymentStatus':'Ready for Xero'}}
    harness="""<script>(function(){const Original=window.URLSearchParams;window.URLSearchParams=class extends Original{constructor(v){super(v||'?token=abcdefghijklmnopqrstuvwxyz123456')}};const publicPayload=%s;const acceptedPayload=%s;window.fetch=async function(url){const payload=String(url).includes('action=public')?publicPayload:acceptedPayload;return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});};})();</script>"""%(json.dumps(payload),json.dumps(accepted))
    html=re.sub(r'<script\b[^>]*src=["\']\./quote-customer-portal\.js[^"\']*["\'][^>]*></script>',lambda _:harness+'<script>'+js+'</script>',html,flags=re.I)
    return html

errs=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1536,'height':1100})
    page=ctx.new_page();page.on('pageerror',lambda e:errs.append('internal pageerror: '+str(e)));page.on('console',lambda m:errs.append('internal console: '+m.text) if m.type=='error' and 'favicon' not in m.text.lower() else None)
    page.set_content(inline_internal(),wait_until='load',timeout=30000)
    page.evaluate("""()=>{data=normalizeAppData(JSON.parse(JSON.stringify(seed)));isAuthenticated=true;showApp();data.customers.push({id:'C-QS',name:'Elite Quote Client',email:'qa@example.invalid',address:'QA Pool House',priceList:'rrp'});data.products.push({id:'P-QS',sku:'PB-QA-COVER',name:'Integrated Automatic Slatted Cover',category:'Cover',supplier:'QA Supplier',supplierSku:'QA-C1',cost:2500,rrp:6900});active='quotes';render();}""")
    page.locator('[data-qs-action="new-quote"]').click();page.locator('#qsCreateForm select[name="customerId"]').select_option('C-QS');page.locator('#qsCreateForm input[name="projectName"]').fill('Elite Pool Refurbishment');page.locator('#qsCreateForm').evaluate('(f)=>f.requestSubmit()');page.wait_for_timeout(100)
    # Hero upload via real file chooser.
    with page.expect_file_chooser() as fc_info: page.locator('[data-qs-upload-target="hero"]').click()
    fc_info.value.set_files(str(IMG));page.wait_for_timeout(350)
    hero=page.evaluate("()=>PoolShedQuoteStudio.listQuotes()[0].presentation.heroImage")
    assert hero.startswith('data:image/jpeg;base64,'), 'hero image did not persist as quote media'
    # Visual builder and Product Hub.
    page.locator('[data-qs-tab="Options & Packages"]').click();page.wait_for_timeout(80)
    page.locator('[data-qs-builder-panel="products"]').click();page.wait_for_timeout(50)
    page.locator('[data-qs-add-product="P-QS"]').click();page.wait_for_timeout(80)
    assert page.get_by_text('Integrated Automatic Slatted Cover',exact=True).count()>0
    # Upload an option image.
    with page.expect_file_chooser() as fc2: page.locator('[data-qs-upload-target="option"]').click()
    fc2.value.set_files(str(IMG));page.wait_for_timeout(350)
    state=page.evaluate("""()=>{const q=PoolShedQuoteStudio.listQuotes()[0],o=q.sections[0].options[0];return {media:q.mediaLibrary.length,hero:!!q.presentation.heroImage,option:!!o.image,snapshot:PoolShedQuoteStudio.customerSnapshot(q)};}""")
    assert state['media']>=2 and state['hero'] and state['option']
    page.screenshot(path=str(ART/'elite-quote-builder.png'),full_page=True)
    # Customer portal from exact safe snapshot.
    customer=ctx.new_page();cerrors=[];customer.on('pageerror',lambda e:cerrors.append('customer pageerror: '+str(e)));customer.on('console',lambda m:cerrors.append('customer console: '+m.text) if m.type=='error' and 'favicon' not in m.text.lower() else None)
    customer.set_content(inline_customer(state['snapshot']),wait_until='load',timeout=30000);customer.wait_for_timeout(180)
    body=customer.locator('body').inner_text();assert 'Elite Pool Refurbishment' in body;assert 'Integrated Automatic Slatted Cover' in body
    assert customer.locator('.pc-hero.has-media').count()==1;assert customer.locator('.pc-option-image img').count()>=1
    for forbidden in ['Purchase Orders','Supplier Cost','Project Handover','Sales Order','Pool Shed Quote Studio','Margin','QA Supplier']:
        assert forbidden not in body, forbidden
    customer.screenshot(path=str(ART/'elite-customer-proposal.png'),full_page=True);errs.extend(cerrors);browser.close()

if errs:
    print('\n'.join(errs),file=sys.stderr);sys.exit(1)
print(json.dumps({'browser':'Chromium','EliteQuoteBuilder':'PASS','HeroUpload':'PASS','OptionImageUpload':'PASS','MediaPersistence':'PASS','CustomerImagePresentation':'PASS','CustomerPortalIsolation':'PASS','RuntimeErrors':0,'screenshots':str(ART)},indent=2))
