import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const norm = (v) => String(v ?? '').trim().toLowerCase();
const cell = (row, i) => String(row?.[i] ?? '').trim();
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || err?.message || fallback;
};

// Read the first sheet twice: raw values (numbers, date serials) and the text Excel displays
const readWorkbook = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const opts = { header: 1, defval: '', blankrows: true };
            resolve({
                raw: XLSX.utils.sheet_to_json(ws, { ...opts, raw: true }),
                text: XLSX.utils.sheet_to_json(ws, { ...opts, raw: false })
            });
        } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsArrayBuffer(file);
});

// Excel stores dates as serial numbers (e.g. 42075 = 12 Mar 2015). Accepts those,
// YYYY-MM-DD, and day-first DD/MM/YYYY (the Kenyan convention). Returns 'YYYY-MM-DD' or null.
const parseDate = (rawVal) => {
    const pad = (n) => String(n).padStart(2, '0');
    const valid = (y, m, d) => {
        const dt = new Date(Date.UTC(y, m - 1, d));
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d &&
            y >= 1990 && y <= new Date().getFullYear() ? `${y}-${pad(m)}-${pad(d)}` : null;
    };
    if (typeof rawVal === 'number') {
        const p = XLSX.SSF.parse_date_code(rawVal);
        return p ? valid(p.y, p.m, p.d) : null;
    }
    const s = String(rawVal ?? '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return valid(+m[3], +m[2], +m[1]);
    return null;
};

const parseGender = (v) => {
    const g = norm(v);
    if (['m', 'male', 'boy'].includes(g)) return 'Male';
    if (['f', 'female', 'girl'].includes(g)) return 'Female';
    return null;
};

// Phones typed as numbers lose their leading 0 (0712345678 -> 712345678). Put it back,
// and treat +254 / 254 the same as 0.
const normalizePhone = (v) => {
    let d = String(v ?? '').replace(/\D/g, '');
    if (d.startsWith('254')) d = '0' + d.slice(3);
    if (d.length === 9 && /^[17]/.test(d)) d = '0' + d;
    return d;
};

// Find a class by what's written in the sheet: its name ("G1R") or its display name.
// Returns { cls } or { problem }.
const matchClass = (classes, written) => {
    const w = norm(written);
    if (!w) return { problem: 'class name is empty' };
    const hits = classes.filter(c => norm(c.className) === w || norm(classDisplayName(c)) === w);
    if (hits.length === 1) return { cls: hits[0] };
    if (hits.length > 1) return { problem: `"${written}" matches ${hits.length} classes (${hits.map(classDisplayName).join(', ')}) — write the exact stream` };
    return { problem: `class "${written}" not found` };
};

const studentInClass = (s, cls) => {
    const id = s.schoolClass?.classId;
    if (id != null) return String(id) === String(cls.classId);
    return s.className === cls.className && (cls.stream ? s.stream === cls.stream : !s.stream);
};

// Run jobs a few at a time, reporting progress
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

// ══════════════════════════════════════════════════════════════════════════════
// Small UI pieces
// ══════════════════════════════════════════════════════════════════════════════
const StatusPill = ({ status, text }) => {
    const map = {
        ok: { bg: '#d4edda', fg: '#155724', icon: 'check-circle-fill' },
        new: { bg: '#d4edda', fg: '#155724', icon: 'plus-circle-fill' },
        update: { bg: '#cce5ff', fg: '#004085', icon: 'arrow-repeat' },
        problem: { bg: '#f8d7da', fg: '#721c24', icon: 'x-circle-fill' },
    }[status] || { bg: '#eee', fg: '#555', icon: 'dash' };
    return <span style={{ ...styles.pill, backgroundColor: map.bg, color: map.fg }}><Icon name={map.icon} style={{ marginRight: '4px' }} />{text}</span>;
};

const IssueList = ({ issues, title }) => {
    const [showAll, setShowAll] = useState(false);
    if (!issues?.length) return null;
    const shown = showAll ? issues : issues.slice(0, 8);
    return (
        <div style={styles.issueBox}>
            <strong style={{ color: '#856404' }}><Icon name="exclamation-triangle-fill" />{title} ({issues.length})</strong>
            <ul style={styles.issueList}>{shown.map((m, i) => <li key={i}>{m}</li>)}</ul>
            {issues.length > 8 && (
                <button onClick={() => setShowAll(s => !s)} style={styles.linkBtn}>{showAll ? 'Show fewer' : `Show all ${issues.length}`}</button>
            )}
        </div>
    );
};

const ProgressBar = ({ progress, label }) => progress ? (
    <div style={{ margin: '12px 0' }}>
        <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} /></div>
        <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>{label} {progress.done}/{progress.total}…</p>
    </div>
) : null;

