import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { gradeOf as scaleGrade, pctColor } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { schoolName, schoolShortName, schoolMotto, schoolContact, logoLeftUrl, logoRightUrl } from '../utils/school';
import { EXAM_TYPES_LIVE, STREAM_NAMES_LIVE, SECTIONS_LIVE, SECTION_COLORS_LIVE } from '../utils/schoolData';

// ── Bootstrap Icon helper ─────────────────────────────────────────────────────
const Bi = ({ name, style }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />
);

// Grades come from the Grading Scales table (utils/grading)
const gradeLabel = (m) => scaleGrade(m);
const gradeColor = (m) => pctColor(m);

// ══════════════════════════════════════════════════════════════════════════════
// PRINTING
// One page builder is shared by "Print" (one card) and "Print All" (many cards),
// so both always produce exactly the same report card.
// ══════════════════════════════════════════════════════════════════════════════

// Escape text before putting it into HTML — a comment containing "<" or "&"
// would otherwise break the printed page
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Absolute logo URLs so they load inside the print window

// Exam type names/colours and stream names from School Settings
const EXAM_TYPE_LABELS = new Proxy(EXAM_TYPES_LIVE, { get: (t, k) => t[k]?.label || k });
const EXAM_TYPE_COLORS = new Proxy(EXAM_TYPES_LIVE, { get: (t, k) => t[k]?.color });
const STREAM_NAMES = STREAM_NAMES_LIVE;

const pGc = (m) => pctColor(m);
const pGl = (m) => scaleGrade(m);
const pBadge = (m) => m == null
    ? '<span style="color:#ccc;">-</span>'
    : '<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-weight:bold;font-size:11px;color:white;background:' + pGc(m) + ';">' + pGl(m) + '</span>';

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

