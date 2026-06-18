import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import { classDisplayName, gradeLabel, streamLabel } from '../utils/classUtils';
import logo2 from '../assets/logo2.png';

// ── Printable Blank Mark Sheet ────────────────────────────────────────────────
const PrintableMarkSheet = React.forwardRef(({ students, subjects, className, examName, academicYear, term }, ref) => (
    <div ref={ref} style={pStyles.page}>
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
            <div style={pStyles.sheetTitleBar}><h2 style={pStyles.sheetTitle}>MARK ENTRY SHEET</h2></div>
        </div>
        <div style={pStyles.infoRow}>
            <span style={pStyles.infoItem}><strong>Class:</strong> {className}</span>
            <span style={pStyles.infoItem}><strong>Exam:</strong> {examName}</span>
            <span style={pStyles.infoItem}><strong>Year:</strong> {academicYear}</span>
            <span style={pStyles.infoItem}><strong>Term:</strong> {term}</span>
            <span style={pStyles.infoItem}><strong>Date:</strong> _______________</span>
            <span style={pStyles.infoItem}><strong>Teacher:</strong> _______________</span>
        </div>
        <div style={pStyles.tableWrapper}>
            <table style={pStyles.table}>
                <thead>
                    <tr>
                        <th style={{ ...pStyles.th, ...pStyles.stickyCol }}>#</th>
                        <th style={{ ...pStyles.th, ...pStyles.admCol }}>Adm No</th>
                        <th style={{ ...pStyles.th, ...pStyles.nameCol }}>Student Name</th>
                        {subjects.map(sub => (
                            <th key={sub.subjectId} style={pStyles.subjectTh}>
                                <div style={pStyles.rotatedHeader}>{sub.subjectName}</div>
                            </th>
                        ))}
                        <th style={pStyles.subjectTh}><div style={pStyles.rotatedHeader}>Total</div></th>
                        <th style={pStyles.subjectTh}><div style={pStyles.rotatedHeader}>Average</div></th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => (
                        <tr key={student.studentId} style={index % 2 === 0 ? pStyles.trEven : pStyles.trOdd}>
                            <td style={{ ...pStyles.td, ...pStyles.stickyCol, textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ ...pStyles.td, ...pStyles.admCol }}>{student.admissionNumber}</td>
                            <td style={{ ...pStyles.td, ...pStyles.nameCol }}>{student.firstName} {student.lastName}</td>
                            {subjects.map(sub => <td key={sub.subjectId} style={pStyles.markTd}></td>)}
                            <td style={pStyles.markTd}></td>
                            <td style={pStyles.markTd}></td>
                        </tr>
                    ))}
                    <tr style={pStyles.avgRow}>
                        <td colSpan={3} style={{ ...pStyles.td, fontWeight: 'bold', fontSize: '10px' }}>Subject Average</td>
                        {subjects.map(sub => <td key={sub.subjectId} style={pStyles.markTd}></td>)}
                        <td style={pStyles.markTd}></td>
                        <td style={pStyles.markTd}></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div style={pStyles.footer}>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Class Teacher: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Invigilator: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
            <div style={pStyles.signBox}>
                <p style={pStyles.signLabel}>Principal: _________________________</p>
                <p style={pStyles.signLabel}>Signature: _____________ Date: _________</p>
            </div>
        </div>
        <p style={pStyles.footerNote}>Pipeline Adventist School — Official Mark Entry Sheet — {new Date().toLocaleDateString()}</p>
    </div>
));

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
    const [mode, setMode] = useState('single');

    // Invigilator mode
    const [isInvigilating, setIsInvigilating] = useState(false);
    const [invigilatingClassId, setInvigilatingClassId] = useState('');

    // Single subject mode
    const [selectedSubject, setSelectedSubject] = useState('');
    const [marks, setMarks] = useState({});

    // Multi subject mode
    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
    const [multiMarks, setMultiMarks] = useState({});

    const [loading, setLoading] = useState(false);
    const [studentSaveStatus, setStudentSaveStatus] = useState({}); // { studentId: 'saving'|'saved'|'error' }
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [step, setStep] = useState(1);

    const printRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `MarkSheet_${clsName()}_${examName()}`
    });

    function clsName() {
        if (isInvigilating && invigilatingClassId) {
            const cls = classes.find(c => String(c.classId) === String(invigilatingClassId));
            return cls ? classDisplayName(cls) : '';
        }
        if (role === 'TEACHER') return linkedClassName || '';
        const cls = classes.find(c => String(c.classId) === String(selectedClass));
        return cls ? classDisplayName(cls) : '';
    }

    function examName() {
        return exams.find(e => String(e.examId) === String(selectedExam))?.examName || '';
    }

    function activeClassId() {
        if (isInvigilating && invigilatingClassId) return invigilatingClassId;
        if (role === 'TEACHER') return linkedClassId;
        return selectedClass;
    }

    function examObj() {
        return exams.find(e => String(e.examId) === String(selectedExam));
    }

    useEffect(() => { fetchClasses(); fetchExams(); }, []);

    useEffect(() => {
        if (role === 'TEACHER' && linkedClassId && !isInvigilating) {
            setSelectedClass(linkedClassId);
        }
    }, [linkedClassId, isInvigilating]);

    useEffect(() => {
        const classId = activeClassId();
        if (classId) {
            fetchSubjectsByClass(classId);
            fetchStudentsByClass(classId);
        } else {
            setSubjects([]); setStudents([]);
        }
    }, [selectedClass, invigilatingClassId, isInvigilating]);

    useEffect(() => {
        if (activeClassId() && selectedExam && selectedSubject && mode === 'single') {
            fetchExistingMarksSingle();
        }
    }, [selectedSubject, selectedExam, mode]);

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); } catch (e) {}
    };

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data); } catch (e) {}
    };

    const fetchSubjectsByClass = async (classId) => {
        try {
            const r = await api.get(`/api/class-subjects/by-class/${classId}`);
            if (r.data?.length > 0) setSubjects(r.data.map(cs => cs.subject).filter(Boolean));
            else { const f = await api.get('/api/subjects'); setSubjects(f.data); }
        } catch (e) {
            try { const f = await api.get('/api/subjects'); setSubjects(f.data); } catch (_) {}
        }
    };

    // ✅ Fixed — fallback to className/stream matching when schoolClass is missing
    const fetchStudentsByClass = async (classId) => {
        try {
            setLoading(true);
            const r = await api.get('/api/students');
            // If classes not loaded yet, fetch them now
            let allClasses = classes;
            if (allClasses.length === 0) {
                const cr = await api.get('/api/classes');
                allClasses = cr.data;
                setClasses(cr.data);
            }
            const targetClass = allClasses.find(c => String(c.classId) === String(classId));
            setStudents(r.data.filter(s => {
                // Primary: match by classId via schoolClass
                if (String(s.schoolClass?.classId) === String(classId)) return true;
                // Fallback: match by className or gradeLevel+stream
                if (targetClass && s.className) {
                    if (s.className === targetClass.className) return true;
                    if (targetClass.stream) {
                        return s.stream === targetClass.stream &&
                            (s.className?.includes(targetClass.gradeLevel) ||
                             s.className === targetClass.gradeLevel);
                    }
                    return s.className?.includes(targetClass.gradeLevel);
                }
                return false;
            }));
            setLoading(false);
        } catch (e) { setLoading(false); }
    };

    const fetchExistingMarksSingle = async () => {
        try {
            const r = await api.get(`/api/results/by-exam/${selectedExam}`);
            const existing = {};
            r.data.filter(res => String(res.subject?.subjectId) === String(selectedSubject))
                .forEach(res => {
                    if (res.student?.studentId) {
                        existing[res.student.studentId] = { marks: res.marksObtained, resultId: res.resultId, exists: true };
                    }
                });
            setMarks(existing);
        } catch (e) {}
    };

    const fetchExistingMarksMulti = async (subjectIds) => {
        try {
            const r = await api.get(`/api/results/by-exam/${selectedExam}`);
            const existing = {};
            r.data.forEach(res => {
                const sid = res.student?.studentId;
                const subId = res.subject?.subjectId;
                if (sid && subId && subjectIds.includes(subId)) {
                    if (!existing[sid]) existing[sid] = {};
                    existing[sid][subId] = { marks: res.marksObtained, resultId: res.resultId, exists: true };
                }
            });
            setMultiMarks(existing);
        } catch (e) {}
    };

    const handleMarkChange = useCallback((studentId, value) => {
        setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], marks: value } }));
    }, []);

    const handleMultiMarkChange = useCallback((studentId, subjectId, value) => {
        setMultiMarks(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [subjectId]: { ...prev[studentId]?.[subjectId], marks: value } }
        }));
    }, []);

    const toggleSubject = (subjectId) => {
        setSelectedSubjectIds(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
    };

    // ✅ Bulk save — one API call for all marks
    const handleSaveSingle = async () => {
        setSaving(true); setError(''); setSuccessMsg('');

        // Build bulk payload — only include students with marks entered
        const results = students
            .filter(student => {
                const markData = marks[student.studentId];
                if (!markData || markData.marks === '' || markData.marks === undefined) return false;
                const val = parseFloat(markData.marks);
                return !isNaN(val) && val >= 0 && val <= 100;
            })
            .map(student => {
                const markData = marks[student.studentId];
                return {
                    studentId: student.studentId,
                    subjectId: parseInt(selectedSubject),
                    marksObtained: parseFloat(markData.marks),
                    maxMarks: 100,
                    resultId: markData.resultId || null  // null = new, id = update
                };
            });

        if (results.length === 0) {
            setSaving(false);
            // Show more helpful message
            const totalStudents = students.length;
            const totalMarksEntered = Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length;
            setError(`No valid marks to save. Students loaded: ${totalStudents}. Marks entered: ${totalMarksEntered}. Make sure marks are between 0-100.`);
            return;
        }

        try {
            const response = await api.post('/api/results/bulk-save', {
                examId: parseInt(selectedExam),
                results
            });
            const data = response.data;
            setSaving(false);
            if (data.failed > 0) {
                setError(`⚠️ ${data.failed} failed. ${data.saved} saved, ${data.updated} updated. ${data.errors?.[0] || ''}`);
            } else {
                setSuccessMsg(`✅ ${data.saved} new mark(s) saved, ${data.updated} updated! ${data.skipped > 0 ? `(${data.skipped} skipped)` : ''}`);
            }
            fetchExistingMarksSingle();
        } catch (e) {
            setSaving(false);
            setError(`Save failed: ${e.response?.data?.message || e.message}. Please try again.`);
            console.error('Bulk save error:', e.response?.data || e.message);
        }
    };

    // ✅ Bulk save — one API call for ALL marks across all subjects
    const handleSaveMulti = async () => {
        setSaving(true); setError(''); setSuccessMsg('');
        const selectedSubjects = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));

        // Build bulk payload — only include cells with marks entered
        const results = [];
        for (const student of students) {
            for (const subject of selectedSubjects) {
                const markData = multiMarks[student.studentId]?.[subject.subjectId];
                if (!markData || markData.marks === '' || markData.marks === undefined) continue;
                const val = parseFloat(markData.marks);
                if (isNaN(val) || val < 0 || val > 100) continue;
                results.push({
                    studentId: student.studentId,
                    subjectId: subject.subjectId,
                    marksObtained: val,
                    maxMarks: 100,
                    resultId: markData.resultId || null
                });
            }
        }

        if (results.length === 0) {
            setSaving(false);
            // Show more helpful message
            const totalStudents = students.length;
            const totalMarksEntered = Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length;
            setError(`No valid marks to save. Students loaded: ${totalStudents}. Marks entered: ${totalMarksEntered}. Make sure marks are between 0-100.`);
            return;
        }

        try {
            const response = await api.post('/api/results/bulk-save', {
                examId: parseInt(selectedExam),
                results
            });
            const data = response.data;
            setSaving(false);
            if (data.failed > 0) {
                setError(`⚠️ ${data.failed} failed. ${data.saved} saved, ${data.updated} updated. ${data.errors?.[0] || ''}`);
            } else {
                setSuccessMsg(`✅ ${data.saved} new mark(s) saved, ${data.updated} updated! ${data.skipped > 0 ? `(${data.skipped} empty cells skipped)` : ''}`);
            }
            fetchExistingMarksMulti(selectedSubjectIds);
        } catch (e) {
            setSaving(false);
            setError(`Save failed: ${e.response?.data?.message || e.message}. Please try again.`);
            console.error('Bulk save error:', e.response?.data || e.message);
        }
    };

    // ── Save marks for a single student ─────────────────────────────────────
    const handleSaveStudent = async (student) => {
        const selectedSubjects = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));
        const studentMarks = mode === 'single'
            ? [{ subjectId: parseInt(selectedSubject), markData: marks[student.studentId] }]
            : selectedSubjects.map(sub => ({ subjectId: sub.subjectId, markData: multiMarks[student.studentId]?.[sub.subjectId] }));

        const results = studentMarks
            .filter(({ markData }) => markData?.marks !== '' && markData?.marks !== undefined)
            .map(({ subjectId, markData }) => {
                const val = parseFloat(markData.marks);
                if (isNaN(val) || val < 0 || val > 100) return null;
                return {
                    studentId: student.studentId,
                    subjectId,
                    marksObtained: val,
                    maxMarks: 100,
                    resultId: markData.resultId || null
                };
            })
            .filter(Boolean);

        if (results.length === 0) {
            setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            setTimeout(() => setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: null })), 2000);
            return;
        }

        setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'saving' }));

        try {
            const response = await api.post('/api/results/bulk-save', {
                examId: parseInt(selectedExam),
                results
            });
            const data = response.data;
            if (data.failed > 0) {
                setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            } else {
                setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'saved' }));
                // Refresh marks for this student
                if (mode === 'single') fetchExistingMarksSingle();
                else fetchExistingMarksMulti(selectedSubjectIds);
            }
        } catch (e) {
            setStudentSaveStatus(prev => ({ ...prev, [student.studentId]: 'error' }));
            console.error('Save student failed:', student.firstName, e.response?.data || e.message);
        }
    };

    const handleProceedToSubjectSelect = async () => {
        if (!activeClassId() || !selectedExam) { setError('Select class and exam first'); return; }
        setSelectedSubjectIds([]); setMultiMarks({}); setStep(2);
    };

    const handleProceedToMarkSheet = async () => {
        if (selectedSubjectIds.length === 0) { setError('Select at least one subject'); return; }
        setError(''); setLoading(true);
        await fetchExistingMarksMulti(selectedSubjectIds);
        setLoading(false); setStep(3);
    };

    const handleReset = () => {
        setStep(1); setSelectedSubject(''); setSelectedSubjectIds([]);
        setMarks({}); setMultiMarks({}); setError(''); setSuccessMsg('');
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

    const selectedSubjectsForMulti = subjects.filter(s => selectedSubjectIds.includes(s.subjectId));
    const countMultiEntered = () => {
        let count = 0;
        Object.values(multiMarks).forEach(s => Object.values(s).forEach(m => { if (m?.marks !== '' && m?.marks !== undefined) count++; }));
        return count;
    };

    const currentExamObj = examObj();
    const currentClsName = clsName();
    const currentExamName = examName();
    const printSubjects = selectedSubjectIds.length > 0 ? selectedSubjectsForMulti : subjects;

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
                        <h2 style={styles.title}>✏️ Mark Entry</h2>
                        <p style={styles.subtitle}>
                            {role === 'TEACHER' && !isInvigilating
                                ? `Class Teacher — ${linkedClassName}`
                                : isInvigilating && invigilatingClassId
                                    ? `👁️ Invigilating: ${currentClsName}`
                                    : 'Enter marks for students'}
                        </p>
                    </div>
                    <div style={styles.headerBtns}>
                        {activeClassId() && students.length > 0 && subjects.length > 0 && (
                            <button onClick={handlePrint} style={styles.printBtn}>🖨️ Print Blank Sheet</button>
                        )}
                        {(step > 1 || selectedSubject) && (
                            <button onClick={handleReset} style={styles.resetBtn}>↺ Reset</button>
                        )}
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* ── INVIGILATOR TOGGLE (Teacher only) ── */}
                {role === 'TEACHER' && (
                    <div style={styles.invigilatorCard}>
                        <div style={styles.invigilatorRow}>
                            <div>
                                <strong style={styles.invigilatorTitle}>👁️ Invigilating a Different Class?</strong>
                                <p style={styles.invigilatorDesc}>
                                    Enable this if you are invigilating another class and need to enter their marks.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsInvigilating(!isInvigilating);
                                    setInvigilatingClassId('');
                                    handleReset();
                                    setStudents([]);
                                    setSubjects([]);
                                }}
                                style={isInvigilating ? styles.invigilatorBtnActive : styles.invigilatorBtn}>
                                {isInvigilating ? '✅ Invigilating Mode ON — Click to Disable' : 'Enable Invigilator Mode'}
                            </button>
                        </div>
                        {isInvigilating && (
                            <div style={styles.invigilatorClassSelect}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>🏫 Select Class You Are Invigilating</label>
                                    <select style={styles.select} value={invigilatingClassId}
                                        onChange={e => {
                                            setInvigilatingClassId(e.target.value);
                                            handleReset();
                                        }}>
                                        <option value="">-- Select Class --</option>
                                        {classes
                                            .filter(c => String(c.classId) !== String(linkedClassId))
                                            .map(cls => (
                                                <option key={cls.classId} value={cls.classId}>
                                                    {classDisplayName(cls)}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                {invigilatingClassId && (
                                    <div style={styles.invigilatingBadge}>
                                        👁️ Now entering marks for: <strong>{currentClsName}</strong>
                                        <span style={styles.invigilatingNote}> (not your own class)</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── MODE TABS ── */}
                <div style={styles.modeTabs}>
                    <button onClick={() => { setMode('single'); handleReset(); }} style={{
                        ...styles.modeTab,
                        backgroundColor: mode === 'single' ? '#1F3864' : 'white',
                        color: mode === 'single' ? 'white' : '#1F3864'
                    }}>
                        📖 Single Subject
                        <span style={styles.modeTabDesc}>One subject at a time</span>
                    </button>
                    <button onClick={() => { setMode('multi'); handleReset(); }} style={{
                        ...styles.modeTab,
                        backgroundColor: mode === 'multi' ? '#1F3864' : 'white',
                        color: mode === 'multi' ? 'white' : '#1F3864'
                    }}>
                        📚 Multiple Subjects
                        <span style={styles.modeTabDesc}>All subjects in one table</span>
                    </button>
                </div>

                {/* ── SETUP CARD ── */}
                <div style={styles.card}>
                    <div style={styles.grid3}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>🏫 Class</label>
                            {role === 'TEACHER' && !isInvigilating ? (
                                <div style={styles.classDisplay}>
                                    {linkedClassName || 'No class assigned'}
                                    <span style={styles.lockedBadge}>🔒 Your Class</span>
                                </div>
                            ) : role === 'TEACHER' && isInvigilating ? (
                                <div style={{ ...styles.classDisplay, borderColor: '#fd7e14', backgroundColor: '#fff3e0' }}>
                                    {invigilatingClassId ? currentClsName : 'Select class above ↑'}
                                    <span style={{ ...styles.lockedBadge, backgroundColor: '#fd7e14' }}>👁️ Invigilating</span>
                                </div>
                            ) : (
                                <select style={styles.select} value={selectedClass}
                                    onChange={e => { setSelectedClass(e.target.value); handleReset(); }}>
                                    <option value="">-- Select Class --</option>
                                    {classes.map(cls => (
                                        <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>📝 Exam</label>
                            <select style={styles.select} value={selectedExam}
                                onChange={e => { setSelectedExam(e.target.value); setMarks({}); setMultiMarks({}); setSuccessMsg(''); }}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.examName} — {exam.academicYear} Term {exam.term}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {mode === 'single' && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>📖 Subject</label>
                                <select style={styles.select} value={selectedSubject}
                                    onChange={e => { setSelectedSubject(e.target.value); setMarks({}); setSuccessMsg(''); }}
                                    disabled={!activeClassId()}>
                                    <option value="">-- Select Subject --</option>
                                    {subjects.map(sub => (
                                        <option key={sub.subjectId} value={sub.subjectId}>{sub.subjectName}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {mode === 'multi' && step === 1 && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>&nbsp;</label>
                                <button onClick={handleProceedToSubjectSelect}
                                    style={styles.proceedBtn}
                                    disabled={!activeClassId() || !selectedExam}>
                                    Continue → Select Subjects
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── SINGLE MODE MARK SHEET ── */}
                {mode === 'single' && activeClassId() && selectedExam && selectedSubject && (
                    <div style={styles.tableCard}>
                        <div style={styles.tableTopBar}>
                            <div>
                                <h3 style={styles.tableTitle}>
                                    📋 {subjects.find(s => String(s.subjectId) === String(selectedSubject))?.subjectName}
                                    {isInvigilating && <span style={styles.invigilatorTag}> 👁️ Invigilating</span>}
                                </h3>
                                <p style={styles.tableSubtitle}>{currentClsName} | {currentExamName}</p>
                            </div>
                            <div style={styles.tableBadges}>
                                <span style={styles.badge}>👥 {students.length}</span>
                                <span style={styles.badge}>✅ {Object.values(marks).filter(m => m?.marks !== '' && m?.marks !== undefined).length}</span>
                            </div>
                        </div>
                        {loading ? <p style={styles.centerMsg}>⏳ Loading students...</p> : students.length === 0 ? (
                            <p style={styles.centerMsg}>⚠️ No students found in this class</p>
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
                                                <th style={styles.th}>Save</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, index) => {
                                                const markData = marks[student.studentId];
                                                const grade = getGrade(markData?.marks);
                                                return (
                                                    <tr key={student.studentId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                        <td style={styles.td}>{index + 1}</td>
                                                        <td style={styles.td}><span style={styles.admNo}>{student.admissionNumber}</span></td>
                                                        <td style={styles.td}><strong>{student.firstName} {student.lastName}</strong></td>
                                                        <td style={styles.td}>
                                                            <span style={{ backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                                                                {student.gender}
                                                            </span>
                                                        </td>
                                                        <td style={styles.td}>
                                                            <input type="number" min="0" max="100"
                                                                style={{ ...styles.markInput, borderColor: grade ? grade.color : '#ddd' }}
                                                                value={markData?.marks || ''}
                                                                onChange={e => handleMarkChange(student.studentId, e.target.value)}
                                                                placeholder="—" />
                                                        </td>
                                                        <td style={styles.td}>
                                                            {grade && <span style={{ backgroundColor: grade.color, color: 'white', padding: '3px 10px', borderRadius: '3px', fontWeight: 'bold', fontSize: '13px' }}>{grade.label}</span>}
                                                        </td>
                                                        <td style={styles.td}>
                                                            {studentSaveStatus[student.studentId] === 'saving'
                                                                ? <span style={styles.savingBadge}>⏳ Saving...</span>
                                                                : studentSaveStatus[student.studentId] === 'saved'
                                                                    ? <span style={styles.savedBadge}>✅ Saved</span>
                                                                    : studentSaveStatus[student.studentId] === 'error'
                                                                        ? <span style={styles.errorBadge}>❌ Failed</span>
                                                                        : markData?.exists ? <span style={styles.updateBadge}>✏️ Update</span>
                                                                            : markData?.marks ? <span style={styles.newBadge}>🆕 New</span>
                                                                            : <span style={styles.emptyBadge}>—</span>}
                                                        </td>
                                                        <td style={styles.td}>
                                                            <button
                                                                onClick={() => handleSaveStudent(student)}
                                                                style={styles.saveRowBtn}
                                                                disabled={studentSaveStatus[student.studentId] === 'saving'}>
                                                                💾
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.saveSection}>
                                    <button onClick={handleSaveSingle} style={styles.saveBtn} disabled={saving}>
                                        {saving ? '⏳ Saving...' : '💾 Save All Marks'}
                                    </button>
                                    <p style={styles.hint}>
                                        ⚠️ Empty cells are <strong>not saved</strong>. Enter <strong>0</strong> for absent students or those who scored zero.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── MULTI MODE STEP 2: Subject Selection ── */}
                {mode === 'multi' && step === 2 && (
                    <div style={styles.card}>
                        <div style={styles.subjectToolbar}>
                            <h3 style={styles.sectionTitle}>📚 Select Subjects Tested</h3>
                            <div style={styles.toolbarBtns}>
                                <button onClick={() => setSelectedSubjectIds(subjects.map(s => s.subjectId))} style={styles.selectAllBtn}>All</button>
                                <button onClick={() => setSelectedSubjectIds([])} style={styles.clearAllBtn}>Clear</button>
                            </div>
                        </div>
                        <p style={styles.subjectHint}>✅ {selectedSubjectIds.length}/{subjects.length} selected</p>
                        <div style={styles.subjectGrid}>
                            {subjects.map(sub => {
                                const isSelected = selectedSubjectIds.includes(sub.subjectId);
                                return (
                                    <div key={sub.subjectId} onClick={() => toggleSubject(sub.subjectId)}
                                        style={{ ...styles.subjectTile, backgroundColor: isSelected ? '#e8f5e9' : 'white', border: isSelected ? '2px solid #28a745' : '2px solid #ddd', color: isSelected ? '#28a745' : '#333' }}>
                                        <span style={styles.subjectCheck}>{isSelected ? '✅' : '⬜'}</span>
                                        <span style={styles.subjectName}>{sub.subjectName}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={handleProceedToMarkSheet} style={styles.proceedBtnLarge}
                            disabled={selectedSubjectIds.length === 0 || loading}>
                            {loading ? '⏳ Loading...' : `Continue → Enter Marks (${selectedSubjectIds.length} subjects)`}
                        </button>
                    </div>
                )}

                {/* ── MULTI MODE STEP 3: Pivot Table ── */}
                {mode === 'multi' && step === 3 && (
                    <div style={styles.tableCard}>
                        <div style={styles.tableTopBar}>
                            <div>
                                <h3 style={styles.tableTitle}>
                                    📋 Multi-Subject Mark Sheet
                                    {isInvigilating && <span style={styles.invigilatorTag}> 👁️ Invigilating</span>}
                                </h3>
                                <p style={styles.tableSubtitle}>{currentClsName} | {currentExamName} | {selectedSubjectsForMulti.length} subjects</p>
                            </div>
                            <div style={styles.tableBadges}>
                                <span style={styles.badge}>👥 {students.length}</span>
                                <span style={{ ...styles.badge, backgroundColor: '#28a745' }}>✅ {countMultiEntered()}</span>
                            </div>
                        </div>
                        {loading ? <p style={styles.centerMsg}>⏳ Loading...</p> : (
                            <>
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.thead}>
                                                <th style={{ ...styles.th, position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2 }}>#</th>
                                                <th style={{ ...styles.th, position: 'sticky', left: '50px', backgroundColor: '#f8f9fa', zIndex: 2, minWidth: '160px' }}>Student Name</th>
                                                {selectedSubjectsForMulti.map(sub => (
                                                    <th key={sub.subjectId} style={{ ...styles.th, textAlign: 'center', minWidth: '90px', backgroundColor: '#2E75B6', color: 'white', fontSize: '11px' }}>
                                                        {sub.subjectName}
                                                    </th>
                                                ))}
                                                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: '#28a745', color: 'white', minWidth: '60px' }}>Save</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, index) => (
                                                <tr key={student.studentId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={{ ...styles.td, position: 'sticky', left: 0, backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', zIndex: 1 }}>{index + 1}</td>
                                                    <td style={{ ...styles.td, position: 'sticky', left: '50px', backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', zIndex: 1, borderRight: '2px solid #ddd' }}>
                                                        <strong style={{ fontSize: '13px' }}>{student.firstName} {student.lastName}</strong>
                                                        <div style={{ fontSize: '11px', color: '#999' }}>{student.admissionNumber}</div>
                                                    </td>
                                                    {selectedSubjectsForMulti.map(subject => {
                                                        const markData = multiMarks[student.studentId]?.[subject.subjectId];
                                                        const grade = getGrade(markData?.marks);
                                                        return (
                                                            <td key={subject.subjectId} style={{ ...styles.td, textAlign: 'center', padding: '4px' }}>
                                                                <div style={styles.multiMarkCell}>
                                                                    <input type="number" min="0" max="100"
                                                                        style={{ ...styles.multiMarkInput, borderColor: grade ? grade.color : '#ddd', backgroundColor: grade ? `${grade.color}15` : 'white' }}
                                                                        value={markData?.marks || ''}
                                                                        onChange={e => handleMultiMarkChange(student.studentId, subject.subjectId, e.target.value)}
                                                                        placeholder="—" />
                                                                    {grade && <span style={{ fontSize: '10px', fontWeight: 'bold', color: grade.color }}>{grade.label}</span>}
                                                                    {markData?.exists && <span style={styles.savedDot}>●</span>}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    {/* Per-student save button */}
                                                    <td style={{ ...styles.td, textAlign: 'center', padding: '4px' }}>
                                                        {studentSaveStatus[student.studentId] === 'saving'
                                                            ? <span style={styles.savingBadge}>⏳</span>
                                                            : studentSaveStatus[student.studentId] === 'saved'
                                                                ? <span style={styles.savedBadge}>✅</span>
                                                                : studentSaveStatus[student.studentId] === 'error'
                                                                    ? <button onClick={() => handleSaveStudent(student)} style={styles.retryBtn}>❌ Retry</button>
                                                                    : <button onClick={() => handleSaveStudent(student)} style={styles.saveRowBtn}>💾</button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={styles.saveSection}>
                                    <button onClick={handleSaveMulti} style={styles.saveBtn} disabled={saving}>
                                        {saving ? '⏳ Saving...' : '💾 Save All Marks'}
                                    </button>
                                    <button onClick={() => setStep(2)} style={styles.backBtn}>← Change Subjects</button>
                                    <p style={styles.hint}>
                                        ⚠️ Empty cells are <strong>not saved</strong>. Enter <strong>0</strong> for absent or zero-score students.
                                        ● = already saved in database.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden Printable Mark Sheet */}
            <div style={{ display: 'none' }}>
                <PrintableMarkSheet
                    ref={printRef}
                    students={students}
                    subjects={printSubjects}
                    className={currentClsName}
                    examName={currentExamName}
                    academicYear={currentExamObj?.academicYear || ''}
                    term={currentExamObj?.term || ''}
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
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    headerBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    resetBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    printBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    // Invigilator
    invigilatorCard: { backgroundColor: '#fff8e1', border: '2px solid #ffc107', borderRadius: '10px', padding: '15px 20px', marginBottom: '20px' },
    invigilatorRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    invigilatorTitle: { color: '#856404', fontSize: '15px', display: 'block', marginBottom: '4px' },
    invigilatorDesc: { color: '#856404', fontSize: '12px', margin: 0 },
    invigilatorBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    invigilatorBtnActive: { backgroundColor: '#fd7e14', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },
    invigilatorClassSelect: { marginTop: '12px' },
    invigilatingBadge: { backgroundColor: '#fff3e0', border: '1px solid #fd7e14', color: '#e65100', padding: '8px 14px', borderRadius: '5px', fontSize: '13px', marginTop: '10px', display: 'inline-block' },
    invigilatingNote: { color: '#999', fontSize: '11px' },
    invigilatorTag: { backgroundColor: '#fd7e14', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', marginLeft: '8px' },

    modeTabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
    modeTab: { flex: 1, padding: '12px 15px', borderRadius: '8px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    modeTabDesc: { fontSize: '11px', fontWeight: 'normal', opacity: 0.8 },

    card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    select: { padding: '10px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', backgroundColor: 'white' },
    classDisplay: { padding: '10px 15px', borderRadius: '5px', border: '2px solid #1F3864', fontSize: '14px', backgroundColor: '#e3f2fd', color: '#1F3864', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    lockedBadge: { backgroundColor: '#1F3864', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' },
    proceedBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    proceedBtnLarge: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', width: '100%', marginTop: '15px' },

    subjectToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    sectionTitle: { color: '#1F3864', margin: 0, fontSize: '16px' },
    toolbarBtns: { display: 'flex', gap: '8px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
    clearAllBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
    subjectHint: { color: '#666', fontSize: '13px', marginBottom: '12px' },
    subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px' },
    subjectTile: { padding: '12px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    subjectCheck: { fontSize: '18px', flexShrink: 0 },
    subjectName: { fontSize: '13px', fontWeight: 'bold' },

    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '20px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '8px' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
    centerMsg: { padding: '40px', textAlign: 'center', color: '#666' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
    thead: { backgroundColor: '#f8f9fa' },
    th: { padding: '10px 12px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', fontSize: '12px' },
    td: { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    admNo: { fontFamily: 'monospace', fontSize: '11px', color: '#888' },
    markInput: { width: '90px', padding: '7px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', textAlign: 'center', outline: 'none' },
    multiMarkCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', position: 'relative' },
    multiMarkInput: { width: '65px', padding: '5px 3px', borderRadius: '4px', border: '2px solid #ddd', fontSize: '13px', textAlign: 'center', outline: 'none' },
    savedDot: { position: 'absolute', top: 0, right: 0, color: '#2E75B6', fontSize: '10px' },
    updateBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
    newBadge: { backgroundColor: '#d4edda', color: '#155724', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
    emptyBadge: { color: '#aaa', fontSize: '12px' },
    saveSection: { padding: '15px 20px', borderTop: '2px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f8f9fa' },
    saveRowBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
    retryBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
    savingBadge: { color: '#fd7e14', fontSize: '11px', fontWeight: 'bold' },
    savedBadge: { color: '#28a745', fontSize: '11px', fontWeight: 'bold' },
    errorBadge: { color: '#dc3545', fontSize: '11px', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 30px', borderRadius: '5px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' },
    hint: { color: '#666', fontSize: '12px', fontStyle: 'italic', margin: 0 },
};

const pStyles = {
    page: { padding: '15px', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '10px' },
    header: { borderBottom: '3px solid #1F3864', paddingBottom: '10px', marginBottom: '10px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
    logo: { width: '70px', height: '70px', objectFit: 'contain' },
    schoolInfo: { textAlign: 'center', flex: 1, padding: '0 10px' },
    schoolName: { color: '#1F3864', fontSize: '13px', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 'bold' },
    motto: { color: '#2E75B6', fontStyle: 'italic', margin: '0 0 3px 0', fontSize: '11px' },
    contact: { fontSize: '10px', color: '#666', margin: 0 },
    sheetTitleBar: { backgroundColor: '#1F3864', padding: '5px', textAlign: 'center' },
    sheetTitle: { color: 'white', margin: 0, fontSize: '13px' },
    infoRow: { display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #ddd', marginBottom: '8px', fontSize: '10px' },
    infoItem: { fontSize: '10px' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '9px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '5px 6px', textAlign: 'left', border: '1px solid #999', fontWeight: 'bold', whiteSpace: 'nowrap' },
    stickyCol: { width: '25px', textAlign: 'center' },
    admCol: { minWidth: '70px' },
    nameCol: { minWidth: '130px' },
    subjectTh: { backgroundColor: '#2E75B6', color: 'white', padding: '2px', textAlign: 'center', border: '1px solid #999', width: '55px', verticalAlign: 'bottom' },
    rotatedHeader: { writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: '9px', padding: '4px 2px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    td: { padding: '4px 5px', border: '1px solid #ccc', fontSize: '9px' },
    markTd: { padding: '4px', border: '1px solid #ccc', width: '55px', minHeight: '22px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    avgRow: { backgroundColor: '#e3f2fd', fontWeight: 'bold' },
    footer: { display: 'flex', gap: '20px', marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '12px' },
    signBox: { flex: 1 },
    signLabel: { fontSize: '10px', margin: '0 0 8px 0', color: '#333' },
    footerNote: { textAlign: 'center', fontSize: '9px', color: '#999', marginTop: '10px' }
};

export default MarkEntry;