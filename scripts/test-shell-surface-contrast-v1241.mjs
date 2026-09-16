import fs from 'node:fs'; import path from 'node:path';
const dir='public/assets/css/system'; const bad=[];
for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.css'))){
 const text=fs.readFileSync(path.join(dir,file),'utf8');
 const rx=/([^{}]+)\{([^{}]*)\}/g; let m;
 while((m=rx.exec(text))){
  const body=m[2];
  if(!/background(?:-color)?\s*:\s*var\(--(?:color-brand-navy|color-shell)\)/.test(body)) continue;
  const c=body.match(/(?<!-)color\s*:\s*([^;!}]+)/); if(!c) continue;
  const v=c[1].trim();
  if(['var(--color-surface-default)','var(--color-text-primary)','var(--color-action-focus)','var(--color-status-info)','var(--ink)'].includes(v)) bad.push(`${file}: ${m[1].trim()} -> ${v}`);
 }
}
if(bad.length){console.error('FAIL shell surface contrast v1.24.1');bad.forEach(x=>console.error('- '+x));process.exit(1)}
console.log('PASS shell surfaces use shell-safe foreground roles');
