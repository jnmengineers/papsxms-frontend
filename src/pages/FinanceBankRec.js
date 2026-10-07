import React, { useMemo, useState } from 'react';
import api from '../services/api';
import { parseStatement, reconcile, markCodes, STATUS, CONFIRMABLE } from '../utils/bankStatement';
import { letterheadHtml } from '../utils/school';

/**
 * Finance → Money In & Out → Bank Reconciliation.
 * Paste the bank statement (open the PDF with its password, Ctrl+A, Ctrl+C) — every line is
 * matched to recorded payments (by transaction code; codes shared by siblings are added up;
 * daily M-Pesa settlements against the day's M-Pesa total) and money out to expenses.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const shift = (d, days) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + days); return x.toISOString().slice(0, 10); };
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const ATTENTION = new Set(['AMOUNT_DIFF', 'NOT_FOUND', 'OUT_NOT_FOUND']);
const learner = (p) => (p.student ? `${p.student.firstName || ''} ${p.student.lastName || ''}`.trim() : p.payerName || '');

export default function BankReconciliationTab({ setError, blocked, flashSuccess }) {
    const [text, setText] = useState('');
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState('attention');

    const run = async () => {
        const lines = parseStatement(text);
        if (!lines.length) { setError('No statement lines found. Open the statement PDF, press Ctrl+A then Ctrl+C, and paste it here.'); return; }
        const from = lines.reduce((a, l) => (l.date < a ? l.date : a), lines[0].date);
        const to = lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date);
        setBusy(true); setError('');
        try {
            // A few days either side: payments are often recorded before or after the bank shows them
            // By date (for M-Pesa day totals and "not on the statement") AND by code — whatever date the
            // bursar typed: a payment recorded on a different day from the bank's is still found by its code.
            const codes = [...new Set(lines.flatMap(l => l.codes))];
            const [p, e, byCode] = await Promise.all([
                api.get('/api/finance/payments', { params: { from: shift(from, -7), to: shift(to, 3) } }),
                api.get('/api/finance/expenses', { params: { from: shift(from, -14), to: shift(to, 3) } }),
                api.post('/api/finance/reconcile/lookup', { codes })]);
            const merge = (a, b, id) => { const m = new Map(); [...a, ...b].forEach(x => { if (!m.has(x[id])) m.set(x[id], x); }); return [...m.values()]; };
            const payments = merge(p.data.payments || [], byCode.data.payments || [], 'paymentId');
            const expenses = merge((e.data.expenses || []).filter(x => !x.approvalStatus || x.approvalStatus === 'APPROVED'), byCode.data.expenses || [], 'expenseId');
            const r = reconcile(lines, payments, expenses);
            setResult({ ...r, from, to });
            setFilter(r.lines.some(l => ATTENTION.has(l.status)) ? 'attention' : 'all');
        } catch (err) { setError(serverMessage(err, 'Could not load the recorded payments.')); }
        setBusy(false);
    };

    const stats = useMemo(() => {
        if (!result) return null;
        const sum = (f) => result.lines.filter(f).reduce((a, l) => a + (l.moneyIn || l.moneyOut), 0);
        const cnt = (f) => result.lines.filter(f).length;
        const is = (...s) => (l) => s.includes(l.status);
        return [
            ['Money in (bank)', sum(l => l.moneyIn > 0), result.lines.filter(l => l.moneyIn > 0).length, '#1F3864'],
            ['Matched', sum(is('MATCHED', 'SPLIT', 'DAY_TOTAL')), cnt(is('MATCHED', 'SPLIT', 'DAY_TOTAL')), '#1e7e34'],
            ['Shared codes (siblings)', sum(is('SPLIT')), cnt(is('SPLIT')), '#0f766e'],
            ['Amounts differ', sum(is('AMOUNT_DIFF')), cnt(is('AMOUNT_DIFF')), '#b8860b'],
            ['Not recorded', sum(is('NOT_FOUND')), cnt(is('NOT_FOUND')), '#b02a37'],
            ['Money out (bank)', sum(l => l.moneyOut > 0), result.lines.filter(l => l.moneyOut > 0).length, '#343a40'],
            ['Expenses not recorded', sum(is('OUT_NOT_FOUND')), cnt(is('OUT_NOT_FOUND')), '#b02a37'],
            ['Recorded, not on statement', result.notOnStatement.reduce((a, p) => a + Number(p.amount), 0), result.notOnStatement.length, '#6f42c1'],
            ['Confirmed in the books', sum(l => l.confirmed), cnt(l => l.confirmed), '#1e7e34'],
        ];
    }, [result]);

    const shown = !result ? [] : result.lines.filter(l =>
        filter === 'all' ? true : filter === 'attention' ? ATTENTION.has(l.status) : filter === 'in' ? l.moneyIn > 0 : l.moneyOut > 0);

    // ── Save: mark the matched records as confirmed in the bank ──
    const toConfirm = result ? result.lines.filter(l => CONFIRMABLE.has(l.status) && !l.confirmed) : [];
    const idsOf = (l) => ({ paymentIds: l.matched.filter(m => m.paymentId).map(m => m.paymentId), expenseIds: l.matched.filter(m => m.expenseId && !m.paymentId).map(m => m.expenseId) });
    const confirm = async () => {
        if (!toConfirm.length) return;
        if (!window.confirm(`Mark ${toConfirm.length} matched statement line(s) as confirmed in the bank?\n\nTheir payments and expenses will show ✓ in the books. Lines that need attention are not included.`)) return;
        setBusy(true);
        try {
            const r = await api.post('/api/finance/bank-confirm', { lines: toConfirm.map(l => ({ bankDate: l.date, particulars: l.particulars, amount: l.moneyIn || l.moneyOut, ...idsOf(l) })) });
            flashSuccess?.(r.data.message);
            setBusy(false);
            await run();                                   // reload: the lines now show as confirmed
        } catch (err) { setError(serverMessage(err, 'Could not save the confirmation.')); setBusy(false); }
    };
    const undo = async (l) => {
        if (!window.confirm('Undo the bank confirmation for this line?')) return;
        try { const r = await api.post('/api/finance/bank-confirm/undo', idsOf(l)); flashSuccess?.(r.data.message); await run(); }
        catch (err) { setError(serverMessage(err, 'Could not undo.')); }
    };

    const matchedText = (l) => l.matched.map(m => m.receiptNumber ? `${m.receiptNumber} ${learner(m)} (${money(m.amount)})` : `${m.voucherNumber} (${money(m.amount)})`).join('; ');

    const print = () => {
        const rows = shown.map(l => `<tr><td>${esc(fmt(l.date))}</td><td>${markCodes(l.particulars, l.hitCodes).map(part => part.hit ? `<b style="background:#d4edda;color:#155724">${esc(part.text)}</b>` : esc(part.text)).join('')}${l.dateNote ? `<div class="note">${esc(l.dateNote)}</div>` : ''}</td><td class="n">${l.moneyIn ? money(l.moneyIn) : ''}</td><td class="n">${l.moneyOut ? money(l.moneyOut) : ''}</td>
            <td>${esc((STATUS[l.status] || [l.status])[0])}</td><td>${esc(matchedText(l))}${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}</td></tr>`).join('');
        const extra = result.notOnStatement.length ? `<h3>Recorded in the system but not on this statement (${result.notOnStatement.length})</h3><table><tr><th>Date</th><th>Receipt</th><th>Learner</th><th>Code</th><th>Method</th><th class="n">Amount</th></tr>
            ${result.notOnStatement.map(p => `<tr><td>${esc(fmt(p.paidOn))}</td><td>${esc(p.receiptNumber)}</td><td>${esc(learner(p))}</td><td>${esc(p.reference)}</td><td>${esc(p.method)}</td><td class="n">${money(p.amount)}</td></tr>`).join('')}</table>` : '';
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bank reconciliation</title><style>
            body{font-family:Arial,sans-serif;font-size:11px;margin:10px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #999;padding:3px 5px;vertical-align:top}
            th{background:#1F3864;color:#fff;text-align:left}.n{text-align:right;white-space:nowrap}.note{color:#8a6d00;font-size:10px}h2{text-align:center;color:#1F3864;margin:6px 0}h3{color:#1F3864;margin-top:14px}
            .bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold;cursor:pointer}
            @media print{.bar{display:none}@page{size:A4 landscape;margin:10mm}}</style></head><body>
            <div class="bar"><b>Bank reconciliation</b><button onclick="window.print()">Print / Save PDF</button></div>
            ${letterheadHtml({ logoSize: 44 })}<h2>BANK RECONCILIATION — ${esc(fmt(result.from))} to ${esc(fmt(result.to))}</h2>
            <p>${stats.map(([l, v, c]) => `<b>${esc(l)}:</b> ${money(v)} (${c})`).join(' &nbsp;·&nbsp; ')}</p>
            <table><tr><th>Date</th><th>Particulars</th><th class="n">In</th><th class="n">Out</th><th>Result</th><th>Recorded as</th></tr>${rows}</table>${extra}</body></html>`;
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        w.document.write(html); w.document.close(); w.focus();
    };
    const csv = () => {
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Date', 'Value date', 'Particulars', 'Money in', 'Money out', 'Balance', 'Result', 'Recorded as', 'Note'].map(q).join(','),
            ...result.lines.map(l => [l.date, l.valueDate, l.particulars, l.moneyIn || '', l.moneyOut || '', l.balance, (STATUS[l.status] || [l.status])[0], matchedText(l), l.note].map(q).join(','))];
        const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Bank reconciliation ${result.from} to ${result.to}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <div>
            <div style={st.panel}>
                <h3 style={st.h3}><Icon name="bank" />Bank reconciliation</h3>
                <p style={st.help}>Open the bank statement PDF (with its password), press <b>Ctrl + A</b>, then <b>Ctrl + C</b>, and paste it below. Rows copied from the bank's Excel statement work too.
                    Deposits are matched to fee payments by their transaction code — when one code was split between siblings, the payments are added up.</p>
                <textarea style={st.area} value={text} onChange={e => { setText(e.target.value); setResult(null); }} aria-label="Bank statement text"
                    placeholder={'07-07-2026  MERCY KAJUJU MUT-BY:EMMANUELA G1/6188140   2,000.00   4,489,434.69 Cr\n…'} />
                <div style={st.bar}>
                    <button onClick={run} disabled={busy || !text.trim()} style={{ ...st.primary, opacity: busy || !text.trim() ? 0.5 : 1 }}><Icon name={busy ? 'hourglass-split' : 'search'} />{busy ? 'Checking…' : 'Check statement'}</button>
                    {text && <button onClick={() => { setText(''); setResult(null); }} style={st.link}>Clear</button>}
                    {result && <><button onClick={print} style={st.secondary}><Icon name="printer-fill" />Print</button><button onClick={csv} style={st.secondary}><Icon name="file-earmark-spreadsheet" />Excel</button></>}
                    {result && <button onClick={confirm} disabled={busy || !toConfirm.length} style={{ ...st.primary, backgroundColor: '#1e7e34', opacity: busy || !toConfirm.length ? 0.5 : 1, marginLeft: 'auto' }}
                        title="Mark the matched payments and expenses as confirmed in the bank">
                        <Icon name="check2-all" />{toConfirm.length ? `Confirm ${toConfirm.length} matched line(s) in the books` : 'All matched lines confirmed'}</button>}
                </div>
            </div>

            {result && (
                <>
                    <div style={st.cards}>
                        {stats.map(([l, v, c, col]) => <div key={l} style={{ ...st.card, borderTopColor: col }}><b>{money(v)}</b><span>{l} · {c}</span></div>)}
                    </div>
                    <div style={st.panel}>
                        <div style={st.bar}>
                            <strong style={{ color: '#1F3864' }}>{result.lines.length} statement lines · {fmt(result.from)} – {fmt(result.to)}</strong>
                            <select style={{ ...st.input, marginLeft: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Show">
                                <option value="attention">Needs attention</option><option value="all">All lines</option><option value="in">Money in</option><option value="out">Money out</option>
                            </select>
                        </div>
                        <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                            <table style={st.table}>
                                <thead><tr>{['Date', 'Particulars', 'In', 'Out', 'Result', 'Recorded as'].map((h, i) => <th key={h} style={i === 2 || i === 3 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {shown.map((l, i) => { const [label, color] = STATUS[l.status] || [l.status, '#666']; return (
                                        <tr key={l.no} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                            <td style={st.td}>{fmt(l.date)}{l.valueDate && <div style={st.small}>value {fmt(l.valueDate)}</div>}</td>
                                            <td style={{ ...st.td, fontFamily: 'Consolas, monospace', fontSize: '12px' }}>
                                                {markCodes(l.particulars, l.hitCodes).map((part, k) => (part.hit
                                                    ? <mark key={k} style={{ ...st.code, ...(l.status === 'AMOUNT_DIFF' ? st.codeWarn : null) }} title="This code gave the match">{part.text}</mark>
                                                    : <span key={k}>{part.text}</span>))}
                                            </td>
                                            <td style={st.tdN}>{l.moneyIn ? money(l.moneyIn) : ''}</td>
                                            <td style={st.tdN}>{l.moneyOut ? money(l.moneyOut) : ''}</td>
                                            <td style={st.td}><span style={{ ...st.pill, backgroundColor: color }}>{label}</span>
                                                {l.confirmed && <div style={{ marginTop: '4px' }}><span style={{ ...st.pill, backgroundColor: 'white', color: '#1e7e34', border: '1.5px solid #1e7e34' }}>✓ Confirmed</span>
                                                    <button onClick={() => undo(l)} style={{ ...st.link, fontSize: '11px' }}>Undo</button></div>}</td>
                                            <td style={st.td}>{l.matched.map(m => (
                                                <div key={m.paymentId || `e${m.expenseId}`} style={{ fontSize: '12px' }}>{m.receiptNumber ? <><b>{m.receiptNumber}</b> {learner(m)} · {money(m.amount)}</> : <><b>{m.voucherNumber}</b> · {money(m.amount)}</>}
                                                    {m.reference && <span style={{ ...st.code, ...(l.status === 'AMOUNT_DIFF' ? st.codeWarn : null), marginLeft: '6px', fontSize: '11px' }}>{m.reference}</span>}
                                                    {m.bankConfirmedOn && <span style={{ color: '#1e7e34', marginLeft: '4px' }} title={m.bankLine || ''}>✓ {fmt(m.bankConfirmedOn)}</span>}</div>
                                            ))}{l.note && <div style={{ ...st.small, color: '#8a6d00' }}>{l.note}</div>}
                                                {l.dateNote && <div style={{ ...st.small, color: '#6c757d' }}><i className="bi bi-calendar2-event" aria-hidden="true" /> {l.dateNote}</div>}</td>
                                        </tr>); })}
                                    {!shown.length && <tr><td colSpan={6} style={{ ...st.td, textAlign: 'center', color: '#1e7e34', padding: '18px' }}><Icon name="check-circle-fill" />Nothing needs attention.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {result.notOnStatement.length > 0 && (
                        <div style={st.panel}>
                            <h4 style={{ ...st.h3, fontSize: '15px' }}><Icon name="question-circle-fill" />Recorded in the system but not on this statement ({result.notOnStatement.length})</h4>
                            <p style={st.help}>Bank and M-Pesa payments recorded for these dates that no statement line accounts for — check the code, or they may appear on the next statement.</p>
                            <table style={st.table}><thead><tr>{['Date', 'Receipt', 'Learner', 'Code', 'Method', 'Amount'].map((h, i) => <th key={h} style={i === 5 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                                <tbody>{result.notOnStatement.map(p => (
                                    <tr key={p.paymentId}><td style={st.td}>{fmt(p.paidOn)}</td><td style={st.td}>{p.receiptNumber}</td><td style={st.td}>{learner(p)}</td>
                                        <td style={{ ...st.td, fontFamily: 'Consolas, monospace' }}>{p.reference}</td><td style={st.td}>{p.method}</td><td style={st.tdN}>{money(p.amount)}</td></tr>))}</tbody></table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const st = {
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    h3: { color: '#1F3864', margin: '0 0 6px', fontSize: '17px' },
    help: { fontSize: '13px', color: '#555', margin: '0 0 10px', lineHeight: 1.5 },
    area: { width: '100%', minHeight: '160px', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'Consolas, monospace', fontSize: '12px', boxSizing: 'border-box', resize: 'vertical' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '8px 10px', backgroundColor: 'white', fontSize: '12px', color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600 },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '820px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    thN: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'right', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    tdN: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' },
    pill: { color: 'white', borderRadius: '10px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
    small: { fontSize: '11px', color: '#888' },
    code: { backgroundColor: '#d4edda', color: '#155724', fontWeight: 800, borderRadius: '4px', padding: '0 3px', border: '1px solid #9fd3ad' },
    codeWarn: { backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #f0c36d' },
};
