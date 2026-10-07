import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { hasRole } from '../utils/roles';

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

export const canSeeFees = () => hasRole('ADMIN', 'ACCOUNTANT', 'CHAIRPERSON');
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

export function FeesTab({ studentId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => { api.get(`/api/finance/students/${studentId}/statement`).then(r => setData(r.data)).catch(() => setError('Could not load the fees.')); }, [studentId]);
    if (error) return <p style={st.muted}>{error}</p>;
    if (!data) return <p style={st.muted}>Loading…</p>;
    const entries = (data.entries || []).filter(e => !e.cancelled);
    const billed = entries.reduce((a, e) => a + Number(e.debit || 0), 0);
    const paid = entries.reduce((a, e) => a + Number(e.credit || 0), 0);
    const bal = Number(data.balance || 0);
    return (
        <div>
            <div style={st.glance}>
                <div style={{ ...st.card, borderTopColor: '#1F3864' }}><b>{kes(billed)}</b><span>Billed</span></div>
                <div style={{ ...st.card, borderTopColor: '#1e7e34' }}><b>{kes(paid)}</b><span>Paid</span></div>
                <div style={{ ...st.card, borderTopColor: bal > 0 ? '#b02a37' : '#1e7e34' }}><b style={{ color: bal > 0 ? '#b02a37' : '#1e7e34' }}>{kes(Math.abs(bal))}</b><span>{bal > 0 ? 'Balance owed' : bal < 0 ? 'In credit' : 'Fully paid'}</span></div>
            </div>
            <div style={{ ...st.panel, overflowX: 'auto' }}>
                <table style={st.table}>
                    <thead><tr>{['Date', 'Details', 'Billed', 'Paid'].map(h => <th key={h} style={h === 'Billed' || h === 'Paid' ? st.thN : st.th}>{h}</th>)}</tr></thead>
                    <tbody>{entries.slice().reverse().map((e, i) => (
                        <tr key={e.sortKey || i} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                            <td style={st.td}>{fmt(e.date)}</td>
                            <td style={st.td}>{e.description}{e.receiptNumber ? <span style={st.small}> · {e.receiptNumber}</span> : null}{e.reference ? <span style={st.small}> · {e.reference}</span> : null}</td>
                            <td style={st.tdN}>{e.debit ? kes(e.debit) : ''}</td>
                            <td style={{ ...st.tdN, color: '#1e7e34' }}>{e.credit ? kes(e.credit) : ''}</td>
                        </tr>))}
                        {!entries.length && <tr><td colSpan={4} style={{ ...st.td, color: '#888', textAlign: 'center' }}>Nothing billed yet.</td></tr>}</tbody>
                </table>
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