// Builds the HTML for ONE report card page
const buildReportPage = (card, singleResults, progressiveData) => {
    const student = card.student;
    const exam = card.exam;
    const term = exam?.term;
    const academicYear = exam?.academicYear;
    const studentName = student ? student.firstName + ' ' + student.lastName : '-';

    const termExams = progressiveData?.exams || [];
    const rawSubjects = progressiveData?.subjects || [];
    const isProgressive = termExams.length > 1 && rawSubjects.length > 0;

    let subjectRows = '';
    let theadCols = '';
    let avgRowHtml = '';
    let termAvgSum = 0, termAvgCount = 0;

    if (isProgressive) {
        const allCols = termExams.map(e => e.examType).filter(Boolean);
        const colSums = { OPENING: 0, MID_TERM: 0, END_TERM: 0 };
        const colCounts = { OPENING: 0, MID_TERM: 0, END_TERM: 0 };
        rawSubjects.forEach(sub => {
            if (sub.opening != null) { colSums.OPENING += sub.opening; colCounts.OPENING++; }
            if (sub.midTerm != null) { colSums.MID_TERM += sub.midTerm; colCounts.MID_TERM++; }
            if (sub.endTerm != null) { colSums.END_TERM += sub.endTerm; colCounts.END_TERM++; }
            [sub.opening, sub.midTerm, sub.endTerm].forEach(v => { if (v != null) { termAvgSum += v; termAvgCount++; } });
        });
        const examCols = [...new Set(allCols)].filter(type => colCounts[type] > 0);
        const subjectColPct = 34;
        const examColPct = examCols.length > 0 ? ((100 - subjectColPct) / examCols.length).toFixed(1) : 0;

        theadCols = '<th style="width:' + subjectColPct + '%;color:white;padding:7px 8px;text-align:left;font-size:12px;">SUBJECT</th>'
            + examCols.map(type =>
                '<th style="width:' + examColPct + '%;color:white;padding:6px 8px;text-align:center;background:' + (EXAM_TYPE_COLORS[type] || '#1F3864') + ';font-size:11px;">' + esc(EXAM_TYPE_LABELS[type] || type) + '</th>'
            ).join('');

        subjectRows = rawSubjects.map((sub, i) => {
            const cells = examCols.map(type => {
                const val = type === 'OPENING' ? sub.opening : type === 'MID_TERM' ? sub.midTerm : sub.endTerm;
                return '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">' + pBadge(val) + '</td>';
            }).join('');
            return '<tr style="background:' + (i % 2 === 0 ? '#f8f9fa' : 'white') + '">'
                + '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;font-size:12px;">' + (i + 1) + '. ' + esc(sub.subjectName) + '</td>'
                + cells + '</tr>';
        }).join('');

        avgRowHtml = '<tr style="background:#e8ecf3;border-top:2px solid #1F3864;">'
            + '<td style="padding:6px 8px;font-weight:bold;color:#1F3864;font-size:12px;">Total</td>'
            + examCols.map(type =>
                '<td style="padding:6px 8px;text-align:center;color:#1F3864;font-weight:bold;">' + (colSums[type] || 0) + '/' + ((colCounts[type] || 0) * 100) + '</td>'
            ).join('')
            + '</tr>';
    } else {
        theadCols = '<th style="width:60%;color:white;padding:7px 8px;text-align:left;font-size:12px;">SUBJECT</th>'
            + '<th style="width:40%;color:#FFD700;padding:7px 8px;text-align:center;font-size:12px;">GRADE</th>';
        subjectRows = singleResults.map((r, i) => {
            if (r.marksObtained != null && !isNaN(r.marksObtained)) { termAvgSum += r.marksObtained; termAvgCount++; }
            return '<tr style="background:' + (i % 2 === 0 ? '#f8f9fa' : 'white') + '">'
                + '<td style="padding:6px 8px;border:1px solid #ddd;font-size:12px;">' + (i + 1) + '. ' + esc(r.subject ? r.subject.subjectName : '') + '</td>'
                + '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">' + pBadge(r.marksObtained) + '</td>'
                + '</tr>';
        }).join('');
    }

    const termAvg = termAvgCount > 0 ? termAvgSum / termAvgCount : null;
    const subjectCount = isProgressive ? rawSubjects.length : singleResults.length;
    const streamName = student?.stream ? (STREAM_NAMES[student.stream] || student.stream) : '-';
    const dots = '.................................................................';

    return '<div class="report-page">'
        + '<div style="border-bottom:3px solid #1F3864;padding-bottom:8px;margin-bottom:10px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        + '<img src="' + esc(logoLeftUrl()) + '" onerror="this.style.visibility=\'hidden\'" style="width:55px;height:55px;object-fit:contain;">'
        + '<div style="text-align:center;flex:1;padding:0 10px;">'
        + '<div style="color:#1F3864;font-size:13px;font-weight:bold;text-transform:uppercase;">' + esc(schoolName()) + '</div>'
        + '<div style="color:#2E75B6;font-style:italic;font-size:11px;margin:2px 0;">' + esc(schoolMotto()) + '</div>'
        + (schoolContact() ? '<div style="font-size:10px;color:#555;">' + esc(schoolContact()) + '</div>' : '')
        + '</div>'
        + '<img src="' + esc(logoRightUrl()) + '" onerror="this.style.visibility=\'hidden\'" style="width:55px;height:55px;object-fit:contain;">'
        + '</div>'
        + '<div style="border:1.5px solid #1F3864;padding:5px 10px;text-align:center;border-radius:4px;">'
        + '<div style="color:#1F3864;font-weight:bold;font-size:13px;">' + (isProgressive ? 'PROGRESSIVE ASSESSMENT REPORT' : 'ASSESSMENT REPORT') + '</div>'
        + '<div style="color:#555;font-size:10px;">Term ' + esc(term) + ' - ' + esc(academicYear) + ' - ' + esc(exam ? exam.examName : '') + '</div>'
        + '</div></div>'
        + '<div style="background:#f8f9fa;padding:8px 12px;border-radius:6px;margin-bottom:10px;border-left:4px solid #1F3864;">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Student Name:</strong> ' + esc(studentName) + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Admission No:</strong> ' + esc(student?.admissionNumber || '-') + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Class:</strong> ' + esc(student?.className || '-') + '</div>'
        + '<div style="font-size:11px;"><strong style="color:#1F3864;">Stream:</strong> ' + esc(streamName) + '</div>'
        + '</div></div>'
        + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed;"><thead>'
        + '<tr style="background:#1F3864;">' + theadCols + '</tr>'
        + '</thead><tbody>' + subjectRows + avgRowHtml + '</tbody></table>'
        + '<div style="display:flex;gap:12px;border:1.5px solid #1F3864;padding:10px 12px;border-radius:6px;margin-bottom:10px;">'
        + '<div style="flex:1;text-align:center;"><div style="color:#666;font-size:10px;">Subjects</div><div style="color:#1F3864;font-size:20px;font-weight:bold;">' + subjectCount + '</div></div>'
        + '<div style="flex:1;text-align:center;"><div style="color:#666;font-size:10px;">Average</div><div style="color:#1F3864;font-size:20px;font-weight:bold;">' + pGl(termAvg) + '</div></div>'
        + '</div>'
        + '<div style="background:#f8f9fa;padding:6px 10px;border-radius:4px;margin-bottom:10px;font-size:10px;">'
        + '<strong>Grade Key: </strong>'
        + '<span style="color:#28a745;">EE = 75-100 (Exceeding)</span> &nbsp;|&nbsp;'
        + '<span style="color:#2E75B6;">ME = 55-74 (Meeting)</span> &nbsp;|&nbsp;'
        + '<span style="color:#ffc107;">AE = 40-54 (Approaching)</span> &nbsp;|&nbsp;'
        + '<span style="color:#dc3545;">BE = 0-39 (Below Expectations)</span>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'
        + '<div style="border:1px solid #ddd;padding:10px;border-radius:6px;">'
        + '<p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Class Teacher\'s Comment:</p>'
        + '<p style="margin:0 0 16px 0;min-height:28px;font-size:11px;color:#333;">' + (card.teacherComment ? esc(card.teacherComment) : dots) + '</p>'
        + '<p style="margin:0;color:#666;font-size:10px;">Signature: _________________ Date: _________</p>'
        + '</div>'
        + '<div style="border:1px solid #ddd;padding:10px;border-radius:6px;">'
        + '<p style="font-weight:bold;color:#1F3864;margin:0 0 6px 0;font-size:11px;">Principal\'s Comment:</p>'
        + '<p style="margin:0 0 16px 0;min-height:28px;font-size:11px;color:#333;">' + (card.principalComment ? esc(card.principalComment) : dots) + '</p>'
        + '<p style="margin:0;color:#666;font-size:10px;">Signature: _________________ Date: _________</p>'
        + '</div></div>'
        + '<div style="display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:8px;margin-bottom:6px;font-size:10px;">'
        + '<div><strong style="color:#1F3864;">Term Opens:</strong> ' + fmtDate(exam?.termOpeningDate) + '</div>'
        + '<div><strong style="color:#1F3864;">Term Closes:</strong> ' + fmtDate(exam?.termClosingDate) + '</div>'
        + '</div>'
        + '<p style="text-align:center;font-size:9px;color:#999;border-top:2px solid #1F3864;padding-top:6px;">'
        + esc(schoolShortName()) + ' - Official Assessment Report - Issued: ' + new Date().toLocaleDateString()
        + '</p></div>';
};

