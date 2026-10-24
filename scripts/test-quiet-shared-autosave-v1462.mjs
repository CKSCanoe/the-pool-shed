import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const shell = fs.readFileSync('public/index.html', 'utf8');
const authority = fs.readFileSync('public/shared-one-truth-authority.js', 'utf8');

assert.match(shell, /id="offlineStatus"[^>]*role="status"/, 'team save state must remain visible without a toast');
assert.match(source, /saveCrmCustomer\(customerId, \{ quiet: true \}\)/, 'existing CRM fields save when changed');
assert.match(source, /workspaceFieldIsBeingEdited\(\)/, 'incoming shared refresh must not replace an active field');
assert.doesNotMatch(authority, /saved for everyone\./, 'routine shared saves must not show repeated success popups');

const start = source.indexOf('      function saveCrmCustomer(customerId, options) {');
const end = source.indexOf('      function applyCustomerToSalesOrder(', start);
assert(start > 0 && end > start);
const customerRecord = { id:'C1', name:'Old name', companyName:'Old name', code:'C-1', email:'old@example.test', priceList:'rrp', discount:0, addresses:{ primary:{ line1:'First Road' } }, customFields:{}, matrix:{} };
const data = { customers:[customerRecord], salesOrders:[], purchaseOrders:[] };
const formFields = [
  { dataset:{ crmField:'C1|companyName' }, type:'text', value:'Updated School' },
  { dataset:{ crmField:'C1|email' }, type:'email', value:'old@example.test' }
];
const scope = { querySelectorAll(selector) { return selector.includes('data-crm-address') ? [] : formFields; } };
let writes = 0, addressSyncs = 0, renders = 0;
const messages = [];
const context = { data, document:{ querySelector:() => scope }, customer:id => data.customers.find(item => item.id === id),
  normaliseSalesOrderDiscountRate:value => Number(value || 0), syncCustomerMasterAddressToOrders:() => { addressSyncs++; },
  saveAppData:() => { writes++; }, toast:message => { messages.push(message); }, render:() => { renders++; },
  addSalesOrderNotification:() => {}, JSON, Object, Number, Boolean, String };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
assert.equal(context.saveCrmCustomer('C1', { quiet:true }), true);
assert.equal(customerRecord.name, 'Updated School');
assert.equal(writes, 1, 'field exit writes through the existing workspace save path');
assert.equal(addressSyncs, 0, 'editing an unrelated CRM field does not rewrite linked order addresses');
assert.deepEqual(messages, [], 'automatic save is silent');
assert.equal(renders, 0, 'automatic save does not close the editor or move focus');
formFields[1].value = 'duplicate@example.test';
data.customers.push({ id:'C2', email:'duplicate@example.test' });
assert.equal(context.saveCrmCustomer('C1', { quiet:true }), false, 'duplicate email is still blocked');
assert.equal(customerRecord.email, 'old@example.test');
assert.equal(writes, 1, 'invalid values never reach shared storage');

const stateStart = source.indexOf('      function workspaceFieldIsBeingEdited() {');
const stateEnd = source.indexOf('      async function syncPendingOfflineData()', stateStart);
assert(stateStart > 0 && stateEnd > stateStart);
const status = { dataset:{}, textContent:'', title:'' };
const store = new Map();
const state = { document:{ getElementById:() => status, activeElement:null }, localStorage:{ getItem:key => store.get(key) || null },
  navigator:{ onLine:true }, workspaceDraftField:null, workspaceLocalSaveFailed:false, workspaceSyncConflict:false,
  workspaceSaveInFlight:false, sharedWorkspaceReady:true, supabaseSession:{ user:{ id:'U1' } }, active:'crm' };
vm.createContext(state);
vm.runInContext(source.slice(stateStart, stateEnd), state);
state.updateOfflineStatus();
assert.equal(status.textContent, 'Saved for team');
store.set('poolshed:v172:pendingSync', '1');
state.updateOfflineStatus();
assert.equal(status.textContent, 'Sharing changes…');
assert.equal(status.dataset.state, 'pending');
state.navigator.onLine = false;
state.updateOfflineStatus();
assert.equal(status.textContent, 'Saved on this device');
state.workspaceSyncConflict = true;
state.updateOfflineStatus();
assert.equal(status.dataset.state, 'error');

console.log('PASS quiet CRM field autosave, validation, persistent team save state and truthful offline/conflict status');
