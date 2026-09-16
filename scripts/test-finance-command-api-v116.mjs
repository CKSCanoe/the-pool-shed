import fs from 'node:fs';import assert from 'node:assert/strict';
const api=fs.readFileSync('api/finance.js','utf8');
assert(api.includes('remote,payload,checked_at')||api.includes('payload,remote,checked_at'),'Finance status must return linked remote/payload/check data to Finance Command');
assert(api.includes("action==='refresh-document'"),'Finance API must support safe refresh of one linked Xero document');
assert(api.includes("action==='reconcile'"),'Finance API must retain ID-based reconcile support');
assert(api.includes("Invoices/'+d.xero_id")||api.includes("Invoices/"),'Linked document refresh must fetch by Xero InvoiceID');
assert(api.includes("invoice_refreshed")||api.includes("document_refreshed"),'Linked refresh must be audited');
assert(!api.includes('Contact.Name===')&&!api.includes('Contact.Name =='),'Finance API must not reconcile primarily by contact display name');
console.log('PASS Finance Command Xero API enrichment contract');
