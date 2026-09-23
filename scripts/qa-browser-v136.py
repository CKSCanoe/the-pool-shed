from pathlib import Path
import json,re,sys,base64
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
ART=ROOT/'qa-v136'
ART.mkdir(exist_ok=True)

# Shared deterministic visual asset
IMG=ART/'pool-hero.jpg'
im=Image.new('RGB',(1600,1000),(39,67,60))
d=ImageDraw.Draw(im)
d.rectangle((120,170,1480,850),fill=(69,125,134))
d.rectangle((240,260,1360,760),fill=(124,177,184))
d.text((150,110),'Pool Bros Elite Quote Studio QA',fill=(246,244,238))
im.save(IMG,quality=90)
data_url='data:image/jpeg;base64,'+base64.b64encode(IMG.read_bytes()).decode()

errors=[]
results={}

engine_js=(PUBLIC/'quote-studio-engine.js').read_text()
workspace_js=(PUBLIC/'quote-studio-workspace.js').read_text()
studio_css=(PUBLIC/'assets/css/app.css').read_text()
portal_js=(PUBLIC/'quote-customer-portal.js').read_text()
portal_css=(PUBLIC/'quote-customer-portal.css').read_text()
proposal_html=(PUBLIC/'proposal.html').read_text()

# ---------- Staff Quote Studio harness ----------
staff_html='''<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;font-family:Inter,Arial,sans-serif}.app{display:grid;grid-template-columns:238px 1fr;min-height:100vh}.sidebar{background:#111715;color:#fff;padding:20px}.main{min-width:0}.topbar{height:64px;background:#fff;border-bottom:1px solid #ddd;padding:20px}.screen{min-height:calc(100vh - 64px)}
'''+studio_css+'''</style></head><body><div class="app"><aside class="sidebar">NORMAL POOL SHED SIDEBAR</aside><main class="main"><div class="topbar">NORMAL GLOBAL TOPBAR</div><section id="screen-quotes" class="screen"></section></main></div>
<script>
window.data={
 customers:[{id:'C-1',name:'Matthew & Gail White',companyName:'',email:'white@example.com',phone:'01568 000000',postcode:'HR6 8AA',address:'White Residence, Herefordshire'}],
 products:[{id:'P-1',sku:'PB-COVER-001',supplierSku:'SUP-COV-01',name:'Integrated Automatic Slatted Cover',brand:'Pool Bros',category:'Covers',supplier:'Certikin',supplierId:'SUP-1',supplierName:'Certikin',cost:5800,costPrice:5800,rrp:11800,rrpPrice:11800,trade:10500,stock:2,images:['''+json.dumps(data_url)+'''],image:'''+json.dumps(data_url)+''',description:'Concealed automatic cover package',customerDescription:'A premium concealed slatted cover with automatic operation.',brochureUrl:'https://example.com/cover.pdf'}],
 quotes:[],quoteTemplates:[],stock:[{productId:'P-1',qty:2,allocated:0}],jobs:[],salesOrders:[],purchaseOrders:[],allocations:[],movements:[],settings:{},users:[]
};
window.__POOL_SHED_GET_DATA__=()=>window.data;
window.__POOL_SHED_SAVE_APP_DATA__=()=>true;
window.__POOL_SHED_CURRENT_USER__=()=>({id:'U-1',name:'Aaron Boyer',email:'aaron@example.com'});
window.__POOL_SHED_ACTIVE_SUBPAGE__=()=> 'Quotes';
window.__POOL_SHED_WORKSPACE_ID__=()=> 'pool-bros-main';
window.__POOL_SHED_OPEN_TAB__=()=>{};
window.toast=(m)=>{window.__toast=m};
</script><script>'''+engine_js+'''</script><script>
const q=PoolShedQuoteStudio.createQuote({customerId:'C-1',projectName:'White Residence Pool Refurbishment',projectType:'Pool Refurbishment',workflow:'project'});
const s=q.sections[0];
s.title='Choose your pool cover';s.eyebrow='Curated choice';s.intro='Select the cover that best fits the finished pool.';
PoolShedQuoteStudio.addProductOption(q.id,s.id,'P-1',{selected:true,recommended:true});
q.presentation.heroImage='''+json.dumps(data_url)+''';
window.__POOL_SHED_QUOTE_FOCUS__=q.id;
</script><script>'''+workspace_js+'''</script><script>renderQuoteStudioWorkspace();</script></body></html>'''

