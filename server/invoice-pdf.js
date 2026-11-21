// Pool Shed v1.54 — sales invoice / credit note PDF (A4), built without any library.
// Input: the object returned by ps_sales_invoice_get. Output: a Uint8Array holding a valid PDF 1.4 file.
// Uses the two standard PDF fonts (Helvetica, Helvetica-Bold) with their real character widths, so text wraps and
// right-aligns exactly. Characters outside Windows-1252 are replaced, never dropped silently.

const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const WIN = { '€': 0x80, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };

function bytesOf(text) {
  const out = [];
  for (const ch of String(text == null ? '' : text).replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) out.push(c);
    else if (WIN[ch]) out.push(WIN[ch]);
    else if (c >= 160 && c <= 255) out.push(c);
    else out.push(63); // '?'
  }
  return out;
}
function width(text, size, bold) {
  const t = bold ? W_BOLD : W_REG;
  return bytesOf(text).reduce((n, c) => n + (c >= 32 && c <= 126 ? t[c - 32] : 556), 0) * size / 1000;
}
function pdfString(text) {
  return '(' + bytesOf(text).map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c)
    : c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('') + ')';
}
function wrap(text, size, max, bold) {
  const lines = []; let cur = '';
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    const next = cur ? cur + ' ' + word : word;
    if (width(next, size, bold) <= max) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = word;
    while (width(cur, size, bold) > max) { let i = cur.length; while (i > 1 && width(cur.slice(0, i), size, bold) > max) i--; lines.push(cur.slice(0, i)); cur = cur.slice(i); }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
const money = n => { const v = Math.round((Number(n) || 0) * 100) / 100; return (v < 0 ? '-£' : '£') + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const ukDate = iso => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const qtyText = q => { const n = Number(q) || 0; return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000); };
function addressLines(a) {
  if (!a) return [];
  if (typeof a === 'string') return a.split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  return ['company', 'line1', 'address1', 'street', 'line2', 'address2', 'line3', 'city', 'town', 'county', 'region', 'postcode', 'postCode', 'zip', 'country']
    .map(k => a[k]).filter(v => v && String(v).trim()).map(v => String(v).trim()).filter((v, i, arr) => arr.indexOf(v) === i);
}

export function invoicePdf(inv) {
  const A4W = 595.28, A4H = 841.89, M = 48, BRAND = [0.106, 0.302, 0.337], INK = [0.11, 0.13, 0.15], MUTED = [0.42, 0.46, 0.5], RULE = [0.85, 0.87, 0.89];
  const pages = []; let ops = [];
  const credit = inv.doc_type === 'sales_credit';
  const co = inv.company || {}, cu = inv.customer || {};
  const colour = (c, stroke) => ops.push(c.map(v => v.toFixed(3)).join(' ') + (stroke ? ' RG' : ' rg'));
  const text = (s, x, y, size = 9.5, bold = false, c = INK) => { colour(c); ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Td ' + pdfString(s) + ' Tj ET'); };
  const right = (s, xr, y, size, bold, c) => text(s, xr - width(s, size || 9.5, bold), y, size, bold, c);
  const rect = (x, y, w, h, c) => { colour(c); ops.push(x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); };
  const line = (x1, y1, x2, y2, c = RULE, lw = 0.6) => { colour(c, true); ops.push(lw + ' w ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S'); };
  const title = credit ? 'CREDIT NOTE' : 'INVOICE';
  const cols = { desc: M, qty: 340, unit: 405, vat: 455, net: A4W - M };

  function header(first) {
    rect(0, A4H - 10, A4W, 10, BRAND);
    let y = A4H - 58;
    text(co.legal_name || co.name || 'Pool Bros', M, y, 18, true, BRAND);
    right(title, A4W - M, y, 18, true, INK);
    y -= 16;
    const coLines = addressLines(co.address).concat([co.phone, co.email, co.website].filter(Boolean));
    coLines.slice(0, 6).forEach((s, i) => text(s, M, y - i * 12, 8.5, false, MUTED));
    const meta = [[credit ? 'Credit note' : 'Invoice', inv.doc_number], ['Date', ukDate(inv.doc_date)]];
    if (!credit) meta.push(['Payment due', inv.due_date && inv.due_date !== inv.doc_date ? ukDate(inv.due_date) : 'On receipt']);
    if (credit && inv.credits_invoice) meta.push(['Against invoice', inv.credits_invoice.doc_number]);
    if (inv.customer_po) meta.push(['Your reference', inv.customer_po]);
    if (inv.source_label) meta.push([inv.source_type === 'job' ? 'Project' : 'Order', inv.source_label]);
    if (co.vat_number) meta.push(['VAT number', co.vat_number]);
    meta.forEach(([k, v], i) => { text(k, 360, y - i * 13, 8.5, false, MUTED); right(String(v || ''), A4W - M, y - i * 13, 9, true); });
    if (!first) return A4H - 120;
    y = Math.min(y - Math.max(coLines.length, meta.length) * 13 - 18, A4H - 190);
    text(credit ? 'CREDIT TO' : 'BILL TO', M, y, 8, true, MUTED);
    y -= 14;
    text(cu.name || '', M, y, 10.5, true);
    addressLines(cu.address).slice(0, 6).forEach((s, i) => text(s, M, y - 13 - i * 12, 9, false, INK));
    if (cu.vat_number) text('VAT ' + cu.vat_number, M, y - 13 - Math.min(addressLines(cu.address).length, 6) * 12, 8.5, false, MUTED);
    return y - 26 - Math.min(addressLines(cu.address).length, 6) * 12 - (cu.vat_number ? 12 : 0);
  }
  function tableHead(y) {
    rect(M, y - 6, A4W - 2 * M, 20, [0.95, 0.96, 0.97]);
    text('Description', cols.desc + 6, y, 8.5, true, MUTED);
    right('Qty', cols.qty + 30, y, 8.5, true, MUTED);
    right('Unit', cols.unit + 40, y, 8.5, true, MUTED);
    right('VAT', cols.vat + 30, y, 8.5, true, MUTED);
    right('Net', cols.net - 6, y, 8.5, true, MUTED);
    return y - 22;
  }
  function newPage() { pages.push(ops); ops = []; return tableHead(header(false)); }

  let y = tableHead(header(true));
  for (const l of inv.lines || []) {
    const desc = wrap(l.description + (l.sku ? '  (' + l.sku + ')' : ''), 9, cols.qty - cols.desc - 40, false);
    const h = desc.length * 11.5 + 6;
    if (y - h < 70) y = newPage();
    desc.forEach((s, i) => text(s, cols.desc + 6, y - i * 11.5, 9, false, l.deduction ? MUTED : INK));
    right(qtyText(l.qty), cols.qty + 30, y, 9);
    right(l.unit_net == null ? '' : money(l.unit_net), cols.unit + 40, y, 9);
    right(l.vat_rate == null ? '' : (Number(l.vat_rate) || 0) + '%', cols.vat + 30, y, 9);
    right(money(l.net), cols.net - 6, y, 9, false, l.deduction ? MUTED : INK);
    y -= h; line(M, y + 8, A4W - M, y + 8);
  }

  // Totals
  if (y < 290) y = newPage();  // totals (about 110pt) must stay clear of the payment details at the foot
  y -= 8;
  const tx = 360, tr = A4W - M;
  const row = (k, v, bold, size) => { text(k, tx, y, size || 9.5, bold, bold ? INK : MUTED); right(v, tr, y, size || 9.5, bold); y -= (size || 9.5) + 7; };
  row('Subtotal (net)', money(inv.net));
  const groups = (inv.groups || []).filter(g => Number(g.net) || Number(g.vat));
  if (groups.length > 1) groups.forEach(g => row('VAT at ' + Number(g.rate) + '% on ' + money(g.net), money(g.vat)));
  else row('VAT' + (groups[0] ? ' at ' + Number(groups[0].rate) + '%' : ''), money(inv.vat));
  line(tx, y + 12, tr, y + 12, INK, 0.8);
  row(credit ? 'Total credit' : 'Total', money(inv.gross), true, 12);
  if (!credit) {
    const paid = Math.round(((Number(inv.gross) || 0) - (Number(inv.open) || 0)) * 100) / 100;
    if (paid > 0) row('Paid / credited', '-' + money(paid));
    rect(tx - 6, y - 6, tr - tx + 12, 22, [0.93, 0.96, 0.96]);
    row('Balance due', money(inv.open), true, 12);
  }
  if (credit && inv.reason) { y -= 6; wrap('Reason: ' + inv.reason, 9, A4W - 2 * M, false).forEach(s => { text(s, M, y, 9, false, MUTED); y -= 12; }); }

  // Payment details and footer (always on the last page)
  let fy = 150;
  line(M, fy + 18, A4W - M, fy + 18);
  if (!credit) {
    text('How to pay', M, fy, 9.5, true, BRAND);
    const pay = [
      co.bank_name && ('Bank: ' + co.bank_name), co.account_name && ('Account name: ' + co.account_name),
      co.sort_code && ('Sort code: ' + co.sort_code), co.account_number && ('Account number: ' + co.account_number),
      co.iban && ('IBAN: ' + co.iban), 'Please use ' + inv.doc_number + ' as the payment reference.'].filter(Boolean);
    pay.forEach((s, i) => text(s, M, fy - 14 - i * 12, 9));
    if (co.payment_note) wrap(co.payment_note, 8.5, 230, false).slice(0, 6).forEach((s, i) => text(s, 320, fy - 14 - i * 11, 8.5, false, MUTED));
  }
  const foot = [co.legal_name || co.name, co.company_number && ('Registered in England and Wales no. ' + co.company_number), co.vat_number && ('VAT no. ' + co.vat_number)].filter(Boolean).join('  ·  ');
  if (co.footer) wrap(co.footer, 8, A4W - 2 * M, false).slice(0, 2).forEach((s, i) => text(s, M, 46 - i * 10, 8, false, MUTED));
  text(foot, M, 30, 8, false, MUTED);
  pages.push(ops);

  return assemblePdf(pages, title + ' ' + inv.doc_number);
}

// Assemble the file: catalog, page tree, fonts, then one page + content stream per page (shared by every document).
function assemblePdf(pages, docTitle) {
  const A4W = 595.28, A4H = 841.89, M = 48;
  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  const catalog = add(null), tree = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  pages.forEach((p, i) => {
    const body = p.concat(pages.length > 1 ? ['BT /F1 8 Tf ' + (A4W - M - 40).toFixed(2) + ' 30 Td ' + pdfString('Page ' + (i + 1) + ' of ' + pages.length) + ' Tj ET'] : []).join('\n');
    const content = add('<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream');
    kids.push(add('<< /Type /Page /Parent ' + tree + ' 0 R /MediaBox [0 0 ' + A4W + ' ' + A4H + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + content + ' 0 R >>'));
  });
  objs[catalog - 1] = '<< /Type /Catalog /Pages ' + tree + ' 0 R >>';
  objs[tree - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
  const info = add('<< /Title ' + pdfString(docTitle) + ' /Producer (Pool Shed) /CreationDate (D:' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z) >>');
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

// v1.59 customer statement: opening balance, each transaction with a running balance, closing balance, ageing.
// acct: from ps_customer_account; company: from ps_invoice_profile_get (profile + company).
export function statementPdf(acct, company) {
  const A4W = 595.28, A4H = 841.89, M = 48, BRAND = [0.106, 0.302, 0.337], INK = [0.11, 0.13, 0.15], MUTED = [0.42, 0.46, 0.5], RULE = [0.85, 0.87, 0.89];
  const pages = []; let ops = [];
  const co = Object.assign({}, company && company.company, company && company.profile), cu = acct.customer || {}, st = acct.statement || {};
  const colour = (c, stroke) => ops.push(c.map(v => v.toFixed(3)).join(' ') + (stroke ? ' RG' : ' rg'));
  const text = (s, x, y, size = 9.5, bold = false, c = INK) => { colour(c); ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Td ' + pdfString(s) + ' Tj ET'); };
  const right = (s, xr, y, size, bold, c) => text(s, xr - width(s, size || 9.5, bold), y, size, bold, c);
  const rect = (x, y, w, h, c) => { colour(c); ops.push(x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); };
  const line = (x1, y1, x2, y2, c = RULE) => { colour(c, true); ops.push('0.6 w ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S'); };
  const TYPE = { sales_invoice: 'Invoice', sales_credit: 'Credit note', customer_receipt: 'Payment', manual_journal: 'Refund' };
  const cols = { date: M, doc: 118, type: 205, ref: 272, debit: 350, credit: 425, bal: A4W - M };
  function head(first) {
    rect(0, A4H - 10, A4W, 10, BRAND);
    let y = A4H - 58;
    text(co.legal_name || co.name || 'Pool Bros', M, y, 18, true, BRAND); right('STATEMENT', A4W - M, y, 18, true);
    y -= 16;
    addressLines(co.address).concat([co.phone, co.email].filter(Boolean)).slice(0, 6).forEach((s, i) => text(s, M, y - i * 12, 8.5, false, MUTED));
    [['Customer', cu.name || ''], ['Period', ukDate(st.from) + ' to ' + ukDate(st.to)], ['Terms', acct.terms || ''], ['Balance due', money(st.closing)]]
      .forEach(([k, v], i) => { text(k, 360, y - i * 13, 8.5, false, MUTED); right(String(v), A4W - M, y - i * 13, 9, true); });
    y -= 6 * 13 + 4;
    if (first) { text('STATEMENT FOR', M, y, 8, true, MUTED); text(cu.name || '', M, y - 14, 10.5, true);
      addressLines(cu.address).slice(0, 5).forEach((s, i) => text(s, M, y - 27 - i * 12, 9)); y -= 27 + Math.min(addressLines(cu.address).length, 5) * 12 + 14; }
    rect(M, y - 6, A4W - 2 * M, 20, [0.95, 0.96, 0.97]);
    text('Date', cols.date + 6, y, 8.5, true, MUTED); text('Document', cols.doc, y, 8.5, true, MUTED); text('Type', cols.type, y, 8.5, true, MUTED); text('Reference', cols.ref, y, 8.5, true, MUTED);
    right('Charges', cols.debit + 40, y, 8.5, true, MUTED); right('Credits', cols.credit + 40, y, 8.5, true, MUTED); right('Balance', cols.bal - 6, y, 8.5, true, MUTED);
    return y - 20;
  }
  let y = head(true);
  text('Opening balance ' + ukDate(st.from), cols.date + 6, y, 9, false, MUTED); right(money(st.opening), cols.bal - 6, y, 9, true); y -= 16; line(M, y + 8, A4W - M, y + 8);
  for (const l of st.lines || []) {
    if (y < 150) { pages.push(ops); ops = []; y = head(false); }
    text(ukDate(l.date), cols.date + 6, y, 9); text(String(l.doc_number || ''), cols.doc, y, 9, true); text(TYPE[l.doc_type] || l.doc_type || '', cols.type, y, 9);
    text(String(l.reference || '').slice(0, 22), cols.ref, y, 9, false, MUTED);
    if (Number(l.debit)) right(money(l.debit), cols.debit + 40, y, 9); if (Number(l.credit)) right(money(l.credit), cols.credit + 40, y, 9);
    right(money(l.balance), cols.bal - 6, y, 9, true); y -= 16; line(M, y + 8, A4W - M, y + 8);
  }
  if (!(st.lines || []).length) { text('No transactions in this period.', cols.date + 6, y, 9, false, MUTED); y -= 16; }
  y -= 6; rect(340, y - 6, A4W - M - 334, 22, [0.93, 0.96, 0.96]); text('Balance due', 348, y, 12, true); right(money(st.closing), A4W - M - 6, y, 12, true); y -= 34;
  const ag = acct.aged || {};
  if (y < 120) { pages.push(ops); ops = []; y = A4H - 120; }
  text('How late (from due dates, today)', M, y, 9, true, BRAND); y -= 14;
  [['Not yet due', ag.not_due], ['1 to 30 days', ag.d1_30], ['31 to 60', ag.d31_60], ['61 to 90', ag.d61_90], ['Over 90', ag.d90_plus]].forEach(([k, v], i) => {
    const x = M + i * 98; text(k, x, y, 8.5, false, MUTED); text(money(v || 0), x, y - 12, 9.5, true); });
  y -= 34;
  if (co.sort_code && co.account_number) text('Pay by bank transfer to ' + (co.account_name || co.legal_name || co.name || '') + ', sort code ' + co.sort_code + ', account ' + co.account_number + '. Please quote your invoice numbers.', M, Math.max(y, 50), 8.5, false, MUTED);
  pages.push(ops);
  return assemblePdf(pages, 'Statement ' + (cu.name || ''));
}

export function invoiceEmailText(inv) {
  const credit = inv.doc_type === 'sales_credit', co = inv.company || {};
  const due = inv.due_date && inv.due_date !== inv.doc_date ? 'by ' + ukDate(inv.due_date) : 'on receipt';
  return {
    subject: (credit ? 'Credit note ' : 'Invoice ') + inv.doc_number + ' from ' + (co.legal_name || co.name || 'Pool Bros'),
    text: 'Hello ' + ((inv.customer && inv.customer.name) || '') + ',\n\n' +
      (credit ? 'Please find attached credit note ' + inv.doc_number + ' for ' + money(inv.gross) + '.'
              : 'Please find attached invoice ' + inv.doc_number + ' for ' + money(inv.gross) + ', due ' + due + '.' +
                (Number(inv.open) > 0 && Number(inv.open) < Number(inv.gross) ? ' The balance now due is ' + money(inv.open) + '.' : '') +
                (co.sort_code && co.account_number ? '\n\nPay by bank transfer to ' + (co.account_name || co.legal_name || co.name || '') + ', sort code ' + co.sort_code +
                 ', account ' + co.account_number + ', using ' + inv.doc_number + ' as the reference.' : '')) +
      '\n\nIf you have any questions, just reply to this email.\n\nThank you,\n' + (co.legal_name || co.name || 'Pool Bros') +
      (co.phone ? '\n' + co.phone : '')
  };
}
