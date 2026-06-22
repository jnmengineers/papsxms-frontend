import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

// ── Printable Results Report ──────────────────────────────────────────────────
const PrintableResultsReport = React.forwardRef(({ students, subjects, pivotData, className, examName, academicYear, term, getGradeLabel, getMarkColor, getGradeColor }, ref) => {
    const rankedStudents = [...students].sort((a, b) => {
        const totalA = subjects.reduce((sum, sub) => sum + (pivotData[a.studentId]?.[sub.id]?.marksObtained || 0), 0);
        const totalB = subjects.reduce((sum, sub) => sum + (pivotData[b.studentId]?.[sub.id]?.marksObtained || 0), 0);
        return totalB - totalA;
    });

    const getStudentTotal = (studentId) =>
        subjects.reduce((sum, sub) => sum + (pivotData[studentId]?.[sub.id]?.marksObtained || 0), 0);

    const getStudentAvg = (studentId) => {
        const results = subjects.map(sub => pivotData[studentId]?.[sub.id]).filter(Boolean);
        if (!results.length) return 0;
        return results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length;
    };

    const getSubjectTotal = (subjectId) =>
        students.reduce((sum, s) => sum + (pivotData[s.studentId]?.[subjectId]?.marksObtained || 0), 0);

    const getSubjectMean = (subjectId) => {
        const results = students.map(s => pivotData[s.studentId]?.[subjectId]).filter(Boolean);
        if (!results.length) return '-';
        return (results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length).toFixed(1);
    };

    // Short code for subject headers
    const getSubjectCode = (name) => {
        const codes = {
            'mathematics': 'MTH', 'maths': 'MTH', 'math': 'MTH',
            'english': 'ENG', 'kiswahili': 'KSW', 'swahili': 'KSW',
            'science': 'SCI', 'science & technology': 'S&T',
            'integrated science': 'I.SCI',
            'social studies': 'SST', 'social': 'SST',
            'creative activities': 'CRE.A', 'creative arts': 'CRE.A',
            'creative': 'CRE',
            'environmental': 'ENV',
            'religious': 'CRE', 'cre': 'CRE',
            'agriculture': 'AGRI', 'agric': 'AGRI',
            'agric & nutrition': 'AGR', 'agriculture & nutrition': 'AGR',
            'literacy': 'LIT', 'language': 'LANG',
            'number work': 'NUM', 'integrated': 'INT',
            'pre-technical': 'P.TEC', 'pre technical': 'P.TEC',
        };
        const lower = name.toLowerCase().trim();
        if (codes[lower]) return codes[lower];
        // Auto-shorten: take first 3 chars of each word
        const words = name.split(/[\s&]+/).filter(Boolean);
        if (words.length === 1) return name.substring(0, 4).toUpperCase();
        return words.map(w => w.substring(0, 3).toUpperCase()).join('.');
    };

    // Subject rank by mean descending
    const subjectMeans = subjects.map(sub => ({
        id: sub.id,
        mean: parseFloat(getSubjectMean(sub.id)) || 0
    }));
    const sortedByMean = [...subjectMeans].sort((a, b) => b.mean - a.mean);
    const subjectRanks = {};
    sortedByMean.forEach((s, i) => { subjectRanks[s.id] = i + 1; });

    return (
        <div ref={ref} style={pStyles.page}>
            {/* School Header */}
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
                <div style={pStyles.banner}>
                    <h2 style={pStyles.bannerTitle}>CLASS RESULTS REPORT</h2>
                    <p style={pStyles.bannerSub}>{className} | {examName} | Term {term} {academicYear}</p>
                </div>
            </div>

            {/* Results Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={pStyles.table}>
                    <thead>
                        <tr style={pStyles.thead}>
                            <th style={pStyles.thRank}>RANK</th>
                            <th style={pStyles.thAdm}>ADM NO</th>
                            <th style={pStyles.thName}>STUDENT NAME</th>
                            {subjects.map(sub => (
                                <th key={sub.id} style={pStyles.thSub}>
                                    <div style={pStyles.rotated}>{getSubjectCode(sub.name)}</div>
                                </th>
                            ))}
                            <th style={pStyles.thTotal}>TOTAL</th>
                            <th style={pStyles.thTotal}>AVG%</th>
                            <th style={pStyles.thTotal}>GRD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rankedStudents.map((student, index) => {
                            const total = getStudentTotal(student.studentId);
                            const avg = getStudentAvg(student.studentId);
                            const grade = getGradeLabel(avg);
                            return (
                                <tr key={student.studentId} style={index % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                                    <td style={pStyles.tdC}>
                                        <strong>{index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : index + 1}</strong>
                                    </td>
                                    <td style={pStyles.td}>{student.admissionNumber}</td>
                                    <td style={pStyles.tdName}><strong>{student.firstName} {student.lastName}</strong></td>
                                    {subjects.map(sub => {
                                        const result = pivotData[student.studentId]?.[sub.id];
                                        return (
                                            <td key={sub.id} style={pStyles.tdC}>
                                                {result ? result.marksObtained : '—'}
                                            </td>
                                        );
                                    })}
                                    <td style={pStyles.tdTotal}><strong>{total.toFixed(0)}</strong></td>
                                    <td style={pStyles.tdTotal}><strong>{avg.toFixed(1)}%</strong></td>
                                    <td style={pStyles.tdTotal}><strong>{grade}</strong></td>
                                </tr>
                            );
                        })}
                        {/* Subject totals row */}
                        <tr style={pStyles.totalRow}>
                            <td colSpan="3" style={{ ...pStyles.td, fontWeight: 'bold', fontSize: '9px' }}>📊 SUBJECT TOTAL</td>
                            {subjects.map(sub => (
                                <td key={sub.id} style={{ ...pStyles.tdC, fontWeight: 'bold' }}>
                                    {getSubjectTotal(sub.id)}
                                </td>
                            ))}
                            <td colSpan="3" style={pStyles.td} />
                        </tr>
                        {/* Subject mean row */}
                        <tr style={pStyles.meanRow}>
                            <td colSpan="3" style={{ ...pStyles.td, fontWeight: 'bold', fontSize: '9px' }}>📈 SUBJECT MEAN</td>
                            {subjects.map(sub => (
                                <td key={sub.id} style={{ ...pStyles.tdC, fontWeight: 'bold' }}>
                                    {getSubjectMean(sub.id)}
                                </td>
                            ))}
                            <td colSpan="3" style={pStyles.td} />
                        </tr>
                        {/* Subject rank row */}
                        <tr style={pStyles.rankRow}>
                            <td colSpan="3" style={{ ...pStyles.td, fontWeight: 'bold', fontSize: '9px', color: '#6f42c1' }}>🏆 SUBJECT RANK</td>
                            {subjects.map(sub => {
                                const rank = subjectRanks[sub.id];
                                return (
                                    <td key={sub.id} style={{ ...pStyles.tdC, fontWeight: 'bold' }}>
                                        #{rank}
                                    </td>
                                );
                            })}
                            <td colSpan="3" style={pStyles.td} />
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div style={pStyles.summary}>
                <div style={pStyles.summaryItem}>
                    <strong>Total Students:</strong> {students.length}
                </div>
                <div style={pStyles.summaryItem}>
                    <strong>Class Average:</strong> {students.length > 0 ? (students.reduce((sum, s) => sum + getStudentAvg(s.studentId), 0) / students.length).toFixed(2) : 0}%
                </div>
                <div style={pStyles.summaryItem}>
                    <strong>Top Student:</strong> {rankedStudents[0] ? `${rankedStudents[0].firstName} ${rankedStudents[0].lastName} (${getStudentAvg(rankedStudents[0].studentId).toFixed(1)}%)` : '-'}
                </div>
                <div style={pStyles.summaryItem}>
                    <strong>Date Printed:</strong> {new Date().toLocaleDateString()}
                </div>
            </div>

            {/* Footer */}
            <div style={pStyles.footer}>
                <div style={pStyles.sigBox}>
                    <p style={pStyles.sig}>Class Teacher: _________________________</p>
                    <p style={pStyles.sig}>Signature: _____________ Date: __________</p>
                </div>
                <div style={pStyles.sigBox}>
                    <p style={pStyles.sig}>Principal: _________________________</p>
                    <p style={pStyles.sig}>Signature: _____________ Date: __________</p>
                </div>
            </div>
            <p style={pStyles.footerNote}>Pipeline Adventist School — Official Class Results Report — {new Date().toLocaleDateString()}</p>
        </div>
    );
});

