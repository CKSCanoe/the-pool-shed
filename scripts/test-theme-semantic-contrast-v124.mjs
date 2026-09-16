import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const cssDir = 'public/assets/css/system';
const light = {
  '--color-shell':'#101820','--color-shell-secondary':'#17232D','--color-surface-canvas':'#F5F7F8','--color-surface-default':'#FFFFFF','--color-surface-subtle':'#EEF2F4','--color-surface-raised':'#E5EAED',
  '--color-text-primary':'#18242C','--color-text-secondary':'#5F6D75','--color-text-muted':'#89959C','--color-text-inverse':'#FFFFFF','--color-shell-text':'#EEF3F5','--color-shell-text-muted':'#A9B5BB',
  '--color-action-primary':'#2F6B84','--color-action-primary-hover':'#24566A','--color-action-soft':'#E7F0F4','--color-action-ink':'#173847','--color-action-contrast':'#FFFFFF',
  '--color-status-success':'#1F8A5B','--color-status-success-text':'#176B42','--color-status-success-bg':'#E6F5EE','--color-status-attention':'#B56A14','--color-status-attention-text':'#89500A','--color-status-attention-bg':'#FFF3DF',
  '--color-status-danger':'#B13B46','--color-status-danger-text':'#91303A','--color-status-danger-bg':'#FDEBED','--color-status-info':'#2F6F9F','--color-status-info-text':'#245A7F','--color-status-info-bg':'#E8F2F9'
};
const dark = {...light,
  '--color-shell':'#0B1015','--color-shell-secondary':'#121920','--color-surface-canvas':'#0F1419','--color-surface-default':'#161D23','--color-surface-subtle':'#1D252C','--color-surface-raised':'#263039',
  '--color-text-primary':'#EEF3F5','--color-text-secondary':'#A9B5BB','--color-text-muted':'#7F8C93','--color-text-inverse':'#0B1015','--color-shell-text':'#EEF3F5','--color-shell-text-muted':'#A9B5BB',
  '--color-action-primary':'#69A8C2','--color-action-primary-hover':'#4E8DA7','--color-action-soft':'#17313D','--color-action-ink':'#DFF3FB','--color-action-contrast':'#0B1015',
  '--color-status-success':'#55C68A','--color-status-success-text':'#55C68A','--color-status-success-bg':'#173226','--color-status-attention':'#E2A451','--color-status-attention-text':'#E2A451','--color-status-attention-bg':'#3A2C18',
  '--color-status-danger':'#E07079','--color-status-danger-text':'#E07079','--color-status-danger-bg':'#3A2024','--color-status-info':'#6FA9D3','--color-status-info-text':'#6FA9D3','--color-status-info-bg':'#183044'
};

const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
const directVarRe = /^\s*var\((--[\w-]+)/;

function luminance(hex){
  const h=hex.replace('#','');
  const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function cleanSelector(value){return value.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\s+/g,' ').trim();}

const failures=[];
for(const file of fs.readdirSync(cssDir).filter(f=>f.endsWith('.css') && f!=='40-design-system.css')){
  const css=fs.readFileSync(path.join(cssDir,file),'utf8');
  const aliases=new Map();
  for(const match of css.matchAll(ruleRe)){
    for(const p of match[2].matchAll(propRe)){
      if(!p[1].startsWith('--')) continue;
      const vm=p[2].match(directVarRe);
      if(vm) aliases.set(p[1],vm[1]);
    }
  }
  function resolve(value,palette){
    if(!value || /color-mix|linear-gradient|radial-gradient|transparent/.test(value)) return null;
    const vm=value.match(directVarRe); if(!vm) return null;
    let key=vm[1]; const seen=new Set();
    while(aliases.has(key) && !seen.has(key)){seen.add(key);key=aliases.get(key);}
    return palette[key]||null;
  }
  for(const match of css.matchAll(ruleRe)){
    const selector=cleanSelector(match[1]);
    const props=new Map();
    for(const p of match[2].matchAll(propRe)) props.set(p[1],p[2].trim());
    const bg=props.get('background-color')||props.get('background');
    const fg=props.get('color');
    if(!bg||!fg) continue;
    for(const [mode,palette] of [['light',light],['dark',dark]]){
      const bgHex=resolve(bg,palette),fgHex=resolve(fg,palette);
      if(!bgHex||!fgHex) continue;
      const ratio=contrast(bgHex,fgHex);
      if(ratio<4.5) failures.push(`${file} [${mode}] ${selector} = ${ratio.toFixed(2)}:1 (${bg} / ${fg})`);
    }
  }
}
assert.equal(failures.length,0,`Semantic background/text contrast failures:\n${failures.slice(0,120).join('\n')}${failures.length>120?`\n... plus ${failures.length-120} more`:''}`);
console.log('PASS v1.24 direct semantic background/text pairs meet 4.5:1 in both light and dark themes.');
