import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { fmtDate, printLeaveForm, useDayCount, LeaveDates } from './StaffLeave';

/** My Leave: a staff member's own balances, applications, and applying for leave. */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const STATUS = { PENDING: ['Waiting for approval', '#b8860b'], APPROVED: ['Approved', '#1e7e34'], REJECTED: ['Not approved', '#b02a37'], CANCELLED: ['Cancelled', '#6c757d'] };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function MyLeave() {
    const [data, setData] = useState(null);
    const [notLinked, setNotLinked] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const load = useCallback(() => api.get('/api/leave/mine').then(r => { setData(r.data); setNotLinked(''); })
        .catch(err => (err?.response?.status === 400 ? setNotLinked(serverMessage(err, '')) : setError(serverMessage(err, 'Could not load your leave.')))), []);
    useEffect(() => { load(); }, [load]);
    const count = useDayCount('/api/leave/mine/days', form?.typeCode, form?.startDate, form?.endDate);
    const bal = form && data ? data.balances.find(b => b.typeCode === form.typeCode) : null;
    const blocked = () => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');

    const apply = async (e) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/leave/mine', { ...form, reliefStaffId: form.reliefStaffId ? Number(form.reliefStaffId) : null,
                startTime: form.startTime || null, endTime: form.endTime || null, otherName: form.otherName || null });
            setSuccess(r.data.message); setTimeout(() => setSuccess(''), 5000); setForm(null); await load();
        } catch (err) { setError(serverMessage(err, 'Could not send the application.')); }
        setSaving(false);
    };
    const cancel = async (r) => {
        if (!window.confirm(`Cancel your ${(r.label || r.typeName).toLowerCase()} (${fmtDate(r.startDate)}${r.startTime ? ` ${r.startTime}–${r.endTime}` : ` – ${fmtDate(r.endDate)}`})?`)) return;
        try { const x = await api.post(`/api/leave/mine/${r.leaveId}/cancel`); setSuccess(x.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Could not cancel.')); }
    };
    const balText = (b) => (b.unit === 'hours' ? `${b.taken} hour(s) taken` : b.entitled === null ? `${b.taken} day(s) taken` : `${b.left} of ${b.entitled + b.carried} day(s) left`);

    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="calendar2-heart-fill" style={{ marginRight: '10px' }} />My Leave &amp; Duty</h2>
                    <p style={st.subtitle}>Sign in for the day, your duties, and your leave{data ? ` — ${data.year}` : ''}.</p>
                    <TodayCard setError={setError} />
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}
                    {notLinked && <div style={st.panel}><p style={{ margin: 0, color: '#856404' }}><Icon name="info-circle-fill" />{notLinked}</p></div>}
                    {data && (
                        <>
                            <div style={st.cards}>
                                {data.balances.map(b => (
                                    <div key={b.typeCode} style={{ ...st.card, borderTopColor: b.left !== null && b.left <= 0 ? '#b02a37' : '#1F3864' }}>
                                        <b>{b.entitled === null ? b.taken : b.left}</b><span>{b.typeName}</span>
                                        <small>{balText(b)}{b.pending ? ` · ${b.pending} waiting` : ''}</small>
                                    </div>
                                ))}
                            </div>
                            {!form ? (
                                <button type="button" onClick={() => setForm({ typeCode: data.types[0]?.code || 'ANNUAL', startDate: '', endDate: '', startTime: '', endTime: '', otherName: '', reason: '', reliefStaffId: '', contactWhileAway: '' })} style={{ ...st.primary, marginBottom: '12px' }}>
                                    <Icon name="calendar-plus" />Apply for leave</button>
                            ) : (
                                <form onSubmit={apply} style={st.panel}>
                                    <h3 style={st.h3}><Icon name="calendar-plus" />Apply for leave</h3>
                                    <div style={st.grid}>
                                        <label style={st.lbl}>Kind of leave<select style={st.input} value={form.typeCode} onChange={e => setForm(f => ({ ...f, typeCode: e.target.value }))}>{data.types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select></label>
                                        <LeaveDates f={form} set={(p) => setForm(f => ({ ...f, ...p }))} kind={data.types.find(t => t.code === form.typeCode)} />
                                        <label style={st.lbl}>Who will cover your work (optional)<select style={st.input} value={form.reliefStaffId} onChange={e => setForm(f => ({ ...f, reliefStaffId: e.target.value }))}><option value="">—</option>{data.colleagues.map(c => <option key={c.staffId} value={c.staffId}>{c.fullName}</option>)}</select></label>
                                        <label style={st.lbl}>Contact while away<input style={st.input} maxLength={100} value={form.contactWhileAway} onChange={e => setForm(f => ({ ...f, contactWhileAway: e.target.value }))} /></label>
                                        <label style={{ ...st.lbl, gridColumn: '1 / -1' }}>Reason<input style={st.input} maxLength={300} required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></label>
                                    </div>
                                    {count && !data.types.find(t => t.code === form.typeCode)?.byHours && <p style={st.count}><Icon name="calendar3" />{count.days} {count.workingDays ? 'working' : 'calendar'} day(s)
                                        {count.holidaysSkipped.length ? ` (public holidays skipped: ${count.holidaysSkipped.join(', ')})` : ''}
                                        {bal && bal.entitled !== null && <> · you would have <b style={{ color: bal.left - bal.pending - count.days < 0 ? '#b02a37' : '#1e7e34' }}>{bal.left - bal.pending - count.days}</b> day(s) left</>}</p>}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                        <button type="button" onClick={() => setForm(null)} style={st.secondary}>Cancel</button>
                                        <button type="submit" disabled={saving} style={st.primary}><Icon name={saving ? 'hourglass-split' : 'send-fill'} />{saving ? 'Sending…' : 'Send application'}</button>
                                    </div>
                                </form>
                            )}
                            <div style={st.panel}>
                                <h3 style={st.h3}><Icon name="list-ul" />My applications</h3>
                                {!data.requests.length ? <p style={{ color: '#777', margin: 0 }}>None yet.</p> : data.requests.map(r => { const [l, c] = STATUS[r.status] || [r.status, '#666']; return (
                                    <div key={r.leaveId} style={st.item}>
                                        <span style={{ flex: 1, minWidth: '200px' }}><b>{r.label || r.typeName}</b> · {r.amount || `${r.days} day(s)`}<div style={st.small}>{fmtDate(r.startDate)}{r.startTime ? '' : ` – ${fmtDate(r.endDate)}`}{r.reason ? ` · ${r.reason}` : ''}</div>
                                            {r.decisionNote && <div style={st.small}>Note: {r.decisionNote}</div>}</span>
                                        <span style={{ ...st.pill, backgroundColor: c }}>{l}</span>
                                        <button type="button" onClick={() => printLeaveForm(r, null, blocked)} style={st.link} title="Print the leave form"><i className="bi bi-printer" aria-label="Print" /></button>
                                        {(r.status === 'PENDING' || (r.status === 'APPROVED' && r.startDate > today())) && <button type="button" onClick={() => cancel(r)} style={{ ...st.link, color: '#b02a37' }}>Cancel</button>}
                                    </div>); })}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

const st = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 14px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '4px solid', borderRadius: '8px', padding: '10px 12px', backgroundColor: 'white', fontSize: '12px', color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '16px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    count: { backgroundColor: '#eef3fb', color: '#1F3864', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', fontWeight: 600, margin: '10px 0 0' },
    item: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    pill: { color: 'white', borderRadius: '10px', padding: '2px 9px', fontSize: '11px', fontWeight: 700 },
    small: { fontSize: '11px', color: '#888' },
};

/** Today's sign-in / sign-out and my duties for the coming weeks. */
function TodayCard({ setError }) {
    const [me, setMe] = useState(null);
    const [duties, setDuties] = useState([]);
    const [msg, setMsg] = useState('');
    const load = useCallback(() => {
        api.get('/api/staff-attendance/mine').then(r => setMe(r.data)).catch(() => setMe(null));
        api.get('/api/duty/mine').then(r => setDuties(r.data || [])).catch(() => setDuties([]));
    }, []);
    useEffect(() => { load(); }, [load]);
    const act = async (what) => {
        try { const r = await api.post(`/api/staff-attendance/mine/${what}`); setMsg(r.data.message); load(); }
        catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    if (!me || !me.linked) return null;
    const week = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div style={st.panel}>
                <h3 style={st.h3}><Icon name="clock-history" />Today</h3>
                {me.timeIn ? <p style={{ margin: '0 0 8px' }}>Signed in at <b>{me.timeIn}</b>{me.status === 'LATE' ? <span style={{ color: '#b8860b' }}> (late)</span> : null}{me.timeOut ? <> · signed out at <b>{me.timeOut}</b></> : null}</p>
                    : <p style={{ margin: '0 0 8px', color: '#777' }}>Not signed in yet (reporting time {me.lateAfter}).</p>}
                {!me.timeIn && <button type="button" onClick={() => act('sign-in')} style={st.primary}><Icon name="box-arrow-in-right" />Sign in now</button>}
                {me.timeIn && !me.timeOut && <button type="button" onClick={() => act('sign-out')} style={st.secondary}><Icon name="box-arrow-right" />Sign out</button>}
                {msg && <p style={{ ...st.small, color: '#1e7e34', margin: '8px 0 0' }}>{msg}</p>}
            </div>
            <div style={st.panel}>
                <h3 style={st.h3}><Icon name="shield-check" />My duties</h3>
                {duties.length ? duties.map((d, i) => <div key={i} style={{ fontSize: '13px', padding: '2px 0' }}><b>{d.duty}</b> — week of {week(d.weekStart)} – {week(d.weekEnd)}</div>)
                    : <p style={{ margin: 0, color: '#777', fontSize: '13px' }}>No duties in the next 8 weeks.</p>}
            </div>
        </div>
    );
}

export default MyLeave;
