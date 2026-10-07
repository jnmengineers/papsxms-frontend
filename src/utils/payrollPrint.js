/**
 * Payroll printouts. All figures come from the pay run as saved (payslips keep their own copy),
 * so a reprint always matches what was paid.
 */
import { letterheadHtml } from './school';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v) => Number(v || 0);
export const money = (v) => n(v).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHOD = { BANK: 'Bank', MPESA: 'M-Pesa', CASH: 'Cash', CHEQUE: 'Cheque' };

const BASE_CSS = `
    *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#000;margin:0 auto;padding:12px;max-width:820px;background:#eee}
    .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
    .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
    .sheet{background:#fff;padding:12px 14px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse} .num{text-align:right;white-space:nowrap}
    h2{text-align:center;color:#1F3864;font-size:15px;margin:6px 0 8px;letter-spacing:.5px}
    .pb{break-before:page;page-break-before:always}
    @media print{body{background:#fff;padding:0;max-width:none}.bar{display:none}.sheet{padding:0;margin:0}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

export const openPayrollPrint = (title, body, extraCss, landscape, onBlocked) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${BASE_CSS}
        @media print{@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm}} ${landscape ? 'body{max-width:1120px}' : ''} ${extraCss || ''}</style></head>
        <body><div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()">Print / Save PDF</button></div>${body}
        <p style="text-align:center;color:#888;font-size:9px">Printed ${esc(new Date().toLocaleString('en-GB'))}</p></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { onBlocked?.(); return; }
    w.document.write(html); w.document.close(); w.focus();
};

// ── Payslips (2 per A4 page) ─────────────────────────────────────────────────
export const PAYSLIP_CSS = `
    .slip{border:1.5px solid #1F3864;border-radius:6px;padding:8px 12px;break-inside:avoid;page-break-inside:avoid}
    .cut{border-top:1.5px dashed #999;margin:10px 0;position:relative}
    .cut:after{content:"✂  cut here";position:absolute;left:12px;top:-9px;background:#fff;padding:0 6px;font-size:9px;color:#999}
    .t{display:flex;justify-content:space-between;background:#1F3864;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:12px;margin:4px 0 6px}
    .who{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px 12px;font-size:10.5px;margin-bottom:6px}.who b{color:#1F3864}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .cols h4{margin:0 0 3px;font-size:11px;color:#1F3864;border-bottom:1.5px solid #1F3864}
    .cols td{font-size:10.5px;padding:2px 0;border-bottom:1px dotted #ddd}
    .cols .tot td{font-weight:bold;border-top:1.5px solid #000;border-bottom:none}
    .net{display:flex;justify-content:space-between;align-items:center;background:#e8f5e9;color:#1e7e34;border-radius:5px;padding:6px 10px;margin-top:6px}
    .net b{font-size:18px}
    .small{font-size:9.5px;color:#444;margin-top:4px}
`;

const payslipHtml = (p, runLabel) => {
    const items = p.detail?.items || [];
    const earnings = items.filter(i => i.kind === 'EARNING');
    const others = items.filter(i => i.kind === 'DEDUCTION');
    const row = (label, v, note) => `<tr><td>${esc(label)}${note ? ` <i style="color:#777">${esc(note)}</i>` : ''}</td><td class="num">${money(v)}</td></tr>`;
    const stat = p.detail?.statutory !== false;
    return `<div class="slip">
        <div style="font-size:0">${letterheadHtml({ logoSize: 34 })}</div>
        <div class="t"><span>PAYSLIP</span><span>${esc(runLabel)}</span></div>
        <div class="who">
            <span>Name: <b>${esc(p.fullName)}</b></span><span>Staff No: <b>${esc(p.staffNumber)}</b></span><span>Position: <b>${esc(p.jobTitle || '')}</b></span>
            <span>KRA PIN: <b>${esc(p.kraPin || '—')}</b></span><span>NSSF No: <b>${esc(p.nssfNumber || '—')}</b></span><span>SHA No: <b>${esc(p.shaNumber || '—')}</b></span>
        </div>
        <div class="cols">
            <div><h4>EARNINGS</h4><table>
                ${row('Basic salary', p.basic)}
                ${earnings.map(e => row(e.name, e.amount, [e.taxable ? '' : 'not taxable', e.oneOff ? 'this month' : ''].filter(Boolean).join(', '))).join('')}
                <tr class="tot"><td>GROSS PAY</td><td class="num">${money(p.gross)}</td></tr>
            </table></div>
            <div><h4>DEDUCTIONS</h4><table>
                ${stat ? row('NSSF', p.nssf) + row('SHIF', p.shif) + row('Housing Levy', p.housingLevy) : ''}
                ${row('PAYE', p.paye, n(p.relief) ? `(tax ${money(p.payeBeforeRelief)} − relief ${money(p.relief)})` : '')}
                ${others.map(d => row(d.name, d.amount, d.oneOff ? 'this month' : '')).join('')}
                <tr class="tot"><td>TOTAL DEDUCTIONS</td><td class="num">${money(n(p.gross) - n(p.net))}</td></tr>
            </table></div>
        </div>
        <div class="net"><span>NET PAY — ${esc(METHOD[p.payMethod] || p.payMethod)}${p.payMethod === 'BANK' && p.accountNumber ? ` · ${esc(p.bankName || '')} ${esc(p.accountNumber)}` : p.payMethod === 'MPESA' && p.phone ? ` · ${esc(p.phone)}` : ''}</span><b>KES ${money(p.net)}</b></div>
        <div class="small">Taxable pay ${money(p.taxablePay)}${stat ? ` · Employer also paid: NSSF ${money(p.employerNssf)}, Housing Levy ${money(p.employerHousing)}` : ''}
            <span style="float:right">Received by: ____________________</span></div>
    </div>`;
};

export const payslipsHtml = (payslips, runLabel) => payslips.map((p, i) =>
    (i > 0 ? (i % 2 === 0 ? '<div class="pb"></div>' : '<div class="cut"></div>') : '') + payslipHtml(p, runLabel)).join('');

// ── Payroll summary (landscape) ──────────────────────────────────────────────
export const SUMMARY_CSS = `
    th{background:#1F3864;color:#fff;font-size:10px;padding:4px;text-align:left} td{border:1px solid #bbb;font-size:10px;padding:3px 4px}
    tr.tot td{font-weight:bold;background:#eef3fb;border-top:2px solid #1F3864}
    .boxes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
    .boxes div{border:1px solid #1F3864;border-radius:5px;padding:6px;font-size:11px}.boxes b{display:block;font-size:14px;color:#1F3864}
    .sig{display:flex;justify-content:space-between;margin-top:26px;font-size:11px}
`;

export const summaryHtml = (run) => {
    const s = run.payslips;
    const cols = [['staffNumber', 'No'], ['fullName', 'Name'], ['basic', 'Basic'], ['gross', 'Gross'], ['nssf', 'NSSF'], ['shif', 'SHIF'], ['housingLevy', 'Housing'],
        ['paye', 'PAYE'], ['otherDeductions', 'Other ded.'], ['net', 'Net pay'], ['payMethod', 'Paid by']];
    const numeric = new Set(['basic', 'gross', 'nssf', 'shif', 'housingLevy', 'paye', 'otherDeductions', 'net']);
    const total = (k) => s.reduce((a, p) => a + n(p[k]), 0);
    return `<div class="sheet">${letterheadHtml({ logoSize: 44 })}
        <h2>PAYROLL SUMMARY — ${esc(run.label.toUpperCase())} (${esc(run.status)})</h2>
        <table><thead><tr>${cols.map(([k, l]) => `<th${numeric.has(k) ? ' class="num"' : ''}>${l}</th>`).join('')}</tr></thead><tbody>
        ${s.map(p => `<tr>${cols.map(([k]) => `<td${numeric.has(k) ? ' class="num"' : ''}>${numeric.has(k) ? money(p[k]) : esc(k === 'payMethod' ? METHOD[p[k]] || p[k] : p[k])}</td>`).join('')}</tr>`).join('')}
        <tr class="tot"><td colspan="2">TOTAL (${s.length} staff)</td>${cols.slice(2).map(([k]) => `<td class="num">${numeric.has(k) ? money(total(k)) : ''}</td>`).join('')}</tr>
        </tbody></table>
        <div class="boxes">
            <div>PAYE to KRA<b>KES ${money(run.totalPaye)}</b></div>
            <div>NSSF (staff ${money(run.totalNssf)} + employer ${money(run.totalEmployerNssf)})<b>KES ${money(n(run.totalNssf) + n(run.totalEmployerNssf))}</b></div>
            <div>SHIF to SHA<b>KES ${money(run.totalShif)}</b></div>
            <div>Housing Levy (staff ${money(run.totalHousing)} + employer ${money(run.totalEmployerHousing)})<b>KES ${money(n(run.totalHousing) + n(run.totalEmployerHousing))}</b></div>
        </div>
        <p style="font-size:11px;margin-top:8px">Total cost to the school (gross + employer NSSF + employer Housing Levy): <b>KES ${money(run.totalEmployerCost)}</b>.
            Statutory deductions are due by the 9th of the following month.</p>
        <div class="sig"><span>Prepared by (Bursar): ______________</span><span>Approved by: ______________</span><span>Date: ______________</span></div>
    </div>`;
};

// ── Payment list: bank, M-Pesa, cash/cheque ──────────────────────────────────
export const paymentListHtml = (run) => {
    const groups = [['BANK', 'BANK TRANSFERS', ['Bank', 'Account']], ['MPESA', 'M-PESA PAYMENTS', ['Phone', '']], ['CASH', 'CASH', ['Signature', '']], ['CHEQUE', 'CHEQUES', ['Cheque no.', 'Signature']]];
    const body = groups.map(([k, title, [c1, c2]]) => {
        const list = run.payslips.filter(p => p.payMethod === k);
        if (!list.length) return '';
        const cell1 = (p) => (k === 'BANK' ? `${esc(p.bankName || '')}` : k === 'MPESA' ? esc(p.phone || '') : '');
        const cell2 = (p) => (k === 'BANK' ? esc(p.accountNumber || '') : '');
        return `<h2 style="text-align:left;font-size:13px;margin-top:14px">${title} (${list.length})</h2>
            <table><thead><tr><th>No</th><th>Name</th><th>${c1}</th>${c2 ? `<th>${c2}</th>` : ''}<th class="num">Net pay</th></tr></thead><tbody>
            ${list.map(p => `<tr><td>${esc(p.staffNumber)}</td><td>${esc(p.fullName)}</td><td style="min-width:${k === 'CASH' ? '160px' : '0'}">${cell1(p)}</td>${c2 ? `<td>${cell2(p)}</td>` : ''}<td class="num">${money(p.net)}</td></tr>`).join('')}
            <tr class="tot"><td colspan="${c2 ? 4 : 3}">Total</td><td class="num">${money(list.reduce((a, p) => a + n(p.net), 0))}</td></tr></tbody></table>`;
    }).join('');
    return `<div class="sheet">${letterheadHtml({ logoSize: 44 })}<h2>SALARY PAYMENT LIST — ${esc(run.label.toUpperCase())}</h2>${body}
        <p style="font-size:11px;margin-top:10px">Total net pay: <b>KES ${money(run.totalNet)}</b></p>
        <div class="sig"><span>Prepared by: ______________</span><span>Authorised by: ______________</span></div></div>`;
};
