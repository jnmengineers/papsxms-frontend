import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { letterheadHtml } from '../utils/school';
import { textOn } from '../utils/schoolData';
import { hasRole } from '../utils/roles';
import { printChequeVouchers, printBillsList } from '../utils/chequePrint';
import { amountInWords } from '../utils/amountWords';

/**
 * Finance → Expenses: record daily spending in a money group, print a payment voucher,
 * list by day / week / month / term, void mistakes (never deleted), print or download for Excel.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(v || 0);
const money = (v) => num(v).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const kes = (v) => `KES ${money(v)}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (d) => { if (!d) return ''; const x = new Date(`${String(d).slice(0, 10)}T00:00:00`); return isNaN(x) ? String(d) : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const METHODS = [{ key: 'CASH', label: 'Cash', ref: 'Receipt no. (optional)' }, { key: 'MPESA', label: 'M-Pesa', ref: 'M-Pesa code' }, { key: 'BANK', label: 'Bank', ref: 'Bank reference' }, { key: 'CHEQUE', label: 'Cheque', ref: 'Cheque number' }];
const methodOf = (k) => METHODS.find(m => m.key === k) || { label: k, ref: 'Reference' };
const isAmount = (s) => /^\d{1,9}(\.\d{1,2})?$/.test(String(s).trim()) && Number(s) > 0;

const openWindow = (title, body, onBlocked) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#000;padding:14px;max-width:780px;margin:0 auto}
        .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
        .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
        h2{text-align:center;color:#1F3864;font-size:15px;margin:8px 0 10px;border-bottom:2px solid #1F3864;padding-bottom:5px;letter-spacing:.5px}
        table{width:100%;border-collapse:collapse}th{background:#1F3864;color:#fff;padding:5px 6px;text-align:left;font-size:11px}
        td{border:1px solid #bbb;padding:4px 6px;font-size:11px}.num{text-align:right;white-space:nowrap}
        .kv td{border:none;border-bottom:1px solid #eee;padding:6px}.kv td:first-child{color:#555;width:32%}
        .tot td{font-weight:bold;background:#eef3fb}.void{color:#b02a37;text-decoration:line-through}
        .sig{display:flex;justify-content:space-between;margin-top:40px;font-size:11px;gap:10px}
        @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:12mm}}
    </style></head><body><div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()">Print / Save PDF</button></div>
    ${letterheadHtml({ logoSize: 50 })}${body}
    <p style="text-align:center;color:#888;font-size:10px;margin-top:14px">Printed ${esc(new Date().toLocaleString('en-GB'))}</p></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { onBlocked?.(); return; }
    w.document.write(html); w.document.close(); w.focus();
};

const voucherHtml = (e) => `<h2>PAYMENT VOUCHER${e.voided ? ' — VOIDED' : ''}</h2>
    <table class="kv">
        <tr><td>Voucher number</td><td><b>${esc(e.voucherNumber)}</b></td></tr>
        <tr><td>Date</td><td>${esc(fmtDate(e.spentOn))} (${esc(e.yearLabel)} Term ${esc(e.term)})</td></tr>
        <tr><td>Paid to</td><td>${esc(e.payee || '—')}</td></tr>
        <tr><td>For</td><td>${esc(e.description)}</td></tr>
        <tr><td>Money group</td><td>${esc(e.groupName)}</td></tr>
        <tr><td>Amount</td><td style="font-size:18px;font-weight:800">${esc(kes(e.amount))}</td></tr>
        <tr><td>Paid by</td><td>${esc(methodOf(e.method).label)}${e.reference ? ` — ${esc(e.reference)}` : ''}</td></tr>
        <tr><td>Prepared by</td><td>${esc(e.recordedBy || '')}</td></tr>
        <tr><td>Approved by</td><td>${e.approvalStatus === 'PENDING' ? '<b style="color:#b8860b">AWAITING TREASURER</b>' : e.approvalStatus === 'REJECTED' ? `<b style="color:#b02a37">REJECTED</b> — ${esc(e.rejectReason || '')} (${esc(e.approvedBy || '')})` : esc(e.approvedBy || '')}</td></tr>
        ${e.voided ? `<tr><td>Voided</td><td style="color:#b02a37">${esc(e.voidReason)} (${esc(e.voidedBy || '')})</td></tr>` : ''}
    </table>
    <div class="sig"><span>Prepared by: ______________</span><span>Approved by: ______________</span><span>Received by: ______________</span></div>`;

export default function ExpensesTab({ termOptions, defaultTerm, setError, flashSuccess, blocked }) {
    const today = iso(new Date());
    const [groups, setGroups] = useState([]);
    const emptyForm = useCallback(() => ({ spentOn: today, termKey: defaultTerm, groupId: '', description: '', payee: '', amount: '', method: 'CASH', reference: '' }), [today, defaultTerm]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [period, setPeriod] = useState('today');   // today | week | month | term | custom
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);
    const [termKey, setTermKey] = useState(defaultTerm);
    const [groupFilter, setGroupFilter] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/api/finance/groups').then(r => setGroups(r.data.groups || [])).catch(err => setError(serverMessage(err, 'Failed to load money groups.')));
    }, [setError]);
    useEffect(() => { if (defaultTerm) { setForm(f => (f.termKey ? f : { ...f, termKey: defaultTerm })); setTermKey(t => t || defaultTerm); } }, [defaultTerm]);

    // The dates for the chosen period
    useEffect(() => {
        const d = new Date();
        if (period === 'today') { setFrom(today); setTo(today); }
        if (period === 'week') { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setFrom(iso(m)); setTo(today); }
        if (period === 'month') { setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(today); }
    }, [period, today]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = period === 'term' ? { yearLabel: termKey.split('|')[0], term: termKey.split('|')[1] } : { from, to };
            if (period === 'term' && !termKey) { setLoading(false); return; }
            if (period !== 'term' && from > to) { setError('The start date must be before the end date.'); setLoading(false); return; }
            const r = await api.get('/api/finance/expenses', { params });
            setData(r.data);
        } catch (err) { setError(serverMessage(err, 'Failed to load expenses.')); }
        setLoading(false);
    }, [period, from, to, termKey, setError]);
    useEffect(() => { load(); }, [load]);

    // ── Treasurer approval of the bursar's bills ──
    const isTreasurer = hasRole('TREASURER');
    const [pending, setPending] = useState(null);
    const loadPending = useCallback(() => api.get('/api/finance/expenses/pending').then(r => setPending(r.data)).catch(() => setPending(null)), []);
    useEffect(() => { loadPending(); }, [loadPending]);
    const asBill = !!pending?.approvalOn && !isTreasurer;    // the bursar's bills go to the treasurer
    const [ticked, setTicked] = useState(new Set());         // bills awaiting approval, ticked by the treasurer
    const [payTicked, setPayTicked] = useState(new Set());   // approved bills ticked for a cheque
    const [toPay, setToPay] = useState(null);
    const [cheque, setCheque] = useState(null);              // { payee, chequeNumber, chequeDate, memo }
    const loadToPay = useCallback(() => api.get('/api/finance/expenses/to-pay').then(r => setToPay(r.data)).catch(() => setToPay(null)), []);
    useEffect(() => { loadToPay(); }, [loadToPay]);
    const refreshAll = () => Promise.all([load(), loadPending(), loadToPay()]);
    const toggle = (set, setter, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };
    const approveTicked = async () => {
        const ids = [...ticked];
        const total = (pending?.expenses || []).filter(x => ticked.has(x.expenseId)).reduce((a, x) => a + num(x.amount), 0);
        if (!window.confirm(`Approve ${ids.length} bill(s) for ${kes(total)}?`)) return;
        try { const r = await api.post('/api/finance/expenses/approve', { ids }); flashSuccess(r.data.message); setTicked(new Set()); await refreshAll(); }
        catch (err) { setError(serverMessage(err, 'Could not approve.')); }
    };
    const startCheque = () => {
        const bills = (toPay?.expenses || []).filter(x => payTicked.has(x.expenseId));
        const payees = [...new Set(bills.map(b => (b.payee || '').trim()).filter(Boolean))];
        setCheque({ payee: payees.length === 1 ? payees[0] : '', chequeNumber: '', chequeDate: new Date().toISOString().slice(0, 10), memo: '', manyPayees: payees.length > 1, total: bills.reduce((a, b) => a + num(b.amount), 0) });
    };
    // ── Paying approved bills from the school's M-Pesa line ──
    const [lineBalance, setLineBalance] = useState(null);
    const [mpesa, setMpesa] = useState(null);   // { code, paidOn, charge, total }
    const loadLine = useCallback(() => { const d = new Date().toISOString().slice(0, 10); return api.get('/api/finance/float', { params: { from: d, to: d } }).then(r => setLineBalance(num(r.data.balanceNow))).catch(() => setLineBalance(null)); }, []);
    useEffect(() => { loadLine(); }, [loadLine]);
    const startMpesa = () => {
        const bills = (toPay?.expenses || []).filter(x => payTicked.has(x.expenseId));
        const payees = [...new Set(bills.map(b => (b.payee || '').trim()).filter(Boolean))];
        setMpesa({ code: '', paidOn: new Date().toISOString().slice(0, 10), charge: '', total: bills.reduce((a, b) => a + num(b.amount), 0), payees });
    };
    const payMpesa = async () => {
        const code = mpesa.code.trim().toUpperCase();
        if (!/^[A-Z0-9]{6,20}$/.test(code)) { setError('Enter the M-Pesa code from the confirmation message (e.g. SGH71K2XYZ).'); return; }
        if (mpesa.charge && !/^\d{1,6}(\.\d{1,2})?$/.test(mpesa.charge)) { setError('Check the M-Pesa charge (numbers only).'); return; }
        try {
            const r = await api.post('/api/finance/expenses/pay-mpesa', { expenseIds: [...payTicked], mpesaCode: code, paidOn: mpesa.paidOn, charge: mpesa.charge || null });
            flashSuccess(r.data.message); setMpesa(null); setPayTicked(new Set()); await Promise.all([refreshAll(), loadLine()]);
        } catch (err) { setError(serverMessage(err, 'Could not record the M-Pesa payment.')); }
    };

    const raiseCheque = async () => {
        if (!cheque.chequeNumber.trim()) { setError('Enter the cheque number.'); return; }
        if (!cheque.payee.trim()) { setError('Enter the payee.'); return; }
        try {
            const r = await api.post('/api/finance/cheques', { chequeNumber: cheque.chequeNumber.trim(), chequeDate: cheque.chequeDate, payee: cheque.payee.trim(), memo: cheque.memo, expenseIds: [...payTicked] });
            flashSuccess(r.data.message); setCheque(null); setPayTicked(new Set()); await refreshAll();
            if (window.confirm(`Cheque ${r.data.chequeNumber} saved.\n\nPrint the cheque payment voucher now?`)) printChequeVouchers([r.data], blocked);
        } catch (err) { setError(serverMessage(err, 'Could not raise the cheque.')); }
    };
    const decide = async (x, what) => {
        let body = {};
        if (what === 'reject') {
            const reason = window.prompt(`Reject ${x.voucherNumber} (${kes(x.amount)} — ${x.description})?\n\nSay why, so the bursar can put it right:`);
            if (reason === null) return;
            if (reason.trim().length < 3) { setError('Say why the bill is rejected.'); return; }
            body = { reason: reason.trim() };
        } else if (!window.confirm(`Approve ${x.voucherNumber}: ${kes(x.amount)} for ${x.description}?`)) return;
        try { const r = await api.post(`/api/finance/expenses/${x.expenseId}/${what}`, body); flashSuccess(r.data.message); await refreshAll(); }
        catch (err) { setError(serverMessage(err, `Could not ${what} the bill.`)); }
    };

    const activeGroups = groups.filter(g => g.active);
    const method = methodOf(form.method);

    const save = async (e) => {
        e.preventDefault();
        if (!form.groupId) { setError('Choose the money group (e.g. Meals).'); return; }
        if (form.description.trim().length < 3) { setError('Say what the money was spent on.'); return; }
        if (!isAmount(form.amount)) { setError('Enter a valid amount, e.g. 4500.'); return; }
        if (asBill && !form.payee.trim()) { setError('Enter the payee — who the cheque will be made out to.'); return; }
        if (!asBill && form.method !== 'CASH' && !form.reference.trim()) { setError(`Enter the ${method.ref.toLowerCase()}.`); return; }
        if (!form.termKey) { setError('Choose the term.'); return; }
        setSaving(true); setError('');
        try {
            const [y, t] = form.termKey.split('|');
            const r = await api.post('/api/finance/expenses', {
                spentOn: form.spentOn, yearLabel: y, term: Number(t), groupId: Number(form.groupId), description: form.description.trim(),
                payee: form.payee.trim() || null, amount: String(form.amount).trim(), method: form.method, reference: form.reference.trim() || null,
            });
            flashSuccess(r.data.message);
            loadPending();
            const saved = r.data;
            // keep date, term, group and method for the next entry (bursars often enter several in a row)
            setForm(f => ({ ...emptyForm(), spentOn: f.spentOn, termKey: f.termKey, groupId: f.groupId, method: f.method }));
            await load();
            if (window.confirm(`${saved.voucherNumber} saved.\n\nPrint the payment voucher now?`)) openWindow(`Payment voucher ${saved.voucherNumber}`, voucherHtml(saved), blocked);
        } catch (err) { setError(serverMessage(err, 'Failed to record the expense.')); }
        setSaving(false);
    };

    const voidIt = async (x) => {
        const reason = window.prompt(`Void ${x.voucherNumber} (${kes(x.amount)} — ${x.description})?\n\nIt stays on record but stops counting. Why is it being voided?`);
        if (reason === null) return;
        if (reason.trim().length < 3) { setError('Say why it is being voided (at least 3 letters).'); return; }
        try { const r = await api.post(`/api/finance/expenses/${x.expenseId}/void`, { reason: reason.trim() }); flashSuccess(r.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Failed to void.')); }
    };

    const rows = (data?.expenses || []).filter(x => !groupFilter || String(x.groupId) === String(groupFilter));
    const counts = (x) => !x.voided && (!x.approvalStatus || x.approvalStatus === 'APPROVED') && x.paid !== false;   // same rule as the books
    const shownTotal = rows.filter(counts).reduce((s, x) => s + num(x.amount), 0);
    const periodLabel = period === 'term' ? (termOptions.find(t => t.value === termKey)?.label || '').replace(' (current)', '')
        : from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
    const groupName = groupFilter ? groups.find(g => String(g.groupId) === String(groupFilter))?.name : '';

    const printList = () => {
        if (!rows.length) { setError('Nothing to print.'); return; }
        const byGroup = {};
        rows.filter(counts).forEach(x => { byGroup[x.groupName] = (byGroup[x.groupName] || 0) + num(x.amount); });
        const body = `<h2>EXPENSES — ${esc(periodLabel)}${groupName ? ` — ${esc(groupName)}` : ''}</h2>
            <table><thead><tr><th>Voucher</th><th>Date</th><th>Group</th><th>For</th><th>Paid to</th><th>Paid by</th><th class="num">Amount</th></tr></thead><tbody>
            ${rows.map(x => `<tr class="${x.voided ? 'void' : ''}"><td>${esc(x.voucherNumber)}</td><td>${esc(fmtDate(x.spentOn))}</td><td>${esc(x.groupName)}</td>
                <td>${esc(x.description)}${x.voided ? ` (VOIDED: ${esc(x.voidReason)})` : ''}</td><td>${esc(x.payee || '')}</td>
                <td>${esc(methodOf(x.method).label)} ${esc(x.reference || '')}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}
            <tr class="tot"><td colspan="6">Total paid (voided, rejected, awaiting approval or cheque left out)</td><td class="num">${money(shownTotal)}</td></tr></tbody></table>
            <h2 style="margin-top:16px">BY GROUP</h2><table><tbody>${Object.entries(byGroup).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`).join('')}</tbody></table>
            <div class="sig"><span>Bursar: ______________</span><span>Head teacher: ______________</span><span>Date: ______________</span></div>`;
        openWindow(`Expenses ${periodLabel}`, body, blocked);
    };

    const downloadCsv = () => {
        if (!rows.length) { setError('Nothing to download.'); return; }
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const head = ['Voucher', 'Date', 'Year', 'Term', 'Group', 'For', 'Paid to', 'Paid by', 'Reference', 'Amount', 'Voided', 'Void reason', 'Recorded by'];
        const lines = rows.map(x => [x.voucherNumber, x.spentOn, x.yearLabel, x.term, x.groupName, x.description, x.payee, methodOf(x.method).label, x.reference, num(x.amount), x.voided ? 'Yes' : '', x.voidReason, x.recordedBy].map(q).join(','));
        const blob = new Blob(['\uFEFF' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Expenses ${periodLabel}${groupName ? ' ' + groupName : ''}.csv`.replace(/[\\/:*?"<>|]/g, '-');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    if (!groups.length) return <div style={st.panel}><p style={{ margin: 0 }}>No money groups yet. Set them up on <strong>Setup → Money groups</strong> first.</p></div>;

    return (
        <div>
            {/* ── record ── */}
            <form onSubmit={save} style={st.panel}>
                <h3 style={st.h3}><Icon name="plus-circle-fill" />Record an expense</h3>
                <div style={st.grid}>
                    <label style={st.lbl}>Date<input type="date" style={st.input} value={form.spentOn} max={today} onChange={e => setForm({ ...form, spentOn: e.target.value })} /></label>
                    <label style={st.lbl}>Term
                        <select style={st.input} value={form.termKey} onChange={e => setForm({ ...form, termKey: e.target.value })}>
                            {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </label>
                    <label style={st.lbl}>Money group
                        <select style={st.input} value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}>
                            <option value="">— choose —</option>
                            {activeGroups.map(g => <option key={g.groupId} value={String(g.groupId)}>{g.name}</option>)}
                        </select>
                    </label>
                    <label style={{ ...st.lbl, gridColumn: 'span 2' }}>What for<input style={st.input} maxLength={200} value={form.description} placeholder="e.g. Maize flour, 5 bags" onChange={e => setForm({ ...form, description: e.target.value })} /></label>
                    <label style={st.lbl}>{asBill ? 'Payee (name on the cheque)' : 'Paid to'}<input style={st.input} maxLength={100} value={form.payee} placeholder="Supplier or person" onChange={e => setForm({ ...form, payee: asBill ? e.target.value.toUpperCase() : e.target.value })} /></label>
                    <label style={st.lbl}>Amount (KES)<input style={{ ...st.input, fontWeight: 700 }} inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                    {asBill ? (
                        <p style={{ ...st.small, gridColumn: 'span 2', alignSelf: 'end', color: '#8a6d00', margin: 0 }}><Icon name="safe2" />Goes on the treasurer's list. Once approved, the treasurer pays it by cheque — it counts in the books from the cheque date.</p>
                    ) : (<>
                    <label style={st.lbl}>Paid by
                        <select style={st.input} value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                            {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                    </label>
                    <label style={st.lbl}>{method.ref}<input style={st.input} maxLength={60} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value.toUpperCase() })} /></label>
                    </>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={saving} style={{ ...st.primary, opacity: saving ? 0.6 : 1 }}><Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : asBill ? "Add to the treasurer's list" : 'Save expense'}</button>
                </div>
            </form>

            {/* ── list ── */}
            <div style={st.panel}>
                <div style={st.bar}>
                    <div style={st.pills} role="tablist">
                        {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['term', 'Term'], ['custom', 'Dates']].map(([k, l]) => (
                            <button key={k} type="button" onClick={() => setPeriod(k)} style={{ ...st.pill, backgroundColor: period === k ? '#1F3864' : 'white', color: period === k ? 'white' : '#1F3864' }}>{l}</button>
                        ))}
                    </div>
                    {period === 'term' && <select style={st.input} value={termKey} onChange={e => setTermKey(e.target.value)}>{termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}
                    {period === 'custom' && <>
                        <input type="date" style={st.input} value={from} max={to} onChange={e => setFrom(e.target.value)} aria-label="From" />
                        <input type="date" style={st.input} value={to} min={from} onChange={e => setTo(e.target.value)} aria-label="To" />
                    </>}
                    <select style={st.input} value={groupFilter} onChange={e => setGroupFilter(e.target.value)} aria-label="Group">
                        <option value="">All groups</option>
                        {groups.map(g => <option key={g.groupId} value={String(g.groupId)}>{g.name}</option>)}
                    </select>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={downloadCsv} style={st.secondary}><Icon name="file-earmark-spreadsheet" />Excel</button>
                        <button type="button" onClick={printList} style={st.secondary}><Icon name="printer" />Print</button>
                    </span>
                </div>

                {data && (
                    <div style={st.cards}>
                        <div style={{ ...st.card, borderTopColor: '#b02a37' }}><b>{kes(shownTotal)}</b><span>Spent{groupName ? ` on ${groupName}` : ''} — {periodLabel}</span></div>
                        {!groupFilter && (data.byGroup || []).map(g => (
                            <div key={g.groupId} style={{ ...st.card, borderTopColor: g.color }}><b>{kes(g.total)}</b><span>{g.name}</span></div>
                        ))}
                    </div>
                )}

                {pending && pending.expenses.length > 0 && (
                    <div style={st.approvals}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <h4 style={{ margin: 0, color: '#8a6d00', flex: 1 }}><Icon name="safe2-fill" />{isTreasurer ? 'Awaiting your approval' : 'Bills awaiting the treasurer'} — {pending.expenses.length} bill(s), {kes(pending.total)}</h4>
                            <button type="button" onClick={() => printBillsList('Bills for approval', pending.expenses, blocked)} style={st.secondary}><Icon name="printer" />Print list</button>
                            {isTreasurer && <>
                                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={ticked.size === pending.expenses.length} onChange={e => setTicked(e.target.checked ? new Set(pending.expenses.map(x => x.expenseId)) : new Set())} />all</label>
                                <button type="button" disabled={!ticked.size} onClick={approveTicked} style={{ ...st.primary, backgroundColor: '#1e7e34', opacity: ticked.size ? 1 : 0.5 }}><Icon name="check2-all" />Approve ticked ({ticked.size})</button>
                            </>}
                        </div>
                        {pending.expenses.map(x => (
                            <div key={x.expenseId} style={st.approvalRow}>
                                {isTreasurer && <input type="checkbox" checked={ticked.has(x.expenseId)} onChange={() => toggle(ticked, setTicked, x.expenseId)} aria-label={`Tick ${x.voucherNumber}`} />}
                                <span style={{ flex: 1 }}><b>{x.voucherNumber}</b> · {fmtDate(x.spentOn)} · {x.groupName} — {x.description}{x.payee ? ` (to ${x.payee})` : ''}
                                    <span style={st.small}> · prepared by {x.recordedBy}</span></span>
                                <b style={{ whiteSpace: 'nowrap' }}>{kes(x.amount)}</b>
                                <button type="button" onClick={() => openWindow(`Payment voucher ${x.voucherNumber}`, voucherHtml(x), blocked)} style={st.link} title="View voucher"><i className="bi bi-eye" aria-label="View voucher" /></button>
                                {isTreasurer && <>
                                    <button type="button" onClick={() => decide(x, 'approve')} style={{ ...st.link, color: '#1e7e34' }}><Icon name="check-circle-fill" />Approve</button>
                                    <button type="button" onClick={() => decide(x, 'reject')} style={{ ...st.link, color: '#b02a37' }}><Icon name="x-circle-fill" />Reject</button>
                                </>}
                            </div>
                        ))}
                    </div>
                )}

                {toPay && toPay.expenses.length > 0 && (
                    <div style={{ ...st.approvals, backgroundColor: '#eef5fc', borderColor: '#9cc3e6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <h4 style={{ margin: 0, color: '#1F3864', flex: 1 }}><Icon name="journal-check" />Approved — to be paid: {toPay.expenses.length} bill(s), {kes(toPay.total)}
                                {lineBalance !== null && <span style={{ ...st.small, marginLeft: '10px', color: lineBalance >= num(toPay.total) ? '#1e7e34' : '#b8860b' }}>M-Pesa line: {kes(lineBalance)}{lineBalance < num(toPay.total) ? ' — top it up to pay them all' : ''}</span>}</h4>
                            <button type="button" onClick={() => printBillsList('Approved bills to be paid', toPay.expenses, blocked)} style={st.secondary}><Icon name="printer" />Print list</button>
                            <button type="button" disabled={!payTicked.size} onClick={startMpesa} style={{ ...st.primary, backgroundColor: '#1e7e34', opacity: payTicked.size ? 1 : 0.5 }} title="Paid from the school's M-Pesa line"><Icon name="phone-fill" />Paid by M-Pesa ({payTicked.size})</button>
                            {isTreasurer && <button type="button" disabled={!payTicked.size} onClick={startCheque} style={{ ...st.secondary, opacity: payTicked.size ? 1 : 0.5 }} title="Pay the supplier directly by cheque"><Icon name="pen-fill" />Cheque to supplier ({payTicked.size})</button>}
                        </div>
                        {toPay.expenses.map(x => (
                            <div key={x.expenseId} style={{ ...st.approvalRow, borderTopColor: '#9cc3e6' }}>
                                <input type="checkbox" checked={payTicked.has(x.expenseId)} onChange={() => toggle(payTicked, setPayTicked, x.expenseId)} aria-label={`Tick ${x.voucherNumber} to pay`} />
                                <span style={{ flex: 1 }}><b>{x.payee || '—'}</b> · {x.voucherNumber} · {fmtDate(x.spentOn)} · {x.groupName} — {x.description}<span style={st.small}> · approved by {x.approvedBy}</span></span>
                                <b style={{ whiteSpace: 'nowrap' }}>{kes(x.amount)}</b>
                            </div>
                        ))}
                        <p style={{ ...st.small, margin: '6px 0 0' }}>Tick the bills one payment covers — usually all the bills for the same supplier. Most are paid from the school's M-Pesa line (the treasurer tops it up by cheque){isTreasurer ? '; a large one can be paid by cheque straight to the supplier' : ''}.</p>
                    </div>
                )}

                {mpesa && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' }}
                        onMouseDown={e => { if (e.target === e.currentTarget) setMpesa(null); }}>
                        <div role="dialog" aria-modal="true" aria-label="Paid by M-Pesa" style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '18px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
                            <h3 style={{ color: '#1e7e34', margin: '0 0 6px' }}><Icon name="phone-fill" />Paid by M-Pesa — {kes(mpesa.total)}</h3>
                            <p style={{ ...st.small, margin: '0 0 10px' }}>{payTicked.size} approved bill(s){mpesa.payees.length ? ` to ${mpesa.payees.join(', ')}` : ''}, paid from the school's M-Pesa line.
                                {lineBalance !== null && <> Line balance: <b>{kes(lineBalance)}</b>.</>}</p>
                            {lineBalance !== null && mpesa.total + num(mpesa.charge) > lineBalance && <p style={{ ...st.small, color: '#b02a37', fontWeight: 700, margin: '0 0 8px' }}>The M-Pesa line doesn't have enough — the treasurer must top it up by cheque first (Cheques & M-Pesa line).</p>}
                            {mpesa.payees.length > 1 && <p style={{ ...st.small, color: '#b8860b', margin: '0 0 8px' }}>These bills are for different payees — one M-Pesa code usually pays one supplier.</p>}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <label style={{ ...st.lbl, gridColumn: 'span 2' }}>M-Pesa code (from the confirmation SMS)<input style={{ ...st.input, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'Consolas, monospace' }} maxLength={20} value={mpesa.code} onChange={e => setMpesa(m => ({ ...m, code: e.target.value.toUpperCase().replace(/\s/g, '') }))} /></label>
                                <label style={st.lbl}>Date paid<input type="date" style={st.input} value={mpesa.paidOn} max={new Date().toISOString().slice(0, 10)} onChange={e => setMpesa(m => ({ ...m, paidOn: e.target.value }))} /></label>
                                <label style={st.lbl}>M-Pesa charge (optional)<input style={st.input} inputMode="decimal" value={mpesa.charge} placeholder="e.g. 108" onChange={e => setMpesa(m => ({ ...m, charge: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                                <button type="button" onClick={() => setMpesa(null)} style={st.secondary}>Cancel</button>
                                <button type="button" onClick={payMpesa} style={{ ...st.primary, backgroundColor: '#1e7e34' }}><Icon name="check-circle-fill" />Record payment</button>
                            </div>
                        </div>
                    </div>
                )}
                {cheque && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' }}
                        onMouseDown={e => { if (e.target === e.currentTarget) setCheque(null); }}>
                        <div role="dialog" aria-modal="true" aria-label="Raise cheque" style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '18px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
                            <h3 style={{ color: '#1F3864', margin: '0 0 6px' }}><Icon name="pen-fill" />Raise cheque — {kes(cheque.total)}</h3>
                            <p style={{ ...st.small, margin: '0 0 10px' }}>For {payTicked.size} approved bill(s). {amountInWords(cheque.total)}.</p>
                            {cheque.manyPayees && <p style={{ ...st.small, color: '#b8860b', margin: '0 0 8px' }}>The ticked bills are for different payees — check the name the cheque is made out to.</p>}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <label style={st.lbl}>Cheque number<input style={{ ...st.input, fontWeight: 700 }} maxLength={30} value={cheque.chequeNumber} onChange={e => setCheque(c => ({ ...c, chequeNumber: e.target.value.replace(/\s/g, '') }))} autoFocus /></label>
                                <label style={st.lbl}>Date on the cheque<input type="date" style={st.input} value={cheque.chequeDate} onChange={e => setCheque(c => ({ ...c, chequeDate: e.target.value }))} /></label>
                                <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Pay (payee)<input style={st.input} maxLength={100} value={cheque.payee} onChange={e => setCheque(c => ({ ...c, payee: e.target.value.toUpperCase() }))} /></label>
                                <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Memo (optional)<input style={st.input} maxLength={200} value={cheque.memo} onChange={e => setCheque(c => ({ ...c, memo: e.target.value }))} /></label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
                                <button type="button" onClick={() => setCheque(null)} style={st.secondary}>Cancel</button>
                                <button type="button" onClick={raiseCheque} style={st.primary}><Icon name="save-fill" />Save cheque</button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={st.table}>
                            <thead><tr><th style={st.th}>Voucher</th><th style={st.th}>Date</th><th style={st.th}>Group</th><th style={st.th}>For</th><th style={st.th}>Paid by</th><th style={{ ...st.th, textAlign: 'right' }}>Amount</th><th style={st.th}></th></tr></thead>
                            <tbody>
                                {rows.map((x, i) => (
                                    <tr key={x.expenseId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: x.voided || x.approvalStatus === 'REJECTED' ? 0.55 : 1 }}>
                                        <td style={st.td}><strong>{x.voucherNumber}</strong></td>
                                        <td style={st.td}>{fmtDate(x.spentOn)}</td>
                                        <td style={st.td}><span style={{ ...st.chip, backgroundColor: x.groupColor, color: textOn(x.groupColor) }}>{x.groupName}</span></td>
                                        <td style={st.td}>
                                            <span style={{ textDecoration: x.voided ? 'line-through' : 'none' }}>{x.description}</span>
                                            {x.payee && <div style={st.small}>to {x.payee}</div>}
                                            {x.voided && <div style={{ ...st.small, color: '#b02a37' }}>Voided: {x.voidReason} ({x.voidedBy})</div>}
                                            {!x.voided && x.approvalStatus === 'PENDING' && <div style={{ ...st.small, color: '#b8860b', fontWeight: 700 }}><i className="bi bi-hourglass-split" aria-hidden="true" /> Awaiting treasurer — not counted yet</div>}
                                            {!x.voided && x.approvalStatus === 'REJECTED' && <div style={{ ...st.small, color: '#b02a37', fontWeight: 700 }}>Rejected by {x.approvedBy}: {x.rejectReason}</div>}
                                            {!x.voided && x.approvalStatus === 'APPROVED' && x.paid === false && <div style={{ ...st.small, color: '#2E75B6', fontWeight: 700 }}><i className="bi bi-hourglass-split" aria-hidden="true" /> Approved by {x.approvedBy} — awaiting cheque, not counted yet</div>}
                                            {!x.voided && x.approvalStatus === 'APPROVED' && x.paid !== false && x.chequeId && <div style={{ ...st.small, color: '#1e7e34' }}>Paid by cheque No. {x.reference} ({fmtDate(x.paidOn)}) · approved by {x.approvedBy}</div>}
                                            {!x.voided && x.approvalStatus === 'APPROVED' && x.paid !== false && !x.chequeId && x.approvedBy && x.approvedBy !== x.recordedBy && <div style={{ ...st.small, color: '#1e7e34' }}>Approved by {x.approvedBy}</div>}
                                        </td>
                                        <td style={st.td}>{methodOf(x.method).label}<div style={st.small}>{x.reference}</div></td>
                                        <td style={{ ...st.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(x.amount)}</td>
                                        <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                            <button type="button" onClick={() => openWindow(`Payment voucher ${x.voucherNumber}`, voucherHtml(x), blocked)} style={st.link} title="Print voucher"><i className="bi bi-printer" aria-label="Print voucher" /></button>
                                            {!x.voided && <button type="button" onClick={() => voidIt(x)} style={{ ...st.link, color: '#b02a37' }} title="Void"><i className="bi bi-x-circle" aria-label="Void" /></button>}
                                        </td>
                                    </tr>
                                ))}
                                {!rows.length && <tr><td colSpan={7} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>No expenses for {periodLabel}.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

const st = {
    approvals: { backgroundColor: '#fff8e1', border: '1.5px solid #f0c36d', borderRadius: '10px', padding: '12px', marginBottom: '12px' },
    approvalRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px dashed #f0c36d', fontSize: '13px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '16px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864', minWidth: 0 },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', fontWeight: 'normal', color: '#222', minWidth: 0 },
    primary: { padding: '9px 18px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    bar: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' },
    pills: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
    pill: { padding: '7px 12px', border: '1px solid #1F3864', borderRadius: '16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '8px 10px', backgroundColor: '#fafbfd', fontSize: '12px', color: '#555' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    chip: { display: 'inline-block', padding: '2px 8px', borderRadius: '10px', color: 'white', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
    small: { fontSize: '11px', color: '#888' },
    link: { background: 'none', border: 'none', cursor: 'pointer', color: '#2E75B6', fontSize: '15px', padding: '2px 5px' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
};
