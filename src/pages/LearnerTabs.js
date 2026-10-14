import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { hasRole } from '../utils/roles';
import { letterheadHtml } from '../utils/school';

/**
 * Extra tabs on the learner profile: Fees, Attendance and Parents, plus an "at a glance" strip
 * on the Overview. Each part only loads for roles allowed to see it.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const kes = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const pretty = (p) => (p && p.startsWith('+254') && p.length === 13 ? `0${p.slice(4, 7)} ${p.slice(7)}` : p || '');
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

// Teachers too: the server only returns fees for learners in a class they are class teacher of
export const canSeeFees = () => hasRole('ADMIN', 'ACCOUNTANT', 'CHAIRPERSON', 'TEACHER');
export const canSeeParents = () => hasRole('ADMIN', 'CLERK', 'ACCOUNTANT');

/** Attendance this year: counts by status and the rate (present + late out of all marked days). */
export function summarise(records) {
    const c = {};
    (records || []).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    const marked = (records || []).length;
    const present = (c.PRESENT || 0) + (c.LATE || 0);
    return { counts: c, marked, rate: marked ? Math.round((present / marked) * 1000) / 10 : null };
}

export function LearnerGlance({ studentId }) {
    const [bal, setBal] = useState(null);
    const [att, setAtt] = useState(null);
    useEffect(() => {
        if (canSeeFees()) api.get(`/api/finance/students/${studentId}/statement`).then(r => setBal(Number(r.data.balance))).catch(() => {});
        api.get(`/api/attendance/student/${studentId}`, { params: { from: yearStart(), to: today() } }).then(r => setAtt(summarise(r.data))).catch(() => {});
    }, [studentId]);
    if (bal === null && !att) return null;
    return (
        <div style={st.glance}>
            {bal !== null && <div style={{ ...st.card, borderTopColor: bal > 0 ? '#b02a37' : '#1e7e34' }}><b style={{ color: bal > 0 ? '#b02a37' : '#1e7e34' }}>{kes(Math.abs(bal))}</b><span>{bal > 0 ? 'Fee balance' : bal < 0 ? 'In credit' : 'Fees fully paid'}</span></div>}
            {att && att.marked > 0 && <div style={{ ...st.card, borderTopColor: att.rate >= 90 ? '#1e7e34' : att.rate >= 75 ? '#b8860b' : '#b02a37' }}><b>{att.rate}%</b><span>Attendance this year ({att.marked} days marked)</span></div>}
            {att && att.marked > 0 && <div style={{ ...st.card, borderTopColor: '#6c757d' }}><b>{att.counts.ABSENT || 0}</b><span>Days absent this year</span></div>}
        </div>
    );
}

