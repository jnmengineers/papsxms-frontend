import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { letterheadHtml } from '../utils/school';
import { SECTION_OF_GRADE_LIVE, SECTION_NAMES_LIVE, SECTION_COLORS_LIVE, GRADE_ORDER_LIVE, SECTION_CODES } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { examDate: '', startTime: '', endTime: '', venue: '', examId: '', classId: '', subjectId: '' };

const norm = (v) => String(v ?? '').trim().toLowerCase();
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');              // "08:00:00" → "08:00"
const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');
// Parse as a LOCAL date (plain "2026-03-12" is read as UTC and can show the day before)
const localDate = (d) => { const dt = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(dt) ? null : dt; };
const fmtLongDate = (d) => { const dt = localDate(d); return dt ? dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'No date set'; };
const fmtShortDate = (d) => { const dt = localDate(d); return dt ? dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'; };
const overlaps = (s1, e1, s2, e2) => hhmm(s1) < hhmm(e2) && hhmm(s2) < hhmm(e1);
const gradeOfClass = (c) => c?.gradeLevel || (String(c?.className || '').toUpperCase().match(/^(PP[12]|PG|G[1-9])(?![0-9])/) || [])[1] || '';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const bySchedule = (a, b) => toDateInput(a.examDate).localeCompare(toDateInput(b.examDate)) || hhmm(a.startTime).localeCompare(hhmm(b.startTime)) ||
    classDisplayName(a.schoolClass || {}).localeCompare(classDisplayName(b.schoolClass || {}));

// Outside parent — prevents keyboard dismiss on mobile
const ScheduleForm = ({ formData, setFormData, exams, classes, subjectOptions, subjectsNote, examForForm, onSubmit, onCancel, submitLabel, submitIcon, saving }) => {
    // Only offer classes the exam applies to
    const classOptions = !examForForm || !examForForm.classLevel || examForForm.classLevel === 'ALL'
        ? classes : classes.filter(c => gradeOfClass(c) === examForForm.classLevel);
    return (
        <form onSubmit={onSubmit} style={{ marginTop: '10px' }}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="file-earmark-text" />Exam</label>
                    <select style={styles.input} value={formData.examId} required
                        onChange={e => setFormData(prev => ({ ...prev, examId: e.target.value }))}>
                        <option value="">Select Exam</option>
                        {exams.map(ex => <option key={ex.examId} value={String(ex.examId)}>{ex.examName} — Term {ex.term} {ex.academicYear}{ex.classLevel && ex.classLevel !== 'ALL' ? ` (${ex.classLevel})` : ''}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="building" />Class</label>
                    <select style={styles.input} value={formData.classId} required
                        onChange={e => setFormData(prev => ({ ...prev, classId: e.target.value, subjectId: '' }))}>
                        <option value="">Select Class</option>
                        {classOptions.map(cls => <option key={cls.classId} value={String(cls.classId)}>{classDisplayName(cls)}</option>)}
                    </select>
                    {examForForm && examForForm.classLevel && examForForm.classLevel !== 'ALL' && <span style={styles.fieldHint}>Only {examForForm.classLevel} classes sit this exam</span>}
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="book" />Subject</label>
                    <select style={styles.input} value={formData.subjectId} required disabled={!formData.classId}
                        onChange={e => setFormData(prev => ({ ...prev, subjectId: e.target.value }))}>
                        <option value="">{formData.classId ? 'Select Subject' : 'Select class first'}</option>
                        {subjectOptions.map(sub => <option key={sub.subjectId} value={String(sub.subjectId)}>{sub.subjectName}{sub.subjectCode ? ` (${sub.subjectCode})` : ''}</option>)}
                    </select>
                    {subjectsNote && <span style={styles.fieldHint}>{subjectsNote}</span>}
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="calendar-event" />Exam Date</label>
                    <input type="date" style={styles.input} value={formData.examDate} required
                        min={toDateInput(examForForm?.startDate) || undefined} max={toDateInput(examForForm?.endDate) || undefined}
                        onChange={e => setFormData(prev => ({ ...prev, examDate: e.target.value }))} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="clock" />Start Time</label>
                    <input type="time" style={styles.input} value={formData.startTime} required
                        onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="clock-history" />End Time</label>
                    <input type="time" style={styles.input} value={formData.endTime} required min={formData.startTime || undefined}
                        onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="geo-alt" />Venue</label>
                    <input style={styles.input} value={formData.venue} maxLength={60}
                        onChange={e => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                        placeholder="e.g. Hall 1, Classroom 3A" />
                </div>
            </div>
            <div style={styles.btnGroup}>
                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                    <Icon name={saving ? 'hourglass-split' : submitIcon} />{saving ? 'Saving...' : submitLabel}
                </button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Cancel</button>
            </div>
        </form>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// AUTOMATIC TIMETABLE GENERATOR
// You choose the exam and a start date; it reads each class's subjects and lays
// out a timetable that follows these rules:
//   • all streams of a grade sit the same paper at the same time (no leaks)
//   • a class never has two papers at once, and existing sessions are avoided
//   • core subjects (Maths, English, Kiswahili, Science) go in morning slots,
//     one per day, so the heaviest papers aren't bunched together
//   • younger learners get shorter papers (length set per section)
//   • weekends are skipped
// Nothing is saved until you review the preview and click Save.
// ══════════════════════════════════════════════════════════════════════════════
const CORE_KEYWORDS = ['math', 'english', 'kiswahili', 'science'];
// Sections and grades come from School Settings
const SECTION_OF_GRADE = SECTION_OF_GRADE_LIVE;
const SECTION_NAMES = SECTION_NAMES_LIVE;
const GRADE_ORDER = GRADE_ORDER_LIVE;
// Suggested paper length by section position (youngest first); changed on screen before generating
const defaultMinutes = (sec) => [45, 60, 90, 120][SECTION_CODES.indexOf(sec)] ?? 90;
const SLOT_PRESETS = {
    two: { label: '2 papers a day (8:00, 11:00)', times: ['08:00', '11:00'] },
    three: { label: '3 papers a day (8:00, 10:30, 14:00)', times: ['08:00', '10:30', '14:00'] },
};

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const addMinutes = (hm, mins) => {
    const [h, m] = String(hm).split(':').map(Number);
    const t = h * 60 + m + Number(mins);
    return `${pad2(Math.floor(t / 60) % 24)}:${pad2(t % 60)}`;
};
const coreRank = (name) => { const n = norm(name); const i = CORE_KEYWORDS.findIndex(k => n.includes(k)); return i === -1 ? 99 : i; };

// School days from the start date (weekends optional)
const schoolDays = (startISO, skipWeekends, count) => {
    const out = [];
    const dt = localDate(startISO);
    if (!dt) return out;
    let guard = 0;
    while (out.length < count && guard++ < 400) {
        const dow = dt.getDay();
        if (!skipWeekends || (dow !== 0 && dow !== 6)) out.push(toISO(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return out;
};

const runLimited = async (items, limit, job, onProgress) => {
    const out = new Array(items.length);
    let next = 0, done = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            try { out[i] = { ok: true, value: await job(items[i]) }; }
            catch (err) { out[i] = { ok: false, error: err }; }
            onProgress?.(++done, items.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

/**
 * Pure scheduling function (no network) — easy to test.
 * groups:   [{ grade, section, classes: [cls], subjects: [{ subject, classes: [cls] }] }]
 * busy:     { [classId]: [{ date, start, end }] }  existing sessions to avoid
 */
const buildTimetable = ({ groups, busy, startDate, skipWeekends, slotTimes, durations, maxPerDay }) => {
    const days = schoolDays(startDate, skipWeekends, 120);
    const taken = {};
    Object.entries(busy).forEach(([id, list]) => { taken[id] = [...list]; });
    const papers = [];
    const perDay = Math.max(1, Math.min(maxPerDay, slotTimes.length));

    groups.forEach(group => {
        const list = [...group.subjects].sort((a, b) =>
            coreRank(a.subject.subjectName) - coreRank(b.subject.subjectName) ||
            String(a.subject.subjectName).localeCompare(String(b.subject.subjectName)));
        if (!list.length) return;
        const numDays = Math.ceil(list.length / perDay);
        const dur = durations[group.section] || defaultMinutes(group.section);

        list.forEach((item, i) => {
            // Round-robin across days: subject 1 → day 1 slot 1, subject 2 → day 2 slot 1, …
            // so core subjects (sorted first) land in morning slots on different days
            let day = i % numDays;
            let slot = Math.floor(i / numDays);
            for (let tries = 0; tries < 2000; tries++) {
                if (slot >= perDay) { slot = 0; day++; }
                if (day >= days.length) break;
                const date = days[day], start = slotTimes[slot], end = addMinutes(start, dur);
                const clash = item.classes.some(c => (taken[c.classId] || []).some(b => b.date === date && overlaps(b.start, b.end, start, end)));
                const dayCount = papers.filter(p => p.grade === group.grade && p.date === date).length;
                if (!clash && dayCount < perDay) {
                    papers.push({ key: `${group.grade}_${item.subject.subjectId}`, date, start, end, grade: group.grade, section: group.section, subject: item.subject, classes: item.classes });
                    item.classes.forEach(c => { (taken[c.classId] = taken[c.classId] || []).push({ date, start, end }); });
                    return;
                }
                slot++;
            }
        });
    });
    return papers.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) ||
        GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
};

const TimetableGenerator = ({ exams, classes, schedules, onClose, onSaved }) => {
    const [examId, setExamId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [classIds, setClassIds] = useState([]);
    const [skipWeekends, setSkipWeekends] = useState(true);
    const [preset, setPreset] = useState('three');
    const [slotTimes, setSlotTimes] = useState(SLOT_PRESETS.three.times);
    const [durations, setDurations] = useState({});   // empty = each section's suggested length
    const [venueMode, setVenueMode] = useState('own');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [plan, setPlan] = useState(null);
    const [busyMsg, setBusyMsg] = useState('');
    const [genError, setGenError] = useState('');
    const [progress, setProgress] = useState(null);
    const subjectCache = useRef({});

    const exam = exams.find(e => String(e.examId) === String(examId));
    const eligible = !exam ? [] : (exam.classLevel && exam.classLevel !== 'ALL' ? classes.filter(c => gradeOfClass(c) === exam.classLevel) : classes);

    // Picking an exam selects all its classes and suggests its first day
    const chooseExam = (id) => {
        setExamId(id); setPlan(null); setGenError('');
        const ex = exams.find(e => String(e.examId) === String(id));
        const el = !ex ? [] : (ex.classLevel && ex.classLevel !== 'ALL' ? classes.filter(c => gradeOfClass(c) === ex.classLevel) : classes);
        setClassIds(el.map(c => String(c.classId)));
        const today = toISO(new Date());
        const examStart = toDateInput(ex?.startDate);
        setStartDate(examStart && examStart > today ? examStart : today);
    };

    const choosePreset = (p) => { setPreset(p); setSlotTimes(SLOT_PRESETS[p].times); setPlan(null); };
    const toggleClass = (id) => { setPlan(null); setClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

    const gradesOfEligible = [...new Set(eligible.map(c => gradeOfClass(c) || `#${c.classId}`))]
        .sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));

    const generate = async () => {
        setGenError(''); setPlan(null);
        if (!exam || !startDate) { setGenError('Choose the exam and the first exam day.'); return; }
        const sel = eligible.filter(c => classIds.includes(String(c.classId)));
        if (!sel.length) { setGenError('Tick at least one class.'); return; }
        setBusyMsg('Reading each class\'s subjects…');
        const need = sel.filter(c => !subjectCache.current[c.classId]);
        const outs = await Promise.allSettled(need.map(c => api.get(`/api/class-subjects/by-class/${c.classId}`)));
        outs.forEach((o, i) => { subjectCache.current[need[i].classId] = o.status === 'fulfilled' ? (o.value.data || []).map(cs => cs.subject).filter(Boolean) : null; });
        setBusyMsg('');

        const failedLoad = sel.filter(c => subjectCache.current[c.classId] === null);
        const noSubjects = sel.filter(c => Array.isArray(subjectCache.current[c.classId]) && subjectCache.current[c.classId].length === 0);

        // Already-scheduled papers for this exam are kept and skipped
        const already = new Set(schedules.filter(s => String(s.exam?.examId) === String(examId))
            .map(s => `${s.schoolClass?.classId}_${s.subject?.subjectId}`));
        let skipped = 0;

        // Group by grade so streams of a grade write each paper together
        const byGrade = {};
        sel.forEach(c => {
            const g = gradeOfClass(c) || `#${c.classId}`;
            if (!byGrade[g]) byGrade[g] = { grade: g, section: SECTION_OF_GRADE[g] || c.section || 'OTHER', classes: [], subjects: {} };
            byGrade[g].classes.push(c);
            (subjectCache.current[c.classId] || []).forEach(s => {
                if (already.has(`${c.classId}_${s.subjectId}`)) { skipped++; return; }
                if (!byGrade[g].subjects[s.subjectId]) byGrade[g].subjects[s.subjectId] = { subject: s, classes: [] };
                byGrade[g].subjects[s.subjectId].classes.push(c);
            });
        });
        const groups = Object.values(byGrade).map(g => ({ ...g, subjects: Object.values(g.subjects) }));

        // Every existing session (any exam) blocks that class at that time
        const busy = {};
        schedules.forEach(s => {
            const id = s.schoolClass?.classId; if (id == null || !s.examDate) return;
            (busy[id] = busy[id] || []).push({ date: toDateInput(s.examDate), start: hhmm(s.startTime), end: hhmm(s.endTime) });
        });

        const papers = buildTimetable({ groups, busy, startDate, skipWeekends, slotTimes: [...slotTimes].sort(), durations, maxPerDay: slotTimes.length });
        const expected = groups.reduce((n, g) => n + g.subjects.length, 0);

        const warnings = [];
        if (failedLoad.length) warnings.push(`Couldn't read subjects for ${failedLoad.map(classDisplayName).join(', ')} — left out.`);
        if (noSubjects.length) warnings.push(`${noSubjects.map(classDisplayName).join(', ')} ha${noSubjects.length > 1 ? 've' : 's'} no subjects set up (Class Subjects page) — left out.`);
        if (skipped) warnings.push(`${skipped} paper(s) already scheduled for this exam were kept as they are.`);
        if (papers.length < expected) warnings.push(`${expected - papers.length} paper(s) could not be placed in the next few months — check the times.`);
        const lastDay = papers.length ? papers[papers.length - 1].date : null;
        if (lastDay && exam.endDate && lastDay > toDateInput(exam.endDate)) warnings.push(`The timetable runs to ${fmtShortDate(lastDay)}, after the exam's term ends (${fmtShortDate(exam.endDate)}). Try 3 papers a day or fewer classes.`);
        const sortedSlots = [...slotTimes].sort();
        const longest = Math.max(...sel.map(c => durations[SECTION_OF_GRADE[gradeOfClass(c)]] || defaultMinutes(SECTION_OF_GRADE[gradeOfClass(c)])));
        for (let i = 1; i < sortedSlots.length; i++) {
            if (addMinutes(sortedSlots[i - 1], longest) > sortedSlots[i]) {
                warnings.push(`A ${longest}-minute paper starting at ${sortedSlots[i - 1]} runs past the next start time (${sortedSlots[i]}). The generator avoids clashes by moving papers, which makes the timetable longer — consider spacing the times out.`);
                break;
            }
        }
        setPlan({ papers, warnings, days: [...new Set(papers.map(p => p.date))] });
    };

    const removePaper = (key) => setPlan(p => ({ ...p, papers: p.papers.filter(x => x.key !== key) }));

    const save = async () => {
        if (!plan?.papers.length) return;
        const rows = plan.papers.flatMap(p => p.classes.map(c => ({ p, c })));
        if (!window.confirm(`Save ${plan.papers.length} paper(s) as ${rows.length} class sessions over ${new Set(plan.papers.map(p => p.date)).size} day(s)?`)) return;
        setGenError('');
        setProgress({ done: 0, total: rows.length });
        const outs = await runLimited(rows, 5, ({ p, c }) => api.post('/api/exam-schedules', {
            examDate: p.date, startTime: p.start, endTime: p.end,
            venue: venueMode === 'own' ? `${classDisplayName(c)} classroom` : null,
            exam: { examId: Number(examId) }, schoolClass: { classId: Number(c.classId) }, subject: { subjectId: Number(p.subject.subjectId) }
        }), (done, total) => setProgress({ done, total }));
        setProgress(null);
        const failures = outs.map((o, i) => o.ok ? null : `${classDisplayName(rows[i].c)} — ${rows[i].p.subject.subjectName}: ${serverMessage(o.error, 'failed')}`).filter(Boolean);
        await onSaved(examId, rows.length - failures.length);
        if (failures.length) setGenError(`${rows.length - failures.length} saved, ${failures.length} failed:\n• ${failures.join('\n• ')}`);
        else onClose();
    };

    const planByDay = plan ? plan.papers.reduce((acc, p) => { (acc[p.date] = acc[p.date] || []).push(p); return acc; }, {}) : {};
    const saving = !!progress;

    return (
        <div style={gStyles.card}>
            <div style={gStyles.head}>
                <h3 style={gStyles.title}><Icon name="magic" />Generate Timetable Automatically</h3>
                <button onClick={onClose} style={gStyles.closeX} aria-label="Close" disabled={saving}><i className="bi bi-x-lg" /></button>
            </div>
            <p style={gStyles.lead}>Pick the exam and the first exam day. The system reads each class's subjects and builds the timetable. Nothing is saved until you check it and click <strong>Save</strong>.</p>

            {/* Step 1 — the only two required inputs */}
            <div style={gStyles.row}>
                <div style={styles.formGroup}>
                    <label style={styles.label}><span style={gStyles.step}>1</span>Exam</label>
                    <select style={styles.input} value={examId} onChange={e => chooseExam(e.target.value)}>
                        <option value="">Select Exam</option>
                        {exams.map(ex => <option key={ex.examId} value={String(ex.examId)}>{ex.examName} — Term {ex.term} {ex.academicYear}{ex.classLevel && ex.classLevel !== 'ALL' ? ` (${ex.classLevel})` : ''}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><span style={gStyles.step}>2</span>First exam day</label>
                    <input type="date" style={styles.input} value={startDate} onChange={e => { setStartDate(e.target.value); setPlan(null); }} disabled={!exam} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><span style={gStyles.step}>3</span>Papers per day</label>
                    <select style={styles.input} value={preset} onChange={e => choosePreset(e.target.value)}>
                        {Object.entries(SLOT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            {exam && (
                <>
                    <div style={gStyles.classBox}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            <strong style={{ color: '#1F3864', fontSize: '13px' }}><Icon name="building" />Classes ({classIds.length} of {eligible.length})</strong>
                            <span>
                                <button type="button" style={gStyles.linkBtn} onClick={() => { setClassIds(eligible.map(c => String(c.classId))); setPlan(null); }}>All</button>{' · '}
                                <button type="button" style={gStyles.linkBtn} onClick={() => { setClassIds([]); setPlan(null); }}>None</button>
                            </span>
                        </div>
                        <div style={gStyles.gradeWrap}>
                            {gradesOfEligible.map(g => (
                                <div key={g} style={gStyles.gradeCol}>
                                    <div style={gStyles.gradeLabel}>{g.startsWith('#') ? 'Other' : g}</div>
                                    {eligible.filter(c => (gradeOfClass(c) || `#${c.classId}`) === g).map(c => (
                                        <label key={c.classId} style={gStyles.checkRow}>
                                            <input type="checkbox" checked={classIds.includes(String(c.classId))} onChange={() => toggleClass(String(c.classId))} />
                                            {classDisplayName(c)}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button type="button" style={gStyles.advToggle} onClick={() => setShowAdvanced(s => !s)} aria-expanded={showAdvanced}>
                        <Icon name={showAdvanced ? 'chevron-down' : 'chevron-right'} />Adjust start times, paper lengths & venue (optional)
                    </button>
                    {showAdvanced && (
                        <div style={gStyles.advBox}>
                            <div style={gStyles.row}>
                                {slotTimes.map((t, i) => (
                                    <div key={i} style={styles.formGroup}>
                                        <label style={styles.label}>Paper {i + 1} starts</label>
                                        <input type="time" style={styles.input} value={t}
                                            onChange={e => { const v = e.target.value; setSlotTimes(prev => prev.map((x, j) => j === i ? v : x)); setPlan(null); }} />
                                    </div>
                                ))}
                            </div>
                            <div style={gStyles.row}>
                                {SECTION_CODES.map(sec => (
                                    <div key={sec} style={styles.formGroup}>
                                        <label style={styles.label}>{SECTION_NAMES[sec]} paper (min)</label>
                                        <input type="number" min="15" max="240" step="5" style={styles.input} value={durations[sec] ?? defaultMinutes(sec)}
                                            onChange={e => { setDurations(d => ({ ...d, [sec]: Number(e.target.value) || defaultMinutes(sec) })); setPlan(null); }} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
                                <label style={gStyles.checkRow}><input type="checkbox" checked={skipWeekends} onChange={e => { setSkipWeekends(e.target.checked); setPlan(null); }} />Skip Saturdays & Sundays</label>
                                <label style={gStyles.checkRow}><input type="radio" name="venue" checked={venueMode === 'own'} onChange={() => setVenueMode('own')} />Each class sits in its own classroom</label>
                                <label style={gStyles.checkRow}><input type="radio" name="venue" checked={venueMode === 'blank'} onChange={() => setVenueMode('blank')} />Leave venue blank</label>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                        <button onClick={generate} style={gStyles.genBtn} disabled={!!busyMsg || saving}>
                            <Icon name={busyMsg ? 'hourglass-split' : plan ? 'arrow-repeat' : 'magic'} />{busyMsg || (plan ? 'Generate again' : 'Generate Timetable')}
                        </button>
                    </div>
                </>
            )}

            {genError && <div style={{ ...styles.error, marginTop: '14px', whiteSpace: 'pre-line' }}><Icon name="exclamation-triangle-fill" />{genError}</div>}

            {/* Preview */}
            {plan && (
                <div style={{ marginTop: '18px' }}>
                    <div style={gStyles.summary}>
                        <span><Icon name="journal-text" /><strong>{plan.papers.length}</strong> paper(s)</span>
                        <span><Icon name="calendar-range" /><strong>{plan.days.length}</strong> day(s){plan.days.length ? `: ${fmtShortDate(plan.days[0])} – ${fmtShortDate(plan.days[plan.days.length - 1])}` : ''}</span>
                        <span><Icon name="people" /><strong>{plan.papers.reduce((n, p) => n + p.classes.length, 0)}</strong> class session(s)</span>
                    </div>
                    {plan.warnings.map((w, i) => <p key={i} style={gStyles.warn}><Icon name="exclamation-circle-fill" />{w}</p>)}

                    {plan.papers.length === 0 ? (
                        <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Nothing new to schedule.</p>
                    ) : Object.entries(planByDay).map(([date, list]) => (
                        <div key={date} style={{ marginBottom: '14px' }}>
                            <div style={{ ...styles.dateHeader, borderRadius: '10px 10px 0 0' }}>
                                <span><Icon name="calendar-event" />{fmtLongDate(date)}</span>
                                <span style={{ fontSize: '12px', opacity: 0.9 }}>{list.length} paper(s)</span>
                            </div>
                            <div style={styles.tableWrapper}>
                                <table style={{ ...styles.table, minWidth: '560px' }}>
                                    <thead><tr style={styles.tableHeader}>
                                        <th style={styles.th}>Time</th><th style={styles.th}>Grade</th><th style={styles.th}>Streams</th><th style={styles.th}>Subject</th><th style={styles.th}></th>
                                    </tr></thead>
                                    <tbody>
                                        {list.map((p, i) => (
                                            <tr key={p.key} style={{ backgroundColor: i % 2 ? 'white' : '#f9f9f9' }}>
                                                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}><strong>{p.start}</strong> – {p.end}</td>
                                                <td style={styles.td}><span style={styles.classBadge}>{p.grade.startsWith('#') ? '—' : p.grade}</span></td>
                                                <td style={{ ...styles.td, fontSize: '12px', color: '#555' }}>{p.classes.map(classDisplayName).join(', ')}</td>
                                                <td style={styles.td}>
                                                    {p.subject.subjectName}
                                                    {coreRank(p.subject.subjectName) < 99 && <span style={gStyles.coreTag}>core</span>}
                                                </td>
                                                <td style={styles.td}>
                                                    <button onClick={() => removePaper(p.key)} style={gStyles.removeBtn} disabled={saving} title="Leave this paper out" aria-label={`Leave out ${p.subject.subjectName} for ${p.grade}`}>
                                                        <i className="bi bi-x-lg" aria-hidden="true" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {progress && (
                        <div style={{ margin: '10px 0' }}>
                            <div style={gStyles.progressTrack}><div style={{ ...gStyles.progressFill, width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} /></div>
                            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>Saving {progress.done}/{progress.total}…</p>
                        </div>
                    )}
                    {plan.papers.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button onClick={save} style={{ ...styles.submitBtn, backgroundColor: '#28a745', opacity: saving ? 0.7 : 1 }} disabled={saving}>
                                <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : `Save Timetable (${plan.papers.length} papers)`}
                            </button>
                            <button onClick={onClose} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Discard</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const gStyles = {
    card: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #28a745' },
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: '#1F3864', margin: 0, fontWeight: 700 },
    closeX: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    lead: { color: '#555', fontSize: '13px', margin: '6px 0 16px' },
    row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px', marginBottom: '12px' },
    step: { backgroundColor: '#1F3864', color: 'white', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginRight: '6px' },
    classBox: { backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' },
    gradeWrap: { display: 'flex', flexWrap: 'wrap', gap: '14px' },
    gradeCol: { minWidth: '120px' },
    gradeLabel: { fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: '4px' },
    checkRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', padding: '2px 0' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0 },
    advToggle: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center' },
    advBox: { backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '12px 14px', marginTop: '6px' },
    genBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    summary: { display: 'flex', gap: '18px', flexWrap: 'wrap', backgroundColor: '#e8f5e9', color: '#1e5631', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px' },
    warn: { color: '#856404', backgroundColor: '#fff8e1', border: '1px solid #ffc107', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', margin: '0 0 8px' },
    coreTag: { marginLeft: '6px', backgroundColor: '#e3f2fd', color: '#1F3864', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' },
    removeBtn: { background: 'none', border: '1px solid #ddd', color: '#dc3545', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer' },
    progressTrack: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
};

// ══════════════════════════════════════════════════════════════════════════════
// TIMETABLE GRID — times across the top, one row per day + grade, subjects in the
// cells, one page per section (Pre-School, Lower Primary, Upper Primary, Junior)
// ══════════════════════════════════════════════════════════════════════════════
// Section order, titles and colours from School Settings; "OTHER" = classes with no known section
const sectionOrder = () => [...SECTION_CODES, 'OTHER'];
const SECTION_TITLES = new Proxy(SECTION_NAMES_LIVE, { get: (t, k) => (k in t ? t[k] : (k === 'OTHER' ? 'Other Classes' : undefined)) });
const SECTION_COLORS = new Proxy(SECTION_COLORS_LIVE, { get: (t, k) => (k in t ? t[k] : '#6c757d') });
const sectionOfClass = (c) => SECTION_OF_GRADE[gradeOfClass(c)] || (SECTION_TITLES[c?.section] ? c.section : 'OTHER');
const dayParts = (d) => {
    const dt = localDate(d);
    if (!dt) return { weekday: 'No date', date: '' };
    return { weekday: dt.toLocaleDateString('en-GB', { weekday: 'long' }), date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) };
};

/**
 * Turns schedule rows (one exam) into a grid per section:
 * [{ section, title, color, slots: [{start, end}], rows: [{date, grade, firstOfDate, span, cells: {start: [entry]}}] }]
 * entry = { subject, end, classes, partial }  — partial = only some streams of the grade sit it
 */
const buildSectionGrids = (list, allClasses) => {
    const streamsInGrade = {};
    allClasses.forEach(c => { const g = gradeOfClass(c) || `#${c.classId}`; streamsInGrade[g] = (streamsInGrade[g] || 0) + 1; });
    const bySec = {};
    list.forEach(s => {
        const cls = allClasses.find(c => String(c.classId) === String(s.schoolClass?.classId)) || s.schoolClass || {};
        const sec = sectionOfClass(cls);
        const grade = gradeOfClass(cls) || `#${cls.classId}`;
        const date = toDateInput(s.examDate) || 'none';
        const start = hhmm(s.startTime), end = hhmm(s.endTime);
        const S = (bySec[sec] = bySec[sec] || { slotEnds: {}, rows: {}, gradeNames: {} });
        S.gradeNames[grade] = grade.startsWith('#') ? classDisplayName(cls) : grade;
        S.slotEnds[start] = S.slotEnds[start] || {};
        S.slotEnds[start][end] = (S.slotEnds[start][end] || 0) + 1;
        const key = `${date}|${grade}`;
        const row = (S.rows[key] = S.rows[key] || { date, grade, cells: {} });
        const cell = (row.cells[start] = row.cells[start] || []);
        let entry = cell.find(e => String(e.subjectId) === String(s.subject?.subjectId) && e.end === end);
        if (!entry) { entry = { subjectId: s.subject?.subjectId, subject: s.subject?.subjectName || '?', end, classes: [] }; cell.push(entry); }
        entry.classes.push(cls);
    });
    return sectionOrder().filter(k => bySec[k]).map(k => {
        const S = bySec[k];
        // Column heading uses the most common end time for each start time
        const slots = Object.keys(S.slotEnds).sort().map(start => {
            const ends = S.slotEnds[start];
            return { start, end: Object.keys(ends).sort((a, b) => ends[b] - ends[a])[0] };
        });
        const rows = Object.values(S.rows).sort((a, b) => a.date.localeCompare(b.date) ||
            (GRADE_ORDER.indexOf(a.grade) === -1 ? 99 : GRADE_ORDER.indexOf(a.grade)) - (GRADE_ORDER.indexOf(b.grade) === -1 ? 99 : GRADE_ORDER.indexOf(b.grade)));
        rows.forEach((r, i) => {
            r.gradeName = S.gradeNames[r.grade];
            r.firstOfDate = i === 0 || rows[i - 1].date !== r.date;
            r.span = rows.filter(x => x.date === r.date).length;
            Object.values(r.cells).forEach(cell => cell.forEach(e => { e.partial = e.classes.length < (streamsInGrade[r.grade] || e.classes.length); }));
        });
        return { section: k, title: SECTION_TITLES[k], color: SECTION_COLORS[k], slots, rows };
    });
};

// On-screen version of one section page
const SectionGrid = ({ grid }) => (
    <div style={{ overflowX: 'auto', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: `${260 + grid.slots.length * 170}px` }}>
            <thead>
                <tr>
                    <th style={{ ...gridStyles.th, backgroundColor: grid.color }}>Day</th>
                    <th style={{ ...gridStyles.th, backgroundColor: grid.color }}>Grade</th>
                    {grid.slots.map(sl => (
                        <th key={sl.start} style={{ ...gridStyles.th, backgroundColor: grid.color, textAlign: 'center' }}>
                            <i className="bi bi-clock" aria-hidden="true" style={{ marginRight: '5px' }} />{sl.start} – {sl.end}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {grid.rows.map(r => {
                    const d = dayParts(r.date);
                    return (
                        <tr key={`${r.date}|${r.grade}`} style={{ borderTop: r.firstOfDate ? '2px solid #1F3864' : undefined }}>
                            {r.firstOfDate && (
                                <td rowSpan={r.span} style={gridStyles.dayCell}>
                                    <div style={{ fontWeight: 800, color: '#1F3864' }}>{d.weekday}</div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>{d.date}</div>
                                </td>
                            )}
                            <td style={gridStyles.gradeCell}>{r.gradeName}</td>
                            {grid.slots.map(sl => {
                                const cell = r.cells[sl.start] || [];
                                return (
                                    <td key={sl.start} style={{ ...gridStyles.cell, backgroundColor: cell.length ? '#f7fbff' : 'white' }}>
                                        {cell.length === 0 ? <span style={{ color: '#ccc' }}>—</span> : cell.map((e, i) => (
                                            <div key={i} style={{ marginTop: i ? '6px' : 0 }}>
                                                <strong style={{ color: '#1F3864' }}>{e.subject}</strong>
                                                {e.partial && <div style={gridStyles.note}>{e.classes.map(c => classDisplayName(c)).join(', ')} only</div>}
                                                {e.end !== sl.end && <div style={gridStyles.note}>ends {e.end}</div>}
                                            </div>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const gridStyles = {
    th: { color: 'white', padding: '11px 12px', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.25)' },
    dayCell: { padding: '10px 12px', border: '1px solid #e5e5e5', backgroundColor: '#f1f4f9', verticalAlign: 'middle', whiteSpace: 'nowrap', width: '130px' },
    gradeCell: { padding: '10px 12px', border: '1px solid #e5e5e5', fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap', width: '70px', textAlign: 'center' },
    cell: { padding: '10px 12px', border: '1px solid #e5e5e5', textAlign: 'center', fontSize: '13px', verticalAlign: 'middle' },
    note: { fontSize: '10px', color: '#b26a00', marginTop: '2px' },
};

function ExamSchedules() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [viewMode, setViewMode] = useState('grid');      // 'grid' = timetable, 'list' = edit list
    const [activeSection, setActiveSection] = useState('');
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [classSubjects, setClassSubjects] = useState({});   // classId -> [subject] (cached)
    const [filterExam, setFilterExam] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);

    useEffect(() => {
        fetchSchedules();
        Promise.allSettled([api.get('/api/exams'), api.get('/api/classes'), api.get('/api/subjects')]).then(([e, c, s]) => {
            if (e.status === 'fulfilled') setExams([...(e.value.data || [])].sort((a, b) => String(b.academicYear).localeCompare(String(a.academicYear)) || Number(b.term) - Number(a.term)));
            if (c.status === 'fulfilled') setClasses([...(c.value.data || [])].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true })));
            if (s.status === 'fulfilled') setSubjects(s.value.data || []);
            if ([e, c, s].some(x => x.status === 'rejected')) setError('Some lists (exams, classes or subjects) could not be loaded. Refresh before adding schedules.');
        });
        return () => clearTimeout(successTimer.current);
    }, []);

    // Load the chosen class's own subjects so only subjects it actually takes are offered
    useEffect(() => {
        const id = formData.classId;
        if (!id || classSubjects[id]) return;
        api.get(`/api/class-subjects/by-class/${id}`)
            .then(r => setClassSubjects(prev => ({ ...prev, [id]: (r.data || []).map(cs => cs.subject).filter(Boolean) })))
            .catch(() => setClassSubjects(prev => ({ ...prev, [id]: [] })));
    }, [formData.classId]);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3500);
    };

    const fetchSchedules = async () => {
        try { const r = await api.get('/api/exam-schedules'); setSchedules(r.data || []); }
        catch (err) { setError('Failed to load exam schedules. Check your connection and refresh.'); }
        setLoading(false);
    };

    // ── Filters (years compared as text — the API may send 2026 as a number) ──
    const q = norm(search);
    const filtered = schedules.filter(s =>
        (!filterYear || String(s.exam?.academicYear) === String(filterYear)) &&
        (!filterExam || String(s.exam?.examId) === String(filterExam)) &&
        (!filterClass || String(s.schoolClass?.classId) === String(filterClass)) &&
        (!q || norm(classDisplayName(s.schoolClass || {})).includes(q) || norm(s.schoolClass?.className).includes(q) ||
            norm(s.subject?.subjectName).includes(q) || norm(s.venue).includes(q) || norm(s.exam?.examName).includes(q))
    ).sort(bySchedule);

    const uniqueYears = [...new Set(exams.map(e => String(e.academicYear ?? '')))].filter(Boolean).sort().reverse();

    const resetForm = () => setFormData(EMPTY_FORM);
    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setShowGenerator(false);
        setEditingSchedule(null);
        // Start from the current filters so adding a whole timetable is quick
        setFormData({ ...EMPTY_FORM, examId: filterExam || '', classId: filterClass || '' });
        setShowAddForm(true);
    };

    const handleEdit = (schedule) => {
        if (editingSchedule?.scheduleId === schedule.scheduleId) { handleCancelEdit(); return; }
        setEditingSchedule(schedule);
        setFormData({
            examDate: toDateInput(schedule.examDate), startTime: hhmm(schedule.startTime), endTime: hhmm(schedule.endTime), venue: schedule.venue || '',
            examId: String(schedule.exam?.examId ?? ''), classId: String(schedule.schoolClass?.classId ?? ''), subjectId: String(schedule.subject?.subjectId ?? '')
        });
        setShowAddForm(false);
    };
    const handleCancelEdit = () => { setEditingSchedule(null); resetForm(); };

    // Returns { block } for hard errors, { warn } for things to confirm, or {}
    const check = (exceptId) => {
        if (formData.endTime <= formData.startTime) return { block: 'End time must be after the start time.' };
        const exam = exams.find(e => String(e.examId) === String(formData.examId));
        const others = schedules.filter(s => String(s.scheduleId) !== String(exceptId ?? ''));
        const dup = others.find(s => String(s.exam?.examId) === formData.examId && String(s.schoolClass?.classId) === formData.classId && String(s.subject?.subjectId) === formData.subjectId);
        if (dup) return { block: `This subject is already scheduled for this class in this exam (${fmtShortDate(dup.examDate)} ${hhmm(dup.startTime)}).` };
        const sameDay = others.filter(s => toDateInput(s.examDate) === formData.examDate && overlaps(s.startTime, s.endTime, formData.startTime, formData.endTime));
        const classClash = sameDay.find(s => String(s.schoolClass?.classId) === formData.classId);
        if (classClash) return { block: `The class already has ${classClash.subject?.subjectName} at ${hhmm(classClash.startTime)}–${hhmm(classClash.endTime)} on this day.` };
        const warns = [];
        const venueClash = formData.venue.trim() && sameDay.find(s => norm(s.venue) === norm(formData.venue));
        if (venueClash) warns.push(`${formData.venue.trim()} is already booked for ${classDisplayName(venueClash.schoolClass || {})} (${venueClash.subject?.subjectName}) at ${hhmm(venueClash.startTime)}–${hhmm(venueClash.endTime)}.`);
        if (exam?.startDate && exam?.endDate && (formData.examDate < toDateInput(exam.startDate) || formData.examDate > toDateInput(exam.endDate))) {
            warns.push(`The date is outside ${exam.examName}'s term (${fmtShortDate(exam.startDate)} – ${fmtShortDate(exam.endDate)}).`);
        }
        const dow = localDate(formData.examDate)?.getDay();
        if (dow === 0 || dow === 6) warns.push('The date falls on a weekend.');
        return warns.length ? { warn: warns.join('\n') } : {};
    };

    const payload = () => ({
        examDate: formData.examDate, startTime: formData.startTime, endTime: formData.endTime, venue: formData.venue.trim() || null,
        exam: { examId: Number(formData.examId) }, schoolClass: { classId: Number(formData.classId) }, subject: { subjectId: Number(formData.subjectId) }
    });

    const submit = async (e, isEdit) => {
        e.preventDefault();
        if (saving) return;
        const { block, warn } = check(isEdit ? editingSchedule.scheduleId : null);
        if (block) { setError(block); return; }
        if (warn && !window.confirm(`${warn}\n\nSave anyway?`)) return;
        setSaving(true); setError('');
        try {
            if (isEdit) await api.put(`/api/exam-schedules/${editingSchedule.scheduleId}`, payload());
            else await api.post('/api/exam-schedules', payload());
            await fetchSchedules();
            if (isEdit) { handleCancelEdit(); flashSuccess('Schedule updated.'); }
            else {
                // Keep exam, class and date for the next paper; clear subject and times
                setFormData(prev => ({ ...prev, subjectId: '', startTime: prev.endTime, endTime: '' }));
                flashSuccess('Schedule added — the form is ready for the next paper.');
            }
        } catch (err) { setError(serverMessage(err, isEdit ? 'Failed to update exam schedule' : 'Failed to save exam schedule')); }
        setSaving(false);
    };

    const handleDelete = async (s) => {
        if (!window.confirm(`Delete ${s.subject?.subjectName} for ${classDisplayName(s.schoolClass || {})} on ${fmtShortDate(s.examDate)} ${hhmm(s.startTime)}?`)) return;
        try {
            await api.delete(`/api/exam-schedules/${s.scheduleId}`);
            if (editingSchedule?.scheduleId === s.scheduleId) handleCancelEdit();
            await fetchSchedules();
            flashSuccess('Schedule deleted.');
        } catch (err) { setError(serverMessage(err, 'Failed to delete exam schedule')); }
    };

    const handlePrint = () => {
        if (!filtered.length) return;
        const classObj = classes.find(c => String(c.classId) === String(filterClass));
        // One set of pages per exam (mixing exams in one grid would be confusing)
        const byExam = {};
        filtered.forEach(s => { const id = String(s.exam?.examId ?? 'none'); (byExam[id] = byExam[id] || []).push(s); });
        let maxSlots = 1;
        const pages = [];
        Object.entries(byExam).forEach(([id, list]) => {
            const ex = exams.find(e => String(e.examId) === id) || list[0].exam || {};
            buildSectionGrids(list, classes).forEach(g => {
                maxSlots = Math.max(maxSlots, g.slots.length);
                const head = g.slots.map(sl => `<th class="time">${esc(sl.start)} – ${esc(sl.end)}</th>`).join('');
                const body = g.rows.map(r => {
                    const d = dayParts(r.date);
                    const cells = g.slots.map(sl => {
                        const cell = r.cells[sl.start] || [];
                        if (!cell.length) return '<td class="empty">—</td>';
                        return `<td class="subj">${cell.map(e =>
                            `<div><b>${esc(e.subject)}</b>` +
                            (e.partial ? `<div class="note">${esc(e.classes.map(c => classDisplayName(c)).join(', '))} only</div>` : '') +
                            (e.end !== sl.end ? `<div class="note">ends ${esc(e.end)}</div>` : '') + '</div>').join('')}</td>`;
                    }).join('');
                    return `<tr class="${r.firstOfDate ? 'newday' : ''}">` +
                        (r.firstOfDate ? `<td class="day" rowspan="${r.span}"><b>${esc(d.weekday)}</b><br><span>${esc(d.date)}</span></td>` : '') +
                        `<td class="grade">${esc(r.gradeName)}</td>${cells}</tr>`;
                }).join('');
                pages.push(`<section class="page">
                    <div class="header">
                        ${letterheadHtml({ logoSize: 50 })}
                        <div class="banner" style="background:${g.color}">EXAMINATION TIMETABLE — ${esc(g.title.toUpperCase())}</div>
                        <div class="sub">${esc(ex.examName || 'Exam')}${ex.term ? ` | Term ${esc(ex.term)} ${esc(ex.academicYear)}` : ''}${classObj ? ` | ${esc(classDisplayName(classObj))}` : ''}</div>
                    </div>
                    <table><thead><tr><th class="dayh">Day</th><th class="gradeh">Grade</th>${head}</tr></thead><tbody>${body}</tbody></table>
                    <p class="foot">All streams of a grade sit each paper at the same time, in their own classrooms unless stated otherwise. Learners should arrive 15 minutes early.</p>
                    <div class="sign"><span>Class Teacher: ______________________</span><span>Principal: ______________________ Date: __________</span></div>
                    <p class="printed">Printed ${esc(new Date().toLocaleDateString('en-GB'))}</p>
                </section>`);
            });
        });
        const landscape = maxSlots > 3;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Examination Timetable</title>
        <style>
            *{box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:12px;color:#000;margin:0;padding:15px}
            .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
            .page{page-break-after:always;break-after:page;padding-bottom:10px}.page:last-child{page-break-after:auto;break-after:auto}
            .page+.page{border-top:2px dashed #bbb;padding-top:18px;margin-top:18px}
            .header{text-align:center;margin-bottom:10px}.school{color:#1F3864;font-weight:bold;font-size:15px;text-transform:uppercase}
            .motto{color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0 6px}
            .banner{color:#fff;font-weight:bold;padding:6px;font-size:14px;letter-spacing:.5px}.sub{margin-top:4px;color:#333;font-weight:bold}
            table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #777;padding:7px 6px}
            th{background:#1F3864;color:#fff;font-size:12px}.dayh{width:15%}.gradeh{width:9%}.time{text-align:center}
            td.day{background:#eef2f8;text-align:center;vertical-align:middle}td.day span{font-size:11px;color:#444}
            td.grade{text-align:center;font-weight:bold}td.subj{text-align:center;vertical-align:middle}td.subj div+div{margin-top:4px}
            td.empty{text-align:center;color:#bbb}.note{font-size:10px;color:#8a5a00}tr.newday td{border-top:2px solid #1F3864}
            .foot{font-size:11px;color:#333;margin:8px 0}.sign{display:flex;justify-content:space-between;gap:20px;margin-top:22px;font-size:12px;flex-wrap:wrap}
            .printed{text-align:center;font-size:9px;color:#888;margin-top:10px}
            @media print{.bar{display:none}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                .page+.page{border-top:none;padding-top:0;margin-top:0}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm}}
        </style></head><body>
        <div class="bar"><strong>Examination Timetable — ${pages.length} page(s), one per section</strong>
        <button onclick="window.print()" style="background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer">Print / Save PDF</button></div>
        ${pages.join('')}</body></html>`;
        const win = window.open('', '_blank');
        if (!win) { setError('Your browser blocked the print window. Allow pop-ups for this site, then try again.'); return; }
        win.document.write(html); win.document.close(); win.focus();
    };

    // Timetable view works on one exam at a time
    const examsShown = [...new Map(filtered.map(s => [String(s.exam?.examId), s.exam])).values()].filter(Boolean);
    const gridExam = filterExam ? exams.find(e => String(e.examId) === String(filterExam)) || examsShown[0]
        : examsShown.length === 1 ? examsShown[0] : null;
    const grids = viewMode === 'grid' && gridExam
        ? buildSectionGrids(filtered.filter(s => String(s.exam?.examId) === String(gridExam.examId)), classes) : [];
    const currentGrid = grids.find(g => g.section === activeSection) || grids[0];

    const renderGrid = () => {
        if (!gridExam) {
            return (
                <div style={styles.emptyState}>
                    <i className="bi bi-grid-3x3" aria-hidden="true" style={{ fontSize: '40px', color: '#BDD7EE', display: 'inline-block', marginBottom: '12px' }} />
                    <h3>Choose an exam to see its timetable</h3>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
                        {examsShown.map(ex => (
                            <button key={ex.examId} onClick={() => setFilterExam(String(ex.examId))} style={styles.examPick}>
                                {ex.examName} — T{ex.term} {ex.academicYear}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div>
                <div style={styles.sectionTabs} role="tablist">
                    {grids.map(g => {
                        const active = g === currentGrid;
                        return (
                            <button key={g.section} role="tab" aria-selected={active} onClick={() => setActiveSection(g.section)}
                                style={{ ...styles.sectionTab, backgroundColor: active ? g.color : 'white', color: active ? 'white' : g.color, borderColor: g.color }}>
                                {g.title}<span style={{ ...styles.tabCount, backgroundColor: active ? 'rgba(255,255,255,0.25)' : g.color + '22' }}>{g.rows.length}</span>
                            </button>
                        );
                    })}
                </div>
                {currentGrid && (
                    <>
                        <div style={{ ...styles.dateHeader, backgroundColor: currentGrid.color }}>
                            <span><i className="bi bi-grid-3x3-gap-fill" aria-hidden="true" style={{ marginRight: '6px' }} />{currentGrid.title} — {gridExam.examName}, Term {gridExam.term} {gridExam.academicYear}</span>
                            <span style={{ fontSize: '12px', opacity: 0.9 }}>{new Set(currentGrid.rows.map(r => r.date)).size} day(s)</span>
                        </div>
                        <SectionGrid grid={currentGrid} />
                        <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                            <i className="bi bi-info-circle" aria-hidden="true" style={{ marginRight: '5px' }} />
                            Print Timetable puts each section on its own page. To change a paper, switch to <strong>List</strong> view.
                        </p>
                    </>
                )}
            </div>
        );
    };

    const groupedByDate = filtered.reduce((groups, s) => {
        const d = toDateInput(s.examDate) || 'none';
        (groups[d] = groups[d] || []).push(s);
        return groups;
    }, {});

    // Subject list for the form: the class's own subjects when set up, otherwise everything
    const cs = formData.classId ? classSubjects[formData.classId] : null;
    const subjectOptions = (cs && cs.length ? cs : subjects).slice().sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));
    // Keep the currently-saved subject selectable when editing, even if it's no longer a class subject
    if (formData.subjectId && !subjectOptions.some(s => String(s.subjectId) === formData.subjectId)) {
        const cur = subjects.find(s => String(s.subjectId) === formData.subjectId);
        if (cur) subjectOptions.unshift(cur);
    }
    const subjectsNote = formData.classId && cs && cs.length === 0 ? 'This class has no subjects set up — showing all subjects.' : '';
    const examForForm = exams.find(e => String(e.examId) === String(formData.examId));
    const formProps = { formData, setFormData, exams, classes, subjectOptions, subjectsNote, examForForm, saving };
    const anyFilter = filterYear || filterExam || filterClass || search;

    return (
        <div style={styles.container}>
           <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}><Icon name="calendar-check-fill" style={{ marginRight: '10px' }} />Exam Schedules</h2>
                        <p style={styles.subtitle}>{filtered.length} of {schedules.length} session(s) shown</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => { setShowGenerator(g => !g); setShowAddForm(false); setEditingSchedule(null); }} style={styles.generateBtn}>
                            <Icon name={showGenerator ? 'x-lg' : 'magic'} />{showGenerator ? 'Close Generator' : 'Auto-Generate'}
                        </button>
                        <button onClick={handlePrint} style={{ ...styles.printBtn, opacity: filtered.length ? 1 : 0.5 }} disabled={!filtered.length}><Icon name="printer-fill" />Print Timetable</button>
                        <button onClick={toggleAddForm} style={styles.addBtn}>
                            {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Schedule</>}
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" /><span style={{ flex: 1, whiteSpace: 'pre-line' }}>{error}</span>
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                {showGenerator && (
                    <TimetableGenerator exams={exams} classes={classes} schedules={schedules}
                        onClose={() => setShowGenerator(false)}
                        onSaved={async (examId, savedCount) => {
                            await fetchSchedules();
                            setFilterYear(''); setFilterClass(''); setSearch('');
                            setFilterExam(String(examId));   // show the new timetable straight away
                            if (savedCount) flashSuccess(`Timetable saved — ${savedCount} session(s) added. Use Print Timetable to print it.`);
                        }} />
                )}

                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}><Icon name="plus-circle" />Add New Schedule</h3>
                        <ScheduleForm {...formProps} onSubmit={e => submit(e, false)}
                            onCancel={() => { setShowAddForm(false); resetForm(); }}
                            submitLabel="Save Schedule" submitIcon="save-fill" />
                    </div>
                )}

                <div style={styles.viewToggle} role="group" aria-label="View">
                    {[['grid', 'grid-3x3-gap-fill', 'Timetable'], ['list', 'list-ul', 'List (edit)']].map(([v, ic, label]) => (
                        <button key={v} onClick={() => setViewMode(v)} aria-pressed={viewMode === v}
                            style={{ ...styles.viewBtn, backgroundColor: viewMode === v ? '#1F3864' : 'white', color: viewMode === v ? 'white' : '#1F3864' }}>
                            <i className={`bi bi-${ic}`} aria-hidden="true" style={{ marginRight: '6px' }} />{label}
                        </button>
                    ))}
                </div>

                <div style={styles.searchBar}>
                    <select style={styles.filterSelect} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterExam(''); }} aria-label="Filter by year">
                        <option value="">All Years</option>
                        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={styles.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)} aria-label="Filter by exam">
                        <option value="">All Exams</option>
                        {exams.filter(e => !filterYear || String(e.academicYear) === String(filterYear)).map(ex => (
                            <option key={ex.examId} value={String(ex.examId)}>{ex.examName} — T{ex.term} {ex.academicYear}</option>
                        ))}
                    </select>
                    <select style={styles.filterSelect} value={filterClass} onChange={e => setFilterClass(e.target.value)} aria-label="Filter by class">
                        <option value="">All Classes</option>
                        {classes.map(cls => <option key={cls.classId} value={String(cls.classId)}>{classDisplayName(cls)}</option>)}
                    </select>
                    <div style={styles.searchBox}>
                        <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                        <input style={styles.searchInput} placeholder="Search subject, class, venue..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button onClick={() => { setSearch(''); setFilterExam(''); setFilterYear(''); setFilterClass(''); }} style={styles.clearBtn} disabled={!anyFilter}>
                        <Icon name="arrow-counterclockwise" />Clear
                    </button>
                </div>

                {loading ? <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}><Icon name="hourglass-split" />Loading schedules...</p> : filtered.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Icon name="calendar-x" style={{ fontSize: '48px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '15px' }} />
                        <h3>{anyFilter ? 'No schedules match these filters' : 'No Schedules Yet'}</h3>
                        <p>{anyFilter ? 'Try clearing the filters.' : <>Click <strong>Add Schedule</strong> to create one.</>}</p>
                    </div>
                ) : viewMode === 'grid' ? renderGrid() : Object.entries(groupedByDate).map(([date, daySchedules]) => (
                    <div key={date} style={styles.dateGroup}>
                        <div style={styles.dateHeader}>
                            <span><Icon name="calendar-event" />{date === 'none' ? 'No date set' : fmtLongDate(date)}</span>
                            <span style={{ fontSize: '12px', opacity: 0.9 }}>{daySchedules.length} session(s)</span>
                        </div>
                        <div style={styles.tableWrapper}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHeader}>
                                        <th style={styles.th}>Time</th>
                                        <th style={styles.th}>Exam</th>
                                        <th style={styles.th}>Class</th>
                                        <th style={styles.th}>Subject</th>
                                        <th style={styles.th}>Venue</th>
                                        <th style={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {daySchedules.map((s, index) => {
                                        const isEditing = editingSchedule?.scheduleId === s.scheduleId;
                                        return (
                                            <React.Fragment key={s.scheduleId}>
                                                <tr style={{ backgroundColor: isEditing ? '#e3f2fd' : index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                                                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}><strong>{hhmm(s.startTime)}</strong> – {hhmm(s.endTime)}</td>
                                                    <td style={styles.td}><span style={styles.examBadge}>{s.exam?.examName}</span></td>
                                                    <td style={styles.td}><span style={styles.classBadge}>{classDisplayName(s.schoolClass || {})}</span></td>
                                                    <td style={styles.td}>{s.subject?.subjectName}</td>
                                                    <td style={styles.td}>{s.venue || <span style={{ color: '#bbb' }}>—</span>}</td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button onClick={() => handleEdit(s)} style={isEditing ? styles.cancelEditBtn : styles.editBtn} aria-label={isEditing ? 'Close editor' : 'Edit schedule'} title={isEditing ? 'Close editor' : 'Edit'}>
                                                                <i className={`bi bi-${isEditing ? 'x-lg' : 'pencil-fill'}`} aria-hidden="true" />
                                                            </button>
                                                            <button onClick={() => handleDelete(s)} style={styles.deleteBtn} aria-label="Delete schedule" title="Delete">
                                                                <i className="bi bi-trash-fill" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isEditing && (
                                                    <tr>
                                                        <td colSpan="6" style={{ padding: 0, border: 'none' }}>
                                                            <div style={styles.editPanel}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                                    <h4 style={{ color: '#2E75B6', margin: 0, fontSize: '13px' }}>
                                                                        <Icon name="pencil-fill" />Editing: {s.exam?.examName} — {classDisplayName(s.schoolClass || {})} — {s.subject?.subjectName}
                                                                    </h4>
                                                                    <button onClick={handleCancelEdit} style={styles.closeX} aria-label="Close"><i className="bi bi-x-lg" /></button>
                                                                </div>
                                                                <ScheduleForm {...formProps} onSubmit={e => submit(e, true)} onCancel={handleCancelEdit}
                                                                    submitLabel="Update Schedule" submitIcon="check-circle-fill" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    viewToggle: { display: 'inline-flex', marginBottom: '14px', border: '2px solid #1F3864', borderRadius: '10px', overflow: 'hidden' },
    viewBtn: { border: 'none', padding: '9px 18px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    sectionTabs: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
    sectionTab: { border: '2px solid', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
    tabCount: { padding: '1px 8px', borderRadius: '10px', fontSize: '11px' },
    examPick: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    generateBtn: { backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'flex-start' },
    dismissBtn: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    addFormCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 5px 0', fontWeight: 700 },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    fieldHint: { fontSize: '11px', color: '#888' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    filterSelect: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white', maxWidth: '100%' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    dateGroup: { marginBottom: '20px' },
    dateHeader: { backgroundColor: '#2E75B6', color: 'white', padding: '11px 16px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '14px', flexWrap: 'wrap', gap: '6px' },
    tableWrapper: { overflowX: 'auto', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '640px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '11px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px' },
    td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    editPanel: { backgroundColor: '#f0f7ff', padding: '15px 20px', borderLeft: '4px solid #2E75B6', borderBottom: '1px solid #ddd' },
    closeX: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    classBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 9px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    examBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 9px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default ExamSchedules;
