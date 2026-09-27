from pathlib import Path
import json,sys,base64
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; ART=ROOT/'qa-v138'; ART.mkdir(exist_ok=True)
IMG=ART/'pool-hero.jpg'; im=Image.new('RGB',(1600,1000),(25,47,40)); d=ImageDraw.Draw(im); d.rectangle((100,180,1500,850),fill=(65,111,112)); d.rectangle((220,270,1380,760),fill=(110,165,172)); im.save(IMG,quality=90); data_url='data:image/jpeg;base64,'+base64.b64encode(IMG.read_bytes()).decode()
engine=(PUBLIC/'quote-studio-engine.js').read_text(); workspace=(PUBLIC/'quote-studio-workspace.js').read_text(); css=(PUBLIC/'assets/css/app.css').read_text()
html='''<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;font-family:Inter,Arial,sans-serif}.app{display:grid;grid-template-columns:238px 1fr;min-height:100vh}.sidebar{background:#111715;color:#fff;padding:20px}.main{min-width:0}.topbar{height:64px}.screen{min-height:100vh}'''+css+'''</style></head><body><div class="app"><aside class="sidebar">POOL SHED</aside><main class="main"><div class="topbar"></div><div class="subnav">OLD QUOTE NAV MUST HIDE</div><section id="screen-quotes" class="screen"></section></main></div><script>window.data={customers:[{id:'C1',name:'White Residence',email:'client@example.com'}],products:[{id:'P1',sku:'PB-COVER',supplierSku:'SUP-1',name:'Integrated Automatic Cover',category:'Covers',supplier:'Certikin',cost:5000,rrp:11800,image:'''+json.dumps(data_url)+'''},{id:'P2',sku:'PB-MANUAL',supplierSku:'SUP-2',name:'Manual Safety Cover',category:'Covers',supplier:'Certikin',cost:2100,rrp:5200,image:'''+json.dumps(data_url)+'''}],quotes:[],quoteTemplates:[],stock:[{productId:'P1',qty:1,allocated:0},{productId:'P2',qty:2,allocated:0}],jobs:[],salesOrders:[],purchaseOrders:[],allocations:[],movements:[],settings:{},users:[]};window.activeSubPage={quotes:'Quotes'};window.__POOL_SHED_GET_DATA__=()=>data;window.__POOL_SHED_SAVE_APP_DATA__=()=>true;window.__POOL_SHED_CURRENT_USER__=()=>({id:'U1',name:'Aaron'});window.__POOL_SHED_ACTIVE_SUBPAGE__=()=>activeSubPage.quotes;window.__POOL_SHED_WORKSPACE_ID__=()=> 'pool-bros-main';window.__POOL_SHED_OPEN_TAB__=(x)=>window.__lastNav=x;window.toast=()=>{};</script><script>'''+engine+'''</script><script>const q=PoolShedQuoteStudio.createQuote({customerId:'C1',projectName:'White Residence Pool Refurbishment and Plant Room Upgrade',projectType:'Pool Refurbishment',workflow:'project'});const s=q.sections[0];s.title='Choose your pool cover';s.eyebrow='Curated choice';s.intro='Choose the cover that best suits the finished pool.';s.rule='single';PoolShedQuoteStudio.addProductOption(q.id,s.id,'P1',{selected:true,recommended:true});PoolShedQuoteStudio.addProductOption(q.id,s.id,'P2',{});window.__POOL_SHED_QUOTE_FOCUS__=q.id;</script><script>'''+workspace+'''</script><script>renderQuoteStudioWorkspace();</script></body></html>'''

def rect(page,sel): return page.locator(sel).evaluate('(e)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}')
errors=[]; results={}
with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  p=b.new_page(viewport={'width':1920,'height':1080}); p.on('pageerror',lambda e: errors.append(str(e))); p.set_content(html,wait_until='load'); p.wait_for_timeout(220)
  # Proposal/detail header at 1920
  p.locator('[data-qs-tab="Proposal"]').click(); p.wait_for_timeout(100)
  deck=rect(p,'.qs-commanddeck'); identity=rect(p,'.qs-commanddeck-identity h1'); metrics=rect(p,'.qs-commanddeck-metrics')
  assert deck['right']<=1920.5 and deck['scrollWidth']<=deck['clientWidth']+2
  assert identity['height']<60 and identity['width']>250
  assert metrics['width']>650
  assert p.locator('.subnav').evaluate('(e)=>getComputedStyle(e).display')=='none'
  p.screenshot(path=str(ART/'quote-detail-1920.png'),full_page=True)
  # 1366 regression, exact class of layout that was broken in user's screenshot
  p.set_viewport_size({'width':1366,'height':900}); p.wait_for_timeout(120)
  deck2=rect(p,'.qs-commanddeck'); title2=rect(p,'.qs-commanddeck-identity h1')
  assert deck2['right']<=1366.5 and deck2['scrollWidth']<=deck2['clientWidth']+2
  assert title2['height']<65
  p.screenshot(path=str(ART/'quote-detail-1366.png'),full_page=True)
  # Commercial controls
  p.locator('[data-qs-tab="Commercial"]').click(); p.wait_for_timeout(120)
  assert p.locator('#qsCommercialForm').count()==1
  assert p.locator('text=Bespoke quote strategy').count()>=1
  assert p.locator('input[name="targetMargin"]').count()==1
  assert p.locator('select[name="depositType"]').count()==1
  p.screenshot(path=str(ART/'commercial-control-1366.png'),full_page=True)
  # Build Quote canvas at 1920
  p.set_viewport_size({'width':1920,'height':1080}); p.locator('[data-qs-tab="Options & Packages"]').click(); p.wait_for_timeout(120)
  initial=rect(p,'.qs-canvas')['width']; assert initial>900
  p.screenshot(path=str(ART/'build-quote-1920.png'),full_page=True)
  # Settings navigation and easy way home
  p.locator('[data-qs-action="back-list"]').click(); p.wait_for_timeout(70)
  p.locator('[data-qs-action="nav-settings"]').click(); p.wait_for_timeout(100)
  assert p.locator('.qs-globalbar').count()==1
  assert p.locator('.qs-globalbar [data-qs-action="exit-quote-studio"]').count()==1
  assert p.locator('.qs-settings-grid').count()==1
  assert p.locator('input[name="targetMargin"]').count()==1
  assert p.locator('select[name="depositType"]').count()==1
  p.screenshot(path=str(ART/'settings-1920.png'),full_page=True)
  # easy exit action routes to dashboard
  p.locator('.qs-globalbar [data-qs-action="exit-quote-studio"]').click(); assert p.evaluate('window.__lastNav')=='dashboard'
  results={'Header1920':'PASS','Header1366':'PASS','CommercialControl':'PASS','BuildCanvasWidth':round(initial),'SettingsNavigation':'PASS','PoolShedExit':'PASS','RuntimeErrors':len(errors)}
  b.close()
if errors:
  print(errors,file=sys.stderr); sys.exit(1)
print(json.dumps(results,indent=2))
