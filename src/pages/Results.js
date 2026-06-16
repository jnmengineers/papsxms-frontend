import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Results() {
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [step, setStep] = useState(1); // 1=exam, 2=class, 3=results
    const [filterExam, setFilterExam] = useState('');
    const [filterClassId, setFilterClassId] = useState('');
    const [search, setSearch] = useState('');

    // Pivot data
    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1', grades: ['PG', 'PP1', 'PP2'] },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6', grades: ['G1', 'G2', 'G3'] },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14', grades: ['G4', 'G5', 'G6'] },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997', grades: ['G7', 'G8', 'G9'] }
    ];

    useEffect(() => {
        fetchExams();
        fetchClasses();
    }, []);

    useEffect(() => {
        // Teacher — skip exam and class steps, go straight
        if (role === 'TEACHER' && linkedClassId) {
            setFilterClassId(linkedClassId);
            setStep(1); // still need to select exam
        }
    }, [linkedClassId]);

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    // Step 1 — Select Exam
    const handleSelectExam = (examId) => {
        setFilterExam(examId);
        setFilterClassId('');
        setPivotStudents([]);
        setPivotSubjects([]);
        setPivotData({});
        setResults([]);
        setError('');
        if (role === 'TEACHER' && linkedClassId) {
            // Teacher — skip class step, load results immediately
            loadResults(examId, linkedClassId);
        } else {
            setStep(2);
        }
    };

    // Step 2 — Select Class
    const handleSelectClass = (classId) => {
        setFilterClassId(classId);
        setError('');
        loadResults(filterExam, classId);
    };

    // Load results
    const loadResults = async (examId, classId) => {
        setLoading(true);
        setStep(3);
        setError('');
        try {
            const selectedClass = classes.find(c => String(c.classId) === String(classId));
            const response = await api.get('/api/results');
            let data = response.data;

            data = data.filter(r =>
                String(r.exam?.examId) === String(examId) &&
                (r.student?.className === selectedClass?.className ||
                    String(r.student?.schoolClass?.classId) === String(classId))
            );

            setResults(data);
            buildPivotTable(data);
        } catch (err) {
            setError('Failed to load results');
            setStep(2);
        }
        setLoading(false);
    };

    const buildPivotTable = (data) => {
        const subjectMap = {};
        data.forEach(r => {
            if (r.subject) subjectMap[r.subject.subjectId] = r.subject.subjectName;
        });
        const uniqueSubjects = Object.entries(subjectMap)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const studentMap = {};
        data.forEach(r => {
            if (r.student) studentMap[r.student.studentId] = r.student;
        });
        const uniqueStudents = Object.values(studentMap)
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

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

    const handleReset = () => {
        setStep(1);
        setFilterExam('');
        setFilterClassId('');
        setSearch('');
        setResults([]);
        setPivotStudents([]);
        setPivotSubjects([]);
        setPivotData({});
        setError('');
    };

    const getGradeColor = (grade) => {
        if (grade === 'A') return '#28a745';
        if (grade === 'B') return '#2E75B6';
        if (grade === 'C') return '#ffc107';
        return '#dc3545';
    };

    const getMarkColor = (marks) => {
        if (!marks && marks !== 0) return '#999';
        if (marks >= 80) return '#28a745';
        if (marks >= 60) return '#2E75B6';
        if (marks >= 40) return '#ffc107';
        return '#dc3545';
    };

    const getStudentStats = (studentId) => {
        const studentResults = pivotSubjects
            .map(sub => pivotData[studentId]?.[sub.id])
            .filter(Boolean);
        if (studentResults.length === 0) return { total: 0, average: 0, grade: '-' };
        const total = studentResults.reduce((sum, r) => sum + r.marksObtained, 0);
        const average = total / studentResults.length;
        let grade = 'D';
        if (average >= 80) grade = 'A';
        else if (average >= 60) grade = 'B';
        else if (average >= 40) grade = 'C';
        return { total: total.toFixed(1), average: average.toFixed(1), grade };
    };

    const getSubjectAverage = (subjectId) => {
        const subjectResults = pivotStudents
            .map(s => pivotData[s.studentId]?.[subjectId])
            .filter(Boolean);
        if (subjectResults.length === 0) return '-';
        const avg = subjectResults.reduce((sum, r) => sum + r.marksObtained, 0) / subjectResults.length;
        return avg.toFixed(1);
    };

    const selectedExamObj = exams.find(e => String(e.examId) === String(filterExam));
    const selectedClassObj = classes.find(c => String(c.classId) === String(filterClassId));

    // Group classes by section → grade → streams
    const getGroupedClasses = () => {
        const grouped = {};
        sections.forEach(s => { grouped[s.value] = {}; });
        classes.forEach(cls => {
            const section = cls.section;
            const grade = cls.gradeLevel;
            if (section && grade) {
                if (!grouped[section]) grouped[section] = {};
                if (!grouped[section][grade]) grouped[section][grade] = [];
                grouped[section][grade].push(cls);
            }
        });
        return grouped;
    };

    const groupedClasses = getGroupedClasses();

    // Filtered students for search
    const displayStudents = search
        ? pivotStudents.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            s.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        )
        : pivotStudents;

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
                {/* Breadcrumb */}
                <div style={styles.breadcrumb}>
                    <span onClick={handleReset} style={{ ...styles.breadItem, cursor: 'pointer', color: step >= 1 ? '#1F3864' : '#999' }}>
                        📊 Results
                    </span>
                    {filterExam && (
                        <>
                            <span style={styles.breadArrow}>›</span>
                            <span onClick={() => { setStep(1); setFilterExam(''); setFilterClassId(''); }} style={{ ...styles.breadItem, cursor: 'pointer', color: '#2E75B6' }}>
                                📝 {selectedExamObj?.examName}
                            </span>
                        </>
                    )}
                    {filterClassId && (
                        <>
                            <span style={styles.breadArrow}>›</span>
                            <span style={{ ...styles.breadItem, color: '#28a745' }}>
                                🏫 {selectedClassObj?.className}
                            </span>
                        </>
                    )}
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* ── STEP 1: Select Exam ── */}
                {step === 1 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <h2 style={styles.stepTitle}>📝 Select Exam</h2>
                            <p style={styles.stepSubtitle}>Choose which exam you want to view results for</p>
                        </div>
                        {exams.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <div style={styles.emptyIcon}>📝</div>
                                <p>No exams found. Create exams first.</p>
                            </div>
                        ) : (
                            <div style={styles.examGrid}>
                                {exams.map(exam => (
                                    <div key={exam.examId}
                                        onClick={() => handleSelectExam(exam.examId)}
                                        style={styles.examTile}>
                                        <div style={styles.examTileTop}>
                                            <span style={styles.examIcon}>📝</span>
                                            <h3 style={styles.examName}>{exam.examName}</h3>
                                            <p style={styles.examMeta}>
                                                Term {exam.term} • {exam.academicYear}
                                            </p>
                                            {exam.classLevel && (
                                                <span style={styles.examLevel}>{exam.classLevel}</span>
                                            )}
                                        </div>
                                        <div style={styles.examTileBottom}>
                                            <span style={styles.selectHint}>Click to select →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 2: Select Class ── */}
                {step === 2 && role !== 'TEACHER' && (
                    <div>
                        <div style={styles.stepHeader}>
                            <div style={styles.stepHeaderLeft}>
                                <button onClick={() => setStep(1)} style={styles.backBtn}>← Back</button>
                                <div>
                                    <h2 style={styles.stepTitle}>🏫 Select Class</h2>
                                    <p style={styles.stepSubtitle}>
                                        Exam: <strong>{selectedExamObj?.examName}</strong> — Click a class to view results
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={styles.classTilesCard}>
                            {sections.map(section => {
                                const sectionGrades = groupedClasses[section.value] || {};
                                const hasClasses = Object.keys(sectionGrades).length > 0;
                                if (!hasClasses) return null;
                                return (
                                    <div key={section.value} style={styles.sectionBlock}>
                                        <div style={{ ...styles.sectionHeader, backgroundColor: section.color }}>
                                            <span style={styles.sectionLabel}>{section.label}</span>
                                            <span style={styles.sectionMeta}>
                                                {Object.values(sectionGrades).flat().length} classes
                                            </span>
                                        </div>
                                        <div style={styles.gradesRow}>
                                            {Object.entries(sectionGrades)
                                                .sort(([a], [b]) => a.localeCompare(b))
                                                .map(([grade, gradeClasses]) => (
                                                    <div key={grade} style={styles.gradeGroup}>
                                                        <div style={{ ...styles.gradeLabel, color: section.color }}>
                                                            {grade}
                                                        </div>
                                                        <div style={styles.streamTiles}>
                                                            {gradeClasses.map(cls => (
                                                                <div key={cls.classId}
                                                                    onClick={() => handleSelectClass(cls.classId)}
                                                                    style={{
                                                                        ...styles.streamTile,
                                                                        borderColor: section.color,
                                                                        ':hover': { backgroundColor: section.color }
                                                                    }}
                                                                    onMouseEnter={e => {
                                                                        e.currentTarget.style.backgroundColor = section.color;
                                                                        e.currentTarget.style.color = 'white';
                                                                    }}
                                                                    onMouseLeave={e => {
                                                                        e.currentTarget.style.backgroundColor = 'white';
                                                                        e.currentTarget.style.color = '#333';
                                                                    }}>
                                                                    <div style={styles.streamTileName}>{cls.className}</div>
                                                                    {cls.stream && (
                                                                        <div style={styles.streamBadgeInner}>{cls.stream}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Results Table ── */}
                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <div style={styles.stepHeaderLeft}>
                                {role !== 'TEACHER' && (
                                    <button onClick={() => setStep(2)} style={styles.backBtn}>← Back</button>
                                )}
                                <div>
                                    <h2 style={styles.stepTitle}>
                                        📊 {selectedClassObj?.className} — {selectedExamObj?.examName}
                                    </h2>
                                    <p style={styles.stepSubtitle}>
                                        Term {selectedExamObj?.term} • {selectedExamObj?.academicYear}
                                    </p>
                                </div>
                            </div>
                            <input
                                style={styles.searchInput}
                                placeholder="🔍 Search student..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div style={styles.emptyCard}>
                                <p>⏳ Loading results...</p>
                            </div>
                        ) : pivotStudents.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <div style={styles.emptyIcon}>📭</div>
                                <p>No results found for <strong>{selectedClassObj?.className}</strong></p>
                                <p style={{ color: '#666', fontSize: '13px' }}>
                                    Use Mark Entry to add marks for this class and exam.
                                </p>
                                <button onClick={() => window.location.href = '/mark-entry'} style={styles.goBtn}>
                                    ✏️ Go to Mark Entry
                                </button>
                            </div>
                        ) : (
                            <div style={styles.tableCard}>
                                <div style={styles.tableTopBar}>
                                    <div>
                                        <h3 style={styles.tableTitle}>
                                            {selectedClassObj?.className} — {selectedExamObj?.examName}
                                        </h3>
                                        <p style={styles.tableSubtitle}>
                                            {pivotStudents.length} students | {pivotSubjects.length} subjects
                                        </p>
                                    </div>
                                    <div style={styles.tableBadges}>
                                        <span style={styles.badge}>👥 {pivotStudents.length} Students</span>
                                        <span style={styles.badge}>📚 {pivotSubjects.length} Subjects</span>
                                        <span style={styles.badge}>📊 {results.length} Records</span>
                                    </div>
                                </div>

                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.tableHeader}>
                                                <th style={{ ...styles.th, ...styles.stickyCol }}>#</th>
                                                <th style={{ ...styles.th, ...styles.stickyCol2 }}>Adm No</th>
                                                <th style={{ ...styles.th, ...styles.stickyCol3 }}>Student Name</th>
                                                {pivotSubjects.map(sub => (
                                                    <th key={sub.id} style={{ ...styles.th, ...styles.subjectTh }}>
                                                        {sub.name}
                                                    </th>
                                                ))}
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Total</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Avg %</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Grade</th>
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayStudents.map((student, index) => {
                                                const stats = getStudentStats(student.studentId);
                                                return (
                                                    <tr key={student.studentId}
                                                        style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={{ ...styles.td, ...styles.stickyCol, textAlign: 'center' }}>
                                                            {index + 1}
                                                        </td>
                                                        <td style={{ ...styles.td, ...styles.stickyCol2 }}>
                                                            <span style={styles.admNo}>{student.admissionNumber}</span>
                                                        </td>
                                                        <td style={{ ...styles.td, ...styles.stickyCol3 }}>
                                                            <strong>{student.firstName} {student.lastName}</strong>
                                                        </td>
                                                        {pivotSubjects.map(sub => {
                                                            const result = pivotData[student.studentId]?.[sub.id];
                                                            return (
                                                                <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}>
                                                                    {result ? (
                                                                        <div style={styles.markCell}>
                                                                            <span style={{ ...styles.markValue, color: getMarkColor(result.marksObtained) }}>
                                                                                {result.marksObtained}
                                                                            </span>
                                                                            {result.grade && (
                                                                                <span style={{ ...styles.gradeSmall, backgroundColor: getGradeColor(result.grade) }}>
                                                                                    {result.grade}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={styles.noMark}>—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ ...styles.td, ...styles.totalCell }}>
                                                            <strong>{stats.total}</strong>
                                                        </td>
                                                        <td style={{ ...styles.td, ...styles.totalCell }}>
                                                            <span style={{ color: getMarkColor(parseFloat(stats.average)), fontWeight: 'bold' }}>
                                                                {stats.average}%
                                                            </span>
                                                        </td>
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}>
                                                            <span style={{ ...styles.gradeBadge, backgroundColor: getGradeColor(stats.grade) }}>
                                                                {stats.grade}
                                                            </span>
                                                        </td>
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}>
                                                            <span style={styles.rankBadge}>{index + 1}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={styles.averageRow}>
                                                <td colSpan="3" style={{ ...styles.td, ...styles.avgLabel }}>
                                                    📊 Subject Average
                                                </td>
                                                {pivotSubjects.map(sub => (
                                                    <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}>
                                                        <strong style={{ color: '#1F3864' }}>
                                                            {getSubjectAverage(sub.id)}
                                                        </strong>
                                                    </td>
                                                ))}
                                                <td colSpan="4" style={styles.td}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div style={styles.legend}>
                                    <span style={styles.legendTitle}>Grade Legend:</span>
                                    <span style={{ ...styles.legendItem, color: '#28a745' }}>● A (80-100) Excellent</span>
                                    <span style={{ ...styles.legendItem, color: '#2E75B6' }}>● B (60-79) Good</span>
                                    <span style={{ ...styles.legendItem, color: '#ffc107' }}>● C (40-59) Average</span>
                                    <span style={{ ...styles.legendItem, color: '#dc3545' }}>● D (0-39) Below Average</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },

    // Breadcrumb
    breadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '25px', flexWrap: 'wrap' },
    breadItem: { fontSize: '14px', fontWeight: 'bold' },
    breadArrow: { color: '#999', fontSize: '16px' },

    // Step Header
    stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    stepHeaderLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
    stepTitle: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '22px' },
    stepSubtitle: { color: '#666', margin: 0, fontSize: '14px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    searchInput: { padding: '10px 15px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', minWidth: '250px' },

    // Exam Tiles
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    examTile: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', border: '2px solid transparent' },
    examTileTop: { padding: '20px', textAlign: 'center' },
    examIcon: { fontSize: '36px', display: 'block', marginBottom: '10px' },
    examName: { color: '#1F3864', margin: '0 0 6px 0', fontSize: '16px' },
    examMeta: { color: '#666', margin: '0 0 8px 0', fontSize: '13px' },
    examLevel: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
    examTileBottom: { backgroundColor: '#1F3864', padding: '8px', textAlign: 'center' },
    selectHint: { color: 'white', fontSize: '12px' },

    // Class Tiles
    classTilesCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    sectionBlock: { marginBottom: '15px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' },
    sectionHeader: { padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '14px' },
    sectionMeta: { color: 'rgba(255,255,255,0.8)', fontSize: '12px' },
    gradesRow: { display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '15px', backgroundColor: '#fafafa' },
    gradeGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    gradeLabel: { fontSize: '12px', fontWeight: 'bold', textAlign: 'center' },
    streamTiles: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    streamTile: { padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', minWidth: '60px', border: '2px solid #ddd', backgroundColor: 'white', color: '#333' },
    streamTileName: { fontSize: '14px', fontWeight: 'bold' },
    streamBadgeInner: { fontSize: '10px', color: '#999', marginTop: '2px' },

    // Table Card
    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 'bold' },
    subjectTh: { textAlign: 'center', backgroundColor: '#2E75B6', minWidth: '80px' },
    totalTh: { textAlign: 'center', backgroundColor: '#1a2d4f', minWidth: '70px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    stickyCol: { position: 'sticky', left: 0, backgroundColor: '#1F3864', zIndex: 1, width: '40px', textAlign: 'center' },
    stickyCol2: { position: 'sticky', left: '40px', backgroundColor: 'inherit', zIndex: 1, minWidth: '90px' },
    stickyCol3: { position: 'sticky', left: '130px', backgroundColor: 'inherit', zIndex: 1, minWidth: '150px', borderRight: '2px solid #ddd' },
    markCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    markValue: { fontSize: '15px', fontWeight: 'bold' },
    gradeSmall: { color: 'white', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold' },
    noMark: { color: '#ccc', fontSize: '16px' },
    totalCell: { backgroundColor: '#f0f4ff', fontWeight: 'bold' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },
    rankBadge: { backgroundColor: '#1F3864', color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },
    averageRow: { backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' },
    avgLabel: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },
    legend: { padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8f9fa' },
    legendTitle: { fontWeight: 'bold', color: '#1F3864', fontSize: '12px' },
    legendItem: { fontSize: '12px', fontWeight: 'bold' },
    emptyCard: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
    goBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px' },
};

export default Results;