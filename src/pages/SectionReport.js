import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import { pctColor } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { classDisplayName, gradeLabel } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { schoolName, schoolShortName, schoolMotto, schoolContact, logoLeftUrl, logoRightUrl } from '../utils/school';
import { GRADE_ORDER_LIVE, SECTION_CODES } from '../utils/schoolData';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Bi = ({ name, style }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />
);

// Grade and section order from School Settings
const GRADE_ORDER = GRADE_ORDER_LIVE;
const SECTION_ORDER = SECTION_CODES;
const orderIndex = (list, v) => { const i = list.indexOf(v); return i === -1 ? 99 : i; };
const MEDAL_COLORS = { 1: '#D4A017', 2: '#9E9E9E', 3: '#CD7F32' };

const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmtPct = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '-' : Number(v).toFixed(1) + '%';

// Colours from the Grading Scales table (utils/grading), same as every other page
const avgBadgeColor = (avg) => pctColor(num(avg));

// Does this report card belong to this class (stream)?
const cardInClass = (card, cls) => {
    if (!cls) return false;
    const st = card.student;
    if (st?.schoolClass?.classId != null) return String(st.schoolClass.classId) === String(cls.classId);
    const stream = st?.schoolClass?.stream || st?.stream || null;
    return st?.className === cls.className && (cls.stream ? stream === cls.stream : !stream);
};

// Orders cards for a merit list. Uses the server-calculated rank when every card has one;
// otherwise ranks by total so the list is still correct (ties share a rank: 1, 2, 2, 4).
const rankCards = (cards, rankField) => {
    const hasAll = cards.length > 0 && cards.every(c => c[rankField] != null && c[rankField] !== '' && num(c[rankField]) > 0);
    if (hasAll) {
        return {
            computed: false,
            rows: [...cards]
                .sort((a, b) => num(a[rankField]) - num(b[rankField]) || num(b.averageMarks) - num(a.averageMarks))
                .map(card => ({ card, rank: num(card[rankField]) }))
        };
    }
    const sorted = [...cards].sort((a, b) => num(b.totalMarks) - num(a.totalMarks) || num(b.averageMarks) - num(a.averageMarks));
    return {
        computed: cards.length > 0,
        rows: sorted.map(card => ({ card, rank: 1 + sorted.filter(o => num(o.totalMarks) > num(card.totalMarks)).length }))
    };
};

// Section subjects = every subject any class in the section has, in first-seen order
const unionSubjectNames = (classBreakdown) =>
    [...new Set((classBreakdown || []).flatMap(cl => (cl.subjectPerformance || []).map(s => s.subjectName)))];

// ─── Orientation Toggle ───────────────────────────────────────────────────────
const OrientationToggle = ({ value, onChange }) => (
    <span className="no-print" style={{ display: 'flex', gap: '3px' }}>
        {['portrait', 'landscape'].map(o => (
            <button key={o} onClick={() => onChange(o)} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', cursor: 'pointer', border: `1.5px solid ${value === o ? '#1F3864' : '#ccc'}`, background: value === o ? '#1F3864' : 'white', color: value === o ? 'white' : '#666', fontWeight: value === o ? 'bold' : 'normal', textTransform: 'capitalize' }}>{o}</button>
        ))}
    </span>
);

// ─── Print Header ─────────────────────────────────────────────────────────────
const PrintHeader = ({ title, subtitle }) => (
    <div style={pStyles.header}>
        <div style={pStyles.headerRow}>
            <img src={logoLeftUrl()} alt="" style={pStyles.logo} />
            <div style={pStyles.schoolInfo}>
                <h1 style={pStyles.schoolName}>{schoolName().toUpperCase()}</h1>
                <p style={pStyles.motto}>{schoolMotto()}</p>
                <p style={pStyles.contact}>{schoolContact()}</p>
            </div>
            <img src={logoRightUrl()} alt="" style={pStyles.logo} />
        </div>
        <div style={pStyles.reportBanner}>
            <h2 style={pStyles.reportTitle}>{title}</h2>
            {subtitle && <p style={pStyles.reportSubtitle}>{subtitle}</p>}
        </div>
    </div>
);

// ─── Printable Merit List (stream or grade) ───────────────────────────────────
const PrintableMeritList = React.forwardRef(({ rows, getMark, title, subtitle, level, subjects }, ref) => {
    const avg = rows.length ? rows.reduce((s, r) => s + num(r.card.averageMarks), 0) / rows.length : null;
    const top = rows[0]?.card;
    return (
        <div ref={ref} style={pStyles.page}>
            <PrintHeader title={title} subtitle={subtitle} />
            <table style={pStyles.meritTable}>
                <thead>
                    <tr style={pStyles.thead}>
                        <th style={pStyles.th}>RANK</th>
                        {level === 'grade' && <th style={pStyles.th}>STREAM</th>}
                        <th style={pStyles.th}>ADM NO</th>
                        <th style={pStyles.th}>NAME</th>
                        {subjects.map(sub => (
                            <th key={sub.subjectId} style={pStyles.thSubject}>{String(sub.subjectName).toUpperCase()}</th>
                        ))}
                        <th style={pStyles.thTotal}>TOTAL</th>
                        <th style={pStyles.thTotal}>AVG %</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ card, rank }, i) => (
                        <tr key={card.reportId} style={i % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                            <td style={pStyles.tdCenter}><strong>{rank}</strong></td>
                            {level === 'grade' && <td style={pStyles.tdCenter}>{classDisplayName(card.student)}</td>}
                            <td style={pStyles.td}>{card.student?.admissionNumber || '-'}</td>
                            <td style={pStyles.tdName}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                            {subjects.map(sub => (
                                <td key={sub.subjectId} style={pStyles.tdCenter}>{getMark(card.student?.studentId, sub.subjectId)}</td>
                            ))}
                            <td style={pStyles.tdTotal}><strong>{card.totalMarks ?? '-'}</strong></td>
                            <td style={pStyles.tdTotal}><strong>{fmtPct(card.averageMarks)}</strong></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={pStyles.summaryRow}>
                <span>Total Students: {rows.length}</span>
                <span>Average: {avg === null ? '-' : avg.toFixed(2) + '%'}</span>
                <span>Top: {top ? `${top.student?.firstName} ${top.student?.lastName} (${fmtPct(top.averageMarks)})` : '-'}</span>
            </div>
            <div style={pStyles.footer}>
                <img src={logoLeftUrl()} alt="" style={pStyles.footerLogo} />
                <div style={pStyles.footerSigs}>
                    <p>Class Teacher: _________________________ Signature: _________________ Date: ___________</p>
                    <p>Principal: _________________________ Signature: _________________ Date: ___________</p>
                </div>
                <img src={logoRightUrl()} alt="" style={pStyles.footerLogo} />
            </div>
        </div>
    );
});

