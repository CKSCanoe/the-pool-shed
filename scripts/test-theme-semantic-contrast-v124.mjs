import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const cssDir = 'public/assets/css/system';
const tokenCss = fs.readFileSync(path.join(cssDir, '00-color-tokens.css'), 'utf8');
const darkMarker = tokenCss.indexOf('html[data-theme="dark"]');
assert.ok(darkMarker > 0, 'Canonical colour token file must define a dark theme override');
function parsePalette(source){
  const result={};
  for(const match of source.matchAll(/(--color-[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) result[match[1]]=match[2];
  return result;
}
const light = parsePalette(tokenCss.slice(0,darkMarker));
const dark = {...light, ...parsePalette(tokenCss.slice(darkMarker))};

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
    const modes = /data-theme=[\"']dark|body\.dark/.test(selector) ? [['dark',dark]] : [['light',light],['dark',dark]];
    for(const [mode,palette] of modes){
      const bgHex=resolve(bg,palette),fgHex=resolve(fg,palette);
      if(!bgHex||!fgHex) continue;
      const ratio=contrast(bgHex,fgHex);
      if(ratio<4.5) failures.push(`${file} [${mode}] ${selector} = ${ratio.toFixed(2)}:1 (${bg} / ${fg})`);
    }
  }
}
assert.equal(failures.length,0,`Semantic background/text contrast failures:\n${failures.slice(0,120).join('\n')}${failures.length>120?`\n... plus ${failures.length-120} more`:''}`);
console.log('PASS v1.24 direct semantic background/text pairs meet 4.5:1 in both light and dark themes.');