function Results() {
    const printRef = useRef();

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [searched, setSearched] = useState(false);
    const [filterExam, setFilterExam] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [search, setSearch] = useState('');
    const [step, setStep] = useState(1); // 1=select exam, 2=select class tiles, 3=view results
    const [populatedClasses, setPopulatedClasses] = useState([]); // classes with results for selected exam
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [allExamResults, setAllExamResults] = useState([]); // cached results for selected exam

    // Pivot data
    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Results_${filterClass}_${filterExam}`
    });

    useEffect(() => {
        fetchExams();
        fetchClasses();
    }, []);

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const handleSelectExam = async (examId) => {
        setFilterExam(examId);
        setFilterClass('');
        setSearched(false);
        setResults([]);
        setPivotStudents([]); setPivotSubjects([]); setPivotData({});
        if (!examId) { setStep(1); setPopulatedClasses([]); return; }

        // Fetch results once — reused for class tiles and results table
        setLoadingClasses(true);
        try {
            const response = await api.get('/api/results');
            const data = response.data.filter(r => String(r.exam?.examId) === String(examId));
            setAllExamResults(data); // cache for reuse

            // Count students per class
            const classMap = {};
            data.forEach(r => {
                const cls = r.student?.className;
                const classId = r.student?.schoolClass?.classId;
                if (cls) {
                    const key = classId || cls;
                    if (!classMap[key]) {
                        classMap[key] = {
                            className: cls,
                            classId: classId,
                            studentIds: new Set(),
                            subjectIds: new Set(),
                            section: r.student?.schoolClass?.section || ''
                        };
                    }
                    if (r.student?.studentId) classMap[key].studentIds.add(r.student.studentId);
                    if (r.subject?.subjectId) classMap[key].subjectIds.add(r.subject.subjectId);
                }
            });

            const populated = Object.values(classMap).map(c => ({
                ...c,
                studentCount: c.studentIds.size,
                subjectCount: c.subjectIds.size,
            })).sort((a, b) => a.className.localeCompare(b.className));

            setPopulatedClasses(populated);
            setStep(2);
        } catch (e) { setError('Failed to load classes'); }
        setLoadingClasses(false);
    };

    const handleSelectClass = (cls) => {
        setFilterClass(cls.className);
        setStep(3);
        handleSearchWithClass(cls.className, filterExam);
    };

    const handleSearchWithClass = (className, examId) => {
        if (!examId || !className) return;
        setLoading(true); setError(''); setSearched(true);
        try {
            // Reuse already-fetched results — no second API call
            const data = allExamResults.filter(r => r.student?.className === className);
            setResults(data);
            buildPivotTable(data);
        } catch (err) { setError('Failed to load results'); }
        setLoading(false);
    };

    const handleSearch = async () => {
        if (!filterExam || !filterClass) {
            setError('Please select both an Exam and a Class to view results');
            return;
        }
        setLoading(true); setError(''); setSearched(true);
        try {
            // Use cached results if available, else fetch
            let source = allExamResults.length > 0
                ? allExamResults
                : (await api.get('/api/results')).data.filter(r => String(r.exam?.examId) === String(filterExam));

            let data = source.filter(r => r.student?.className === filterClass);

            if (search) {
                data = data.filter(r =>
                    r.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                    r.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                    r.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
                );
            }
            setResults(data);
            buildPivotTable(data);
        } catch (err) { setError('Failed to load results'); }
        setLoading(false);
    };

    const buildPivotTable = (data) => {
        // Get unique subjects
        const subjectMap = {};
        data.forEach(r => {
            if (r.subject) {
                subjectMap[r.subject.subjectId] = r.subject.subjectName;
            }
        });
        const uniqueSubjects = Object.entries(subjectMap).map(([id, name]) => ({ id, name }));
        uniqueSubjects.sort((a, b) => a.name.localeCompare(b.name));

        // Get unique students
        const studentMap = {};
        data.forEach(r => {
            if (r.student) {
                studentMap[r.student.studentId] = r.student;
            }
        });
        const uniqueStudents = Object.values(studentMap);
        uniqueStudents.sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );

        // Build pivot data — studentId -> subjectId -> result
        const pivot = {};
        data.forEach(r => {
            const sid = r.student?.studentId;
            const subId = r.subject?.subjectId;
            if (sid && subId) {
                if (!pivot[sid]) pivot[sid] = {};
                pivot[sid][subId] = r;
            }
        });

        setPivotSubjects(uniqueSubjects);
        setPivotStudents(uniqueStudents);
        setPivotData(pivot);
    };

    const clearFilters = () => {
        setFilterExam('');
        setFilterClass('');
        setSearch('');
        setSearched(false);
        setResults([]);
        setPivotStudents([]);
        setPivotSubjects([]);
        setPivotData({});
        setAllExamResults([]);
        setPopulatedClasses([]);
        setStep(1);
        setError('');
    };

    const getGradeLabel = (marks) => {
        if (marks >= 75) return 'EE';
        if (marks >= 55) return 'ME';
        if (marks >= 40) return 'AE';
        return 'BE';
    };

    const getGradeColor = (grade) => {
        if (grade === 'EE') return '#28a745';
        if (grade === 'ME') return '#2E75B6';
        if (grade === 'AE') return '#ffc107';
        return '#dc3545'; // BE
    };

    const getMarkColor = (marks) => {
        if (!marks && marks !== 0) return '#999';
        if (marks >= 75) return '#28a745';  // EE
        if (marks >= 55) return '#2E75B6';  // ME
        if (marks >= 40) return '#ffc107';  // AE
        return '#dc3545';                    // BE
    };

    // Calculate student total and average
    // ── Subject summary stats (excludes blanks) ──────────────────────────────
    const getSubjectStats = (subjectId) => {
        const subjectResults = pivotStudents
            .map(s => pivotData[s.studentId]?.[subjectId])
            .filter(r => r && r.marksObtained !== null && r.marksObtained !== undefined);
        if (subjectResults.length === 0) return { total: '-', mean: '-', count: 0 };
        const total = subjectResults.reduce((sum, r) => sum + r.marksObtained, 0);
        return {
            total: total.toFixed(0),
            mean: (total / subjectResults.length).toFixed(1),
            count: subjectResults.length
        };
    };

    const getSubjectRanks = () => {
        const means = pivotSubjects.map(sub => ({
            id: sub.id,
            mean: parseFloat(getSubjectStats(sub.id).mean) || 0
        }));
        const sorted = [...means].sort((a, b) => b.mean - a.mean);
        const ranks = {};
        sorted.forEach((sub, i) => { ranks[sub.id] = i + 1; });
        return ranks;
    };

    const getStudentStats = (studentId) => {
        const studentResults = pivotSubjects.map(sub =>
            pivotData[studentId]?.[sub.id]
        ).filter(Boolean);

        if (studentResults.length === 0) return { total: 0, average: 0, grade: '-' };

        const total = studentResults.reduce((sum, r) => sum + r.marksObtained, 0);
        const average = total / studentResults.length;

        let grade = 'BE';
        if (average >= 75) grade = 'EE';
        else if (average >= 55) grade = 'ME';
        else if (average >= 40) grade = 'AE';

        return {
            total: total.toFixed(1),
            average: average.toFixed(1),
            grade
        };
    };

    // Calculate subject average
    const getSubjectAverage = (subjectId) => {
        const subjectResults = pivotStudents.map(s =>
            pivotData[s.studentId]?.[subjectId]
        ).filter(Boolean);

        if (subjectResults.length === 0) return '-';
        const avg = subjectResults.reduce((sum, r) => sum + r.marksObtained, 0) / subjectResults.length;
        return avg.toFixed(1);
    };

    const selectedExamName = exams.find(e => String(e.examId) === String(filterExam))?.examName || '';

    // ✅ Sort students by total marks descending for correct ranking
    const rankedStudents = [...pivotStudents].sort((a, b) => {
        const statsA = getStudentStats(a.studentId);
        const statsB = getStudentStats(b.studentId);
        const totalA = parseFloat(statsA.total) || 0;
        const totalB = parseFloat(statsB.total) || 0;
        if (totalB !== totalA) return totalB - totalA;
        // Tiebreak by average
        return parseFloat(statsB.average) - parseFloat(statsA.average);
    });

    return (
        <div style={styles.container}>
            {/* Navbar */}
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
                <h2 style={styles.title}>📊 Results</h2>
                <p style={styles.subtitle}>Select exam and class to view results</p>

                {error && <p style={styles.error}>{error}</p>}

                {/* ── STEP 1: Select Exam ── */}
                {step === 1 && (
                    <div>
                        <h3 style={styles.stepTitle}>📝 Select an Exam</h3>
                        <div style={styles.examGrid}>
                            {exams.map(exam => (
                                <div key={exam.examId}
                                    onClick={() => handleSelectExam(exam.examId)}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
                                    style={styles.examTile}>
                                    <div style={styles.examTileIcon}>📝</div>
                                    <div style={styles.examTileName}>{exam.examName}</div>
                                    <div style={styles.examTileMeta}>Term {exam.term} · {exam.academicYear}</div>
                                    <div style={styles.examTileAction}>Click to view classes →</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Class Tiles ── */}
                {step === 2 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={() => { setStep(1); setPopulatedClasses([]); }} style={styles.backBtn}>← Back</button>
                            <div>
                                <h3 style={styles.stepTitle}>🏫 Select a Class</h3>
                                <p style={styles.stepSub}>
                                    {exams.find(e => String(e.examId) === String(filterExam))?.examName} — {populatedClasses.length} class{populatedClasses.length !== 1 ? 'es' : ''} with results
                                </p>
                            </div>
                        </div>

                        {loadingClasses ? (
                            <div style={styles.loadingBox}>⏳ Loading classes...</div>
                        ) : populatedClasses.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <p>📭 No results found for this exam yet.</p>
                                <p style={{ color: '#666', fontSize: '13px' }}>Use Mark Entry to add marks first.</p>
                            </div>
                        ) : (
                            <div style={styles.classGrid}>
                                {populatedClasses.map((cls, i) => {
                                    const sectionColors = {
                                        'PRE_SCHOOL': '#6f42c1', 'LOWER_PRIMARY': '#2E75B6',
                                        'UPPER_PRIMARY': '#fd7e14', 'JUNIOR_SCHOOL': '#20c997'
                                    };
                                    const color = sectionColors[cls.section] || '#1F3864';
                                    return (
                                        <div key={i} onClick={() => handleSelectClass(cls)}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
                                            style={{ ...styles.classTile, borderTop: `4px solid ${color}` }}>
                                            <div style={{ ...styles.classTileHeader, color }}>
                                                {cls.className}
                                            </div>
                                            <div style={styles.classTileStats}>
                                                <div style={styles.classStat}>
                                                    <span style={styles.classStatNum}>{cls.studentCount}</span>
                                                    <span style={styles.classStatLbl}>Students</span>
                                                </div>
                                                <div style={styles.classDivider} />
                                                <div style={styles.classStat}>
                                                    <span style={styles.classStatNum}>{cls.subjectCount}</span>
                                                    <span style={styles.classStatLbl}>Subjects</span>
                                                </div>
                                            </div>
                                            <div style={{ ...styles.classTileAction, backgroundColor: color }}>
                                                View Results →
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 3: Results Table ── */}
                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <button onClick={() => { setStep(2); setSearched(false); }} style={styles.backBtn}>← Back to Classes</button>
                            <div>
                                <h3 style={styles.stepTitle}>📊 {filterClass} — {selectedExamName}</h3>
                            </div>
                            <input style={styles.searchInput}
                                placeholder="🔍 Search student..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                {/* Results Pivot Table */}
                {searched && !loading && (
                    <>
                        {pivotStudents.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <p>📭 No results found for <strong>{selectedExamName}</strong> — <strong>{filterClass}</strong></p>
                                <p style={{ color: '#666', fontSize: '13px' }}>
                                    Use Mark Entry to add marks for this class and exam.
                                </p>
                            </div>
                        ) : (
                            <div style={styles.tableCard}>
                                {/* Table Header Info */}
                                <div style={styles.tableTopBar}>
                                    <div>
                                        <h3 style={styles.tableTitle}>
                                            {filterClass} — {selectedExamName}
                                        </h3>
                                        <p style={styles.tableSubtitle}>
                                            {pivotStudents.length} students | {pivotSubjects.length} subjects
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <button onClick={handlePrint} style={styles.printBtn}>
                                            🖨️ Print Results
                                        </button>
                                    </div>
                                    <div style={styles.tableBadges}>
                                        <span style={styles.badge}>👥 {pivotStudents.length} Students</span>
                                        <span style={styles.badge}>📚 {pivotSubjects.length} Subjects</span>
                                        <span style={styles.badge}>📊 {results.length} Records</span>
                                    </div>
                                </div>

                                {/* Pivot Table */}
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            {/* Header Row 1 — Subject Names */}
                                            <tr style={styles.tableHeader}>
                                                <th style={{...styles.th, ...styles.stickyCol}}>#</th>
                                                <th style={{...styles.th, ...styles.stickyCol2}}>Adm No</th>
                                                <th style={{...styles.th, ...styles.stickyCol3}}>Student Name</th>
                                                {pivotSubjects.map(sub => (
                                                    <th key={sub.id} style={{...styles.th, ...styles.subjectTh}}>
                                                        {sub.name}
                                                    </th>
                                                ))}
                                                <th style={{...styles.th, ...styles.totalTh}}>Total</th>
                                                <th style={{...styles.th, ...styles.totalTh}}>Avg %</th>
                                                <th style={{...styles.th, ...styles.totalTh}}>Grade</th>
                                                <th style={{...styles.th, ...styles.totalTh}}>Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rankedStudents.map((student, index) => {
                                                const stats = getStudentStats(student.studentId);
                                                return (
                                                    <tr key={student.studentId}
                                                        style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={{...styles.td, ...styles.stickyCol, textAlign: 'center'}}>
                                                            {index + 1}
                                                        </td>
                                                        <td style={{...styles.td, ...styles.stickyCol2}}>
                                                            <span style={styles.admNo}>
                                                                {student.admissionNumber}
                                                            </span>
                                                        </td>
                                                        <td style={{...styles.td, ...styles.stickyCol3}}>
                                                            <strong>{student.firstName} {student.lastName}</strong>
                                                        </td>
                                                        {pivotSubjects.map(sub => {
                                                            const result = pivotData[student.studentId]?.[sub.id];
                                                            return (
                                                                <td key={sub.id} style={{...styles.td, textAlign: 'center'}}>
                                                                    {result ? (
                                                                        <div style={styles.markCell}>
                                                                            <span style={{
                                                                                ...styles.markValue,
                                                                                color: getMarkColor(result.marksObtained)
                                                                            }}>
                                                                                {result.marksObtained}
                                                                            </span>
                                                                            <span style={{
                                                                                    ...styles.gradeSmall,
                                                                                    backgroundColor: getGradeColor(getGradeLabel(result.marksObtained))
                                                                                }}>
                                                                                    {getGradeLabel(result.marksObtained)}
                                                                                </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={styles.noMark}>—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Total */}
                                                        <td style={{...styles.td, ...styles.totalCell}}>
                                                            <strong>{stats.total}</strong>
                                                        </td>
                                                        {/* Average */}
                                                        <td style={{...styles.td, ...styles.totalCell}}>
                                                            <span style={{
                                                                color: getMarkColor(parseFloat(stats.average)),
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {stats.average}%
                                                            </span>
                                                        </td>
                                                        {/* Grade */}
                                                        <td style={{...styles.td, ...styles.totalCell, textAlign: 'center'}}>
                                                            <span style={{
                                                                ...styles.gradeBadge,
                                                                backgroundColor: getGradeColor(stats.grade)
                                                            }}>
                                                                {stats.grade}
                                                            </span>
                                                        </td>
                                                        {/* Rank placeholder */}
                                                        <td style={{...styles.td, ...styles.totalCell, textAlign: 'center'}}>
                                                            <span style={styles.rankBadge}>
                                                                {index + 1}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Average Row */}
                                            <tr style={{ backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' }}>
                                                <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#1F3864', fontSize: '12px' }}>📊 Total Marks</td>
                                                {pivotSubjects.map(sub => {
                                                    const s = getSubjectStats(sub.id);
                                                    return <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}>
                                                        <strong style={{ color: '#1F3864', fontSize: '12px' }}>{s.total}</strong>
                                                    </td>;
                                                })}
                                                <td colSpan="3" style={styles.td} />
                                            </tr>
                                            <tr style={{ backgroundColor: '#e3f2fd' }}>
                                                <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#2E75B6', fontSize: '12px' }}>📈 Mean (excl. blanks)</td>
                                                {pivotSubjects.map(sub => {
                                                    const s = getSubjectStats(sub.id);
                                                    const mean = parseFloat(s.mean);
                                                    return <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '12px', color: getMarkColor(mean) }}>{s.mean}</span>
                                                        <div style={{ fontSize: '9px', color: '#999' }}>{s.count} pupil{s.count !== 1 ? 's' : ''}</div>
                                                    </td>;
                                                })}
                                                <td colSpan="3" style={styles.td} />
                                            </tr>
                                            {(() => {
                                                const subjectRanks = getSubjectRanks();
                                                return <tr style={{ backgroundColor: '#f3e5f5', borderBottom: '3px solid #6f42c1' }}>
                                                    <td colSpan="3" style={{ ...styles.td, fontWeight: 'bold', color: '#6f42c1', fontSize: '12px' }}>🏆 Subject Rank</td>
                                                    {pivotSubjects.map(sub => {
                                                        const rank = subjectRanks[sub.id];
                                                        return <td key={sub.id} style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: '#6f42c1' }}>#{rank}</td>;
                                                    })}
                                                    <td colSpan="3" style={styles.td} />
                                                </tr>;
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Legend */}
                                <div style={styles.legend}>
                                    <span style={styles.legendTitle}>Grade Legend:</span>
                                    <span style={{...styles.legendItem, color: '#28a745'}}>● EE (75-100) Exceeding Expectations</span>
                                    <span style={{...styles.legendItem, color: '#2E75B6'}}>● ME (55-74) Meeting Expectations</span>
                                    <span style={{...styles.legendItem, color: '#ffc107'}}>● AE (40-54) Approaching Expectations</span>
                                    <span style={{...styles.legendItem, color: '#dc3545'}}>● BE (0-39) Below Expectations</span>
                                </div>
                            </div>
                        )}
                    </>
                )}

                    </div>
                )}
            </div>
        {/* Hidden printable area */}
            <div style={{ display: 'none' }}>
                <PrintableResultsReport
                    ref={printRef}
                    students={pivotStudents}
                    subjects={pivotSubjects}
                    pivotData={pivotData}
                    className={filterClass || ''}
                    examName={selectedExamName}
                    academicYear={exams.find(e => String(e.examId) === String(filterExam))?.academicYear || ''}
                    term={exams.find(e => String(e.examId) === String(filterExam))?.term || ''}
                    getGradeLabel={getGradeLabel}
                    getMarkColor={getMarkColor}
                    getGradeColor={getGradeColor}
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
    content: { padding: '30px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', marginBottom: '25px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },

    // Filter Card
    filterCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', alignItems: 'end' },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    filterLabel: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    filterSelect: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '13px' },
    btnRow: { display: 'flex', gap: '8px' },
    searchBtn: { flex: 1, backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' },

    // Table Card
    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '20px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },

    // Table
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 'bold' },
    subjectTh: { textAlign: 'center', backgroundColor: '#2E75B6', minWidth: '80px' },
    totalTh: { textAlign: 'center', backgroundColor: '#1a2d4f', minWidth: '70px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },

    // Sticky columns
    stickyCol: { position: 'sticky', left: 0, backgroundColor: '#1F3864', zIndex: 1, width: '40px', textAlign: 'center' },
    stickyCol2: { position: 'sticky', left: '40px', backgroundColor: 'inherit', zIndex: 1, minWidth: '90px' },
    stickyCol3: { position: 'sticky', left: '130px', backgroundColor: 'inherit', zIndex: 1, minWidth: '150px', borderRight: '2px solid #ddd' },

    // Mark Cell
    markCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    markValue: { fontSize: '15px', fontWeight: 'bold' },
    gradeSmall: { color: 'white', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold' },
    noMark: { color: '#ccc', fontSize: '16px' },

    // Total cells
    totalCell: { backgroundColor: '#f0f4ff', fontWeight: 'bold' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },
    rankBadge: { backgroundColor: '#1F3864', color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },

    // Average row
    averageRow: { backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' },
    avgLabel: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },

    // Badges
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },

    // Legend
    legend: { padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8f9fa' },
    legendTitle: { fontWeight: 'bold', color: '#1F3864', fontSize: '12px' },
    legendItem: { fontSize: '12px', fontWeight: 'bold' },

    // Empty and instruction cards
    emptyCard: { backgroundColor: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    instructionCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },

    // Step navigation
    stepHeader: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' },
    stepTitle: { color: '#1F3864', margin: '0 0 3px 0', fontSize: '20px' },
    stepSub: { color: '#666', margin: 0, fontSize: '13px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    searchInput: { padding: '9px 14px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', minWidth: '220px' },
    loadingBox: { backgroundColor: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#666', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },

    // Exam tiles
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' },
    examTile: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.15s', border: '2px solid transparent' },
    examTileIcon: { fontSize: '36px', textAlign: 'center', padding: '20px 20px 8px 20px' },
    examTileName: { color: '#1F3864', fontWeight: 'bold', fontSize: '16px', textAlign: 'center', padding: '0 15px 5px' },
    examTileMeta: { color: '#888', fontSize: '12px', textAlign: 'center', padding: '0 15px 12px' },
    examTileAction: { backgroundColor: '#1F3864', color: 'white', textAlign: 'center', padding: '8px', fontSize: '12px' },

    // Class tiles
    classGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' },
    classTile: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' },
    classTileHeader: { fontSize: '18px', fontWeight: 'bold', textAlign: 'center', padding: '16px 10px 8px' },
    classTileStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '8px 10px' },
    classStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    classStatNum: { fontSize: '20px', fontWeight: 'bold', color: '#1F3864' },
    classStatLbl: { fontSize: '10px', color: '#888' },
    classDivider: { width: '1px', height: '30px', backgroundColor: '#eee' },
    classTileAction: { color: 'white', textAlign: 'center', padding: '7px', fontSize: '12px', marginTop: '8px' }
};

// ── Print Styles ─────────────────────────────────────────────────────────────
const pStyles = {
    page: { padding: '12px', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '10px' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '8px', marginBottom: '10px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' },
    logo: { width: '65px', height: '65px', objectFit: 'contain' },
    schoolInfo: { textAlign: 'center', flex: 1, padding: '0 8px' },
    schoolName: { color: '#1F3864', fontSize: '12px', margin: '0 0 3px 0', textTransform: 'uppercase', fontWeight: 'bold' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 2px 0', fontSize: '10px' },
    contact: { fontSize: '9px', color: '#666', margin: 0 },
    banner: { backgroundColor: '#1F3864', padding: '5px 10px', textAlign: 'center' },
    bannerTitle: { color: 'white', margin: '0 0 2px 0', fontSize: '12px' },
    bannerSub: { color: '#BDD7EE', margin: 0, fontSize: '10px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '9px' },
    thead: { backgroundColor: '#1F3864' },
    thRank: { color: 'white', padding: '4px 5px', textAlign: 'center', fontSize: '9px', width: '30px' },
    thAdm: { color: 'white', padding: '4px 5px', textAlign: 'left', fontSize: '9px', minWidth: '60px' },
    thName: { color: 'white', padding: '4px 5px', textAlign: 'left', fontSize: '9px', minWidth: '120px' },
    thSub: { color: 'white', padding: '2px', textAlign: 'center', fontSize: '8px', width: '45px', verticalAlign: 'bottom' },
    thTotal: { color: '#FFD700', padding: '4px 5px', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', minWidth: '35px' },
    rotated: { writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: '8px', padding: '3px 1px', minHeight: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    td: { padding: '3px 5px', borderBottom: '1px solid #ddd', fontSize: '9px' },
    tdC: { padding: '3px 3px', borderBottom: '1px solid #ddd', fontSize: '9px', textAlign: 'center' },
    tdName: { padding: '3px 5px', borderBottom: '1px solid #ddd', fontSize: '9px', whiteSpace: 'nowrap' },
    tdTotal: { padding: '3px 5px', borderBottom: '1px solid #ddd', fontSize: '9px', textAlign: 'center', backgroundColor: '#f0f4ff', fontWeight: 'bold' },
    trEven: { backgroundColor: '#f8f9fa' },
    trOdd: { backgroundColor: 'white' },
    totalRow: { backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' },
    meanRow: { backgroundColor: '#e3f2fd' },
    rankRow: { backgroundColor: '#f3e5f5', borderBottom: '2px solid #6f42c1' },
    summary: { display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #ddd', marginTop: '6px', fontSize: '9px' },
    summaryItem: { fontSize: '9px' },
    footer: { display: 'flex', gap: '30px', marginTop: '12px', borderTop: '2px solid #1F3864', paddingTop: '8px' },
    sigBox: { flex: 1 },
    sig: { fontSize: '9px', margin: '0 0 6px 0', color: '#333' },
    footerNote: { textAlign: 'center', fontSize: '8px', color: '#999', marginTop: '8px' },
};

export default Results;