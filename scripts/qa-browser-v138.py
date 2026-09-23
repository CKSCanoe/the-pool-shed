from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; ART=ROOT/'qa-v138'; ART.mkdir(exist_ok=True)
engine=(PUBLIC/'quote-studio-engine.js').read_text(); workspace=(PUBLIC/'quote-studio-workspace.js').read_text(); css=(PUBLIC/'assets/css/app.css').read_text()
html='''<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;font-family:Inter,Arial,sans-serif}.app{display:grid;grid-template-columns:238px 1fr;min-height:100vh}.sidebar{background:#111715;color:#fff;padding:20px}.main{min-width:0}.topbar{height:64px}.screen{min-height:100vh}'''+css+'''</style></head><body><div class="app"><aside class="sidebar">POOL SHED</aside><main class="main"><div class="topbar"></div><section id="screen-quotes" class="screen"></section></main></div><script>window.subpage='Quotes';window.data={customers:[{id:'C1',name:'White Residence',email:'client@example.com'}],products:[],quotes:[],quoteTemplates:[],quoteSettings:{targetMargin:35,minimumMargin:25,depositPercent:50},stock:[],jobs:[],salesOrders:[],purchaseOrders:[],allocations:[],movements:[],settings:{},users:[]};window.__POOL_SHED_GET_DATA__=()=>data;window.__POOL_SHED_SAVE_APP_DATA__=()=>true;window.__POOL_SHED_CURRENT_USER__=()=>({id:'U1',name:'Aaron'});window.__POOL_SHED_ACTIVE_SUBPAGE__=()=>window.subpage;window.__POOL_SHED_WORKSPACE_ID__=()=> 'pool-bros-main';window.toast=()=>{};window.__POOL_SHED_NAVIGATE__=(x)=>{window.lastNav=x};window.__POOL_SHED_OPEN_TAB__=(x)=>{window.lastNav=x};</script><script>'''+engine+'''</script><script>const q=PoolShedQuoteStudio.createQuote({customerId:'C1',projectName:'White Residence Pool Refurbishment',projectType:'Pool Refurbishment',workflow:'project'});const s=q.sections[0];s.title='Pool refurbishment scope';s.rule='locked';PoolShedQuoteStudio.addCustomOption(q.id,s.id,{title:'Pool refurbishment works',qty:1,unitPrice:20000,costSnapshot:12000,selected:true});window.__POOL_SHED_QUOTE_FOCUS__=q.id;window.TEST_QUOTE_ID=q.id;</script><script>'''+workspace+'''</script><script>renderQuoteStudioWorkspace();</script></body></html>'''
errors=[];results={}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1920,'height':1080});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html,wait_until='load');p.wait_for_timeout(250)
 p.locator('[data-qs-action="back-list"]').first.click();p.wait_for_timeout(80);p.evaluate("window.subpage='Settings';renderQuoteStudioWorkspace();");p.wait_for_timeout(120)
 assert p.get_by_text('Back to Pool Shed').count()>=1;assert p.get_by_text('Design the way Pool Bros sells.').count()==1;assert p.locator('#qsSettingsForm').count()==1
 p.screenshot(path=str(ART/'settings-control-centre.png'),full_page=True)
 p.get_by_text('Back to Pool Shed').first.click();assert p.evaluate('window.lastNav')=='dashboard'
 p.evaluate("window.subpage='Quotes';window.__POOL_SHED_QUOTE_FOCUS__=window.TEST_QUOTE_ID;renderQuoteStudioWorkspace();");p.wait_for_timeout(100)
 for tab in ['Proposal','Options & Packages','Pool Layout','Commercial','Engagement','Versions','Handover']:
  p.locator('[data-qs-tab="'+tab+'"]').click();p.wait_for_timeout(35);assert p.locator('.qs-detail-body').count()==1
 p.locator('[data-qs-tab="Commercial"]').click();p.wait_for_timeout(100)
 assert p.locator('#qsCommercialForm').count()==1;p.locator('input[name="targetMargin"]').fill('42');p.locator('input[name="minimumMargin"]').fill('30');p.locator('select[name="depositMode"]').select_option('fixed');p.locator('input[name="depositAmountOverride"]').fill('3500');p.locator('#qsCommercialForm button[type="submit"]').click();p.wait_for_timeout(100)
 commercial=p.evaluate("PoolShedQuoteStudio.commercialProfile(PoolShedQuoteStudio.getQuote(window.TEST_QUOTE_ID))");totals=p.evaluate("PoolShedQuoteStudio.totals(PoolShedQuoteStudio.getQuote(window.TEST_QUOTE_ID))")
 assert commercial['targetMargin']==42 and commercial['minimumMargin']==30 and commercial['depositMode']=='fixed' and commercial['depositAmountOverride']==3500;assert totals['deposit']==3500
 p.screenshot(path=str(ART/'commercial-studio.png'),full_page=True)
 results={'SettingsReturnHome':'PASS','CommercialStudio':'PASS','BespokeFixedDeposit':totals['deposit'],'RuntimeErrors':len(errors)};b.close()
if errors:print(errors,file=sys.stderr);sys.exit(1)
print(json.dumps(results,indent=2))