/** Printable fee payment history for one learner (letterhead, summary, fee structure, payments). */
function printFeeHistory(data) {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const st = data.student || {};
    const name = st.name || `${st.firstName || ''} ${st.lastName || ''}`.trim();
    const entries = data.entries || [];
    const live = entries.filter(e => !e.cancelled);
    const billed = live.reduce((a, e) => a + Number(e.debit || 0), 0);
    const paid = live.reduce((a, e) => a + Number(e.credit || 0), 0);
    const bal = Number(data.balance || 0);
    const invoices = entries.filter(e => e.type === 'INVOICE');
    const latest = invoices[invoices.length - 1];
    const pays = entries.filter(e => e.type === 'PAYMENT');
    let run = 0;
    const payRows = pays.map((p, i) => {
        const rev = /REVERSED/.test(p.description || '');
        if (!rev) run += Number(p.credit || 0);
        return `<tr${rev ? ' class="rev"' : ''}><td>${i + 1}</td><td>${fmt(p.date)}</td><td>${esc(p.receiptNumber || '—')}</td><td>${esc(p.description)}</td><td class="n">${rev ? '0.00' : kes(p.credit).replace('KES ', '')}</td><td class="n">${kes(run).replace('KES ', '')}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="c">No payments recorded</td></tr>';
    const structure = latest ? (latest.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td class="n">${kes(l.amount).replace('KES ', '')}</td></tr>`).join('')
        + `<tr class="t"><td>Term total</td><td class="n">${kes(latest.debit).replace('KES ', '')}</td></tr>` : '<tr><td colspan="2" class="c">No term fees billed</td></tr>';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee payment history - ${esc(name)}</title><style>
        @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; margin: 0; }
        .bar { background: #1F3864; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
        .bar button { background: #FFD700; border: 0; padding: 7px 16px; border-radius: 5px; font-weight: 700; cursor: pointer; }
        .page { max-width: 780px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; color: #1F3864; letter-spacing: 1px; border-top: 2px solid #1F3864; border-bottom: 2px solid #1F3864; padding: 5px 0; margin: 8px 0 10px; font-size: 14px; }
        .who { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 10px; } .who b { color: #1F3864; }
        .sum { display: flex; gap: 10px; margin-bottom: 12px; } .sum div { flex: 1; border: 1px solid #ccd3df; border-radius: 6px; padding: 6px 10px; text-align: center; }
        .sum span { display: block; font-size: 9px; color: #666; text-transform: uppercase; } .sum strong { font-size: 14px; color: #1F3864; }
        h3 { color: #1F3864; font-size: 12px; margin: 12px 0 5px; }
        table { width: 100%; border-collapse: collapse; } th { text-align: left; border-bottom: 1.5px solid #1F3864; color: #1F3864; padding: 5px; font-size: 10px; }
        td { padding: 4px 5px; border-bottom: 1px solid #e3e7ee; } .n { text-align: right; } .c { text-align: center; color: #888; }
        .t td { font-weight: 700; border-top: 1.5px solid #1F3864; } .rev td { color: #999; text-decoration: line-through; }
        .sig { display: flex; justify-content: space-between; margin-top: 28px; font-size: 10px; } .foot { text-align: center; color: #999; font-size: 9px; margin-top: 14px; }
        @media print { .bar { display: none; } .page { padding: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><div class="bar"><b>Fee payment history — ${esc(name)}</b><button onclick="window.print()">Print / Save PDF</button></div><div class="page">
        ${letterheadHtml({ logoSize: 50 })}
        <h2>LEARNER FEE PAYMENT HISTORY</h2>
        <div class="who"><div><b>Learner:</b> ${esc(name)}</div><div><b>Adm No:</b> ${esc(st.admissionNumber || '')}</div>
            <div><b>Class:</b> ${esc(st.className || '')}${st.stream ? ' ' + esc(st.stream) : ''}</div><div><b>Printed:</b> ${fmt(new Date().toISOString())}</div></div>
        <div class="sum"><div><span>Total billed</span><strong>${kes(billed)}</strong></div><div><span>Total paid</span><strong>${kes(paid)}</strong></div>
            <div><span>${bal > 0 ? 'Balance owed' : bal < 0 ? 'In credit' : 'Fully paid'}</span><strong style="color:${bal > 0 ? '#b02a37' : '#1e7e34'}">${kes(Math.abs(bal))}</strong></div></div>
        <h3>Fee structure${latest ? ' — ' + esc(latest.description.replace(/^Fees — /, '')) : ''}</h3>
        <table><thead><tr><th>Item</th><th class="n">Amount (KES)</th></tr></thead><tbody>${structure}</tbody></table>
        <h3>Payments (${pays.length})</h3>
        <table><thead><tr><th>#</th><th>Date</th><th>Receipt</th><th>Paid by / reference</th><th class="n">Amount (KES)</th><th class="n">Running total</th></tr></thead><tbody>${payRows}</tbody></table>
        <div class="sig"><span>Bursar: ____________________ Sign: ____________</span><span>Date: ____________ Stamp</span></div>
        <div class="foot">This is a record of payments received. Reversed payments are shown crossed out.</div>
    </div></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this site to print.'); return; }
    w.document.write(html); w.document.close(); w.focus();
}

export function FeesTab({ studentId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { api.get(`/api/finance/students/${studentId}/statement`).then(r => setData(r.data)).catch(err => setError(err?.response?.status === 403 ? 'Only the class teacher (and the finance office) can see this learner\'s fees.' : 'Could not load the fees.')); }, [studentId]);
    if (error) return <p style={st.muted}>{error}</p>;
    if (!data) return <p style={st.muted}>Loading…</p>;
    const entries = data.entries || [];
    const live = entries.filter(e => !e.cancelled);
    const billed = live.reduce((a, e) => a + Number(e.debit || 0), 0);
    const paid = live.reduce((a, e) => a + Number(e.credit || 0), 0);
    const bal = Number(data.balance || 0);
    const invoices = entries.filter(e => e.type === 'INVOICE');
    const latest = invoices[invoices.length - 1];
    const extras = live.filter(e => (e.type === 'CHARGE' || e.type === 'TRANSPORT') && e.debit);
    const payments = entries.filter(e => e.type === 'PAYMENT').slice().reverse();
    return (
        <div>
            {hasRole('ADMIN', 'ACCOUNTANT', 'CHAIRPERSON') && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <button onClick={() => printFeeHistory(data)} style={{ backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                    <i className="bi bi-printer-fill" style={{ marginRight: '6px' }} />Print fee history
                </button>
            </div>}
            <div style={st.glance}>
                <div style={{ ...st.card, borderTopColor: '#1F3864' }}><b>{kes(billed)}</b><span>Total billed</span></div>
                <div style={{ ...st.card, borderTopColor: '#1e7e34' }}><b>{kes(paid)}</b><span>Total paid</span></div>
                <div style={{ ...st.card, borderTopColor: bal > 0 ? '#b02a37' : '#1e7e34' }}><b style={{ color: bal > 0 ? '#b02a37' : '#1e7e34' }}>{kes(Math.abs(bal))}</b><span>{bal > 0 ? 'Fee balance' : bal < 0 ? 'In credit' : 'Fully paid'}</span></div>
            </div>

            <div style={st.panel}>
                <h4 style={st.h4}><i className="bi bi-list-ul" style={{ marginRight: '6px' }} />Fee structure{latest ? ` — ${latest.description.replace(/^Fees — /, '')}` : ''}</h4>
                {latest ? (
                    <table style={st.table}><tbody>
                        {(latest.lines || []).map((l, i) => <tr key={i}><td style={st.td}>{l.name}</td><td style={st.tdN}>{kes(l.amount)}</td></tr>)}
                        <tr><td style={{ ...st.td, fontWeight: 700 }}>Term fees total</td><td style={{ ...st.tdN, fontWeight: 700 }}>{kes(latest.debit)}</td></tr>
                    </tbody></table>
                ) : <p style={{ ...st.muted, margin: 0 }}>No term fees billed yet.</p>}
                {extras.length > 0 && <>
                    <h4 style={{ ...st.h4, margin: '12px 0 6px', fontSize: '13px' }}>Extra charges &amp; transport</h4>
                    <table style={st.table}><tbody>{extras.map((e, i) => <tr key={i}><td style={st.td}>{fmt(e.date)}</td><td style={st.td}>{e.description}</td><td style={st.tdN}>{kes(e.debit)}</td></tr>)}</tbody></table>
                </>}
            </div>

            <div style={st.panel}>
                <h4 style={st.h4}><i className="bi bi-receipt" style={{ marginRight: '6px' }} />Payment history ({payments.length})</h4>
                {payments.length ? (
                    <div style={{ overflowX: 'auto' }}><table style={st.table}>
                        <thead><tr>{['Date', 'Paid by / reference', 'Receipt', 'Amount'].map(h => <th key={h} style={h === 'Amount' ? st.thN : st.th}>{h}</th>)}</tr></thead>
                        <tbody>{payments.map((p, i) => {
                            const reversed = /REVERSED/.test(p.description || '');
                            return (<tr key={p.sortKey || i} style={reversed ? { color: '#999', textDecoration: 'line-through' } : null}>
                                <td style={st.td}>{fmt(p.date)}</td><td style={st.td}>{p.description}</td><td style={st.td}>{p.receiptNumber || '—'}</td>
                                <td style={{ ...st.tdN, color: reversed ? '#999' : '#1e7e34' }}>{kes(reversed ? 0 : p.credit)}</td></tr>);
                        })}
                            <tr><td style={{ ...st.td, fontWeight: 700 }} colSpan={3}>Total paid</td><td style={{ ...st.tdN, fontWeight: 700, color: '#1e7e34' }}>{kes(paid)}</td></tr>
                        </tbody></table></div>
                ) : <p style={{ ...st.muted, margin: 0 }}>No payments recorded.</p>}
                <p style={{ ...st.muted, margin: '10px 0 0' }}>The full printable statement is on <Link to="/finance?tab=statement">Finance → Statement</Link>.</p>
            </div>
        </div>
    );
}

export function LearnerAttendanceTab({ studentId }) {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { api.get(`/api/attendance/student/${studentId}`, { params: { from: yearStart(), to: today() } }).then(r => setRows(r.data || [])).catch(() => setError("Attendance can't be shown (only the office and the learner's own teachers can see it).")); }, [studentId]);
    if (error) return <p style={st.muted}>{error}</p>;
    if (!rows) return <p style={st.muted}>Loading…</p>;
    const s = summarise(rows);
    const notPresent = rows.filter(r => r.status !== 'PRESENT');
    const color = { PRESENT: '#1e7e34', LATE: '#b8860b', ABSENT: '#b02a37' };
    return (
        <div>
            <div style={st.glance}>
                <div style={{ ...st.card, borderTopColor: '#1F3864' }}><b>{s.rate === null ? '—' : `${s.rate}%`}</b><span>Attendance rate ({new Date().getFullYear()})</span></div>
                {Object.entries(s.counts).map(([k, n]) => <div key={k} style={{ ...st.card, borderTopColor: color[k] || '#6c757d' }}><b>{n}</b><span>{k.charAt(0) + k.slice(1).toLowerCase().replace('_', ' ')}</span></div>)}
            </div>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="calendar-x" />Days not present ({notPresent.length})</h4>
                {notPresent.length ? notPresent.map(r => (
                    <div key={r.attendanceId} style={st.item}><span style={{ width: '130px' }}>{fmt(r.date)}</span><b style={{ color: color[r.status] || '#555', width: '90px' }}>{r.status}</b><span style={st.small}>{r.note}</span></div>
                )) : <p style={{ ...st.muted, margin: 0 }}>{rows.length ? 'Present every day marked this year.' : 'No attendance marked this year yet.'}</p>}
            </div>
        </div>
    );
}

export function ParentsTab({ studentId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { api.get(`/api/guardians/student/${studentId}`).then(r => setData(r.data)).catch(() => setError('Could not load the parents.')); }, [studentId]);
    if (error) return <p style={st.muted}>{error}</p>;
    if (!data) return <p style={st.muted}>Loading…</p>;
    return (
        <div>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="people-fill" />Parents &amp; guardians</h4>
                {data.parents.length ? data.parents.map(p => (
                    <div key={p.guardianId} style={st.item}>
                        <span style={{ flex: 1 }}><b>{p.fullName}</b> <span style={st.small}>{p.relationship}</span></span>
                        <a href={`tel:${p.phone}`} style={st.link}><Icon name="telephone-fill" />{pretty(p.phone)}</a>
                        {p.phone2 && <a href={`tel:${p.phone2}`} style={st.link}>{pretty(p.phone2)}</a>}
                    </div>
                )) : <p style={{ ...st.muted, margin: 0 }}>No parent recorded. Add one on <Link to="/parents">People → Parents</Link>.</p>}
            </div>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="diagram-3-fill" />Siblings in the school ({data.siblings.length})</h4>
                {data.siblings.length ? data.siblings.map(s => (
                    <div key={s.studentId} style={st.item}><Link to={`/student/${s.studentId}`} style={{ ...st.link, flex: 1 }}>{s.name}</Link><span style={st.small}>{s.className} · {s.admissionNumber}</span></div>
                )) : <p style={{ ...st.muted, margin: 0 }}>None recorded (siblings are children who share a parent).</p>}
            </div>
        </div>
    );
}

const st = {
    glance: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '10px 12px', backgroundColor: 'white', fontSize: '12px', color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px' },
    h4: { color: '#1F3864', margin: '0 0 8px', fontSize: '14px' },
    item: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px', flexWrap: 'wrap' },
    link: { color: '#2E75B6', fontWeight: 600, textDecoration: 'none' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '520px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    thN: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'right', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px' },
    tdN: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};