// ─── Printable Section Performance Report ─────────────────────────────────────
const PrintableSectionReport = React.forwardRef(({ report, examName, term, year }, ref) => (
    <div ref={ref} style={pStyles.page}>
        <PrintHeader title="ACADEMIC PERFORMANCE REPORT" subtitle={`${examName} — Term ${term} ${year}`} />
        {report && Object.entries(report)
            .sort(([a], [b]) => orderIndex(SECTION_ORDER, a) - orderIndex(SECTION_ORDER, b))
            .map(([key, section]) => {
                const sortedClasses = [...(section.classBreakdown || [])].sort((a, b) =>
                    orderIndex(GRADE_ORDER, a.className) - orderIndex(GRADE_ORDER, b.className) ||
                    String(a.stream || '').localeCompare(String(b.stream || '')));
                const sectionSubjects = unionSubjectNames(sortedClasses);
                return (
                    <div key={key} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                        <div style={{ backgroundColor: '#1F3864', color: 'white', padding: '6px 10px', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '12px' }}>{section.sectionName}</strong>
                            <span style={{ fontSize: '10px', opacity: 0.9 }}>
                                {' '}| Target: {section.meanTarget}% | Students: {section.totalStudents} | Section Avg: {section.sectionAverage}% |{' '}
                                <strong style={{ color: section.meetingTarget ? '#90EE90' : '#ffb3b3' }}>{section.meetingTarget ? 'ABOVE TARGET' : 'BELOW TARGET'}</strong>
                            </span>
                        </div>
                        {sortedClasses.length > 0 && (
                            <table style={{ ...pStyles.table, marginBottom: '8px' }}>
                                <thead>
                                    <tr style={pStyles.thead}>
                                        <th style={pStyles.th}>CLASS</th>
                                        {sectionSubjects.map(name => <th key={name} style={pStyles.thSubject}>{String(name).toUpperCase()}</th>)}
                                        <th style={pStyles.thTotal}>TOTAL MEAN</th>
                                        <th style={pStyles.thTotal}>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedClasses.map((cls, i) => (
                                        <tr key={i} style={i % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                                            <td style={{ ...pStyles.td, fontWeight: 'bold' }}>{classDisplayName(cls)}</td>
                                            {sectionSubjects.map(name => {
                                                const sub = cls.subjectPerformance?.find(s => s.subjectName === name);
                                                return (
                                                    <td key={name} style={{ ...pStyles.tdCenter, color: sub ? (sub.meetingTarget ? '#155724' : '#721c24') : '#999' }}>
                                                        {sub ? sub.average : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td style={{ ...pStyles.tdTotal, color: cls.meetingTarget ? '#155724' : '#721c24' }}><strong>{cls.classAverage}</strong></td>
                                            <td style={{ ...pStyles.tdCenter, fontWeight: 'bold', color: cls.meetingTarget ? '#155724' : '#721c24' }}>{cls.meetingTarget ? 'Above' : 'Below'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );
            })}
        <div style={pStyles.footer}>
            <img src={logoLeftUrl()} alt="" style={pStyles.footerLogo} />
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#333' }}>
                Printed: {new Date().toLocaleDateString()} — {schoolShortName()} Official Document
            </p>
            <img src={logoRightUrl()} alt="" style={pStyles.footerLogo} />
        </div>
    </div>
));

// ─── Rank cell with trophies for places 1–3 ───────────────────────────────────
const RankCell = ({ rank }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        {MEDAL_COLORS[rank] && <Bi name="trophy-fill" style={{ color: MEDAL_COLORS[rank], marginRight: 0, fontSize: '15px' }} />}
        <strong>{rank}</strong>
    </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
function SectionReport() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const isTeacher = role === 'TEACHER';

    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allReportCards, setAllReportCards] = useState([]);
    const [allResults, setAllResults] = useState([]);
    const [loadingCards, setLoadingCards] = useState(false);
    const [classSubjects, setClassSubjects] = useState([]);
    const [gradeSubjects, setGradeSubjects] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState(isTeacher && linkedClassId ? linkedClassId : '');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [report, setReport] = useState(null);
    const [activeTab, setActiveTab] = useState(role === 'ADMIN' ? 'section' : 'stream');
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const sectionReportRef = useRef();
    const streamMeritRef = useRef();
    const gradeMeritRef = useRef();
    const latestExam = useRef('');
    const successTimer = useRef(null);

    const [sectionOrientation, setSectionOrientation] = useState('portrait');
    const [streamMeritOrientation, setStreamMeritOrientation] = useState('landscape');
    const [gradeMeritOrientation, setGradeMeritOrientation] = useState('landscape');

    const pageStyle = (o) => `@page { size: A4 ${o}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;

    const selectedExamObj = exams.find(e => String(e.examId) === String(selectedExam));
    const selectedClassObj = classes.find(c => String(c.classId) === String(selectedClass));
    const selectedClassLabel = selectedClassObj ? classDisplayName(selectedClassObj) : (linkedClassName || '');
    const examSubtitle = `${selectedExamObj?.examName || ''} | Term ${selectedExamObj?.term || ''} ${selectedExamObj?.academicYear || ''}`;
    const fileSafe = (s) => String(s || '').replace(/[^\w-]+/g, '_');

    const handlePrintSectionReport = useReactToPrint({ contentRef: sectionReportRef, documentTitle: `Section_Report_${fileSafe(selectedExamObj?.examName)}`, pageStyle: pageStyle(sectionOrientation) });
    const handlePrintStreamMerit = useReactToPrint({ contentRef: streamMeritRef, documentTitle: `Merit_List_${fileSafe(selectedClassLabel)}_${fileSafe(selectedExamObj?.examName)}`, pageStyle: pageStyle(streamMeritOrientation) });
    const handlePrintGradeMerit = useReactToPrint({ contentRef: gradeMeritRef, documentTitle: `Grade_Merit_List_${fileSafe(gradeLabel(selectedGrade))}_${fileSafe(selectedExamObj?.examName)}`, pageStyle: pageStyle(gradeMeritOrientation) });

    const flashSuccess = (msg, ms = 4000) => {
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), ms);
    };

    useEffect(() => {
        fetchExams(); fetchClasses();
        return () => clearTimeout(successTimer.current);
    }, []);

    // Teachers: their grade is picked automatically once classes load
    useEffect(() => {
        if (isTeacher && linkedClassId && classes.length > 0) {
            const teacherClass = classes.find(c => String(c.classId) === String(linkedClassId));
            if (teacherClass?.gradeLevel) setSelectedGrade(teacherClass.gradeLevel);
        }
    }, [classes]);

    // One load per exam: report cards + results together
    useEffect(() => { loadExamData(selectedExam); }, [selectedExam]);

    useEffect(() => {
        if (!selectedClass) { setClassSubjects([]); return; }
        api.get(`/api/class-subjects/by-class/${selectedClass}`)
            .then(r => setClassSubjects((r.data || []).map(cs => cs.subject).filter(Boolean)))
            .catch(() => setClassSubjects([]));
    }, [selectedClass]);

    // Grade subjects = every subject taught in ANY stream of the grade
    useEffect(() => {
        const gradeClasses = classes.filter(c => c.gradeLevel === selectedGrade);
        if (!selectedGrade || !gradeClasses.length) { setGradeSubjects([]); return; }
        Promise.allSettled(gradeClasses.map(c => api.get(`/api/class-subjects/by-class/${c.classId}`)))
            .then(outs => {
                const map = {};
                outs.forEach(o => {
                    if (o.status !== 'fulfilled') return;
                    (o.value.data || []).map(cs => cs.subject).filter(Boolean).forEach(s => { map[s.subjectId] = s; });
                });
                setGradeSubjects(Object.values(map).sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName))));
            });
    }, [selectedGrade, classes]);

    const fetchExams = async () => {
        try {
            const r = await api.get('/api/exams');
            setExams([...r.data].sort((a, b) => String(b.academicYear).localeCompare(String(a.academicYear)) || num(b.term) - num(a.term)));
        } catch (e) { setError('Failed to load exams'); }
    };

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) { setError('Failed to load classes'); }
    };

    const loadExamData = async (examId) => {
        latestExam.current = String(examId || '');
        setAllReportCards([]); setAllResults([]);
        if (!examId) return;
        setLoadingCards(true);
        const [cardsRes, resultsRes] = await Promise.allSettled([
            api.get(`/api/reportCards/by-exam/${examId}`),
            api.get(`/api/results/by-exam/${examId}`)
        ]);
        if (latestExam.current !== String(examId)) return; // another exam was chosen meanwhile
        if (cardsRes.status === 'fulfilled') setAllReportCards(cardsRes.value.data || []);
        else setError('Failed to load report cards for this exam.');
        if (resultsRes.status === 'fulfilled') setAllResults(resultsRes.value.data || []);
        setLoadingCards(false);
    };

    const handleCalculateRanks = async () => {
        if (!selectedExam) return;
        setCalculating(true); setError('');
        try {
            await api.post(`/api/rankings/calculate/${selectedExam}`);
            flashSuccess('Ranks calculated!');
            await loadExamData(selectedExam);
            if (report) await handleGetReport(); // keep an open report in step with the new ranks
        } catch (e) { setError('Failed to calculate ranks: ' + (e.response?.data?.message || e.message)); }
        setCalculating(false);
    };

    const handleGetReport = async () => {
        if (!selectedExam) return;
        setLoading(true); setError('');
        try {
            const r = await api.get(`/api/rankings/section-report/${selectedExam}`);
            setReport(r.data);
        } catch (e) { setError('Failed to load section report. Make sure ranks are calculated first.'); }
        setLoading(false);
    };

    // ── Marks lookup (built once per exam instead of searching every cell) ─────
    const markMap = useMemo(() => {
        const m = {};
        allResults.forEach(r => {
            const sid = r.student?.studentId, subId = r.subject?.subjectId;
            if (sid != null && subId != null) m[`${sid}_${subId}`] = r.marksObtained;
        });
        return m;
    }, [allResults]);
    const getMark = (studentId, subjectId) => {
        const v = markMap[`${studentId}_${subjectId}`];
        return v === null || v === undefined ? '-' : v;
    };

    // Subjects that actually have marks for these cards (used when class subjects aren't set up)
    const subjectsFromResults = (cards) => {
        const ids = new Set(cards.map(c => String(c.student?.studentId)));
        const map = {};
        allResults.forEach(r => { if (ids.has(String(r.student?.studentId)) && r.subject) map[r.subject.subjectId] = r.subject; });
        return Object.values(map).sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));
    };

    // ── Stream merit ──────────────────────────────────────────────────────────
    const streamCards = allReportCards.filter(c => cardInClass(c, selectedClassObj) ||
        (!selectedClassObj && isTeacher && String(c.student?.schoolClass?.classId) === String(linkedClassId)));
    const streamRanked = rankCards(streamCards, 'classRank');
    const streamSubjects = classSubjects.length ? classSubjects : subjectsFromResults(streamCards);

    // ── Grade merit ───────────────────────────────────────────────────────────
    const uniqueGrades = [...new Map(classes.filter(c => c.gradeLevel).map(c => [c.gradeLevel, c])).values()]
        .sort((a, b) => orderIndex(GRADE_ORDER, a.gradeLevel) - orderIndex(GRADE_ORDER, b.gradeLevel) || String(a.gradeLevel).localeCompare(String(b.gradeLevel)));
    const selectedGradeClasses = classes.filter(c => c.gradeLevel === selectedGrade);
    const selectedGradeCards = allReportCards.filter(c => selectedGradeClasses.some(cls => cardInClass(c, cls)));
    const gradeRanked = rankCards(selectedGradeCards, 'termRank');
    const gradeMeritSubjects = gradeSubjects.length ? gradeSubjects : subjectsFromResults(selectedGradeCards);
    const gradeStreamNames = selectedGradeClasses.map(c => classDisplayName(c)).join(', ');

    const getAvgColor = (avg, target) => {
        if (avg === null || avg === undefined || avg === '' || avg === '-' || isNaN(parseFloat(avg))) return '#666';
        const a = parseFloat(avg);
        if (a >= target) return '#28a745';
        if (a >= target * 0.9) return '#fd7e14';
        return '#dc3545';
    };

    const sectionEntries = report
        ? Object.entries(report).sort(([a], [b]) => orderIndex(SECTION_ORDER, a) - orderIndex(SECTION_ORDER, b))
        : [];

    const meanOf = (rows) => rows.length ? (rows.reduce((s, r) => s + num(r.card.averageMarks), 0) / rows.length).toFixed(2) : '-';

    const RankNotice = ({ show }) => show ? (
        <div style={styles.notice}>
            <Bi name="info-circle-fill" />Ranks haven't been calculated for all students yet, so this list is ordered by total marks. Click <strong>Calculate Ranks</strong> to save official ranks.
        </div>
    ) : null;

    const TabButton = ({ id, icon, children }) => (
        <button onClick={() => setActiveTab(id)} style={{
            ...styles.tab,
            backgroundColor: activeTab === id ? '#1F3864' : 'white',
            color: activeTab === id ? 'white' : '#1F3864'
        }}><Bi name={icon} />{children}</button>
    );

    const LoadingState = () => (
        <div style={styles.emptyState}><Bi name="hourglass-split" style={{ ...styles.emptyIcon, marginRight: 0 }} /><p>Loading report cards…</p></div>
    );

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.pageHeader}>
                    <h2 style={styles.title}><Bi name="bar-chart-line-fill" style={{ marginRight: '10px' }} />Reports & Merit Lists</h2>
                    <p style={styles.subtitle}>Section performance, stream and grade merit lists</p>
                </div>

                {error && <div style={styles.error} role="alert"><Bi name="exclamation-triangle-fill" />{error}</div>}
                {successMsg && <div style={styles.success}><Bi name="check-circle-fill" />{successMsg}</div>}

                {/* Controls */}
                <div style={styles.controlCard}>
                    <div style={styles.controlGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="file-earmark-text" />Exam</label>
                            <select style={styles.select} value={selectedExam}
                                onChange={e => { setSelectedExam(e.target.value); setReport(null); setError(''); }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>{exam.examName} — Term {exam.term} {exam.academicYear}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="building" />Class (for Stream Merit List)</label>
                            {isTeacher ? (
                                <div style={styles.classDisplay}><Bi name="lock-fill" />{selectedClassLabel}</div>
                            ) : (
                                <select style={styles.select} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {[...classes].sort((a, b) => orderIndex(GRADE_ORDER, a.gradeLevel) - orderIndex(GRADE_ORDER, b.gradeLevel) || classDisplayName(a).localeCompare(classDisplayName(b)))
                                        .map(cls => <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>)}
                                </select>
                            )}
                        </div>
                        <div style={styles.btnCol}>
                            <button onClick={handleCalculateRanks} style={styles.rankBtn} disabled={!selectedExam || calculating}>
                                {calculating ? <><Bi name="hourglass-split" />Calculating...</> : <><Bi name="sort-numeric-down" />Calculate Ranks</>}
                            </button>
                            {role === 'ADMIN' && (
                                <button onClick={handleGetReport} style={styles.reportBtn} disabled={!selectedExam || loading}>
                                    {loading ? <><Bi name="hourglass-split" />Loading...</> : <><Bi name="bar-chart-fill" />Generate Report</>}
                                </button>
                            )}
                        </div>
                    </div>
                    <p style={styles.hint}><Bi name="lightbulb" />First click <strong>Calculate Ranks</strong>, then view merit lists or generate the section report</p>
                </div>

                {/* Quick stats */}
                {sectionEntries.length > 0 && (
                    <div style={styles.quickStats}>
                        {sectionEntries.map(([key, s]) => (
                            <div key={key} style={{ ...styles.quickStatCard, borderTop: `4px solid ${s.meetingTarget ? '#28a745' : '#dc3545'}` }}>
                                <div style={styles.quickStatName}>{s.sectionName}</div>
                                <div style={{ ...styles.quickStatAvg, color: s.meetingTarget ? '#28a745' : '#dc3545' }}>{s.sectionAverage}%</div>
                                <div style={styles.quickStatMeta}>Target: {s.meanTarget}% | {s.totalStudents} students</div>
                                <div style={{ ...styles.quickStatBadge, backgroundColor: s.meetingTarget ? '#d4edda' : '#f8d7da', color: s.meetingTarget ? '#155724' : '#721c24' }}>
                                    <Bi name={s.meetingTarget ? 'check-circle-fill' : 'x-circle-fill'} style={{ marginRight: '4px' }} />{s.meetingTarget ? 'Above Target' : 'Below Target'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div style={styles.tabs}>
                    {role === 'ADMIN' && <TabButton id="section" icon="bar-chart-fill">Section Report</TabButton>}
                    <TabButton id="stream" icon="list-ol">Stream Merit List</TabButton>
                    <TabButton id="grade" icon="building">Grade Merit List</TabButton>
                </div>

                {/* ── SECTION REPORT TAB ── */}
                {activeTab === 'section' && role === 'ADMIN' && (
                    <div>
                        {report && (
                            <div style={styles.printBar}>
                                <span style={styles.printBarInfo}><Bi name="bar-chart-fill" />{selectedExamObj?.examName} — Section Performance Report</span>
                                <OrientationToggle value={sectionOrientation} onChange={setSectionOrientation} />
                                <button onClick={handlePrintSectionReport} style={styles.printBtn}><Bi name="printer-fill" />Print Report</button>
                            </div>
                        )}

                        {sectionEntries.length > 0 ? sectionEntries.map(([key, section]) => {
                            const subjectNames = unionSubjectNames(section.classBreakdown);
                            const byAvg = [...(section.classBreakdown || [])].sort((a, b) => num(b.classAverage) - num(a.classAverage));
                            const classPlaces = rankBy(byAvg, c => num(c.classAverage));
                            return (
                                <div key={key} style={styles.sectionCard}>
                                    <div style={{ ...styles.sectionHeader, backgroundColor: section.meetingTarget ? '#1F3864' : '#7b1c1c' }}>
                                        <div>
                                            <h3 style={styles.sectionTitle}>{section.sectionName}</h3>
                                            <p style={styles.sectionSub}>Grades: {section.grades?.join(', ')} | Target: {section.meanTarget}%</p>
                                        </div>
                                        <div style={styles.sectionStats}>
                                            {[
                                                { n: section.totalStudents, l: 'Students' },
                                                { n: `${section.sectionAverage}%`, l: 'Section Avg' },
                                                { n: section.aboveTarget, l: 'Above Target' },
                                                { n: section.belowTarget, l: 'Below Target' },
                                            ].map((s, i) => (
                                                <div key={i} style={styles.statBox}>
                                                    <span style={styles.statNum}>{s.n}</span>
                                                    <span style={styles.statLbl}>{s.l}</span>
                                                </div>
                                            ))}
                                            <div style={{ ...styles.targetBadge, backgroundColor: section.meetingTarget ? '#28a745' : '#dc3545' }}>
                                                <Bi name={section.meetingTarget ? 'check-circle-fill' : 'x-circle-fill'} />{section.meetingTarget ? 'Above Target' : 'Below Target'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={styles.sectionBody}>
                                        {byAvg.length > 0 && (
                                            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                                                <h4 style={styles.subTitle}><Bi name="table" />Class Averages by Subject</h4>
                                                <table style={styles.table}>
                                                    <thead>
                                                        <tr style={styles.thead}>
                                                            <th style={styles.th}>CLASS</th>
                                                            {subjectNames.map(name => <th key={name} style={styles.thSub}>{name}</th>)}
                                                            <th style={styles.thTotal}>AVG %</th>
                                                            <th style={styles.thTotal}>STATUS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {byAvg.map((cls, i) => (
                                                            <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                                <td style={{ ...styles.td, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                                    {MEDAL_COLORS[classPlaces[i]] && <Bi name="trophy-fill" style={{ color: MEDAL_COLORS[classPlaces[i]] }} />}
                                                                    {classDisplayName(cls)}
                                                                </td>
                                                                {subjectNames.map(name => {
                                                                    const sub = cls.subjectPerformance?.find(s => s.subjectName === name);
                                                                    return (
                                                                        <td key={name} style={{ ...styles.tdC, color: sub ? getAvgColor(sub.average, section.meanTarget) : '#bbb', fontWeight: 'bold' }}>
                                                                            {sub ? sub.average : '-'}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td style={{ ...styles.tdTotal, color: cls.meetingTarget ? '#28a745' : '#dc3545' }}><strong>{cls.classAverage}%</strong></td>
                                                                <td style={styles.tdC}>
                                                                    <span style={{
                                                                        backgroundColor: cls.meetingTarget ? '#d4edda' : '#f8d7da',
                                                                        color: cls.meetingTarget ? '#155724' : '#721c24',
                                                                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap'
                                                                    }}>
                                                                        <Bi name={cls.meetingTarget ? 'check-circle-fill' : 'x-circle-fill'} style={{ marginRight: '4px' }} />{cls.meetingTarget ? 'Above' : 'Below'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Stream comparison bars */}
                                        {(section.classBreakdown || []).map((cls, i) => {
                                            if (!cls.streams || cls.streams.length <= 1) return null;
                                            const sorted = [...cls.streams].sort((a, b) => num(b.classAverage) - num(a.classAverage));
                                            const maxAvg = Math.max(...sorted.map(s => num(s.classAverage)), 1);
                                            return (
                                                <div key={i} style={styles.streamCompCard}>
                                                    <h4 style={styles.subTitle}><Bi name="bar-chart-steps" />{cls.className} — Stream Comparison</h4>
                                                    {sorted.map((stream, k) => (
                                                        <div key={k} style={styles.streamBarRow}>
                                                            <div style={styles.streamBarLabel}>{classDisplayName(stream)}</div>
                                                            <div style={styles.streamBarOuter}>
                                                                <div style={{ ...styles.streamBarInner, width: `${(num(stream.classAverage) / maxAvg) * 100}%`, backgroundColor: stream.meetingTarget ? '#28a745' : '#dc3545' }} />
                                                            </div>
                                                            <div style={{ ...styles.streamBarVal, color: stream.meetingTarget ? '#28a745' : '#dc3545' }}>{stream.classAverage}%</div>
                                                            <div style={styles.streamBarMeta}>
                                                                <Bi name="people-fill" style={{ marginRight: '3px' }} />{stream.totalStudents}
                                                                {stream.topStudent && <> | <Bi name="trophy-fill" style={{ marginRight: '3px', color: MEDAL_COLORS[1] }} />{String(stream.topStudent)}</>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={styles.emptyState}>
                                <Bi name="bar-chart" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                                <p>Select an exam, click <strong>Calculate Ranks</strong>, then click <strong>Generate Report</strong></p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STREAM MERIT LIST TAB ── */}
                {activeTab === 'stream' && (
                    <div>
                        {selectedExam && selectedClass && loadingCards ? <LoadingState /> :
                         selectedExam && selectedClass && streamCards.length > 0 ? (
                            <>
                                <div style={styles.printBar}>
                                    <span style={styles.printBarInfo}><Bi name="list-ol" />{selectedClassLabel} — {streamCards.length} students</span>
                                    <OrientationToggle value={streamMeritOrientation} onChange={setStreamMeritOrientation} />
                                    <button onClick={handlePrintStreamMerit} style={styles.printBtn}><Bi name="printer-fill" />Print Merit List</button>
                                </div>
                                <RankNotice show={streamRanked.computed} />
                                <div style={styles.meritCard}>
                                    <div style={styles.meritHeader}>
                                        <h3 style={styles.meritTitle}><Bi name="list-ol" />{selectedClassLabel} — Stream Merit List</h3>
                                        <p style={styles.meritSub}>{examSubtitle}</p>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr style={styles.thead}>
                                                    <th style={styles.th}>RANK</th>
                                                    <th style={styles.th}>ADM NO</th>
                                                    <th style={styles.th}>NAME</th>
                                                    {streamSubjects.map(sub => <th key={sub.subjectId} style={styles.thSub}>{sub.subjectName}</th>)}
                                                    <th style={styles.thTotal}>TOTAL</th>
                                                    <th style={styles.thTotal}>AVG %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {streamRanked.rows.map(({ card, rank }, i) => (
                                                    <tr key={card.reportId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={styles.tdC}><RankCell rank={rank} /></td>
                                                        <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber}</span></td>
                                                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                        {streamSubjects.map(sub => <td key={sub.subjectId} style={styles.tdC}>{getMark(card.student?.studentId, sub.subjectId)}</td>)}
                                                        <td style={styles.tdTotal}><strong>{card.totalMarks ?? '-'}</strong></td>
                                                        <td style={styles.tdTotal}>
                                                            <span style={{ ...styles.avgBadge, backgroundColor: avgBadgeColor(card.averageMarks) }}>{fmtPct(card.averageMarks)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={styles.meritFooter}>
                                        <span><Bi name="people-fill" />{streamCards.length} students</span>
                                        <span><Bi name="graph-up" />Avg: {meanOf(streamRanked.rows)}%</span>
                                        <span><Bi name="trophy-fill" style={{ color: MEDAL_COLORS[1] }} />Top: {streamRanked.rows[0]?.card.student?.firstName} {streamRanked.rows[0]?.card.student?.lastName}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={styles.emptyState}>
                                <Bi name="list-ol" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                                <p>{!selectedExam ? 'Select an exam first' : !selectedClass ? 'Select a class' : 'No report cards found for this class and exam. Generate report cards, then calculate ranks.'}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── GRADE MERIT LIST TAB ── */}
                {activeTab === 'grade' && (
                    <div>
                        <div style={styles.gradePicker}>
                            <label style={{ ...styles.label, whiteSpace: 'nowrap' }}><Bi name="building" />Grade</label>
                            {isTeacher ? (
                                <div style={styles.classDisplay}><Bi name="lock-fill" />{gradeLabel(selectedGrade)} — All Streams</div>
                            ) : (
                                <select style={{ ...styles.select, minWidth: '220px' }} value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                                    <option value="">-- Select Grade --</option>
                                    {uniqueGrades.map(cls => {
                                        const streamCount = classes.filter(c => c.gradeLevel === cls.gradeLevel).length;
                                        return (
                                            <option key={cls.gradeLevel} value={cls.gradeLevel}>
                                                {gradeLabel(cls.gradeLevel)}{streamCount > 1 ? ` (${streamCount} streams)` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}
                            {selectedGrade && <span style={{ color: '#666', fontSize: '13px' }}>Combining: {gradeStreamNames}</span>}
                        </div>

                        {selectedExam && selectedGrade && loadingCards ? <LoadingState /> :
                         selectedExam && selectedGrade && selectedGradeCards.length > 0 ? (
                            <>
                                <div style={styles.printBar}>
                                    <span style={styles.printBarInfo}><Bi name="building" />{gradeLabel(selectedGrade)} — All Streams — {selectedGradeCards.length} students</span>
                                    <OrientationToggle value={gradeMeritOrientation} onChange={setGradeMeritOrientation} />
                                    <button onClick={handlePrintGradeMerit} style={styles.printBtn}><Bi name="printer-fill" />Print Grade Merit List</button>
                                </div>
                                <RankNotice show={gradeRanked.computed} />
                                <div style={styles.meritCard}>
                                    <div style={styles.meritHeader}>
                                        <h3 style={styles.meritTitle}><Bi name="building" />{gradeLabel(selectedGrade)} — All Streams Merit List</h3>
                                        <p style={styles.meritSub}>{examSubtitle} | {gradeStreamNames}</p>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={styles.table}>
                                            <thead>
                                                <tr style={styles.thead}>
                                                    <th style={styles.th}>RANK</th>
                                                    <th style={styles.th}>STREAM</th>
                                                    <th style={styles.th}>ADM NO</th>
                                                    <th style={styles.th}>NAME</th>
                                                    {gradeMeritSubjects.map(sub => <th key={sub.subjectId} style={styles.thSub}>{sub.subjectName}</th>)}
                                                    <th style={styles.thTotal}>TOTAL</th>
                                                    <th style={styles.thTotal}>AVG %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gradeRanked.rows.map(({ card, rank }, i) => (
                                                    <tr key={card.reportId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={styles.tdC}><RankCell rank={rank} /></td>
                                                        <td style={styles.tdC}><span style={styles.streamBadge}>{classDisplayName(card.student)}</span></td>
                                                        <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber}</span></td>
                                                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                        {gradeMeritSubjects.map(sub => <td key={sub.subjectId} style={styles.tdC}>{getMark(card.student?.studentId, sub.subjectId)}</td>)}
                                                        <td style={styles.tdTotal}><strong>{card.totalMarks ?? '-'}</strong></td>
                                                        <td style={styles.tdTotal}>
                                                            <span style={{ ...styles.avgBadge, backgroundColor: avgBadgeColor(card.averageMarks) }}>{fmtPct(card.averageMarks)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={styles.meritFooter}>
                                        <span><Bi name="people-fill" />{selectedGradeCards.length} students</span>
                                        <span><Bi name="graph-up" />Avg: {meanOf(gradeRanked.rows)}%</span>
                                        <span><Bi name="diagram-3-fill" />{selectedGradeClasses.length} stream{selectedGradeClasses.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={styles.emptyState}>
                                <Bi name="building" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                                <p>{!selectedExam ? 'Select an exam first' : !selectedGrade ? 'Select a grade above' : 'No report cards found for this grade. Generate report cards, then calculate ranks.'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden print areas — kept off-screen (not display:none) so react-to-print can read them */}
            <div style={{ overflow: 'hidden', height: 0, width: 0, position: 'fixed', top: 0, left: 0 }}>
                <PrintableSectionReport
                    ref={sectionReportRef}
                    report={report}
                    examName={selectedExamObj?.examName || ''}
                    term={selectedExamObj?.term || ''}
                    year={selectedExamObj?.academicYear || ''}
                />
                <PrintableMeritList
                    ref={streamMeritRef}
                    rows={streamRanked.rows}
                    getMark={getMark}
                    subjects={streamSubjects}
                    title={`${selectedClassLabel.toUpperCase()} MERIT LIST`}
                    subtitle={examSubtitle}
                    level="stream"
                />
                <PrintableMeritList
                    ref={gradeMeritRef}
                    rows={gradeRanked.rows}
                    getMark={getMark}
                    subjects={gradeMeritSubjects}
                    title={`${(gradeLabel(selectedGrade) || '').toUpperCase()} MERIT LIST — ALL STREAMS`}
                    subtitle={`${examSubtitle} | ${gradeStreamNames}`}
                    level="grade"
                />
            </div>
        </div>
        <Footer />
        </div>
    );
}

// Competition places for an already-sorted list (equal values share a place)
function rankBy(sortedItems, valueFn) {
    const places = [];
    sortedItems.forEach((item, i) => {
        places[i] = i > 0 && valueFn(item) === valueFn(sortedItems[i - 1]) ? places[i - 1] : i + 1;
    });
    return places;
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    pageHeader: { marginBottom: '20px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0 },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    notice: { color: '#856404', padding: '10px 15px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffc107', fontSize: '13px' },

    controlCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    controlGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', alignItems: 'end', marginBottom: '10px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    classDisplay: { padding: '10px', borderRadius: '8px', border: '2px solid #1F3864', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold', fontSize: '14px' },
    btnCol: { display: 'flex', flexDirection: 'column', gap: '8px' },
    rankBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    reportBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    hint: { color: '#666', fontSize: '13px', fontStyle: 'italic', margin: 0 },

    quickStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' },
    quickStatCard: { backgroundColor: 'white', borderRadius: '14px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    quickStatName: { fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '4px' },
    quickStatAvg: { fontSize: '28px', fontWeight: 'bold', lineHeight: 1 },
    quickStatMeta: { fontSize: '11px', color: '#999', margin: '4px 0' },
    quickStatBadge: { fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', marginTop: '4px' },

    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    gradePicker: { backgroundColor: 'white', padding: '16px 20px', borderRadius: '14px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },

    printBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '12px 20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexWrap: 'wrap', gap: '10px' },
    printBarInfo: { color: '#1F3864', fontWeight: 'bold', fontSize: '14px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },

    sectionCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '25px', overflow: 'hidden' },
    sectionHeader: { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
    sectionTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '20px' },
    sectionSub: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '13px' },
    sectionStats: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
    statBox: { textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: '8px' },
    statNum: { color: 'white', fontSize: '22px', fontWeight: 'bold', display: 'block' },
    statLbl: { color: 'rgba(255,255,255,0.8)', fontSize: '11px', display: 'block' },
    targetBadge: { color: 'white', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' },
    sectionBody: { padding: '20px' },
    subTitle: { color: '#1F3864', margin: '0 0 12px 0', fontSize: '15px' },

    streamCompCard: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '15px' },
    streamBarRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' },
    streamBarLabel: { width: '90px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864', flexShrink: 0 },
    streamBarOuter: { flex: 1, minWidth: '120px', height: '18px', backgroundColor: '#e9ecef', borderRadius: '9px', overflow: 'hidden' },
    streamBarInner: { height: '100%', borderRadius: '9px', transition: 'width 0.5s ease' },
    streamBarVal: { width: '55px', fontSize: '13px', fontWeight: 'bold', textAlign: 'right', flexShrink: 0 },
    streamBarMeta: { fontSize: '11px', color: '#666', flexShrink: 0 },

    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    thSub: { color: 'white', padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    thTotal: { color: '#FFD700', padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' },
    td: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    tdC: { padding: '9px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'center' },
    tdTotal: { padding: '9px 12px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'center', backgroundColor: '#f0f4ff' },
    trEven: { backgroundColor: '#fafafa' },
    trOdd: { backgroundColor: 'white' },
    admNo: { fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 5px', borderRadius: '4px' },
    streamBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    avgBadge: { color: 'white', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' },

    meritCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '20px' },
    meritHeader: { backgroundColor: '#1F3864', padding: '15px 20px' },
    meritTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '18px' },
    meritSub: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    meritFooter: { display: 'flex', gap: '30px', padding: '12px 20px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee', fontWeight: 'bold', color: '#1F3864', fontSize: '13px', flexWrap: 'wrap' },

    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px', display: 'inline-block', color: '#BDD7EE' },
};

const pStyles = {
    page: { padding: '12px 15px', fontFamily: "'Times New Roman', Times, serif", maxWidth: '100%', color: '#000', fontSize: '11px' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '10px', marginBottom: '12px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
    logo: { width: '70px', height: '70px', objectFit: 'contain' },
    schoolInfo: { textAlign: 'center', flex: 1, padding: '0 10px' },
    schoolName: { color: '#1F3864', fontSize: '13px', margin: '0 0 3px 0', textTransform: 'uppercase' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 3px 0', fontSize: '11px' },
    contact: { fontSize: '10px', color: '#666', margin: 0 },
    reportBanner: { backgroundColor: '#1F3864', padding: '6px 12px', textAlign: 'center' },
    reportTitle: { color: 'white', margin: '0 0 2px 0', fontSize: '13px' },
    reportSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '11px' },
    meritTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '6px' },
    thead: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '5px 8px', textAlign: 'left', fontSize: '10px', whiteSpace: 'nowrap' },
    thSubject: { color: 'white', padding: '5px 4px', textAlign: 'center', fontSize: '9px', whiteSpace: 'nowrap' },
    thTotal: { color: '#FFD700', padding: '5px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' },
    td: { padding: '4px 8px', borderBottom: '1px solid #eee', fontSize: '10px' },
    tdCenter: { padding: '4px 4px', borderBottom: '1px solid #eee', fontSize: '10px', textAlign: 'center' },
    tdName: { padding: '4px 8px', borderBottom: '1px solid #eee', fontSize: '10px', whiteSpace: 'nowrap' },
    tdTotal: { padding: '4px 8px', borderBottom: '1px solid #eee', fontSize: '10px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f0f4ff' },
    trEven: { backgroundColor: '#f8f9fa' },
    trOdd: { backgroundColor: 'white' },
    summaryRow: { display: 'flex', gap: '20px', padding: '6px 8px', backgroundColor: '#f8f9fa', borderTop: '1px solid #ddd', fontSize: '10px', fontWeight: 'bold', marginTop: '5px' },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1F3864', paddingTop: '8px', marginTop: '12px' },
    footerLogo: { width: '35px', height: '35px', objectFit: 'contain' },
    footerSigs: { textAlign: 'center', fontSize: '10px', color: '#333', lineHeight: '2.2' },
};

export default SectionReport;
