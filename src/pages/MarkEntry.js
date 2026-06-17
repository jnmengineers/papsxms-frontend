import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function MarkEntry() {
    const role = localStorage.getItem('role');
    const linkedClassId = localStorage.getItem('linkedClassId');
    const linkedClassName = localStorage.getItem('linkedClassName');

    const [classes, setClasses] = useState([]);
    const [exams, setExams] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

   useEffect(() => {
    fetchClasses();
    fetchExams();
}, []);

useEffect(() => {
    // Auto select and lock class for teacher
    if (role === 'TEACHER' && linkedClassId) {
        setSelectedClass(linkedClassId);
        fetchStudentsByClass(linkedClassId);
        fetchSubjectsByClass(linkedClassId);
    }
}, [linkedClassId]);

    useEffect(() => {
        if (selectedClass) {
            fetchStudentsByClass(selectedClass);
            fetchSubjectsByClass(selectedClass);
        } else {
            setStudents([]);
            setSubjects([]);
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass && selectedExam && selectedSubject) {
            fetchExistingMarks();
        }
    }, [selectedSubject, selectedExam]);

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

    // ✅ Fixed — load subjects from class-subjects assignment
    const fetchSubjectsByClass = async (classId) => {
        try {
            const response = await api.get(`/api/class-subjects/by-class/${classId}`);
            if (response.data && response.data.length > 0) {
                const classSubjects = response.data.map(cs => cs.subject).filter(Boolean);
                setSubjects(classSubjects);
            } else {
                // Fallback to all subjects if no class-subject assignment
                const fallback = await api.get('/api/subjects');
                setSubjects(fallback.data);
            }
        } catch (err) {
            // Fallback to all subjects on error
            try {
                const fallback = await api.get('/api/subjects');
                setSubjects(fallback.data);
            } catch (e) {
                setError('Failed to load subjects');
            }
        }
    };

    const fetchStudentsByClass = async (classId) => {
        try {
            setLoading(true);
            setMarks({});
            setSuccessMsg('');
            const response = await api.get('/api/students');
            const classStudents = response.data.filter(s =>
                String(s.schoolClass?.classId) === String(classId)
            );
            setStudents(classStudents);
            setLoading(false);
        } catch (err) {
            setError('Failed to load students');
            setLoading(false);
        }
    };

    const fetchExistingMarks = async () => {
        try {
            const response = await api.get(`/api/results/by-exam/${selectedExam}`);
            const subjectResults = response.data.filter(r =>
                String(r.subject?.subjectId) === String(selectedSubject)
            );
            const existingMarks = {};
            subjectResults.forEach(result => {
                if (result.student?.studentId) {
                    existingMarks[result.student.studentId] = {
                        marks: result.marksObtained,
                        resultId: result.resultId,
                        exists: true
                    };
                }
            });
            setMarks(existingMarks);
        } catch (err) {
            console.error('Failed to load existing marks');
        }
    };

    const handleMarkChange = useCallback((studentId, value) => {
        setMarks(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                marks: value
            }
        }));
    }, []);

    const handleSaveAll = async () => {
                setSaving(true);
                setError('');
                setSuccessMsg('');
                let saved = 0;
                let updated = 0;
                let failed = 0;

                for (const student of students) {
                    const markData = marks[student.studentId];
                    if (!markData || markData.marks === '' || markData.marks === undefined) continue;

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
                                subject: { subjectId: parseInt(selectedSubject) },
                                exam: { examId: parseInt(selectedExam) }
                            });
                            saved++;
                        }
                    } catch (err) {
                        failed++;
                    }
                }

                setSaving(false);
                if (failed > 0) {
                    setError(`${failed} marks failed. ${saved} saved, ${updated} updated.`);
                } else {
                    setSuccessMsg(`✅ ${saved} new marks saved and ${updated} marks updated successfully!`);
                }
                fetchExistingMarks();
            };

    const getGrade = (mark) => {
        if (!mark && mark !== 0) return null;
        const m = parseFloat(mark);
        if (isNaN(m)) return null;
        if (m >= 80) return { color: '#28a745', label: 'A' };
        if (m >= 60) return { color: '#2E75B6', label: 'B' };
        if (m >= 40) return { color: '#ffc107', label: 'C' };
        return { color: '#dc3545', label: 'D' };
    };

    const selectedClassName = role === 'TEACHER' && linkedClassName
        ? linkedClassName
        : classes.find(c => String(c.classId) === String(selectedClass))?.className || '';

    const selectedExamName = exams.find(e => String(e.examId) === String(selectedExam))?.examName || '';
    const selectedSubjectName = subjects.find(s => String(s.subjectId) === String(selectedSubject))?.subjectName || '';

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
                <h2 style={styles.title}>✏️ Mark Entry</h2>
                <p style={styles.subtitle}>
                    {role === 'TEACHER' && linkedClassName
                        ? `Class Teacher — ${linkedClassName}`
                        : 'Select class, exam and subject to enter marks'}
                </p>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Selection */}
                <div style={styles.card}>
                    <div style={styles.grid3}>
                        {/* Class — hidden for teacher, shown for admin */}
                       <div style={styles.formGroup}>
                            <label style={styles.label}>📚 Class</label>
                            {role === 'TEACHER' ? (
                                // TEACHER — pre-selected and locked
                                <div style={styles.classDisplay}>
                                    🏫 {linkedClassName || 'No class assigned'}
                                    <span style={styles.lockedBadge}>🔒 Locked</span>
                                </div>
                            ) : (
                                // ADMIN — can select any class
                                <select style={styles.select} value={selectedClass}
                                    onChange={e => {
                                        setSelectedClass(e.target.value);
                                        setSelectedSubject('');
                                        setSelectedExam('');
                                        setMarks({});
                                        setSuccessMsg('');
                                    }}>
                                    <option value="">-- Select Class --</option>
                                    {classes.map(cls => (
                                        <option key={cls.classId} value={cls.classId}>
                                            {cls.className} — {cls.stream}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>📝 Select Exam</label>
                            <select style={styles.select} value={selectedExam}
                                onChange={e => {
                                    setSelectedExam(e.target.value);
                                    setMarks({});
                                    setSuccessMsg('');
                                }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.examName} (Term {exam.term})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>📖 Select Subject</label>
                            <select style={styles.select} value={selectedSubject}
                                onChange={e => {
                                    setSelectedSubject(e.target.value);
                                    setMarks({});
                                    setSuccessMsg('');
                                }}
                                disabled={!selectedClass}>
                                <option value="">-- Select Subject --</option>
                                {subjects.map(sub => (
                                    <option key={sub.subjectId} value={sub.subjectId}>
                                        {sub.subjectName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Mark Sheet */}
                {selectedClass && selectedExam && selectedSubject && (
                    <div style={styles.tableCard}>
                        <div style={styles.tableTopBar}>
                            <div>
                                <h3 style={styles.tableTitle}>Mark Sheet</h3>
                                <p style={styles.tableSubtitle}>
                                    {selectedClassName} | {selectedExamName} | {selectedSubjectName}
                                </p>
                            </div>
                            <div style={styles.tableBadges}>
                                <span style={styles.badge}>👥 {students.length} Students</span>
                                <span style={styles.badge}>
                                    ✅ {Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length} Entered
                                </span>
                            </div>
                        </div>

                        {loading ? (
                            <p style={styles.centerMsg}>⏳ Loading students...</p>
                        ) : students.length === 0 ? (
                            <p style={styles.centerMsg}>
                                ⚠️ No students found in this class.
                                Please add students first.
                            </p>
                        ) : (
                            <>
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={styles.th}>#</th>
                                                <th style={styles.th}>Adm No</th>
                                                <th style={styles.th}>Student Name</th>
                                                <th style={styles.th}>Gender</th>
                                                <th style={styles.th}>Marks (0-100)</th>
                                                <th style={styles.th}>Grade</th>
                                                <th style={styles.th}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, index) => {
                                                const markData = marks[student.studentId];
                                                const grade = getGrade(markData?.marks);
                                                return (
                                                    <tr key={student.studentId}
                                                        style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={styles.td}>{index + 1}</td>
                                                        <td style={styles.td}>{student.admissionNumber}</td>
                                                        <td style={styles.td}>
                                                            <strong>{student.firstName} {student.lastName}</strong>
                                                        </td>
                                                        <td style={styles.td}>
                                                            <span style={{
                                                                backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c',
                                                                color: 'white', padding: '2px 8px',
                                                                borderRadius: '3px', fontSize: '12px'
                                                            }}>
                                                                {student.gender}
                                                            </span>
                                                        </td>
                                                        <td style={styles.td}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                style={{
                                                                    ...styles.markInput,
                                                                    borderColor: grade ? grade.color : '#ddd'
                                                                }}
                                                                value={markData?.marks || ''}
                                                                onChange={e => handleMarkChange(student.studentId, e.target.value)}
                                                                placeholder="0 - 100"
                                                            />
                                                        </td>
                                                        <td style={styles.td}>
                                                            {grade && (
                                                                <span style={{
                                                                    backgroundColor: grade.color,
                                                                    color: 'white',
                                                                    padding: '4px 12px',
                                                                    borderRadius: '3px',
                                                                    fontWeight: 'bold',
                                                                    fontSize: '14px'
                                                                }}>
                                                                    {grade.label}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={styles.td}>
                                                            {markData?.exists ? (
                                                                <span style={styles.updateBadge}>✏️ Will Update</span>
                                                            ) : markData?.marks ? (
                                                                <span style={styles.newBadge}>🆕 New</span>
                                                            ) : (
                                                                <span style={styles.emptyBadge}>— Not entered</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Save Button */}
                                <div style={styles.saveSection}>
                                    <button
                                        onClick={handleSaveAll}
                                        style={styles.saveBtn}
                                        disabled={saving}>
                                        {saving ? '⏳ Saving marks...' : '💾 Save All Marks'}
                                    </button>
                                    <p style={styles.hint}>
                                        * Only rows with marks entered will be saved
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Instructions */}
                {(!selectedClass || !selectedExam || !selectedSubject) && (
                    <div style={styles.instructionCard}>
                        <h3 style={{ color: '#1F3864', marginBottom: '15px' }}>
                            📋 How to Enter Marks
                        </h3>
                        <ol style={{ paddingLeft: '20px', lineHeight: '2.2', color: '#555' }}>
                            {role !== 'TEACHER' && <li>Select the <strong>Class</strong></li>}
                            <li>Select the <strong>Exam</strong></li>
                            <li>Select the <strong>Subject</strong></li>
                            <li>All students in the class will appear</li>
                            <li>Enter marks for each student (0 - 100)</li>
                            <li>Grade is calculated automatically</li>
                            <li>Click <strong>💾 Save All Marks</strong></li>
                            <li>Repeat for each subject</li>
                            <li>Go to <strong>Report Cards</strong> to generate report cards</li>
                        </ol>
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
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', marginBottom: '25px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', border: '1px solid #ffcdd2', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', border: '1px solid #c3e6cb', marginBottom: '15px' },
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', backgroundColor: 'white', cursor: 'pointer' },
    classDisplay: { padding: '10px', borderRadius: '5px', border: '2px solid #1F3864', fontSize: '14px', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold' },
    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '20px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '10px' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },
    centerMsg: { padding: '40px', textAlign: 'center', color: '#666', fontSize: '15px' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
    thead: { backgroundColor: '#f8f9fa' },
    th: { padding: '12px 15px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    markInput: { width: '110px', padding: '8px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', textAlign: 'center', outline: 'none' },
    updateBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    newBadge: { backgroundColor: '#d4edda', color: '#155724', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    emptyBadge: { color: '#aaa', fontSize: '12px' },
    saveSection: { padding: '20px', borderTop: '2px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', backgroundColor: '#f8f9fa' },
    saveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '12px 35px', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
    hint: { color: '#666', fontSize: '13px', fontStyle: 'italic', margin: 0 },
    instructionCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },

    classDisplay: {
    padding: '10px 15px',
    borderRadius: '5px',
    border: '2px solid #1F3864',
    fontSize: '14px',
    backgroundColor: '#e3f2fd',
    color: '#1F3864',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
},
lockedBadge: {
    backgroundColor: '#1F3864',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold'
},
};

export default MarkEntry;