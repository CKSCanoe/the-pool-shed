import fs from 'node:fs';
import assert from 'node:assert/strict';
const js=fs.readFileSync('public/project-workspace.js','utf8');
for(const text of [
  'Precision Desk','Stage Board','Project 360','Scope & Tasks','Materials','Procurement','Stock & Job Bin','Tools','Costing & Margin','Billing & Variations','Site Notes & Files','Activity','Settings',
  'Quoted / contract','Approved variations','Forecast final cost','Projected profit','Projected margin','Invoiced / queued','Remaining to invoice',
  'Planned','Allocated','Inbound','Job Bin','Used','Return pending','Damaged / lost','Budget','Forecast','Variance',
  'invoiceExposureThresholdPct','invoiceExposureThresholdNet','minimumMargin',
  'data-project-material-plan','data-project-stock-use','data-project-stock-damage'
]) assert(js.includes(text),`Missing Project 360 workspace marker: ${text}`);
assert(js.includes("psProjectHealth"),'Project health must be derived from the engine.');
assert(js.includes("psProjectStockSummary"),'Project stock must be derived from shared stock records.');
assert(js.includes("psProjectInvoiceReview"),'Existing reviewed project billing workflow must remain available.');
assert(js.includes("data-open-po"),'Project procurement must open the approved Purchase Order workspace.');
assert(!js.includes("tabs=['Overview','Orders & items','Costs','Extras'"),'Legacy shallow project tab set must not remain authoritative.');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
for(const stage of ['Planning','Approved','Procurement','Ready for Site','In Progress','Commercial Review','Ready to Invoice','Completed','On Hold','Cancelled']) assert(legacy.includes(`\"${stage}\"`)||legacy.includes(`'${stage}'`),`Legacy project editor must offer lifecycle status: ${stage}`);
console.log('Project 360 workspace structure, commercial bar, stock controls, billing thresholds and linked PO navigation passed.');
