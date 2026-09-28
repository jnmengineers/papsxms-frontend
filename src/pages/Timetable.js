import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { classDisplayName } from '../utils/classUtils';
import { schoolName } from '../utils/school';
import { openPrint, SHEET_CSS, LOWER_CSS, BLOCK_CSS, classSheetHtml, teacherSheetHtml, blockSheetHtml } from '../utils/timetablePrint';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { SECTIONS_LIVE, SECTION_OF_GRADE_LIVE, GRADE_ORDER_LIVE, GRADE_LABELS_LIVE, gradeRankOf } from '../utils/schoolData';
import { autoFill, clashesFor, ruleIssuesFor } from '../utils/timetableFill';

/**
 * Teaching timetable
 *   My timetable — a teacher's own week
 *   Classes      — each class's week; the admin edits it (click a period), auto-fills, saves
 *   Teachers     — any teacher's week
 *   Setup        — (admin) bell times per section, lessons per week per subject per grade
 * The server refuses a timetable where a teacher would be in two places at once.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 1500) return d; return d?.message || d?.error || fallback; };
const hhmm = (t) => String(t || '').slice(0, 5);
const addMinutes = (t, m) => { const [h, mi] = hhmm(t || '08:00').split(':').map(Number); const x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const minutesBetween = (a, b) => { const [h1, m1] = hhmm(a).split(':').map(Number); const [h2, m2] = hhmm(b).split(':').map(Number); return (h2 * 60 + m2) - (h1 * 60 + m1); };
const PALETTE = ['#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0', '#ede7f6', '#e0f7fa', '#f9fbe7', '#fbe9e7', '#e8eaf6', '#f3e5f5', '#e0f2f1', '#fffde7'];
const colourOf = (subjectId) => PALETTE[Math.abs(Number(subjectId) || 0) % PALETTE.length];
const teacherLabel = (t) => [t?.firstName, t?.lastName].filter(Boolean).join(' ');
// Bell times of every section (for laying out a teacher's sheet on the right periods)
const loadSlotsBySection = () => api.get('/api/timetable/slots').then(r => Object.fromEntries((r.data.sections || []).map(x => [x.code, x.slots])));
const printTeacher = async (tv, blocked, setError) => {
    try {
        const slotsBySection = await loadSlotsBySection();
        const withLabels = { ...tv, lessons: tv.lessons.map(l => ({ ...l, classLabel: classDisplayName({ className: l.className, stream: l.stream }) })) };
        openPrint(`Timetable — ${tv.teacherName}`, teacherSheetHtml(withLabels, slotsBySection, schoolName()), SHEET_CSS, blocked);
    } catch (err) { setError(serverMessage(err, 'Could not prepare the printout.')); }
};

// ═════════════════════════════════════════════════════════════════════════════
function Timetable() {
    useSchoolSettings();
    const role = localStorage.getItem('role');
    const isAdmin = role === 'ADMIN';
    const [tab, setTab] = useState(role === 'TEACHER' ? 'mine' : 'class');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const flash = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 4000); };
    const blocked = () => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    const TABS = [
        ...(role === 'TEACHER' ? [['mine', 'person-badge-fill', 'My Timetable']] : []),
        ['class', 'grid-3x3-gap-fill', 'Classes'],
        ['teacher', 'people-fill', 'Teachers'],
        ...(isAdmin ? [['setup', 'gear-fill', 'Setup']] : []),
    ];
    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="calendar-week-fill" style={{ marginRight: '10px' }} />Timetable</h2>
                    <p style={st.subtitle}>The teaching week for every class and teacher.</p>
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1, whiteSpace: 'pre-line' }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}
                    <div style={st.tabs} role="tablist">
                        {TABS.map(([k, ic, l]) => (
                            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setError(''); setTab(k); }}
                                style={{ ...st.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}><Icon name={ic} />{l}</button>
                        ))}
                    </div>
                    {tab === 'mine' && <MineTab setError={setError} blocked={blocked} />}
                    {tab === 'class' && <ClassTab isAdmin={isAdmin} setError={setError} flash={flash} blocked={blocked} />}
                    {tab === 'teacher' && <TeacherTab setError={setError} blocked={blocked} />}
                    {tab === 'setup' && isAdmin && <SetupTab setError={setError} flash={flash} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ── A teacher's week (used by "My timetable" and "Teachers") ────────────────
function TeacherWeek({ tv }) {
    if (!tv.lessons.length) return <p style={st.muted}>No lessons on the timetable yet.</p>;
    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={st.weekGrid}>
                {tv.days.map(d => (
                    <div key={d.day} style={st.dayCol}>
                        <div style={st.dayHead}>{d.name}</div>
                        {tv.lessons.filter(l => l.day === d.day).map((l, i) => (
                            <div key={i} style={{ ...st.lessonCard, backgroundColor: '#f7f9fc' }}>
                                <strong>{hhmm(l.start)}–{hhmm(l.end)}</strong>
                                <div>{l.subjectName}</div>
                                <div style={st.small}>{classDisplayName({ className: l.className, stream: l.stream })}</div>
                            </div>
                        ))}
                        {!tv.lessons.some(l => l.day === d.day) && <p style={st.muted}>Free</p>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function MineTab({ setError, blocked }) {
    const [tv, setTv] = useState(null);
    const [problem, setProblem] = useState('');
    useEffect(() => { api.get('/api/timetable/mine').then(r => setTv(r.data)).catch(err => setProblem(serverMessage(err, 'Could not load your timetable.'))); }, []);
    if (problem) return <div style={st.panel}><p style={{ margin: 0 }}>{problem}</p></div>;
    if (!tv) return <p style={st.center}><Icon name="hourglass-split" />Loading…</p>;
    const today = new Date().getDay();
    const todays = tv.lessons.filter(l => l.day === today);
    return (
        <div>
            {today >= 1 && today <= 5 && (
                <div style={{ ...st.panel, borderLeft: '5px solid #28a745' }}>
                    <strong style={{ color: '#1F3864' }}><Icon name="sun-fill" style={{ color: '#fd7e14' }} />Today: {todays.length ? `${todays.length} lesson(s)` : 'no lessons'}</strong>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {todays.map((l, i) => <span key={i} style={st.chip}>{hhmm(l.start)} {l.subjectName} · {classDisplayName({ className: l.className, stream: l.stream })}</span>)}
                    </div>
                </div>
            )}
            <div style={st.panel}>
                <div style={st.bar}><strong style={{ color: '#1F3864' }}>{tv.teacherName} — {tv.lessons.length} lesson(s) a week</strong>
                    <button onClick={() => printTeacher(tv, blocked, setError)} style={{ ...st.secondary, marginLeft: 'auto' }}><Icon name="printer" />Print</button></div>
                <TeacherWeek tv={tv} />
            </div>
        </div>
    );
}

function TeacherTab({ setError, blocked }) {
    const [teachers, setTeachers] = useState([]);
    const [teacherId, setTeacherId] = useState('');
    const [tv, setTv] = useState(null);
    useEffect(() => {
        api.get('/api/teachers').then(r => {
            const list = [...(r.data || [])].sort((a, b) => teacherLabel(a).localeCompare(teacherLabel(b)));
            setTeachers(list); if (list.length) setTeacherId(String(list[0].teacherId));
        }).catch(err => setError(serverMessage(err, 'Could not load teachers.')));
    }, [setError]);
    useEffect(() => {
        if (!teacherId) return;
        setTv(null);
        api.get(`/api/timetable/teacher/${teacherId}`).then(r => setTv(r.data)).catch(err => setError(serverMessage(err, 'Could not load the timetable.')));
    }, [teacherId, setError]);
    return (
        <div style={st.panel}>
            <div style={st.bar}>
                <select style={st.select} value={teacherId} onChange={e => setTeacherId(e.target.value)} aria-label="Teacher">
                    {teachers.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{teacherLabel(t)}</option>)}
                </select>
                {tv && <span style={st.muted}>{tv.lessons.length} lesson(s) a week</span>}
                {tv && <button onClick={() => printTeacher(tv, blocked, setError)} style={{ ...st.secondary, marginLeft: 'auto' }}><Icon name="printer" />Print</button>}
            </div>
            {tv ? <TeacherWeek tv={tv} /> : <p style={st.center}><Icon name="hourglass-split" />Loading…</p>}
        </div>
    );
}

// ── A class's week ──────────────────────────────────────────────────────────
function ClassTab({ isAdmin, setError, flash, blocked }) {
    const [classes, setClasses] = useState([]);
    const [classId, setClassId] = useState('');
    const [view, setView] = useState(null);
    const [entries, setEntries] = useState([]);
    const [busy, setBusy] = useState([]);
    const [editing, setEditing] = useState(null);   // "day:slotId" of the open cell
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const latest = useRef('');

    useEffect(() => {
        api.get('/api/classes').then(r => {
            const list = [...(r.data || [])].sort((a, b) => gradeRankOf(a.gradeLevel) - gradeRankOf(b.gradeLevel) || classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
            setClasses(list); if (list.length) setClassId(String(list[0].classId));
        }).catch(err => setError(serverMessage(err, 'Could not load classes.')));
    }, [setError]);

    const load = useCallback(async (id) => {
        if (!id) return;
        latest.current = id;
        setView(null); setNotice(''); setEditing(null);
        try {
            const [v, b] = await Promise.all([api.get(`/api/timetable/class/${id}`), api.get('/api/timetable/busy', { params: { excludeClassId: id } })]);
            if (latest.current !== id) return;
            setView(v.data); setEntries(v.data.entries); setBusy(b.data || []);
        } catch (err) { if (latest.current === id) setError(serverMessage(err, 'Could not load the timetable.')); }
    }, [setError]);
    useEffect(() => { load(classId); }, [classId, load]);

    const dirty = useMemo(() => view && JSON.stringify([...entries].map(e => [e.day, e.slotId, e.subjectId, e.teacherId]).sort()) !== JSON.stringify([...view.entries].map(e => [e.day, e.slotId, e.subjectId, e.teacherId]).sort()), [entries, view]);
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const cls = classes.find(c => String(c.classId) === String(classId));
    const name = cls ? classDisplayName(cls) : '';
    const clashes = useMemo(() => (view ? clashesFor(entries, view.slots, busy) : new Map()), [entries, view, busy]);
    const ruleIssues = useMemo(() => (view ? ruleIssuesFor(entries, view.slots, view.subjects) : new Map()), [entries, view]);
    const ruleText = (x) => [x.latestEnd ? `by ${hhmm(x.latestEnd)}` : '', x.doublesAllowed ? 'doubles OK' : ''].filter(Boolean).join(' · ');
    const at = (day, slotId) => entries.find(e => e.day === day && String(e.slotId) === String(slotId));
    const placedOf = (subjectId) => entries.filter(e => String(e.subjectId) === String(subjectId)).length;

    const pickClass = (id) => { if (!dirty || window.confirm('You have unsaved changes to this timetable. Discard them?')) setClassId(id); };
    const setCell = (day, slotId, subjectId) => {
        setEntries(list => {
            const rest = list.filter(e => !(e.day === day && String(e.slotId) === String(slotId)));
            if (!subjectId) return rest;
            const s = view.subjects.find(x => String(x.subjectId) === String(subjectId));
            return [...rest, { day, slotId, subjectId: s.subjectId, subjectName: s.subjectName, teacherId: s.teacherId, teacherName: s.teacherName }];
        });
        setEditing(null);
    };
    const fill = (keepExisting) => {
        if (!view.subjects.some(s => s.lessons > 0)) { setError('Set lessons per week for this grade first (Setup → Lessons per week).'); return; }
        if (!keepExisting && entries.length && !window.confirm('Start again? This replaces every lesson on this class\'s timetable (nothing is saved until you press Save).')) return;
        const r = autoFill({ days: view.days.map(d => d.day), slots: view.slots, subjects: view.subjects, entries, busy, keepExisting });
        setEntries(r.entries);
        setNotice(r.unplaced.length
            ? `Placed what fits. Could not place: ${r.unplaced.map(u => `${u.subjectName} (${u.missing})`).join(', ')} — not enough free periods, or the teacher is busy elsewhere.`
            : 'All lessons placed. Check it, then press Save.');
    };
    const save = async () => {
        setSaving(true); setError('');
        try {
            const r = await api.put(`/api/timetable/class/${classId}`, entries.map(e => ({ day: e.day, slotId: e.slotId, subjectId: e.subjectId, teacherId: e.teacherId ?? null })));
            flash(r.data.message); await load(classId);
        } catch (err) { setError(serverMessage(err, 'Failed to save the timetable.')); }
        setSaving(false);
    };
    const printAll = async () => {
        try {
            const views = await Promise.all(classes.map(c => api.get(`/api/timetable/class/${c.classId}`).then(r => ({ c, v: r.data }))));
            const body = views.filter(x => x.v.entries.length).map(x => classSheetHtml(x.v, x.v.entries, classDisplayName(x.c), schoolName(), '', layoutFor(x.v))).join('');
            if (!body) { setError('No class has a timetable yet.'); return; }
            openPrint('All class timetables', body, SHEET_CSS + LOWER_CSS, blocked);
        } catch (err) { setError(serverMessage(err, 'Could not load all timetables.')); }
    };

    // Block timetable: every class of a section on one sheet (the school's JSS / Upper block layout)
    const blockSections = SECTIONS_LIVE.filter(sec => classes.some(c => c.section === sec.code)).map(sec => ({ code: sec.code, name: sec.name }));
    const [blockSection, setBlockSection] = useState('');
    const [blockTeachers, setBlockTeachers] = useState(true);
    // Print layout: auto = Lower Primary style for class-taught sections (Lower Primary, Pre-School), the Grades 4–9 template otherwise
    const [layoutChoice, setLayoutChoice] = useState('auto');
    const layoutFor = (v) => (layoutChoice === 'auto' ? (v && v.subjectTeaching === false ? 'lower' : 'standard') : layoutChoice);
    useEffect(() => { if (!blockSection && blockSections.length) setBlockSection(blockSections[0].code); }, [blockSection, blockSections]);
    const printBlock = async () => {
        const list = classes.filter(c => c.section === blockSection);
        if (!list.length) { setError('No classes in that section.'); return; }
        try {
            const views = await Promise.all(list.map(c => api.get(`/api/timetable/class/${c.classId}`).then(r => ({ c, v: r.data }))));
            const withSlots = views.find(x => x.v.slots.length);
            if (!withSlots) { setError('Set the bell times for this section first (Setup).'); return; }
            const html = blockSheetHtml({
                sectionName: withSlots.v.sectionName, slots: withSlots.v.slots, days: withSlots.v.days, showTeachers: blockTeachers,
                classes: views.map(x => ({ label: x.c.className, entries: String(x.c.classId) === String(classId) ? entries : x.v.entries })),
            });
            openPrint(`Block timetable — ${withSlots.v.sectionName}`, html, BLOCK_CSS, blocked);
        } catch (err) { setError(serverMessage(err, 'Could not prepare the block timetable.')); }
    };

    const wanted = view ? view.subjects.reduce((s, x) => s + (x.lessons || 0), 0) : 0;
    const lessonPeriods = view ? view.slots.filter(s => s.lesson).length * view.days.length : 0;

    return (
        <div>
            <div style={st.panel}>
                <div style={st.bar}>
                    <select style={st.select} value={classId} onChange={e => pickClass(e.target.value)} aria-label="Class">
                        {classes.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                    </select>
                    {view && <span style={st.muted}>{view.sectionName} · {entries.length} of {wanted || '?'} lessons placed · {lessonPeriods} lesson periods a week</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select style={{ ...st.select, padding: '6px 8px' }} value={layoutChoice} onChange={e => setLayoutChoice(e.target.value)} aria-label="Print layout" title="How class timetables are printed">
                            <option value="auto">Layout: auto</option>
                            <option value="standard">Layout: Grades 4–9</option>
                            <option value="lower">Layout: Lower Primary</option>
                        </select>
                        {view && <button onClick={() => openPrint(`Timetable — ${name}`, classSheetHtml(view, entries, name, schoolName(), '', layoutFor(view)), SHEET_CSS + LOWER_CSS, blocked)} style={st.secondary}><Icon name="printer" />Print</button>}
                        <button onClick={printAll} style={st.secondary}><Icon name="printer-fill" />Print all classes</button>
                        <span style={st.blockBox}>
                            <select style={{ ...st.select, padding: '6px 8px' }} value={blockSection} onChange={e => setBlockSection(e.target.value)} aria-label="Section for the block timetable">
                                {blockSections.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}
                            </select>
                            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Teacher numbers in the cells, with a key at the bottom">
                                <input type="checkbox" checked={blockTeachers} onChange={e => setBlockTeachers(e.target.checked)} />teacher nos.
                            </label>
                            <button onClick={printBlock} disabled={!blockSection} style={st.secondary}><Icon name="grid-3x3" />Block timetable</button>
                        </span>
                    </span>
                </div>
                {isAdmin && view && view.slots.length > 0 && (
                    <div style={{ ...st.bar, marginTop: '4px' }}>
                        <button onClick={() => fill(true)} style={st.secondary} title="Fill the empty periods, keeping what is already placed"><Icon name="magic" />Auto-fill empty periods</button>
                        <button onClick={() => fill(false)} style={st.secondary} title="Replace everything with a fresh arrangement"><Icon name="arrow-repeat" />Start again</button>
                        {entries.length > 0 && <button onClick={() => { if (window.confirm('Clear every lesson from this class? (Nothing is saved until you press Save.)')) setEntries([]); }} style={{ ...st.secondary, color: '#b02a37', borderColor: '#b02a37' }}><Icon name="eraser" />Clear</button>}
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            {dirty && <button onClick={() => setEntries(view.entries)} style={st.secondary}>Undo changes</button>}
                            <button onClick={save} disabled={!dirty || saving} style={{ ...st.primary, opacity: dirty && !saving ? 1 : 0.5 }}><Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save timetable'}</button>
                        </span>
                    </div>
                )}
                {notice && <p style={st.info}><Icon name="info-circle-fill" />{notice}</p>}
            </div>

            {!view ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : !view.slots.length ? (
                <div style={st.panel}><p style={{ margin: 0 }}>No bell times are set for {view.sectionName} yet.{isAdmin ? ' Add them on the Setup tab.' : ' Ask the admin to set them.'}</p></div>
            ) : (
                <div style={st.twoCol}>
                    <div style={{ ...st.panel, overflowX: 'auto', minWidth: 0 }}>
                        <table style={st.grid}>
                            <thead><tr><th style={{ ...st.gth, width: '92px' }}>Time</th>{view.days.map(d => <th key={d.day} style={st.gth}>{d.name}</th>)}</tr></thead>
                            <tbody>
                                {view.slots.map(s => s.lesson ? (
                                    <tr key={s.slotId}>
                                        <td style={st.timeCell}>{hhmm(s.start)}–{hhmm(s.end)}<div style={st.small}>{s.label}</div></td>
                                        {view.days.map(d => {
                                            const e = at(d.day, s.slotId);
                                            const key = `${d.day}:${s.slotId}`;
                                            const clash = clashes.get(key);
                                            const rule = ruleIssues.get(key);
                                            const open = isAdmin && editing === key;
                                            return (
                                                <td key={d.day} onClick={() => isAdmin && !open && setEditing(key)}
                                                    title={clash ? `Clash: ${e?.teacherName} teaches ${clash.className} ${clash.subjectName} ${hhmm(clash.start)}–${hhmm(clash.end)}` : rule || ''}
                                                    style={{ ...st.cell, backgroundColor: clash ? '#fdecee' : rule ? '#fff3cd' : e ? colourOf(e.subjectId) : 'white', outline: clash ? '2px solid #dc3545' : rule ? '2px solid #fd7e14' : open ? '2px solid #1F3864' : 'none', cursor: isAdmin ? 'pointer' : 'default' }}>
                                                    {open ? (
                                                        <select autoFocus style={st.cellSelect} value={e?.subjectId ?? ''} onChange={ev => setCell(d.day, s.slotId, ev.target.value)} onBlur={() => setEditing(null)} aria-label={`${d.name} ${s.label}`}>
                                                            <option value="">— free —</option>
                                                            {view.subjects.map(x => <option key={x.subjectId} value={String(x.subjectId)}>{x.subjectName}{x.lessons ? ` (${placedOf(x.subjectId)}/${x.lessons})` : ''}{ruleText(x) ? ` · ${ruleText(x)}` : ''}</option>)}
                                                        </select>
                                                    ) : e ? (
                                                        <>
                                                            <div style={{ fontWeight: 700, fontSize: '12px' }}>{e.subjectName}</div>
                                                            <div style={{ ...st.small, color: e.teacherName ? '#555' : '#b02a37' }}>{e.teacherName || 'no teacher'}{(clash || rule) && ' ⚠'}</div>
                                                        </>
                                                    ) : isAdmin ? <span style={{ color: '#ccc' }}>+</span> : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ) : (
                                    <tr key={s.slotId}>
                                        <td style={{ ...st.timeCell, backgroundColor: '#f1f1f1' }}>{hhmm(s.start)}–{hhmm(s.end)}</td>
                                        <td colSpan={view.days.length} style={st.breakCell}>{s.label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {clashes.size > 0 && <p style={{ ...st.info, backgroundColor: '#fdecee', color: '#b02a37' }}><Icon name="exclamation-triangle-fill" />{clashes.size} lesson(s) clash with the teacher's other classes (red). Move them before saving.</p>}
                        {ruleIssues.size > 0 && <p style={{ ...st.info, backgroundColor: '#fff3cd', color: '#856404' }}><Icon name="exclamation-circle-fill" />{ruleIssues.size} lesson(s) break a subject rule (orange): {[...new Set(ruleIssues.values())].join('; ')}. Move them before saving.</p>}
                    </div>

                    <div style={{ ...st.panel, minWidth: 0 }}>
                        <h4 style={st.h4}>Lessons per week</h4>
                        {!view.subjects.length && <p style={st.muted}>This class has no subjects yet (Class Subjects page).</p>}
                        {view.subjects.map(x => {
                            const n = placedOf(x.subjectId);
                            const ok = x.lessons ? n === x.lessons : true;
                            return (
                                <div key={x.subjectId} style={st.countRow}>
                                    <span style={{ ...st.dot, backgroundColor: colourOf(x.subjectId) }} />
                                    <span style={{ flex: 1 }}>{x.subjectName}<div style={{ ...st.small, color: x.teacherName ? '#888' : '#b02a37' }}>{x.teacherName || 'no teacher assigned'}{ruleText(x) && <span style={{ color: '#1F3864' }}> · {ruleText(x)}</span>}</div></span>
                                    <strong style={{ color: ok ? '#1e7e34' : n > x.lessons ? '#b02a37' : '#fd7e14' }}>{n}{x.lessons ? `/${x.lessons}` : ''}</strong>
                                </div>
                            );
                        })}
                        {wanted > lessonPeriods && <p style={{ ...st.small, color: '#b02a37' }}>{wanted} lessons wanted but only {lessonPeriods} lesson periods a week.</p>}
                        {view.subjects.some(x => !x.lessons) && isAdmin && <p style={st.small}>Subjects without a number: set lessons per week on Setup.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Setup: bell times and lessons per week ──────────────────────────────────
function SetupTab({ setError, flash }) {
    const [data, setData] = useState(null);
    const [section, setSection] = useState('');
    const [rows, setRows] = useState([]);
    const [grade, setGrade] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [counts, setCounts] = useState({});           // subjectId → { lessons, latestEnd, doubles }
    const [savedCounts, setSavedCounts] = useState({});
    const [showGuide, setShowGuide] = useState(false);
    const [saving, setSaving] = useState('');

    const loadSlots = useCallback(async () => {
        try {
            const r = await api.get('/api/timetable/slots');
            setData(r.data);
            setSection(s => s || r.data.sections[0]?.code || '');
        } catch (err) { setError(serverMessage(err, 'Could not load bell times.')); }
    }, [setError]);
    useEffect(() => { loadSlots(); }, [loadSlots]);
    useEffect(() => {
        const sec = data?.sections.find(x => x.code === section);
        setRows(sec ? sec.slots.map(s => ({ label: s.label, start: hhmm(s.start), end: hhmm(s.end), lesson: s.lesson })) : []);
    }, [data, section]);
    useEffect(() => { api.get('/api/subjects').then(r => setSubjects(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load subjects.'))); }, [setError]);
    useEffect(() => { if (!grade && GRADE_ORDER_LIVE.length) setGrade(GRADE_ORDER_LIVE[0]); }, [grade]);
    useEffect(() => {
        if (!grade) return;
        api.get(`/api/timetable/lessons/${grade}`).then(r => {
            const m = Object.fromEntries((r.data || []).map(x => [String(x.subjectId), { lessons: x.lessons ? String(x.lessons) : '', latestEnd: hhmm(x.latestEnd || ''), doubles: !!x.doublesAllowed }]));
            setCounts(m); setSavedCounts(m);
        }).catch(err => setError(serverMessage(err, 'Could not load lessons per week.')));
    }, [grade, setError]);

    const saved = data?.sections.find(x => x.code === section)?.slots || [];
    const slotsDirty = JSON.stringify(rows) !== JSON.stringify(saved.map(s => ({ label: s.label, start: hhmm(s.start), end: hhmm(s.end), lesson: s.lesson })));
    const setRow = (i, patch) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    const addRow = (lesson) => setRows(rs => {
        const last = rs[rs.length - 1];
        const len = lesson ? (rs.filter(r => r.lesson).slice(-1)[0] ? minutesBetween(rs.filter(r => r.lesson).slice(-1)[0].start, rs.filter(r => r.lesson).slice(-1)[0].end) : 35) : 20;
        const start = last ? last.end : '08:00';
        const n = rs.filter(r => r.lesson).length + 1;
        return [...rs, { label: lesson ? `Lesson ${n}` : 'Break', start, end: addMinutes(start, len), lesson }];
    });
    const removeRow = (i) => setRows(rs => rs.filter((_, k) => k !== i));
    const saveSlots = async () => {
        const bad = rows.find(r => !r.label.trim() || !r.start || !r.end || r.start >= r.end);
        if (bad) { setError(`Check "${bad.label || 'a period'}": it needs a name and an end time after its start.`); return; }
        const removedLessons = saved.filter(s => s.lesson).length - rows.filter(r => r.lesson).length;
        if (removedLessons > 0 && !window.confirm(`${removedLessons} lesson period(s) fewer than before. Lessons already placed in removed periods will be cleared from class timetables. Continue?`)) return;
        setSaving('slots');
        try { const r = await api.put(`/api/timetable/slots/${section}`, rows.map(r => ({ ...r, label: r.label.trim() }))); flash(r.data.message); await loadSlots(); }
        catch (err) { setError(serverMessage(err, 'Failed to save bell times.')); }
        setSaving('');
    };

    const gradeSection = SECTION_OF_GRADE_LIVE[grade];
    const gradeSubjects = subjects.filter(s => SECTION_OF_GRADE_LIVE[String(s.gradeLevel || '').toUpperCase()] === gradeSection)
        .sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));
    const rowOf = (m, id) => ({ lessons: '', latestEnd: '', doubles: false, ...(m[String(id)] || {}) });
    const setRule = (id, patch) => setCounts(c => ({ ...c, [String(id)]: { ...rowOf(c, id), ...patch } }));
    const countsDirty = gradeSubjects.some(s => JSON.stringify(rowOf(counts, s.subjectId)) !== JSON.stringify(rowOf(savedCounts, s.subjectId)));
    const total = gradeSubjects.reduce((sum, s) => sum + (Number(rowOf(counts, s.subjectId).lessons) || 0), 0);
    const payload = () => gradeSubjects.map(s => { const r = rowOf(counts, s.subjectId); return { subjectId: s.subjectId, lessons: Number(r.lessons) || 0, latestEnd: r.latestEnd || null, doublesAllowed: !!r.doubles }; });
    const sameSectionGrades = GRADE_ORDER_LIVE.filter(g => g !== grade && SECTION_OF_GRADE_LIVE[g] === gradeSection);
    const copyToSection = async () => {
        if (!sameSectionGrades.length) return;
        if (!window.confirm(`Copy these numbers and rules to ${sameSectionGrades.map(g => GRADE_LABELS_LIVE[g] || g).join(', ')}? Their current numbers and rules will be replaced.`)) return;
        setSaving('copy');
        try {
            await api.put(`/api/timetable/lessons/${grade}`, payload());
            for (const g of sameSectionGrades) await api.put(`/api/timetable/lessons/${g}`, payload());
            setSavedCounts(counts);
            flash(`Saved for ${[grade, ...sameSectionGrades].map(g => GRADE_LABELS_LIVE[g] || g).join(', ')}.`);
        } catch (err) { setError(serverMessage(err, 'Failed to copy.')); }
        setSaving('');
    };
    const sectionPeriods = (data?.sections.find(x => x.code === gradeSection)?.slots || []).filter(s => s.lesson).length * 5;
    const saveCounts = async () => {
        setSaving('counts');
        try {
            const r = await api.put(`/api/timetable/lessons/${grade}`, payload());
            flash(r.data.message); setSavedCounts(counts);
        } catch (err) { setError(serverMessage(err, 'Failed to save lessons per week.')); }
        setSaving('');
    };

    if (!data) return <p style={st.center}><Icon name="hourglass-split" />Loading…</p>;
    return (
        <div style={st.twoCol}>
            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="bell-fill" />Bell times</h4>
                <p style={st.small}>Each section has its own day, because lesson lengths differ. Every class in the section follows it, Monday to Friday.</p>
                <div style={st.pills}>
                    {data.sections.map(x => {
                        const sec = SECTIONS_LIVE.find(s => s.code === x.code);
                        return <button key={x.code} onClick={() => { if (!slotsDirty || window.confirm('Discard unsaved bell times?')) setSection(x.code); }}
                            style={{ ...st.pill, backgroundColor: section === x.code ? (sec?.color || '#1F3864') : 'white', color: section === x.code ? 'white' : '#1F3864', borderColor: sec?.color || '#1F3864' }}>{x.name} ({x.slots.filter(s => s.lesson).length})</button>;
                    })}
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...st.grid, minWidth: '460px' }}>
                        <thead><tr><th style={st.gth}>Period</th><th style={st.gth}>Starts</th><th style={st.gth}>Ends</th><th style={st.gth}>Mins</th><th style={st.gth}>Lesson?</th><th style={st.gth}></th></tr></thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} style={{ backgroundColor: r.lesson ? 'white' : '#f5f5f5' }}>
                                    <td style={st.td}><input style={st.input} value={r.label} maxLength={40} onChange={e => setRow(i, { label: e.target.value })} aria-label="Period name" /></td>
                                    <td style={st.td}><input type="time" style={st.input} value={r.start} onChange={e => setRow(i, { start: e.target.value })} aria-label="Starts" /></td>
                                    <td style={st.td}><input type="time" style={st.input} value={r.end} onChange={e => setRow(i, { end: e.target.value })} aria-label="Ends" /></td>
                                    <td style={{ ...st.td, color: r.start < r.end ? '#555' : '#b02a37' }}>{r.start && r.end ? minutesBetween(r.start, r.end) : ''}</td>
                                    <td style={{ ...st.td, textAlign: 'center' }}><input type="checkbox" checked={r.lesson} onChange={e => setRow(i, { lesson: e.target.checked })} aria-label="Lesson period" /></td>
                                    <td style={st.td}><button onClick={() => removeRow(i)} style={st.x} aria-label="Remove period"><i className="bi bi-x-lg" /></button></td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={6} style={{ ...st.td, textAlign: 'center', color: '#888' }}>No periods yet — add the first lesson.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div style={{ ...st.bar, marginTop: '10px' }}>
                    <button onClick={() => addRow(true)} style={st.link}><Icon name="plus-circle" />Add lesson</button>
                    <button onClick={() => addRow(false)} style={st.link}><Icon name="cup-hot" />Add break</button>
                    <button onClick={saveSlots} disabled={!slotsDirty || !!saving} style={{ ...st.primary, marginLeft: 'auto', opacity: slotsDirty && !saving ? 1 : 0.5 }}><Icon name="save-fill" />Save bell times</button>
                </div>
            </div>

            <div style={st.panel}>
                <h4 style={st.h4}><Icon name="list-ol" />Lessons per week and subject rules</h4>
                <p style={st.small}>For every stream of the grade. <b>Must end by</b>: every lesson of the subject finishes by this time (e.g. Mathematics 12:00 = mornings only). <b>Doubles</b>: two lessons back-to-back allowed. Auto-fill and saving both follow these rules.</p>
                <select style={{ ...st.select, marginBottom: '10px' }} value={grade} onChange={e => { if (!countsDirty || window.confirm('Discard unsaved numbers?')) setGrade(e.target.value); }} aria-label="Grade">
                    {GRADE_ORDER_LIVE.map(g => <option key={g} value={g}>{GRADE_LABELS_LIVE[g] || g}</option>)}
                </select>
                {!gradeSubjects.length && <p style={st.muted}>No subjects for this section yet (Subjects page).</p>}
                {gradeSubjects.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ ...st.grid, minWidth: '380px', tableLayout: 'auto' }}>
                            <thead><tr><th style={{ ...st.gth, textAlign: 'left' }}>Subject</th><th style={st.gth}>A week</th><th style={st.gth}>Must end by</th><th style={st.gth}>Doubles</th></tr></thead>
                            <tbody>
                                {gradeSubjects.map(s => {
                                    const r = rowOf(counts, s.subjectId);
                                    return (
                                        <tr key={s.subjectId}>
                                            <td style={st.td}>{s.subjectName}</td>
                                            <td style={st.td}><input type="number" min="0" max="20" style={{ ...st.input, width: '64px' }} value={r.lessons} placeholder="0"
                                                onChange={e => setRule(s.subjectId, { lessons: e.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label={`Lessons a week for ${s.subjectName}`} /></td>
                                            <td style={st.td}><span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <input type="time" style={{ ...st.input, width: '110px' }} value={r.latestEnd} onChange={e => setRule(s.subjectId, { latestEnd: e.target.value })} aria-label={`${s.subjectName} must end by`} />
                                                {r.latestEnd && <button onClick={() => setRule(s.subjectId, { latestEnd: '' })} style={st.x} aria-label="Any time"><i className="bi bi-x" /></button>}
                                            </span></td>
                                            <td style={{ ...st.td, textAlign: 'center' }}><input type="checkbox" checked={r.doubles} onChange={e => setRule(s.subjectId, { doubles: e.target.checked })} aria-label={`Double lessons allowed for ${s.subjectName}`} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <p style={{ ...st.small, color: sectionPeriods && total > sectionPeriods ? '#b02a37' : '#555' }}>
                    Total {total} lessons a week{sectionPeriods ? ` · ${sectionPeriods} lesson periods in the week` : ' · set bell times for this section first'}.
                </p>
                <div style={{ ...st.bar, marginTop: '6px' }}>
                    <button onClick={saveCounts} disabled={!countsDirty || !!saving} style={{ ...st.primary, opacity: countsDirty && !saving ? 1 : 0.5 }}><Icon name="save-fill" />Save</button>
                    {sameSectionGrades.length > 0 && gradeSubjects.length > 0 && (
                        <button onClick={copyToSection} disabled={!!saving} style={st.secondary} title="Same numbers and rules for every grade in this section">
                            <Icon name="copy" />Save and copy to {sameSectionGrades.map(g => GRADE_LABELS_LIVE[g] || g).join(', ')}
                        </button>
                    )}
                </div>

                <div style={{ ...st.info, marginTop: '14px' }}>
                    <button onClick={() => setShowGuide(v => !v)} style={{ ...st.link, color: '#1F3864' }}><Icon name={showGuide ? 'chevron-down' : 'chevron-right'} />Ministry of Education timetabling guidelines (summary)</button>
                    {showGuide && (
                        <div style={{ fontSize: '12px', lineHeight: 1.5, marginTop: '6px' }}>
                            <div>• <b>Pre-primary</b>: 5 lessons a day, 25 a week (with religious programme), 30 minutes each; no double lessons.</div>
                            <div>• <b>Grades 1–3</b>: 30-minute lessons; no double lessons; breaks after every two lessons.</div>
                            <div>• <b>Grades 4–6</b>: 7 lessons a day + PPI = 35 a week, 35 minutes each; no double lessons; breaks after every two lessons (20 min, then 30 min, then lunch).</div>
                            <div>• <b>Grades 7–9</b>: 8 lessons a day + PPI, 40 minutes each; doubles only for practical areas (e.g. Integrated Science, Creative Arts &amp; Sports, Pre-Technical Studies, Agriculture).</div>
                            <div>• Balance learning areas between morning and afternoon across the week; similar learning areas should not follow one another.</div>
                            <div style={{ marginTop: '6px', color: '#666' }}>Summarised from news reports of the Ministry's <i>Guidelines for Timetabling and Curriculum Based Establishment</i>. Weekly totals differ between versions, so take lessons per subject from the school's official copy.</div>
                        </div>
                    )}
                </div>
            </div>
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
    info: { backgroundColor: '#e8f1fb', color: '#1F3864', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', margin: '8px 0 0' },
    tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
    tab: { padding: '9px 14px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(240px, 1fr)', gap: '12px', alignItems: 'start' },
    bar: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    select: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' },
    input: { padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px 0' },
    x: { background: 'none', border: 'none', color: '#b02a37', cursor: 'pointer' },
    grid: { width: '100%', borderCollapse: 'collapse', minWidth: '640px', tableLayout: 'fixed' },
    gth: { backgroundColor: '#1F3864', color: 'white', padding: '8px 6px', fontSize: '12px', textAlign: 'center' },
    td: { padding: '5px', borderBottom: '1px solid #eee', fontSize: '13px' },
    timeCell: { padding: '6px', border: '1px solid #e3e7ee', backgroundColor: '#eef3fb', fontSize: '12px', fontWeight: 700, color: '#1F3864', textAlign: 'center' },
    cell: { padding: '6px', border: '1px solid #e3e7ee', textAlign: 'center', height: '46px', verticalAlign: 'middle' },
    breakCell: { padding: '5px', border: '1px solid #e3e7ee', backgroundColor: '#f1f1f1', color: '#666', fontStyle: 'italic', textAlign: 'center', fontSize: '12px' },
    cellSelect: { width: '100%', padding: '4px', fontSize: '12px' },
    h4: { color: '#1F3864', margin: '0 0 8px', fontSize: '15px' },
    countRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    dot: { width: '12px', height: '12px', borderRadius: '3px', border: '1px solid #ccc', flexShrink: 0 },
    small: { fontSize: '11px', color: '#777' },
    muted: { fontSize: '13px', color: '#888' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
    chip: { backgroundColor: '#e8f5e9', color: '#1e7e34', borderRadius: '14px', padding: '4px 10px', fontSize: '13px' },
    pills: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
    pill: { padding: '6px 12px', border: '1px solid', borderRadius: '16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
    blockBox: { display: 'flex', alignItems: 'center', gap: '6px', border: '1px dashed #1F3864', borderRadius: '8px', padding: '3px 6px' },
    weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: '8px', minWidth: '680px' },
    dayCol: { backgroundColor: '#fafbfd', borderRadius: '8px', padding: '8px', minHeight: '120px' },
    dayHead: { fontWeight: 700, color: '#1F3864', textAlign: 'center', marginBottom: '8px' },
    lessonCard: { border: '1px solid #e3e7ee', borderRadius: '6px', padding: '6px 8px', marginBottom: '6px', fontSize: '13px' },
};

export default Timetable;
