import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { gradeOf as scaleGrade, pctColor, gradeColor as scaleColor } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { schoolShortName, letterheadHtml } from '../utils/school';
import { SECTION_COLORS_LIVE } from '../utils/schoolData';

// ── Bootstrap Icon helper ─────────────────────────────────────────────────────
const Bi = ({ name, style }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />
);

// ── Loading Overlay ───────────────────────────────────────────────────────────
const LoadingOverlay = ({ message = 'Loading...' }) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,56,100,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '5px solid rgba(255,255,255,0.2)', borderTopColor: '#FFD700', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px' }}>{message}</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>{schoolShortName()}</p>
        </div>
    </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Shared calculations — used by BOTH the screen table and the printout,
// so the two can never disagree
// ══════════════════════════════════════════════════════════════════════════════

// A result's mark as a number, or null if there is no usable mark
const markOf = (r) => {
    if (!r || r.marksObtained === null || r.marksObtained === undefined || r.marksObtained === '') return null;
    const n = Number(r.marksObtained);
    return isNaN(n) ? null : n;
};

// Grades come from the Grading Scales table (utils/grading)
const gradeOf = (m) => scaleGrade(m);
const gradeColor = (g) => scaleColor(g);
const markColor = (m) => pctColor(m);
const fmt = (n, dp = 1) => n === null || n === undefined || isNaN(n) ? '-' : Number.isInteger(n) ? String(n) : n.toFixed(dp);
const fmt2 = (n) => n === null || n === undefined || isNaN(n) ? '-' : Number(n).toFixed(2);

// Standard competition ranking: equal values share a rank (1, 2, 2, 4)
const rankBy = (ids, valueFn) => {
    const vals = ids.map(id => ({ id, v: valueFn(id) }));
    const ranks = {};
    vals.forEach(a => { ranks[a.id] = 1 + vals.filter(b => b.v > a.v + 1e-9).length; });
    return ranks;
};

const computeStats = (students, subjects, pivot) => {
    const subjectStats = {};
    subjects.forEach(sub => {
        const marks = students.map(st => markOf(pivot[st.studentId]?.[sub.id])).filter(m => m !== null);
        const total = marks.reduce((a, b) => a + b, 0);
        subjectStats[sub.id] = { total, mean: marks.length ? total / marks.length : null, count: marks.length };
    });
    const subjectRanks = rankBy(subjects.map(s => s.id), id => subjectStats[id].mean ?? -1);

    const studentStats = {};
    students.forEach(st => {
        const marks = subjects.map(sub => markOf(pivot[st.studentId]?.[sub.id])).filter(m => m !== null);
        const total = marks.reduce((a, b) => a + b, 0);
        const average = marks.length ? total / marks.length : null;
        studentStats[st.studentId] = { total, average, count: marks.length, grade: average === null ? '-' : gradeOf(average) };
    });
    const studentRanks = rankBy(students.map(s => s.studentId), id => studentStats[id].total);

    const means = Object.values(subjectStats).map(s => s.mean).filter(m => m !== null);
    const classMean = means.length ? means.reduce((a, b) => a + b, 0) : null;

    return { subjectStats, subjectRanks, studentStats, studentRanks, classMean };
};

// Students ordered best first: total, then average, then name
const rankOrder = (students, stats) => [...students].sort((a, b) => {
    const A = stats.studentStats[a.studentId], B = stats.studentStats[b.studentId];
    return (B.total - A.total) || ((B.average ?? 0) - (A.average ?? 0)) ||
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
}).map(s => s.studentId);

