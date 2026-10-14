import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { classLabel } from '../utils/classUtils';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

/**
 * School overview for the head teacher, admin and chairperson: today's attendance (learners and
 * staff), staff away, fees collected per class and this week's duties. A section the user may
 * not see is simply left out.
 */
const Icon = ({ name }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px' }} />;
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const kes = (n) => `KES ${Math.round(Number(n || 0)).toLocaleString('en-KE')}`;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const fmt = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '');
const mondayOf = (iso) => { const d = new Date(iso + 'T00:00:00'); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const rateColor = (r) => (r === null ? '#888' : r >= 90 ? '#1e7e34' : r >= 75 ? '#b8860b' : '#b02a37');

function Overview() {
    useSchoolSettings();
    const today = localToday();
    const [att, setAtt] = useState(null);
    const [staff, setStaff] = useState(null);
    const [leave, setLeave] = useState(null);
    const [fees, setFees] = useState(null);
    const [duty, setDuty] = useState(null);

    useEffect(() => {
        const get = (url, set, params) => api.get(url, params ? { params } : undefined).then(r => set(r.data)).catch(() => set(false));
        get(`/api/attendance/school-day/${today}`, setAtt);
        get('/api/staff-attendance/day', setStaff, { date: today });
        get('/api/leave/today', setLeave);
        get('/api/finance/balances', setFees);
        const mon = mondayOf(today);
        get('/api/duty/rota', setDuty, { from: mon, to: mon });
    }, [today]);

    // ── Learners ──
    const classes = att && att.classes ? att.classes.map(c => {
        const enrolled = (c.enrolledBoys || 0) + (c.enrolledGirls || 0) + (c.genderNotSet || 0);
        const present = (c.presentBoys || 0) + (c.presentGirls || 0);
        return { ...c, enrolled, present, absent: (c.absentBoys || 0) + (c.absentGirls || 0), rate: c.taken ? pct(present, enrolled) : null };
    }) : [];
    const enrolled = classes.reduce((a, c) => a + c.enrolled, 0);
    const marked = classes.filter(c => c.taken);
    const presentAll = marked.reduce((a, c) => a + c.present, 0);
    const enrolledMarked = marked.reduce((a, c) => a + c.enrolled, 0);
    const notMarked = classes.filter(c => !c.taken && c.enrolled > 0);

    // ── Staff ──
    const sc = staff && staff.counts ? staff.counts : null;
    const away = leave && leave.onLeaveToday ? leave.onLeaveToday : [];

    // ── Fees by class ──
    const feeRows = fees && fees.students ? Object.values(fees.students.reduce((m, s) => {
        const k = classLabel(s.className, s.stream) || 'No class';
        m[k] = m[k] || { name: k, billed: 0, paid: 0, balance: 0, n: 0 };
        m[k].billed += Number(s.billed || 0); m[k].paid += Number(s.paid || 0); m[k].balance += Math.max(0, Number(s.balance || 0)); m[k].n++;
        return m;
    }, {})).sort((a, b) => b.balance - a.balance) : [];
    const billed = feeRows.reduce((a, r) => a + r.billed, 0);
    const paid = feeRows.reduce((a, r) => a + r.paid, 0);
    const owed = feeRows.reduce((a, r) => a + r.balance, 0);

    // ── Duties this week ──
    const week = duty && duty.weeks && duty.weeks[0];
    const kindName = (code) => (duty && duty.kinds || []).find(k => k.code === code)?.name || code;
    const dutyList = week ? Object.entries(week.duties || {}).map(([code, people]) => ({ name: kindName(code), people: (people || []).map(p => p.fullName || p.name || '').filter(Boolean) })) : [];

    const Card = ({ value, label, color, to }) => {
        const body = <div style={{ ...st.card, borderTopColor: color || '#1F3864' }}><b style={{ color: color || '#1F3864' }}>{value}</b><span>{label}</span></div>;
        return to ? <Link to={to} style={{ textDecoration: 'none' }}>{body}</Link> : body;
    };
    const loading = att === null || fees === null;

    return (
        <div style={st.container}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="speedometer2" />School overview</h2>
                    <p style={st.sub}>{new Date(today + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    {loading && <p style={st.muted}>Loading…</p>}

                    <div style={st.cards}>
                        {att !== false && att && <Card value={enrolled} label="Learners in school" />}
                        {att !== false && att && <Card value={marked.length ? `${pct(presentAll, enrolledMarked)}%` : '—'} label={`Present today (${presentAll} of ${enrolledMarked})`} color={rateColor(pct(presentAll, enrolledMarked))} />}
                        {att !== false && att && <Card value={notMarked.length} label="Registers not marked" color={notMarked.length ? '#b02a37' : '#1e7e34'} />}
                        {sc && <Card value={`${(sc.PRESENT || 0) + (sc.LATE || 0)}`} label={`Staff in today${sc.LATE ? ` (${sc.LATE} late)` : ''}`} to="/staff?tab=attendance" />}
                        {leave !== false && leave && <Card value={away.length} label="Staff on leave today" color={away.length ? '#b8860b' : '#1e7e34'} />}
                        {fees !== false && fees && <Card value={`${pct(paid, billed) ?? 0}%`} label={`Fees collected (${kes(paid)})`} color={rateColor(pct(paid, billed))} />}
                        {fees !== false && fees && <Card value={kes(owed)} label="Fees outstanding" color={owed ? '#b02a37' : '#1e7e34'} />}
                    </div>

                    <div style={st.grid}>
                        {att !== false && att && (
                            <div style={st.panel}>
                                <h3 style={st.h3}><Icon name="calendar-check" />Attendance today — by class</h3>
                                {notMarked.length > 0 && <p style={{ ...st.muted, color: '#b02a37' }}>Not marked yet: {notMarked.map(c => classLabel(c.className, c.stream)).join(', ')}</p>}
                                <table style={st.table}><thead><tr>{['Class', 'In school', 'Present', 'Absent', 'Rate'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                                    <tbody>{classes.filter(c => c.enrolled).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)).map(c => (
                                        <tr key={c.classId}><td style={st.td}>{classLabel(c.className, c.stream)}</td><td style={st.tdN}>{c.enrolled}</td>
                                            <td style={st.tdN}>{c.taken ? c.present : '—'}</td><td style={st.tdN}>{c.taken ? c.absent : '—'}</td>
                                            <td style={{ ...st.tdN, fontWeight: 700, color: rateColor(c.rate) }}>{c.rate === null ? 'not marked' : `${c.rate}%`}</td></tr>))}</tbody></table>
                            </div>
                        )}

                        {fees !== false && fees && (
                            <div style={st.panel}>
                                <h3 style={st.h3}><Icon name="wallet2" />Fees — by class (most owed first)</h3>
                                <table style={st.table}><thead><tr>{['Class', 'Billed', 'Paid', 'Owed', '%'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                                    <tbody>{feeRows.map(r => (
                                        <tr key={r.name}><td style={st.td}>{r.name}</td><td style={st.tdN}>{kes(r.billed)}</td><td style={st.tdN}>{kes(r.paid)}</td>
                                            <td style={{ ...st.tdN, color: r.balance ? '#b02a37' : '#1e7e34' }}>{kes(r.balance)}</td>
                                            <td style={{ ...st.tdN, fontWeight: 700, color: rateColor(pct(r.paid, r.billed)) }}>{pct(r.paid, r.billed) ?? 0}%</td></tr>))}
                                        <tr><td style={{ ...st.td, fontWeight: 700 }}>All</td><td style={{ ...st.tdN, fontWeight: 700 }}>{kes(billed)}</td><td style={{ ...st.tdN, fontWeight: 700 }}>{kes(paid)}</td>
                                            <td style={{ ...st.tdN, fontWeight: 700 }}>{kes(owed)}</td><td style={{ ...st.tdN, fontWeight: 700 }}>{pct(paid, billed) ?? 0}%</td></tr></tbody></table>
                            </div>
                        )}

                        {leave !== false && leave && (
                            <div style={st.panel}>
                                <h3 style={st.h3}><Icon name="person-dash" />Staff away</h3>
                                {away.length ? away.map((r, i) => <div key={i} style={st.item}><b>{r.fullName || r.staffName}</b><span style={st.muted}>{r.typeName || r.typeCode} · until {fmt(r.endDate)}</span></div>)
                                    : <p style={st.muted}>Nobody on leave today.</p>}
                                {(leave.upcoming || []).length > 0 && <>
                                    <h4 style={st.h4}>Next 14 days</h4>
                                    {leave.upcoming.map((r, i) => <div key={i} style={st.item}><span>{r.fullName || r.staffName}</span><span style={st.muted}>{fmt(r.startDate)} – {fmt(r.endDate)}</span></div>)}
                                </>}
                                {(leave.pending || []).length > 0 && <p style={{ marginTop: '10px' }}><Link to="/staff?tab=leave" style={st.link}><Icon name="hourglass-split" />{leave.pending.length} leave request(s) waiting for approval</Link></p>}
                            </div>
                        )}

                        {duty !== false && duty && (
                            <div style={st.panel}>
                                <h3 style={st.h3}><Icon name="clipboard-check" />Duties this week{week ? ` (${fmt(week.weekStart)} – ${fmt(week.weekEnd)})` : ''}</h3>
                                {dutyList.length ? dutyList.map((d, i) => <div key={i} style={st.item}><b>{d.name}</b><span>{d.people.join(', ') || <span style={st.muted}>nobody assigned</span>}</span></div>)
                                    : <p style={st.muted}>No duty rota for this week. <Link to="/staff?tab=duty" style={st.link}>Make one</Link></p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

const st = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: 0, fontSize: '24px', fontWeight: 800 },
    sub: { color: '#666', margin: '4px 0 18px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '18px' },
    card: { display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'white', borderTop: '4px solid', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', fontSize: '12px', color: '#555', height: '100%' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '16px' },
    h4: { color: '#1F3864', margin: '12px 0 4px', fontSize: '13px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { textAlign: 'left', padding: '6px', borderBottom: '2px solid #1F3864', color: '#1F3864', fontSize: '12px' },
    td: { padding: '6px', borderBottom: '1px solid #eee' },
    tdN: { padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', whiteSpace: 'nowrap' },
    item: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    muted: { color: '#777', fontSize: '12px' },
    link: { color: '#2E75B6', fontWeight: 700 },
};

export default Overview;
