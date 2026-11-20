// Pool Shed v1.51 — send posted ledger documents (supplier bills, supplier payments) from the outbox to Xero.
// READY BUT NOT LINKED (owner decision 20 Nov 2026). This only runs when ALL of these are true:
//   1. the server's Xero live lock is open (XERO_INTEGRATION_MODE=live and every Xero key set) — api/finance.js cron;
//   2. an authorised Xero connection exists for the workspace;
//   3. the ps_feature_flags row 'xero_push' is switched on.
// Bills go first; a payment is sent only after every bill it settles is in Xero.
// Safe to retry: each bill carries Reference "PS-<document number>" and is looked up before creating, and every
// request carries an idempotency key, so a retry never creates a duplicate in Xero.

export async function ledgerPushEnabled(db) {
  const rows = await db('ps_feature_flags?name=eq.xero_push&select=enabled');
  return !!(rows && rows[0] && rows[0].enabled === true);
}

export async function pushLedgerOutbox(w, c, { db, xero, limit = 10 } = {}) {
  if (!c || !c.tenant_id) return { connected: false, sent: 0 };
  if (!(await ledgerPushEnabled(db))) return { skipped: 'xero_push is off', sent: 0 };
  const enc = encodeURIComponent;
  const rows = await db('ps_xero_outbox?workspace_id=eq.' + enc(w) + '&state=eq.ready&order=prepared_at.asc&limit=' + Number(limit));
  // Bills before payments.
  rows.sort((a, b) => (a.kind === 'bill' ? 0 : 1) - (b.kind === 'bill' ? 0 : 1));
  let sent = 0;
  const results = [];
  for (const row of rows) {
    try {
      await db('ps_xero_outbox?document_id=eq.' + enc(row.document_id), { method: 'PATCH', body: { state: 'sending', attempts: (row.attempts || 0) + 1 } });
      let xeroId = null;
      if (row.kind === 'bill') {
        const ref = row.payload.Reference;
        const existing = (await xero(c, 'Invoices?where=' + enc('Reference=="' + ref + '"'))).Invoices || [];
        if (existing.length > 1) throw Object.assign(Error('More than one Xero bill has reference ' + ref), { review: true });
        if (existing.length === 1) xeroId = existing[0].InvoiceID;
        else {
          const created = await xero(c, 'Invoices', { method: 'POST', key: row.document_id, body: { Invoices: [row.payload] } });
          xeroId = created.Invoices && created.Invoices[0] && created.Invoices[0].InvoiceID;
        }
      } else if (row.kind === 'supplier_payment') {
        // Rebuild with the Xero IDs of the bills (they are in Xero by now, or the row would still be held).
        const prepared = await db('rpc/ps_xero_prepare_document', { method: 'POST', body: { w, doc_id: row.document_id } });
        if (prepared && Array.isArray(prepared.problems) && prepared.problems.length) {
          await db('ps_xero_outbox?document_id=eq.' + enc(row.document_id), { method: 'PATCH', body: { state: 'held' } });
          results.push({ document: row.document_id, held: prepared.problems });
          continue;
        }
        const payments = (prepared.payload.Payments || []).map(p => ({ Invoice: { InvoiceID: p.Invoice.InvoiceID }, Account: p.Account, Date: p.Date, Amount: p.Amount, Reference: p.Reference }));
        if (payments.some(p => !p.Invoice.InvoiceID)) throw Error('A bill for this payment is not in Xero yet');
        const created = await xero(c, 'Payments', { method: 'PUT', key: row.document_id, body: { Payments: payments } });
        xeroId = created.Payments && created.Payments.map(p => p.PaymentID).join(',');
      } else {
        throw Object.assign(Error('This document type is not sent to Xero yet'), { review: true });
      }
      if (!xeroId) throw Error('Xero did not return an ID');
      await db('ps_xero_outbox?document_id=eq.' + enc(row.document_id), { method: 'PATCH', body: { state: 'sent', xero_id: xeroId, sent_at: new Date().toISOString(), last_error: null } });
      await db('ps_ledger_documents?id=eq.' + enc(row.document_id), { method: 'PATCH', body: { xero_status: 'in_xero', xero_id: xeroId, xero_message: null } });
      sent += 1;
      results.push({ document: row.document_id, xero_id: xeroId });
    } catch (e) {
      await db('ps_xero_outbox?document_id=eq.' + enc(row.document_id), { method: 'PATCH', body: { state: e.review ? 'needs_attention' : 'ready', last_error: String(e.message || e).slice(0, 500) } });
      await db('ps_ledger_documents?id=eq.' + enc(row.document_id), { method: 'PATCH', body: { xero_status: 'needs_attention', xero_message: String(e.message || e).slice(0, 500) } });
      results.push({ document: row.document_id, error: String(e.message || e) });
      if (!e.review) break; // a connection or Xero problem: stop and retry on the next scheduled run
    }
  }
  return { sent, results };
}
