import React, { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Finance → Home: today at a glance and one-tap buttons for everyday jobs.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const num = (v) => Number(v || 0);
const money = (v) => num(v).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const METHOD = { MPESA: 'M-Pesa', BANK: 'Bank', CHEQUE: 'Cheque', CASH: 'Cash' };

const ACTIONS = [
    { tab: 'payment', icon: 'cash-coin', title: 'Record a payment', text: 'Fees received — prints the receipt', color: '#28a745' },
    { tab: 'expenses', icon: 'bag-dash-fill', title: 'Record an expense', text: 'Money spent — prints a voucher', color: '#dc3545' },
    { tab: 'statement', icon: 'search', title: 'Find a learner', text: 'Statement, balance, reprint receipts', color: '#2E75B6' },
    { tab: 'prints', icon: 'envelope-paper-fill', title: 'Balance slips', text: 'Print per class for class teachers', color: '#fd7e14' },
    { tab: 'extras', icon: 'check2-square', title: 'Meals, trips & extras', text: 'Tick learners, set special prices', color: '#6f42c1' },
    { tab: 'report', icon: 'bar-chart-fill', title: 'Money in & out', text: 'Profit per group, income statement', color: '#1F3864' },
];

export default function FinanceHome({ onGo }) {
    const [today, setToday] = useState(null);
    const date = iso(new Date());

    useEffect(() => {
        Promise.allSettled([
            api.get('/api/finance/payments', { params: { from: date, to: date } }),
            api.get('/api/finance/expenses', { params: { from: date, to: date } }),
            api.get('/api/finance/balances'),
        ]).then(([p, e, b]) => {
            const owing = b.status === 'fulfilled' ? (b.value.data.students || []).filter(s => num(s.balance) > 0).length : null;
            setToday({
                paid: p.status === 'fulfilled' ? p.value.data : null,
                spent: e.status === 'fulfilled' ? e.value.data : null,
                owed: b.status === 'fulfilled' ? b.value.data.totalOwed : null,
                owing,
            });
        });
    }, [date]);

    const recent = (today?.paid?.payments || []).filter(p => !p.reversed).slice(0, 6);
    const byMethod = Object.entries(today?.paid?.byMethod || {}).filter(([, v]) => num(v) > 0);

    return (
        <div>
            <div style={st.cards}>
                <div style={{ ...st.card, borderTopColor: '#28a745' }}>
                    <span style={st.cardLbl}><Icon name="arrow-down-circle-fill" style={{ color: '#28a745' }} />Received today</span>
                    <b style={st.big}>{today?.paid ? `KES ${money(today.paid.total)}` : '…'}</b>
                    <span style={st.small}>{byMethod.length ? byMethod.map(([k, v]) => `${METHOD[k] || k} ${money(v)}`).join(' · ') : `${(today?.paid?.payments || []).length} payment(s)`}</span>
                </div>
                <div style={{ ...st.card, borderTopColor: '#dc3545' }}>
                    <span style={st.cardLbl}><Icon name="arrow-up-circle-fill" style={{ color: '#dc3545' }} />Spent today</span>
                    <b style={st.big}>{today?.spent ? `KES ${money(today.spent.total)}` : '…'}</b>
                    <span style={st.small}>{(today?.spent?.expenses || []).filter(x => !x.voided).length} expense(s)</span>
                </div>
                <div style={{ ...st.card, borderTopColor: '#fd7e14' }}>
                    <span style={st.cardLbl}><Icon name="hourglass-split" style={{ color: '#fd7e14' }} />Owed by learners</span>
                    <b style={st.big}>{today && today.owed !== null ? `KES ${money(today.owed)}` : '…'}</b>
                    <span style={st.small}>{today?.owing != null ? `${today.owing} learner(s) owe` : ''}</span>
                </div>
            </div>

            <div style={st.actions}>
                {ACTIONS.map(a => (
                    <button key={a.tab} type="button" onClick={() => onGo(a.tab)} style={{ ...st.action, borderLeftColor: a.color }}>
                        <i className={`bi bi-${a.icon}`} aria-hidden="true" style={{ fontSize: '26px', color: a.color }} />
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <strong style={{ color: '#1F3864', fontSize: '15px' }}>{a.title}</strong>
                            <span style={{ fontSize: '12px', color: '#666', textAlign: 'left' }}>{a.text}</span>
                        </span>
                    </button>
                ))}
            </div>

            <div style={st.panel}>
                <h3 style={st.h3}><Icon name="clock-history" />Today's payments</h3>
                {!today ? <p style={st.small}>Loading…</p> : !recent.length ? <p style={st.small}>No payments recorded today yet.</p> : recent.map(p => (
                    <div key={p.paymentId} style={st.line}>
                        <span><strong>{p.student?.name}</strong> <span style={st.small}>{p.student?.className} · {p.receiptNumber}</span></span>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{money(p.amount)} <span style={st.small}>{METHOD[p.method] || p.method}</span></span>
                    </div>
                ))}
                {(today?.paid?.payments || []).length > recent.length && (
                    <button type="button" onClick={() => onGo('daybook')} style={st.link}>See all of today's payments →</button>
                )}
            </div>
        </div>
    );
}

const st = {
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '14px' },
    card: { display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '5px solid', borderRadius: '10px', padding: '14px', backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
    cardLbl: { fontSize: '13px', color: '#555', fontWeight: 600 },
    big: { fontSize: '24px', color: '#1F3864' },
    small: { fontSize: '12px', color: '#888' },
    actions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' },
    action: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', backgroundColor: 'white', border: '1px solid #e3e7ee', borderLeft: '5px solid', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
    h3: { color: '#1F3864', margin: '0 0 8px', fontSize: '16px' },
    line: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, marginTop: '8px', padding: 0 },
};
