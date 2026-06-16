import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function MarkEntry() {
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');

    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [step, setStep] = useState(1); // 1=class+exam, 2=subject selection, 3=mark sheet

    useEffect(() => {
        fetchClasses();
        fetchExams();
    }, []);

    useEffect(() => {
        if (role === 'TEACHER' && linkedClassId) {
            setSelectedClass(linkedClassId);
        }
    }, [linkedClassId]);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data);
        } catch (err) {
            setError('Failed to load classes');
        }
    };

    const fetchExams = async () => {
        try {
            const response = await api.get('/api/exams');
            setExams(response.data);
        } catch (err) {
            setError('Failed to load exams');
        }
    };

    const fetchSubjectsByClass = async (classId) => {
        try {
            const response = await api.get(`/api/class-subjects/by-class/${classId}`);
            if (response.data && response.data.length > 0) {
                const classSubjects = response.data.map(cs => cs.subject).filter(Boolean);
                setAllSubjects(classSubjects);
            } else {
                const fallback = await api.get('/api/subjects');
                setAllSubjects(fallback.data);
            }
        } catch (err) {
            try {
                const fallback = await api.get('/api/subjects');
                setAllSubjects(fallback.data);
            } catch (e) {
                setError('Failed to load subjects');
            }
        }
    };

    const fetchStudentsByClass = async (classId) => {
        try {
            const response = await api.get('/api/students');
            const classStudents = response.data.filter(s =>
                String(s.schoolClass?.classId) === String(classId)
            );
            setStudents(classStudents);
        } catch (err) {
            setError('Failed to load students');
        }
    };

    const fetchExistingMarks = async (examId, subjectIds) => {
        try {
            const response = await api.get(`/api/results/by-exam/${examId}`);
            const marksMap = {};
            response.data.forEach(result => {
                const studentId = result.student?.studentId;
                const subjectId = result.subject?.subjectId;
                if (studentId && subjectId && subjectIds.includes(subjectId)) {
                    if (!marksMap[studentId]) marksMap[studentId] = {};
                    marksMap[studentId][subjectId] = {
                        marks: result.marksObtained,
                        resultId: result.resultId,
                        exists: true
                    };
                }
            });
            setMarks(marksMap);
        } catch (err) {
            console.error('Failed to load existing marks');
        }
    };

    // STEP 1 -> STEP 2: Class & Exam selected, load subjects for class
    const handleProceedToSubjects = async () => {
        if (!selectedClass || !selectedExam) {
            setError('Please select both Class and Exam');
            return;
        }
        setError('');
        setLoading(true);
        await fetchSubjectsByClass(selectedClass);
        await fetchStudentsByClass(selectedClass);
        setSelectedSubjectIds([]);
        setLoading(false);
        setStep(2);
    };

    // STEP 2 -> STEP 3: Subjects selected, build mark sheet
    const handleProceedToMarkSheet = async () => {
        if (selectedSubjectIds.length === 0) {
            setError('Please select at least one subject that was tested');
            return;
        }
        setError('');
        setLoading(true);
        await fetchExistingMarks(selectedExam, selectedSubjectIds);
        setLoading(false);
        setStep(3);
    };

    const toggleSubject = (subjectId) => {
        setSelectedSubjectIds(prev =>
            prev.includes(subjectId)
                ? prev.filter(id => id !== subjectId)
                : [...prev, subjectId]
        );
    };

    const selectAllSubjects = () => {
        setSelectedSubjectIds(allSubjects.map(s => s.subjectId));
    };

    const clearAllSubjects = () => {
        setSelectedSubjectIds([]);
    };

    const handleMarkChange = (studentId, subjectId, value) => {
        setMarks(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    ...prev[studentId]?.[subjectId],
                    marks: value
                }
            }
        }));
    };

    const selectedSubjects = allSubjects.filter(s => selectedSubjectIds.includes(s.subjectId));

    const handleSaveAll = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        let saved = 0;
        let updated = 0;
        let failed = 0;

        for (const student of students) {
            const studentMarks = marks[student.studentId] || {};
            for (const subject of selectedSubjects) {
                const markData = studentMarks[subject.subjectId];
                if (!markData || markData.marks === '' || markData.marks === undefined || markData.marks === null) continue;

                try {
                    if (markData.exists && markData.resultId) {
                        await api.put(`/api/results/${markData.resultId}`, {
                            marksObtained: parseFloat(markData.marks),
                            maxMarks: 100
                        });
                        updated++;
                    } else {
                        await api.post('/api/results', {
                            marksObtained: parseFloat(markData.marks),
                            maxMarks: 100,
                            student: { studentId: student.studentId },
                            subject: { subjectId: subject.subjectId },
                            exam: { examId: parseInt(selectedExam) }
                        });
                        saved++;
                    }
                } catch (err) {
                    failed++;
                }
            }
        }

        setSaving(false);
        if (failed > 0) {
            setError(`${failed} marks failed to save. ${saved} saved, ${updated} updated.`);
        } else {
            setSuccessMsg(`✅ ${saved} new marks saved and ${updated} marks updated successfully!`);
        }
        fetchExistingMarks(selectedExam, selectedSubjectIds);
    };

    const getGradeColor = (mark) => {
        if (!mark && mark !== 0) return '#ddd';
        const m = parseFloat(mark);
        if (isNaN(m)) return '#ddd';
        if (m >= 80) return '#28a745';
        if (m >= 60) return '#2E75B6';
        if (m >= 40) return '#ffc107';
        return '#dc3545';
    };

    const getGradeLabel = (mark) => {
        if (!mark && mark !== 0) return '';
        const m = parseFloat(mark);
        if (isNaN(m)) return '';
        if (m >= 80) return 'A';
        if (m >= 60) return 'B';
        if (m >= 40) return 'C';
        return 'D';
    };

    const countEnteredMarks = () => {
        let count = 0;
        Object.values(marks).forEach(studentMarks => {
            Object.values(studentMarks).forEach(markData => {
                if (markData?.marks !== '' && markData?.marks !== undefined && markData?.marks !== null) count++;
            });
        });
        return count;
    };

    const selectedClassName = role === 'TEACHER' && linkedClassName
        ? linkedClassName
        : classes.find(c => String(c.classId) === String(selectedClass))?.className || '';
    const selectedExamName = exams.find(e => String(e.examId) === String(selectedExam))?.examName || '';

    const handleBack = () => {
        if (step === 3) { setStep(2); setError(''); }
        else if (step === 2) { setStep(1); setError(''); setSelectedSubjectIds([]); }
    };

    const handleReset = () => {
        setStep(1);
        setSelectedExam('');
        if (role !== 'TEACHER') setSelectedClass('');
        setSelectedSubjectIds([]);
        setMarks({});
        setError('');
        setSuccessMsg('');
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
                {/* Breadcrumb */}
                <div style={styles.breadcrumb}>
                    <span onClick={handleReset} style={{ ...styles.breadItem, cursor: 'pointer', color: step >= 1 ? '#1F3864' : '#999' }}>
                        ✏️ Mark Entry
                    </span>
                    {step >= 2 && (
                        <>
                            <span style={styles.breadArrow}>›</span>
                            <span onClick={handleBack} style={{ ...styles.breadItem, cursor: 'pointer', color: '#2E75B6' }}>
                                🏫 {selectedClassName} — {selectedExamName}
                            </span>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <span style={styles.breadArrow}>›</span>
                            <span style={{ ...styles.breadItem, color: '#28a745' }}>
                                📚 {selectedSubjects.length} Subject(s) Selected
                            </span>
                        </>
                    )}
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* ── STEP 1: Select Class & Exam ── */}
                {step === 1 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <h2 style={styles.stepTitle}>📝 Step 1 — Select Class & Exam</h2>
                            <p style={styles.stepSubtitle}>
                                {role === 'TEACHER' && linkedClassName
                                    ? `Class Teacher — ${linkedClassName}`
                                    : 'Choose the class and exam to enter marks for'}
                            </p>
                        </div>
                        <div style={styles.card}>
                            <div style={styles.grid2}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>🏫 Class</label>
                                    {role === 'TEACHER' ? (
                                        <div style={styles.classDisplay}>
                                            🏫 {linkedClassName || 'No class assigned'}
                                            <span style={styles.lockedBadge}>🔒 Locked</span>
                                        </div>
                                    ) : (
                                        <select style={styles.select} value={selectedClass}
                                            onChange={e => setSelectedClass(e.target.value)}>
                                            <option value="">-- Select Class --</option>
                                            {classes.map(cls => (
                                                <option key={cls.classId} value={cls.classId}>
                                                    {cls.className}{cls.stream ? ` — ${cls.stream}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>📝 Exam</label>
                                    <select style={styles.select} value={selectedExam}
                                        onChange={e => setSelectedExam(e.target.value)}>
                                        <option value="">-- Select Exam --</option>
                                        {exams.map(exam => (
                                            <option key={exam.examId} value={exam.examId}>
                                                {exam.examName} (Term {exam.term})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleProceedToSubjects} style={styles.proceedBtn} disabled={loading}>
                                {loading ? '⏳ Loading...' : 'Continue → Select Subjects'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Select Subjects Tested ── */}
                {step === 2 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <div style={styles.stepHeaderLeft}>
                                <button onClick={handleBack} style={styles.backBtn}>← Back</button>
                                <div>
                                    <h2 style={styles.stepTitle}>📚 Step 2 — Which Subjects Were Tested?</h2>
                                    <p style={styles.stepSubtitle}>
                                        {selectedClassName} | {selectedExamName} — Tick the subjects tested on this exam
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={styles.card}>
                            <div style={styles.subjectToolbar}>
                                <span style={styles.subjectCount}>
                                    ✅ {selectedSubjectIds.length} / {allSubjects.length} selected
                                </span>
                                <div style={styles.toolbarBtns}>
                                    <button onClick={selectAllSubjects} style={styles.selectAllBtn}>Select All</button>
                                    <button onClick={clearAllSubjects} style={styles.clearAllBtn}>Clear All</button>
                                </div>
                            </div>

                            {allSubjects.length === 0 ? (
                                <div style={styles.emptyState}>
                                    <div style={styles.emptyIcon}>📚</div>
                                    <h3>No Subjects Assigned</h3>
                                    <p>Go to Class Subjects page and assign subjects to this class first.</p>
                                </div>
                            ) : (
                                <div style={styles.subjectGrid}>
                                    {allSubjects.map(sub => {
                                        const isSelected = selectedSubjectIds.includes(sub.subjectId);
                                        return (
                                            <div key={sub.subjectId}
                                                onClick={() => toggleSubject(sub.subjectId)}
                                                style={{
                                                    ...styles.subjectTile,
                                                    backgroundColor: isSelected ? '#e8f5e9' : 'white',
                                                    border: isSelected ? '2px solid #28a745' : '2px solid #ddd',
                                                    color: isSelected ? '#28a745' : '#333'
                                                }}>
                                                <span style={styles.subjectCheckbox}>
                                                    {isSelected ? '✅' : '⬜'}
                                                </span>
                                                <span style={styles.subjectTileName}>{sub.subjectName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button onClick={handleProceedToMarkSheet} style={styles.proceedBtn}
                                disabled={loading || selectedSubjectIds.length === 0}>
                                {loading ? '⏳ Loading...' : `Continue → Enter Marks for ${selectedSubjectIds.length} Subject(s)`}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Mark Sheet ── */}
                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <div style={styles.stepHeaderLeft}>
                                <button onClick={handleBack} style={styles.backBtn}>← Back</button>
                                <div>
                                    <h2 style={styles.stepTitle}>✏️ Step 3 — Enter Marks</h2>
                                    <p style={styles.stepSubtitle}>
                                        {selectedClassName} | {selectedExamName}
                                    </p>
                                </div>
                            </div>
                            <div style={styles.infoBadgesRow}>
                                <span style={styles.infoBadge}>👥 {students.length} Students</span>
                                <span style={styles.infoBadge}>📚 {selectedSubjects.length} Subjects</span>
                                <span style={{ ...styles.infoBadge, backgroundColor: '#28a745' }}>
                                    ✅ {countEnteredMarks()} Marks Entered
                                </span>
                            </div>
                        </div>

                        {students.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>👥</div>
                                <h3>No Students Found</h3>
                                <p>Add students to this class first from the Students page.</p>
                            </div>
                        ) : (
                            <div style={styles.tableCard}>
                                <div style={styles.tableTopBar}>
                                    <div>
                                        <h3 style={styles.tableTitle}>📋 Mark Sheet</h3>
                                        <p style={styles.tableSubtitle}>
                                            Only the {selectedSubjects.length} selected subject(s) are shown. Empty cells will not be saved.
                                        </p>
                                    </div>
                                    <button onClick={handleSaveAll} style={styles.saveBtn} disabled={saving}>
                                        {saving ? '⏳ Saving...' : '💾 Save All Marks'}
                                    </button>
                                </div>

                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.subjectHeaderRow}>
                                                <th style={{ ...styles.stickyTh, minWidth: '40px' }}>#</th>
                                                <th style={{ ...styles.stickyTh, minWidth: '100px' }}>Adm No</th>
                                                <th style={{ ...styles.stickyTh, minWidth: '160px' }}>Student Name</th>
                                                {selectedSubjects.map(sub => (
                                                    <th key={sub.subjectId} style={styles.subjectTh}>
                                                        {sub.subjectName}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, index) => (
                                                <tr key={student.studentId}
                                                    style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={styles.td}>{index + 1}</td>
                                                    <td style={styles.td}>
                                                        <span style={styles.admNo}>{student.admissionNumber}</span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={styles.studentCell}>
                                                            <div style={{
                                                                ...styles.avatar,
                                                                backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c'
                                                            }}>
                                                                {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                            </div>
                                                            <strong style={styles.studentName}>
                                                                {student.firstName} {student.lastName}
                                                            </strong>
                                                        </div>
                                                    </td>
                                                    {selectedSubjects.map(subject => {
                                                        const markData = marks[student.studentId]?.[subject.subjectId];
                                                        const markValue = markData?.marks;
                                                        const gradeColor = getGradeColor(markValue);
                                                        const gradeLabel = getGradeLabel(markValue);
                                                        return (
                                                            <td key={subject.subjectId} style={styles.markCell}>
                                                                <div style={styles.markInputWrapper}>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        style={{
                                                                            ...styles.markInput,
                                                                            borderColor: markValue !== '' && markValue !== undefined ? gradeColor : '#ddd',
                                                                            backgroundColor: markValue !== '' && markValue !== undefined ? `${gradeColor}15` : 'white'
                                                                        }}
                                                                        value={markValue || ''}
                                                                        onChange={e => handleMarkChange(student.studentId, subject.subjectId, e.target.value)}
                                                                        placeholder="—"
                                                                    />
                                                                    {gradeLabel && (
                                                                        <span style={{ ...styles.gradeTag, backgroundColor: gradeColor }}>
                                                                            {gradeLabel}
                                                                        </span>
                                                                    )}
                                                                    {markData?.exists && (
                                                                        <span style={styles.existsDot} title="Already saved">●</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={styles.saveSection}>
                                    <button onClick={handleSaveAll} style={styles.saveBtnLarge} disabled={saving}>
                                        {saving ? '⏳ Saving all marks...' : '💾 Save All Marks'}
                                    </button>
                                    <p style={styles.hint}>
                                        ✅ Only cells with marks entered will be saved. Empty cells are skipped.
                                        <br />● Blue dot = already saved in database
                                    </p>
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
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    // Breadcrumb
    breadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
    breadItem: { fontSize: '14px', fontWeight: 'bold' },
    breadArrow: { color: '#999', fontSize: '16px' },

    // Step Header
    stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    stepHeaderLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
    stepTitle: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '20px' },
    stepSubtitle: { color: '#666', margin: 0, fontSize: '14px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    infoBadgesRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    infoBadge: { backgroundColor: '#1F3864', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },

    // Card
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', backgroundColor: 'white' },
    classDisplay: { padding: '10px 15px', borderRadius: '5px', border: '2px solid #1F3864', fontSize: '14px', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    lockedBadge: { backgroundColor: '#1F3864', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' },
    proceedBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', width: '100%' },

    // Subject Selection
    subjectToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' },
    subjectCount: { fontWeight: 'bold', color: '#1F3864', fontSize: '14px' },
    toolbarBtns: { display: 'flex', gap: '10px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
    clearAllBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
    subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' },
    subjectTile: { padding: '15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s' },
    subjectCheckbox: { fontSize: '20px' },
    subjectTileName: { fontSize: '14px', fontWeight: 'bold' },

    // Table card
    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '12px' },
    saveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    // Table
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    subjectHeaderRow: { backgroundColor: '#f8f9fa' },
    stickyTh: { padding: '10px 12px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #ddd', fontSize: '12px', backgroundColor: '#f8f9fa', whiteSpace: 'nowrap' },
    subjectTh: { padding: '8px 5px', textAlign: 'center', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #ddd', fontSize: '11px', backgroundColor: '#f8f9fa', minWidth: '90px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px', whiteSpace: 'nowrap' },
    markCell: { padding: '5px', borderBottom: '1px solid #eee', textAlign: 'center' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },

    // Student cell
    studentCell: { display: 'flex', alignItems: 'center', gap: '8px' },
    avatar: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '10px', flexShrink: 0 },
    studentName: { fontSize: '13px', color: '#1F3864' },
    admNo: { fontFamily: 'monospace', fontSize: '12px', color: '#666' },

    // Mark input
    markInputWrapper: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    markInput: { width: '70px', padding: '6px 4px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '13px', textAlign: 'center', outline: 'none' },
    gradeTag: { color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' },
    existsDot: { position: 'absolute', top: '2px', right: '2px', color: '#2E75B6', fontSize: '10px' },

    // Save section
    saveSection: { padding: '20px', borderTop: '2px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', backgroundColor: '#f8f9fa' },
    saveBtnLarge: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '12px 40px', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
    hint: { color: '#666', fontSize: '12px', fontStyle: 'italic', margin: 0, lineHeight: '1.8' },

    // Empty
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
};

export default MarkEntry;