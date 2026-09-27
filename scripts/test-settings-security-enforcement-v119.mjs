import assert from 'node:assert/strict';import {deriveAzzyPermissions} from '../server/azzy-pool-shed.js';
const workspace={securityControl:{rolePermissions:{Engineer:{jobs:{view:true},warehouse:{view:true},purchase:{view:false},accounting:{view:false},crm:{view:false},automation:{view:true}}},financialVisibility:{Engineer:{customerBalances:false,customerCreditLimits:false,supplierCosts:false,productMargins:false,supplierBills:false,projectMargins:false}}}};
const engineer={id:'eng',role:'Engineer',permissions:{}};
const ep=deriveAzzyPermissions(workspace,engineer);
assert(ep.includes('projects.read'));assert(ep.includes('stock.read'));assert(ep.includes('knowledge.read'));
assert.equal(ep.includes('finance.read'),false);assert.equal(ep.includes('purchasing.read'),false);assert.equal(ep.includes('actions.approve'),false);
const manager={id:'mgr',role:'Management',permissions:{}};const mp=deriveAzzyPermissions({},manager);
for(const p of ['projects.read','stock.read','purchasing.read','customers.read','knowledge.read','finance.read','actions.prepare','actions.approve'])assert(mp.includes(p),`manager missing ${p}`);
console.log('PASS Settings security enforcement for Azzy role and financial boundaries');
