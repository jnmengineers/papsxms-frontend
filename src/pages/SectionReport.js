import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import { classDisplayName, streamLabel, gradeLabel } from '../utils/classUtils';

// ─── Orientation Toggle ───────────────────────────────────────────────────────
const OrientationToggle = ({ value, onChange }) => (
    <span style={{ display: 'flex', gap: '3px' }}>
        {['portrait', 'landscape'].map(o => (
            <button key={o} onClick={() => onChange(o)} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', cursor: 'pointer', border: `1.5px solid ${value === o ? '#1F3864' : '#ccc'}`, background: value === o ? '#1F3864' : 'white', color: value === o ? 'white' : '#666', fontWeight: value === o ? 'bold' : 'normal', textTransform: 'capitalize' }}>{o}</button>
        ))}
    </span>
);

// ─── Print Header ─────────────────────────────────────────────────────────────
const PrintHeader = ({ title, subtitle }) => (
    <div style={pStyles.header}>
        <div style={pStyles.headerRow}>
            <img src={logo1} alt="Logo" style={pStyles.logo} />
            <div style={pStyles.schoolInfo}>
                <h1 style={pStyles.schoolName}>PIPELINE ADVENTIST PRIMARY & JUNIOR SECONDARY SCHOOL</h1>
                <p style={pStyles.motto}>Abreast with the Best in Holistic Education</p>
                <p style={pStyles.contact}>P.O. BOX 61774-00200, NAIROBI | Tel: 0713 301 521 / 0721 885 996</p>
            </div>
            <img src={logo2} alt="Logo" style={pStyles.logo} />
        </div>
        <div style={pStyles.reportBanner}>
            <h2 style={pStyles.reportTitle}>{title}</h2>
            {subtitle && <p style={pStyles.reportSubtitle}>{subtitle}</p>}
        </div>
    </div>
);

// ─── Printable Merit List ─────────────────────────────────────────────────────
const PrintableMeritList = React.forwardRef(({ reportCards, results, title, subtitle, level, subjects }, ref) => {
    const sorted = [...reportCards].sort((a, b) => (a.classRank || 999) - (b.classRank || 999));
    const getMark = (studentId, subjectId) => {
        const r = results.find(res =>
            String(res.student?.studentId) === String(studentId) &&
            String(res.subject?.subjectId) === String(subjectId)
        );
        return r ? r.marksObtained : '-';
    };
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
                            <th key={sub.subjectId} style={pStyles.thSubject}>{sub.subjectName.toUpperCase()}</th>
                        ))}
                        <th style={pStyles.thTotal}>TOTAL</th>
                        <th style={pStyles.thTotal}>AVG %</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((card, i) => (
                        <tr key={card.reportId} style={i % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                            <td style={pStyles.tdCenter}><strong>{card.classRank || i + 1}</strong></td>
                            {level === 'grade' && <td style={pStyles.tdCenter}>{classDisplayName(card.student)}</td>}
                            <td style={pStyles.td}>{card.student?.admissionNumber || '-'}</td>
                            <td style={pStyles.tdName}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                            {subjects.map(sub => (
                                <td key={sub.subjectId} style={pStyles.tdCenter}>
                                    {getMark(card.student?.studentId, sub.subjectId)}
                                </td>
                            ))}
                            <td style={pStyles.tdTotal}><strong>{card.totalMarks}</strong></td>
                            <td style={pStyles.tdTotal}><strong>{card.averageMarks?.toFixed(1)}%</strong></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={pStyles.summaryRow}>
                <span>Total Students: {sorted.length}</span>
                <span>Class Average: {sorted.length > 0 ? (sorted.reduce((s, c) => s + (c.averageMarks || 0), 0) / sorted.length).toFixed(2) : 0}%</span>
                <span>Top: {sorted[0] ? `${sorted[0].student?.firstName} ${sorted[0].student?.lastName} (${sorted[0].averageMarks?.toFixed(1)}%)` : '-'}</span>
            </div>
            <div style={pStyles.footer}>
                <img src={logo1} alt="" style={pStyles.footerLogo} />
                <div style={pStyles.footerSigs}>
                    <p>Class Teacher: _________________________ Signature: _________________ Date: ___________</p>
                    <p>Principal: _________________________ Signature: _________________ Date: ___________</p>
                </div>
                <img src={logo2} alt="" style={pStyles.footerLogo} />
            </div>
        </div>
    );
});

