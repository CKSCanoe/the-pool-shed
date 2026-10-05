import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const html=fs.readFileSync('public/recovery.html','utf8');
const js=fs.readFileSync('public/recovery.js','utf8');

assert(app.includes('poolshed:v172:recoveryHold'),'main app must recognise recovery hold mode');
assert(app.includes('Recovery mode · shared sync paused'),'recovery mode must be visible');
assert(js.includes("poolshed:v172:recovery:"),'scanner must inspect automatic recovery copies');
assert(js.includes("poolshed:v171:appData"),'scanner must inspect older browser copies');
assert(js.includes("pool-shed-live-v1.8"),'scanner must inspect IndexedDB offline snapshot');
assert(js.includes("pre-manual-restore"),'current state must be backed up before restore');
assert(js.includes("localStorage.setItem(HOLD_KEY,'1')"),'restore must pause shared sync');
assert(js.includes("localStorage.setItem(APP_KEY,JSON.stringify(candidate.data))"),'restore must place chosen data into current workspace');
assert(html.includes('Pool Shed Data Recovery'),'recovery page must be present');

console.log('PASS non-destructive browser recovery scanner and sync hold');