const ResultBanner = ({ result, type }) => {
    if (!result) return null;
    const allFailed = result.failed > 0 && result.saved === 0 && (result.updated || 0) === 0;
    return (
        <div style={styles.resultBanner}>
            <h4 style={{ ...styles.resultTitle, color: allFailed ? '#721c24' : result.failed ? '#856404' : '#155724' }}>
                <Icon name={allFailed ? 'x-circle-fill' : result.failed ? 'exclamation-triangle-fill' : 'check-circle-fill'} />
                {allFailed ? `Import failed — ${type}` : result.failed ? `Import finished with problems — ${type}` : `Import complete — ${type}`}
            </h4>
            <div style={styles.resultStats}>
                <div style={{ ...styles.resultStat, backgroundColor: '#d4edda', color: '#155724' }}><strong>{result.saved}</strong> New</div>
                {result.updated !== undefined && <div style={{ ...styles.resultStat, backgroundColor: '#cce5ff', color: '#004085' }}><strong>{result.updated}</strong> Updated</div>}
                <div style={{ ...styles.resultStat, backgroundColor: '#fff3cd', color: '#856404' }}><strong>{result.skipped}</strong> Not imported (problems)</div>
                <div style={{ ...styles.resultStat, backgroundColor: result.failed ? '#f8d7da' : '#f8f9fa', color: result.failed ? '#721c24' : '#666' }}><strong>{result.failed}</strong> Rejected by server</div>
            </div>
            <IssueList issues={result.errors} title="Rejected by the server" />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
function Import() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [activeTab, setActiveTab] = useState('marks');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [refLoaded, setRefLoaded] = useState(false);
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(null);

    const [marks, setMarks] = useState({ file: null, plan: null, result: null });
    const [studentsImp, setStudentsImp] = useState({ file: null, plan: null, result: null });
    const [teachersImp, setTeachersImp] = useState({ file: null, plan: null, result: null });
    const marksWorkbook = useRef(null);

    useEffect(() => {
        Promise.allSettled([api.get('/api/exams'), api.get('/api/classes')]).then(([e, c]) => {
            if (e.status === 'fulfilled') setExams(e.value.data || []);
            if (c.status === 'fulfilled') setClasses(c.value.data || []);
            if (e.status === 'rejected' || c.status === 'rejected') setError('Could not load exams/classes. Refresh the page before importing.');
            setRefLoaded(true);
        });
    }, []);

    // Warn before leaving mid-import (it would stop half-way)
    useEffect(() => {
        if (!importing) return;
        const h = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [importing]);

    // ── MARKS ────────────────────────────────────────────────────────────────
    const analyzeMarks = async ({ raw, text }) => {
        if (text.length < 4) throw new Error('This doesn\'t look like the marks template (it needs the exam details on row 2, headings on row 3, and students from row 4).');
        const meta = text[1];
        const examName = cell(meta, 0), className = cell(meta, 1), year = cell(meta, 2), term = cell(meta, 3);

        // Exam: match by name AND year AND term — every term has an "End Term"
        let examHits = exams.filter(e => norm(e.examName) === norm(examName));
        if (year) examHits = examHits.filter(e => String(e.academicYear) === String(year));
        if (term) examHits = examHits.filter(e => String(e.term) === String(parseInt(term, 10)));
        const examProblem = !examName ? 'Exam name is empty (row 2, column A).'
            : examHits.length === 0 ? `No exam called "${examName}"${year ? ` in ${year}` : ''}${term ? ` Term ${term}` : ''} exists in the system.`
            : examHits.length > 1 ? `Several exams are called "${examName}" — fill in the Year and Term so the right one is used.` : null;
        const classRes = matchClass(classes, className);

        const meta2 = { examName, className, year, term, exam: examHits.length === 1 ? examHits[0] : null, cls: classRes.cls || null, examProblem, classProblem: classRes.problem ? classRes.problem.charAt(0).toUpperCase() + classRes.problem.slice(1) + '.' : null };

        // Headings: col B = admission no, col C = name, subjects from col D
        const headerRow = text[2] || [];
        let lastCol = headerRow.length - 1;
        while (lastCol >= 0 && !cell(headerRow, lastCol)) lastCol--;
        const headers = headerRow.slice(0, lastCol + 1).map(h => String(h).trim());
        const dataRowIdx = [];
        for (let r = 3; r < text.length; r++) if (cell(text[r], 1)) dataRowIdx.push(r);

        const base = { meta: meta2, headers, preview: dataRowIdx.slice(0, 10).map(r => text[r].slice(0, headers.length)), rowCount: dataRowIdx.length };
        if (examProblem || classRes.problem) return { ...base, blocked: true, entries: [], issues: [] };

        const { exam, cls } = meta2;
        const [studentsRes, subjRes, existingRes] = await Promise.all([
            api.get('/api/students'),
            api.get(`/api/class-subjects/by-class/${cls.classId}`),
            api.get(`/api/results/by-exam/${exam.examId}`)
        ]);
        const classStudents = (studentsRes.data || []).filter(s => studentInClass(s, cls));
        const classSubjects = (subjRes.data || []).map(cs => cs.subject).filter(Boolean);
        if (!classSubjects.length) return { ...base, blocked: true, entries: [], issues: [], blockReason: `${classDisplayName(cls)} has no subjects set up. Add them under Class Subjects first.` };

        const existing = {};
        (existingRes.data || []).forEach(r => { existing[`${r.student?.studentId}_${r.subject?.subjectId}`] = r.resultId; });

        const issues = [];
        const subjectCols = [];
        for (let i = 3; i < headers.length; i++) {
            if (!headers[i]) continue;
            const subject = classSubjects.find(s => norm(s.subjectName) === norm(headers[i]) || norm(s.subjectCode) === norm(headers[i]));
            if (subject) subjectCols.push({ col: i, subject });
            else issues.push(`Column "${headers[i]}" is not a subject of ${classDisplayName(cls)} — its marks will NOT be imported.`);
        }

        const entries = [];
        const seen = {};
        let studentsMatched = 0;
        dataRowIdx.forEach(r => {
            const adm = cell(text[r], 1);
            const student = classStudents.find(s => norm(s.admissionNumber) === norm(adm));
            if (!student) { issues.push(`Row ${r + 1}: admission no. ${adm} is not in ${classDisplayName(cls)}.`); return; }
            if (seen[student.studentId]) { issues.push(`Row ${r + 1}: ${adm} already appears on row ${seen[student.studentId]} — this row is ignored.`); return; }
            seen[student.studentId] = r + 1;
            studentsMatched++;
            subjectCols.forEach(({ col, subject }) => {
                const v = raw[r]?.[col];
                if (v === '' || v === null || v === undefined || String(v).trim() === '') return;
                const n = Number(String(v).trim());
                if (isNaN(n) || n < 0 || n > 100) { issues.push(`Row ${r + 1} (${adm}), ${subject.subjectName}: "${v}" is not a mark from 0 to 100.`); return; }
                entries.push({ studentId: student.studentId, subjectId: subject.subjectId, marksObtained: n, maxMarks: 100, resultId: existing[`${student.studentId}_${subject.subjectId}`] || null });
            });
        });
        return { ...base, blocked: false, entries, issues, studentsMatched, newCount: entries.filter(e => !e.resultId).length, updateCount: entries.filter(e => e.resultId).length };
    };

    const handleMarksFile = async (e) => {
        const file = e.target.files[0];
        e.target.value = ''; // lets the same file be chosen again after fixing it
        if (!file) return;
        setError(''); setMarks({ file, plan: null, result: null }); setChecking(true);
        try {
            const wb = await readWorkbook(file);
            marksWorkbook.current = wb;
            setMarks({ file, plan: await analyzeMarks(wb), result: null });
        } catch (err) { setError(serverMessage(err, 'Failed to read the file. Make sure you are using the marks template.')); }
        setChecking(false);
    };

    const handleMarksImport = async () => {
        const plan = marks.plan;
        if (!plan || plan.blocked || !plan.entries.length) return;
        const label = `${plan.entries.length} marks for ${classDisplayName(plan.meta.cls)} — ${plan.meta.exam.examName} (Term ${plan.meta.exam.term} ${plan.meta.exam.academicYear})`;
        if (!window.confirm(`Import ${label}?\n\n${plan.updateCount} existing mark(s) will be overwritten.`)) return;
        setImporting(true); setError('');
        // One bulk request per 200 marks instead of hundreds of single requests
        const chunks = [];
        for (let i = 0; i < plan.entries.length; i += 200) chunks.push(plan.entries.slice(i, i + 200));
        let saved = 0, updated = 0, failed = 0; const errors = [];
        setProgress({ done: 0, total: plan.entries.length });
        let sent = 0;
        for (const chunk of chunks) {
            try {
                const r = await api.post('/api/results/bulk-save', { examId: plan.meta.exam.examId, results: chunk });
                saved += r.data?.saved || 0; updated += r.data?.updated || 0; failed += r.data?.failed || 0;
                (r.data?.errors || []).forEach(m => errors.push(String(m)));
            } catch (err) {
                failed += chunk.length; errors.push(serverMessage(err, 'A batch of marks could not be saved.'));
            }
            sent += chunk.length; setProgress({ done: sent, total: plan.entries.length });
        }
        setProgress(null);
        const result = { saved, updated, failed, skipped: plan.issues.length, errors };
        // Re-check the file so a second click updates rather than duplicates
        try { setMarks({ file: marks.file, plan: await analyzeMarks(marksWorkbook.current), result }); }
        catch { setMarks(m => ({ ...m, result })); }
        setImporting(false);
    };

    // ── STUDENTS ─────────────────────────────────────────────────────────────
    const analyzeStudents = async ({ raw, text }) => {
        const existing = (await api.get('/api/students')).data || [];
        const existingAdm = new Set(existing.map(s => norm(s.admissionNumber)));
        const seen = {};
        const rows = [];
        for (let r = 1; r < text.length; r++) {
            const t = text[r];
            if (!t || t.every(c => !String(c).trim())) continue;
            // Learner names are kept in CAPITALS everywhere
            const adm = cell(t, 0), first = String(cell(t, 1) || '').toUpperCase(), last = String(cell(t, 2) || '').toUpperCase(), className = cell(t, 5);
            const problems = [];
            if (!adm) problems.push('admission no. missing');
            if (!first) problems.push('first name missing');
            if (!last) problems.push('last name missing');
            const dob = parseDate(raw[r]?.[3]);
            if (!dob) problems.push(cell(t, 3) ? `date of birth "${cell(t, 3)}" not understood (use YYYY-MM-DD)` : 'date of birth missing');
            const gender = parseGender(cell(t, 4));
            if (!gender) problems.push(cell(t, 4) ? `gender "${cell(t, 4)}" not understood (use Male/Female)` : 'gender missing');
            const { cls, problem } = matchClass(classes, className);
            if (problem) problems.push(problem);
            if (adm && existingAdm.has(norm(adm))) problems.push('this admission no. already exists in the system');
            else if (adm && seen[norm(adm)]) problems.push(`duplicate of row ${seen[norm(adm)]} in this file`);
            if (adm) seen[norm(adm)] = seen[norm(adm)] || r + 1;
            rows.push({
                rowNum: r + 1, problems, cls,
                display: [adm, first, last, dob || cell(t, 3), gender || cell(t, 4), cls ? classDisplayName(cls) : className],
                payload: problems.length ? null : { admissionNumber: adm, firstName: first, lastName: last, dateOfBirth: dob, gender }
            });
        }
        return { rows, okCount: rows.filter(r => r.payload).length };
    };

    const handleStudentsFile = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setError(''); setStudentsImp({ file, plan: null, result: null }); setChecking(true);
        try { setStudentsImp({ file, plan: await analyzeStudents(await readWorkbook(file)), result: null }); }
        catch (err) { setError(serverMessage(err, 'Failed to read the file. Make sure you are using the students template.')); }
        setChecking(false);
    };

    const handleStudentsImport = async () => {
        const plan = studentsImp.plan;
        const ready = plan?.rows.filter(r => r.payload) || [];
        if (!ready.length) return;
        if (!window.confirm(`Add ${ready.length} new student(s)?${plan.rows.length - ready.length ? `\n\n${plan.rows.length - ready.length} row(s) with problems will be left out.` : ''}`)) return;
        setImporting(true); setError('');
        const outs = await runLimited(ready, 5,
            row => api.post(`/api/students?classId=${row.cls.classId}`, row.payload),
            (done, total) => setProgress({ done, total }));
        setProgress(null);
        const errors = [];
        outs.forEach((o, i) => { if (!o.ok) errors.push(`Row ${ready[i].rowNum} (${ready[i].payload.admissionNumber}): ${serverMessage(o.error, 'rejected')}`); });
        const result = { saved: outs.filter(o => o.ok).length, failed: errors.length, skipped: plan.rows.length - ready.length, errors };
        setStudentsImp(s => ({ ...s, plan: { ...s.plan, done: true }, result }));
        setImporting(false);
    };

    // ── TEACHERS ─────────────────────────────────────────────────────────────
    const analyzeTeachers = async ({ text }) => {
        const existing = (await api.get('/api/teachers')).data || [];
        const seen = {};
        const rows = [];
        for (let r = 1; r < text.length; r++) {
            const t = text[r];
            if (!t || t.every(c => !String(c).trim())) continue;
            const phone = normalizePhone(cell(t, 0)), first = cell(t, 1), last = cell(t, 2), email = cell(t, 3).toLowerCase();
            const problems = [];
            if (!phone) problems.push('phone missing');
            else if (phone.length < 9 || phone.length > 13) problems.push(`phone "${cell(t, 0)}" doesn't look valid`);
            if (!first) problems.push('first name missing');
            if (!last) problems.push('last name missing');
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push(`email "${email}" doesn't look valid`);
            if (phone && seen[phone]) problems.push(`same phone as row ${seen[phone]} in this file`);
            if (phone) seen[phone] = seen[phone] || r + 1;
            const match = phone ? existing.find(x => normalizePhone(x.phone) === phone) : null;
            const emailOwner = email ? existing.find(x => norm(x.email) === email && x.teacherId !== match?.teacherId) : null;
            if (emailOwner) problems.push(`email already belongs to ${emailOwner.firstName} ${emailOwner.lastName}`);
            rows.push({
                rowNum: r + 1, problems, existing: match,
                display: [phone || cell(t, 0), first, last, email],
                payload: problems.length ? null : { firstName: first, lastName: last, phone, email: email || match?.email || null }
            });
        }
        return { rows, newCount: rows.filter(r => r.payload && !r.existing).length, updateCount: rows.filter(r => r.payload && r.existing).length };
    };

    const handleTeachersFile = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setError(''); setTeachersImp({ file, plan: null, result: null }); setChecking(true);
        try { setTeachersImp({ file, plan: await analyzeTeachers(await readWorkbook(file)), result: null }); }
        catch (err) { setError(serverMessage(err, 'Failed to read the file. Make sure you are using the teachers template.')); }
        setChecking(false);
    };

    const handleTeachersImport = async () => {
        const plan = teachersImp.plan;
        const ready = plan?.rows.filter(r => r.payload) || [];
        if (!ready.length) return;
        if (!window.confirm(`Import ${ready.length} teacher(s)? ${plan.newCount} new, ${plan.updateCount} existing record(s) will be updated.`)) return;
        setImporting(true); setError('');
        const outs = await runLimited(ready, 5,
            row => row.existing ? api.put(`/api/teachers/${row.existing.teacherId}`, row.payload) : api.post('/api/teachers', row.payload),
            (done, total) => setProgress({ done, total }));
        setProgress(null);
        const errors = [];
        let saved = 0, updated = 0;
        outs.forEach((o, i) => {
            if (o.ok) { if (ready[i].existing) updated++; else saved++; }
            else errors.push(`Row ${ready[i].rowNum} (${ready[i].payload.phone}): ${serverMessage(o.error, 'rejected')}`);
        });
        setTeachersImp(s => ({ ...s, plan: { ...s.plan, done: true }, result: { saved, updated, failed: errors.length, skipped: plan.rows.length - ready.length, errors } }));
        setImporting(false);
    };

    // ── Rendering helpers ────────────────────────────────────────────────────
    const FilePicker = ({ id, file, onChange, disabled }) => (
        <div style={styles.uploadArea}>
            <input type="file" accept=".xlsx,.xls" onChange={onChange} style={styles.fileInput} id={id} disabled={disabled} />
            <label htmlFor={id} style={{ ...styles.fileLabel, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                <Icon name={checking ? 'hourglass-split' : 'file-earmark-spreadsheet-fill'} />
                {checking ? 'Checking file…' : file ? `${file.name} — click to choose another` : 'Click to select Excel file (.xlsx)'}
            </label>
        </div>
    );

    const RowTable = ({ headers, rows, statusOf }) => (
        <div style={styles.previewWrapper}>
            <table style={styles.previewTable}>
                <thead><tr>
                    <th style={styles.previewTh}>Row</th>
                    {headers.map((h, i) => <th key={i} style={styles.previewTh}>{h}</th>)}
                    <th style={styles.previewTh}>Check</th>
                </tr></thead>
                <tbody>
                    {rows.map(r => {
                        const st = statusOf(r);
                        return (
                            <tr key={r.rowNum} style={{ backgroundColor: r.problems.length ? '#fff5f5' : 'white' }}>
                                <td style={{ ...styles.previewTd, color: '#999' }}>{r.rowNum}</td>
                                {r.display.map((c, j) => <td key={j} style={styles.previewTd}>{c}</td>)}
                                <td style={styles.previewTd}>
                                    <StatusPill status={st.status} text={st.text} />
                                    {r.problems.length > 0 && <div style={styles.problemText}>{r.problems.join('; ')}</div>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const templateCard = (title, desc, steps, href, label) => (
        <div style={styles.templateCard}>
            <div style={styles.templateLeft}>
                <h3 style={styles.templateTitle}><Icon name="1-circle-fill" />{title}</h3>
                <p style={styles.templateDesc}>{desc}</p>
                <div style={styles.templateSteps}>
                    {steps.map((s, i) => <div key={i} style={styles.stepItem}><span style={styles.stepNum}>{i + 1}</span>{s}</div>)}
                </div>
            </div>
            <a href={href} download style={styles.downloadBtn}><Icon name="download" />{label}</a>
        </div>
    );

    const busy = checking || importing || !refLoaded;
    const mp = marks.plan;

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <h2 style={styles.title}><Icon name="box-arrow-in-down" style={{ marginRight: '10px' }} />Import Data</h2>
                <p style={styles.subtitle}>Bulk import marks, students and teachers from Excel templates. Every file is checked before anything is saved.</p>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" />{error}
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}

                <div style={styles.tabs}>
                    {[
                        { key: 'marks', icon: 'bar-chart-fill', label: 'Student Marks' },
                        { key: 'students', icon: 'mortarboard-fill', label: 'Students' },
                        { key: 'teachers', icon: 'person-workspace', label: 'Teachers' },
                    ].map(tab => (
                        <button key={tab.key} disabled={importing} onClick={() => { setActiveTab(tab.key); setError(''); }}
                            style={{ ...styles.tab, backgroundColor: activeTab === tab.key ? '#1F3864' : 'white', color: activeTab === tab.key ? 'white' : '#1F3864', opacity: importing && activeTab !== tab.key ? 0.5 : 1 }}>
                            <Icon name={tab.icon} />{tab.label}
                        </button>
                    ))}
                </div>

                {/* ══ MARKS ══ */}
                {activeTab === 'marks' && (
                    <div>
                        {templateCard('Step 1 — Download Template',
                            'Download the marks template, fill in the exam details and marks for each student per subject, then upload below.',
                            ['Row 2: Exam Name, Class, Year and Term — Year and Term pick the right exam (every term has an "End Term")',
                             'Class exactly as in the system (e.g. G1R)',
                             'Column B: admission number; subjects from column D, named as in the system',
                             'Marks 0–100; leave a cell empty to skip it',
                             'Upload — the file is checked and you see exactly what will happen before anything is saved'],
                            '/marks_import_template.xlsx', 'Download Marks Template')}

                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}><Icon name="2-circle-fill" />Step 2 — Upload and Check</h3>
                            <FilePicker id="marksFile" file={marks.file} onChange={handleMarksFile} disabled={busy} />

                            {mp && (
                                <>
                                    <div style={styles.metaPreview}>
                                        <div style={styles.metaItem}>
                                            <span style={styles.metaLabel}>Exam</span>
                                            <span style={{ ...styles.metaValue, color: mp.meta.exam ? '#28a745' : '#dc3545' }}>
                                                <Icon name={mp.meta.exam ? 'check-circle-fill' : 'x-circle-fill'} />
                                                {mp.meta.exam ? `${mp.meta.exam.examName} — Term ${mp.meta.exam.term} ${mp.meta.exam.academicYear}` : (mp.meta.examName || '(empty)')}
                                            </span>
                                        </div>
                                        <div style={styles.metaItem}>
                                            <span style={styles.metaLabel}>Class</span>
                                            <span style={{ ...styles.metaValue, color: mp.meta.cls ? '#28a745' : '#dc3545' }}>
                                                <Icon name={mp.meta.cls ? 'check-circle-fill' : 'x-circle-fill'} />
                                                {mp.meta.cls ? classDisplayName(mp.meta.cls) : (mp.meta.className || '(empty)')}
                                            </span>
                                        </div>
                                        {!mp.blocked && <>
                                            <div style={styles.metaItem}><span style={styles.metaLabel}>Students matched</span><span style={styles.metaValue}>{mp.studentsMatched} of {mp.rowCount}</span></div>
                                            <div style={styles.metaItem}><span style={styles.metaLabel}>New marks</span><span style={{ ...styles.metaValue, color: '#155724' }}>{mp.newCount}</span></div>
                                            <div style={styles.metaItem}><span style={styles.metaLabel}>Will overwrite</span><span style={{ ...styles.metaValue, color: '#004085' }}>{mp.updateCount}</span></div>
                                        </>}
                                    </div>

                                    {mp.meta.examProblem && <p style={styles.blockMsg}><Icon name="x-circle-fill" />{mp.meta.examProblem}</p>}
                                    {mp.meta.classProblem && <p style={styles.blockMsg}><Icon name="x-circle-fill" />{mp.meta.classProblem}</p>}
                                    {mp.blockReason && <p style={styles.blockMsg}><Icon name="x-circle-fill" />{mp.blockReason}</p>}

                                    <IssueList issues={mp.issues} title="These will NOT be imported" />

                                    {mp.preview.length > 0 && (
                                        <>
                                            <h4 style={styles.previewTitle}><Icon name="eye-fill" />Preview (first {mp.preview.length} of {mp.rowCount} rows)</h4>
                                            <div style={styles.previewWrapper}>
                                                <table style={styles.previewTable}>
                                                    <thead><tr>{mp.headers.map((h, i) => <th key={i} style={styles.previewTh}>{h}</th>)}</tr></thead>
                                                    <tbody>{mp.preview.map((row, i) => (
                                                        <tr key={i}>{mp.headers.map((_, j) => <td key={j} style={styles.previewTd}>{row[j]}</td>)}</tr>
                                                    ))}</tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}

                                    <ProgressBar progress={importing ? progress : null} label="Saving marks" />
                                    <button onClick={handleMarksImport} style={{ ...styles.importBtn, opacity: mp.blocked || !mp.entries.length ? 0.5 : 1 }}
                                        disabled={busy || mp.blocked || !mp.entries.length}>
                                        {importing ? <><Icon name="hourglass-split" />Importing…</> : <><Icon name="box-arrow-in-down" />Import {mp.entries.length} Mark{mp.entries.length !== 1 ? 's' : ''}</>}
                                    </button>
                                </>
                            )}
                        </div>
                        <ResultBanner result={marks.result} type="Marks" />
                    </div>
                )}

                {/* ══ STUDENTS ══ */}
                {activeTab === 'students' && (
                    <div>
                        {templateCard('Step 1 — Download Template',
                            'Download the students template, fill in student details, then upload. Students whose admission number already exists are left out (never duplicated).',
                            ['ADMISSION NO — unique; format the column as Text to keep leading zeros',
                             'FIRST NAME and LAST NAME',
                             'DATE OF BIRTH — an Excel date, YYYY-MM-DD, or DD/MM/YYYY',
                             'GENDER — Male / Female (M / F also accepted)',
                             'CLASS NAME — exactly as in the system (e.g. G1R)'],
                            '/students_import_template.xlsx', 'Download Students Template')}

                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}><Icon name="2-circle-fill" />Step 2 — Upload and Check</h3>
                            <FilePicker id="studentsFile" file={studentsImp.file} onChange={handleStudentsFile} disabled={busy} />

                            {studentsImp.plan && (
                                <>
                                    <p style={styles.summaryLine}>
                                        <StatusPill status="new" text={`${studentsImp.plan.okCount} ready`} />{' '}
                                        {studentsImp.plan.rows.length - studentsImp.plan.okCount > 0 &&
                                            <StatusPill status="problem" text={`${studentsImp.plan.rows.length - studentsImp.plan.okCount} with problems (will be left out)`} />}
                                    </p>
                                    <RowTable headers={['ADM NO', 'FIRST NAME', 'LAST NAME', 'DOB', 'GENDER', 'CLASS']}
                                        rows={studentsImp.plan.rows}
                                        statusOf={r => r.problems.length ? { status: 'problem', text: 'Problem' } : { status: 'new', text: 'Ready' }} />
                                    <ProgressBar progress={importing ? progress : null} label="Adding students" />
                                    {!studentsImp.plan.done && (
                                        <button onClick={handleStudentsImport} style={{ ...styles.importBtn, opacity: studentsImp.plan.okCount ? 1 : 0.5 }}
                                            disabled={busy || !studentsImp.plan.okCount}>
                                            {importing ? <><Icon name="hourglass-split" />Importing…</> : <><Icon name="box-arrow-in-down" />Import {studentsImp.plan.okCount} Student{studentsImp.plan.okCount !== 1 ? 's' : ''}</>}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <ResultBanner result={studentsImp.result} type="Students" />
                    </div>
                )}

                {/* ══ TEACHERS ══ */}
                {activeTab === 'teachers' && (
                    <div>
                        {templateCard('Step 1 — Download Template',
                            'Phone number identifies each teacher: an existing phone updates that teacher, a new phone creates one.',
                            ['PHONE NUMBER — e.g. 0712345678 (a lost leading 0 or +254 is fixed automatically)',
                             'FIRST NAME', 'LAST NAME',
                             'EMAIL — optional; leave blank to keep any email already saved'],
                            '/teachers_import_template.xlsx', 'Download Teachers Template')}

                        <div style={styles.uploadCard}>
                            <h3 style={styles.uploadTitle}><Icon name="2-circle-fill" />Step 2 — Upload and Check</h3>
                            <FilePicker id="teachersFile" file={teachersImp.file} onChange={handleTeachersFile} disabled={busy} />

                            {teachersImp.plan && (
                                <>
                                    <p style={styles.summaryLine}>
                                        <StatusPill status="new" text={`${teachersImp.plan.newCount} new`} />{' '}
                                        <StatusPill status="update" text={`${teachersImp.plan.updateCount} update`} />{' '}
                                        {teachersImp.plan.rows.some(r => r.problems.length) &&
                                            <StatusPill status="problem" text={`${teachersImp.plan.rows.filter(r => r.problems.length).length} with problems`} />}
                                    </p>
                                    <RowTable headers={['PHONE', 'FIRST NAME', 'LAST NAME', 'EMAIL']}
                                        rows={teachersImp.plan.rows}
                                        statusOf={r => r.problems.length ? { status: 'problem', text: 'Problem' }
                                            : r.existing ? { status: 'update', text: `Update ${r.existing.firstName} ${r.existing.lastName}` }
                                            : { status: 'new', text: 'New' }} />
                                    <ProgressBar progress={importing ? progress : null} label="Saving teachers" />
                                    {!teachersImp.plan.done && (
                                        <button onClick={handleTeachersImport}
                                            style={{ ...styles.importBtn, opacity: teachersImp.plan.newCount + teachersImp.plan.updateCount ? 1 : 0.5 }}
                                            disabled={busy || !(teachersImp.plan.newCount + teachersImp.plan.updateCount)}>
                                            {importing ? <><Icon name="hourglass-split" />Importing…</> : <><Icon name="box-arrow-in-down" />Import {teachersImp.plan.newCount + teachersImp.plan.updateCount} Teacher(s)</>}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <ResultBanner result={teachersImp.result} type="Teachers" />
                    </div>
                )}
            </div>
          </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#888', marginBottom: '25px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0 },
    tabs: { display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' },
    tab: { padding: '11px 22px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    templateCard: { backgroundColor: 'white', padding: '25px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' },
    templateLeft: { flex: 1, minWidth: '260px' },
    templateTitle: { color: '#1F3864', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 },
    templateDesc: { color: '#666', fontSize: '14px', marginBottom: '15px' },
    templateSteps: { display: 'flex', flexDirection: 'column', gap: '7px' },
    stepItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#555' },
    stepNum: { backgroundColor: '#1F3864', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 },
    downloadBtn: { backgroundColor: '#28a745', color: 'white', padding: '13px 22px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', alignSelf: 'center' },
    uploadCard: { backgroundColor: 'white', padding: '25px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    uploadTitle: { color: '#1F3864', margin: '0 0 15px 0', fontSize: '16px', fontWeight: 700 },
    uploadArea: { marginBottom: '15px' },
    fileInput: { display: 'none' },
    fileLabel: { display: 'block', padding: '16px 20px', border: '2px dashed #2E75B6', borderRadius: '12px', color: '#2E75B6', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f0f8ff', fontSize: '14px' },
    metaPreview: { display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '13px 16px', backgroundColor: '#f8f9fa', borderRadius: '10px', marginBottom: '15px' },
    metaItem: { display: 'flex', flexDirection: 'column', gap: '3px' },
    metaLabel: { fontSize: '11px', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
    metaValue: { fontSize: '14px', fontWeight: 'bold', color: '#1F3864' },
    blockMsg: { color: '#721c24', backgroundColor: '#f8d7da', padding: '10px 14px', borderRadius: '8px', margin: '0 0 12px', fontSize: '14px' },
    issueBox: { backgroundColor: '#fff8e1', border: '1px solid #ffc107', borderRadius: '10px', padding: '12px 16px', marginBottom: '15px', fontSize: '13px' },
    issueList: { margin: '8px 0', paddingLeft: '20px', color: '#6d5200', lineHeight: 1.6 },
    summaryLine: { margin: '0 0 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' },
    pill: { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    problemText: { color: '#721c24', fontSize: '11px', marginTop: '3px' },
    previewTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 },
    previewWrapper: { overflowX: 'auto', marginBottom: '15px', borderRadius: '10px', border: '1px solid #eee', maxHeight: '420px', overflowY: 'auto' },
    previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
    previewTh: { backgroundColor: '#1F3864', color: 'white', padding: '9px 10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
    previewTd: { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
    progressTrack: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    importBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '13px 30px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' },
    resultBanner: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
    resultTitle: { margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 },
    resultStats: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
    resultStat: { padding: '11px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' },
};

export default Import;
