import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { letterheadHtml } from '../utils/school';
import { hasRole } from '../utils/roles';

/**
 * Staff → Attendance: the daily staff register (approved leave filled in; arrivals after the
 * reporting time become LATE) and the monthly summary.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nice = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
export const STATUS = { PRESENT: ['Present', '#1e7e34'], LATE: ['Late', '#b8860b'], ABSENT: ['Absent', '#b02a37'], ON_LEAVE: ['Leave', '#2E75B6'], OFF: ['Off', '#6c757d'] };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function StaffAttendanceTab({ setError, flash, blocked }) {
    const canEdit = hasRole('ADMIN', 'HEAD_TEACHER', 'CLERK');
    const [view, setView] = useState('day');
    const [date, setDate] = useState(today());
    const [day, setDay] = useState(null);
    const [rows, setRows] = useState([]);
    const [dirty, setDirty] = useState(false);
    const load = useCallback(() => api.get('/api/staff-attendance/day', { params: { date } })
        .then(r => { setDay(r.data); setRows(r.data.rows.map(x => ({ ...x, timeIn: x.timeIn || '', timeOut: x.timeOut || '', note: x.note || '' }))); setDirty(false); })
        .catch(err => setError(serverMessage(err, 'Could not load the register.'))), [date, setError]);
    useEffect(() => { if (view === 'day') load(); }, [load, view]);
    const set = (i, p) => { setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r))); setDirty(true); };
    const allPresent = () => { setRows(rs => rs.map(r => (r.status ? r : { ...r, status: 'PRESENT' }))); setDirty(true); };
    const save = async () => {
        try {
            const r = await api.put('/api/staff-attendance/day', { date, rows: rows.map(x => ({ staffId: x.staffId, status: x.status, timeIn: x.timeIn || null, timeOut: x.timeOut || null, note: x.note || null })) });
            flash(r.data.message); load();
        } catch (err) { setError(serverMessage(err, 'Could not save the register.')); }
    };
    const marked = rows.filter(r => r.status).length;
    const isFuture = date > today();

    return (
        <div>
            <div style={st.tabs}>
                {[['day', 'calendar-check', 'Daily register'], ['month', 'calendar3', 'Monthly summary']].map(([k, ic, l]) => (
                    <button key={k} type="button" onClick={() => setView(k)} style={{ ...st.tab, backgroundColor: view === k ? '#1F3864' : 'white', color: view === k ? 'white' : '#1F3864' }}><Icon name={ic} />{l}</button>))}
            </div>
            {view === 'month' ? <MonthSummary setError={setError} blocked={blocked} /> : (
                <div style={st.panel}>
                    <div style={st.bar}>
                        <input type="date" style={st.input} value={date} max={today()} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Date" />
                        <b style={{ color: '#1F3864' }}>{nice(date)}</b>
                        {day && <span style={st.muted}>· late after {day.lateAfter} · {marked} of {rows.length} marked</span>}
                        {canEdit && <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            <button type="button" onClick={allPresent} disabled={isFuture} style={st.secondary}><Icon name="check2-all" />Mark everyone else present</button>
                            <button type="button" onClick={save} disabled={!dirty || isFuture} style={{ ...st.primary, opacity: dirty ? 1 : 0.5 }}><Icon name="save-fill" />Save register</button></span>}
                    </div>
                    {day && (day.weekend || day.holiday) && <p style={st.warn}><Icon name="info-circle-fill" />{day.holiday ? `${day.holiday} — a public holiday.` : 'A weekend day.'} Only mark staff who were expected in.</p>}
                    <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                        <table style={st.table}>
                            <thead><tr>{['Name', 'Status', 'Time in', 'Time out', 'Note'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                            <tbody>{rows.map((r, i) => (
                                <tr key={r.staffId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={st.td}><b>{r.fullName}</b><div style={st.small}>{r.jobTitle}{r.leave ? <span style={{ color: '#2E75B6' }}> · {r.leave}</span> : null}</div></td>
                                    <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                        {Object.entries(STATUS).map(([k, [l, c]]) => (
                                            <button key={k} type="button" disabled={!canEdit || isFuture} onClick={() => set(i, { status: r.status === k ? null : k })} aria-pressed={r.status === k}
                                                style={{ ...st.status, borderColor: c, backgroundColor: r.status === k ? c : 'white', color: r.status === k ? 'white' : c }}>{l}</button>))}
                                    </td>
                                    <td style={st.td}><input type="time" style={{ ...st.input, width: '105px' }} disabled={!canEdit || ['ABSENT', 'ON_LEAVE', 'OFF'].includes(r.status)} value={r.timeIn} onChange={e => set(i, { timeIn: e.target.value, status: r.status || 'PRESENT' })} aria-label={`Time in for ${r.fullName}`} /></td>
                                    <td style={st.td}><input type="time" style={{ ...st.input, width: '105px' }} disabled={!canEdit || ['ABSENT', 'ON_LEAVE', 'OFF'].includes(r.status)} value={r.timeOut} onChange={e => set(i, { timeOut: e.target.value })} aria-label={`Time out for ${r.fullName}`} /></td>
                                    <td style={st.td}><input style={{ ...st.input, width: '100%', boxSizing: 'border-box' }} maxLength={150} disabled={!canEdit} value={r.note} onChange={e => set(i, { note: e.target.value })} aria-label={`Note for ${r.fullName}`} /></td>
                                </tr>))}</tbody>
                        </table>
                    </div>
                    <p style={{ ...st.muted, marginBottom: 0 }}>Anyone marked present with a time in after {day?.lateAfter || 'the reporting time'} is saved as late. Staff with a login can also sign in and out themselves on <b>My Leave &amp; Duty</b>.</p>
                </div>
            )}
        </div>
    );
}

function MonthSummary({ setError, blocked }) {
    const now = new Date();
    const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [data, setData] = useState(null);
    useEffect(() => { setData(null); api.get('/api/staff-attendance/month', { params: ym }).then(r => setData(r.data)).catch(err => setError(serverMessage(err, 'Could not load the summary.'))); }, [ym, setError]);
    const cols = [['PRESENT', 'Present'], ['LATE', 'Late'], ['ABSENT', 'Absent'], ['ON_LEAVE', 'Leave'], ['OFF', 'Off'], ['NOT_MARKED', 'Not marked']];
    const print = () => {
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Staff attendance</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:12px}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px 7px}th{background:#1F3864;color:#fff}td.n{text-align:center}h2{text-align:center;color:#1F3864}
            .bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold}@media print{.bar{display:none}}</style></head><body>
            <div class="bar"><b>Staff attendance</b><button onclick="window.print()">Print / Save PDF</button></div>${letterheadHtml({ logoSize: 44 })}
            <h2>STAFF ATTENDANCE — ${esc(MONTHS[ym.month - 1].toUpperCase())} ${ym.year} (${data.workingDays} working days)</h2>
            <table><tr><th>Name</th><th>Days</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr>
            ${data.rows.map(r => `<tr><td>${esc(r.fullName)}</td><td class="n">${r.workingDays}</td>${cols.map(([k]) => `<td class="n">${r.counts[k] || ''}</td>`).join('')}</tr>`).join('')}</table>
            <p style="margin-top:24px">Head teacher: ______________________ &nbsp; Date: ______________</p></body></html>`);
        w.document.close(); w.focus();
    };
    return (
        <div style={st.panel}>
            <div style={st.bar}>
                <select style={st.input} value={ym.month} onChange={e => setYm(x => ({ ...x, month: Number(e.target.value) }))} aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
                <select style={st.input} value={ym.year} onChange={e => setYm(x => ({ ...x, year: Number(e.target.value) }))} aria-label="Year">{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
                {data && <span style={st.muted}>{data.workingDays} working day(s) so far (weekends and public holidays left out)</span>}
                {data && <button type="button" onClick={print} style={{ ...st.secondary, marginLeft: 'auto' }}><Icon name="printer" />Print</button>}
            </div>
            {!data ? <p style={st.muted}>Loading…</p> : (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                    <table style={st.table}>
                        <thead><tr><th style={st.th}>Name</th><th style={st.thC}>Days</th>{cols.map(([k, l]) => <th key={k} style={st.thC}>{l}</th>)}</tr></thead>
                        <tbody>{data.rows.map((r, i) => (
                            <tr key={r.staffId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                <td style={st.td}><b>{r.fullName}</b><div style={st.small}>{r.jobTitle}</div></td><td style={st.tdC}>{r.workingDays}</td>
                                {cols.map(([k]) => <td key={k} style={{ ...st.tdC, color: (STATUS[k] || [null, '#999'])[1], fontWeight: r.counts[k] ? 700 : 400 }}>{r.counts[k] || ''}</td>)}
                            </tr>))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const st = {
    tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
    tab: { padding: '8px 12px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    input: { padding: '7px 9px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', color: '#222', backgroundColor: 'white', minWidth: 0 },
    primary: { padding: '9px 14px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    status: { border: '1.5px solid', borderRadius: '12px', padding: '3px 8px', marginRight: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
    warn: { backgroundColor: '#fff8e1', color: '#8a6d00', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', margin: '10px 0 0' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '720px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    thC: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'center', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    tdC: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'center' },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};
