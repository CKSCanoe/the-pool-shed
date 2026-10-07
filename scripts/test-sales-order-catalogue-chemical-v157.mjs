import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const workspace=fs.readFileSync('public/sales-workspace.js','utf8');
const search=fs.readFileSync('public/sales-order-search.js','utf8');
const css=fs.readFileSync('public/assets/css/system/42-sales-order-parity.css','utf8');

assert.match(legacy,/document\.body\.appendChild\(els\.drawer\)/,'multi-item picker must escape contained sales screen');
assert.match(legacy,/so-batch-top-commit/,'multi-item picker must expose an always-visible add control');
assert.match(legacy,/order\.updatedAt = new Date\(\)\.toISOString\(\);\n        if \(saveAppData\(\) === false\)/,'single catalogue item must persist before render');
assert.match(legacy,/function addBatchProductsToSalesOrder[\s\S]*if \(saveAppData\(\) === false\)/,'bulk catalogue additions must persist before render');

assert.match(workspace,/id="salesOrderProductResults" class="so4-chemical-results so4-stock-results"/,'Sales Order search must reuse the Chemical Part-Use dropdown presentation');
assert.match(workspace,/so4-finder-shell so-catalogue-picker/,'production Sales Order finder must be discoverable by the popup search engine');
assert.match(workspace,/data-so-native-stock-search="true"/,'main Sales Order search must use the native reliable dropdown path');
assert.match(workspace,/function so4StockSearchResults\(/,'main Sales Order live search renderer missing');
assert.match(workspace,/function so4StockResultsBox\(/,'native Sales Order search must own an in-place result box');
assert.match(workspace,/body > #salesOrderProductResults/,'native Sales Order search must recover a stale portal back into the finder');
assert.match(legacy,/if \(!addLineInput \|\| addLineInput\.dataset\.soNativeStockSearch === "true"\) return;/,'legacy Sales Order search must not render recent products for the native picker');
assert.match(search,/input\.dataset\.soNativeStockSearch === 'true'\) return;\n      renderResults\(input, query\);/,'compatibility search renderer must yield to native picker');
assert.match(workspace,/data-so-stock-product=/,'main Sales Order search results must be selectable');
assert.match(search,/input\.dataset\.soNativeStockSearch === 'true'/,'legacy search engine must yield to the native Sales Order dropdown');
assert.match(search,/slice\(0, 10\)\.map/,'typed product search should stay compact and show only the best matches');
assert.match(workspace,/id="salesOrderSelectedProduct"/,'selected catalogue product summary missing');
assert.match(workspace,/id="chemicalUsageSearch"/,'chemical catalogue search missing');
assert.match(workspace,/id="chemicalMinimumCharge"[^>]*value="10\.00"/,'chemical minimum charge must default to £10');
assert.match(workspace,/id="chemicalFullThreshold"[^>]*value="90"/,'full-pack threshold must default to 90%');
assert.match(workspace,/chargeType:'chemicalUsage'/,'chemical usage must remain identifiable on the sales line');
assert.match(css,/body>\.so-batch-drawer/,'portalised multi-item picker viewport guard missing');
assert.match(css,/\.so4-chemical-results/,'chemical suggestion popup styling missing');
assert.match(css,/stock search deliberately reuses the Chemical Part-Use/,'main Sales Order search must intentionally inherit Chemical Part-Use styling');
assert.doesNotMatch(css,/so4-stock-results button\s*\{[\s\S]*grid-template-columns/,'main Sales Order search must not have a separate multi-column result design');

const start=workspace.indexOf('  function so4ChemicalUnit(');
const end=workspace.indexOf('  function so4UpdateChemicalPreview()',start);
assert(start>0&&end>start,'chemical calculation helpers not found');
const source=workspace.slice(start,end);

const fields={
  chemicalUsageSearch:{dataset:{selectedProductId:'CHEM',orderId:'SO-1'}},
  chemicalPackAmount:{value:'1'},
  chemicalPackUnit:{value:'kg'},
  chemicalUsedAmount:{value:'0.5'},
  chemicalUsedUnit:{value:'kg'},
  chemicalMinimumCharge:{value:'10'},
  chemicalFullThreshold:{value:'90'}
};
const ctx={
  document:{getElementById:id=>fields[id]||null},
  salesOrder:id=>id==='SO-1'?{id:'SO-1',customerId:'C1'}:null,
  product:id=>id==='CHEM'?{id:'CHEM',name:'Test Chlorine',sku:'TC-1',cost:20,rrp:40}:null,
  salesOrderLinePrice:()=>40,
  money:value=>'£'+Number(value).toFixed(2),
  escapeHtml:value=>String(value),
  window:{},
  data:{products:[]},
  console
};
vm.createContext(ctx);
vm.runInContext(source,ctx);

let calc=ctx.so4ChemicalCalculation();
assert(calc.valid);
assert.equal(calc.charge,20,'500g of a £40 1kg pack should charge £20');
assert.equal(calc.cost,10,'cost should be proportional to actual usage');

fields.chemicalUsedAmount.value='0.1';
calc=ctx.so4ChemicalCalculation();
assert.equal(calc.charge,10,'small part-use must honour the £10 minimum');

fields.chemicalUsedAmount.value='0.95';
calc=ctx.so4ChemicalCalculation();
assert.equal(calc.charge,40,'90%+ part-use should charge the full pack price');

fields.chemicalUsedAmount.value='1.5';
calc=ctx.so4ChemicalCalculation();
assert.equal(calc.charge,60,'one full pack plus half of the next should charge £60 at £40/pack');

fields.chemicalUsedAmount.value='500';
fields.chemicalUsedUnit.value='ml';
calc=ctx.so4ChemicalCalculation();
assert.equal(calc.valid,false,'mass and volume units must not be mixed');

console.log('PASS Sales Order catalogue add flow, live popup search and chemical part-use charging rules');