import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { letterheadHtml } from '../utils/school';
import { hasRole } from '../utils/roles';

/**
 * Staff → Leave (the office): approvals, who is away, record leave for anyone (e.g. support staff
 * without a login), all applications, balances, and the leave types / public holidays.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const STATUS = { PENDING: ['Waiting', '#b8860b'], APPROVED: ['Approved', '#1e7e34'], REJECTED: ['Not approved', '#b02a37'], CANCELLED: ['Cancelled', '#6c757d'] };
const thisYear = new Date().getFullYear();

/** The printed leave application / approval form (used by the office and by "My Leave"). */
export const printLeaveForm = (r, balance, onBlocked) => {
    const row = (l, v) => `<tr><td class="l">${esc(l)}</td><td>${esc(v || '—')}</td></tr>`;
    const w = window.open('', '_blank');
    if (!w) { onBlocked?.(); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Leave form — ${esc(r.fullName)}</title><style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:14px;max-width:760px}table{width:100%;border-collapse:collapse;margin-bottom:10px}td{border:1px solid #bbb;padding:6px 8px}
        td.l{width:35%;background:#f4f6fa;font-weight:bold}h2{text-align:center;color:#1F3864;margin:8px 0 12px}.sig{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
        .sig div{border-top:1px solid #000;padding-top:4px}.bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between;margin-bottom:8px}
        .bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold;cursor:pointer}@media print{.bar{display:none}}</style></head><body>
        <div class="bar"><b>Leave form</b><button onclick="window.print()">Print / Save PDF</button></div>${letterheadHtml({ logoSize: 44 })}
        <h2>STAFF LEAVE APPLICATION</h2>
        <table>${row('Name', r.fullName)}${row('Staff number', r.staffNumber)}${row('Position', r.jobTitle)}${row('Kind of leave', r.label || r.typeName)}
            ${r.startTime ? row('Day', fmtDate(r.startDate)) + row('Time out – back', `${r.startTime} – ${r.endTime}`) + row('Hours', String(Number(r.hours))) : row('From', fmtDate(r.startDate)) + row('To (last day)', fmtDate(r.endDate)) + row('Days', `${r.days}`)}${row('Reason', r.reason)}
            ${row('Work covered by', r.reliefName)}${row('Contact while away', r.contactWhileAway)}
            ${balance ? row(`Balance (${new Date(`${r.startDate}T00:00:00`).getFullYear()})`, balance) : ''}
            ${row('Status', (STATUS[r.status] || [r.status])[0] + (r.decidedBy ? ` — ${r.decidedBy}` : '') + (r.decisionNote ? ` (${r.decisionNote})` : ''))}</table>
        <div class="sig"><div>Applicant's signature &amp; date</div><div>Head of section</div><div>Head teacher — approved / not approved</div><div>Date</div></div></body></html>`);
    w.document.close(); w.focus();
};

export default function StaffLeave({ staff, setError, flash, blocked }) {
    const canEdit = hasRole('ADMIN');
    const canApprove = hasRole('ADMIN', 'HEAD_TEACHER');   // the head teacher (role ticked in Users) or an admin
    const [listKey, setListKey] = useState(0);              // reloads "All applications" after a decision
    const [view, setView] = useState('today');
    const [today, setToday] = useState(null);
    const [types, setTypes] = useState([]);
    const loadToday = useCallback(() => api.get('/api/leave/today').then(r => setToday(r.data)).catch(err => setError(serverMessage(err, 'Could not load leave.'))), [setError]);
    const loadTypes = useCallback(() => api.get('/api/leave/types').then(r => setTypes(r.data || [])).catch(() => {}), []);
    useEffect(() => { loadToday(); loadTypes(); }, [loadToday, loadTypes]);

    const decide = async (r, approve) => {
        let note = null;
        if (!approve) {
            note = window.prompt(`Not approve ${r.fullName}'s ${(r.label || r.typeName).toLowerCase()} (${fmtDate(r.startDate)}${r.startTime ? ` ${r.startTime}–${r.endTime}` : ` – ${fmtDate(r.endDate)}`})?\n\nReason:`);
            if (note === null) return;
            if (note.trim().length < 3) { setError('Say why the leave is not approved.'); return; }
        }
        let otherName = null;
        if (approve && types.find(t => t.code === r.typeCode)?.specify) {
            // "Other" leave: HR confirms or specifies what it is recorded as
            otherName = window.prompt(`Approve ${r.fullName}'s leave: ${r.amount}, ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}.\n\nRecord it as (HR to specify):`, r.otherName || '');
            if (otherName === null) return;
            if (otherName.trim().length < 3) { setError('Say what the leave is recorded as.'); return; }
        } else if (approve && !window.confirm(`Approve ${r.fullName}'s ${(r.label || r.typeName).toLowerCase()}: ${r.amount || `${r.days} day(s)`}, ${fmtDate(r.startDate)}${r.startTime ? '' : ` – ${fmtDate(r.endDate)}`}?`)) return;
        try { const x = await api.post(`/api/leave/requests/${r.leaveId}/${approve ? 'approve' : 'reject'}`, { note, otherName }); flash(x.data.message); await loadToday(); setListKey(k => k + 1); }
        catch (err) { setError(serverMessage(err, 'Could not save the decision.')); }
    };
    const row = (r, actions) => (
        <div key={r.leaveId} style={st.item}>
            <span style={{ flex: 1, minWidth: '220px' }}><b>{r.fullName}</b> · {r.label || r.typeName} · <b>{r.amount || `${r.days} day(s)`}</b>
                <div style={st.small}>{fmtDate(r.startDate)}{r.startTime ? '' : ` – ${fmtDate(r.endDate)}`}{r.reason ? ` · ${r.reason}` : ''}{r.reliefName ? ` · covered by ${r.reliefName}` : ''}</div></span>
            {actions}
            <button type="button" onClick={() => printLeaveForm(r, null, blocked)} style={st.link} title="Print the leave form"><i className="bi bi-printer" aria-label="Print" /></button>
        </div>
    );

    return (
        <div>
            <p style={{ ...st.muted, margin: '0 0 10px' }}><Icon name="info-circle" />Leave is approved by the <b>head teacher</b> (role ticked on Users → Roles) or an <b>admin</b>. Nobody approves their own leave.</p>
            <div style={st.tabs}>
                {[['today', 'calendar-check', `Approvals & who's away${today?.pending?.length ? ` (${today.pending.length})` : ''}`], ['record', 'calendar-plus', 'Record leave'], ['list', 'list-ul', 'All applications'],
                  ['balances', 'speedometer2', 'Balances'], ['settings', 'gear', 'Leave types & holidays']].filter(([k]) => canEdit || (k !== 'record' && k !== 'settings')).map(([k, ic, l]) => (
                    <button key={k} type="button" onClick={() => setView(k)} style={{ ...st.tab, backgroundColor: view === k ? '#1F3864' : 'white', color: view === k ? 'white' : '#1F3864' }}><Icon name={ic} />{l}</button>
                ))}
            </div>

            {view === 'today' && today && (
                <>
                    <div style={st.panel}>
                        <h4 style={st.h4}><Icon name="hourglass-split" />Waiting for approval ({today.pending.length})</h4>
                        {today.pending.length ? today.pending.map(r => row(r, canApprove && <>
                            <button type="button" onClick={() => decide(r, true)} style={{ ...st.link, color: '#1e7e34' }}><Icon name="check-circle-fill" />Approve</button>
                            <button type="button" onClick={() => decide(r, false)} style={{ ...st.link, color: '#b02a37' }}><Icon name="x-circle-fill" />Not approve</button>
                        </>)) : <p style={st.muted}>Nothing waiting.</p>}
                    </div>
                    <div style={st.panel}>
                        <h4 style={st.h4}><Icon name="person-dash" />On leave today ({today.onLeaveToday.length})</h4>
                        {today.onLeaveToday.length ? today.onLeaveToday.map(r => row(r, null)) : <p style={st.muted}>Everyone is in.</p>}
                        <h4 style={{ ...st.h4, marginTop: '14px' }}><Icon name="calendar-week" />Starting in the next 14 days ({today.upcoming.length})</h4>
                        {today.upcoming.length ? today.upcoming.map(r => row(r, null)) : <p style={st.muted}>None.</p>}
                    </div>
                </>
            )}
            {view === 'record' && <RecordLeave staff={staff} types={types} setError={setError} flash={flash} done={() => { loadToday(); setView('today'); }} />}
            {view === 'list' && <Applications key={listKey} setError={setError} flash={flash} blocked={blocked} canEdit={canEdit} canApprove={canApprove} decide={decide} />}
            {view === 'balances' && <Balances setError={setError} blocked={blocked} />}
            {view === 'settings' && <LeaveSettings types={types} reload={loadTypes} setError={setError} flash={flash} />}
        </div>
    );
}

/**
 * The dates part of a leave form: a day + time out/back for short permission (hours), first/last day
 * otherwise, and "What is it for?" when the kind asks the applicant to specify (Other).
 */
export function LeaveDates({ f, set, kind }) {
    const hours = (() => {
        if (!f.startTime || !f.endTime || f.endTime <= f.startTime) return null;
        const [a, b] = [f.startTime, f.endTime].map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
        return Math.round((b - a) / 15) / 4;
    })();
    return (
        <>
            {kind?.byHours ? <>
                <label style={st.lbl}>Day<input type="date" style={st.input} required value={f.startDate} onChange={e => set({ startDate: e.target.value, endDate: e.target.value })} /></label>
                <label style={st.lbl}>Time out<input type="time" style={st.input} required value={f.startTime} onChange={e => set({ startTime: e.target.value })} /></label>
                <label style={st.lbl}>Time back{hours !== null && <span style={{ fontWeight: 'normal', color: '#1e7e34' }}> — {hours} hour(s)</span>}
                    <input type="time" style={st.input} required min={f.startTime} value={f.endTime} onChange={e => set({ endTime: e.target.value })} /></label>
            </> : <>
                <label style={st.lbl}>First day<input type="date" style={st.input} required value={f.startDate} onChange={e => set({ startDate: e.target.value, endDate: f.endDate && f.endDate < e.target.value ? e.target.value : f.endDate, startTime: '', endTime: '' })} /></label>
                <label style={st.lbl}>Last day<input type="date" style={st.input} required min={f.startDate} value={f.endDate} onChange={e => set({ endDate: e.target.value })} /></label>
            </>}
            {kind?.specify && <label style={{ ...st.lbl, gridColumn: '1 / -1' }}>What is it for? (HR will confirm)<input style={st.input} required maxLength={80} value={f.otherName}
                placeholder="e.g. family wedding, sitting an exam, school-approved personal engagement" onChange={e => set({ otherName: e.target.value })} /></label>}
        </>
    );
}

/** A live count of the days a leave will use (weekends and public holidays skipped for working-day leave). */
export function useDayCount(url, type, start, end) {
    const [count, setCount] = useState(null);
    useEffect(() => {
        setCount(null);
        if (!type || !start || !end || end < start) return undefined;
        const t = setTimeout(() => api.get(url, { params: { type, start, end } }).then(r => setCount(r.data)).catch(() => {}), 250);
        return () => clearTimeout(t);
    }, [url, type, start, end]);
    return count;
}

function RecordLeave({ staff, types, setError, flash, done }) {
    const [f, setF] = useState({ staffId: '', typeCode: 'ANNUAL', startDate: '', endDate: '', startTime: '', endTime: '', otherName: '', reason: '', reliefStaffId: '', contactWhileAway: '', approveNow: true });
    const set = (p) => setF(x => ({ ...x, ...p }));
    const count = useDayCount('/api/leave/days', f.typeCode, f.startDate, f.endDate);
    const active = (staff || []).filter(s => s.active);
    const save = async (e) => {
        e.preventDefault();
        try {
            const r = await api.post('/api/leave/requests', { ...f, staffId: Number(f.staffId), reliefStaffId: f.reliefStaffId ? Number(f.reliefStaffId) : null,
                startTime: f.startTime || null, endTime: f.endTime || null, otherName: f.otherName || null });
            flash(r.data.message); done();
        } catch (err) { setError(serverMessage(err, 'Could not record the leave.')); }
    };
    return (
        <form onSubmit={save} style={st.panel}>
            <p style={{ ...st.muted, marginTop: 0 }}>Record leave for anyone — e.g. support staff without a login. Teachers can also apply themselves on <b>My Leave</b>.</p>
            <div style={st.grid}>
                <label style={st.lbl}>Staff member<select style={st.input} required value={f.staffId} onChange={e => set({ staffId: e.target.value })}><option value="">— choose —</option>{active.map(s => <option key={s.staffId} value={s.staffId}>{s.fullName} ({s.staffNumber})</option>)}</select></label>
                <label style={st.lbl}>Kind of leave<select style={st.input} value={f.typeCode} onChange={e => set({ typeCode: e.target.value })}>{types.filter(t => t.active).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select></label>
                <LeaveDates f={f} set={set} kind={types.find(t => t.code === f.typeCode)} />
                <label style={st.lbl}>Work covered by (optional)<select style={st.input} value={f.reliefStaffId} onChange={e => set({ reliefStaffId: e.target.value })}><option value="">—</option>{active.filter(s => String(s.staffId) !== f.staffId).map(s => <option key={s.staffId} value={s.staffId}>{s.fullName}</option>)}</select></label>
                <label style={st.lbl}>Contact while away<input style={st.input} maxLength={100} value={f.contactWhileAway} onChange={e => set({ contactWhileAway: e.target.value })} /></label>
                <label style={{ ...st.lbl, gridColumn: '1 / -1' }}>Reason<input style={st.input} maxLength={300} value={f.reason} onChange={e => set({ reason: e.target.value })} /></label>
            </div>
            {count && !types.find(t => t.code === f.typeCode)?.byHours && <p style={st.count}><Icon name="calendar3" />{count.days} {count.workingDays ? 'working' : 'calendar'} day(s){count.holidaysSkipped.length ? ` — public holidays skipped: ${count.holidaysSkipped.join(', ')}` : ''}</p>}
            <div style={{ ...st.bar, justifyContent: 'space-between', marginTop: '10px' }}>
                <label style={st.check}><input type="checkbox" checked={f.approveNow} onChange={e => set({ approveNow: e.target.checked })} />Approved now</label>
                <button type="submit" style={st.primary}><Icon name="save-fill" />Record leave</button>
            </div>
        </form>
    );
}

function Applications({ setError, flash, blocked, canEdit, canApprove, decide }) {
    const [year, setYear] = useState(thisYear);
    const [status, setStatus] = useState('');
    const [list, setList] = useState(null);
    const load = useCallback(() => api.get('/api/leave/requests', { params: { from: `${year}-01-01`, to: `${year}-12-31`, status: status || undefined } })
        .then(r => setList(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load the applications.'))), [year, status, setError]);
    useEffect(() => { load(); }, [load]);
    const cancel = async (r) => {
        const note = window.prompt(`Cancel ${r.fullName}'s ${r.typeName.toLowerCase()} (${fmtDate(r.startDate)} – ${fmtDate(r.endDate)})? The days go back to the balance.\n\nReason:`);
        if (note === null) return;
        try { const x = await api.post(`/api/leave/requests/${r.leaveId}/cancel`, { note }); flash(x.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Could not cancel.')); }
    };
    const printRegister = () => {
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Leave register ${year}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:12px}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px}th{background:#1F3864;color:#fff;text-align:left}h2{text-align:center;color:#1F3864}
            .bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold}@media print{.bar{display:none}@page{size:A4 landscape;margin:10mm}}</style></head><body>
            <div class="bar"><b>Leave register</b><button onclick="window.print()">Print / Save PDF</button></div>${letterheadHtml({ logoSize: 44 })}<h2>STAFF LEAVE REGISTER — ${year}</h2>
            <table><tr><th>Name</th><th>Leave</th><th>From</th><th>To</th><th>Days / hours</th><th>Reason</th><th>Covered by</th><th>Status</th><th>By</th></tr>
            ${list.map(r => `<tr><td>${esc(r.fullName)}</td><td>${esc(r.label || r.typeName)}</td><td>${esc(fmtDate(r.startDate))}${r.startTime ? ` ${esc(r.startTime)}` : ''}</td><td>${r.startTime ? esc(r.endTime) : esc(fmtDate(r.endDate))}</td><td>${r.hours ? `${Number(r.hours)} h` : r.days}</td><td>${esc(r.reason || '')}</td><td>${esc(r.reliefName || '')}</td><td>${esc((STATUS[r.status] || [r.status])[0])}</td><td>${esc(r.decidedBy || '')}</td></tr>`).join('')}</table></body></html>`);
        w.document.close(); w.focus();
    };
    return (
        <div style={st.panel}>
            <div style={st.bar}>
                <select style={st.input} value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">{[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map(y => <option key={y} value={y}>{y}</option>)}</select>
                <select style={st.input} value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="">All</option>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
                {list && <button type="button" onClick={printRegister} style={{ ...st.secondary, marginLeft: 'auto' }}><Icon name="printer" />Leave register</button>}
            </div>
            {!list ? <p style={st.muted}>Loading…</p> : !list.length ? <p style={st.muted}>No leave for {year}.</p> : (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                    <table style={st.table}>
                        <thead><tr>{['Name', 'Leave', 'Dates', 'Days', 'Status', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                        <tbody>{list.map((r, i) => { const [l, c] = STATUS[r.status] || [r.status, '#666']; return (
                            <tr key={r.leaveId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                <td style={st.td}><b>{r.fullName}</b><div style={st.small}>{r.reason}</div></td><td style={st.td}>{r.label || r.typeName}</td>
                                <td style={st.td}>{fmtDate(r.startDate)}{r.startTime ? ` ${r.startTime}–${r.endTime}` : ` – ${fmtDate(r.endDate)}`}</td><td style={st.td}>{r.hours ? `${Number(r.hours)} h` : r.days}</td>
                                <td style={st.td}><span style={{ ...st.pill, backgroundColor: c }}>{l}</span>{r.decisionNote && <div style={st.small}>{r.decisionNote}</div>}</td>
                                <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                    <button type="button" onClick={() => printLeaveForm(r, null, blocked)} style={st.link}><i className="bi bi-printer" aria-label="Print" /></button>
                                    {canApprove && r.status === 'PENDING' && <><button type="button" onClick={() => decide(r, true)} style={{ ...st.link, color: '#1e7e34' }}>Approve</button><button type="button" onClick={() => decide(r, false)} style={{ ...st.link, color: '#b02a37' }}>Not approve</button></>}
                                    {canEdit && (r.status === 'PENDING' || r.status === 'APPROVED') && <button type="button" onClick={() => cancel(r)} style={{ ...st.link, color: '#b02a37' }}>Cancel</button>}
                                </td>
                            </tr>); })}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Balances({ setError, blocked }) {
    const [year, setYear] = useState(thisYear);
    const [rows, setRows] = useState(null);
    useEffect(() => { setRows(null); api.get('/api/leave/balances', { params: { year } }).then(r => setRows(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load balances.'))); }, [year, setError]);
    const types = rows && rows[0] ? rows[0].balances.map(b => ({ code: b.typeCode, name: b.typeName })) : [];
    const cell = (b) => (!b.applies ? '—' : b.unit === 'hours' ? `${b.taken} h taken` : b.entitled === null ? `${b.taken} taken` : `${b.left} of ${b.entitled + b.carried}`);
    const print = () => {
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Leave balances ${year}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:12px}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px}th{background:#1F3864;color:#fff}td.n{text-align:center}h2{text-align:center;color:#1F3864}
            .bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold}@media print{.bar{display:none}@page{size:A4 landscape;margin:10mm}}</style></head><body>
            <div class="bar"><b>Leave balances</b><button onclick="window.print()">Print / Save PDF</button></div>${letterheadHtml({ logoSize: 44 })}<h2>LEAVE BALANCES — ${year} (days left of days allowed)</h2>
            <table><tr><th>Name</th>${types.map(t => `<th>${esc(t.name)}</th>`).join('')}</tr>${rows.map(r => `<tr><td>${esc(r.fullName)}</td>${r.balances.map(b => `<td class="n">${esc(cell(b))}</td>`).join('')}</tr>`).join('')}</table></body></html>`);
        w.document.close(); w.focus();
    };
    return (
        <div style={st.panel}>
            <div style={st.bar}>
                <select style={st.input} value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">{[thisYear + 1, thisYear, thisYear - 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
                <span style={st.muted}>Days left of days allowed (allowed includes any carried over). Pending applications are not yet taken off.</span>
                {rows && rows.length > 0 && <button type="button" onClick={print} style={{ ...st.secondary, marginLeft: 'auto' }}><Icon name="printer" />Print</button>}
            </div>
            {!rows ? <p style={st.muted}>Loading…</p> : (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                    <table style={st.table}>
                        <thead><tr><th style={st.th}>Name</th>{types.map(t => <th key={t.code} style={{ ...st.th, textAlign: 'center' }}>{t.name}</th>)}</tr></thead>
                        <tbody>{rows.map((r, i) => (
                            <tr key={r.staffId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                <td style={st.td}><b>{r.fullName}</b><div style={st.small}>{r.jobTitle}</div></td>
                                {r.balances.map(b => <td key={b.typeCode} style={{ ...st.td, textAlign: 'center', color: b.applies && b.left !== null && b.left <= 0 ? '#b02a37' : '#222' }}>
                                    {cell(b)}{b.pending > 0 && <div style={{ ...st.small, color: '#b8860b' }}>{b.pending} waiting</div>}</td>)}
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function LeaveSettings({ types, reload, setError, flash }) {
    const [edit, setEdit] = useState(null);
    const [year, setYear] = useState(thisYear);
    const [hols, setHols] = useState([]);
    const [newHol, setNewHol] = useState({ date: '', name: '' });
    const loadHols = useCallback(() => api.get('/api/leave/holidays', { params: { year } }).then(r => setHols(r.data || [])).catch(() => {}), [year]);
    useEffect(() => { loadHols(); }, [loadHols]);
    const saveType = async (e) => {
        e.preventDefault();
        try { const r = await api.put('/api/leave/types', { ...edit, daysPerYear: edit.daysPerYear === '' || edit.daysPerYear === null ? null : Number(edit.daysPerYear), carryOverMax: Number(edit.carryOverMax || 0), genderOnly: edit.genderOnly || null });
            flash(r.data.message); setEdit(null); reload(); }
        catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    const addHol = async () => {
        try { const r = await api.post('/api/leave/holidays', newHol); flash(r.data.message); setNewHol({ date: '', name: '' }); loadHols(); }
        catch (err) { setError(serverMessage(err, 'Could not add the holiday.')); }
    };
    return (
        <div>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="list-check" />Leave types</h4>
                <p style={{ ...st.muted, marginTop: 0 }}>Starting values follow the Employment Act 2007 minimums — check them with the school's HR adviser and adjust to the school's policy.</p>
                <table style={st.table}>
                    <thead><tr>{['Leave', 'Days a year', 'Counts', 'Paid', 'For', 'Carry over', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                    <tbody>{types.map(t => (
                        <tr key={t.code} style={{ opacity: t.active ? 1 : 0.5 }}>
                            <td style={st.td}><b>{t.name}</b><div style={st.small}>{t.notes}</div></td><td style={st.td}>{t.daysPerYear ?? 'no limit'}{t.proRata ? ' (pro rata)' : ''}</td>
                            <td style={st.td}>{t.byHours ? 'hours (one day)' : t.workingDays ? 'working days' : 'calendar days'}{t.specify ? <div style={st.small}>HR specifies what it is</div> : null}</td><td style={st.td}>{t.paid ? 'Yes' : 'No'}</td>
                            <td style={st.td}>{t.genderOnly === 'FEMALE' ? 'Women' : t.genderOnly === 'MALE' ? 'Men' : 'Everyone'}</td><td style={st.td}>{t.carryOverMax || '—'}</td>
                            <td style={st.td}><button type="button" onClick={() => setEdit({ ...t, daysPerYear: t.daysPerYear ?? '', genderOnly: t.genderOnly || '' })} style={st.link}><Icon name="pencil" />Edit</button></td>
                        </tr>))}</tbody>
                </table>
                <button type="button" onClick={() => setEdit({ code: '', name: '', daysPerYear: '', workingDays: true, paid: true, genderOnly: '', carryOverMax: 0, proRata: false, active: true, sortOrder: 50, notes: '' })} style={{ ...st.link, marginTop: '8px' }}><Icon name="plus-circle" />Add a kind of leave</button>
                {edit && (
                    <form onSubmit={saveType} style={{ borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                        <div style={st.grid}>
                            <label style={st.lbl}>Code<input style={st.input} required maxLength={20} value={edit.code} disabled={types.some(t => t.code === edit.code) && !!edit.name} onChange={e => setEdit(x => ({ ...x, code: e.target.value.toUpperCase() }))} /></label>
                            <label style={st.lbl}>Name<input style={st.input} required maxLength={60} value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} /></label>
                            <label style={st.lbl}>Days a year (blank = no limit)<input style={st.input} inputMode="numeric" value={edit.daysPerYear} onChange={e => setEdit(x => ({ ...x, daysPerYear: e.target.value.replace(/\D/g, '') }))} /></label>
                            <label style={st.lbl}>Carry over (days)<input style={st.input} inputMode="numeric" value={edit.carryOverMax} onChange={e => setEdit(x => ({ ...x, carryOverMax: e.target.value.replace(/\D/g, '') }))} /></label>
                            <label style={st.lbl}>Only for<select style={st.input} value={edit.genderOnly} onChange={e => setEdit(x => ({ ...x, genderOnly: e.target.value }))}><option value="">Everyone</option><option value="FEMALE">Women</option><option value="MALE">Men</option></select></label>
                            <label style={{ ...st.lbl, gridColumn: '1 / -1' }}>Notes<input style={st.input} maxLength={200} value={edit.notes || ''} onChange={e => setEdit(x => ({ ...x, notes: e.target.value }))} /></label>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '10px 0' }}>
                            {[['workingDays', 'Count working days only (skip weekends & holidays)'], ['paid', 'Paid'], ['proRata', 'Pro rata in the year they join'], ['byHours', 'Counted in hours (a few hours on one day)'], ['specify', 'The applicant says what it is for; HR specifies on approval'], ['active', 'In use']].map(([k, l]) => (
                                <label key={k} style={st.check}><input type="checkbox" checked={!!edit[k]} onChange={e => setEdit(x => ({ ...x, [k]: e.target.checked }))} />{l}</label>))}
                        </div>
                        <div style={{ ...st.bar, justifyContent: 'flex-end' }}><button type="button" onClick={() => setEdit(null)} style={st.secondary}>Cancel</button><button type="submit" style={st.primary}><Icon name="save-fill" />Save</button></div>
                    </form>
                )}
            </div>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="calendar-heart" />Public holidays (skipped when counting leave)</h4>
                <div style={st.bar}>
                    <select style={st.input} value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">{[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <span style={st.muted}>Fixed holidays and Easter are automatic. Add the others each year (e.g. Idd-ul-Fitr, 10 October if gazetted, a Monday off when a holiday falls on Sunday).</span>
                </div>
                <div style={{ margin: '10px 0' }}>{hols.map(h => (
                    <div key={h.date} style={st.item}><span style={{ flex: 1 }}>{fmtDate(h.date)} — {h.name}</span>
                        {h.added ? <button type="button" onClick={async () => { await api.delete(`/api/leave/holidays/${h.date}`); loadHols(); }} style={{ ...st.link, color: '#b02a37' }}>Remove</button> : <span style={st.small}>automatic</span>}</div>))}</div>
                <div style={st.bar}>
                    <input type="date" style={st.input} value={newHol.date} onChange={e => setNewHol(x => ({ ...x, date: e.target.value }))} aria-label="Holiday date" />
                    <input style={{ ...st.input, flex: 1 }} maxLength={80} placeholder="e.g. Idd-ul-Fitr" value={newHol.name} onChange={e => setNewHol(x => ({ ...x, name: e.target.value }))} aria-label="Holiday name" />
                    <button type="button" onClick={addHol} disabled={!newHol.date || !newHol.name.trim()} style={st.primary}><Icon name="plus-circle" />Add holiday</button>
                </div>
            </div>
        </div>
    );
}

const st = {
    tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
    tab: { padding: '8px 12px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    h4: { color: '#1F3864', margin: '0 0 8px', fontSize: '14px' },
    item: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' },
    count: { backgroundColor: '#eef3fb', color: '#1F3864', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', fontWeight: 600, margin: '10px 0 0' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '640px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    pill: { color: 'white', borderRadius: '10px', padding: '2px 9px', fontSize: '11px', fontWeight: 700 },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};
