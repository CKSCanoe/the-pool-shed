// v1.75.0 Customer experience: after acceptance the customer sees what is due and how to pay (bank details only after
// acceptance, from the server), a PDF copy, a general question button, and a bottom bar that reads well on a phone.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const api = read('api/quote.js'), srv = read('server/quote.js'), portal = read('public/quote-customer-portal.js'), css = read('public/quote-customer-portal.css');

// Server: bank details and amount only once accepted; deposit follows the quote's own deposit rule.
assert.ok(api.includes('async function paymentAfterAcceptance(p,acceptedDeposit)'));
assert.ok(api.includes("payment:p.accepted_at?await paymentAfterAcceptance(p):undefined"), 'never before acceptance');
assert.ok(api.includes('payment:await paymentAfterAcceptance(p,totals.deposit)'), 'accept answer uses the accepted choices');
assert.ok(api.includes("db('ps_ledger_settings?workspace_id=eq.'+eq(p.workspace_id)+'&select=invoice_profile')"));
assert.ok(api.includes("if(t(ip.sort_code)&&t(ip.account_number))bank={"), 'bank shown only when complete');
assert.ok(!/invoice_profile[^;]*send\(res,200,\{[^}]*profile/.test(api), 'the whole invoice profile is never sent');
const m = srv.match(/export function acceptedTotals\(publicPayload,lines\)\{[^\n]*\}/)[0];
const money = v => Math.round(Number(v || 0) * 100) / 100;
const acceptedTotals = new Function('money', m.replace('export ', '') + '; return acceptedTotals;')(money);
const lines = [{ qty: 1, unitPrice: 10000, unitCost: 6000 }];
assert.equal(acceptedTotals({ vatRate: 20, payment: { mode: 'deposit', depositType: 'percent', depositPercent: 30 } }, lines).deposit, 3600);
assert.equal(acceptedTotals({ vatRate: 20, payment: { mode: 'deposit', depositType: 'percent', depositPercent: 50 } }, lines).deposit, 6000);
assert.equal(acceptedTotals({ vatRate: 20, payment: { mode: 'deposit', depositType: 'fixed', depositFixed: 2500 } }, lines).deposit, 2500);
assert.equal(acceptedTotals({ vatRate: 20, payment: { mode: 'full' } }, lines).deposit, 12000);
assert.equal(acceptedTotals({ vatRate: 20, payment: { mode: 'none' } }, lines).deposit, 0);
assert.equal(acceptedTotals({ vatRate: 20, depositPercent: 40 }, lines).deposit, 4800, 'older published versions keep their percentage');

// Customer page.
assert.ok(portal.includes('function payBlock(pay)') && portal.includes("'<div><dt>Sort code</dt><dd>'+esc(b.sortCode)"));
assert.ok(portal.includes('publication.payment=accepted&&accepted.payment') && portal.includes('publication.payment=result.payment'));
assert.ok(portal.includes('function acceptedBanner()'));
assert.ok(portal.includes("window.print();return}") && portal.includes('class="pc-nav-btn" data-print>Save PDF</button>'));
assert.ok(portal.includes("data-ask-general>Ask a question</button>"));
assert.ok(portal.includes("window.addEventListener('beforeprint'"));
assert.ok(/@media print\{[\s\S]*\.pc-nav,\.pc-project-bar/.test(css), 'PDF copy hides the buttons and bars');
assert.ok(css.includes('.pc-project-bar .left b{font-size:13px}'), 'bottom bar text is readable');
assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css.slice(css.indexOf('/* v1.75.0'))), 'no fixed colours in the new styles');
console.log('Quote customer experience v1.74: payment details after acceptance, deposit per quote, PDF copy, questions, phone bar.');
