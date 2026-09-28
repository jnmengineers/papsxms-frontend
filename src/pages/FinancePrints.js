import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import { letterheadHtml, paymentHtml, schoolName } from '../utils/school';
import { SECTION_NAMES_LIVE } from '../utils/schoolData';

/**
 * Finance → Class Printouts
 *   • Balance slips   — one per learner, to send home through the class teacher
 *   • Class list      — one sheet per class for the class teacher (with "slip given" column)
 *   • Receipts        — every receipt for a class's payments in a date range, 2 per page
 * Figures come from /api/finance/class-sheet (payments clear the oldest charges first).
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(v || 0);
const money = (v) => num(v).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const kes = (v) => `KES ${money(v)}`;
const fmtDate = (d) => { if (!d) return ''; const x = new Date(`${String(d).slice(0, 10)}T00:00:00`); return isNaN(x) ? String(d) : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const METHODS = { MPESA: 'M-Pesa', BANK: 'Bank', CHEQUE: 'Cheque' };
const statusOf = (bal) => (num(bal) > 0 ? 'owing' : num(bal) < 0 ? 'credit' : 'cleared');
const STATUS = {
    owing: { label: 'Owing', color: '#b02a37', bg: '#fdecee' },
    cleared: { label: 'Cleared', color: '#1e7e34', bg: '#e8f5e9' },
    credit: { label: 'In credit', color: '#1F3864', bg: '#e3f2fd' },
};
const DEFAULT_MESSAGE = 'Kindly clear the balance by the date shown. Thank you for your continued support.';

// ── print window ─────────────────────────────────────────────────────────────
const openWindow = (title, css, body, onBlocked) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
        *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#000;margin:0;padding:12px;background:#f0f0f0}
        .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin:0 auto 12px;max-width:794px;display:flex;justify-content:space-between;align-items:center;gap:10px}
        .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
        .sheet{background:#fff;max-width:794px;margin:0 auto;padding:10px}
        table{width:100%;border-collapse:collapse}.num{text-align:right;white-space:nowrap}
        ${css}
        @media print{body{background:#fff;padding:0}.bar{display:none}.sheet{padding:0;max-width:none}
            body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}}
    </style></head><body>
    <div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()">Print / Save PDF</button></div>
    <div class="sheet">${body}</div></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { onBlocked?.(); return; }
    win.document.write(html); win.document.close(); win.focus();
};

// ── Balance slips ────────────────────────────────────────────────────────────
const SLIP_CSS = `
    .slip{border:1.5px solid #1F3864;border-radius:8px;padding:10px 12px;margin-bottom:6px;break-inside:avoid;page-break-inside:avoid;position:relative}
    .cut{border-top:1.5px dashed #999;margin:8px 0 10px;position:relative;break-after:avoid}
    .cut:after{content:"✂  cut here";position:absolute;left:12px;top:-9px;background:#fff;padding:0 6px;font-size:9px;color:#999}
    .title{display:flex;justify-content:space-between;align-items:center;background:#1F3864;color:#fff;border-radius:4px;padding:4px 8px;margin:6px 0 8px;font-size:12px;font-weight:bold;letter-spacing:.5px}
    .who{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;margin-bottom:6px}.who b{color:#1F3864}
    .lines td{padding:3px 6px;border-bottom:1px solid #eee;font-size:11.5px}.lines .sub td{color:#555;font-size:10.5px}
    .lines .tot td{border-top:1.5px solid #1F3864;font-weight:bold}
    .due{display:flex;justify-content:space-between;align-items:center;border-radius:6px;padding:7px 10px;margin-top:6px}
    .due .amt{font-size:20px;font-weight:800}
    .bar2{height:7px;background:#eee;border-radius:4px;overflow:hidden;margin-top:6px}.bar2 div{height:100%;background:#28a745}
    .msg{font-size:11px;margin-top:6px;font-style:italic}.foot{display:flex;justify-content:space-between;font-size:10.5px;margin-top:8px;color:#333}
    .reply{border-top:1px dotted #777;margin-top:8px;padding-top:6px;font-size:10.5px}
    .stamp{position:absolute;right:14px;top:58px;transform:rotate(-12deg);border:3px solid;border-radius:6px;padding:2px 10px;font-weight:900;font-size:16px;opacity:.85}
    .mini{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .mini .slip{margin:0;padding:8px 10px;border-style:dashed}
    .mini .row{display:flex;justify-content:space-between;align-items:baseline;font-size:11px}
    .compact .lines,.compact .bar2{display:none}
`;

function slipHtml(l, o, term) {
    const st = statusOf(l.balance);
    const S = STATUS[st];
    const bal = num(l.balance);
    const due = Math.max(bal, 0);
    // The lines add up exactly to the balance:
    //   b/f + this term − paid this term + later terms − extra paid (credit) = balance
    const bf = num(l.broughtForward), tt = num(l.thisTerm), pt = num(l.paidThisTerm), later = num(l.laterTerms);
    const extra = Math.max(0, Math.round((bf + tt - pt + later - bal) * 100) / 100);
    const pct = tt > 0 ? Math.min(100, Math.round(pt / tt * 100)) : 100;
    const header = `<div style="font-size:0">${letterheadHtml({ logoSize: o.layout === 'detailed' ? 40 : 30 })}</div>`;
    const who = `<div class="who"><span>Learner: <b>${esc(l.name)}</b></span><span>Adm: <b>${esc(l.admissionNumber)}</b></span><span>Class: <b>${esc(l.classLabel)}</b></span></div>`;
    const stamp = st === 'cleared' ? `<div class="stamp" style="color:#1e7e34;border-color:#1e7e34">CLEARED</div>`
        : st === 'credit' ? `<div class="stamp" style="color:#1F3864;border-color:#1F3864">IN CREDIT</div>` : '';

    const itemRows = o.breakdown ? (l.items || []).map(i => `<tr class="sub"><td>&nbsp;&nbsp;${esc(i.name)}${i.note ? ` <i>(${esc(i.note)})</i>` : ''}</td><td class="num">${money(i.amount)}</td></tr>`).join('') : '';
    const lines = `<table class="lines">
        ${bf ? `<tr><td>Balance brought forward (earlier terms)</td><td class="num">${money(bf)}</td></tr>` : ''}
        <tr><td><b>${esc(term)} charges</b></td><td class="num"><b>${money(l.thisTerm)}</b></td></tr>
        ${itemRows}
        <tr><td>Paid towards ${esc(term)}</td><td class="num">− ${money(pt)}</td></tr>
        ${later ? `<tr><td>Charged for later terms</td><td class="num">${money(later)}</td></tr>` : ''}
        ${extra ? `<tr><td>Extra paid in advance</td><td class="num">− ${money(extra)}</td></tr>` : ''}
        <tr class="tot"><td>${bal < 0 ? 'Credit' : 'Balance due'}</td><td class="num">${money(Math.abs(bal))}</td></tr>
    </table>`;
    const dueBox = `<div class="due" style="background:${S.bg};color:${S.color}">
        <span>${bal > 0 ? `BALANCE DUE${o.dueDate ? ` by ${esc(fmtDate(o.dueDate))}` : ''}` : bal < 0 ? 'CREDIT ON ACCOUNT' : 'FULLY PAID — THANK YOU'}</span>
        <span class="amt">${kes(bal > 0 ? due : Math.abs(bal))}</span></div>
        ${o.layout === 'detailed' && tt > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#555;margin-top:5px"><span>${esc(term)}: ${pct}% paid</span></div><div class="bar2"><div style="width:${pct}%"></div></div>` : ''}`;
    const lastPaid = l.lastPaidOn ? `Last payment: ${kes(l.lastPaidAmount)} on ${esc(fmtDate(l.lastPaidOn))}` : 'No payments yet';
    const pay = o.howToPay && bal > 0 ? paymentHtml().replace('HOW TO PAY', `HOW TO PAY — use admission number <u>${esc(l.admissionNumber)}</u> as the reference`) : '';
    const reply = o.replySlip && bal > 0 ? `<div class="reply">Parent / guardian: I have received this notice and will pay KES ____________ by ______________ &nbsp; Sign: ____________</div>` : '';

    if (o.layout === 'mini') {
        return `<div class="slip">
            <div style="font-size:10px;color:#1F3864;font-weight:bold;text-transform:uppercase">${esc(schoolName())} — Fee balance ${esc(term)}</div>
            <div class="row" style="margin-top:3px"><b>${esc(l.name)}</b><span>${esc(l.classLabel)}</span></div>
            <div class="row"><span>Adm ${esc(l.admissionNumber)}</span><b style="font-size:15px;color:${S.color}">${bal < 0 ? 'Credit ' : ''}${kes(Math.abs(bal))}</b></div>
            ${o.dueDate && bal > 0 ? `<div class="row" style="color:#b02a37"><span>Pay by</span><b>${esc(fmtDate(o.dueDate))}</b></div>` : ''}
        </div>`;
    }
    return `<div class="slip">
        ${header}${stamp}
        <div class="title"><span>FEE BALANCE NOTICE</span><span>${esc(term)}</span></div>
        ${who}
        ${o.layout === 'detailed' ? lines : ''}
        ${dueBox}
        ${o.message ? `<div class="msg">${esc(o.message)}</div>` : ''}
        ${pay}
        <div class="foot"><span>${esc(lastPaid)}</span><span>Bursar: ____________________</span></div>
        ${reply}
    </div>`;
}

// ── Class balance list ───────────────────────────────────────────────────────
const LIST_CSS = `
    th{background:#1F3864;color:#fff;padding:5px 6px;font-size:11px;text-align:left}
    td{border:1px solid #bbb;padding:4px 6px;font-size:11px}
    tr:nth-child(even) td{background:#fafafa}
    .sum{display:flex;gap:8px;margin:8px 0 10px}.sum div{flex:1;border:1px solid #ddd;border-radius:6px;padding:6px 8px;text-align:center}
    .sum b{display:block;font-size:15px;color:#1F3864}.sum span{font-size:10px;color:#555}
    .tot td{font-weight:bold;background:#eef3fb !important;border-top:2px solid #1F3864}
    .sig{display:flex;justify-content:space-between;margin-top:26px;font-size:11px}
    .grp{margin-top:14px;break-before:auto}.grp h3{margin:10px 0 4px;color:#1F3864;font-size:13px}
    .pb{break-before:page;page-break-before:always}
`;

function listTableHtml(rows, o, term) {
    const t = rows.reduce((a, l) => ({ bf: a.bf + num(l.broughtForward), tt: a.tt + num(l.thisTerm), pd: a.pd + num(l.paidThisTerm), bal: a.bal + Math.max(0, num(l.balance)) }), { bf: 0, tt: 0, pd: 0, bal: 0 });
    const owing = rows.filter(l => num(l.balance) > 0).length;
    return `<div class="sum">
            <div><b>${rows.length}</b><span>Learners</span></div>
            <div><b style="color:#b02a37">${owing}</b><span>Owing</span></div>
            <div><b style="color:#1e7e34">${rows.length - owing}</b><span>Cleared / credit</span></div>
            <div><b>${money(t.tt)}</b><span>${esc(term)} charges</span></div>
            <div><b style="color:#b02a37">${money(t.bal)}</b><span>Total owed</span></div>
        </div>
        <table><thead><tr><th>#</th><th>Adm</th><th>Learner</th>
            <th class="num">B/F</th><th class="num">This term</th><th class="num">Paid</th><th class="num">Balance</th>
            ${o.slipColumn ? '<th>Slip given</th>' : ''}${o.remarksColumn ? '<th style="width:22%">Remarks / promise</th>' : ''}
        </tr></thead><tbody>
        ${rows.map((l, i) => {
            const S = STATUS[statusOf(l.balance)];
            return `<tr><td>${i + 1}</td><td>${esc(l.admissionNumber)}</td><td>${esc(l.name)}</td>
                <td class="num">${num(l.broughtForward) ? money(l.broughtForward) : '—'}</td><td class="num">${money(l.thisTerm)}</td>
                <td class="num">${money(l.paidThisTerm)}</td>
                <td class="num" style="font-weight:bold;color:${S.color}">${num(l.balance) < 0 ? 'Cr ' : ''}${money(Math.abs(num(l.balance)))}</td>
                ${o.slipColumn ? '<td></td>' : ''}${o.remarksColumn ? '<td></td>' : ''}</tr>`;
        }).join('')}
        <tr class="tot"><td colspan="3">Totals</td><td class="num">${money(t.bf)}</td><td class="num">${money(t.tt)}</td><td class="num">${money(t.pd)}</td><td class="num">${money(t.bal)}</td>
            ${o.slipColumn ? '<td></td>' : ''}${o.remarksColumn ? '<td></td>' : ''}</tr>
        </tbody></table>
        <div class="sig"><span>Class teacher: ______________________</span><span>Signature: ____________</span><span>Date: ____________</span></div>`;
}

// ── Receipts ─────────────────────────────────────────────────────────────────
const RECEIPT_CSS = `
    .rc{border:1.5px solid #1F3864;border-radius:8px;padding:10px 14px;break-inside:avoid;page-break-inside:avoid;position:relative;min-height:120mm}
    .rc .t{background:#1F3864;color:#fff;border-radius:4px;padding:4px 8px;margin:6px 0 8px;font-weight:bold;display:flex;justify-content:space-between;font-size:12px}
    .kv td{padding:4px 6px;font-size:12px;border-bottom:1px solid #f0f0f0}.kv td:first-child{color:#555;width:36%}
    .big{font-size:18px;font-weight:800}
    .rev{position:absolute;right:20px;top:70px;transform:rotate(-12deg);color:#b02a37;border:3px solid #b02a37;padding:2px 10px;font-weight:900;font-size:18px}
    .cut{border-top:1.5px dashed #999;margin:10px 0;position:relative}
    .cut:after{content:"✂  cut here";position:absolute;left:12px;top:-9px;background:#fff;padding:0 6px;font-size:9px;color:#999}
    .pb{break-before:page;page-break-before:always}
`;

function receiptHtml(p) {
    return `<div class="rc">
        <div style="font-size:0">${letterheadHtml({ logoSize: 40 })}</div>
        ${p.reversed ? '<div class="rev">REVERSED</div>' : ''}
        <div class="t"><span>OFFICIAL RECEIPT</span><span>${esc(p.receiptNumber)}</span></div>
        <table class="kv">
            <tr><td>Date paid</td><td>${esc(fmtDate(p.paidOn))}</td></tr>
            <tr><td>Learner</td><td><b>${esc(p.student?.name)}</b> — Adm ${esc(p.student?.admissionNumber)}</td></tr>
            <tr><td>Class</td><td>${esc(p.classLabel || p.student?.className || '')}</td></tr>
            <tr><td>Amount</td><td class="big">${kes(p.amount)}</td></tr>
            <tr><td>Paid by</td><td>${esc(METHODS[p.method] || p.method)}: <b>${esc(p.reference)}</b></td></tr>
            ${p.payerName ? `<tr><td>Payer</td><td>${esc(p.payerName)}</td></tr>` : ''}
            ${p.balanceNow !== undefined ? `<tr><td>Balance now</td><td><b>${num(p.balanceNow) < 0 ? 'Credit ' : ''}${kes(Math.abs(num(p.balanceNow)))}</b></td></tr>` : ''}
            <tr><td>Received by</td><td>${esc(p.recordedBy || '')}</td></tr>
        </table>
        <p style="margin-top:22px;font-size:11px">Signature: ______________________ &nbsp;&nbsp; Stamp:</p>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
const MODES = [
    { key: 'slips', icon: 'envelope-paper-fill', title: 'Balance slips', text: 'One notice per learner to send home through the class teacher.' },
    { key: 'list', icon: 'list-ol', title: 'Class balance list', text: 'One sheet for the class teacher, with a "slip given" column.' },
    { key: 'receipts', icon: 'receipt', title: 'Receipts', text: 'Reprint every receipt for a class in a date range.' },
];

export default function ClassPrintsTab({ termOptions, defaultTerm, classes, sections, setError, blocked }) {
    const [mode, setMode] = useState('slips');
    const [termKey, setTermKey] = useState('');
    const [scope, setScope] = useState('');            // "class:<id>" | "section:<code>" | "all"
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const latest = useRef('');

    // slip / list options
    const [who, setWho] = useState('owing');           // owing | all
    const [minOwed, setMinOwed] = useState('');
    const [sortBy, setSortBy] = useState('name');      // name | balance
    const [layout, setLayout] = useState('detailed');  // detailed | compact | mini
    const [breakdown, setBreakdown] = useState(true);
    const [howToPay, setHowToPay] = useState(true);
    const [replySlip, setReplySlip] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [message, setMessage] = useState(DEFAULT_MESSAGE);
    const [slipColumn, setSlipColumn] = useState(true);
    const [remarksColumn, setRemarksColumn] = useState(false);
    const [classPerPage, setClassPerPage] = useState(true);

    // receipts
    const today = new Date();
    const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
    const [to, setTo] = useState(iso(today));
    const [receipts, setReceipts] = useState(null);

    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm, termKey]);
    useEffect(() => { if (!scope && classes.length) setScope(`class:${classes[0].classId}`); }, [classes, scope]);
    const [year, term] = termKey.split('|');
    const termLabel = year ? `${year} Term ${term}` : '';
    const [scopeKind, scopeVal] = scope.split(':');
    const cls = scopeKind === 'class' ? classes.find(c => String(c.classId) === String(scopeVal)) : null;
    const scopeLabel = cls ? classDisplayName(cls) : scopeKind === 'section' ? (SECTION_NAMES_LIVE[scopeVal] || scopeVal) : scopeKind === 'all' ? 'Whole school' : '';
    const classLabelOf = (classId, fallback) => { const c = classes.find(x => String(x.classId) === String(classId)); return c ? classDisplayName(c) : (fallback || ''); };

    // Load the term figures (slips and list)
    useEffect(() => {
        if (mode === 'receipts' || !termKey || !scope) return;
        const key = `${termKey}|${scope}`;
        latest.current = key;
        setLoading(true); setData(null);
        const params = { yearLabel: year, term, ...(scopeKind === 'class' ? { classId: scopeVal } : scopeKind === 'section' ? { section: scopeVal } : {}) };
        api.get('/api/finance/class-sheet', { params })
            .then(r => { if (latest.current === key) setData(r.data); })
            .catch(err => { if (latest.current === key) setError(serverMessage(err, 'Failed to load balances.')); })
            .finally(() => { if (latest.current === key) setLoading(false); });
    }, [mode, termKey, scope, year, term, scopeKind, scopeVal, setError]);

    // Load receipts (class only)
    const loadReceipts = async () => {
        if (!cls) { setError('Choose a class for receipts.'); return; }
        if (from > to) { setError('The start date must be before the end date.'); return; }
        const key = `r|${scope}|${from}|${to}`;
        latest.current = key;
        setLoading(true); setReceipts(null);
        try {
            const r = await api.get('/api/finance/payments', { params: { from, to, classId: cls.classId } });
            if (latest.current === key) setReceipts(r.data);
        } catch (err) { if (latest.current === key) setError(serverMessage(err, 'Failed to load receipts.')); }
        if (latest.current === key) setLoading(false);
    };
    useEffect(() => { if (mode === 'receipts') setReceipts(null); }, [mode, scope, from, to]);

    // Which learners, in what order
    const learners = (data?.learners || []).map(l => ({ ...l, classLabel: classLabelOf(l.classId, l.className) }));
    const min = Number(minOwed) || 0;
    const picked = learners
        .filter(l => who === 'all' || (num(l.balance) > 0 && num(l.balance) >= min))
        .sort((a, b) => sortBy === 'balance' ? num(b.balance) - num(a.balance) || a.name.localeCompare(b.name)
            : a.classLabel.localeCompare(b.classLabel, undefined, { numeric: true }) || a.name.localeCompare(b.name));
    const owedTotal = picked.reduce((s, l) => s + Math.max(0, num(l.balance)), 0);
    const counts = learners.reduce((c, l) => { c[statusOf(l.balance)]++; return c; }, { owing: 0, cleared: 0, credit: 0 });

    const printSlips = () => {
        if (!picked.length) { setError('No learners to print for these choices.'); return; }
        const o = { layout, breakdown: breakdown && layout === 'detailed', howToPay: howToPay && layout !== 'mini', replySlip: replySlip && layout !== 'mini', dueDate, message: layout === 'mini' ? '' : message.trim() };
        const slips = picked.map(l => slipHtml(l, o, termLabel));
        const body = layout === 'mini'
            ? `<div class="mini">${slips.join('')}</div>`
            : slips.join('<div class="cut"></div>');
        openWindow(`Fee balance slips — ${scopeLabel} — ${termLabel}`, SLIP_CSS, body, blocked);
    };

    const printList = () => {
        if (!picked.length) { setError('No learners to print for these choices.'); return; }
        const o = { slipColumn, remarksColumn };
        const groups = {};
        picked.forEach(l => { (groups[l.classLabel] = groups[l.classLabel] || []).push(l); });
        const names = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const body = names.map((n, i) => `<div class="${i > 0 && classPerPage ? 'pb' : 'grp'}">
                <div>${letterheadHtml({ logoSize: 45 })}</div>
                <h3 style="text-align:center;border-bottom:2px solid #1F3864;padding-bottom:4px">FEE BALANCES — ${esc(n)} — ${esc(termLabel)}${who === 'owing' ? ' (learners owing)' : ''}</h3>
                ${listTableHtml(groups[n], o, termLabel)}</div>`).join('');
        openWindow(`Class balance list — ${scopeLabel} — ${termLabel}`, LIST_CSS, body, blocked);
    };

    const downloadCsv = () => {
        if (!picked.length) { setError('Nothing to download for these choices.'); return; }
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const head = ['Class', 'Admission number', 'Learner', 'Brought forward', `${termLabel} charges`, 'Paid this term', 'Balance', 'Status', 'Last payment date', 'Last payment amount'];
        const lines = picked.map(l => [l.classLabel, l.admissionNumber, l.name, num(l.broughtForward), num(l.thisTerm), num(l.paidThisTerm), num(l.balance), STATUS[statusOf(l.balance)].label, l.lastPaidOn || '', l.lastPaidAmount ?? ''].map(q).join(','));
        const blob = new Blob(['\uFEFF' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Fee balances ${scopeLabel} ${termLabel}.csv`.replace(/[\\/:*?"<>|]/g, '-');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const printReceipts = (includeReversed) => {
        const list = (receipts?.payments || []).filter(p => includeReversed || !p.reversed)
            .map(p => ({ ...p, classLabel: classLabelOf(p.student?.classId, p.student?.className) }))
            .sort((a, b) => String(a.student?.name).localeCompare(String(b.student?.name)) || String(a.paidOn).localeCompare(String(b.paidOn)));
        if (!list.length) { setError('No receipts to print.'); return; }
        // Two per A4 page with a cut line between
        const body = list.map((p, i) => (i > 0 ? (i % 2 === 0 ? '<div class="pb"></div>' : '<div class="cut"></div>') : '') + receiptHtml(p)).join('');
        openWindow(`Receipts — ${scopeLabel} — ${fmtDate(from)} to ${fmtDate(to)}`, RECEIPT_CSS, body, blocked);
    };

    // ── screen ──
    const scopeSelect = (allowWide) => (
        <select style={st.select} value={scope} onChange={e => setScope(e.target.value)} aria-label="Class">
            <optgroup label="Class">
                {classes.map(c => <option key={c.classId} value={`class:${c.classId}`}>{classDisplayName(c)}</option>)}
            </optgroup>
            {allowWide && (
                <optgroup label="More than one class">
                    {sections.map(s => <option key={s} value={`section:${s}`}>{SECTION_NAMES_LIVE[s] || s} (all classes)</option>)}
                    <option value="all">Whole school</option>
                </optgroup>
            )}
        </select>
    );
    useEffect(() => { if (mode === 'receipts' && scopeKind !== 'class' && classes.length) setScope(`class:${classes[0].classId}`); }, [mode, scopeKind, classes]);

    return (
        <div>
            <div style={st.modes}>
                {MODES.map(m => (
                    <button key={m.key} type="button" onClick={() => setMode(m.key)}
                        style={{ ...st.mode, borderColor: mode === m.key ? '#1F3864' : '#e3e7ee', backgroundColor: mode === m.key ? '#eef3fb' : 'white' }}>
                        <Icon name={m.icon} style={{ fontSize: '22px', color: '#1F3864', marginRight: 0 }} />
                        <strong style={{ color: '#1F3864' }}>{m.title}</strong>
                        <span style={{ fontSize: '12px', color: '#666' }}>{m.text}</span>
                    </button>
                ))}
            </div>

            <div style={st.panel}>
                <div style={st.row}>
                    {mode !== 'receipts' && (
                        <label style={st.lbl}>Term
                            <select style={st.select} value={termKey} onChange={e => setTermKey(e.target.value)}>
                                {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </label>
                    )}
                    <label style={st.lbl}>{mode === 'receipts' ? 'Class' : 'Who'}{scopeSelect(mode !== 'receipts')}</label>
                    {mode === 'receipts' && <>
                        <label style={st.lbl}>From<input type="date" style={st.select} value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
                        <label style={st.lbl}>To<input type="date" style={st.select} value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
                        <button onClick={loadReceipts} style={{ ...st.primary, alignSelf: 'flex-end' }}><Icon name="search" />Find receipts</button>
                    </>}
                </div>

                {mode !== 'receipts' && (
                    <div style={st.row}>
                        <label style={st.lbl}>Learners
                            <select style={st.select} value={who} onChange={e => setWho(e.target.value)}>
                                <option value="owing">Only those owing</option>
                                <option value="all">Everyone (cleared ones say "Cleared")</option>
                            </select>
                        </label>
                        {who === 'owing' && <label style={st.lbl}>Owing at least (KES)<input style={{ ...st.select, width: '130px' }} inputMode="decimal" placeholder="any amount" value={minOwed} onChange={e => setMinOwed(e.target.value.replace(/[^\d.]/g, ''))} /></label>}
                        <label style={st.lbl}>Order
                            <select style={st.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="name">By class, then name</option>
                                <option value="balance">Highest balance first</option>
                            </select>
                        </label>
                    </div>
                )}

                {mode === 'slips' && (
                    <>
                        <div style={st.row}>
                            <label style={st.lbl}>Slip style
                                <select style={st.select} value={layout} onChange={e => setLayout(e.target.value)}>
                                    <option value="detailed">Detailed — item by item (about 2 per page)</option>
                                    <option value="compact">Compact — balance and how to pay (about 3–4 per page)</option>
                                    <option value="mini">Mini — name and balance only (about 10 per page)</option>
                                </select>
                            </label>
                            <label style={st.lbl}>Pay by (optional)<input type="date" style={st.select} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
                        </div>
                        {layout !== 'mini' && (
                            <>
                                <div style={{ ...st.row, gap: '16px' }}>
                                    {layout === 'detailed' && <label style={st.check}><input type="checkbox" checked={breakdown} onChange={e => setBreakdown(e.target.checked)} />Show each item (tuition, lunch, transport…)</label>}
                                    <label style={st.check}><input type="checkbox" checked={howToPay} onChange={e => setHowToPay(e.target.checked)} />"How to pay" box</label>
                                    <label style={st.check}><input type="checkbox" checked={replySlip} onChange={e => setReplySlip(e.target.checked)} />Parent reply strip</label>
                                </div>
                                <label style={{ ...st.lbl, width: '100%' }}>Message to parents
                                    <textarea style={{ ...st.select, minHeight: '54px', width: '100%', fontFamily: 'inherit' }} maxLength={300} value={message} onChange={e => setMessage(e.target.value)} />
                                </label>
                            </>
                        )}
                    </>
                )}
                {mode === 'list' && (
                    <div style={{ ...st.row, gap: '16px' }}>
                        <label style={st.check}><input type="checkbox" checked={slipColumn} onChange={e => setSlipColumn(e.target.checked)} />"Slip given" column</label>
                        <label style={st.check}><input type="checkbox" checked={remarksColumn} onChange={e => setRemarksColumn(e.target.checked)} />"Remarks / promise" column</label>
                        {scopeKind !== 'class' && <label style={st.check}><input type="checkbox" checked={classPerPage} onChange={e => setClassPerPage(e.target.checked)} />Each class on its own page</label>}
                    </div>
                )}
            </div>

            {/* ── preview ── */}
            {loading ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : mode !== 'receipts' ? (data && (
                <div style={st.panel}>
                    <div style={st.cards}>
                        <div style={{ ...st.card, borderTopColor: '#1F3864' }}><b>{learners.length}</b><span>Learners in {scopeLabel}</span></div>
                        <div style={{ ...st.card, borderTopColor: '#b02a37' }}><b style={{ color: '#b02a37' }}>{counts.owing}</b><span>Owing</span></div>
                        <div style={{ ...st.card, borderTopColor: '#28a745' }}><b style={{ color: '#1e7e34' }}>{counts.cleared + counts.credit}</b><span>Cleared or in credit</span></div>
                        <div style={{ ...st.card, borderTopColor: '#fd7e14' }}><b>{kes(owedTotal)}</b><span>Owed by the {picked.length} to print</span></div>
                    </div>
                    <div style={st.actions}>
                        <span style={{ fontSize: '13px' }}><strong>{picked.length}</strong> {mode === 'slips' ? `slip${picked.length === 1 ? '' : 's'}` : `learner${picked.length === 1 ? '' : 's'}`} to print</span>
                        {mode === 'list' && <button onClick={downloadCsv} disabled={!picked.length} style={{ ...st.secondary, opacity: picked.length ? 1 : 0.5 }}><Icon name="file-earmark-spreadsheet" />Download for Excel</button>}
                        <button onClick={mode === 'slips' ? printSlips : printList} disabled={!picked.length} style={{ ...st.primary, opacity: picked.length ? 1 : 0.5 }}>
                            <Icon name="printer-fill" />{mode === 'slips' ? 'Print slips' : 'Print list'}
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                        <table style={st.table}>
                            <thead><tr>
                                <th style={st.th}>Learner</th><th style={st.th}>Class</th><th style={st.thNum}>B/F</th><th style={st.thNum}>This term</th>
                                <th style={st.thNum}>Paid</th><th style={st.thNum}>Balance</th><th style={st.th}></th>
                            </tr></thead>
                            <tbody>
                                {picked.map((l, i) => {
                                    const S = STATUS[statusOf(l.balance)];
                                    return (
                                        <tr key={l.studentId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                            <td style={st.td}><strong style={{ color: '#1F3864' }}>{l.name}</strong><div style={{ fontSize: '11px', color: '#888' }}>{l.admissionNumber}</div></td>
                                            <td style={st.td}>{l.classLabel}</td>
                                            <td style={st.tdNum}>{num(l.broughtForward) ? money(l.broughtForward) : '—'}</td>
                                            <td style={st.tdNum}>{money(l.thisTerm)}</td>
                                            <td style={st.tdNum}>{money(l.paidThisTerm)}</td>
                                            <td style={{ ...st.tdNum, fontWeight: 700, color: S.color }}>{num(l.balance) < 0 ? 'Cr ' : ''}{money(Math.abs(num(l.balance)))}</td>
                                            <td style={st.td}><span style={{ ...st.pill, color: S.color, backgroundColor: S.bg }}>{S.label}</span></td>
                                        </tr>
                                    );
                                })}
                                {!picked.length && <tr><td colSpan={7} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>{who === 'owing' ? 'No one owes anything here — well done!' : 'No learners.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: '12px', color: '#777', margin: '8px 0 0' }}>
                        B/F = unpaid from earlier terms. Payments clear the oldest charges first. "Download for Excel" gives a CSV file that opens in Excel.
                    </p>
                </div>
            )) : receipts && (
                <div style={st.panel}>
                    <div style={st.actions}>
                        <span style={{ fontSize: '13px' }}>
                            <strong>{receipts.payments.filter(p => !p.reversed).length}</strong> receipt(s) · {kes(receipts.total)}
                            {receipts.payments.some(p => p.reversed) && <> · {receipts.payments.filter(p => p.reversed).length} reversed</>}
                        </span>
                        {receipts.payments.some(p => p.reversed) && <button onClick={() => printReceipts(true)} style={st.secondary}><Icon name="printer" />Print including reversed</button>}
                        <button onClick={() => printReceipts(false)} disabled={!receipts.payments.some(p => !p.reversed)} style={{ ...st.primary, opacity: receipts.payments.some(p => !p.reversed) ? 1 : 0.5 }}><Icon name="printer-fill" />Print receipts (2 per page)</button>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                        <table style={st.table}>
                            <thead><tr><th style={st.th}>Receipt</th><th style={st.th}>Date</th><th style={st.th}>Learner</th><th style={st.th}>Paid by</th><th style={st.thNum}>Amount</th></tr></thead>
                            <tbody>
                                {receipts.payments.map((p, i) => (
                                    <tr key={p.paymentId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: p.reversed ? 0.55 : 1 }}>
                                        <td style={st.td}><strong>{p.receiptNumber}</strong>{p.reversed && <span style={{ ...st.pill, color: '#b02a37', backgroundColor: '#fdecee', marginLeft: '6px' }}>Reversed</span>}</td>
                                        <td style={st.td}>{fmtDate(p.paidOn)}</td>
                                        <td style={st.td}>{p.student?.name}</td>
                                        <td style={st.td}>{METHODS[p.method] || p.method} {p.reference}</td>
                                        <td style={st.tdNum}>{money(p.amount)}</td>
                                    </tr>
                                ))}
                                {!receipts.payments.length && <tr><td colSpan={5} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>No payments by learners in {scopeLabel} between these dates.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const st = {
    modes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' },
    mode: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '12px 14px', border: '2px solid #e3e7ee', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' },
    select: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', fontWeight: 'normal', color: '#222' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '9px 14px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '10px', backgroundColor: '#fafbfd', fontSize: '12px', color: '#555' },
    actions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: '10px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '640px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px', position: 'sticky', top: 0 },
    thNum: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'right', fontSize: '12px', position: 'sticky', top: 0 },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px' },
    tdNum: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' },
    pill: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
};
