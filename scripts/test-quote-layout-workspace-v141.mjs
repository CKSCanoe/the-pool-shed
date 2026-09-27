import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const data={customers:[{id:'C1',name:'A customer with a long household name'}],products:[],quotes:[]};
const listeners={},screen={innerHTML:'',querySelector(){return null}};
const context={console,crypto:webcrypto,Date,Math,Intl,URLSearchParams,TextEncoder,TextDecoder,navigator:{onLine:false},matchMedia:()=>({matches:true}),localStorage:{getItem(){return null},setItem(){}},setTimeout(){},setInterval(){},__POOL_SHED_GET_DATA__:()=>data,__POOL_SHED_SAVE_APP_DATA__:()=>true,__POOL_SHED_CURRENT_USER__:()=>({id:'test'}),document:{addEventListener(type,fn){(listeners[type]??=[]).push(fn)},getElementById:id=>id==='screen-quotes'?screen:null,activeElement:null}};
vm.createContext(context);vm.runInContext(fs.readFileSync('public/quote-studio-engine.js','utf8'),context);
const engine=context.PoolShedQuoteStudio;
const quote=engine.createQuote({customerId:'C1',projectName:'Indoor pool refurbishment with a bespoke cover and plant room',workflow:'project'});
engine.addCustomOption(quote.id,quote.sections[0].id,{title:'Pool equipment and installation',qty:1,unitPrice:12500,costSnapshot:7000,selected:true});
vm.runInContext(fs.readFileSync('public/quote-studio-workspace.js','utf8'),context);
async function click(selector,dataset){for(const fn of listeners.click||[])await fn({target:{closest:s=>s===selector?{dataset}:null}})}
await click('[data-qs-open]',{qsOpen:quote.id});
assert(screen.innerHTML.includes('left-collapsed'),'Laptop starts with the library collapsed so the canvas has room');
assert(screen.innerHTML.includes('Indoor pool refurbishment with a bespoke cover and plant room'),'Long titles must remain complete');
await click('[data-qs-action]',{qsAction:'toggle-builder-left'});assert(!screen.innerHTML.includes('elite left-collapsed'),'Library can still be opened');
for(const [tab,needle] of [['Proposal','qsProposalForm'],['Options & Packages','qsOptionForm'],['Pool Layout','qs-layout-workspace'],['Commercial','qsCommercialForm'],['Engagement','Engagement'],['Versions','Version'],['Handover','Handover']]){
 await click('[data-qs-tab]',{qsTab:tab});assert(screen.innerHTML.includes(needle),'Quote stage should render its working controls: '+tab);assert(screen.innerHTML.includes('data-qs-action="exit-quote-studio"'),'Pool Shed exit must stay available on '+tab);
 if(tab==='Proposal'){assert(screen.innerHTML.includes('<details class="qs-workflow-settings">'),'Operational settings must be expandable');assert(screen.innerHTML.includes('aria-label="Quote setup steps"'));}
}
await click('[data-qs-action]',{qsAction:'publish'});assert(screen.innerHTML.includes('qs-modal-backdrop show'),'Publish dialogue still opens');
await click('[data-qs-action]',{qsAction:'close-send'});
await click('[data-qs-action]',{qsAction:'quote-back'});assert(screen.innerHTML.includes('Version'),'Back returns to the previously visited stage');
console.log('PASS laptop panel defaults, long quote title, every quote stage, working setup links, workflow disclosure, publish and back navigation');