// ── Class identity helpers ────────────────────────────────────────────────────
const resultStream = (r) => r.student?.schoolClass?.stream || r.student?.stream || null;
const classKeyOfResult = (r) => {
    const classId = r.student?.schoolClass?.classId;
    return classId != null ? 'id:' + classId : 'nm:' + (r.student?.className || '') + '|' + (resultStream(r) || '');
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Run async jobs a few at a time
const runLimited = async (items, limit, job) => {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            try { out[i] = { ok: true, value: await job(items[i]) }; }
            catch (err) { out[i] = { ok: false, error: err }; }
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

// ── Print Results via window.open (mobile-safe) ───────────────────────────────
const printResults = ({ title, examObj, students, subjects, pivot }) => {
    const getCode = (name) => {
        const codes = { 'mathematics':'MTH','english':'ENG','kiswahili':'KSW','science':'SCI','social studies':'SST','agriculture & nutrition':'AGR','agriculture':'AGRI','creative arts':'CRE.A','cre':'CRE','integrated science':'ISCI','pre-technical studies':'P.TEC' };
        const lower = name.toLowerCase().trim();
        if (codes[lower]) return codes[lower];
        const words = name.split(/[\s&]+/).filter(Boolean);
        return words.length === 1 ? name.substring(0, 4).toUpperCase() : words.map(w => w.substring(0, 3).toUpperCase()).join('.');
    };

    const stats = computeStats(students, subjects, pivot);
    const order = rankOrder(students, stats);
    const byId = Object.fromEntries(students.map(s => [s.studentId, s]));
    const cell = 'padding:2px 3px;border:1px solid #ddd;text-align:center;';

    const hdrs = subjects.map(sub =>
        '<th style="color:white;padding:2px;text-align:center;width:35px;vertical-align:bottom;">' +
        '<div style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:10px;min-height:48px;display:flex;align-items:center;justify-content:center;">' +
        esc(getCode(sub.name)) + '</div></th>'
    ).join('');

    const rows = order.map((id, i) => {
        const st = byId[id];
        const ss = stats.studentStats[id];
        const cells = subjects.map(sub => {
            const m = markOf(pivot[id]?.[sub.id]);
            return '<td style="' + cell + '">' + (m === null ? '—' : fmt(m)) + '</td>';
        }).join('');
        return '<tr style="background:' + (i % 2 === 0 ? '#f8f9fa' : 'white') + '">' +
            '<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;font-weight:bold;">' + stats.studentRanks[id] + '</td>' +
            '<td style="padding:2px 4px;border:1px solid #ddd;font-size:11px;">' + esc(st.admissionNumber) + '</td>' +
            '<td style="padding:2px 4px;border:1px solid #ddd;font-size:11px;white-space:nowrap;"><strong>' + esc(st.firstName + ' ' + st.lastName) + '</strong></td>' +
            cells +
            '<td style="' + cell + 'font-weight:bold;background:#f0f4ff;">' + fmt2(ss.total) + '</td>' +
            '<td style="' + cell + 'font-weight:bold;background:#f0f4ff;">' + (ss.average === null ? '-' : ss.average.toFixed(2) + '%') + '</td>' +
            '<td style="' + cell + 'font-weight:bold;background:#f0f4ff;">' + ss.grade + '</td>' +
            '</tr>';
    }).join('');

    const totRow = subjects.map(sub => '<td style="' + cell + 'font-weight:bold;">' + fmt2(stats.subjectStats[sub.id].total) + '</td>').join('');
    const meanRow = subjects.map(sub => '<td style="' + cell + 'font-weight:bold;">' + fmt2(stats.subjectStats[sub.id].mean) + '</td>').join('');
    const rankRow = subjects.map(sub => '<td style="' + cell + 'font-weight:bold;color:#6f42c1;">' +
        (stats.subjectStats[sub.id].mean === null ? '-' : '#' + stats.subjectRanks[sub.id]) + '</td>').join('');
    const classMean = stats.classMean === null ? '-' : stats.classMean.toFixed(2);
    const examLabel = examObj ? examObj.examName : '';

    const toggleJs = (size, margin) =>
        "document.getElementById('pageStyle').textContent='@page{size:A4 " + size + ";margin:" + margin + ";}';" +
        "var b=document.querySelectorAll('.orient');for(var i=0;i<b.length;i++){b[i].style.background='transparent';b[i].style.color='white';}" +
        "this.style.background='#FFD700';this.style.color='#1F3864';";

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + esc(title) + ' Results</title>' +
        '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:\'Times New Roman\',Times,serif;font-size:12px;color:#000;padding:10px;}' +
        '.orient{border:1px solid white;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;margin-right:4px;}' +
        '@media print{.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>' +
        '<style id="pageStyle">@page{size:A4 landscape;margin:8mm;}</style>' +
        '</head><body>' +
        '<div class="no-print" style="background:#1F3864;color:white;padding:10px;margin-bottom:10px;border-radius:5px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
        '<span style="font-weight:bold;">' + esc(title) + ' — ' + esc(examLabel) + '</span><span>' +
        '<button class="orient" onclick="' + toggleJs('portrait', '10mm') + '" style="background:transparent;color:white;">Portrait</button>' +
        '<button class="orient" onclick="' + toggleJs('landscape', '8mm') + '" style="background:#FFD700;color:#1F3864;margin-right:8px;">Landscape</button>' +
        '<button onclick="window.print()" style="background:#28a745;color:white;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;">Print / Save PDF</button>' +
        '</span></div>' +
        '<div style="text-align:center;border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:8px;">' +
        letterheadHtml({ logoSize: 50 }) +
        '<div style="background:#1F3864;padding:4px 10px;text-align:center;margin-top:5px;">' +
        '<div style="color:white;font-weight:bold;">CLASS RESULTS REPORT</div>' +
        '<div style="color:#BDD7EE;font-size:11px;">' + esc(title) + ' | ' + esc(examLabel) + ' | Term ' + esc(examObj ? examObj.term : '') + ' ' + esc(examObj ? examObj.academicYear : '') + '</div>' +
        '</div></div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="background:#1F3864;">' +
        '<th style="color:white;padding:3px 4px;text-align:center;width:25px;">RNK</th>' +
        '<th style="color:white;padding:3px 4px;text-align:left;width:70px;">ADM NO</th>' +
        '<th style="color:white;padding:3px 4px;text-align:left;width:130px;">STUDENT NAME</th>' +
        hdrs +
        '<th style="color:#FFD700;padding:3px 4px;text-align:center;width:35px;">TOT</th>' +
        '<th style="color:#FFD700;padding:3px 4px;text-align:center;width:40px;">AVG%</th>' +
        '<th style="color:#FFD700;padding:3px 4px;text-align:center;width:30px;">GRD</th>' +
        '</tr></thead><tbody>' +
        rows +
        '<tr style="background:#e8f4f8;border-top:2px solid #2E75B6;"><td colspan="3" style="padding:2px 4px;font-weight:bold;border:1px solid #ddd;">SUBJECT TOTAL</td>' + totRow + '<td colspan="3" style="border:1px solid #ddd;"></td></tr>' +
        '<tr style="background:#e3f2fd;"><td colspan="3" style="padding:2px 4px;font-weight:bold;border:1px solid #ddd;">SUBJECT MEAN</td>' + meanRow +
            '<td colspan="3" style="padding:2px 6px;border:2px solid #1F3864;background:#fff;text-align:center;">' +
            '<div style="font-size:9px;color:#555;font-weight:bold;">CLASS TOTAL MEAN</div>' +
            '<div style="font-size:16px;font-weight:bold;color:#1F3864;">' + classMean + '</div>' +
            '</td></tr>' +
        '<tr style="background:#f3e5f5;"><td colspan="3" style="padding:2px 4px;font-weight:bold;color:#6f42c1;border:1px solid #ddd;">SUBJECT RANK</td>' + rankRow + '<td colspan="3" style="border:1px solid #ddd;"></td></tr>' +
        '</tbody></table>' +
        '<div style="display:flex;gap:20px;align-items:center;padding:6px 0;border-top:1px solid #ddd;margin-top:6px;font-size:11px;">' +
        '<span><strong>Total Students:</strong> ' + order.length + '</span>' +
        '<span><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</span>' +
        '<span style="margin-left:auto;background:#1F3864;color:white;padding:3px 12px;border-radius:4px;font-weight:bold;font-size:12px;">CLASS TOTAL MEAN: ' + classMean + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:30px;margin-top:10px;border-top:2px solid #1F3864;padding-top:8px;">' +
        '<div style="flex:1;"><p style="font-size:11px;margin-bottom:5px;">Class Teacher: _________________________</p><p style="font-size:11px;">Signature: _____________ Date: __________</p></div>' +
        '<div style="flex:1;"><p style="font-size:11px;margin-bottom:5px;">Principal: _________________________</p><p style="font-size:11px;">Signature: _____________ Date: __________</p></div>' +
        '</div>' +
        '</body></html>';

    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    return true;
};

// ── Main Component ────────────────────────────────────────────────────────────
function Results() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const userRole = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const linkedStream = localStorage.getItem('linkedStream') || null;
    const isTeacher = userRole === 'TEACHER';
    const isTeacherScoped = isTeacher && !!linkedClassId && linkedClassId !== 'null' && linkedClassId !== 'undefined';

    const [exams, setExams] = useState([]);
    const [step, setStep] = useState(1);
    const [filterExam, setFilterExam] = useState('');
    const [examResults, setExamResults] = useState([]);
    const [classTiles, setClassTiles] = useState([]);
    const [selectedTile, setSelectedTile] = useState(null);
    const [loadingExam, setLoadingExam] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [search, setSearch] = useState('');

    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});
    const [rowOrder, setRowOrder] = useState([]);

    const [editingCell, setEditingCell] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const editingRef = useRef(null);
    const editInputRef = useRef(null);
    const [pendingChanges, setPendingChanges] = useState({});
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const latestExamRequest = useRef('');
    const successTimer = useRef(null);
    const flashSuccess = (msg, ms = 4000) => {
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), ms);
    };

    const pendingCount = Object.keys(pendingChanges).length;

    useEffect(() => { fetchExams(); return () => clearTimeout(successTimer.current); }, []);

    useEffect(() => {
        if (editingCell && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingCell]);

    // Warn before closing or refreshing the tab with unsaved edits
    useEffect(() => {
        if (pendingCount === 0) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [pendingCount]);

    const fetchExams = async () => {
        try {
            const r = await api.get('/api/exams');
            // Newest first: year, then term
            setExams([...r.data].sort((a, b) =>
                String(b.academicYear).localeCompare(String(a.academicYear)) || (Number(b.term) - Number(a.term))));
        } catch (e) { setError('Failed to load exams'); }
    };

    // Results for ONE exam. Uses the by-exam endpoint (as Mark Entry does);
    // falls back to loading everything if that endpoint isn't available.
    const fetchExamResults = async (examId) => {
        try {
            const r = await api.get(`/api/results/by-exam/${examId}`);
            return r.data || [];
        } catch (e) {
            const r = await api.get('/api/results');
            return (r.data || []).filter(x => String(x.exam?.examId) === String(examId));
        }
    };

    const resultBelongsToTeacher = (r) =>
        String(r.student?.schoolClass?.classId) === String(linkedClassId) ||
        (!!linkedClassName && r.student?.className === linkedClassName &&
            (linkedStream ? resultStream(r) === linkedStream : !resultStream(r)));

    const makeTile = (key, rows, base) => ({
        key, ...base,
        studentCount: new Set(rows.map(r => r.student?.studentId).filter(Boolean)).size,
        subjectCount: new Set(rows.map(r => r.subject?.subjectId).filter(Boolean)).size,
    });

    const buildClassTiles = (data) => {
        if (isTeacherScoped) {
            const mine = data.filter(resultBelongsToTeacher);
            if (!mine.length) return [];
            const st = mine[0].student;
            return [makeTile('teacher', mine, {
                className: st?.className || linkedClassName, classId: linkedClassId,
                stream: resultStream(mine[0]) || linkedStream, section: st?.schoolClass?.section || ''
            })];
        }
        const groups = {};
        data.forEach(r => {
            if (!r.student?.className) return;
            const key = classKeyOfResult(r);
            if (!groups[key]) groups[key] = { rows: [], base: {
                className: r.student.className, classId: r.student?.schoolClass?.classId ?? null,
                stream: resultStream(r), section: r.student?.schoolClass?.section || ''
            } };
            groups[key].rows.push(r);
        });
        return Object.entries(groups)
            .map(([key, g]) => makeTile(key, g.rows, g.base))
            .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || String(a.stream || '').localeCompare(String(b.stream || '')));
    };

    const tileResults = (tile, data) => !tile ? [] :
        tile.key === 'teacher' ? data.filter(resultBelongsToTeacher) : data.filter(r => classKeyOfResult(r) === tile.key);

    // Builds the grid from server rows, then lays any unsaved edits on top.
    // keepOrder: keep rows where they are (so they don't jump while editing).
    const buildPivot = (rows, pending, keepOrder) => {
        const subjectMap = {};
        rows.forEach(r => { if (r.subject) subjectMap[r.subject.subjectId] = r.subject.subjectName; });
        const subjects = Object.entries(subjectMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
        const studentMap = {};
        rows.forEach(r => { if (r.student) studentMap[r.student.studentId] = r.student; });
        const students = Object.values(studentMap);
        const pivot = {};
        rows.forEach(r => {
            const sid = r.student?.studentId; const subId = r.subject?.subjectId;
            if (sid && subId) { if (!pivot[sid]) pivot[sid] = {}; pivot[sid][subId] = r; }
        });

        const nextPending = {};
        Object.entries(pending || {}).forEach(([key, p]) => {
            if (!studentMap[p.studentId] || !subjectMap[p.subjectId]) return;
            const fresh = pivot[p.studentId]?.[p.subjectId];
            nextPending[key] = { ...p, resultId: fresh?.resultId || p.resultId || null };
            if (!pivot[p.studentId]) pivot[p.studentId] = {};
            pivot[p.studentId][p.subjectId] = { ...(fresh || {}), marksObtained: p.marks };
        });

        const stats = computeStats(students, subjects, pivot);
        const ranked = rankOrder(students, stats);
        setRowOrder(prev => {
            if (!keepOrder || !prev.length) return ranked;
            const alive = new Set(ranked);
            const kept = prev.filter(id => alive.has(id));
            return [...kept, ...ranked.filter(id => !kept.includes(id))];
        });
        setPivotSubjects(subjects); setPivotStudents(students); setPivotData(pivot);
        setPendingChanges(nextPending);
    };

    const confirmDiscard = () =>
        pendingCount === 0 || window.confirm(`You have ${pendingCount} unsaved change(s). Discard them?`);

    const handleSelectExam = async (examId) => {
        setError(''); setFilterExam(examId); setSelectedTile(null); setSearch('');
        setPivotStudents([]); setPivotSubjects([]); setPivotData({}); setRowOrder([]);
        setClassTiles([]); setPendingChanges({}); setEditingCell(null); editingRef.current = null;
        if (!examId) { setStep(1); return; }
        setStep(2); setLoadingExam(true);
        latestExamRequest.current = String(examId);
        try {
            const data = await fetchExamResults(examId);
            if (latestExamRequest.current !== String(examId)) return; // a newer exam was clicked
            setExamResults(data);
            setClassTiles(buildClassTiles(data));
        } catch (e) { setError('Failed to load classes for this exam'); }
        setLoadingExam(false);
    };

    const handleSelectClass = (tile) => {
        setSelectedTile(tile); setSearch(''); setError('');
        setEditingCell(null); editingRef.current = null;
        buildPivot(tileResults(tile, examResults), {}, false);
        setStep(3);
    };

    // Reload this exam from the server and rebuild the grid, keeping unsaved edits
    const refreshClass = async (pending, keepOrder) => {
        setRefreshing(true);
        try {
            const data = await fetchExamResults(filterExam);
            setExamResults(data);
            setClassTiles(buildClassTiles(data));
            buildPivot(tileResults(selectedTile, data), pending, keepOrder);
        } catch (e) { setError('Could not reload results from the server. Refresh the page to see the latest marks.'); }
        setRefreshing(false);
    };

    // ── Editing ───────────────────────────────────────────────────────────────
    const startEdit = (studentId, subjectId) => {
        const m = markOf(pivotData[studentId]?.[subjectId]);
        const cell = { studentId, subjectId };
        editingRef.current = cell;
        setEditingCell(cell);
        setEditingValue(m === null ? '' : String(m));
    };

    const cancelEdit = () => { editingRef.current = null; setEditingCell(null); };

    // Returns true when the edit was accepted (or unchanged)
    const commitEdit = (studentId, subjectId, fromBlur = false) => {
        const cur = editingRef.current;
        if (!cur || cur.studentId !== studentId || cur.subjectId !== subjectId) return true; // stale blur
        const key = `${studentId}_${subjectId}`;
        const existing = pivotData[studentId]?.[subjectId];
        const newVal = editingValue.trim();
        if (newVal === '' || (markOf(existing) !== null && Number(newVal) === markOf(existing))) { cancelEdit(); return true; }
        const parsed = parseFloat(newVal);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            setError('Marks must be a number from 0 to 100');
            if (fromBlur) cancelEdit();
            return false;
        }
        setError('');
        setPendingChanges(prev => ({ ...prev, [key]: { marks: parsed, resultId: existing?.resultId || null, studentId, subjectId } }));
        setPivotData(prev => ({ ...prev, [studentId]: { ...prev[studentId], [subjectId]: { ...(prev[studentId]?.[subjectId] || {}), marksObtained: parsed } } }));
        cancelEdit();
        return true;
    };

    // Enter = next student (same subject), Tab = next subject, Shift+Tab = previous subject
    const moveFrom = (studentId, subjectId, dir, visibleIds) => {
        const subIds = pivotSubjects.map(s => s.id);
        let r = visibleIds.indexOf(studentId), c = subIds.indexOf(subjectId);
        if (dir === 'down') r++;
        if (dir === 'up') r--;
        if (dir === 'right') { c++; if (c >= subIds.length) { c = 0; r++; } }
        if (dir === 'left') { c--; if (c < 0) { c = subIds.length - 1; r--; } }
        if (r >= 0 && r < visibleIds.length && c >= 0 && c < subIds.length) startEdit(visibleIds[r], subIds[c]);
    };

    // ── Save / discard / delete ───────────────────────────────────────────────
    const handleSaveChanges = async () => {
        const changes = Object.values(pendingChanges);
        if (!changes.length) return;
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/results/bulk-save', {
                examId: parseInt(filterExam),
                results: changes.map(c => ({ studentId: c.studentId, subjectId: parseInt(c.subjectId), marksObtained: c.marks, maxMarks: 100, resultId: c.resultId || null }))
            });
            const d = r.data || {};
            if (d.failed > 0) {
                setError(`${d.failed} change(s) failed to save; ${d.saved || 0} saved, ${d.updated || 0} updated. ${d.errors?.[0] || ''} Your edits are kept — try Save again.`);
                await refreshClass(pendingChanges, true);
            } else {
                flashSuccess(`${d.updated || 0} updated, ${d.saved || 0} new saved.`);
                await refreshClass({}, false);
            }
        } catch (e) {
            setError(`Save failed: ${e.response?.data?.message || e.message}. Your edits are kept — try again.`);
        }
        setSaving(false);
    };

    const handleDiscardChanges = () => {
        if (!window.confirm(`Discard ${pendingCount} unsaved change(s)?`)) return;
        cancelEdit();
        buildPivot(tileResults(selectedTile, examResults), {}, false);
    };

    const withoutKeys = (obj, pred) => Object.fromEntries(Object.entries(obj).filter(([k]) => !pred(k)));

    const handleDeleteMark = async (studentId, subjectId) => {
        const key = `${studentId}_${subjectId}`;
        const result = pivotData[studentId]?.[subjectId];
        const remaining = withoutKeys(pendingChanges, k => k === key);
        setDeleting(true);
        try {
            if (result?.resultId) {
                await api.delete(`/api/results/${result.resultId}`);
                flashSuccess('Mark deleted');
                await refreshClass(remaining, true);
            } else {
                buildPivot(tileResults(selectedTile, examResults), remaining, true); // unsaved mark: just drop it
            }
        } catch (e) { setError('Failed to delete mark'); }
        setDeleting(false);
        setConfirmDelete(null);
    };

    const handleDeleteSubject = async (subjectId, subjectName) => {
        const toDelete = pivotStudents.map(s => pivotData[s.studentId]?.[subjectId]).filter(r => r?.resultId);
        setDeleting(true);
        const outcomes = await runLimited(toDelete, 5, r => api.delete(`/api/results/${r.resultId}`));
        const failed = outcomes.filter(o => !o.ok).length;
        const remaining = withoutKeys(pendingChanges, k => k.endsWith(`_${subjectId}`));
        await refreshClass(remaining, true);
        if (failed) setError(`${toDelete.length - failed} ${subjectName} mark(s) deleted, ${failed} could not be deleted. Try again.`);
        else flashSuccess(`All ${toDelete.length} ${subjectName} mark(s) deleted`);
        setDeleting(false);
        setConfirmDelete(null);
    };

    const handlePrint = () => {
        const ok = printResults({
            title: classDisplayName(selectedTile) || selectedTile?.className || '',
            examObj: exams.find(e => String(e.examId) === String(filterExam)),
            students: pivotStudents, subjects: pivotSubjects, pivot: pivotData
        });
        if (!ok) setError('Your browser blocked the print window. Allow pop-ups for this site, then try again.');
    };

    const backToClasses = () => {
        if (!confirmDiscard()) return;
        cancelEdit(); setPendingChanges({}); setSelectedTile(null); setSearch(''); setStep(2);
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const selectedExam = exams.find(e => String(e.examId) === String(filterExam));
    const selectedExamName = selectedExam?.examName || '';
    const classLabel = selectedTile ? (classDisplayName(selectedTile) || selectedTile.className) : '';
    const stats = computeStats(pivotStudents, pivotSubjects, pivotData);
    const studentById = Object.fromEntries(pivotStudents.map(s => [s.studentId, s]));
    const q = search.trim().toLowerCase();
    const visibleIds = rowOrder.filter(id => {
        const st = studentById[id];
        if (!st) return false;
        if (!q) return true;
        return `${st.firstName} ${st.lastName}`.toLowerCase().includes(q) ||
            `${st.lastName} ${st.firstName}`.toLowerCase().includes(q) ||
            String(st.admissionNumber ?? '').toLowerCase().includes(q);
    });
    const deleteSubjectCount = confirmDelete?.type === 'subject'
        ? pivotStudents.filter(s => pivotData[s.studentId]?.[confirmDelete.subjectId]?.resultId).length : 0;

    return (
        <div style={styles.container}>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {loadingExam && <LoadingOverlay message="Loading class results..." />}

            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <h2 style={styles.title}><Bi name="bar-chart-fill" style={{ marginRight: '10px' }} />Results</h2>
                <p style={styles.subtitle}>Select exam and class to view results</p>

                {error && <p style={styles.error} role="alert"><Bi name="exclamation-triangle-fill" />{error}</p>}
                {successMsg && <p style={styles.success}><Bi name="check-circle-fill" />{successMsg}</p>}

                {pendingCount > 0 && (
                    <div style={styles.pendingBanner}>
                        <span style={{ color: '#856404', fontWeight: 'bold' }}>
                            <Bi name="pencil-fill" />{pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleSaveChanges} disabled={saving || refreshing} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {saving ? <><Bi name="hourglass-split" />Saving...</> : <><Bi name="save-fill" />Save Changes</>}
                            </button>
                            <button onClick={handleDiscardChanges} disabled={saving} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '5px', cursor: 'pointer' }}>
                                <Bi name="x-lg" />Discard
                            </button>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div>
                        <h3 style={styles.stepTitle}><Bi name="file-earmark-text-fill" />Select an Exam</h3>
                        {exams.length === 0 ? (
                            <div style={styles.emptyCard}><p><Bi name="inbox" />No exams yet. Create one under Exams first.</p></div>
                        ) : (
                            <div style={styles.examGrid}>
                                {exams.map(exam => (
                                    <div key={exam.examId} onClick={() => handleSelectExam(exam.examId)}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                                        style={styles.examTile}>
                                        <div style={styles.examTileIcon}><Bi name="file-earmark-text" style={{ marginRight: 0 }} /></div>
                                        <div style={styles.examTileName}>{exam.examName}</div>
                                        <div style={styles.examTileMeta}>Term {exam.term} · {exam.academicYear}</div>
                                        <div style={styles.examTileAction}>View classes<Bi name="arrow-right" style={{ marginLeft: '6px', marginRight: 0 }} /></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={() => { setStep(1); setClassTiles([]); setFilterExam(''); }} style={styles.backBtn}>
                                <Bi name="arrow-left" />Back
                            </button>
                            <div>
                                <h3 style={styles.stepTitle}><Bi name="building" />Select a Class</h3>
                                <p style={styles.stepSub}>{selectedExamName} — {classTiles.length} class{classTiles.length !== 1 ? 'es' : ''} with results</p>
                            </div>
                        </div>
                        {loadingExam ? (
                            <div style={styles.classGrid}>
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} style={styles.skeletonTile}>
                                        <div style={styles.skeletonTitle} />
                                        <div style={styles.skeletonStats} />
                                        <div style={styles.skeletonAction} />
                                    </div>
                                ))}
                            </div>
                        ) : classTiles.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <p><Bi name="inbox" />No results found for this exam yet.</p>
                                {isTeacher ? (
                                    <p style={{ color: '#666', fontSize: '13px' }}>No marks have been entered yet for your class ({linkedClassName}{linkedStream ? ` ${linkedStream}` : ''}) in this exam.</p>
                                ) : (
                                    <p style={{ color: '#666', fontSize: '13px' }}>Use Mark Entry to add marks first.</p>
                                )}
                            </div>
                        ) : (
                            <div style={styles.classGrid}>
                                {classTiles.map(tile => {
                                    const color = SECTION_COLORS_LIVE[tile.section] || '#1F3864';
                                    return (
                                        <div key={tile.key} onClick={() => handleSelectClass(tile)}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
                                            style={{ ...styles.classTile, borderTop: `4px solid ${color}` }}>
                                            <div style={{ ...styles.classTileHeader, color }}>{classDisplayName(tile) || tile.className}</div>
                                            <div style={styles.classTileStats}>
                                                <div style={styles.classStat}><span style={styles.classStatNum}>{tile.studentCount}</span><span style={styles.classStatLbl}>Students</span></div>
                                                <div style={styles.classDivider} />
                                                <div style={styles.classStat}><span style={styles.classStatNum}>{tile.subjectCount}</span><span style={styles.classStatLbl}>Subjects</span></div>
                                            </div>
                                            <div style={{ ...styles.classTileAction, backgroundColor: color }}>View Results<Bi name="arrow-right" style={{ marginLeft: '6px', marginRight: 0 }} /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={backToClasses} style={styles.backBtn}><Bi name="arrow-left" />Back to Classes</button>
                            <h3 style={styles.stepTitle}><Bi name="bar-chart-fill" />{classLabel} — {selectedExamName}</h3>
                            <div style={styles.searchBox}>
                                <Bi name="search" style={{ color: '#888', marginRight: '8px' }} />
                                <input style={styles.searchInput} placeholder="Search name or admission no..." value={search} onChange={e => setSearch(e.target.value)} />
                                {search && (
                                    <button onClick={() => setSearch('')} style={styles.searchClear} title="Clear search"><Bi name="x-lg" style={{ marginRight: 0 }} /></button>
                                )}
                            </div>
                            {refreshing && <span style={{ color: '#666', fontSize: '13px' }}><Bi name="arrow-repeat" />Updating…</span>}
                        </div>

                        {pivotStudents.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <p><Bi name="inbox" />No results found for <strong>{selectedExamName}</strong> — <strong>{classLabel}</strong></p>
                                <p style={{ color: '#666', fontSize: '13px' }}>Use Mark Entry to add marks for this class and exam.</p>
                            </div>
                        ) : (
                            <div style={styles.tableCard}>
                                <div style={styles.tableTopBar}>
                                    <div>
                                        <h3 style={styles.tableTitle}>{classLabel} — {selectedExamName}</h3>
                                        <p style={styles.tableSubtitle}>
                                            {pivotStudents.length} students | {pivotSubjects.length} subjects · <Bi name="lightbulb" style={{ marginRight: '3px' }} />Click any mark to edit · Enter = next student, Tab = next subject
                                        </p>
                                    </div>
                                    <button onClick={handlePrint} style={styles.printBtn} disabled={pendingCount > 0}
                                        title={pendingCount > 0 ? 'Save or discard your changes before printing' : 'Print class results'}>
                                        <Bi name="printer-fill" />Print Results
                                    </button>
                                    <div style={styles.tableBadges}>
                                        <span style={styles.badge}><Bi name="people-fill" style={{ marginRight: '4px' }} />{pivotStudents.length}</span>
                                        <span style={styles.badge}><Bi name="journals" style={{ marginRight: '4px' }} />{pivotSubjects.length}</span>
                                        {q && <span style={styles.badge}><Bi name="search" style={{ marginRight: '4px' }} />{visibleIds.length} shown</span>}
                                        {pendingCount > 0 && <span style={{ ...styles.badge, backgroundColor: '#fd7e14' }}><Bi name="pencil-fill" style={{ marginRight: '4px' }} />{pendingCount} pending</span>}
                                    </div>
                                    {stats.classMean !== null && (
                                        <div style={{ backgroundColor: '#1F3864', borderRadius: '8px', padding: '8px 16px', textAlign: 'center', minWidth: '100px', border: '1px solid rgba(255,255,255,0.2)' }}>
                                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>CLASS TOTAL MEAN</div>
                                            <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold', lineHeight: 1.1 }}>{stats.classMean.toFixed(2)}</div>
                                        </div>
                                    )}
                                </div>

                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.tableHeader}>
                                                <th style={{ ...styles.th, ...styles.stickyCol, ...styles.stickyHead }}>#</th>
                                                <th style={{ ...styles.th, ...styles.stickyCol2, ...styles.stickyHead }}>Adm No</th>
                                                <th style={{ ...styles.th, ...styles.stickyCol3, ...styles.stickyHead }}>Student Name</th>
                                                {pivotSubjects.map(sub => (
                                                    <th key={sub.id} style={{ ...styles.th, ...styles.subjectTh }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                            <span>{sub.name}</span>
                                                            <button onClick={() => setConfirmDelete({ type: 'subject', subjectId: sub.id, subjectName: sub.name })}
                                                                title={`Delete all ${sub.name} marks`}
                                                                style={{ backgroundColor: 'rgba(220,53,69,0.85)', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px', lineHeight: '1.4' }}>
                                                                <Bi name="trash-fill" style={{ marginRight: '3px' }} />Del All
                                                            </button>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Total</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Avg %</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Grade</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleIds.length === 0 && (
                                                <tr><td colSpan={pivotSubjects.length + 7} style={{ ...styles.td, textAlign: 'center', padding: '30px', color: '#666' }}>No students match "{search}"</td></tr>
                                            )}
                                            {visibleIds.map((studentId, index) => {
                                                const student = studentById[studentId];
                                                const ss = stats.studentStats[studentId];
                                                const rowBg = index % 2 === 0 ? '#f9f9f9' : 'white';
                                                return (
                                                    <tr key={studentId} style={{ backgroundColor: rowBg }}>
                                                        <td style={{ ...styles.td, ...styles.stickyCol, backgroundColor: rowBg, textAlign: 'center' }}>{index + 1}</td>
                                                        <td style={{ ...styles.td, ...styles.stickyCol2, backgroundColor: rowBg }}><span style={styles.admNo}>{student.admissionNumber}</span></td>
                                                        <td style={{ ...styles.td, ...styles.stickyCol3, backgroundColor: rowBg }}><strong>{student.firstName} {student.lastName}</strong></td>
                                                        {pivotSubjects.map(sub => {
                                                            const result = pivotData[studentId]?.[sub.id];
                                                            const m = markOf(result);
                                                            const isEditing = editingCell?.studentId === studentId && editingCell?.subjectId === sub.id;
                                                            const isPending = !!pendingChanges[`${studentId}_${sub.id}`];
                                                            return (
                                                                <td key={sub.id} style={{ ...styles.td, textAlign: 'center', padding: '2px 4px' }}>
                                                                    {isEditing ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                            <input ref={editInputRef} type="number" min="0" max="100"
                                                                                value={editingValue} onChange={e => setEditingValue(e.target.value)}
                                                                                onWheel={e => e.currentTarget.blur()}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
                                                                                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                                                                                    const dir = e.key === 'Enter' || e.key === 'ArrowDown' ? 'down'
                                                                                        : e.key === 'ArrowUp' ? 'up'
                                                                                        : e.key === 'Tab' ? (e.shiftKey ? 'left' : 'right') : null;
                                                                                    if (!dir) return;
                                                                                    e.preventDefault();
                                                                                    if (commitEdit(studentId, sub.id)) moveFrom(studentId, sub.id, dir, visibleIds);
                                                                                }}
                                                                                onBlur={() => commitEdit(studentId, sub.id, true)}
                                                                                style={{ width: '60px', padding: '4px', border: '2px solid #2E75B6', borderRadius: '4px', fontSize: '16px', textAlign: 'center', outline: 'none', backgroundColor: '#e3f2fd' }} />
                                                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                                                <button onMouseDown={e => { e.preventDefault(); commitEdit(studentId, sub.id); }} title="Keep" style={{ backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}><Bi name="check-lg" style={{ marginRight: 0 }} /></button>
                                                                                <button onMouseDown={e => { e.preventDefault(); cancelEdit(); }} title="Cancel" style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}><Bi name="x-lg" style={{ marginRight: 0 }} /></button>
                                                                            </div>
                                                                        </div>
                                                                    ) : m !== null ? (
                                                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '4px', minHeight: '44px', justifyContent: 'center', outline: isPending ? '2px solid #fd7e14' : 'none' }}>
                                                                            <div onClick={() => startEdit(studentId, sub.id)} title="Click to edit" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                                                <span style={{ fontSize: '15px', fontWeight: 'bold', color: markColor(m) }}>{fmt(m)}</span>
                                                                                <span style={{ color: 'white', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold', backgroundColor: gradeColor(gradeOf(m)) }}>{gradeOf(m)}</span>
                                                                            </div>
                                                                            <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'mark', studentId, subjectId: sub.id, studentName: `${student.firstName} ${student.lastName}`, subjectName: sub.name }); }}
                                                                                title="Delete this mark"
                                                                                style={{ position: 'absolute', top: '1px', right: '1px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '0px 4px', cursor: 'pointer', fontSize: '9px', lineHeight: '1.4' }}>
                                                                                <Bi name="x-lg" style={{ marginRight: 0 }} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span onClick={() => startEdit(studentId, sub.id)} title="Click to add mark"
                                                                            style={{ color: '#bbb', fontSize: '18px', cursor: 'pointer', display: 'block', lineHeight: '44px' }}>
                                                                            <Bi name="plus-lg" style={{ marginRight: 0 }} />
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}><strong>{ss.count ? fmt2(ss.total) : '-'}</strong></td>
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}><span style={{ color: markColor(ss.average), fontWeight: 'bold' }}>{ss.average === null ? '-' : ss.average.toFixed(2) + '%'}</span></td>
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}><span style={{ ...styles.gradeBadge, backgroundColor: gradeColor(ss.grade) }}>{ss.grade}</span></td>
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}><span style={styles.rankBadge}>{stats.studentRanks[studentId]}</span></td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' }}>
                                                <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#1F3864', fontSize: '12px' }}><Bi name="calculator" />Total Marks</td>
                                                {pivotSubjects.map(sub => <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}><strong style={{ color: '#1F3864', fontSize: '12px' }}>{fmt2(stats.subjectStats[sub.id].total)}</strong></td>)}
                                                <td colSpan="4" style={styles.td} />
                                            </tr>
                                            <tr style={{ backgroundColor: '#e3f2fd' }}>
                                                <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#2E75B6', fontSize: '12px' }}><Bi name="graph-up" />Mean (excl. blanks)</td>
                                                {pivotSubjects.map(sub => {
                                                    const s = stats.subjectStats[sub.id];
                                                    return <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}><span style={{ fontWeight: 'bold', fontSize: '12px', color: markColor(s.mean) }}>{fmt2(s.mean)}</span><div style={{ fontSize: '9px', color: '#999' }}>{s.count} pupils</div></td>;
                                                })}
                                                <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center', padding: '4px 6px' }}>
                                                    {stats.classMean !== null && (
                                                        <div>
                                                            <div style={{ fontSize: '9px', color: '#555', fontWeight: 'bold', whiteSpace: 'nowrap' }}>CLASS MEAN</div>
                                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F3864' }}>{stats.classMean.toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td colSpan="3" style={styles.td} />
                                            </tr>
                                            <tr style={{ backgroundColor: '#f3e5f5', borderBottom: '3px solid #6f42c1' }}>
                                                <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#6f42c1', fontSize: '12px' }}><Bi name="trophy-fill" />Subject Rank</td>
                                                {pivotSubjects.map(sub => <td key={sub.id} style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: '#6f42c1' }}>{stats.subjectStats[sub.id].mean === null ? '-' : '#' + stats.subjectRanks[sub.id]}</td>)}
                                                <td colSpan="4" style={styles.td} />
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div style={styles.legend}>
                                    <span style={styles.legendTitle}><Bi name="lightbulb" />Click any mark to edit · Grade Legend:</span>
                                    {[['EE (75-100)', '#28a745'], ['ME (55-74)', '#2E75B6'], ['AE (40-54)', '#ffc107'], ['BE (0-39)', '#dc3545']].map(([label, color]) => (
                                        <span key={label} style={{ ...styles.legendItem, color }}><Bi name="circle-fill" style={{ fontSize: '9px', marginRight: '4px' }} />{label}</span>
                                    ))}
                                    {pendingCount > 0 && <span style={{ ...styles.legendItem, color: '#fd7e14' }}><Bi name="square" style={{ marginRight: '4px' }} />Orange outline = unsaved</span>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {confirmDelete && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', maxWidth: '400px', width: '90%' }}>
                        <h3 style={{ color: '#dc3545', margin: '0 0 12px 0', fontSize: '18px' }}><Bi name="exclamation-triangle-fill" />Confirm Delete</h3>
                        {confirmDelete.type === 'mark' ? (
                            <p style={{ color: '#555', marginBottom: '20px' }}>Delete the <strong>{confirmDelete.subjectName}</strong> mark for <strong>{confirmDelete.studentName}</strong>? This cannot be undone.</p>
                        ) : (
                            <p style={{ color: '#555', marginBottom: '20px' }}>Delete <strong>all {deleteSubjectCount} saved {confirmDelete.subjectName} mark(s)</strong> for {classLabel} in {selectedExamName}? This cannot be undone.</p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                            <button disabled={deleting}
                                onClick={() => confirmDelete.type === 'mark' ? handleDeleteMark(confirmDelete.studentId, confirmDelete.subjectId) : handleDeleteSubject(confirmDelete.subjectId, confirmDelete.subjectName)}
                                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {deleting ? <><Bi name="hourglass-split" />Deleting...</> : <><Bi name="trash-fill" />Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    subtitle: { color: '#666', marginBottom: '20px' },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    pendingBanner: { backgroundColor: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', padding: '10px 16px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', position: 'sticky', top: 0, zIndex: 5 },
    stepHeader: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' },
    stepTitle: { color: '#1F3864', margin: '0 0 3px 0', fontSize: '20px' },
    stepSub: { color: '#666', margin: 0, fontSize: '13px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    searchBox: { display: 'flex', alignItems: 'center', border: '2px solid #ddd', borderRadius: '8px', padding: '0 10px', backgroundColor: 'white', minWidth: '240px', flex: '0 1 320px' },
    searchInput: { flex: 1, minWidth: 0, padding: '9px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    searchClear: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px', fontSize: '13px' },
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '15px', marginBottom: '20px' },
    examTile: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.15s', userSelect: 'none', WebkitUserSelect: 'none' },
    examTileIcon: { fontSize: '34px', textAlign: 'center', padding: '20px 20px 8px', color: '#2E75B6' },
    examTileName: { color: '#1F3864', fontWeight: 'bold', fontSize: '16px', textAlign: 'center', padding: '0 15px 5px' },
    examTileMeta: { color: '#888', fontSize: '12px', textAlign: 'center', padding: '0 15px 12px' },
    examTileAction: { backgroundColor: '#1F3864', color: 'white', textAlign: 'center', padding: '8px', fontSize: '12px' },
    classGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '12px', marginBottom: '20px' },
    classTile: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'transform 0.15s,box-shadow 0.15s', userSelect: 'none', WebkitUserSelect: 'none' },
    classTileHeader: { fontSize: '18px', fontWeight: 'bold', textAlign: 'center', padding: '16px 10px 8px' },
    classTileStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '8px 10px' },
    classStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    classStatNum: { fontSize: '20px', fontWeight: 'bold', color: '#1F3864' },
    classStatLbl: { fontSize: '10px', color: '#888' },
    classDivider: { width: '1px', height: '30px', backgroundColor: '#eee' },
    classTileAction: { color: 'white', textAlign: 'center', padding: '7px', fontSize: '12px', marginTop: '8px' },
    skeletonTile: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', padding: '16px 10px', borderTop: '4px solid #e0e0e0' },
    skeletonTitle: { height: '22px', backgroundColor: '#f0f0f0', borderRadius: '4px', margin: '0 auto 12px', width: '60%', animation: 'pulse 1.5s ease-in-out infinite' },
    skeletonStats: { height: '40px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '12px' },
    skeletonAction: { height: '28px', backgroundColor: '#e8e8e8', borderRadius: '4px' },
    tableCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '20px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '12px' },
    tableBadges: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#1F3864' },
    subjectTh: { textAlign: 'center', backgroundColor: '#2E75B6', minWidth: '80px' },
    totalTh: { textAlign: 'center', backgroundColor: '#1a2d4f', minWidth: '70px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    // Frozen columns: fixed box widths so each column's left offset lines up exactly
    stickyCol: { position: 'sticky', left: 0, zIndex: 1, width: '44px', minWidth: '44px', maxWidth: '44px', boxSizing: 'border-box', padding: '8px 4px', textAlign: 'center' },
    stickyCol2: { position: 'sticky', left: '44px', zIndex: 1, width: '100px', minWidth: '100px', maxWidth: '100px', boxSizing: 'border-box' },
    stickyCol3: { position: 'sticky', left: '144px', zIndex: 1, minWidth: '170px', boxSizing: 'border-box', borderRight: '2px solid #ddd' },
    stickyHead: { zIndex: 3, backgroundColor: '#1F3864' },
    totalCell: { backgroundColor: '#f0f4ff', fontWeight: 'bold' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' },
    rankBadge: { backgroundColor: '#1F3864', color: 'white', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' },
    legend: { padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8f9fa' },
    legendTitle: { fontWeight: 'bold', color: '#1F3864', fontSize: '12px' },
    legendItem: { fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    emptyCard: { backgroundColor: 'white', padding: '40px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default Results;
