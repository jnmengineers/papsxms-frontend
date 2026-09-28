import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { letterheadHtml } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import SchoolDayRecord from './AttendanceSchoolDay';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const STATUSES = [
    { key: 'PRESENT', short: 'P', label: 'Present', color: '#28a745', light: '#e8f5e9' },
    { key: 'ABSENT', short: 'A', label: 'Absent', color: '#dc3545', light: '#fdecea' },
    { key: 'LATE', short: 'L', label: 'Late', color: '#e0a800', light: '#fff8e1' },
    { key: 'EXCUSED', short: 'E', label: 'Excused', color: '#2E75B6', light: '#e3f2fd' },
];
const LOW_ATTENDANCE = 80; // % below which a student is highlighted

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = (s) => new Date(`${s}T00:00:00`);
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const isWeekend = (iso) => { const d = parseISO(iso).getDay(); return d === 0 || d === 6; };
const fmtLong = (iso) => parseISO(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (s) => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const isActiveTerm = (y) => !!(y?.isActive ?? y?.active);

function AttendanceRegister() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const isAdmin = role === 'ADMIN';

    const [tab, setTab] = useState('register');
    const [classes, setClasses] = useState([]);
    const [classId, setClassId] = useState('');
    const [date, setDate] = useState(todayISO());
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});          // studentId -> { status, note }
    const [saved, setSaved] = useState({});          // what the server has (to detect changes)
    const [savedInfo, setSavedInfo] = useState(null); // { by, at } for the day
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [from, setFrom] = useState('');
    const [to, setTo] = useState(todayISO());
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [sortLowFirst, setSortLowFirst] = useState(true);

    const successTimer = useRef(null);
    const latest = useRef('');

    // ── classes this user may take a register for ──
    useEffect(() => {
        Promise.allSettled([api.get('/api/classes'), api.get('/api/academic-years')]).then(([c, y]) => {
            if (c.status === 'fulfilled') {
                const all = [...(c.value.data || [])].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
                const mine = isAdmin ? all : all.filter(x => String(x.classId) === String(linkedClassId));
                setClasses(mine);
                if (mine.length === 1) setClassId(String(mine[0].classId));
            } else setError('Failed to load classes. Refresh the page.');
            // Summary starts at the beginning of the current term (or the 1st of this month)
            const term = y.status === 'fulfilled' ? (y.value.data || []).find(isActiveTerm) : null;
            const termStart = term?.startDate ? String(term.startDate).slice(0, 10) : null;
            setFrom(termStart && termStart <= todayISO() ? termStart : `${todayISO().slice(0, 8)}01`);
        });
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3500);
    };

    // ── load the day's register ──
    useEffect(() => {
        if (!classId || tab !== 'register') return;
        const key = `${classId}|${date}`;
        latest.current = key;
        setLoading(true); setError('');
        Promise.all([api.get(`/api/students/by-class/${classId}`), api.get(`/api/attendance/class/${classId}/date/${date}`)])
            .then(([s, a]) => {
                if (latest.current !== key) return;
                const list = [...(s.data || [])].sort((x, y) => `${x.firstName} ${x.lastName}`.localeCompare(`${y.firstName} ${y.lastName}`));
                const byStudent = {};
                let info = null;
                (a.data || []).forEach(r => {
                    byStudent[r.studentId] = { status: r.status, note: r.note || '' };
                    if (!info || (r.markedAt && r.markedAt > info.at)) info = { by: r.markedBy, at: r.markedAt };
                });
                const start = {};
                // Not taken yet → everyone starts as Present; only the exceptions need a tap
                list.forEach(st => { start[st.studentId] = byStudent[st.studentId] || { status: 'PRESENT', note: '' }; });
                setStudents(list);
                setMarks(start);
                setSaved(byStudent);
                setSavedInfo(info);
            })
            .catch(err => { if (latest.current === key) setError(serverMessage(err, 'Failed to load the register.')); })
            .finally(() => { if (latest.current === key) setLoading(false); });
    }, [classId, date, tab]);

    const taken = Object.keys(saved).length > 0;
    const changedCount = students.filter(st => {
        const m = marks[st.studentId], sv = saved[st.studentId];
        return !sv || !m || m.status !== sv.status || (m.note || '') !== (sv.note || '');
    }).length;
    const dirty = taken ? changedCount > 0 : false;
    const needsSaving = !taken || dirty;

    // Warn before leaving with unsaved changes
    useEffect(() => {
        if (!dirty) return;
        const h = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [dirty]);

    const confirmLeave = () => !dirty || window.confirm('You have unsaved changes to this register. Discard them?');
    const changeClass = (v) => { if (confirmLeave()) { setClassId(v); setSummary(null); } };
    const changeDate = (v) => {
        if (!v) return;
        if (v > todayISO()) { setError("You can't take the register for a future date."); return; }
        if (confirmLeave()) setDate(v);
    };
    const stepDay = (n) => {
        let d = addDays(date, n);
        while (isWeekend(d)) d = addDays(d, n);   // skip weekends when stepping
        if (d > todayISO()) return;
        changeDate(d);
    };

    const setStatus = (sid, status) => setMarks(m => ({ ...m, [sid]: { ...m[sid], status, note: status === 'PRESENT' ? '' : (m[sid]?.note || '') } }));
    const setNote = (sid, note) => setMarks(m => ({ ...m, [sid]: { ...m[sid], note } }));
    const markAllPresent = () => setMarks(m => { const n = { ...m }; students.forEach(st => { n[st.studentId] = { status: 'PRESENT', note: '' }; }); return n; });

    const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s.key]: students.filter(st => marks[st.studentId]?.status === s.key).length }), {});

    const save = async () => {
        if (!students.length || saving) return;
        setSaving(true); setError('');
        try {
            const entries = students.map(st => ({ studentId: st.studentId, status: marks[st.studentId]?.status || 'PRESENT', note: marks[st.studentId]?.note || '' }));
            const r = await api.put(`/api/attendance/class/${classId}/date/${date}`, entries);
            const now = {};
            entries.forEach(e => { now[e.studentId] = { status: e.status, note: e.note }; });
            setSaved(now);
            setSavedInfo({ by: localStorage.getItem('displayName') || localStorage.getItem('username'), at: new Date().toISOString() });
            flashSuccess(r.data?.message || 'Register saved.');
        } catch (err) { setError(serverMessage(err, 'Failed to save the register.')); }
        setSaving(false);
    };

    // ── summary ──
    const loadSummary = async () => {
        if (!classId || !from || !to) return;
        if (from > to) { setError('The start date must be before the end date.'); return; }
        setSummaryLoading(true); setError('');
        try { const r = await api.get(`/api/attendance/class/${classId}/summary`, { params: { from, to } }); setSummary(r.data); }
        catch (err) { setError(serverMessage(err, 'Failed to load the summary.')); }
        setSummaryLoading(false);
    };
    useEffect(() => { if (tab === 'summary' && classId && from) loadSummary(); }, [tab, classId]);

    const summaryRows = summary ? [...summary.students].sort((a, b) => sortLowFirst
        ? ((a.percent ?? 101) - (b.percent ?? 101)) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)) : [];
    const lowCount = summaryRows.filter(r => r.percent !== null && r.percent < LOW_ATTENDANCE).length;
    const cls = classes.find(c => String(c.classId) === String(classId));

    const printSummary = () => {
        if (!summary) return;
        const rows = summaryRows.map((r, i) => `<tr class="${r.percent !== null && r.percent < LOW_ATTENDANCE ? 'low' : ''}"><td>${i + 1}</td><td>${esc(r.admissionNumber)}</td><td>${esc(r.name)}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.excused}</td><td>${r.daysMarked}</td><td><b>${r.percent === null ? '-' : r.percent.toFixed(1) + '%'}</b></td></tr>`).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Attendance Summary</title><style>
            body{font-family:'Times New Roman',serif;font-size:12px;padding:15px;color:#000}table{width:100%;border-collapse:collapse}
            th{background:#1F3864;color:#fff;padding:6px}td{border:1px solid #bbb;padding:5px 6px;text-align:center}td:nth-child(3){text-align:left}
            tr.low td{background:#fdecea}.h{text-align:center;border-bottom:3px solid #1F3864;margin-bottom:10px;padding-bottom:6px}
            .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:12px;display:flex;justify-content:space-between}
            @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}}</style></head><body>
            <div class="bar"><strong>Attendance Summary</strong><button onclick="window.print()" style="background:#FFD700;border:none;padding:5px 14px;border-radius:4px;font-weight:bold;cursor:pointer">Print / Save PDF</button></div>
            <div class="h">${letterheadHtml({ logoSize: 45 })}
            <div style="font-weight:bold;margin-top:4px">ATTENDANCE SUMMARY — ${esc(cls ? classDisplayName(cls) : '')}</div>
            <div>${esc(fmtLong(summary.from))} to ${esc(fmtLong(summary.to))} · ${summary.daysTaken} day(s) recorded</div></div>
            <table><thead><tr><th>#</th><th>Adm No</th><th>Name</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Days</th><th>Attendance</th></tr></thead><tbody>${rows}</tbody></table>
            <p style="font-size:11px">Late counts as attended. Shaded rows are below ${LOW_ATTENDANCE}%.</p>
            <p style="text-align:center;font-size:9px;color:#888">Printed ${esc(new Date().toLocaleDateString('en-GB'))}</p></body></html>`;
        const win = window.open('', '_blank');
        if (!win) { setError('Your browser blocked the print window. Allow pop-ups for this site, then try again.'); return; }
        win.document.write(html); win.document.close(); win.focus();
    };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.title}><Icon name="calendar2-check-fill" style={{ marginRight: '10px' }} />Attendance Register</h2>
                    <p style={styles.subtitle}>Take the daily register and see each learner's attendance over the term</p>

                    {error && (
                        <div style={styles.error} role="alert">
                            <Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span>
                            <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                        </div>
                    )}
                    {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                    <div style={styles.toolbar}>
                        <div style={styles.tabs} role="tablist">
                            {[['register', 'pencil-square', 'Take Register'], ['summary', 'bar-chart-fill', 'Summary'], ['school', 'clipboard-data', 'School Daily Record']].map(([k, ic, label]) => (
                                <button key={k} role="tab" aria-selected={tab === k} onClick={() => { if (k === tab || confirmLeave()) setTab(k); }}
                                    style={{ ...styles.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}>
                                    <Icon name={ic} />{label}
                                </button>
                            ))}
                        </div>
                        {tab !== 'school' && (
                            <select style={styles.select} value={classId} onChange={e => changeClass(e.target.value)} aria-label="Class">
                                <option value="">{classes.length ? 'Select class…' : 'No class assigned to you'}</option>
                                {classes.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                            </select>
                        )}
                    </div>

                    {tab === 'school' ? (
                        <SchoolDayRecord setError={setError} blocked={() => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.')} />
                    ) : !classId ? (
                        <div style={styles.empty}>
                            <Icon name="calendar2-check" style={{ fontSize: '44px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '12px' }} />
                            <h3 style={{ margin: '0 0 6px' }}>{classes.length ? 'Choose a class' : 'No class to take a register for'}</h3>
                            <p style={{ color: '#666', margin: 0 }}>{classes.length ? 'Pick a class above to begin.' : 'Only the class teacher (or an administrator) takes the register.'}</p>
                        </div>
                    ) : tab === 'register' ? (
                        <>
                            {/* Date bar */}
                            <div style={styles.dateBar}>
                                <button onClick={() => stepDay(-1)} style={styles.dayBtn} aria-label="Previous school day"><i className="bi bi-chevron-left" /></button>
                                <input type="date" value={date} max={todayISO()} onChange={e => changeDate(e.target.value)} style={styles.dateInput} aria-label="Date" />
                                <button onClick={() => stepDay(1)} style={styles.dayBtn} disabled={date >= todayISO()} aria-label="Next school day"><i className="bi bi-chevron-right" /></button>
                                <strong style={{ color: '#1F3864' }}>{fmtLong(date)}</strong>
                                {date !== todayISO() && <button onClick={() => changeDate(todayISO())} style={styles.linkBtn}>Today</button>}
                                <span style={{ marginLeft: 'auto', ...styles.statePill, ...(taken ? { backgroundColor: '#d4edda', color: '#155724' } : { backgroundColor: '#fff3cd', color: '#856404' }) }}>
                                    <Icon name={taken ? 'check-circle-fill' : 'hourglass-split'} style={{ marginRight: '4px' }} />
                                    {taken ? `Taken${savedInfo?.by ? ` by ${savedInfo.by}` : ''}${savedInfo?.at ? ` · ${fmtTime(savedInfo.at)}` : ''}` : 'Not taken yet'}
                                </span>
                            </div>
                            {isWeekend(date) && <p style={styles.warn}><Icon name="exclamation-circle-fill" />This date is a weekend.</p>}

                            {/* Counts */}
                            <div style={styles.countRow}>
                                {STATUSES.map(s => (
                                    <div key={s.key} style={{ ...styles.countBox, borderTopColor: s.color }}>
                                        <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{counts[s.key] || 0}</div>
                                        <div style={{ fontSize: '12px', color: '#555' }}>{s.label}</div>
                                    </div>
                                ))}
                                <div style={{ ...styles.countBox, borderTopColor: '#1F3864' }}>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1F3864' }}>{students.length}</div>
                                    <div style={{ fontSize: '12px', color: '#555' }}>On roll</div>
                                </div>
                            </div>

                            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading register…</p> : students.length === 0 ? (
                                <div style={styles.empty}><h3 style={{ margin: 0 }}>No students in this class</h3></div>
                            ) : (
                                <div style={styles.panel}>
                                    <div style={styles.panelHead}>
                                        <span style={{ fontSize: '13px', color: '#555' }}>
                                            {taken ? 'Change anyone who is not Present, then save.' : 'Everyone starts as Present. Tap the learners who are absent, late or excused, then save.'}
                                        </span>
                                        <button onClick={markAllPresent} style={styles.secondaryBtn}><Icon name="check2-all" />All present</button>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...styles.th, width: '40px' }}>#</th>
                                                    <th style={styles.th}>Learner</th>
                                                    <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                                                    <th style={styles.th}>Note (reason)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((st, i) => {
                                                    const m = marks[st.studentId] || { status: 'PRESENT', note: '' };
                                                    const sv = saved[st.studentId];
                                                    const changed = taken && (!sv || sv.status !== m.status || (sv.note || '') !== (m.note || ''));
                                                    const cur = STATUSES.find(s => s.key === m.status);
                                                    return (
                                                        <tr key={st.studentId} style={{ backgroundColor: m.status !== 'PRESENT' ? cur.light : (i % 2 ? 'white' : '#fafafa') }}>
                                                            <td style={{ ...styles.td, color: '#888' }}>{i + 1}</td>
                                                            <td style={styles.td}>
                                                                <strong style={{ color: '#1F3864' }}>{st.firstName} {st.lastName}</strong>
                                                                <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{st.admissionNumber}</div>
                                                                {changed && <span style={styles.changedTag}>changed</span>}
                                                            </td>
                                                            <td style={{ ...styles.td, whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                <div role="radiogroup" aria-label={`Status for ${st.firstName} ${st.lastName}`} style={{ display: 'inline-flex', gap: '4px' }}>
                                                                    {STATUSES.map(s => {
                                                                        const on = m.status === s.key;
                                                                        return (
                                                                            <button key={s.key} role="radio" aria-checked={on} title={s.label}
                                                                                onClick={() => setStatus(st.studentId, s.key)}
                                                                                style={{ ...styles.statusBtn, backgroundColor: on ? s.color : 'white', color: on ? 'white' : s.color, borderColor: s.color }}>
                                                                                {s.short}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                            <td style={styles.td}>
                                                                {m.status !== 'PRESENT' ? (
                                                                    <input value={m.note} maxLength={200} onChange={e => setNote(st.studentId, e.target.value)}
                                                                        placeholder={m.status === 'EXCUSED' ? 'e.g. sick — note from parent' : m.status === 'LATE' ? 'e.g. arrived 8:20' : 'Reason, if known'}
                                                                        style={styles.noteInput} aria-label={`Note for ${st.firstName} ${st.lastName}`} />
                                                                ) : <span style={{ color: '#bbb' }}>—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={styles.saveBar}>
                                        <span style={{ fontSize: '13px', color: '#555' }}>
                                            {!taken ? `${students.length} learner(s) will be saved` : dirty ? `${changedCount} change(s) not saved` : 'All changes saved'}
                                        </span>
                                        <button onClick={save} disabled={saving || !needsSaving}
                                            style={{ ...styles.saveBtn, opacity: saving || !needsSaving ? 0.55 : 1 }}>
                                            <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : taken ? 'Save Changes' : 'Save Register'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* ── Summary ── */
                        <>
                            <div style={styles.dateBar}>
                                <label style={styles.rangeLabel}>From <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={styles.dateInput} /></label>
                                <label style={styles.rangeLabel}>To <input type="date" value={to} max={todayISO()} onChange={e => setTo(e.target.value)} style={styles.dateInput} /></label>
                                <button onClick={loadSummary} style={styles.secondaryBtn} disabled={summaryLoading}><Icon name="arrow-repeat" />Show</button>
                                <label style={{ ...styles.rangeLabel, marginLeft: 'auto' }}>
                                    <input type="checkbox" checked={sortLowFirst} onChange={e => setSortLowFirst(e.target.checked)} /> Lowest attendance first
                                </label>
                                <button onClick={printSummary} style={styles.secondaryBtn} disabled={!summary}><Icon name="printer-fill" />Print</button>
                            </div>

                            {summaryLoading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : summary && (
                                <>
                                    <div style={styles.summaryInfo}>
                                        <span><Icon name="calendar-range" /><strong>{summary.daysTaken}</strong> day(s) recorded</span>
                                        {lowCount > 0
                                            ? <span style={{ color: '#b02a37' }}><Icon name="exclamation-triangle-fill" /><strong>{lowCount}</strong> learner(s) below {LOW_ATTENDANCE}%</span>
                                            : summary.daysTaken > 0 && <span style={{ color: '#155724' }}><Icon name="check-circle-fill" />Everyone at or above {LOW_ATTENDANCE}%</span>}
                                    </div>
                                    {summary.daysTaken === 0 ? (
                                        <div style={styles.empty}><p style={{ margin: 0, color: '#666' }}>No register has been taken for this class between these dates.</p></div>
                                    ) : (
                                        <div style={{ ...styles.panel, overflowX: 'auto' }}>
                                            <table style={{ ...styles.table, minWidth: '640px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={styles.th}>Learner</th>
                                                        {STATUSES.map(s => <th key={s.key} style={{ ...styles.th, textAlign: 'center' }}>{s.label}</th>)}
                                                        <th style={{ ...styles.th, textAlign: 'center' }}>Days</th>
                                                        <th style={{ ...styles.th, textAlign: 'center' }}>Attendance</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {summaryRows.map((r, i) => {
                                                        const low = r.percent !== null && r.percent < LOW_ATTENDANCE;
                                                        return (
                                                            <tr key={r.studentId} style={{ backgroundColor: low ? '#fdecea' : (i % 2 ? 'white' : '#fafafa') }}>
                                                                <td style={styles.td}><strong style={{ color: '#1F3864' }}>{r.name}</strong><div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{r.admissionNumber}</div></td>
                                                                <td style={styles.tdNum}>{r.present}</td>
                                                                <td style={{ ...styles.tdNum, color: r.absent ? '#dc3545' : undefined, fontWeight: r.absent ? 700 : undefined }}>{r.absent}</td>
                                                                <td style={styles.tdNum}>{r.late}</td>
                                                                <td style={styles.tdNum}>{r.excused}</td>
                                                                <td style={styles.tdNum}>{r.daysMarked}</td>
                                                                <td style={{ ...styles.tdNum, fontWeight: 800, color: low ? '#b02a37' : '#1e7e34' }}>{r.percent === null ? '-' : `${r.percent.toFixed(1)}%`}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <p style={{ fontSize: '12px', color: '#666', margin: '10px 4px 0' }}>Late counts as attended. Excused days count as absent in the percentage.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: '0 0 20px 0', fontSize: '14px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    toolbar: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' },
    tabs: { display: 'inline-flex', border: '2px solid #1F3864', borderRadius: '10px', overflow: 'hidden' },
    tab: { border: 'none', padding: '9px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    select: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white', minWidth: '200px' },
    empty: { backgroundColor: 'white', padding: '50px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    dateBar: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'white', padding: '12px 16px', borderRadius: '12px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    dayBtn: { border: '1.5px solid #ddd', backgroundColor: 'white', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#1F3864' },
    dateInput: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' },
    statePill: { padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    warn: { color: '#856404', backgroundColor: '#fff8e1', border: '1px solid #ffc107', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', margin: '0 0 14px' },
    countRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '14px' },
    countBox: { backgroundColor: 'white', borderRadius: '10px', padding: '10px', textAlign: 'center', borderTop: '4px solid', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' },
    td: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    tdNum: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'center' },
    statusBtn: { width: '38px', height: '36px', borderRadius: '8px', border: '2px solid', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
    noteInput: { width: '100%', minWidth: '160px', padding: '7px 9px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px', backgroundColor: 'white' },
    changedTag: { display: 'inline-block', marginTop: '3px', backgroundColor: '#fff3cd', color: '#856404', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' },
    secondaryBtn: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'inline-flex', alignItems: 'center' },
    saveBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '2px solid #f0f2f5', marginTop: '10px', paddingTop: '12px' },
    saveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 26px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center' },
    rangeLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333' },
    summaryInfo: { display: 'flex', gap: '20px', flexWrap: 'wrap', backgroundColor: 'white', padding: '10px 16px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default AttendanceRegister;
