/** Cheque payment voucher (one cheque and the bills it pays) and the cheque register. */
import { letterheadHtml } from './school';
import { amountInWords } from './amountWords';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const uniq = (a) => [...new Set(a.filter(Boolean))].join(', ');

const CSS = `
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0 auto;padding:12px;max-width:800px}
    .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:10px;display:flex;justify-content:space-between}
    .bar button{background:#FFD700;border:none;padding:6px 14px;font-weight:bold;cursor:pointer;border-radius:4px}
    h2{text-align:center;color:#1F3864;margin:8px 0;letter-spacing:.5px}
    table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #888;padding:5px 6px;text-align:left;vertical-align:top}
    th{background:#1F3864;color:#fff}.n{text-align:right;white-space:nowrap}tr.tot td{font-weight:bold;background:#eef3fb}
    .box{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;border:1.5px solid #1F3864;border-radius:6px;padding:10px;margin-top:6px}
    .words{border:1px dashed #1F3864;padding:8px;margin-top:8px;font-style:italic}
    .sign{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px;margin-top:22px}.sign div{border-top:1px solid #000;padding-top:3px;font-size:11px}
    .void{color:#b02a37;font-size:26px;font-weight:900;text-align:center;border:3px solid #b02a37;padding:6px;margin:8px 0;transform:rotate(-2deg)}
    .page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}
    @media print{.bar{display:none}body{padding:0;max-width:none}@page{size:A4;margin:12mm}}
`;

const open = (title, body, onBlocked) => {
    const w = window.open('', '_blank');
    if (!w) { onBlocked?.(); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
        <div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Print / Save PDF</button></div>${body}</body></html>`);
    w.document.close(); w.focus();
};

export const chequeVoucherHtml = (c) => `<div class="page">
    ${letterheadHtml({ logoSize: 46 })}
    <h2>CHEQUE PAYMENT VOUCHER</h2>
    ${c.cancelled ? `<div class="void">CANCELLED — ${esc(c.cancelReason || '')}</div>` : ''}
    <div class="box">
        <span>Cheque No: <b>${esc(c.chequeNumber)}</b></span><span>Date: <b>${esc(fmt(c.chequeDate))}</b></span>
        <span style="grid-column:span 2">Pay: <b>${esc(c.payee)}</b></span>
        <span>Amount: <b>KES ${money(c.amount)}</b></span><span>${c.memo ? `Memo: ${esc(c.memo)}` : ''}</span>
    </div>
    <div class="words">${esc(amountInWords(c.amount))}</div>
    <table><tr><th>Voucher</th><th>Bill date</th><th>Money group</th><th>For</th><th class="n">Amount</th></tr>
        ${(c.bills || []).map(b => `<tr><td>${esc(b.voucherNumber)}</td><td>${esc(fmt(b.spentOn))}</td><td>${esc(b.groupName)}</td><td>${esc(b.description)}</td><td class="n">${money(b.amount)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="4">TOTAL</td><td class="n">${money(c.amount)}</td></tr></table>
    <div class="sign">
        <div>Prepared by (Bursar): ${esc(uniq((c.bills || []).map(b => b.recordedBy)))}</div>
        <div>Approved by (Treasurer): ${esc(uniq((c.bills || []).map(b => b.approvedBy)))}</div>
        <div>Cheque raised by: ${esc(c.raisedBy || '')}</div>
        <div>Date: ____________________</div>
        <div>Signatory 1: ____________________</div>
        <div>Signatory 2: ____________________</div>
        <div>Received by (name &amp; ID No.): ____________________</div>
        <div>Signature &amp; date: ____________________</div>
    </div>
</div>`;

export const printChequeVouchers = (cheques, onBlocked) =>
    open(cheques.length === 1 ? `Cheque ${cheques[0].chequeNumber}` : `${cheques.length} cheque vouchers`, cheques.map(chequeVoucherHtml).join(''), onBlocked);

export const printChequeRegister = (cheques, from, to, onBlocked) => {
    const live = cheques.filter(c => !c.cancelled);
    open('Cheque register', `${letterheadHtml({ logoSize: 46 })}<h2>CHEQUE REGISTER — ${esc(fmt(from))} to ${esc(fmt(to))}</h2>
        <table><tr><th>Date</th><th>Cheque No</th><th>Payee</th><th>For</th><th>Raised by</th><th class="n">Amount</th></tr>
        ${cheques.map(c => `<tr${c.cancelled ? ' style="color:#999;text-decoration:line-through"' : ''}><td>${esc(fmt(c.chequeDate))}</td><td>${esc(c.chequeNumber)}</td><td>${esc(c.payee)}</td>
            <td>${esc((c.bills || []).map(b => b.description).join('; '))}${c.cancelled ? ` <b style="color:#b02a37;text-decoration:none">CANCELLED: ${esc(c.cancelReason)}</b>` : ''}</td><td>${esc(c.raisedBy)}</td><td class="n">${money(c.amount)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="5">TOTAL (${live.length} cheque${live.length === 1 ? '' : 's'}, cancelled left out)</td><td class="n">${money(live.reduce((a, c) => a + Number(c.amount), 0))}</td></tr></table>
        <div class="sign"><div>Treasurer: ____________________</div><div>Chairperson: ____________________</div></div>`, onBlocked);
};

/** The bursar's list of bills for the treasurer (for signing / the meeting). */
export const printBillsList = (title, bills, onBlocked) => open(title, `${letterheadHtml({ logoSize: 46 })}<h2>${esc(title.toUpperCase())}</h2>
    <table><tr><th>#</th><th>Voucher</th><th>Date</th><th>Payee</th><th>Money group</th><th>For</th><th class="n">Amount</th><th>Approve?</th></tr>
    ${bills.map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.voucherNumber)}</td><td>${esc(fmt(b.spentOn))}</td><td>${esc(b.payee || '')}</td><td>${esc(b.groupName)}</td><td>${esc(b.description)}</td><td class="n">${money(b.amount)}</td><td style="width:60px"></td></tr>`).join('')}
    <tr class="tot"><td colspan="6">TOTAL (${bills.length} bill${bills.length === 1 ? '' : 's'})</td><td class="n">${money(bills.reduce((a, b) => a + Number(b.amount), 0))}</td><td></td></tr></table>
    <div class="sign"><div>Prepared by (Bursar): ____________________</div><div>Approved by (Treasurer): ____________________</div></div>`, onBlocked);
