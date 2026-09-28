import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import { gradeInfo } from '../utils/grading';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { schoolName, schoolShortName, schoolMotto, schoolContact, logoLeftUrl, logoRightUrl } from '../utils/school';
import { EXAM_TYPES_LIVE, SECTIONS_LIVE } from '../utils/schoolData';

// ── Bootstrap Icon helper ─────────────────────────────────────────────────────
const Bi = ({ name, style, title }) => (
    <i className={`bi bi-${name}`} aria-hidden="true" title={title} style={{ marginRight: '6px', ...style }} />
);

// Colours shared by the exam badges and the table column headers
// Exam type names and colours from School Settings (the report compares the three core exams)
const EXAM_COLORS = new Proxy(EXAM_TYPES_LIVE, { get: (t, k) => t[k]?.color || '#1F3864' });
const examTypeName = (code) => EXAM_TYPES_LIVE[code]?.label || code;
const MEDAL_COLORS = ['#D4A017', '#9E9E9E', '#CD7F32'];
const PLACE_LABELS = ['1st', '2nd', '3rd'];

// ── Orientation Toggle ────────────────────────────────────────────────────────
const OrientationToggle = ({ value, onChange }) => (
    <span className="no-print" style={{ display: 'flex', gap: '3px' }}>
        {['portrait', 'landscape'].map(o => (
            <button key={o} onClick={() => onChange(o)} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', cursor: 'pointer', border: `1.5px solid ${value === o ? '#1F3864' : '#ccc'}`, background: value === o ? '#1F3864' : 'white', color: value === o ? 'white' : '#666', fontWeight: value === o ? 'bold' : 'normal', textTransform: 'capitalize' }}>{o}</button>
        ))}
    </span>
);

// ── Grade helpers ─────────────────────────────────────────────────────────────
// Grades come from the Grading Scales table (utils/grading)
const getGrade = (marks) => gradeInfo(marks);

// icon = text arrow (used on the printed card), bi = Bootstrap icon (used on screen)
const getTrendIcon = (change) => {
    if (!change || change === '—') return { icon: '—', bi: 'dash', color: '#999' };
    const val = parseFloat(change);
    if (val > 5) return { icon: '↑↑', bi: 'chevron-double-up', color: '#28a745' };
    if (val > 0) return { icon: '↑', bi: 'arrow-up', color: '#28a745' };
    if (val < -5) return { icon: '↓↓', bi: 'chevron-double-down', color: '#dc3545' };
    if (val < 0) return { icon: '↓', bi: 'arrow-down', color: '#dc3545' };
    return { icon: '↔', bi: 'arrow-left-right', color: '#ffc107' };
};