# ---------- Customer proposal harness ----------
proposal={
 'quoteId':'Q-2026-0360','version':1,'projectName':'White Residence Pool Refurbishment','projectType':'Pool refurbishment','ownerName':'Aaron · Pool Bros','workflow':'project','validUntil':'16 October 2026','termsVersion':'2026.09','vatRate':20,'depositPercent':50,
 'customer':{'name':'Matthew & Gail White','email':'white@example.com','phone':'01568 000000','address':{'line1':'White Residence','line2':'','city':'Leominster','county':'Herefordshire','postcode':'HR6 8AA','country':'United Kingdom'}},
 'presentation':{'heroImage':data_url,'heroImagePosition':'center','heroTitle':'Your pool, reconsidered for the way you want to live.','heroIntro':'A complete refurbishment brought together as one considered project.','about':'Pool Bros brings together design, engineering and long-term care.'},
 'pages':[{'type':'welcome','visible':True},{'type':'about','visible':True},{'type':'project','visible':True},{'type':'options','visible':True},{'type':'investment','visible':True},{'type':'acceptance','visible':True}],
 'sections':[{'id':'cover','eyebrow':'Curated choice','title':'Choose your pool cover','intro':'Integrated into the project from day one.','rule':'single','priceMode':'upgrade','questions':True,'layout':'rows','style':{'columns':1},'options':[{'id':'cover-a','title':'Integrated automatic slatted cover','description':'Premium concealed automatic cover.','unitPrice':11800,'qty':1,'selected':True,'recommended':True,'image':data_url,'benefits':['Concealed mechanism','Automatic operation']}]}],
 'poolLayout':{},'documents':[],'investment':{'gross':14160,'paymentMilestones':[{'label':'Secure project','percent':50,'amount':7080},{'label':'Installation stage','percent':40,'amount':5664},{'label':'Completion','percent':10,'amount':1416}]},'payment':{'mode':'deposit'}
}
payload={'proposal':proposal,'publication':{'id':'PUB-1','quoteId':proposal['quoteId'],'version':1,'status':'live','permissions':'standard','accepted':False},'customerState':{'selections':{}}}
portal_html=proposal_html
portal_html=re.sub(r'<link\b[^>]*href=["\']\./quote-customer-portal\.css[^"\']*["\'][^>]*>','<style>'+portal_css+'</style>',portal_html,flags=re.I)
fetch_script='''<script>
window.__acceptBody=null;
const __payload='''+json.dumps(payload)+''';
window.fetch=async (url,opts={})=>{
 const u=String(url||'');
 if((opts.method||'GET').toUpperCase()==='POST' && u.includes('action=accept')){window.__acceptBody=JSON.parse(opts.body||'{}');return new Response(JSON.stringify({accepted:true,processing:'complete'}),{status:200,headers:{'Content-Type':'application/json'}})}
 if((opts.method||'GET').toUpperCase()==='POST'){return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
 return new Response(JSON.stringify(__payload),{status:200,headers:{'Content-Type':'application/json'}})
};
const __USP=URLSearchParams;URLSearchParams=class extends __USP{constructor(){super('token=abcdefghijklmnopqrstuvwxyz123456')}};
</script>'''
portal_html=re.sub(r'<script\b[^>]*src=["\']\./quote-customer-portal\.js[^"\']*["\'][^>]*></script>',lambda _:fetch_script+'<script>'+portal_js+'</script>',portal_html,flags=re.I)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])

    # Staff Studio
    page=browser.new_page(viewport={'width':1728,'height':1050})
    page.on('pageerror',lambda e: errors.append('staff: '+str(e)))
    page.set_content(staff_html,wait_until='load',timeout=30000)
    page.wait_for_timeout(400)
    assert page.locator('.qs-studio-root').count()==1
    assert page.locator('.qs-stage-rail').count()==1
    assert page.locator('.qs-studio-command').count()==1
    assert page.locator('.qs-stage-group').count()>=2
    assert page.locator('.qs-studio-home').count()==1
    assert page.locator('.sidebar').evaluate('(e)=>getComputedStyle(e).display')=='none'
    assert page.locator('.topbar').evaluate('(e)=>getComputedStyle(e).display')=='none'
    rail_width=page.locator('.qs-stage-rail').evaluate('(e)=>e.getBoundingClientRect().width')
    assert rail_width>=200
    page.screenshot(path=str(ART/'elite-quote-studio-details.png'),full_page=True)

    # Switch into visual builder
    page.locator('[data-qs-tab="Options & Packages"]').click()
    page.wait_for_timeout(250)
    assert page.locator('.qs-builder').count()==1
    assert page.locator('.qs-canvas').count()==1
    builder_width=page.locator('.qs-builder').evaluate('(e)=>e.getBoundingClientRect().width')
    canvas_width=page.locator('.qs-canvas').evaluate('(e)=>e.getBoundingClientRect().width')
    assert builder_width>1100
    assert canvas_width>600
    assert page.locator('.qs-client-option').count()>=1
    page.screenshot(path=str(ART/'elite-quote-studio-builder.png'),full_page=True)
    results['StaffEliteQuoteStudio']='PASS'
    results['StaffBuilderWidth']=round(builder_width)
    results['StaffCanvasWidth']=round(canvas_width)

    # Customer portal / acceptance fields and payload
    customer=browser.new_page(viewport={'width':1440,'height':1000})
    customer.on('pageerror',lambda e: errors.append('customer: '+str(e)))
    customer.set_content(portal_html,wait_until='load',timeout=30000)
    customer.wait_for_timeout(350)
    for selector in ['#pcSigner','#pcCustomerEmail','#pcCustomerPhone','#pcCustomerLine1','#pcCustomerCity','#pcCustomerCounty','#pcCustomerPostcode','#pcCustomerCountry','#pcTerms','#pcAccept']:
        assert customer.locator(selector).count()==1, selector
    assert customer.locator('#pcCustomerEmail').input_value()=='white@example.com'
    assert customer.locator('#pcCustomerPostcode').input_value()=='HR6 8AA'
    customer.locator('#pcSigner').fill('Matthew White')
    customer.locator('#pcTerms').check()
    customer.locator('#pcAccept').click()
    customer.wait_for_timeout(300)
    body=customer.evaluate('window.__acceptBody')
    assert body and body['contact']['email']=='white@example.com'
    assert body['contact']['address']['line1']=='White Residence'
    assert body['contact']['address']['postcode']=='HR6 8AA'
    assert 'accepted' in customer.locator('#pcAcceptance').inner_text().lower()
    customer.screenshot(path=str(ART/'customer-acceptance-confirmed.png'),full_page=True)
    results['CustomerAcceptanceCRMConfirmation']='PASS'
    results['CustomerAcceptancePayload']='PASS'

    browser.close()

if errors:
    print('\n'.join(errors),file=sys.stderr)
    sys.exit(1)
results['RuntimeErrors']=0
results['Screenshots']=str(ART)
print(json.dumps(results,indent=2))
