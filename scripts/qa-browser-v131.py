from pathlib import Path
import json, re, sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
ART=ROOT/'qa-v131'; ART.mkdir(exist_ok=True)

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
    html=(PUBLIC/'proposal.html').read_text()
    css=(PUBLIC/'quote-customer-portal.css').read_text()
    js=(PUBLIC/'quote-customer-portal.js').read_text()
    html=re.sub(r'<link\b[^>]*href=["\']\./quote-customer-portal\.css[^"\']*["\'][^>]*>','<style>'+css+'</style>',html,flags=re.I)
    accepted={'ok':True,'accepted':True,'id':'A1','acceptedAt':'2026-09-18T16:00:00Z','conversion':{'workflow':'quick','projectCreated':False,'salesOrderCreated':True,'paymentStatus':'Ready for Xero'}}
    harness="""<script>(function(){const Original=window.URLSearchParams;window.URLSearchParams=class extends Original{constructor(v){super(v||'?token=abcdefghijklmnopqrstuvwxyz123456')}};const publicPayload=%s;const acceptedPayload=%s;window.fetch=async function(url){const payload=String(url).includes('action=public')?publicPayload:acceptedPayload;return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});};})();</script>"""%(json.dumps(public_payload),json.dumps(accepted))
    html=re.sub(r'<script\b[^>]*src=["\']\./quote-customer-portal\.js[^"\']*["\'][^>]*></script>',lambda _:harness+'<script>'+js+'</script>',html,flags=re.I)
    return html

public_payload={
 'proposal':{'schema':2,'quoteId':'Q-QA','version':1,'projectName':'QA Light Refurbishment','projectType':'Light Refurbishment / Repair','customer':{'name':'QA Quick Quote Client'},'ownerName':'Pool Bros','validUntil':'2026-10-18','currency':'GBP','vatRate':20,'depositPercent':50,'termsVersion':'4.3','presentation':{'heroTitle':'Your pool refurbishment proposal','heroIntro':'A straightforward proposal for the agreed pool works.'},'pages':[{'id':'welcome','type':'welcome','title':'Welcome','visible':True},{'id':'scope','type':'scope','title':'Your Quote','visible':True},{'id':'investment','type':'investment','title':'Investment','visible':True},{'id':'accept','type':'acceptance','title':'Acceptance','visible':True}],'sections':[{'id':'S1','title':'Quoted items','eyebrow':'Your quote','intro':'The work included is shown below.','rule':'locked','priceMode':'full','layout':'cards','required':False,'questions':True,'showSummary':True,'style':{},'blocks':[],'options':[{'id':'O1','kind':'product','title':'Premium circulation pump replacement','subtitle':'','description':'Supply and install replacement pump.','qty':1,'unitPrice':1200,'vatRate':20,'selected':True,'recommended':False,'badge':'','benefits':[],'image':'','brochure':''}]}],'poolLayout':{},'documents':[],'payment':{'mode':'full','label':'Full payment','amount':1440},'investment':{'net':1200,'vat':240,'gross':1440,'deposit':720,'paymentMilestones':[{'label':'Accepted quote payment','percent':100,'amount':1440}]}},
 'publication':{'id':'P1','quoteId':'Q-QA','version':1,'status':'live','expiresAt':'2026-10-18','accepted':False},'customerState':{'selections':{}}
}

errs=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':1000})
    page=ctx.new_page()
    page.on('pageerror',lambda e: errs.append('internal pageerror: '+str(e)))
    page.on('console',lambda m: errs.append('internal console: '+m.text) if m.type=='error' and 'favicon' not in m.text.lower() else None)
    page.set_content(inline_internal(),wait_until='load',timeout=30000)
    page.evaluate("""()=>{data=normalizeAppData(JSON.parse(JSON.stringify(seed)));isAuthenticated=true;showApp();data.customers.push({id:'C-QS',name:'QA Quick Quote Client',email:'qa@example.invalid',address:'QA Pool House',priceList:'rrp'});data.products.push({id:'P-QS',sku:'PB-QA-PUMP',name:'QA Premium Pump',category:'Plant',supplier:'QA Supplier',supplierSku:'QA-P1',cost:400,rrp:1200});active='quotes';render();}""")
    page.wait_for_timeout(150)
    assert page.get_by_text('Quotes · Quote Studio',exact=True).count()>0
    page.locator('[data-qs-action="new-quote"]').click()
    assert page.get_by_text('Quick Quote',exact=True).count()>0
    assert page.get_by_text('Project Proposal',exact=True).count()>0
    page.locator('#qsCreateForm select[name="customerId"]').select_option('C-QS')
    page.locator('#qsCreateForm input[name="projectName"]').fill('QA Light Refurbishment')
    page.locator('#qsCreateForm').evaluate('(f)=>f.requestSubmit()')
    page.wait_for_timeout(100)
    state=page.evaluate("""()=>{const q=PoolShedQuoteStudio.listQuotes()[0];return {workflow:q.workflow,project:q.handoverPolicy.createProjectOnAcceptance,xero:q.handoverPolicy.xeroRequestMode};}""")
    assert state=={'workflow':'quick','project':False,'xero':'full'},state
    page.screenshot(path=str(ART/'quote-studio-quick-quote.png'))

    customer=ctx.new_page(); cerrors=[]
    customer.on('pageerror',lambda e:cerrors.append('customer pageerror: '+str(e)))
    customer.on('console',lambda m:cerrors.append('customer console: '+m.text) if m.type=='error' and 'favicon' not in m.text.lower() else None)
    customer.set_content(inline_customer(public_payload),wait_until='load',timeout=30000)
    customer.wait_for_timeout(200)
    body=customer.locator('body').inner_text()
    assert 'QA Light Refurbishment' in body
    assert '£1,440' in body or '£1,440.00' in body
    for forbidden in ['Purchase Orders','Supplier Cost','Project Handover','Sales Order','Pool Shed Quote Studio','Margin']:
        assert forbidden not in body, forbidden
    customer.screenshot(path=str(ART/'customer-quick-quote.png'),full_page=True)
    errs.extend(cerrors)
    browser.close()

if errs:
    print('\n'.join(errs),file=sys.stderr);sys.exit(1)
print(json.dumps({'browser':'Chromium','QuoteStudio':'PASS','QuickQuoteCreate':'PASS','CustomerPortalIsolation':'PASS','RuntimeErrors':0,'screenshots':str(ART)},indent=2))
