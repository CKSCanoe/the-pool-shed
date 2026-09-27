from pathlib import Path
import json,re,sys,base64
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; ART=ROOT/'qa-v138-portal'; ART.mkdir(exist_ok=True)
IMG=ART/'hero.jpg'; im=Image.new('RGB',(1600,1000),(55,91,85)); d=ImageDraw.Draw(im); d.rectangle((120,170,1480,850),fill=(64,130,142)); d.rectangle((240,260,1360,760),fill=(127,185,193)); d.text((150,110),'Pool Bros private project visual',fill=(240,240,230)); im.save(IMG,quality=90)
data_url='data:image/jpeg;base64,'+base64.b64encode(IMG.read_bytes()).decode()
proposal={
 'quoteId':'Q-2026-0351','version':3,'projectName':'White Residence Pool Refurbishment','projectType':'Pool refurbishment','ownerName':'Aaron · Pool Bros','workflow':'project','validUntil':'16 October 2026','termsVersion':'2026.09','vatRate':20,'depositPercent':50,
 'customer':{'name':'Matthew & Gail White'},
 'brand':{'name':'Pool Bros','descriptor':'Private Client Proposal'},
 'presentation':{'theme':{'style':'waterline','primary':'#17362f','accent':'#c39a5e','paper':'#f6f2e8'},'heroImage':data_url,'heroImagePosition':'center','heroTitle':'Your pool, reconsidered for the way you want to live.','heroIntro':'A complete refurbishment, concealed automatic cover and refined plant room, brought together as one considered project.','about':'We have brought the technical decisions, visual details and delivery plan together so the finished pool feels effortless rather than engineered.'},
 'pages':[{'type':'welcome','visible':True},{'type':'about','visible':True},{'type':'layout','visible':True},{'type':'documents','visible':True},{'type':'investment','visible':True},{'type':'acceptance','visible':True}],
 'sections':[{'id':'cover','eyebrow':'Curated choice','title':'Choose your pool cover','intro':'A concealed cover should feel integrated into the pool, not added afterwards.','rule':'single','priceMode':'upgrade','questions':True,'layout':'rows','style':{'columns':1},'options':[
   {'id':'cover-a','title':'Integrated automatic slatted cover','description':'A premium concealed slatted cover with automatic operation and a clean finished waterline.','unitPrice':11800,'qty':1,'selected':True,'recommended':True,'image':data_url,'benefits':['Concealed mechanism','Automatic operation','Pool Bros recommended']},
   {'id':'cover-b','title':'Manual safety cover','description':'A simpler safety-first cover option where full automation is not required.','unitPrice':4200,'qty':1,'selected':False,'image':data_url,'benefits':['Lower investment','Robust construction']}
 ]},{'id':'automation','eyebrow':'Enhancement','title':'Automation & water care','intro':'Make day-to-day ownership quieter and easier.','rule':'multi','priceMode':'upgrade','questions':True,'layout':'cards','style':{'columns':2},'options':[
   {'id':'auto-a','title':'Pool automation package','description':'Integrated control for filtration, heating and lighting.','unitPrice':3800,'qty':1,'selected':True,'benefits':['Simpler ownership','Remote control']},
   {'id':'auto-b','title':'Automatic chemical dosing','description':'Automatic pH and chlorine control for more consistent water care.','unitPrice':2900,'qty':1,'selected':True,'benefits':['Consistent water','Less manual dosing']}
 ]}],
 'poolLayout':{'shape':'hopper','length':11.35,'width':4.35,'shallowDepth':1.1,'deepDepth':2.0,'components':[]},
 'documents':[{'id':'doc1','title':'Automatic cover brochure','name':'Cover brochure','type':'Brochure','url':'https://example.com/brochure.pdf'},{'id':'doc2','title':'Pool refurbishment specification','name':'Specification','type':'Specification'}],
 'investment':{'net':11800,'vat':2360,'gross':14160,'deposit':5000,'paymentMilestones':[{'label':'Secure project','type':'fixed','value':5000,'percent':35.31,'amount':5000,'requestOnAcceptance':True},{'label':'Installation stage','type':'percent','value':40,'percent':40,'amount':5664,'requestOnAcceptance':False},{'label':'Completion','type':'balance','value':0,'percent':24.69,'amount':3496,'requestOnAcceptance':False}]},
 'payment':{'mode':'deposit','label':'Fixed deposit','amount':5000,'depositType':'fixed','depositFixed':5000,'depositPercent':35.31,'note':'Balance milestones agreed before works commence.'}
}
html=(PUBLIC/'proposal.html').read_text(); css=(PUBLIC/'quote-customer-portal.css').read_text(); js=(PUBLIC/'quote-customer-portal.js').read_text()
html=re.sub(r'<link\b[^>]*href=["\']\./quote-customer-portal\.css[^"\']*["\'][^>]*>','<style>'+css+'</style>',html,flags=re.I)
payload={'proposal':proposal,'publication':{'id':'P1','quoteId':proposal['quoteId'],'version':3,'status':'live','permissions':'standard','accepted':False},'customerState':{'selections':{}}}
harness='<script>window.fetch=async()=>new Response('+json.dumps(json.dumps(payload))+',{status:200,headers:{"Content-Type":"application/json"}});const __USP=URLSearchParams;URLSearchParams=class extends __USP{constructor(){super("token=abcdefghijklmnopqrstuvwxyz123456")}};</script>'
html=re.sub(r'<script\b[^>]*src=["\']\./quote-customer-portal\.js[^"\']*["\'][^>]*></script>',lambda _:harness+'<script>'+js+'</script>',html,flags=re.I)
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load',timeout=30000); page.wait_for_timeout(250)
    assert page.locator('.pc-nav').count()==1
    assert page.locator('.pc-menu').count()==1
    assert page.locator('.pc-hero.has-media').count()==1
    assert page.locator('.pc-project-bar').count()==1
    assert page.locator('.pc-option').count()==4
    assert page.locator('.pc-accept-wrap').count()==1
    assert page.locator('.pc-shell.theme-waterline').count()==1
    body=page.locator('body').inner_text(); assert ('£5,000' in body or '£5,000.00' in body)
    assert 'Private for Matthew & Gail White' in page.locator('body').inner_text()
    page.screenshot(path=str(ART/'v9-2-portal-desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844}); mobile.set_content(html,wait_until='load',timeout=30000); mobile.wait_for_timeout(200); mobile.screenshot(path=str(ART/'v9-2-portal-mobile.png'),full_page=True)
    browser.close()
if errors:
    print(errors,file=sys.stderr);sys.exit(1)
print(json.dumps({'V9_2_Portal':'PASS','FixedDeposit':'PASS','PerQuoteTheme':'PASS','Desktop':'PASS','Mobile':'PASS','RuntimeErrors':0,'screenshots':str(ART)},indent=2))
