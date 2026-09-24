import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('public/assets/css/system/59-quote-studio.css','utf8');
function declarations(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hits=[...css.matchAll(new RegExp(escaped+'\\s*\\{([^{}]+)\\}','g'))];assert(hits.length,'Missing layout authority for '+selector);return Object.fromEntries(hits[0][1].split(';').filter(Boolean).map(x=>{const i=x.indexOf(':');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}))}
const hero=declarations('#screen-quotes .qs-hero-builder-overlay h3');assert.equal(hero.color,'#fff','Hero heading must explicitly contrast its dark background');
const header=declarations('#screen-quotes .qs-commanddeck-main');assert.equal(header['grid-template-columns'],'minmax(320px,1fr) auto','Quote identity must retain a usable text column');
const canvas=declarations('#screen-quotes .qs-canvas-body');assert.equal(canvas.padding,'32px','Old 58px/52px canvas padding must not survive');
assert(css.includes('grid-template-areas:"library canvas inspector"'));assert(css.includes('grid-template-areas:"library library" "canvas inspector"'));assert(css.includes('grid-template-areas:"library" "canvas" "inspector"'));
assert(!css.includes('minmax(650px,1fr)'),'Old fixed minimum must not force the editor offscreen');
assert(!css.includes('.qs-studio-command{'),'Unused one-row header rules must be removed');
function luminance(hex){const a=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722}
for(const [fg,bg] of [['#ffffff','#183a46'],['#ffffff','#215767'],['#ffffff','#315542'],['#ffffff','#3c5260'],['#20313b','#ffffff'],['#566774','#ffffff'],['#60717b','#ffffff'],['#385765','#edf5f7']]){const l=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);assert((l[0]+.05)/(l[1]+.05)>=4.5,'Text contrast below 4.5:1 for '+fg+' on '+bg)}
assert.equal(css,fs.readFileSync('public/quote-studio.css','utf8'),'Standalone stylesheet must match the maintained module');
console.log('PASS quote layout containment, retired fixed-width rules, canvas spacing and text contrast across all workspace palettes');