// ─── Printable Section Performance Report (like the cover page) ───────────────
const PrintableSectionReport = React.forwardRef(({ report, examName, term, year }, ref) => (
    <div ref={ref} style={pStyles.page}>
        <PrintHeader
            title="ACADEMIC PERFORMANCE REPORT"
            subtitle={`${examName} — Term ${term} ${year}`}
        />
        {report && Object.entries(report).map(([key, section]) => (
            <div key={key} style={{ marginBottom: '16px' }}>
                {/* Section banner */}
                <div style={{ backgroundColor: '#1F3864', color: 'white', padding: '6px 10px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12px' }}>{section.sectionName}</strong>
                    <span style={{ fontSize: '10px', opacity: 0.85 }}>
                        {' '}| Target: {section.meanTarget}% | Students: {section.totalStudents}
                        | Section Avg: {section.sectionAverage}%
                        | {section.meetingTarget ? '✅ Above Target' : '❌ Below Target'}
                    </span>
                </div>

                {/* Class averages table — like cover page */}
                {section.classBreakdown?.length > 0 && (
                    <table style={{ ...pStyles.table, marginBottom: '8px' }}>
                        <thead>
                            <tr style={pStyles.thead}>
                                <th style={pStyles.th}>CLASS</th>
                                {section.classBreakdown[0]?.subjectPerformance?.map(sub => (
                                    <th key={sub.subjectName} style={pStyles.thSubject}>{sub.subjectName.toUpperCase()}</th>
                                ))}
                                <th style={pStyles.thTotal}>AVG %</th>
                                <th style={pStyles.thTotal}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {section.classBreakdown.map((cls, i) => (
                                <tr key={i} style={i % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                                    <td style={{ ...pStyles.td, fontWeight: 'bold' }}>{classDisplayName(cls)}</td>
                                    {cls.subjectPerformance?.map((sub, j) => (
                                        <td key={j} style={{ ...pStyles.tdCenter, color: sub.meetingTarget ? '#155724' : '#721c24' }}>
                                            {sub.average}
                                        </td>
                                    ))}
                                    <td style={{ ...pStyles.tdTotal, color: cls.meetingTarget ? '#155724' : '#721c24' }}>
                                        <strong>{cls.classAverage}%</strong>
                                    </td>
                                    <td style={pStyles.tdCenter}>{cls.meetingTarget ? '✅' : '❌'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Top performers */}
                {section.topPerformers?.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '10px', margin: '4px 0' }}>🏆 Top Performers</p>
                        <table style={pStyles.table}>
                            <thead>
                                <tr style={pStyles.thead}>
                                    <th style={pStyles.th}>Rank</th>
                                    <th style={pStyles.th}>Name</th>
                                    <th style={pStyles.th}>Class</th>
                                    <th style={pStyles.th}>Average (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {section.topPerformers.slice(0, 5).map((p, i) => (
                                    <tr key={i} style={i % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                                        <td style={pStyles.tdCenter}>{i + 1}</td>
                                        <td style={pStyles.td}><strong>{p.name}</strong></td>
                                        <td style={pStyles.td}>{p.class}</td>
                                        <td style={pStyles.td}>{p.average?.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        ))}
        <div style={pStyles.footer}>
            <img src={logo1} alt="" style={pStyles.footerLogo} />
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#333' }}>
                Printed: {new Date().toLocaleDateString()} — Pipeline Adventist School Official Document
            </p>
            <img src={logo2} alt="" style={pStyles.footerLogo} />
        </div>
    </div>
));

// ─── Main Component ───────────────────────────────────────────────────────────
function SectionReport() {
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');

    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allReportCards, setAllReportCards] = useState([]);
    const [allResults, setAllResults] = useState([]);
    const [classSubjects, setClassSubjects] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [report, setReport] = useState(null);
    const [activeTab, setActiveTab] = useState(role === 'TEACHER' ? 'stream' : 'section');
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [expandedStreams, setExpandedStreams] = useState({});
    const [selectedGrade, setSelectedGrade] = useState('');
    const [gradeSubjects, setGradeSubjects] = useState([]);

    const sectionReportRef = useRef();
    const streamMeritRef = useRef();
    const gradeMeritRef = useRef();

    const [sectionOrientation, setSectionOrientation] = useState('portrait');
    const [streamMeritOrientation, setStreamMeritOrientation] = useState('landscape');
    const [gradeMeritOrientation, setGradeMeritOrientation] = useState('landscape');

    const handlePrintSectionReport = useReactToPrint({ contentRef: sectionReportRef, documentTitle: 'Section_Performance_Report', pageStyle: `@page { size: A4 ${sectionOrientation}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` });
    const handlePrintStreamMerit = useReactToPrint({ contentRef: streamMeritRef, documentTitle: `Merit_List_${selectedClass}`, pageStyle: `@page { size: A4 ${streamMeritOrientation}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` });
    const handlePrintGradeMerit = useReactToPrint({ contentRef: gradeMeritRef, documentTitle: `Grade_Merit_List`, pageStyle: `@page { size: A4 ${gradeMeritOrientation}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }` });

    useEffect(() => {
        fetchExams();
        fetchClasses();
    }, []);

    useEffect(() => {
        if (role === 'TEACHER' && linkedClassId) setSelectedClass(linkedClassId);
    }, [linkedClassId]);

    // Once classes load, auto-set the grade for teachers
    useEffect(() => {
        if (role === 'TEACHER' && linkedClassId && classes.length > 0) {
            const teacherClass = classes.find(c => String(c.classId) === String(linkedClassId));
            if (teacherClass?.gradeLevel) setSelectedGrade(teacherClass.gradeLevel);
        }
    }, [classes]);

    useEffect(() => {
        if (selectedExam && selectedClass) {
            fetchAllReportCards();
            fetchClassSubjects();
        }
    }, [selectedExam, selectedClass]);

    useEffect(() => {
        if (selectedExam && allReportCards.length > 0) fetchResults();
    }, [allReportCards]);

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {}
    };

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {}
    };

    const fetchAllReportCards = async () => {
        try {
            const r = await api.get(`/api/reportCards/by-exam/${selectedExam}`);
            setAllReportCards(r.data);
        } catch (e) { console.error('Report cards failed:', e.message); }
    };

    const fetchResults = async () => {
        try {
            const r = await api.get(`/api/results/by-exam/${selectedExam}`);
            setAllResults(r.data);
        } catch (e) { console.error('Results failed:', e.message); }
    };

    const fetchClassSubjects = async () => {
        try {
            const r = await api.get(`/api/class-subjects/by-class/${selectedClass}`);
            setClassSubjects(r.data.map(cs => cs.subject).filter(Boolean));
        } catch (e) {}
    };

    const fetchGradeSubjects = async (gradeLevel) => {
        const firstClass = classes.find(c => c.gradeLevel === gradeLevel);
        if (!firstClass) return;
        try {
            const r = await api.get(`/api/class-subjects/by-class/${firstClass.classId}`);
            setGradeSubjects(r.data.map(cs => cs.subject).filter(Boolean));
        } catch (e) {}
    };

    useEffect(() => {
        if (selectedGrade && selectedExam) {
            fetchGradeSubjects(selectedGrade);
            fetchAllReportCards();
        }
    }, [selectedGrade, selectedExam]);

    const handleCalculateRanks = async () => {
        if (!selectedExam) return;
        setCalculating(true); setError('');
        try {
            await api.post(`/api/rankings/calculate/${selectedExam}`);
            setSuccessMsg('✅ Ranks calculated!');
            fetchAllReportCards();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (e) { setError('Failed to calculate ranks'); }
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

    const selectedExamObj = exams.find(e => String(e.examId) === String(selectedExam));
    const selectedClassObj = classes.find(c => String(c.classId) === String(selectedClass));
    const gradeLevel = selectedClassObj?.gradeLevel;
    const gradeClasses = classes.filter(c => c.gradeLevel === gradeLevel);
    const gradeClassNames = gradeClasses.map(c => c.className);

    const streamCards = allReportCards.filter(c =>
        String(c.student?.schoolClass?.classId) === String(selectedClass) ||
        c.student?.className === selectedClassObj?.className
    );

    const gradeCards = allReportCards.filter(c =>
        gradeClassNames.includes(c.student?.className)
    );

    // Grade merit: unique grade levels across all classes, for the dedicated grade dropdown
    const uniqueGrades = [...new Map(
        classes.filter(c => c.gradeLevel).map(c => [c.gradeLevel, c])
    ).values()].sort((a, b) => {
        const order = ['PG','PP1','PP2','GRADE_1','GRADE_2','GRADE_3','GRADE_4','GRADE_5','GRADE_6','GRADE_7','GRADE_8','GRADE_9'];
        return (order.indexOf(a.gradeLevel) ?? 99) - (order.indexOf(b.gradeLevel) ?? 99);
    });

    const selectedGradeClasses = classes.filter(c => c.gradeLevel === selectedGrade);
    const selectedGradeClassNames = selectedGradeClasses.map(c => c.className);
    const selectedGradeCards = allReportCards.filter(c =>
        selectedGradeClassNames.includes(c.student?.className)
    );

    const getMark = (studentId, subjectId) => {
        const r = allResults.find(res =>
            String(res.student?.studentId) === String(studentId) &&
            String(res.subject?.subjectId) === String(subjectId)
        );
        return r ? r.marksObtained : '-';
    };

    const getAvgColor = (avg, target) => {
        if (!avg || avg === '-') return '#666';
        const a = parseFloat(avg);
        if (a >= target) return '#28a745';
        if (a >= target * 0.9) return '#fd7e14';
        return '#dc3545';
    };

    // Section stats summary
    const getSectionSummary = () => {
        if (!report) return null;
        return Object.entries(report).map(([key, section]) => ({
            name: section.sectionName,
            avg: section.sectionAverage,
            target: section.meanTarget,
            meeting: section.meetingTarget,
            students: section.totalStudents
        }));
    };

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href = '/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <div style={styles.pageHeader}>
                    <div>
                        <h2 style={styles.title}>📊 Reports & Merit Lists</h2>
                        <p style={styles.subtitle}>Section performance, stream and grade merit lists</p>
                    </div>
                </div>

                {error && <div style={styles.error}>{error}</div>}
                {successMsg && <div style={styles.success}>{successMsg}</div>}

                {/* Controls */}
                <div style={styles.controlCard}>
                    <div style={styles.controlGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>📝 Exam</label>
                            <select style={styles.select} value={selectedExam}
                                onChange={e => { setSelectedExam(e.target.value); setReport(null); setAllReportCards([]); setAllResults([]); }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.examName} — Term {exam.term} {exam.academicYear}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>🏫 Class (for Merit Lists)</label>
                            {role === 'TEACHER' ? (
                                <div style={styles.classDisplay}>🔒 {linkedClassName}</div>
                            ) : (
                                <select style={styles.select} value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {classes.map(cls => (
                                        <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div style={styles.btnCol}>
                            <button onClick={handleCalculateRanks} style={styles.rankBtn} disabled={!selectedExam || calculating}>
                                {calculating ? '⏳ Calculating...' : '🔢 Calculate Ranks'}
                            </button>
                            {role === 'ADMIN' && (
                                <button onClick={handleGetReport} style={styles.reportBtn} disabled={!selectedExam || loading}>
                                    {loading ? '⏳ Loading...' : '📊 Generate Report'}
                                </button>
                            )}
                        </div>
                    </div>
                    <p style={styles.hint}>💡 First click <strong>Calculate Ranks</strong>, then view merit lists or generate the section report</p>
                </div>

                {/* Quick stats if report loaded */}
                {report && getSectionSummary() && (
                    <div style={styles.quickStats}>
                        {getSectionSummary().map((s, i) => (
                            <div key={i} style={{ ...styles.quickStatCard, borderTop: `4px solid ${s.meeting ? '#28a745' : '#dc3545'}` }}>
                                <div style={styles.quickStatName}>{s.name}</div>
                                <div style={{ ...styles.quickStatAvg, color: s.meeting ? '#28a745' : '#dc3545' }}>{s.avg}%</div>
                                <div style={styles.quickStatMeta}>Target: {s.target}% | {s.students} students</div>
                                <div style={{ ...styles.quickStatBadge, backgroundColor: s.meeting ? '#d4edda' : '#f8d7da', color: s.meeting ? '#155724' : '#721c24' }}>
                                    {s.meeting ? '✅ Above Target' : '❌ Below Target'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div style={styles.tabs}>
                    {role === 'ADMIN' && (
                        <button onClick={() => setActiveTab('section')} style={{
                            ...styles.tab,
                            backgroundColor: activeTab === 'section' ? '#1F3864' : 'white',
                            color: activeTab === 'section' ? 'white' : '#1F3864'
                        }}>📊 Section Report</button>
                    )}
                    <button onClick={() => setActiveTab('stream')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'stream' ? '#1F3864' : 'white',
                        color: activeTab === 'stream' ? 'white' : '#1F3864'
                    }}>📋 Stream Merit List</button>
                    <button onClick={() => setActiveTab('grade')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'grade' ? '#1F3864' : 'white',
                        color: activeTab === 'grade' ? 'white' : '#1F3864'
                    }}>🏫 Grade Merit List</button>
                </div>

                {/* ── SECTION REPORT TAB ── */}
                {activeTab === 'section' && (
                    <div>
                        {report && (
                            <div style={styles.printBar}>
                                <span style={styles.printBarInfo}>📊 {selectedExamObj?.examName} — Section Performance Report</span>
                                <OrientationToggle value={sectionOrientation} onChange={setSectionOrientation} />
                                <button onClick={handlePrintSectionReport} style={styles.printBtn}>🖨️ Print Report</button>
                            </div>
                        )}

                        {report ? Object.entries(report).map(([key, section]) => (
                            <div key={key} style={styles.sectionCard}>
                                {/* Section header */}
                                <div style={{ ...styles.sectionHeader, backgroundColor: section.meetingTarget ? '#1F3864' : '#7b1c1c' }}>
                                    <div>
                                        <h3 style={styles.sectionTitle}>{section.sectionName}</h3>
                                        <p style={styles.sectionSub}>
                                            Grades: {section.grades?.join(', ')} | Target: {section.meanTarget}%
                                        </p>
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
                                            {section.meetingTarget ? '✅ Above Target' : '❌ Below Target'}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.sectionBody}>
                                    {/* Class averages table — like the cover page */}
                                    {section.classBreakdown?.length > 0 && (
                                        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                                            <h4 style={styles.subTitle}>📊 Class Averages by Subject</h4>
                                            <table style={styles.table}>
                                                <thead>
                                                    <tr style={styles.thead}>
                                                        <th style={styles.th}>CLASS</th>
                                                        {section.classBreakdown[0]?.subjectPerformance?.map(sub => (
                                                            <th key={sub.subjectName} style={styles.thSub}>{sub.subjectName}</th>
                                                        ))}
                                                        <th style={styles.thTotal}>AVG %</th>
                                                        <th style={styles.thTotal}>STATUS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[...section.classBreakdown]
                                                        .sort((a, b) => b.classAverage - a.classAverage)
                                                        .map((cls, i) => (
                                                            <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                                <td style={{ ...styles.td, fontWeight: 'bold' }}>
                                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''} {classDisplayName(cls)}
                                                                </td>
                                                                {cls.subjectPerformance?.map((sub, j) => (
                                                                    <td key={j} style={{
                                                                        ...styles.tdC,
                                                                        color: getAvgColor(sub.average, section.meanTarget),
                                                                        fontWeight: 'bold'
                                                                    }}>
                                                                        {sub.average}
                                                                    </td>
                                                                ))}
                                                                <td style={{
                                                                    ...styles.tdTotal,
                                                                    color: cls.meetingTarget ? '#28a745' : '#dc3545'
                                                                }}>
                                                                    <strong>{cls.classAverage}%</strong>
                                                                </td>
                                                                <td style={styles.tdC}>
                                                                    <span style={{
                                                                        backgroundColor: cls.meetingTarget ? '#d4edda' : '#f8d7da',
                                                                        color: cls.meetingTarget ? '#155724' : '#721c24',
                                                                        padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold'
                                                                    }}>
                                                                        {cls.meetingTarget ? '✅ Above' : '❌ Below'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Top performers */}
                                    {section.topPerformers?.length > 0 && (
                                        <div style={styles.topCard}>
                                            <h4 style={styles.subTitle}>🏆 Top 5 Performers</h4>
                                            <div style={styles.topGrid}>
                                                {section.topPerformers.slice(0, 5).map((p, i) => (
                                                    <div key={i} style={styles.topItem}>
                                                        <div style={{ ...styles.topRank, backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#2E75B6' }}>
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <div style={styles.topName}>{p.name}</div>
                                                            <div style={styles.topMeta}>{p.class} • {p.average?.toFixed(1)}%</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stream comparison bars */}
                                    {section.classBreakdown?.some(c => c.streams?.length > 1) && (
                                        <div style={{ marginTop: '15px' }}>
                                            {section.classBreakdown.map((cls, i) => {
                                                if (!cls.streams || cls.streams.length <= 1) return null;
                                                const sorted = [...cls.streams].sort((a, b) => b.classAverage - a.classAverage);
                                                const maxAvg = Math.max(...sorted.map(s => s.classAverage));
                                                return (
                                                    <div key={i} style={styles.streamCompCard}>
                                                        <h4 style={styles.subTitle}>📈 {cls.className} — Stream Comparison</h4>
                                                        {sorted.map((stream, k) => (
                                                            <div key={k} style={styles.streamBarRow}>
                                                                <div style={styles.streamBarLabel}>{classDisplayName(stream)}</div>
                                                                <div style={styles.streamBarOuter}>
                                                                    <div style={{
                                                                        ...styles.streamBarInner,
                                                                        width: `${(stream.classAverage / maxAvg) * 100}%`,
                                                                        backgroundColor: stream.meetingTarget ? '#28a745' : '#dc3545'
                                                                    }} />
                                                                </div>
                                                                <div style={{ ...styles.streamBarVal, color: stream.meetingTarget ? '#28a745' : '#dc3545' }}>
                                                                    {stream.classAverage}%
                                                                </div>
                                                                <div style={styles.streamBarMeta}>
                                                                    👥 {stream.totalStudents} | 🏆 {stream.topStudent}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📊</div>
                                <p>Select an exam, click <strong>Calculate Ranks</strong>, then click <strong>Generate Report</strong></p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STREAM MERIT LIST TAB ── */}
                {activeTab === 'stream' && (
                    <div>
                        {selectedExam && selectedClass && streamCards.length > 0 && (
                            <div style={styles.printBar}>
                                <span style={styles.printBarInfo}>📋 {classDisplayName(selectedClassObj)} — {streamCards.length} students</span>
                                <OrientationToggle value={streamMeritOrientation} onChange={setStreamMeritOrientation} />
                                <button onClick={handlePrintStreamMerit} style={styles.printBtn}>🖨️ Print Merit List</button>
                            </div>
                        )}
                        {selectedExam && selectedClass && streamCards.length > 0 ? (
                            <div style={styles.meritCard}>
                                <div style={styles.meritHeader}>
                                    <h3 style={styles.meritTitle}>📋 {classDisplayName(selectedClassObj)} — Stream Merit List</h3>
                                    <p style={styles.meritSub}>{selectedExamObj?.examName} | Term {selectedExamObj?.term} {selectedExamObj?.academicYear}</p>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>RANK</th>
                                                <th style={styles.th}>ADM NO</th>
                                                <th style={styles.th}>NAME</th>
                                                {classSubjects.map(sub => (
                                                    <th key={sub.subjectId} style={styles.thSub}>{sub.subjectName}</th>
                                                ))}
                                                <th style={styles.thTotal}>TOTAL</th>
                                                <th style={styles.thTotal}>AVG %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...streamCards].sort((a, b) => (a.classRank || 999) - (b.classRank || 999)).map((card, i) => (
                                                <tr key={card.reportId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={styles.tdC}>
                                                        <strong>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : card.classRank || i + 1}</strong>
                                                    </td>
                                                    <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber}</span></td>
                                                    <td style={styles.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                    {classSubjects.map(sub => (
                                                        <td key={sub.subjectId} style={styles.tdC}>
                                                            {getMark(card.student?.studentId, sub.subjectId)}
                                                        </td>
                                                    ))}
                                                    <td style={styles.tdTotal}><strong>{card.totalMarks}</strong></td>
                                                    <td style={styles.tdTotal}>
                                                        <span style={{
                                                            backgroundColor: card.averageMarks >= 80 ? '#28a745' : card.averageMarks >= 60 ? '#2E75B6' : card.averageMarks >= 40 ? '#ffc107' : '#dc3545',
                                                            color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px'
                                                        }}>
                                                            {card.averageMarks?.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.meritFooter}>
                                    <span>👥 {streamCards.length} students</span>
                                    <span>📊 Avg: {(streamCards.reduce((s, c) => s + (c.averageMarks || 0), 0) / streamCards.length).toFixed(2)}%</span>
                                    <span>🏆 Top: {[...streamCards].sort((a, b) => (a.classRank || 999) - (b.classRank || 999))[0]?.student?.firstName} {[...streamCards].sort((a, b) => (a.classRank || 999) - (b.classRank || 999))[0]?.student?.lastName}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📋</div>
                                <p>{!selectedExam ? 'Select an exam first' : !selectedClass ? 'Select a class' : 'No report cards found. Calculate ranks first.'}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── GRADE MERIT LIST TAB ── */}
                {activeTab === 'grade' && (
                    <div>
                        {/* Grade selector — dedicated to this tab, shows whole grades only */}
                        <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', marginBottom: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <label style={{ ...styles.label, whiteSpace: 'nowrap' }}>🏫 Grade</label>
                            {role === 'TEACHER' ? (
                                <div style={styles.classDisplay}>
                                    🔒 {gradeLabel(selectedGrade)} — All Streams
                                </div>
                            ) : (
                                <select style={{ ...styles.select, minWidth: '220px' }} value={selectedGrade}
                                    onChange={e => setSelectedGrade(e.target.value)}>
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
                            {selectedGrade && (
                                <span style={{ color: '#666', fontSize: '13px' }}>
                                    Combining: {selectedGradeClasses.map(c => classDisplayName(c)).join(', ')}
                                </span>
                            )}
                        </div>

                        {selectedExam && selectedGrade && selectedGradeCards.length > 0 && (
                            <div style={styles.printBar}>
                                <span style={styles.printBarInfo}>🏫 {gradeLabel(selectedGrade)} — All Streams — {selectedGradeCards.length} students</span>
                                <OrientationToggle value={gradeMeritOrientation} onChange={setGradeMeritOrientation} />
                                <button onClick={handlePrintGradeMerit} style={styles.printBtn}>🖨️ Print Grade Merit List</button>
                            </div>
                        )}

                        {selectedExam && selectedGrade && selectedGradeCards.length > 0 ? (
                            <div style={styles.meritCard}>
                                <div style={styles.meritHeader}>
                                    <h3 style={styles.meritTitle}>🏫 {gradeLabel(selectedGrade)} — All Streams Merit List</h3>
                                    <p style={styles.meritSub}>{selectedExamObj?.examName} | Term {selectedExamObj?.term} {selectedExamObj?.academicYear} | {selectedGradeClassNames.join(', ')}</p>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>RANK</th>
                                                <th style={styles.th}>STREAM</th>
                                                <th style={styles.th}>ADM NO</th>
                                                <th style={styles.th}>NAME</th>
                                                {gradeSubjects.map(sub => (
                                                    <th key={sub.subjectId} style={styles.thSub}>{sub.subjectName}</th>
                                                ))}
                                                <th style={styles.thTotal}>TOTAL</th>
                                                <th style={styles.thTotal}>AVG %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...selectedGradeCards].sort((a, b) => (a.termRank || 999) - (b.termRank || 999)).map((card, i) => (
                                                <tr key={card.reportId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={styles.tdC}><strong>{card.termRank || i + 1}</strong></td>
                                                    <td style={styles.tdC}>
                                                        <span style={styles.streamBadge}>{classDisplayName(card.student)}</span>
                                                    </td>
                                                    <td style={styles.td}><span style={styles.admNo}>{card.student?.admissionNumber}</span></td>
                                                    <td style={styles.td}><strong>{card.student?.firstName} {card.student?.lastName}</strong></td>
                                                    {gradeSubjects.map(sub => (
                                                        <td key={sub.subjectId} style={styles.tdC}>
                                                            {getMark(card.student?.studentId, sub.subjectId)}
                                                        </td>
                                                    ))}
                                                    <td style={styles.tdTotal}><strong>{card.totalMarks}</strong></td>
                                                    <td style={styles.tdTotal}>
                                                        <span style={{
                                                            backgroundColor: card.averageMarks >= 80 ? '#28a745' : card.averageMarks >= 60 ? '#2E75B6' : card.averageMarks >= 40 ? '#ffc107' : '#dc3545',
                                                            color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px'
                                                        }}>
                                                            {card.averageMarks?.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.meritFooter}>
                                    <span>👥 {selectedGradeCards.length} students</span>
                                    <span>📊 Avg: {(selectedGradeCards.reduce((s, c) => s + (c.averageMarks || 0), 0) / selectedGradeCards.length).toFixed(2)}%</span>
                                    <span>🏫 {selectedGradeClasses.length} stream{selectedGradeClasses.length !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>🏫</div>
                                <p>{!selectedExam ? 'Select an exam first' : !selectedGrade ? 'Select a grade above' : 'No report cards found for this grade. Calculate ranks first.'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden Print Areas — offscreen not display:none so react-to-print can read them */}
            <div style={{ overflow: 'hidden', height: 0, position: 'fixed', top: 0, left: 0 }}>
                <PrintableSectionReport
                    ref={sectionReportRef}
                    report={report}
                    examName={selectedExamObj?.examName || ''}
                    term={selectedExamObj?.term || ''}
                    year={selectedExamObj?.academicYear || ''}
                />
                <PrintableMeritList
                    ref={streamMeritRef}
                    reportCards={streamCards}
                    results={allResults}
                    subjects={classSubjects}
                    title={`${classDisplayName(selectedClassObj)} STREAM MERIT LIST`}
                    subtitle={`${selectedExamObj?.examName || ''} | Term ${selectedExamObj?.term || ''} ${selectedExamObj?.academicYear || ''}`}
                    level="stream"
                />
                <PrintableMeritList
                    ref={gradeMeritRef}
                    reportCards={selectedGradeCards}
                    results={allResults}
                    subjects={gradeSubjects}
                    title={`${gradeLabel(selectedGrade) || ''} MERIT LIST — ALL STREAMS`}
                    subtitle={`${selectedExamObj?.examName || ''} | Term ${selectedExamObj?.term || ''} ${selectedExamObj?.academicYear || ''} | ${selectedGradeClassNames.join(', ')}`}
                    level="grade"
                />
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: 'clamp(12px, 3vw, 30px)' },
    pageHeader: { marginBottom: '20px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0 },
    error: { color: 'red', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    controlCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    controlGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '15px', alignItems: 'end', marginBottom: '10px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px' },
    classDisplay: { padding: '10px', borderRadius: '5px', border: '2px solid #1F3864', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold', fontSize: '14px' },
    btnCol: { display: 'flex', flexDirection: 'column', gap: '8px' },
    rankBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    reportBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    hint: { color: '#666', fontSize: '13px', fontStyle: 'italic', margin: 0 },

    quickStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' },
    quickStatCard: { backgroundColor: 'white', borderRadius: '10px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
    quickStatName: { fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '4px' },
    quickStatAvg: { fontSize: '28px', fontWeight: 'bold', lineHeight: 1 },
    quickStatMeta: { fontSize: '11px', color: '#999', margin: '4px 0' },
    quickStatBadge: { fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '3px', display: 'inline-block', marginTop: '4px' },

    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    printBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '12px 20px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: '10px' },
    printBarInfo: { color: '#1F3864', fontWeight: 'bold', fontSize: '14px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },

    sectionCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '25px', overflow: 'hidden' },
    sectionHeader: { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
    sectionTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '20px' },
    sectionSub: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '13px' },
    sectionStats: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
    statBox: { textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: '8px' },
    statNum: { color: 'white', fontSize: '22px', fontWeight: 'bold', display: 'block' },
    statLbl: { color: 'rgba(255,255,255,0.8)', fontSize: '11px', display: 'block' },
    targetBadge: { color: 'white', padding: '8px 14px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px' },
    sectionBody: { padding: '20px' },

    subTitle: { color: '#1F3864', margin: '0 0 12px 0', fontSize: '15px' },

    topCard: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' },
    topGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    topItem: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '8px 14px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
    topRank: { width: '28px', height: '28px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 },
    topName: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    topMeta: { fontSize: '12px', color: '#666' },

    streamCompCard: { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' },
    streamBarRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
    streamBarLabel: { width: '60px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864', flexShrink: 0 },
    streamBarOuter: { flex: 1, height: '18px', backgroundColor: '#e9ecef', borderRadius: '9px', overflow: 'hidden' },
    streamBarInner: { height: '100%', borderRadius: '9px', transition: 'width 0.5s ease' },
    streamBarVal: { width: '50px', fontSize: '13px', fontWeight: 'bold', textAlign: 'right', flexShrink: 0 },
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
    admNo: { fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 5px', borderRadius: '3px' },
    streamBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },

    meritCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '20px' },
    meritHeader: { backgroundColor: '#1F3864', padding: '15px 20px' },
    meritTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '18px' },
    meritSub: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    meritFooter: { display: 'flex', gap: '30px', padding: '12px 20px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee', fontWeight: 'bold', color: '#1F3864', fontSize: '13px', flexWrap: 'wrap' },

    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
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