// Wraps one or more pages in a printable document
const buildPrintDocument = (pages, title) =>
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(title) + '</title>'
    + '<style>*{box-sizing:border-box;margin:0;padding:0;}'
    + 'body{font-family:"Times New Roman",Times,serif;font-size:12px;color:#000;}'
    + '.toolbar{background:#1F3864;color:white;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:999;gap:10px;flex-wrap:wrap;}'
    + '.toolbar button{background:#FFD700;color:#1F3864;border:none;padding:8px 20px;border-radius:5px;font-weight:bold;cursor:pointer;font-size:14px;}'
    + '.report-page{max-width:800px;margin:0 auto;padding:12px;min-height:calc(100vh - 24px);display:flex;flex-direction:column;justify-content:center;page-break-after:always;break-after:page;}'
    + '.report-page:last-child{page-break-after:avoid;break-after:auto;}'
    + '@media print{@page{size:A4;margin:8mm;}.toolbar{display:none!important;}'
    + 'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    + '.report-page{min-height:265mm;max-width:none;padding:0;}}'
    + '</style></head><body>'
    + '<div class="toolbar"><span style="font-weight:bold;">' + esc(title) + '</span>'
    + '<button onclick="window.print()">Print / Save PDF</button></div>'
    + pages.join('')
    + '</body></html>';

// The print window must be opened immediately on the click, before any
// network request — otherwise browsers (especially Safari and phones) block it
const openPrintWindow = () => {
    const win = window.open('', '_blank');
    if (win) {
        win.document.write('<p style="font-family:Arial,sans-serif;padding:60px 20px;text-align:center;color:#1F3864;font-size:16px;">Preparing report card(s)&hellip;</p>');
    }
    return win;
};

const writePrintWindow = (win, html) => {
    if (!win || win.closed) return false;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    return true;
};

const fetchCardPrintData = async (card) => {
    const resultsRes = await api.get('/api/results/student/' + card.student?.studentId + '/exam/' + card.exam?.examId);
    let progressiveData = null;
    try {
        if (card.exam?.term && card.exam?.academicYear) {
            const progRes = await api.get('/api/results/progressive/student/' + card.student?.studentId + '/upto-exam/' + card.exam?.examId);
            progressiveData = progRes.data;
        }
    } catch (e) { /* no progressive data — fall back to single-exam card */ }
    return { singleResults: resultsRes.data || [], progressiveData };
};

