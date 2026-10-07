import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { hasRole } from '../utils/roles';
import { printChequeVouchers, printChequeRegister } from '../utils/chequePrint';
import { amountInWords } from '../utils/amountWords';
import { letterheadHtml } from '../utils/school';

/** Finance → Money In & Out → Cheques: every cheque the treasurer raised, the bills each paid, the register. */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const money = (v) => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };

export default function ChequesTab({ setError, flashSuccess, blocked }) {
    const now = new Date();
    const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [to, setTo] = useState(ymd(now));
    const [data, setData] = useState(null);
    const isTreasurer = hasRole('TREASURER');
    const load = useCallback(async () => {
        if (from > to) { setError('The start date must be before the end date.'); return; }
        try { const r = await api.get('/api/finance/cheques', { params: { from, to } }); setData(r.data); }
        catch (err) { setError(serverMessage(err, 'Could not load the cheques.')); }
    }, [from, to, setError]);
    useEffect(() => { load(); }, [load]);

    const cancel = async (c) => {
        const reason = window.prompt(`Cancel cheque ${c.chequeNumber} (${money(c.amount)} to ${c.payee})?\n\nIts ${c.bills.length} bill(s) go back to "to be paid". Why is it cancelled (spoilt, stopped…)?`);
        if (reason === null) return;
        if (reason.trim().length < 3) { setError('Say why the cheque is cancelled.'); return; }
        try { const r = await api.post(`/api/finance/cheques/${c.chequeId}/cancel`, { reason: reason.trim() }); flashSuccess(r.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Could not cancel the cheque.')); }
    };

    const cheques = data?.cheques || [];

    // ── The school's M-Pesa line: topped up by cheque, used to pay suppliers ──
    const [line, setLine] = useState(null);
    const [needed, setNeeded] = useState(0);          // approved bills still to pay
    const [topUp, setTopUp] = useState(null);         // { chequeNumber, chequeDate, amount, payee, memo }
    const [adjust, setAdjust] = useState(null);       // { date, amount, note }
    const loadLine = useCallback(async () => {
        try {
            const [f, p] = await Promise.all([api.get('/api/finance/float', { params: { from, to } }), api.get('/api/finance/expenses/to-pay')]);
            setLine(f.data); setNeeded(Number(p.data.total || 0));
        } catch (err) { setError(serverMessage(err, 'Could not load the M-Pesa line.')); }
    }, [from, to, setError]);
    useEffect(() => { loadLine(); }, [loadLine]);
    const short = Math.max(0, needed - Number(line?.balanceNow || 0));
    const saveTopUp = async () => {
        if (!topUp.chequeNumber.trim()) { setError('Enter the cheque number.'); return; }
        if (!/^\d{1,9}(\.\d{1,2})?$/.test(String(topUp.amount).trim()) || !Number(topUp.amount)) { setError('Enter the amount of the cheque.'); return; }
        try {
            const r = await api.post('/api/finance/cheques/float', { chequeNumber: topUp.chequeNumber.trim(), chequeDate: topUp.chequeDate, amount: String(topUp.amount).trim(), payee: topUp.payee.trim() || null, memo: topUp.memo.trim() || null });
            flashSuccess(r.data.message); setTopUp(null); await Promise.all([load(), loadLine()]);
        } catch (err) { setError(serverMessage(err, 'Could not raise the cheque.')); }
    };
    const saveAdjust = async () => {
        if (!/^-?\d{1,9}(\.\d{1,2})?$/.test(String(adjust.amount).trim()) || !Number(adjust.amount)) { setError('Enter the amount (negative to take money off).'); return; }
        try {
            const r = await api.post('/api/finance/float/adjust', { date: adjust.date, amount: String(adjust.amount).trim(), note: adjust.note.trim() });
            flashSuccess(r.data.message); setAdjust(null); await loadLine();
        } catch (err) { setError(serverMessage(err, 'Could not save the adjustment.')); }
    };
    const printLine = () => {
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const rows = (line.rows || []).map(r => `<tr><td>${esc(fmt(r.date))}</td><td>${esc(r.detail)}</td><td>${esc(r.reference || '')}</td>
            <td class="n">${Number(r.amount) > 0 ? money(r.amount) : ''}</td><td class="n">${Number(r.amount) < 0 ? money(-r.amount) : ''}</td><td class="n">${money(r.balance)}</td></tr>`).join('');
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>M-Pesa line</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:12px}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:3px 5px}th{background:#1F3864;color:#fff;text-align:left}.n{text-align:right}
            h2{text-align:center;color:#1F3864}.bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold}
            @media print{.bar{display:none}}</style></head><body><div class="bar"><b>M-Pesa line</b><button onclick="window.print()">Print / Save PDF</button></div>
            ${letterheadHtml({ logoSize: 44 })}<h2>M-PESA LINE — ${esc(fmt(from))} to ${esc(fmt(to))}</h2>
            <table><tr><th>Date</th><th>Details</th><th>Code / cheque</th><th class="n">In</th><th class="n">Out</th><th class="n">Balance</th></tr>
            <tr><td colspan="5"><b>Opening balance</b></td><td class="n"><b>${money(line.opening)}</b></td></tr>${rows}
            <tr><td colspan="3"><b>Totals / closing balance</b></td><td class="n"><b>${money(line.moneyIn)}</b></td><td class="n"><b>${money(line.moneyOut)}</b></td><td class="n"><b>${money(line.closing)}</b></td></tr></table>
            <p style="margin-top:24px">Prepared by: ______________ &nbsp; Checked by (Treasurer): ______________</p></body></html>`);
        w.document.close(); w.focus();
    };

    return (
        <div>
        <div style={st.panel}>
            <div style={st.bar}>
                <h3 style={{ ...st.h3, flex: 1 }}><Icon name="phone-fill" />School M-Pesa line</h3>
                {line && <button type="button" onClick={printLine} style={st.secondary}><Icon name="printer" />Statement</button>}
                {isTreasurer && <button type="button" onClick={() => setAdjust({ date: ymd(new Date()), amount: '', note: line && !(line.rows || []).length && !Number(line.balanceNow) ? 'Opening balance' : '' })} style={st.secondary}><Icon name="sliders" />Opening balance / correction</button>}
                {isTreasurer && <button type="button" onClick={() => setTopUp({ chequeNumber: '', chequeDate: ymd(new Date()), amount: short ? String(short) : '', payee: '', memo: short ? 'Top-up for approved bills' : '' })} style={st.primary}><Icon name="plus-circle-fill" />Top up by cheque</button>}
            </div>
            {line && (
                <>
                    <div style={st.cards}>
                        <div style={{ ...st.card, borderTopColor: '#1e7e34' }}><b>{money(line.balanceNow)}</b><span>On the line now</span></div>
                        <div style={{ ...st.card, borderTopColor: '#2E75B6' }}><b>{money(needed)}</b><span>Approved bills to pay</span></div>
                        <div style={{ ...st.card, borderTopColor: short ? '#b02a37' : '#1e7e34' }}><b>{money(short)}</b><span>{short ? 'Top-up needed' : 'No top-up needed'}</span></div>
                        <div style={{ ...st.card, borderTopColor: '#6c757d' }}><b>{money(line.moneyIn)} / {money(line.moneyOut)}</b><span>In / out, {fmt(from)} – {fmt(to)}</span></div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={st.table}>
                            <thead><tr>{['Date', 'Details', 'Code / cheque', 'In', 'Out', 'Balance'].map((h, i) => <th key={h} style={i >= 3 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                <tr><td style={st.td} colSpan={5}><b>Opening balance</b></td><td style={{ ...st.tdN, fontWeight: 700 }}>{money(line.opening)}</td></tr>
                                {(line.rows || []).map((r, i) => (
                                    <tr key={i} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                        <td style={st.td}>{fmt(r.date)}</td><td style={st.td}>{r.detail}{r.by && <div style={st.small}>{r.by}</div>}</td>
                                        <td style={{ ...st.td, fontFamily: 'Consolas, monospace' }}>{r.reference}</td>
                                        <td style={{ ...st.tdN, color: '#1e7e34' }}>{Number(r.amount) > 0 ? money(r.amount) : ''}</td>
                                        <td style={{ ...st.tdN, color: '#b02a37' }}>{Number(r.amount) < 0 ? money(-r.amount) : ''}</td>
                                        <td style={{ ...st.tdN, fontWeight: 700 }}>{money(r.balance)}</td>
                                    </tr>
                                ))}
                                <tr><td style={st.td} colSpan={5}><b>Closing balance</b></td><td style={{ ...st.tdN, fontWeight: 800 }}>{money(line.closing)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>

        {topUp && (
            <Dialog title="Top up the M-Pesa line by cheque" onClose={() => setTopUp(null)}>
                <p style={st.small}>A cheque to withdraw cash from the bank for the school's M-Pesa line. It moves money between the school's own accounts, so it is <b>not an expense</b> — the bills paid from the line are.</p>
                <div style={st.formGrid}>
                    <label style={st.lbl}>Cheque number<input style={{ ...st.input, fontWeight: 700 }} maxLength={30} value={topUp.chequeNumber} onChange={e => setTopUp(t => ({ ...t, chequeNumber: e.target.value }))} /></label>
                    <label style={st.lbl}>Date on the cheque<input type="date" style={st.input} value={topUp.chequeDate} onChange={e => setTopUp(t => ({ ...t, chequeDate: e.target.value }))} /></label>
                    <label style={st.lbl}>Amount<input style={{ ...st.input, fontWeight: 700 }} inputMode="decimal" value={topUp.amount} onChange={e => setTopUp(t => ({ ...t, amount: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
                    <label style={st.lbl}>Pay (name on the cheque)<input style={st.input} maxLength={100} value={topUp.payee} placeholder="CASH — M-PESA FLOAT" onChange={e => setTopUp(t => ({ ...t, payee: e.target.value }))} /></label>
                    <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Memo (optional)<input style={st.input} maxLength={200} value={topUp.memo} onChange={e => setTopUp(t => ({ ...t, memo: e.target.value }))} /></label>
                </div>
                {Number(topUp.amount) > 0 && <p style={{ ...st.small, marginTop: '8px' }}>{amountInWords(topUp.amount)}.</p>}
                <div style={st.dialogBar}><button type="button" onClick={() => setTopUp(null)} style={st.secondary}>Cancel</button><button type="button" onClick={saveTopUp} style={st.primary}><Icon name="save-fill" />Save cheque</button></div>
            </Dialog>
        )}
        {adjust && (
            <Dialog title="Opening balance / correction" onClose={() => setAdjust(null)}>
                <p style={st.small}>Use once for the money already on the M-Pesa line when you start, or to correct the balance to match the M-Pesa statement. A negative amount takes money off.</p>
                <div style={st.formGrid}>
                    <label style={st.lbl}>Date<input type="date" style={st.input} value={adjust.date} onChange={e => setAdjust(a => ({ ...a, date: e.target.value }))} /></label>
                    <label style={st.lbl}>Amount (− to take off)<input style={{ ...st.input, fontWeight: 700 }} inputMode="decimal" value={adjust.amount} onChange={e => setAdjust(a => ({ ...a, amount: e.target.value.replace(/[^\d.-]/g, '') }))} /></label>
                    <label style={{ ...st.lbl, gridColumn: 'span 2' }}>What is it?<input style={st.input} maxLength={200} value={adjust.note} placeholder="Opening balance / M-Pesa statement correction" onChange={e => setAdjust(a => ({ ...a, note: e.target.value }))} /></label>
                </div>
                <div style={st.dialogBar}><button type="button" onClick={() => setAdjust(null)} style={st.secondary}>Cancel</button><button type="button" onClick={saveAdjust} style={st.primary}><Icon name="save-fill" />Save</button></div>
            </Dialog>
        )}

        <div style={st.panel}>
            <div style={st.bar}>
                <h3 style={{ ...st.h3, flex: 1 }}><Icon name="journal-text" />Cheques</h3>
                <input type="date" style={st.input} value={from} max={to} onChange={e => setFrom(e.target.value)} aria-label="From" />
                <input type="date" style={st.input} value={to} min={from} onChange={e => setTo(e.target.value)} aria-label="To" />
                <button type="button" disabled={!cheques.length} onClick={() => printChequeRegister(cheques, from, to, blocked)} style={st.secondary}><Icon name="printer" />Cheque register</button>
            </div>
            {data && <p style={st.muted}>{cheques.filter(c => !c.cancelled).length} cheque(s) · {money(data.total)}{cheques.some(c => c.cancelled) ? ` · ${cheques.filter(c => c.cancelled).length} cancelled (not counted)` : ''}</p>}
            <div style={{ overflowX: 'auto' }}>
                <table style={st.table}>
                    <thead><tr>{['Date', 'Cheque No', 'Payee', 'Bills paid', 'Amount', ''].map((h, i) => <th key={h + i} style={i === 4 ? st.thN : st.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {cheques.map((c, i) => (
                            <tr key={c.chequeId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: c.cancelled ? 0.55 : 1 }}>
                                <td style={st.td}>{fmt(c.chequeDate)}</td>
                                <td style={{ ...st.td, fontWeight: 700 }}>{c.chequeNumber}</td>
                                <td style={st.td}>{c.payee}{c.purpose === 'FLOAT' && <div style={{ ...st.small, color: '#1e7e34', fontWeight: 700 }}>M-Pesa line top-up</div>}{c.memo && <div style={st.small}>{c.memo}</div>}</td>
                                <td style={st.td}>{c.bills.map(b => <div key={b.expenseId} style={{ fontSize: '12px' }}>{b.voucherNumber} — {b.description} ({money(b.amount)})</div>)}
                                    {c.cancelled && <div style={{ ...st.small, color: '#b02a37', fontWeight: 700 }}>Cancelled by {c.cancelledBy}: {c.cancelReason}</div>}
                                    <div style={st.small}>raised by {c.raisedBy}</div></td>
                                <td style={{ ...st.tdN, fontWeight: 700, textDecoration: c.cancelled ? 'line-through' : 'none' }}>{money(c.amount)}</td>
                                <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                    <button type="button" onClick={() => printChequeVouchers([c], blocked)} style={st.link} title="Print voucher"><Icon name="printer" />Voucher</button>
                                    {isTreasurer && !c.cancelled && <button type="button" onClick={() => cancel(c)} style={{ ...st.link, color: '#b02a37' }}><Icon name="x-circle" />Cancel</button>}
                                </td>
                            </tr>
                        ))}
                        {data && !cheques.length && <tr><td colSpan={6} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '18px' }}>No cheques in these dates.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
        </div>
    );
}

function Dialog({ title, onClose, children }) {
    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' }}
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label={title} style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '18px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
                <h3 style={{ color: '#1F3864', margin: '0 0 6px' }}>{title}</h3>
                {children}
            </div>
        </div>
    );
}

const st = {
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', margin: '10px 0' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '8px 10px', backgroundColor: '#fafbfd', fontSize: '12px', color: '#555' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    dialogBar: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    h3: { color: '#1F3864', margin: 0, fontSize: '17px' },
    input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    muted: { fontSize: '13px', color: '#666', margin: '8px 0' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    thN: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'right', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    tdN: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' },
    small: { fontSize: '11px', color: '#888' },
};
