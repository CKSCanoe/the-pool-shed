import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir='public/assets/css/system';
const ruleRe=/([^{}]+)\{([^{}]*)\}/g;
const propRe=/([\w-]+)\s*:\s*([^;]+)/g;
const compact=s=>s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\s+/g,' ').trim();
const statusIndicator=/(dot|progress|meter|signal|icon|mark|::before|:before|::after|:after|toggle-track|>\s*span\b|\bi\b|danger-button|button\[class\*="danger"\])/i;
const forbiddenStatus=[];
const forbiddenAction=[];
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.css')&&f!=='40-design-system.css')){
 const css=fs.readFileSync(path.join(dir,file),'utf8');
 for(const m of css.matchAll(ruleRe)){
  const sel=compact(m[1]);const props=new Map([...m[2].matchAll(propRe)].map(x=>[x[1],x[2].trim()]));
  const bg=props.get('background-color')||props.get('background');if(!bg)continue;
  if(/^var\(--color-status-(success|attention|danger|info)\)(?:\s*!important)?$/.test(bg.replace(/\s+/g,'')) && !statusIndicator.test(sel)) forbiddenStatus.push(`${file}: ${sel} -> ${bg}`);
  if(/^var\(--color-action-primary\)(?:\s*!important)?$/.test(bg.replace(/\s+/g,'')) && /(nav|tab|subnav|metric|card|select|input|quick-list|rail-alert|role-picker)/i.test(sel) && !/(primary|save|submit|invoice|approve|step-number|finder-select|azzy-input|:before|checked\+span)/i.test(sel)) forbiddenAction.push(`${file}: ${sel} -> ${bg}`);
 }
}
assert.equal(forbiddenStatus.length,0,`Structural surfaces may not use saturated status fills:\n${forbiddenStatus.join('\n')}`);
assert.equal(forbiddenAction.length,0,`Navigation/selection surfaces may not use saturated action fills:\n${forbiddenAction.join('\n')}`);
console.log('PASS v1.24 structural surfaces use soft semantic fills and restrained selected states.');