const runLimited = async (items, limit, job, onProgress) => {
    const out = new Array(items.length);
    let next = 0, done = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            try { out[i] = { ok: true, value: await job(items[i], i) }; }
            catch (err) { out[i] = { ok: false, error: err }; }
            done++;
            if (onProgress) onProgress(done, items.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

const POPUP_BLOCKED_MSG = 'Your browser blocked the print window. Allow pop-ups for this site, then try again.';

// ══════════════════════════════════════════════════════════════════════════════

function ReportCards() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const userRole = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const isTeacher = userRole === 'TEACHER';

    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(null);
    const [printProgress, setPrintProgress] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [search, setSearch] = useState('');
    const [filterExam, setFilterExam] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [genMode, setGenMode] = useState('class');
    const [genExam, setGenExam] = useState('');
    const [genClassId, setGenClassId] = useState(isTeacher && linkedClassId ? linkedClassId : '');
    const [classesWithResults, setClassesWithResults] = useState([]);
    const [genStudent, setGenStudent] = useState('');
    const [bulkProgress, setBulkProgress] = useState(null);
    const [selectedClassFilter, setSelectedClassFilter] = useState('');
    const [editForm, setEditForm] = useState({ termRank: '', Remarks: '', teacherComment: '', principalComment: '' });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);

    const printingAll = printProgress !== null;

    // Show a success message for a while; a newer message is never wiped by an older timer
    const successTimer = useRef(null);
    const flashSuccess = (msg, ms = 4000) => {
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), ms);
    };
    useEffect(() => () => clearTimeout(successTimer.current), []);

    // Remembers the latest exam asked about, so a slow older reply can't overwrite a newer one
    const latestGenExam = useRef('');

    const sections = SECTIONS_LIVE;   // from School Settings
    const sectionColor = (section) => SECTION_COLORS_LIVE[section] || '#1F3864';

    useEffect(() => { fetchReportCards(); fetchStudents(); fetchClasses(); fetchExams(); }, []);
    useEffect(() => { fetchClassesWithResults(genExam); }, [genExam]);

    // Admin picked a class, then an exam that class has no results for: clear the hidden choice
    useEffect(() => {
        if (isTeacher || !genClassId || !genExam || !classesWithResults.length) return;
        const cls = classes.find(c => String(c.classId) === String(genClassId));
        const key = cls ? (cls.stream ? cls.className + '|' + cls.stream : cls.className) : null;
        if (!key || !classesWithResults.includes(key)) setGenClassId('');
    }, [classesWithResults]);

    // The class being viewed has no cards left (e.g. after Delete All): go back to the tiles
    useEffect(() => {
        if (!selectedClassFilter || loading) return;
        const stillThere = reportCards.filter(cardBelongsToTeacher).some(c => {
            const cls = c.student?.className || c.student?.schoolClass?.className;
            const st = c.student?.stream || c.student?.schoolClass?.stream;
            return (st ? cls + '|' + st : cls) === selectedClassFilter;
        });
        if (!stillThere) closeClassView();
    }, [reportCards, loading]);

    useEffect(() => {
        let data = reportCards.filter(cardBelongsToTeacher);
        const q = search.trim().toLowerCase();
        if (q) data = data.filter(c =>
            `${c.student?.firstName || ''} ${c.student?.lastName || ''}`.toLowerCase().includes(q) ||
            `${c.student?.lastName || ''} ${c.student?.firstName || ''}`.toLowerCase().includes(q) ||
            String(c.student?.admissionNumber ?? '').toLowerCase().includes(q)
        );
        if (filterExam) data = data.filter(c => String(c.exam?.examId) === String(filterExam));
        if (selectedClassFilter) {
            const [filterCls, filterStr] = selectedClassFilter.split('|');
            data = data.filter(c =>
                (c.student?.className === filterCls || c.student?.schoolClass?.className === filterCls) &&
                (!filterStr || (c.student?.stream || c.student?.schoolClass?.stream) === filterStr)
            );
        }
        data = data.slice().sort((a, b) =>
            String(a.exam?.examName || '').localeCompare(String(b.exam?.examName || '')) ||
            `${a.student?.firstName || ''} ${a.student?.lastName || ''}`.localeCompare(`${b.student?.firstName || ''} ${b.student?.lastName || ''}`)
        );
        setFiltered(data);
    }, [search, filterExam, selectedClassFilter, reportCards, classes]);

    const fetchReportCards = async () => {
        try {
            const r = await api.get('/api/reportCards');
            setReportCards(r.data); setLoading(false);
        }
        catch (e) { setError('Failed to load report cards'); setLoading(false); }
    };

    const cardBelongsToTeacher = (card) => {
        if (!isTeacher || !linkedClassId) return true;
        if (String(card.student?.schoolClass?.classId) === String(linkedClassId)) return true;
        const teacherClassObj = classes.find(c => String(c.classId) === String(linkedClassId));
        if (!teacherClassObj) return false;
        if (card.student?.className !== teacherClassObj.className) return false;
        if (!teacherClassObj.stream) return true;
        return card.student?.stream === teacherClassObj.stream ||
               card.student?.schoolClass?.stream === teacherClassObj.stream;
    };
    const fetchStudents = async () => { try { const r = await api.get('/api/students'); setStudents(r.data); } catch (e) {} };
    const fetchClasses = async () => { try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {} };
    const fetchExams = async () => { try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {} };

    const fetchClassesWithResults = async (examId) => {
        latestGenExam.current = examId;
        if (!examId) { setClassesWithResults([]); return; }
        try {
            const r = await api.get('/api/results');
            if (latestGenExam.current !== examId) return;
            const data = r.data.filter(res => String(res.exam?.examId) === String(examId));
            const classKeys = [...new Set(data.map(res => {
                const cn = res.student?.className;
                const st = res.student?.stream || res.student?.schoolClass?.stream;
                return cn ? (st ? cn + '|' + st : cn) : null;
            }).filter(Boolean))];
            setClassesWithResults(classKeys);
        } catch(e) {}
    };

    const getServerError = (err) => {
        const data = err.response?.data;
        if (typeof data === 'string' && data.length < 300) return data;
        if (data?.message) return data.message;
        if (data?.error) return data.error;
        if (err.response?.status === 400) return 'Bad request — check that results exist for this student and exam.';
        if (err.response?.status === 409) return 'Report card already exists for this student and exam.';
        return 'Request failed. Make sure marks have been entered for this student first.';
    };

    const handleGenerateStudent = async (e) => {
        e.preventDefault();
        if (!genStudent || !genExam) { setError('Select both student and exam'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        try {
            await api.post('/api/reportCards/generate/student/' + genStudent + '/exam/' + genExam);
            flashSuccess('Report card generated!');
            setGenStudent(''); fetchReportCards();
        } catch (err) { setError(getServerError(err)); }
        setGenerating(false);
    };

    const handleGenerateClass = async () => {
        if (!genClassId || !genExam) { setError('Select both class and exam'); return; }
        const classStudents = students.filter(s => String(s.schoolClass?.classId) === String(genClassId));
        if (!classStudents.length) { setError('No students found in this class'); return; }
        setGenerating(true); setError(''); setSuccessMsg('');
        let success = 0;
        let alreadyExisted = 0;
        const failedStudents = [];
        setBulkProgress({ done: 0, total: classStudents.length, success: 0, failed: 0 });
        for (let i = 0; i < classStudents.length; i++) {
            try {
                await api.post('/api/reportCards/generate/student/' + classStudents[i].studentId + '/exam/' + genExam);
                success++;
            } catch (err) {
                if (err.response?.status === 409) { alreadyExisted++; }
                else failedStudents.push({
                    name: `${classStudents[i].firstName} ${classStudents[i].lastName}`,
                    reason: getServerError(err),
                });
            }
            setBulkProgress({ done: i + 1, total: classStudents.length, success, failed: failedStudents.length });
        }
        setGenerating(false);
        setBulkProgress(null);
        fetchReportCards();
        const existedNote = alreadyExisted > 0 ? ` ${alreadyExisted} already had a report card for this exam.` : '';
        if (failedStudents.length === 0) {
            flashSuccess(`${success} report card(s) generated.${existedNote}`, 6000);
        } else {
            const failList = failedStudents.map(f => `• ${f.name}: ${f.reason}`).join('\n');
            setError(`${success} generated, ${failedStudents.length} failed:\n${failList}`);
            if (success > 0 || alreadyExisted > 0) flashSuccess(`${success} report card(s) generated.${existedNote}`, 6000);
        }
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setEditForm({ termRank: card.termRank || '', Remarks: card.Remarks || '', teacherComment: card.teacherComment || '', principalComment: card.principalComment || '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put('/api/reportCards/' + editingCard.reportId, {
                totalMarks: editingCard.totalMarks, averageMarks: editingCard.averageMarks,
                termRank: editForm.termRank !== '' ? parseInt(editForm.termRank) : null,
                Remarks: editForm.Remarks, teacherComment: editForm.teacherComment,
                principalComment: editForm.principalComment
            });
            flashSuccess('Report card updated.'); setEditingCard(null); fetchReportCards();
        } catch (err) { setError('Failed to update: ' + getServerError(err)); }
    };

    const handlePrintCard = async (card) => {
        setError('');
        const win = openPrintWindow();
        if (!win) { setError(POPUP_BLOCKED_MSG); return; }
        setPrinting(card.reportId);
        try {
            const { singleResults, progressiveData } = await fetchCardPrintData(card);
            const name = card.student ? card.student.firstName + ' ' + card.student.lastName : '';
            writePrintWindow(win, buildPrintDocument([buildReportPage(card, singleResults, progressiveData)], 'Assessment Report - ' + name));
        } catch (e) {
            if (!win.closed) win.close();
            setError('Failed to load results for printing');
        }
        setPrinting(null);
    };

    const handlePrintAll = async () => {
        if (!filtered.length) return;
        setError('');
        const win = openPrintWindow();
        if (!win) { setError(POPUP_BLOCKED_MSG); return; }

        const cards = filtered;
        setPrintProgress({ done: 0, total: cards.length });

        // Load 5 cards at a time instead of one by one — much faster for big classes
        const data = await runLimited(cards, 5, fetchCardPrintData,
            (done, total) => setPrintProgress({ done, total }));

        const pages = [];
        const failedNames = [];
        cards.forEach((card, i) => {
            if (data[i].ok) pages.push(buildReportPage(card, data[i].value.singleResults, data[i].value.progressiveData));
            else failedNames.push(`${card.student?.firstName || ''} ${card.student?.lastName || ''}`.trim());
        });

        setPrintProgress(null);
        if (!pages.length) {
            if (!win.closed) win.close();
            setError('No report cards could be loaded for printing.');
            return;
        }
        if (!writePrintWindow(win, buildPrintDocument(pages, 'Bulk Print - ' + pages.length + ' Assessment Report(s)'))) {
            setError('The print window was closed before the report cards were ready. Click Print All again.');
            return;
        }
        if (failedNames.length) {
            setError(`${failedNames.length} card(s) could not be loaded and were left out:\n• ${failedNames.join('\n• ')}`);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete('/api/reportCards/' + id);
            if (editingCard?.reportId === id) setEditingCard(null);
            setDeleteConfirm(null);
            flashSuccess('Report card deleted.');
            fetchReportCards();
        }
        catch (err) { setError('Failed to delete: ' + getServerError(err)); setDeleteConfirm(null); }
    };

    const handleDeleteAll = async () => {
        setDeletingAll(true); setError('');
        // 5 at a time, so a big class doesn't flood the server with hundreds of requests at once
        const outcomes = await runLimited(filtered, 5, card => api.delete('/api/reportCards/' + card.reportId));
        const ok = outcomes.filter(o => o.ok).length;
        const failed = outcomes.length - ok;
        if (editingCard && filtered.some(c => c.reportId === editingCard.reportId)) setEditingCard(null);
        setDeletingAll(false);
        setDeleteAllConfirm(false);
        fetchReportCards();
        if (failed === 0) {
            flashSuccess(`${ok} report card(s) deleted`);
        } else {
            setError(`${ok} deleted, ${failed} could not be deleted. Please try again.`);
        }
    };

    const classTilesData = () => {
        const map = {};
        reportCards.filter(cardBelongsToTeacher).forEach(card => {
            const cls = card.student?.className || card.student?.schoolClass?.className;
            const stream = card.student?.stream || card.student?.schoolClass?.stream || null;
            const section = card.student?.schoolClass?.section || '';
            if (!cls) return;
            const key = stream ? cls + '|' + stream : cls;
            if (!map[key]) map[key] = { className: cls, stream, section, count: 0, exams: new Set(), avgSum: 0, avgCount: 0 };
            map[key].count++;
            if (card.exam?.examId) map[key].exams.add(card.exam.examId);
            if (card.averageMarks != null && !isNaN(card.averageMarks)) { map[key].avgSum += Number(card.averageMarks); map[key].avgCount++; }
        });
        return Object.values(map).sort((a, b) => a.className.localeCompare(b.className) || (a.stream||'').localeCompare(b.stream||''));
    };

    const classStudentsCount = students.filter(s => String(s.schoolClass?.classId) === String(genClassId)).length;
    const classTiles = classTilesData();
    const filterExamName = exams.find(ex => String(ex.examId) === String(filterExam))?.examName;
    const examsInFiltered = new Set(filtered.map(c => c.exam?.examId)).size;

    const selectedTile = classTiles.find(c => (c.stream ? c.className + '|' + c.stream : c.className) === selectedClassFilter);
    const selectedClassLabel = selectedTile ? classDisplayName(selectedTile) : selectedClassFilter.replace('|', ' ');

    const closeClassView = () => { setSelectedClassFilter(''); setSearch(''); setFilterExam(''); };

    return (
        <div style={s.container}>
            <Navbar rightContent={
                <button onClick={() => window.location.href = '/dashboard'} style={{ backgroundColor: 'transparent', color: 'white', border: '1.5px solid rgba(255,255,255,0.4)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}>
                    <Bi name="arrow-left" />Dashboard
                </button>
            } />
            <div style={s.layoutRow}>
                <Sidebar />
                <div style={s.content}>
                <h2 style={s.title}><Bi name="clipboard-data" style={{ marginRight: '10px' }} />Report Cards</h2>
                <p style={s.subtitle}>Generate, view and print student assessment reports with progressive term tracking</p>

                {error && <p style={s.error} role="alert"><Bi name="exclamation-triangle-fill" />{error}</p>}
                {successMsg && <p style={s.success}><Bi name="check-circle-fill" />{successMsg}</p>}

                <div style={s.genCard}>
                    <h3 style={{ color: '#1F3864', margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800 }}>
                        <Bi name="file-earmark-plus-fill" />Generate Assessment Reports
                    </h3>
                    <div style={s.genTabs}>
                        <button onClick={() => setGenMode('class')} style={{ ...s.genTab, backgroundColor: genMode === 'class' ? '#1F3864' : 'white', color: genMode === 'class' ? 'white' : '#1F3864' }}>
                            <Bi name="people-fill" />Per Class (Bulk)
                        </button>
                        <button onClick={() => setGenMode('student')} style={{ ...s.genTab, backgroundColor: genMode === 'student' ? '#1F3864' : 'white', color: genMode === 'student' ? 'white' : '#1F3864' }}>
                            <Bi name="person-fill" />Per Student
                        </button>
                    </div>
                    <div style={s.formRow}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={s.label}><Bi name="file-earmark-text" />Exam</label>
                            <select style={s.input} value={genExam} onChange={e => setGenExam(e.target.value)}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(ex => (
                                    <option key={ex.examId} value={ex.examId}>{ex.examName} - Term {ex.term} {ex.academicYear}</option>
                                ))}
                            </select>
                        </div>
                        {genMode === 'class' && (
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={s.label}><Bi name="building" />Class</label>
                                {isTeacher ? (
                                    <input style={{ ...s.input, backgroundColor: '#f8f9fa', color: '#555', cursor: 'not-allowed' }}
                                        value={linkedClassName || 'Your class'} disabled />
                                ) : (
                                    <select style={s.input} value={genClassId} onChange={e => setGenClassId(e.target.value)}>
                                        <option value="">-- Select Class --</option>
                                        {sections.map(sec => (
                                            <optgroup key={sec.value} label={sec.label}>
                                                {classes.filter(cls => {
                                                    if (cls.section !== sec.value) return false;
                                                    if (!genExam || !classesWithResults.length) return true;
                                                    const key = cls.stream ? cls.className + '|' + cls.stream : cls.className;
                                                    return classesWithResults.includes(key);
                                                }).map(cls => (
                                                    <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                        {genMode === 'student' && (
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <label style={s.label}><Bi name="person-fill" />Student</label>
                                <select style={s.input} value={genStudent} onChange={e => setGenStudent(e.target.value)}>
                                    <option value="">-- Select Student --</option>
                                    {students
                                        .filter(st => !isTeacher || String(st.schoolClass?.classId) === String(linkedClassId))
                                        .slice().sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName))
                                        .map(st => (
                                            <option key={st.studentId} value={st.studentId}>{st.firstName} {st.lastName} - {st.className} ({st.admissionNumber})</option>
                                        ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            {genMode === 'class' ? (
                                <button onClick={handleGenerateClass} style={s.generateBtn}
                                    onMouseEnter={e => { if (!generating) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                    disabled={generating || !genClassId || !genExam}>
                                    {generating
                                        ? <><Bi name="hourglass-split" />Generating...</>
                                        : <><Bi name="lightning-charge-fill" />{'Generate' + (classStudentsCount > 0 ? ' (' + classStudentsCount + ' students)' : '')}</>}
                                </button>
                            ) : (
                                <button onClick={handleGenerateStudent} style={s.generateBtn}
                                    onMouseEnter={e => { if (!generating) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                    disabled={generating || !genStudent || !genExam}>
                                    {generating
                                        ? <><Bi name="hourglass-split" />Generating...</>
                                        : <><Bi name="lightning-charge-fill" />Generate</>}
                                </button>
                            )}
                        </div>
                    </div>
                    {bulkProgress && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={s.progressTrack}>
                                <div style={{ ...s.progressFill, width: ((bulkProgress.done / bulkProgress.total) * 100) + '%' }} />
                            </div>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{bulkProgress.done}/{bulkProgress.total} done</p>
                        </div>
                    )}
                </div>

                {editingCard && (
                    <div style={s.editCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ color: '#2E75B6', margin: 0, fontWeight: 800 }}>
                                <Bi name="pencil-square" />Edit: {editingCard.student?.firstName} {editingCard.student?.lastName}
                            </h3>
                            <button onClick={() => setEditingCard(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999' }} aria-label="Close" title="Close">
                                <Bi name="x-lg" style={{ marginRight: 0 }} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div style={s.formRow}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label style={s.label}>Term Rank</label>
                                    <input type="number" min="1" step="1" style={s.input} value={editForm.termRank} onChange={e => setEditForm({ ...editForm, termRank: e.target.value })} placeholder="e.g. 5" />
                                </div>
                                <div style={{ flex: 2, minWidth: '200px' }}>
                                    <label style={s.label}>Remarks</label>
                                    <input style={s.input} value={editForm.Remarks} onChange={e => setEditForm({ ...editForm, Remarks: e.target.value })} placeholder="General remarks" />
                                </div>
                            </div>
                            <div style={s.formRow}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <label style={s.label}>Teacher Comment</label>
                                    <input style={s.input} value={editForm.teacherComment} onChange={e => setEditForm({ ...editForm, teacherComment: e.target.value })} placeholder="Class teacher comment" />
                                </div>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <label style={s.label}>Principal Comment</label>
                                    <input style={{ ...s.input, ...(isTeacher ? { backgroundColor: '#f1f3f5', color: '#666', cursor: 'not-allowed' } : {}) }}
                                        value={editForm.principalComment} disabled={isTeacher}
                                        title={isTeacher ? 'Only the principal (administrator) can write this comment' : undefined}
                                        onChange={e => setEditForm({ ...editForm, principalComment: e.target.value })}
                                        placeholder={isTeacher ? 'Written by the principal' : 'Principal comment'} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                <button type="submit" style={s.submitBtn}><Bi name="check-lg" />Update</button>
                                <button type="button" onClick={() => setEditingCard(null)} style={s.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {!loading && classTiles.length > 0 && (
                    <div style={{ marginBottom: '25px' }}>
                        <h3 style={{ color: '#1F3864', margin: '0 0 12px 0', fontWeight: 800 }}>
                            <Bi name="grid-3x3-gap-fill" />Classes with Assessment Reports
                        </h3>
                        <div style={s.classTilesGrid}>
                            {classTiles.map((cls, i) => {
                                const color = sectionColor(cls.section);
                                const avg = cls.avgCount > 0 ? (cls.avgSum / cls.avgCount).toFixed(1) : null;
                                const key = cls.stream ? cls.className + '|' + cls.stream : cls.className;
                                const isSelected = selectedClassFilter === key;
                                return (
                                    <div key={i}
                                        onClick={() => { if (isSelected) closeClassView(); else setSelectedClassFilter(key); }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                                        style={{ ...s.classTile, borderTop: '4px solid ' + color, outline: isSelected ? '3px solid ' + color : 'none' }}>
                                        <div style={{ ...s.classTileName, color }}>{classDisplayName(cls)}</div>
                                        <div style={s.classTileStats}>
                                            <div style={s.classTileStat}>
                                                <span style={s.classTileNum}>{cls.count}</span>
                                                <span style={s.classTileLbl}>Cards</span>
                                            </div>
                                            <div style={s.classDivider} />
                                            <div style={s.classTileStat}>
                                                <span style={s.classTileNum}>{cls.exams.size}</span>
                                                <span style={s.classTileLbl}>Exams</span>
                                            </div>
                                            {avg && (
                                                <React.Fragment>
                                                    <div style={s.classDivider} />
                                                    <div style={s.classTileStat}>
                                                        <span style={{ ...s.classTileNum, color: pctColor(parseFloat(avg)), fontSize: '14px' }}>{avg}%</span>
                                                        <span style={s.classTileLbl}>Avg</span>
                                                    </div>
                                                </React.Fragment>
                                            )}
                                        </div>
                                        <div style={{ ...s.classTileAction, backgroundColor: color }}>
                                            <Bi name={isSelected ? 'eye-fill' : 'eye'} style={{ marginRight: '4px' }} />
                                            {isSelected ? 'Viewing' : 'View Cards'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {selectedClassFilter ? (
                    <React.Fragment>
                        <div style={s.filterRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ backgroundColor: sectionColor(selectedTile?.section), color: 'white', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {selectedClassLabel}
                                </span>
                                <button onClick={closeClassView} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                                    <Bi name="x-lg" style={{ marginRight: '4px' }} />Close
                                </button>
                            </div>
                            <div style={s.searchBox}>
                                <Bi name="search" style={{ color: '#888', marginRight: '8px' }} />
                                <input style={s.searchInput} placeholder="Search name or admission no..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <select style={s.filterSelect} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                                <option value="">All Exams</option>
                                {exams.map(ex => <option key={ex.examId} value={ex.examId}>{ex.examName} - T{ex.term} {ex.academicYear}</option>)}
                            </select>
                            <button onClick={() => { setSearch(''); setFilterExam(''); }} style={s.clearBtn}>
                                <Bi name="arrow-counterclockwise" />Clear
                            </button>
                            <span style={{ color: '#666', fontSize: '13px', alignSelf: 'center' }}>{filtered.length} card(s)</span>
                            <button onClick={handlePrintAll} disabled={printingAll || !filtered.length} style={{ backgroundColor: printingAll ? '#6c757d' : '#fd7e14', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: printingAll ? 'wait' : 'pointer', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease' }}
                                onMouseEnter={e => { if (!printingAll && filtered.length) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                                {printingAll
                                    ? <><Bi name="hourglass-split" />Loading {printProgress.done}/{printProgress.total}...</>
                                    : <><Bi name="printer-fill" />{'Print All (' + filtered.length + ')'}</>}
                            </button>
                            <button onClick={() => setDeleteAllConfirm(true)}
                                disabled={!filtered.length || printingAll}
                                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                <Bi name="trash-fill" />Delete All ({filtered.length})
                            </button>
                        </div>
                        {printingAll && (
                            <div style={{ marginBottom: '15px' }}>
                                <div style={s.progressTrack}>
                                    <div style={{ ...s.progressFill, backgroundColor: '#fd7e14', width: ((printProgress.done / printProgress.total) * 100) + '%' }} />
                                </div>
                                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Preparing {printProgress.done}/{printProgress.total} report cards for printing…</p>
                            </div>
                        )}
                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}><Bi name="hourglass-split" />Loading...</p>
                        ) : filtered.length === 0 ? (
                            <div style={s.emptyState}>
                                <Bi name="clipboard-x" style={{ fontSize: '48px', marginRight: 0, color: '#BDD7EE', display: 'inline-block', marginBottom: '15px' }} />
                                <h3>No Assessment Reports Found</h3>
                                <p style={{ color: '#666' }}>{search || filterExam ? 'Try clearing the search or exam filter.' : 'Generate assessment reports using the form above'}</p>
                            </div>
                        ) : (
                            <div style={s.tableWrapper}>
                                <table style={s.table}>
                                    <thead>
                                        <tr style={s.tableHeader}>
                                            <th style={s.th}>#</th>
                                            <th style={s.th}>Student</th>
                                            <th style={s.th}>Adm No</th>
                                            <th style={s.th}>Class</th>
                                            <th style={s.th}>Exam</th>
                                            <th style={s.th}>Total</th>
                                            <th style={s.th}>Average</th>
                                            <th style={s.th}>Grade</th>
                                            <th style={s.th}>Term Rank</th>
                                            <th style={s.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((card, index) => {
                                            const avg = Number(card.averageMarks) || 0;
                                            const gl = gradeLabel(avg);
                                            const gc = gradeColor(avg);
                                            const isPrinting = printing === card.reportId;
                                            return (
                                                <tr key={card.reportId} style={index % 2 === 0 ? s.trEven : s.trOdd}>
                                                    <td style={s.td}>{index + 1}</td>
                                                    <td style={s.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                    <td style={s.td}><span style={s.admNo}>{card.student?.admissionNumber || '-'}</span></td>
                                                    <td style={s.td}>{card.student?.className}</td>
                                                    <td style={s.td}><span style={s.examBadge}>{card.exam?.examName}</span></td>
                                                    <td style={s.td}><strong>{card.totalMarks}</strong></td>
                                                    <td style={s.td}><span style={{ color: gc, fontWeight: 'bold' }}>{avg.toFixed(1)}%</span></td>
                                                    <td style={s.td}><span style={{ backgroundColor: gc, color: 'white', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' }}>{gl}</span></td>
                                                    <td style={s.td}>{card.termRank || '-'}</td>
                                                    <td style={s.td}>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            <button onClick={() => handleEdit(card)} style={s.editBtn} title="Edit comments and rank">
                                                                <Bi name="pencil-fill" style={{ marginRight: '4px' }} />Edit
                                                            </button>
                                                            <button onClick={() => handlePrintCard(card)} style={s.printBtn} disabled={isPrinting} title="Print this report card">
                                                                {isPrinting
                                                                    ? <Bi name="hourglass-split" style={{ marginRight: 0 }} />
                                                                    : <><Bi name="printer-fill" style={{ marginRight: '4px' }} />Print</>}
                                                            </button>
                                                            <button onClick={() => setDeleteConfirm(card)} style={s.deleteBtn} title="Delete this report card">
                                                                <Bi name="trash-fill" style={{ marginRight: 0 }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </React.Fragment>
                ) : !loading && classTiles.length > 0 ? (
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: '#888' }}>
                        <Bi name="arrow-up-circle" style={{ fontSize: '36px', marginRight: 0, color: '#BDD7EE', display: 'inline-block', marginBottom: '10px' }} />
                        <p style={{ fontSize: '14px', margin: 0 }}>Click a class tile above to view its assessment reports</p>
                    </div>
                ) : loading ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}><Bi name="hourglass-split" />Loading...</p>
                ) : null}

                {deleteConfirm && (
                    <div style={s.modalBackdrop}>
                        <div style={s.modal}>
                            <h3 style={{ color: '#dc3545', margin: '0 0 12px 0', fontWeight: 800 }}>
                                <Bi name="exclamation-triangle-fill" />Delete Assessment Report?
                            </h3>
                            <p style={{ color: '#555', marginBottom: '20px' }}>
                                Delete the assessment report for{' '}
                                <strong>{deleteConfirm.student?.firstName} {deleteConfirm.student?.lastName}</strong>
                                {deleteConfirm.exam ? <> ({deleteConfirm.exam.examName})</> : null}? This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeleteConfirm(null)} style={s.cancelBtn}>Cancel</button>
                                <button onClick={() => handleDelete(deleteConfirm.reportId)} style={{ ...s.cancelBtn, backgroundColor: '#dc3545' }}>
                                    <Bi name="trash-fill" />Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {deleteAllConfirm && (
                    <div style={{ ...s.modalBackdrop, zIndex: 10000 }}>
                        <div style={{ ...s.modal, maxWidth: '420px' }}>
                            <h3 style={{ color: '#dc3545', margin: '0 0 12px 0', fontWeight: 800 }}>
                                <Bi name="exclamation-triangle-fill" />Delete All Assessment Reports?
                            </h3>
                            <p style={{ color: '#555', marginBottom: '10px' }}>
                                This will permanently delete <strong>{filtered.length} assessment report(s)</strong> for{' '}
                                <strong>{selectedClassLabel}</strong>
                                {filterExamName
                                    ? <> — exam <strong>{filterExamName}</strong></>
                                    : <> — <strong>all {examsInFiltered} exam(s)</strong></>}
                                {search ? <> matching "<strong>{search}</strong>"</> : null}.
                            </p>
                            {!filterExamName && examsInFiltered > 1 && (
                                <p style={s.warnNote}>
                                    <Bi name="info-circle-fill" />No exam filter is set, so cards from every exam in this class will be deleted. Choose an exam first if you only want to remove one.
                                </p>
                            )}
                            <p style={{ color: '#555', marginBottom: '20px' }}>This cannot be undone.</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeleteAllConfirm(false)} disabled={deletingAll} style={s.cancelBtn}>Cancel</button>
                                <button onClick={handleDeleteAll} disabled={deletingAll} style={{ ...s.cancelBtn, backgroundColor: '#dc3545' }}>
                                    {deletingAll
                                        ? <><Bi name="hourglass-split" />Deleting...</>
                                        : <><Bi name="trash-fill" />Delete All</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
          <Footer />
    </div>
    );
}

const s = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: '0 0 20px 0', fontSize: '14px' },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', whiteSpace: 'pre-line', border: '1px solid #ffd6d6' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    genCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    genTabs: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' },
    genTab: { padding: '9px 18px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s ease' },
    formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' },
    label: { fontWeight: 700, color: '#1F3864', fontSize: '12px', display: 'block', marginBottom: '5px' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', width: '100%', boxSizing: 'border-box', backgroundColor: 'white' },
    generateBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', transition: 'transform 0.15s ease, box-shadow 0.15s ease', boxShadow: '0 2px 6px rgba(31,56,100,0.25)' },
    progressTrack: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' },
    progressFill: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    editCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #2E75B6' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, transition: 'transform 0.15s ease' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
    classTilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px' },
    classTile: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease', userSelect: 'none' },
    classTileName: { fontSize: '20px', fontWeight: 800, textAlign: 'center', padding: '16px 10px 8px' },
    classTileStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 10px' },
    classTileStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    classTileNum: { fontSize: '18px', fontWeight: 800, color: '#1F3864' },
    classTileLbl: { fontSize: '9px', color: '#888' },
    classDivider: { width: '1px', height: '28px', backgroundColor: '#eee' },
    classTileAction: { color: 'white', textAlign: 'center', padding: '7px', fontSize: '11px', fontWeight: 700 },
    filterRow: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
    searchBox: { flex: 2, display: 'flex', alignItems: 'center', minWidth: '200px', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 10px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    filterSelect: { flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', minWidth: '150px', backgroundColor: 'white' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 },
    tableWrapper: { overflowX: 'auto', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 700 },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, minWidth: '34px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' },
    examBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    modalBackdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    modal: { backgroundColor: 'white', padding: '25px 30px', borderRadius: '14px', maxWidth: '380px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
    warnNote: { backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#856404', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px' },
};

export default ReportCards;
