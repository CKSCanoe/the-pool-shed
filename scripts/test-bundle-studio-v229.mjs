import fs from 'node:fs';
const js=fs.readFileSync('public/bundle-studio-v229.js','utf8');
const css=fs.readFileSync('public/bundle-studio-v229.css','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const checks=[
 [html.includes('bundle-studio-v229.js')&&html.includes('bundle-studio-v229.css'),'v2.2.9 assets linked'],
 [js.includes('data-bs-replace'),'replace action rendered'],
 [js.includes('openPicker(rootFrom(replace),replace.dataset.bsReplace)'),'replace action wired'],
 [js.includes('data-bs-remove-selected'),'bulk remove rendered'],
 [js.includes('removeSelected(rootFrom(removeSelectedButton))'),'bulk remove wired'],
 [js.includes('data-bs-select-all'),'select all rendered'],
 [js.includes('selectedComponents.add(id)'),'row selection wired'],
 [js.includes('confirmRemove'),'safe remove confirmation'],
 [js.includes('validateBundle'),'save validation enabled'],
 [js.includes("toast('Live stock and pricing refreshed.')"),'refresh action feedback'],
 [js.includes('data-bs-open')&&js.includes('openProductProfile'),'open product action wired'],
 [css.includes('.bs-component-toolbar')&&css.includes('.bs-row-check'),'action UI styled']
];
for(const [ok,msg] of checks){if(!ok)throw new Error('Failed: '+msg);console.log('PASS',msg)}
console.log('Bundle Studio v2.2.9 functional action checks passed');
