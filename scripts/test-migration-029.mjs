// Sales invoicing guard: the money rules live in the database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql = fs.readFileSync('database/029-sales-invoicing.sql', 'utf8').replace(/--.*$/gm, '');
for (const [re, why] of [
  [/values \('invoice_emails', false,/, 'invoice emails start switched off'],
  [/if t = 'sales_invoice' then return 'INV-' \|\| n; end if;/, 'invoice numbers carry on the INV- series'],
  [/greatest\(2049, coalesce\(max\(substring\(data->>'xeroRef' from '\^INV-\(\\d\+\)\$'\)::bigint\), 0\) \+ 1\)/, 'numbering starts after the last recorded invoice'],
  [/was invoiced before the ledger/, 'orders invoiced before the ledger are never invoiced again'],
  [/is already fully invoiced/, 'no second invoice for the same order'],
  [/is not delivered yet/, 'final invoice only once delivered'],
  [/more than the % agreed/, 'never invoice more than the order or contract'],
  [/changed since you opened it/, 'the total checked by the person must match what is posted'],
  [/Give the reason for the credit/, 'credit notes need a reason'],
  [/is more than is left on/, 'credits cannot exceed the invoice'],
  [/has only % left to pay/, 'payments cannot be over-applied'],
  [/Only Admin or Management can refund customers/, 'refunds by Admin or Management'],
  [/Only Admin or Management can change the invoice details/, 'invoice details by Admin or Management'],
  [/does not look right \(GB followed by 9 digits\)/, 'VAT number checked'],
  [/or coalesce\(\(cust->>'days'\)::integer, 0\) = 0 then inv_date/, 'due on receipt unless the customer has terms'],
  [/v->>'status' = 'Approved'/, 'project contract includes approved extras only'],
  [/'opening', true/, 'opening balances marked so they are never sent to Xero'],
]) assert(re.test(sql), why);
for (const fn of ['ps_customer_info\\(text,text\\)','ps_sales_order_pricing\\(text,text\\)','ps_sales_billed\\(text,text,text\\)','ps_job_contract\\(text,text\\)','ps_sales_open\\(uuid\\)'])
  assert(new RegExp('revoke all on function public\\.' + fn + ' from public, anon, authenticated;').test(sql), fn + ' is internal only');
for (const fn of ['ps_invoicing_queue','ps_sales_order_preview','ps_sales_invoice_create','ps_sales_credit_create','ps_customer_receipt_record','ps_customer_apply_credit',
                  'ps_customer_refund','ps_sales_documents_list','ps_aged_debtors','ps_sales_invoice_get','ps_invoice_profile_get','ps_invoice_profile_save','ps_sales_invoice_sent','ps_opening_customer_invoices']) {
  const body = sql.slice(sql.indexOf('function public.' + fn + '('), sql.indexOf('end $$;', sql.indexOf('function public.' + fn + '(')));
  assert(/ps_ledger_require_finance\(w\)/.test(body), fn + ' is for finance roles only');
}
assert(/revoke all on public\.ps_sales_invoice_sends from anon, authenticated/.test(sql), 'email log is not readable directly');
console.log('Migration 029 guard passed (sales invoicing).');
