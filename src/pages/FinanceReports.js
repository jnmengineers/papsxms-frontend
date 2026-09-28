import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { letterheadHtml } from '../utils/school';

/**
 * Finance → Reports → Money in & out
 * For one term, per money group: charged, collected, still owed, spent, profit.
 * Collected = how much of the term's charges has been paid, with payments split oldest term first,
 * then in the groups' payment order (Setup → Money groups).
 * Printable income statement and download for Excel.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(v || 0);
const money = (v) => num(v).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const signed = (v) => (num(v) < 0 ? `(${money(-num(v))})` : money(v));   // accounting style: losses in brackets
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const pct = (a, b) => (num(b) > 0 ? Math.round(num(a) / num(b) * 100) : 0);

export default function MoneyReportTab({ termOptions, defaultTerm, setError, blocked }) {
    const [termKey, setTermKey] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState({});
    const [basis, setBasis] = useState('collected');   // collected | charged
    const latest = useRef('');

    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm, termKey]);
    useEffect(() => {
        if (!termKey) return;
        const [y, t] = termKey.split('|');
        latest.current = termKey;
        setLoading(true); setData(null);
        api.get('/api/finance/reports/groups', { params: { yearLabel: y, term: t } })
            .then(r => { if (latest.current === termKey) setData(r.data); })
            .catch(err => { if (latest.current === termKey) setError(serverMessage(err, 'Failed to load the report.')); })
            .finally(() => { if (latest.current === termKey) setLoading(false); });
    }, [termKey, setError]);

    const termLabel = (termOptions.find(t => t.value === termKey)?.label || '').replace(' (current)', '');
    const income = (g) => (basis === 'collected' ? num(g.collected) : num(g.charged));
    const profit = (g) => income(g) - num(g.expenses);
    const groups = data?.groups || [];
    const tot = data?.totals;
    const totIncome = tot ? (basis === 'collected' ? num(tot.collected) : num(tot.charged)) : 0;
    const totProfit = tot ? totIncome - num(tot.expenses) : 0;
    const maxBar = Math.max(1, ...groups.map(g => Math.max(num(g.charged), num(g.expenses))));

    const printStatement = () => {
        if (!data) return;
        const incomeRows = groups.filter(g => income(g) !== 0).map(g => `<tr><td>&nbsp;&nbsp;${esc(g.name)}</td><td class="num">${money(income(g))}</td><td></td></tr>`).join('');
        const expRows = groups.filter(g => num(g.expenses) !== 0).map(g => `<tr><td>&nbsp;&nbsp;${esc(g.name)}</td><td class="num">${money(g.expenses)}</td><td></td></tr>`).join('');
        const perGroup = groups.map(g => `<tr><td>${esc(g.name)}</td><td class="num">${money(g.charged)}</td><td class="num">${money(g.collected)}</td><td class="num">${money(g.owed)}</td>
            <td class="num">${money(g.expenses)}</td><td class="num" style="font-weight:bold;color:${profit(g) < 0 ? '#b02a37' : '#1e7e34'}">${signed(profit(g))}</td></tr>`).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Income statement ${esc(termLabel)}</title><style>
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:14px;max-width:780px;margin:0 auto;color:#000}
            .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
            .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
            h2{text-align:center;color:#1F3864;font-size:15px;margin:10px 0 4px;letter-spacing:.5px}h3{color:#1F3864;font-size:13px;margin:16px 0 6px;border-bottom:2px solid #1F3864;padding-bottom:3px}
            table{width:100%;border-collapse:collapse}td,th{padding:5px 7px;font-size:12px}th{background:#1F3864;color:#fff;text-align:left}
            .grid td{border:1px solid #ccc}.num{text-align:right;white-space:nowrap}.tot td{font-weight:bold;border-top:2px solid #000}
            .big td{font-size:14px;font-weight:800;border-top:3px double #000}.note{font-size:10.5px;color:#555;margin-top:10px}
            .sig{display:flex;justify-content:space-between;margin-top:40px;font-size:11px}
            @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:12mm}}
        </style></head><body><div class="bar"><strong>Income statement — ${esc(termLabel)}</strong><button onclick="window.print()">Print / Save PDF</button></div>
        ${letterheadHtml({ logoSize: 50 })}
        <h2>INCOME STATEMENT — ${esc(termLabel.toUpperCase())}</h2>
        <p style="text-align:center;margin:0;color:#555">Income shown as money ${basis === 'collected' ? 'collected (received against this term\'s charges)' : 'charged to learners this term'}</p>
        <h3>INCOME</h3><table>${incomeRows}<tr class="tot"><td>Total income</td><td></td><td class="num">${money(totIncome)}</td></tr></table>
        <h3>EXPENSES</h3><table>${expRows || '<tr><td>&nbsp;&nbsp;None recorded</td><td></td><td></td></tr>'}<tr class="tot"><td>Total expenses</td><td></td><td class="num">${money(tot.expenses)}</td></tr></table>
        <table style="margin-top:10px"><tr class="big"><td>${totProfit < 0 ? 'DEFICIT' : 'SURPLUS'} FOR THE TERM</td><td class="num">KES ${signed(totProfit)}</td></tr></table>
        <h3>BY MONEY GROUP</h3>
        <table class="grid"><thead><tr><th>Group</th><th class="num">Charged</th><th class="num">Collected</th><th class="num">Still owed</th><th class="num">Spent</th><th class="num">${basis === 'collected' ? 'Profit' : 'Profit if all paid'}</th></tr></thead>
        <tbody>${perGroup}<tr class="tot"><td>Total</td><td class="num">${money(tot.charged)}</td><td class="num">${money(tot.collected)}</td><td class="num">${money(tot.owed)}</td><td class="num">${money(tot.expenses)}</td><td class="num">${signed(totProfit)}</td></tr></tbody></table>
        <p class="note">Still owed by learners for this term: KES ${money(tot.owed)}. Paid in advance by learners (credit held, all terms): KES ${money(data.creditHeld)}.
        Payments are applied to the oldest term first, then to the money groups in the school's payment order. Figures in brackets are losses.</p>
        <div class="sig"><span>Bursar: ______________</span><span>Head teacher: ______________</span><span>Date: ______________</span></div>
        <p style="text-align:center;color:#888;font-size:10px;margin-top:14px">Printed ${esc(new Date().toLocaleString('en-GB'))}</p></body></html>`;
        const w = window.open('', '_blank');
        if (!w) { blocked?.(); return; }
        w.document.write(html); w.document.close(); w.focus();
    };

    const downloadCsv = () => {
        if (!data) return;
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Group', 'Item', 'Charged', 'Collected', 'Still owed', 'Spent', 'Profit (collected - spent)', 'Profit if all paid'].map(q).join(',')];
        groups.forEach(g => {
            lines.push([g.name, 'ALL', num(g.charged), num(g.collected), num(g.owed), num(g.expenses), num(g.profit), num(g.profitIfAllPaid)].map(q).join(','));
            (g.items || []).forEach(i => lines.push([g.name, i.name, num(i.charged), num(i.collected), num(i.charged) - num(i.collected), '', '', ''].map(q).join(',')));
            (g.spending || []).forEach(s => lines.push([g.name, `Spent: ${s.description}`, '', '', '', num(s.amount), '', ''].map(q).join(',')));
        });
        lines.push(['TOTAL', '', num(tot.charged), num(tot.collected), num(tot.owed), num(tot.expenses), num(tot.profit), num(tot.profitIfAllPaid)].map(q).join(','));
        const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Money in and out ${termLabel}.csv`.replace(/[\\/:*?"<>|]/g, '-');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <div>
            <div style={st.bar}>
                <label style={st.lbl}>Term
                    <select style={st.input} value={termKey} onChange={e => setTermKey(e.target.value)}>
                        {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>
                <label style={st.lbl}>Profit worked out on
                    <select style={st.input} value={basis} onChange={e => setBasis(e.target.value)}>
                        <option value="collected">Money collected (what came in)</option>
                        <option value="charged">Money charged (if everyone pays)</option>
                    </select>
                </label>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                    <button type="button" onClick={downloadCsv} disabled={!data} style={st.secondary}><Icon name="file-earmark-spreadsheet" />Excel</button>
                    <button type="button" onClick={printStatement} disabled={!data} style={st.primary}><Icon name="printer-fill" />Income statement</button>
                </span>
            </div>

            {loading ? <p style={st.center}><Icon name="hourglass-split" />Working it out…</p> : data && (
                <>
                    <div style={st.cards}>
                        <div style={{ ...st.card, borderTopColor: '#1F3864' }}><b>{money(tot.charged)}</b><span>Charged to learners</span></div>
                        <div style={{ ...st.card, borderTopColor: '#28a745' }}><b>{money(tot.collected)}</b><span>Collected ({pct(tot.collected, tot.charged)}%)</span></div>
                        <div style={{ ...st.card, borderTopColor: '#fd7e14' }}><b>{money(tot.owed)}</b><span>Still owed</span></div>
                        <div style={{ ...st.card, borderTopColor: '#b02a37' }}><b>{money(tot.expenses)}</b><span>Spent</span></div>
                        <div style={{ ...st.card, borderTopColor: totProfit < 0 ? '#b02a37' : '#1e7e34' }}>
                            <b style={{ color: totProfit < 0 ? '#b02a37' : '#1e7e34' }}>{signed(totProfit)}</b><span>{totProfit < 0 ? 'Deficit' : 'Surplus'} {basis === 'charged' ? '(if all paid)' : ''}</span>
                        </div>
                    </div>

                    <div style={st.panel}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={st.table}>
                                <thead><tr>
                                    <th style={st.th}>Group</th><th style={st.thN}>Charged</th><th style={st.thN}>Collected</th><th style={st.thN}>Still owed</th>
                                    <th style={st.thN}>Spent</th><th style={st.thN}>{basis === 'collected' ? 'Profit' : 'Profit if all paid'}</th><th style={{ ...st.th, width: '26%' }}>In vs out</th>
                                </tr></thead>
                                <tbody>
                                    {groups.map(g => {
                                        const p = profit(g);
                                        const isOpen = !!open[g.groupId ?? 'none'];
                                        return (
                                            <React.Fragment key={g.groupId ?? 'none'}>
                                                <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(o => ({ ...o, [g.groupId ?? 'none']: !isOpen }))}>
                                                    <td style={st.td}>
                                                        <i className={`bi bi-chevron-${isOpen ? 'down' : 'right'}`} aria-hidden="true" style={{ marginRight: '6px', color: '#999' }} />
                                                        <span style={{ ...st.dot, backgroundColor: g.color }} /> <strong>{g.name}</strong>
                                                    </td>
                                                    <td style={st.tdN}>{money(g.charged)}</td>
                                                    <td style={st.tdN}>{money(g.collected)}<div style={st.small}>{pct(g.collected, g.charged)}%</div></td>
                                                    <td style={{ ...st.tdN, color: num(g.owed) > 0 ? '#fd7e14' : '#999' }}>{money(g.owed)}</td>
                                                    <td style={st.tdN}>{money(g.expenses)}</td>
                                                    <td style={{ ...st.tdN, fontWeight: 800, color: p < 0 ? '#b02a37' : '#1e7e34' }}>{signed(p)}</td>
                                                    <td style={st.td}>
                                                        <div style={st.barRow} title={`In: ${money(income(g))}`}><div style={{ ...st.barIn, width: `${income(g) / maxBar * 100}%` }} /></div>
                                                        <div style={st.barRow} title={`Out: ${money(g.expenses)}`}><div style={{ ...st.barOut, width: `${num(g.expenses) / maxBar * 100}%` }} /></div>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr><td colSpan={7} style={{ ...st.td, backgroundColor: '#f7f9fc' }}>
                                                        <div style={st.detail}>
                                                            <div>
                                                                <div style={st.dh}>Charged items</div>
                                                                {(g.items || []).length ? g.items.map(i => (
                                                                    <div key={i.name} style={st.dl}><span>{i.name}</span><span>{money(i.collected)} of {money(i.charged)}</span></div>
                                                                )) : <div style={st.small}>Nothing charged this term.</div>}
                                                            </div>
                                                            <div>
                                                                <div style={st.dh}>Spent on</div>
                                                                {(g.spending || []).length ? g.spending.map(s => (
                                                                    <div key={s.description} style={st.dl}><span>{s.description}</span><span>{money(s.amount)}</span></div>
                                                                )) : <div style={st.small}>No expenses recorded this term.</div>}
                                                            </div>
                                                        </div>
                                                    </td></tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    <tr style={{ backgroundColor: '#eef3fb' }}>
                                        <td style={{ ...st.td, fontWeight: 800 }}>Total</td>
                                        <td style={{ ...st.tdN, fontWeight: 800 }}>{money(tot.charged)}</td>
                                        <td style={{ ...st.tdN, fontWeight: 800 }}>{money(tot.collected)}</td>
                                        <td style={{ ...st.tdN, fontWeight: 800 }}>{money(tot.owed)}</td>
                                        <td style={{ ...st.tdN, fontWeight: 800 }}>{money(tot.expenses)}</td>
                                        <td style={{ ...st.tdN, fontWeight: 800, color: totProfit < 0 ? '#b02a37' : '#1e7e34' }}>{signed(totProfit)}</td>
                                        <td style={st.td} />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p style={st.note}>
                            <span style={{ ...st.legend, backgroundColor: '#28a745' }} /> money in ({basis}) &nbsp; <span style={{ ...st.legend, backgroundColor: '#dc3545' }} /> money spent &nbsp;·&nbsp;
                            Click a group to see its items and spending. Payments clear the oldest term first, then groups in the payment order set on Setup.
                            {num(data.creditHeld) > 0 && <> Learners have also paid <strong>KES {money(data.creditHeld)}</strong> in advance (credit, not counted as income yet).</>}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

const st = {
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', backgroundColor: 'white', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white', fontWeight: 'normal', color: '#222' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '9px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    center: { textAlign: 'center', color: '#666', padding: '24px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '10px 12px', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', fontSize: '12px', color: '#555' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    thN: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'right', fontSize: '12px' },
    td: { padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    tdN: { padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' },
    small: { fontSize: '11px', color: '#888' },
    dot: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', verticalAlign: 'middle' },
    barRow: { height: '8px', backgroundColor: '#f1f3f5', borderRadius: '4px', margin: '2px 0', overflow: 'hidden' },
    barIn: { height: '100%', backgroundColor: '#28a745', borderRadius: '4px' },
    barOut: { height: '100%', backgroundColor: '#dc3545', borderRadius: '4px' },
    detail: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' },
    dh: { fontWeight: 700, color: '#1F3864', fontSize: '12px', marginBottom: '4px' },
    dl: { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', padding: '3px 0', borderBottom: '1px dotted #ddd' },
    note: { fontSize: '12px', color: '#666', margin: '10px 0 0' },
    legend: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', verticalAlign: 'middle' },
};