// ── Printable Progressive Report Card ────────────────────────────────────────
const PrintableProgressiveCard = React.forwardRef(({ data, examNames }, ref) => {
    if (!data) return null;
    const { student, subjects, term, academicYear } = data;

    const totalChange = subjects.reduce((sum, sub) => {
        const c = parseFloat(sub.change);
        return sum + (isNaN(c) ? 0 : c);
    }, 0);
    const avgChange = subjects.length > 0 ? (totalChange / subjects.length).toFixed(1) : 0;

    return (
        <div ref={ref} style={{ padding: '15px', fontFamily: "'Times New Roman', Times, serif", fontSize: '12px', color: '#000' }}>
            {/* Header */}
            <div style={{ borderBottom: '3px solid #1F3864', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <img src={logoLeftUrl()} alt="" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
                    <div style={{ textAlign: 'center', flex: 1, padding: '0 10px' }}>
                        <div style={{ color: '#1F3864', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {schoolName()}
                        </div>
                        <div style={{ color: '#2E75B6', fontStyle: 'italic', fontSize: '11px', margin: '2px 0' }}>
                            {schoolMotto()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                            {schoolContact()}
                        </div>
                    </div>
                    <img src={logoRightUrl()} alt="Logo" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
                </div>
                <div style={{ backgroundColor: '#1F3864', padding: '5px 10px', textAlign: 'center' }}>
                    <div style={{ color: 'white', fontWeight: 'bold', fontSize: '13px' }}>PROGRESSIVE PERFORMANCE REPORT</div>
                    <div style={{ color: '#BDD7EE', fontSize: '11px' }}>Term {term} — {academicYear}</div>
                </div>
            </div>

            {/* Student Info */}
            <div style={{ backgroundColor: '#f8f9fa', padding: '10px 15px', marginBottom: '10px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '5px' }}>
                    <span><strong>Name:</strong> {student?.firstName} {student?.lastName}</span>
                    <span><strong>Adm No:</strong> {student?.admissionNumber}</span>
                    <span><strong>Class:</strong> {classDisplayName({ className: student?.schoolClass?.className || student?.className, stream: student?.schoolClass?.stream || student?.stream })}</span>
                </div>
            </div>

            {/* Progressive Marks Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#1F3864' }}>
                        <th style={{ color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: '11px' }}>SUBJECT</th>
                        <th style={{ color: '#FFD700', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>{examNames.OPENING || examTypeName('OPENING')}</th>
                        <th style={{ color: '#FFD700', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>{examNames.MID_TERM || examTypeName('MID_TERM')}</th>
                        <th style={{ color: '#FFD700', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>{examNames.END_TERM || examTypeName('END_TERM')}</th>
                        <th style={{ color: 'white', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>CHANGE</th>
                        <th style={{ color: 'white', padding: '6px 8px', textAlign: 'center', fontSize: '11px' }}>TREND</th>
                    </tr>
                </thead>
                <tbody>
                    {subjects.map((sub, i) => {
                        const trend = getTrendIcon(sub.change);
                        const openGrade = getGrade(sub.opening);
                        const midGrade = getGrade(sub.midTerm);
                        const endGrade = getGrade(sub.endTerm);
                        return (
                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', fontWeight: 'bold', fontSize: '11px' }}>
                                    {sub.subjectName}
                                </td>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                                    {sub.opening !== null && sub.opening !== undefined ? (
                                        <span>
                                            <strong style={{ color: openGrade.color }}>{sub.opening}</strong>
                                            <span style={{ fontSize: '9px', marginLeft: '3px', color: openGrade.color }}>({openGrade.label})</span>
                                        </span>
                                    ) : <span style={{ color: '#ccc' }}>—</span>}
                                </td>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                                    {sub.midTerm !== null && sub.midTerm !== undefined ? (
                                        <span>
                                            <strong style={{ color: midGrade.color }}>{sub.midTerm}</strong>
                                            <span style={{ fontSize: '9px', marginLeft: '3px', color: midGrade.color }}>({midGrade.label})</span>
                                        </span>
                                    ) : <span style={{ color: '#ccc' }}>—</span>}
                                </td>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                                    {sub.endTerm !== null && sub.endTerm !== undefined ? (
                                        <span>
                                            <strong style={{ color: endGrade.color }}>{sub.endTerm}</strong>
                                            <span style={{ fontSize: '9px', marginLeft: '3px', color: endGrade.color }}>({endGrade.label})</span>
                                        </span>
                                    ) : <span style={{ color: '#ccc' }}>—</span>}
                                </td>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: trend.color }}>
                                    {sub.change}
                                </td>
                                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: trend.color }}>
                                    {trend.icon}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Overall summary */}
            <div style={{ display: 'flex', gap: '15px', padding: '8px 12px', backgroundColor: '#1F3864', borderRadius: '4px', marginBottom: '12px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#FFD700', fontSize: '11px' }}>Overall Change</div>
                    <div style={{ color: parseFloat(avgChange) >= 0 ? '#90EE90' : '#ff6b6b', fontSize: '20px', fontWeight: 'bold' }}>
                        {parseFloat(avgChange) >= 0 ? '+' : ''}{avgChange} pts
                    </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#FFD700', fontSize: '11px' }}>Subjects Improved</div>
                    <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
                        {subjects.filter(s => parseFloat(s.change) > 0).length}/{subjects.length}
                    </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: '#FFD700', fontSize: '11px' }}>Overall Trend</div>
                    <div style={{ color: parseFloat(avgChange) >= 0 ? '#90EE90' : '#ff6b6b', fontSize: '20px', fontWeight: 'bold' }}>
                        {parseFloat(avgChange) > 2 ? '↑↑' : parseFloat(avgChange) > 0 ? '↑' : parseFloat(avgChange) < -2 ? '↓↓' : parseFloat(avgChange) < 0 ? '↓' : '↔'}
                    </div>
                </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', gap: '30px', marginTop: '15px', borderTop: '2px solid #1F3864', paddingTop: '10px' }}>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '11px', margin: '0 0 6px 0' }}>Class Teacher: _________________________</p>
                    <p style={{ fontSize: '11px', margin: 0 }}>Signature: _____________ Date: __________</p>
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '11px', margin: '0 0 6px 0' }}>Principal: _________________________</p>
                    <p style={{ fontSize: '11px', margin: 0 }}>Signature: _____________ Date: __________</p>
                </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: '10px', color: '#999', marginTop: '8px' }}>
                {schoolShortName()} — Progressive Report — {new Date().toLocaleDateString()}
            </p>
        </div>
    );
});

// ── Main Component ────────────────────────────────────────────────────────────
function ProgressiveReport() {
    useSchoolSettings();   // re-draws when the grading scale (database) has loaded
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [studentQuery, setStudentQuery] = useState('');
    const [progressiveData, setProgressiveData] = useState(null);
    const [improvedStudents, setImprovedStudents] = useState([]);
    const [improvedLoaded, setImprovedLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingImproved, setLoadingImproved] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('student');
    const [examNames, setExamNames] = useState({});

    const printRef = useRef();
    const [printOrientation, setPrintOrientation] = useState('portrait');
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Progressive_Report_${progressiveData?.student?.firstName || ''}_${progressiveData?.student?.lastName || ''}_T${progressiveData?.term || ''}_${progressiveData?.academicYear || ''}`,
        pageStyle: `@page { size: A4 ${printOrientation}; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`
    });

    const sections = SECTIONS_LIVE;   // from School Settings

    useEffect(() => { fetchExams(); fetchClasses(); fetchStudents(); }, []);

    // If the current year has no exams, default to the latest year that does
    useEffect(() => {
        if (exams.length === 0) return;
        const years = [...new Set(exams.map(e => String(e.academicYear)))].sort().reverse();
        if (!years.includes(String(selectedYear))) setSelectedYear(years[0]);
    }, [exams]);

    useEffect(() => {
        if (selectedTerm && selectedYear) {
            // Build exam names map for this term
            const termExams = exams.filter(e =>
                String(e.term) === String(selectedTerm) &&
                String(e.academicYear) === String(selectedYear)
            );
            const names = {};
            termExams.forEach(e => { if (e.examType) names[e.examType] = e.examName; });
            setExamNames(names);
        } else {
            setExamNames({});
        }
    }, [selectedTerm, selectedYear, exams]);

    // Clear results that no longer match the selections, so stale reports never show
    useEffect(() => {
        setProgressiveData(null);
        setImprovedStudents([]);
        setImprovedLoaded(false);
        setError('');
    }, [selectedYear, selectedTerm, selectedClass]);

    useEffect(() => { setSelectedStudent(''); setStudentQuery(''); }, [selectedClass]);
    useEffect(() => { setProgressiveData(null); }, [selectedStudent]);

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {}
    };

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {}
    };

    const fetchStudents = async () => {
        try { const r = await api.get('/api/students'); setStudents(r.data); } catch (e) {}
    };

    const handleViewStudent = async () => {
        if (!selectedStudent || !selectedTerm || !selectedYear) {
            setError('Please select term, year and student'); return;
        }
        setLoading(true); setError(''); setProgressiveData(null);
        try {
            const r = await api.get(`/api/results/progressive/student/${selectedStudent}/term/${selectedTerm}/year/${selectedYear}`);
            setProgressiveData(r.data);
        } catch (e) { setError('No progressive data found. Make sure results exist for multiple exams in this term.'); }
        setLoading(false);
    };

    const handleViewMostImproved = async () => {
        if (!selectedClass || !selectedTerm || !selectedYear) {
            setError('Please select term, year and class'); return;
        }
        const cls = classes.find(c => String(c.classId) === String(selectedClass));
        if (!cls) return;
        setLoadingImproved(true); setError('');
        try {
            const r = await api.get(`/api/results/progressive/class/${encodeURIComponent(cls.className)}/term/${selectedTerm}/year/${selectedYear}/improvements`);
            setImprovedStudents(r.data || []);
            setImprovedLoaded(true);
        } catch (e) { setError('Failed to load improvement data.'); }
        setLoadingImproved(false);
    };

    // Sorted copy — never sort the state array itself
    const classStudents = (selectedClass
        ? students.filter(s => String(s.schoolClass?.classId) === String(selectedClass))
        : students
    ).slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    const matchStudents = (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return classStudents;
        return classStudents.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
            `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) ||
            String(s.admissionNumber || '').toLowerCase().includes(q)
        );
    };
    const studentOptions = matchStudents(studentQuery);

    const handleStudentQueryChange = (value) => {
        setStudentQuery(value);
        const matches = matchStudents(value);
        // Exactly one match: pick that student automatically
        if (value.trim() && matches.length === 1) setSelectedStudent(String(matches[0].studentId));
    };

    const availableYears = [...new Set(exams.map(e => String(e.academicYear)))].sort().reverse();
    const availableTerms = [...new Set(exams
        .filter(e => String(e.academicYear) === String(selectedYear))
        .map(e => String(e.term)))].sort();

    const selectedClassObj = classes.find(c => String(c.classId) === String(selectedClass));

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <h2 style={styles.title}><Bi name="graph-up-arrow" style={{ marginRight: '10px' }} />Progressive Performance Report</h2>
                <p style={styles.subtitle}>Track student performance across Opening, Mid Term and End Term exams</p>

                {error && <div style={styles.error} role="alert"><Bi name="exclamation-triangle-fill" />{error}</div>}

                {/* Controls */}
                <div style={styles.controlCard}>
                    <div style={styles.controlGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="calendar3" />Academic Year</label>
                            <select style={styles.select} value={selectedYear}
                                onChange={e => { setSelectedYear(e.target.value); setSelectedTerm(''); }}>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="journals" />Term</label>
                            <select style={styles.select} value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
                                <option value="">-- Select Term --</option>
                                {availableTerms.map(t => <option key={t} value={t}>Term {t}</option>)}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}><Bi name="building" />Class</label>
                            <select style={styles.select} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                <option value="">-- Select Class --</option>
                                {sections.map(sec => (
                                    <optgroup key={sec.value} label={sec.label}>
                                        {classes.filter(c => c.section === sec.value).map(cls => (
                                            <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Exam types info */}
                    {Object.keys(examNames).length > 0 && (
                        <div style={styles.examBadges}>
                            {Object.entries(examNames).map(([type, name]) => (
                                <span key={type} style={styles.examBadge}>
                                    <Bi name="circle-fill" style={{ color: EXAM_COLORS[type] || '#2E75B6', fontSize: '9px' }} />{name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button onClick={() => setActiveTab('student')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'student' ? '#1F3864' : 'white',
                        color: activeTab === 'student' ? 'white' : '#1F3864'
                    }}><Bi name="person-fill" />Student Report</button>
                    <button onClick={() => setActiveTab('improved')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'improved' ? '#1F3864' : 'white',
                        color: activeTab === 'improved' ? 'white' : '#1F3864'
                    }}><Bi name="trophy-fill" />Most Improved</button>
                </div>

                {/* ── Student Tab ── */}
                {activeTab === 'student' && (
                    <div>
                        <div style={styles.studentSelector}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}><Bi name="search" />Find Student</label>
                                <div style={styles.searchBox}>
                                    <input
                                        type="text"
                                        value={studentQuery}
                                        onChange={e => handleStudentQueryChange(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && selectedStudent) { e.preventDefault(); handleViewStudent(); } }}
                                        placeholder="Name or admission no."
                                        style={styles.searchInput}
                                    />
                                    {studentQuery && (
                                        <button onClick={() => setStudentQuery('')} style={styles.searchClear} title="Clear search">
                                            <Bi name="x-lg" style={{ marginRight: 0 }} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>
                                    <Bi name="person-fill" />Student
                                    {studentQuery && <span style={styles.matchCount}> ({studentOptions.length} match{studentOptions.length === 1 ? '' : 'es'})</span>}
                                </label>
                                <select style={{ ...styles.select, minWidth: '260px' }} value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                                    <option value="">-- Select Student --</option>
                                    {studentOptions.map(s => (
                                        <option key={s.studentId} value={String(s.studentId)}>
                                            {s.firstName} {s.lastName} ({s.admissionNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleViewStudent} style={styles.viewBtn} disabled={loading}>
                                {loading
                                    ? <><Bi name="hourglass-split" />Loading...</>
                                    : <><Bi name="graph-up-arrow" />View Progressive Report</>}
                            </button>
                        </div>

                        {progressiveData && (
                            <div style={styles.reportCard}>
                                {/* Print button */}
                                <div style={styles.printBar}>
                                    <span style={styles.printBarInfo}>
                                        <Bi name="graph-up-arrow" />{progressiveData.student?.firstName} {progressiveData.student?.lastName} — Term {progressiveData.term} {progressiveData.academicYear}
                                    </span>
                                    <OrientationToggle value={printOrientation} onChange={setPrintOrientation} />
                                    <button onClick={handlePrint} style={styles.printBtn}><Bi name="printer-fill" />Print Report</button>
                                </div>

                                {/* Student header */}
                                <div style={styles.studentHeader}>
                                    <div style={styles.studentAvatar}>
                                        {progressiveData.student?.firstName?.charAt(0)}{progressiveData.student?.lastName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 style={styles.studentName}>
                                            {progressiveData.student?.firstName} {progressiveData.student?.lastName}
                                        </h3>
                                        <p style={styles.studentMeta}>
                                            {progressiveData.student?.admissionNumber} •{' '}
                                            {classDisplayName({ className: progressiveData.student?.schoolClass?.className || progressiveData.student?.className, stream: progressiveData.student?.schoolClass?.stream || progressiveData.student?.stream })} •{' '}
                                            Term {progressiveData.term} {progressiveData.academicYear}
                                        </p>
                                    </div>
                                </div>

                                {/* Progressive table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>Subject</th>
                                                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: EXAM_COLORS.OPENING }}>
                                                    {examNames.OPENING || examTypeName('OPENING')}
                                                </th>
                                                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: EXAM_COLORS.MID_TERM }}>
                                                    {examNames.MID_TERM || examTypeName('MID_TERM')}
                                                </th>
                                                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: EXAM_COLORS.END_TERM }}>
                                                    {examNames.END_TERM || examTypeName('END_TERM')}
                                                </th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Change</th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Trend</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {progressiveData.subjects?.map((sub, i) => {
                                                const trend = getTrendIcon(sub.change);
                                                const openGrade = getGrade(sub.opening);
                                                const midGrade = getGrade(sub.midTerm);
                                                const endGrade = getGrade(sub.endTerm);
                                                return (
                                                    <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={{ ...styles.td, fontWeight: 'bold' }}>{sub.subjectName}</td>
                                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                                            {sub.opening !== null && sub.opening !== undefined ? (
                                                                <div style={styles.markCell}>
                                                                    <span style={{ ...styles.markNum, color: openGrade.color }}>{sub.opening}</span>
                                                                    <span style={{ ...styles.gradeTag, backgroundColor: openGrade.color }}>{openGrade.label}</span>
                                                                </div>
                                                            ) : <span style={styles.noMark}>—</span>}
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                                            {sub.midTerm !== null && sub.midTerm !== undefined ? (
                                                                <div style={styles.markCell}>
                                                                    <span style={{ ...styles.markNum, color: midGrade.color }}>{sub.midTerm}</span>
                                                                    <span style={{ ...styles.gradeTag, backgroundColor: midGrade.color }}>{midGrade.label}</span>
                                                                </div>
                                                            ) : <span style={styles.noMark}>—</span>}
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                                            {sub.endTerm !== null && sub.endTerm !== undefined ? (
                                                                <div style={styles.markCell}>
                                                                    <span style={{ ...styles.markNum, color: endGrade.color }}>{sub.endTerm}</span>
                                                                    <span style={{ ...styles.gradeTag, backgroundColor: endGrade.color }}>{endGrade.label}</span>
                                                                </div>
                                                            ) : <span style={styles.noMark}>—</span>}
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: trend.color }}>
                                                            {sub.change}
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center', fontSize: '18px', color: trend.color }}>
                                                            <Bi name={trend.bi} style={{ marginRight: 0 }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Overall performance summary */}
                                {(() => {
                                    const subjects = progressiveData.subjects || [];
                                    const totalChange = subjects.reduce((s, sub) => s + (parseFloat(sub.change) || 0), 0);
                                    const avgChange = subjects.length > 0 ? (totalChange / subjects.length).toFixed(1) : 0;
                                    const improved = subjects.filter(s => parseFloat(s.change) > 0).length;
                                    const declined = subjects.filter(s => parseFloat(s.change) < 0).length;
                                    const stable = subjects.filter(s => parseFloat(s.change) === 0 || s.change === '—').length;
                                    return (
                                        <div style={styles.summaryBar}>
                                            <div style={styles.summaryItem}>
                                                <span style={{ ...styles.summaryNum, color: parseFloat(avgChange) >= 0 ? '#28a745' : '#dc3545' }}>
                                                    {parseFloat(avgChange) >= 0 ? '+' : ''}{avgChange}
                                                </span>
                                                <span style={styles.summaryLabel}>Avg Change</span>
                                            </div>
                                            <div style={styles.summaryDivider} />
                                            <div style={styles.summaryItem}>
                                                <span style={{ ...styles.summaryNum, color: '#28a745' }}>{improved}</span>
                                                <span style={styles.summaryLabel}><Bi name="arrow-up" style={{ marginRight: '3px', color: '#28a745' }} />Improved</span>
                                            </div>
                                            <div style={styles.summaryDivider} />
                                            <div style={styles.summaryItem}>
                                                <span style={{ ...styles.summaryNum, color: '#dc3545' }}>{declined}</span>
                                                <span style={styles.summaryLabel}><Bi name="arrow-down" style={{ marginRight: '3px', color: '#dc3545' }} />Declined</span>
                                            </div>
                                            <div style={styles.summaryDivider} />
                                            <div style={styles.summaryItem}>
                                                <span style={{ ...styles.summaryNum, color: '#ffc107' }}>{stable}</span>
                                                <span style={styles.summaryLabel}><Bi name="arrow-left-right" style={{ marginRight: '3px', color: '#ffc107' }} />Stable</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {!progressiveData && !loading && (
                            <div style={styles.emptyState}>
                                <Bi name="graph-up-arrow" style={{ ...styles.emptyIcon, marginRight: 0 }} />
                                <p>Select a term, class and student then click View Progressive Report</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Most Improved Tab ── */}
                {activeTab === 'improved' && (
                    <div>
                        <div style={styles.studentSelector}>
                            <button onClick={handleViewMostImproved} style={styles.viewBtn} disabled={loadingImproved}>
                                {loadingImproved
                                    ? <><Bi name="hourglass-split" />Loading...</>
                                    : <><Bi name="trophy-fill" />View Most Improved</>}
                            </button>
                        </div>

                        {improvedStudents.length > 0 && (
                            <div style={styles.reportCard}>
                                <div style={styles.printBar}>
                                    <span style={styles.printBarInfo}>
                                        <Bi name="trophy-fill" style={{ color: MEDAL_COLORS[0] }} />Most Improved Students — {selectedClassObj ? classDisplayName(selectedClassObj) : ''} — Term {selectedTerm} {selectedYear}
                                    </span>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>Rank</th>
                                                <th style={styles.th}>Student</th>
                                                <th style={styles.th}>Adm No</th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Opening Avg</th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Latest Avg</th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Improvement</th>
                                                <th style={{ ...styles.th, textAlign: 'center' }}>Trend</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {improvedStudents.map((s, i) => {
                                                const trend = getTrendIcon(s.improvement);
                                                const isTopImproved = i < 3 && parseFloat(s.improvement) > 0;
                                                return (
                                                    <tr key={i} style={{
                                                        ...(i % 2 === 0 ? styles.trEven : styles.trOdd),
                                                        ...(isTopImproved ? { backgroundColor: '#f0fff4' } : {})
                                                    }}>
                                                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                            {i < 3
                                                                ? <><Bi name="trophy-fill" style={{ color: MEDAL_COLORS[i], fontSize: '16px', marginRight: '4px' }} title={`${PLACE_LABELS[i]} place`} />{i + 1}</>
                                                                : i + 1}
                                                        </td>
                                                        <td style={styles.td}><strong>{s.studentName}</strong></td>
                                                        <td style={styles.td}><span style={styles.admNo}>{s.admissionNumber}</span></td>
                                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                                            <span style={{ color: getGrade(parseFloat(s.openingAvg)).color, fontWeight: 'bold' }}>
                                                                {s.openingAvg}%
                                                            </span>
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                                            <span style={{ color: getGrade(parseFloat(s.latestAvg)).color, fontWeight: 'bold' }}>
                                                                {s.latestAvg}%
                                                            </span>
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: trend.color }}>
                                                            {s.improvement} pts
                                                        </td>
                                                        <td style={{ ...styles.td, textAlign: 'center', fontSize: '18px', color: trend.color }}>
                                                            <Bi name={trend.bi} style={{ marginRight: 0 }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Top 3 highlight */}
                                <div style={styles.topThree}>
                                    <h4 style={{ color: '#1F3864', margin: '0 0 12px 0', fontWeight: 800 }}>
                                        <Bi name="trophy-fill" style={{ color: MEDAL_COLORS[0] }} />Top 3 Most Improved
                                    </h4>
                                    <div style={styles.podium}>
                                        {improvedStudents.slice(0, 3).map((s, i) => (
                                            <div key={i} style={{
                                                ...styles.podiumItem,
                                                backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32',
                                                order: i === 0 ? 2 : i === 1 ? 1 : 3,
                                                paddingTop: i === 0 ? '20px' : '12px'
                                            }}>
                                                <div style={styles.podiumRank}>
                                                    <Bi name="trophy-fill" style={{ marginRight: 0 }} />
                                                    <div style={styles.podiumPlace}>{PLACE_LABELS[i]}</div>
                                                </div>
                                                <div style={styles.podiumName}>{(s.studentName || '').split(' ')[0]}</div>
                                                <div style={styles.podiumScore}>{s.improvement} pts</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {improvedStudents.length === 0 && !loadingImproved && (
                            <div style={styles.emptyState}>
                                <Bi name={improvedLoaded ? 'info-circle' : 'trophy'} style={{ ...styles.emptyIcon, marginRight: 0 }} />
                                {improvedLoaded ? (
                                    <>
                                        <p>No improvement data for {selectedClassObj ? classDisplayName(selectedClassObj) : 'this class'} in Term {selectedTerm} {selectedYear}.</p>
                                        <p style={{ fontSize: '13px', color: '#888' }}>Check that marks have been entered for at least 2 exams this term.</p>
                                    </>
                                ) : (
                                    <>
                                        <p>Select term, year and class then click View Most Improved</p>
                                        <p style={{ fontSize: '13px', color: '#888' }}>Requires results for at least 2 exams (Opening + Mid Term or End Term)</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden print area */}
            <div style={{ display: 'none' }}>
                <PrintableProgressiveCard ref={printRef} data={progressiveData} examNames={examNames} />
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
    subtitle: { color: '#666', margin: '0 0 20px 0' },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    controlCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    controlGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '10px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 700, color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    examBadges: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' },
    examBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 700, fontSize: '14px', transition: 'all 0.15s ease' },
    studentSelector: { display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' },
    searchBox: { display: 'flex', alignItems: 'center', border: '2px solid #ddd', borderRadius: '8px', backgroundColor: 'white', minWidth: '220px' },
    searchInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px', fontSize: '16px', backgroundColor: 'transparent', borderRadius: '8px' },
    searchClear: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '4px 10px', fontSize: '13px' },
    matchCount: { fontWeight: 500, color: '#888' },
    viewBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', transition: 'transform 0.15s ease, box-shadow 0.15s ease', boxShadow: '0 2px 6px rgba(31,56,100,0.25)' },
    reportCard: { backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '20px' },
    printBar: { backgroundColor: '#1F3864', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    printBarInfo: { color: 'white', fontWeight: 700, fontSize: '14px' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'transform 0.15s ease' },
    studentHeader: { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px', borderBottom: '1px solid #eee' },
    studentAvatar: { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#1F3864', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 },
    studentName: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800 },
    studentMeta: { color: '#666', margin: 0, fontSize: '13px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
    td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#fafafa' },
    trOdd: { backgroundColor: 'white' },
    markCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    markNum: { fontSize: '16px', fontWeight: 700 },
    gradeTag: { color: 'white', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 },
    noMark: { color: '#ccc', fontSize: '16px' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' },
    summaryBar: { display: 'flex', alignItems: 'center', gap: '20px', padding: '15px 20px', backgroundColor: '#f8f9fa', borderTop: '2px solid #eee', flexWrap: 'wrap' },
    summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px' },
    summaryNum: { fontSize: '28px', fontWeight: 800, lineHeight: 1 },
    summaryLabel: { fontSize: '11px', color: '#888', marginTop: '3px', display: 'inline-flex', alignItems: 'center' },
    summaryDivider: { width: '1px', height: '40px', backgroundColor: '#eee' },
    topThree: { padding: '20px', borderTop: '1px solid #eee' },
    podium: { display: 'flex', gap: '10px', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' },
    podiumItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', borderRadius: '10px', minWidth: '100px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    podiumRank: { fontSize: '22px', marginBottom: '5px', color: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    podiumPlace: { fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' },
    podiumName: { fontWeight: 700, color: '#333', fontSize: '13px', textAlign: 'center' },
    podiumScore: { fontSize: '12px', color: '#555', marginTop: '3px' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px', display: 'inline-block', color: '#BDD7EE' },
};

export default ProgressiveReport;
