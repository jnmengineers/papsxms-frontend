import React, { useState, useEffect, useCallback, useRef } from 'react';
import useWindowWidth from '../hooks/useWindowWidth';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import { classDisplayName, gradeLabel, streamLabel } from '../utils/classUtils';


// ✅ Outside parent — hover works properly, no keyboard dismiss
const MarkCell = ({ result, marks, markColor, isPending, getGradeColor, getGradeLabel, onEdit, onDelete }) => {
    const [hovered, setHovered] = React.useState(false);

    return (
        <div
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '2px', padding: '5px 4px', borderRadius: '4px',
                cursor: 'pointer', minHeight: '44px', minWidth: '55px', justifyContent: 'center',
                position: 'relative', transition: 'background 0.15s',
                backgroundColor: hovered ? '#e3f2fd' : 'transparent',
                outline: isPending ? '2px solid #fd7e14' : 'none',
            }}
            onClick={onEdit}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title="Click to edit">
            {result ? (
                <>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: markColor }}>{marks}</span>
                    <span style={{
                        color: 'white', padding: '1px 5px', borderRadius: '2px',
                        fontSize: '10px', fontWeight: 'bold',
                        backgroundColor: getGradeColor(result.grade || getGradeLabel(marks))
                    }}>
                        {result.grade || getGradeLabel(marks)}
                    </span>
                    {isPending && (
                        <span style={{ position: 'absolute', top: 2, right: 2, color: '#fd7e14', fontSize: '8px' }}
                            title="Unsaved change">●</span>
                    )}
                    {hovered && (
                        <button
                            style={{
                                position: 'absolute', top: 1, left: 1,
                                backgroundColor: '#dc3545', color: 'white',
                                border: 'none', borderRadius: '3px',
                                fontSize: '9px', cursor: 'pointer',
                                padding: '2px 4px', lineHeight: 1, fontWeight: 'bold'
                            }}
                            title="Delete this mark"
                            onMouseDown={onDelete}>✕</button>
                    )}
                </>
            ) : (
                <span style={{ color: hovered ? '#2E75B6' : '#ccc', fontSize: '18px', lineHeight: '44px', fontWeight: 'bold' }}>+</span>
            )}
        </div>
    );
};

function Results() {
    const role = localStorage.getItem('role');
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth <= 768;
    const linkedClassId = localStorage.getItem('linkedClassId');

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [step, setStep] = useState(1);
    const [filterExam, setFilterExam] = useState('');
    const [filterClassId, setFilterClassId] = useState('');
    const [search, setSearch] = useState('');

    // Pivot data
    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});

    // Inline editing
    const [editingCell, setEditingCell] = useState(null); // { studentId, subjectId }
    const [editingValue, setEditingValue] = useState('');
    const editInputRef = useRef(null);

    // Unsaved changes tracking
    const [pendingChanges, setPendingChanges] = useState({}); // { studentId_subjectId: { marks, resultId, isNew } }

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1', grades: ['PG', 'PP1', 'PP2'] },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6', grades: ['G1', 'G2', 'G3'] },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14', grades: ['G4', 'G5', 'G6'] },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997', grades: ['G7', 'G8', 'G9'] }
    ];

    useEffect(() => { fetchExams(); fetchClasses(); }, []);

    useEffect(() => {
        if (role === 'TEACHER' && linkedClassId) {
            setFilterClassId(linkedClassId);
            setStep(1);
        }
    }, [linkedClassId]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingCell && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingCell]);

    const fetchExams = async () => {
        const r = await api.get('/api/exams');
        setExams(r.data);
    };

    const fetchClasses = async () => {
        const r = await api.get('/api/classes');
        setClasses(r.data);
    };

    const handleSelectExam = (examId) => {
        setFilterExam(examId);
        setFilterClassId('');
        setPivotStudents([]); setPivotSubjects([]); setPivotData({});
        setResults([]); setError(''); setPendingChanges({});
        if (role === 'TEACHER' && linkedClassId) {
            loadResults(examId, linkedClassId);
        } else {
            setStep(2);
        }
    };

    const handleSelectClass = (classId) => {
        setFilterClassId(classId);
        setError('');
        loadResults(filterExam, classId);
    };

    const loadResults = async (examId, classId) => {
        setLoading(true); setStep(3); setError('');
        setPendingChanges({});
        try {
            const response = await api.get('/api/results');
            let data = response.data;
            const selectedClass = classes.find(c => String(c.classId) === String(classId));

            data = data.filter(r => {
                if (String(r.exam?.examId) !== String(examId)) return false;
                if (r.student?.schoolClass?.classId) {
                    return String(r.student.schoolClass.classId) === String(classId);
                }
                if (selectedClass && r.student?.className) {
                    if (r.student.className === selectedClass.className) return true;
                    if (selectedClass.stream) {
                        return r.student.stream === selectedClass.stream &&
                            (r.student.className?.includes(selectedClass.gradeLevel) ||
                             r.student.className === gradeLabel(selectedClass.gradeLevel)?.toUpperCase() ||
                             r.student.className === gradeLabel(selectedClass.gradeLevel));
                    } else {
                        return r.student.className?.includes(selectedClass.gradeLevel) ||
                            r.student.className === gradeLabel(selectedClass.gradeLevel)?.toUpperCase() ||
                            r.student.className === gradeLabel(selectedClass.gradeLevel);
                    }
                }
                return false;
            });

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
        data.forEach(r => { if (r.subject) subjectMap[r.subject.subjectId] = r.subject.subjectName; });
        const uniqueSubjects = Object.entries(subjectMap)
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const studentMap = {};
        data.forEach(r => { if (r.student) studentMap[r.student.studentId] = r.student; });
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

    // ── Inline edit: start ────────────────────────────────────────────────────
    const startEdit = (studentId, subjectId, currentValue) => {
        setEditingCell({ studentId, subjectId });
        setEditingValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '');
    };

    // ── Inline edit: commit on blur or Enter ──────────────────────────────────
    const commitEdit = (studentId, subjectId) => {
        const key = `${studentId}_${subjectId}`;
        const result = pivotData[studentId]?.[subjectId];
        const newVal = editingValue.trim();

        if (newVal === '' || newVal === String(result?.marksObtained)) {
            // No change or empty — cancel
            setEditingCell(null);
            return;
        }

        const parsed = parseFloat(newVal);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            setError('Marks must be between 0 and 100');
            setTimeout(() => setError(''), 3000);
            setEditingCell(null);
            return;
        }

        // Stage the change
        setPendingChanges(prev => ({
            ...prev,
            [key]: {
                marks: parsed,
                resultId: result?.resultId,
                isNew: !result,
                studentId, subjectId,
                examId: filterExam,
                original: result?.marksObtained
            }
        }));

        // Update pivot display immediately (optimistic)
        setPivotData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    ...(prev[studentId]?.[subjectId] || {}),
                    marksObtained: parsed,
                    grade: getGradeLabel(parsed),
                    _pending: true
                }
            }
        }));

        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    // ── Save all pending changes ──────────────────────────────────────────────
    const handleSaveChanges = async () => {
        const changes = Object.values(pendingChanges);
        if (changes.length === 0) { setSuccessMsg('No changes to save'); setTimeout(() => setSuccessMsg(''), 2000); return; }

        setSaving(true); setError(''); setSuccessMsg('');
        let saved = 0, updated = 0, failed = 0;

        // ✅ Use bulk-save endpoint — reliable, handles duplicates, auto-grades
        const bulkPayload = {
            examId: parseInt(filterExam),
            results: changes.map(change => ({
                studentId: change.studentId,
                subjectId: change.subjectId,
                marksObtained: change.marks,
                maxMarks: 100,
                resultId: change.resultId || null
            }))
        };

        try {
            const response = await api.post('/api/results/bulk-save', bulkPayload);
            const data = response.data;
            saved = data.saved || 0;
            updated = data.updated || 0;
            failed = data.failed || 0;
        } catch (e) {
            failed = changes.length;
            console.error('Bulk save error:', e.response?.data || e.message);
        }

        setSaving(false);
        setPendingChanges({});
        if (failed > 0) setError(`${failed} failed. ${saved + updated} saved.`);
        else setSuccessMsg(`✅ ${updated} updated, ${saved} new marks saved!`);
        setTimeout(() => setSuccessMsg(''), 3000);

        // Reload fresh data
        loadResults(filterExam, filterClassId);
    };

    // ── Discard pending changes ───────────────────────────────────────────────
    const handleDiscardChanges = () => {
        setPendingChanges({});
        loadResults(filterExam, filterClassId);
    };

    // ── Delete a result ───────────────────────────────────────────────────────
    const handleDeleteResult = async (resultId, studentName, subjectName) => {
        if (!window.confirm(`Delete ${subjectName} mark for ${studentName}?`)) return;
        try {
            await api.delete(`/api/results/${resultId}`);
            setSuccessMsg('✅ Mark deleted!');
            setTimeout(() => setSuccessMsg(''), 2000);
            loadResults(filterExam, filterClassId);
        } catch (e) { setError('Failed to delete mark'); }
    };

    // ── Delete ALL results for a student in this exam ───────────────────────
    const handleDeleteStudentRow = async (student) => {
        const studentResults = Object.values(pivotData[student.studentId] || {}).filter(Boolean);
        if (studentResults.length === 0) return;
        if (!window.confirm(`Delete ALL ${studentResults.length} result(s) for ${student.firstName} ${student.lastName} in this exam?`)) return;
        try {
            for (const result of studentResults) {
                await api.delete(`/api/results/${result.resultId}`);
            }
            setSuccessMsg(`✅ Deleted all results for ${student.firstName} ${student.lastName}`);
            setTimeout(() => setSuccessMsg(''), 3000);
            loadResults(filterExam, filterClassId);
        } catch (e) { setError('Failed to delete some results'); }
    };

    // ── Delete ALL results for a subject in this exam ─────────────────────────
    const handleDeleteSubjectColumn = async (subject) => {
        const subjectResults = pivotStudents
            .map(s => pivotData[s.studentId]?.[subject.id])
            .filter(Boolean);
        if (subjectResults.length === 0) return;
        if (!window.confirm(`Delete ALL ${subjectResults.length} result(s) for ${subject.name} in this exam?`)) return;
        try {
            for (const result of subjectResults) {
                await api.delete(`/api/results/${result.resultId}`);
            }
            setSuccessMsg(`✅ Deleted all ${subject.name} results`);
            setTimeout(() => setSuccessMsg(''), 3000);
            loadResults(filterExam, filterClassId);
        } catch (e) { setError('Failed to delete some results'); }
    };

    const handleReset = () => {
        setStep(1); setFilterExam(''); setFilterClassId(''); setSearch('');
        setResults([]); setPivotStudents([]); setPivotSubjects([]); setPivotData({});
        setError(''); setPendingChanges({});
    };

    const getGradeLabel = (marks) => {
        if (marks >= 80) return 'A';
        if (marks >= 60) return 'B';
        if (marks >= 40) return 'C';
        return 'D';
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
        return { total: total.toFixed(1), average: average.toFixed(1), grade: getGradeLabel(average) };
    };

    const getSubjectAverage = (subjectId) => {
        const subjectResults = pivotStudents
            .map(s => pivotData[s.studentId]?.[subjectId])
            .filter(Boolean);
        if (subjectResults.length === 0) return '-';
        return (subjectResults.reduce((sum, r) => sum + r.marksObtained, 0) / subjectResults.length).toFixed(1);
    };

    const selectedExamObj = exams.find(e => String(e.examId) === String(filterExam));
    const selectedClassObj = classes.find(c => String(c.classId) === String(filterClassId));

    const getGroupedClasses = () => {
        const grouped = {};
        sections.forEach(s => { grouped[s.value] = {}; });
        classes.forEach(cls => {
            const section = cls.section;
            const grade = cls.gradeLevel;
            if (section && grade) {
                if (!grouped[section][grade]) grouped[section][grade] = [];
                grouped[section][grade].push(cls);
            }
        });
        return grouped;
    };

    const groupedClasses = getGroupedClasses();

    const displayStudents = search
        ? pivotStudents.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            s.admissionNumber?.toLowerCase().includes(search.toLowerCase())
        )
        : pivotStudents;

    const pendingCount = Object.keys(pendingChanges).length;

    // Sorted students by average (descending) for ranking
    const rankedStudents = [...displayStudents].sort((a, b) => {
        const statsA = getStudentStats(a.studentId);
        const statsB = getStudentStats(b.studentId);
        return parseFloat(statsB.average) - parseFloat(statsA.average);
    });

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
                    <span onClick={handleReset} style={styles.breadLink}>📊 Results</span>
                    {filterExam && <>
                        <span style={styles.breadArrow}>›</span>
                        <span onClick={() => { setStep(1); setFilterExam(''); setFilterClassId(''); setPendingChanges({}); }} style={styles.breadLink}>
                            📝 {selectedExamObj?.examName}
                        </span>
                    </>}
                    {filterClassId && <>
                        <span style={styles.breadArrow}>›</span>
                        <span style={styles.breadCurrent}>🏫 {selectedClassObj ? classDisplayName(selectedClassObj) : ''}</span>
                    </>}
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Pending changes banner */}
                {pendingCount > 0 && (
                    <div style={styles.pendingBanner}>
                        <span style={styles.pendingText}>
                            ✏️ <strong>{pendingCount}</strong> unsaved change{pendingCount > 1 ? 's' : ''}
                        </span>
                        <div style={styles.pendingBtns}>
                            <button onClick={handleSaveChanges} style={styles.savePendingBtn} disabled={saving}>
                                {saving ? '⏳ Saving...' : '💾 Save Changes'}
                            </button>
                            <button onClick={handleDiscardChanges} style={styles.discardBtn}>✕ Discard</button>
                        </div>
                    </div>
                )}

                {/* ── STEP 1: Select Exam ── */}
                {step === 1 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <h2 style={styles.stepTitle}>📝 Select Exam</h2>
                            <p style={styles.stepSubtitle}>Choose which exam to view and edit results for</p>
                        </div>
                        {exams.length === 0 ? (
                            <div style={styles.emptyCard}><div style={styles.emptyIcon}>📝</div><p>No exams found.</p></div>
                        ) : (
                            <div style={styles.examGrid}>
                                {exams.map(exam => (
                                    <div key={exam.examId} onClick={() => handleSelectExam(exam.examId)} style={styles.examTile}>
                                        <div style={styles.examTileTop}>
                                            <span style={styles.examIcon}>📝</span>
                                            <h3 style={styles.examName}>{exam.examName}</h3>
                                            <p style={styles.examMeta}>{exam.academicYear} • Term {exam.term}</p>
                                        </div>
                                        <div style={styles.examTileBottom}><span style={styles.selectHint}>Click to view results →</span></div>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button onClick={() => setStep(1)} style={styles.backBtn}>← Back</button>
                                <div>
                                    <h2 style={styles.stepTitle}>🏫 Select Class</h2>
                                    <p style={styles.stepSubtitle}>Exam: <strong>{selectedExamObj?.examName}</strong></p>
                                </div>
                            </div>
                        </div>
                        <div style={styles.classTilesCard}>
                            {sections.map(section => {
                                const sectionGrades = groupedClasses[section.value] || {};
                                if (!Object.keys(sectionGrades).length) return null;
                                return (
                                    <div key={section.value} style={styles.sectionBlock}>
                                        <div style={{ ...styles.sectionHeader, backgroundColor: section.color }}>
                                            <span style={styles.sectionLabel}>{section.label}</span>
                                            <span style={styles.sectionMeta}>{Object.values(sectionGrades).flat().length} classes</span>
                                        </div>
                                        <div style={styles.gradesRow}>
                                            {Object.entries(sectionGrades).sort(([a], [b]) => a.localeCompare(b)).map(([grade, gradeClasses]) => (
                                                <div key={grade} style={styles.gradeGroup}>
                                                    <div style={{ ...styles.gradeLabel, color: section.color }}>{gradeLabel(grade)}</div>
                                                    <div style={styles.streamTiles}>
                                                        {gradeClasses.map(cls => (
                                                            <div key={cls.classId}
                                                                onClick={() => handleSelectClass(cls.classId)}
                                                                style={styles.streamTile}
                                                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = section.color; e.currentTarget.style.color = 'white'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#333'; }}>
                                                                <div style={styles.streamTileName}>{classDisplayName(cls)}</div>
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

                {/* ── STEP 3: Results Table with inline edit ── */}
                {step === 3 && (
                    <div>
                        <div style={styles.stepHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                {role !== 'TEACHER' && <button onClick={() => { setStep(2); setPendingChanges({}); }} style={styles.backBtn}>← Back</button>}
                                <div>
                                    <h2 style={styles.stepTitle}>
                                        📊 {selectedClassObj ? classDisplayName(selectedClassObj) : ''} — {selectedExamObj?.examName}
                                    </h2>
                                    <p style={styles.stepSubtitle}>
                                        {selectedExamObj?.academicYear} Term {selectedExamObj?.term}
                                        <span style={styles.editHint}> • Click any mark to edit it inline</span>
                                    </p>
                                </div>
                            </div>
                            <input style={styles.searchInput} placeholder="🔍 Search student..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {loading ? (
                            <div style={styles.emptyCard}><p>⏳ Loading results...</p></div>
                        ) : pivotStudents.length === 0 ? (
                            <div style={styles.emptyCard}>
                                <div style={styles.emptyIcon}>📭</div>
                                <p>No results found for <strong>{selectedClassObj ? classDisplayName(selectedClassObj) : ''}</strong></p>
                                <button onClick={() => window.location.href = '/mark-entry'} style={styles.goBtn}>✏️ Go to Mark Entry</button>
                            </div>
                        ) : (
                            <div style={styles.tableCard}>
                                <div style={styles.tableTopBar}>
                                    <div>
                                        <h3 style={styles.tableTitle}>
                                            {selectedClassObj ? classDisplayName(selectedClassObj) : ''} — {selectedExamObj?.examName}
                                        </h3>
                                        <p style={styles.tableSubtitle}>
                                            {pivotStudents.length} students · {pivotSubjects.length} subjects · {results.length} records
                                        </p>
                                    </div>
                                    <div style={styles.tableBadges}>
                                        <span style={styles.badge}>👥 {pivotStudents.length}</span>
                                        <span style={styles.badge}>📚 {pivotSubjects.length}</span>
                                        {pendingCount > 0 && (
                                            <span style={{ ...styles.badge, backgroundColor: '#fd7e14' }}>
                                                ✏️ {pendingCount} pending
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div style={styles.legendBar}>
                                    <span style={styles.legendTitle}>💡 Click any mark cell to edit · Press Enter or Tab to confirm · Escape to cancel</span>
                                    <div style={styles.gradeLegend}>
                                        {[['A','#28a745','80-100'],['B','#2E75B6','60-79'],['C','#ffc107','40-59'],['D','#dc3545','0-39']].map(([g,c,r]) => (
                                            <span key={g} style={{ ...styles.legendGrade, color: c }}>● {g} ({r})</span>
                                        ))}
                                    </div>
                                </div>

                                {isMobile ? (
                                    /* ── MOBILE: Student cards layout ── */
                                    <div style={{ padding: '10px' }}>
                                        {rankedStudents.map((student, index) => {
                                            const stats = getStudentStats(student.studentId);
                                            const rank = index + 1;
                                            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                                            return (
                                                <div key={student.studentId} style={{
                                                    backgroundColor: 'white', borderRadius: '8px',
                                                    marginBottom: '10px', border: '1px solid #eee',
                                                    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                                                }}>
                                                    {/* Student header bar */}
                                                    <div style={{ backgroundColor: '#1F3864', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
                                                                {rankEmoji} {student.firstName} {student.lastName}
                                                            </div>
                                                            <div style={{ color: '#BDD7EE', fontSize: '10px' }}>{student.admissionNumber}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ backgroundColor: 'white', color: getMarkColor(parseFloat(stats.average)), fontWeight: 'bold', fontSize: '13px', padding: '2px 7px', borderRadius: '4px' }}>
                                                                {stats.average}%
                                                            </span>
                                                            <span style={{ ...styles.gradeBadge, backgroundColor: getGradeColor(stats.grade), fontSize: '11px' }}>
                                                                {stats.grade}
                                                            </span>
                                                            <button onClick={() => handleDeleteStudentRow(student)}
                                                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Subject marks grid — 2 per row */}
                                                    <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                                                        {pivotSubjects.map(sub => {
                                                            const result = pivotData[student.studentId]?.[sub.id];
                                                            const isEditing = editingCell?.studentId === student.studentId && editingCell?.subjectId === sub.id;
                                                            const isPending = pendingChanges[`${student.studentId}_${sub.id}`];
                                                            const marks = result?.marksObtained;
                                                            return (
                                                                <div key={sub.id} style={{
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    padding: '5px 8px', borderRadius: '5px',
                                                                    backgroundColor: isPending ? '#fff3cd' : '#f8f9fa',
                                                                    border: `1px solid ${isPending ? '#ffc107' : '#eee'}`
                                                                }}>
                                                                    <span style={{ fontSize: '11px', color: '#555', flex: 1, marginRight: '4px' }}>
                                                                        {sub.name.length > 10 ? sub.name.substring(0, 10) + '…' : sub.name}
                                                                    </span>
                                                                    {isEditing ? (
                                                                        <input ref={editInputRef} type="number" min="0" max="100"
                                                                            style={{ width: '48px', padding: '2px 4px', border: '2px solid #2E75B6', borderRadius: '3px', fontSize: '14px', textAlign: 'center' }}
                                                                            value={editingValue}
                                                                            onChange={e => setEditingValue(e.target.value)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') { e.preventDefault(); commitEdit(student.studentId, sub.id); }
                                                                                if (e.key === 'Escape') cancelEdit();
                                                                            }}
                                                                            onBlur={() => commitEdit(student.studentId, sub.id)} />
                                                                    ) : (
                                                                        <span onClick={() => startEdit(student.studentId, sub.id, marks)}
                                                                            style={{ fontWeight: 'bold', fontSize: '14px', color: result ? getMarkColor(marks) : '#ccc', cursor: 'pointer', minWidth: '28px', textAlign: 'right' }}>
                                                                            {result ? marks : '+'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.tableHeader}>
                                                {!isMobile && <th style={{ ...styles.th, ...styles.rankCol }}>Rank</th>}
                                                {!isMobile && <th style={{ ...styles.th, ...styles.stickyCol2 }}>Adm No</th>}
                                                <th style={{ ...styles.th, ...(isMobile ? styles.mobileNameCol : styles.stickyCol3) }}>
                                                    {isMobile ? 'Student' : 'Student Name'}
                                                </th>
                                                {pivotSubjects.map(sub => (
                                                    <th key={sub.id} style={{ ...styles.th, ...styles.subjectTh }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                            <span style={{ fontSize: isMobile ? '9px' : '11px' }}>
                                                                {isMobile ? sub.name.split(' ')[0] : sub.name}
                                                            </span>
                                                            <button
                                                                title="Delete all results for this subject"
                                                                onClick={() => handleDeleteSubjectColumn(sub)}
                                                                style={styles.deleteColBtn}>
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Avg</th>
                                                {!isMobile && <th style={{ ...styles.th, ...styles.totalTh }}>Total</th>}
                                                <th style={{ ...styles.th, ...styles.totalTh }}>Grd</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rankedStudents.map((student, index) => {
                                                const stats = getStudentStats(student.studentId);
                                                const rank = index + 1;
                                                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                                                return (
                                                    <tr key={student.studentId}
                                                        style={{ ...(index % 2 === 0 ? styles.trEven : styles.trOdd) }}>
                                                        {!isMobile && <td style={{ ...styles.td, ...styles.rankCol, textAlign: 'center', fontWeight: 'bold' }}>
                                                            {rankEmoji}
                                                        </td>}
                                                        {!isMobile && <td style={{ ...styles.td, ...styles.stickyCol2 }}>
                                                            <span style={styles.admNo}>{student.admissionNumber}</span>
                                                        </td>}
                                                        <td style={{ ...styles.td, ...(isMobile ? styles.mobileNameCol : styles.stickyCol3) }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                                <div>
                                                                    <strong style={{ fontSize: isMobile ? '11px' : '13px' }}>
                                                                        {isMobile ? student.firstName : `${student.firstName} ${student.lastName}`}
                                                                    </strong>
                                                                    {isMobile && <div style={{ fontSize: '9px', color: '#999' }}>{student.admissionNumber}</div>}
                                                                </div>
                                                                <button
                                                                    title="Delete all results for this student"
                                                                    onClick={() => handleDeleteStudentRow(student)}
                                                                    style={styles.deleteRowBtn}>
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                        {pivotSubjects.map(sub => {
                                                            const result = pivotData[student.studentId]?.[sub.id];
                                                            const isEditing = editingCell?.studentId === student.studentId && editingCell?.subjectId === sub.id;
                                                            const isPending = pendingChanges[`${student.studentId}_${sub.id}`];
                                                            const marks = result?.marksObtained;
                                                            const markColor = getMarkColor(marks);

                                                            return (
                                                                <td key={sub.id} style={{ ...styles.td, ...styles.markTd }}>
                                                                    {isEditing ? (
                                                                        // ── Editing cell ──
                                                                        <div style={styles.editCellWrapper}>
                                                                            <input
                                                                                ref={editInputRef}
                                                                                type="number" min="0" max="100"
                                                                                style={styles.editInput}
                                                                                value={editingValue}
                                                                                onChange={e => setEditingValue(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                                                                        e.preventDefault();
                                                                                        commitEdit(student.studentId, sub.id);
                                                                                    }
                                                                                    if (e.key === 'Escape') cancelEdit();
                                                                                }}
                                                                                onBlur={() => commitEdit(student.studentId, sub.id)}
                                                                            />
                                                                            <div style={styles.editActions}>
                                                                                <button style={styles.editOkBtn} onMouseDown={() => commitEdit(student.studentId, sub.id)}>✓</button>
                                                                                <button style={styles.editCancelBtn} onMouseDown={cancelEdit}>✕</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        // ── Display cell ──
                                                                        <MarkCell
                                                                            result={result}
                                                                            marks={marks}
                                                                            markColor={markColor}
                                                                            isPending={isPending}
                                                                            getGradeColor={getGradeColor}
                                                                            getGradeLabel={getGradeLabel}
                                                                            onEdit={() => startEdit(student.studentId, sub.id, marks)}
                                                                            onDelete={e => {
                                                                                e.stopPropagation();
                                                                                handleDeleteResult(result.resultId, `${student.firstName} ${student.lastName}`, sub.name);
                                                                            }}
                                                                        />
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ ...styles.td, ...styles.totalCell }}>
                                                            <span style={{ color: getMarkColor(parseFloat(stats.average)), fontWeight: 'bold', fontSize: isMobile ? '11px' : '13px' }}>{stats.average}%</span>
                                                        </td>
                                                        {!isMobile && <td style={{ ...styles.td, ...styles.totalCell }}><strong>{stats.total}</strong></td>}
                                                        <td style={{ ...styles.td, ...styles.totalCell, textAlign: 'center' }}>
                                                            <span style={{ ...styles.gradeBadge, backgroundColor: getGradeColor(stats.grade), fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '2px 5px' : '3px 8px' }}>{stats.grade}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Subject averages row */}
                                            <tr style={styles.averageRow}>
                                                <td colSpan={isMobile ? "1" : "3"} style={{ ...styles.td, fontWeight: 'bold', color: '#1F3864', fontSize: isMobile ? '10px' : '13px' }}>📊 Avg</td>
                                                {pivotSubjects.map(sub => (
                                                    <td key={sub.id} style={{ ...styles.td, textAlign: 'center' }}>
                                                        <strong style={{ color: '#1F3864' }}>{getSubjectAverage(sub.id)}</strong>
                                                    </td>
                                                ))}
                                                <td colSpan="3" style={styles.td}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>


                                )}
                                {/* Save bar */}
                                {pendingCount > 0 && (
                                    <div style={styles.saveBar}>
                                        <span style={styles.saveBarText}>✏️ {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}</span>
                                        <button onClick={handleSaveChanges} style={styles.saveBarBtn} disabled={saving}>
                                            {saving ? '⏳ Saving...' : '💾 Save All Changes'}
                                        </button>
                                        <button onClick={handleDiscardChanges} style={styles.discardBarBtn}>✕ Discard</button>
                                    </div>
                                )}
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
    content: { padding: 'clamp(12px, 3vw, 30px)' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    // Breadcrumb
    breadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' },
    breadLink: { fontSize: '14px', fontWeight: 'bold', color: '#2E75B6', cursor: 'pointer', textDecoration: 'underline' },
    breadArrow: { color: '#999', fontSize: '16px' },
    breadCurrent: { fontSize: '14px', fontWeight: 'bold', color: '#28a745' },

    // Pending banner
    pendingBanner: { backgroundColor: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px', padding: '12px 16px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    pendingText: { color: '#856404', fontSize: '14px' },
    pendingBtns: { display: 'flex', gap: '8px' },
    savePendingBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    discardBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' },

    // Step header
    stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    stepTitle: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '22px' },
    stepSubtitle: { color: '#666', margin: 0, fontSize: '14px' },
    editHint: { color: '#2E75B6', fontStyle: 'italic', fontSize: '12px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    searchInput: { padding: '10px 15px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', minWidth: '220px' },

    // Exam tiles
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' },
    examTile: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', overflow: 'hidden' },
    examTileTop: { padding: '20px', textAlign: 'center' },
    examIcon: { fontSize: '36px', display: 'block', marginBottom: '10px' },
    examName: { color: '#1F3864', margin: '0 0 6px 0', fontSize: '16px' },
    examMeta: { color: '#666', margin: 0, fontSize: '13px' },
    examTileBottom: { backgroundColor: '#1F3864', padding: '8px', textAlign: 'center' },
    selectHint: { color: 'white', fontSize: '12px' },

    // Class tiles
    classTilesCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    sectionBlock: { marginBottom: '15px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' },
    sectionHeader: { padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '14px' },
    sectionMeta: { color: 'rgba(255,255,255,0.8)', fontSize: '12px' },
    gradesRow: { display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: '#fafafa' },
    gradeGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    gradeLabel: { fontSize: '12px', fontWeight: 'bold', textAlign: 'center' },
    streamTiles: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    streamTile: { padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', minWidth: '90px', border: '2px solid #ddd', backgroundColor: 'white', color: '#333', transition: 'all 0.2s' },
    streamTileName: { fontSize: '13px', fontWeight: 'bold' },

    // Table card
    tableCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    tableTitle: { color: 'white', margin: '0 0 3px 0', fontSize: '16px' },
    tableSubtitle: { color: '#BDD7EE', margin: 0, fontSize: '13px' },
    tableBadges: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },

    // Legend bar
    legendBar: { backgroundColor: '#f8f9fa', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #eee' },
    legendTitle: { fontSize: '12px', color: '#666', fontStyle: 'italic' },
    gradeLegend: { display: 'flex', gap: '12px' },
    legendGrade: { fontSize: '12px', fontWeight: 'bold' },

    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 'bold' },
    rankCol: { width: '50px', position: 'sticky', left: 0, backgroundColor: '#1F3864', zIndex: 2 },
    stickyCol2: { position: 'sticky', left: '50px', backgroundColor: 'inherit', zIndex: 1, minWidth: '90px' },
    stickyCol3: { position: 'sticky', left: '140px', backgroundColor: 'inherit', zIndex: 1, minWidth: '150px', borderRight: '2px solid #ddd' },
    subjectTh: { textAlign: 'center', backgroundColor: '#2E75B6', minWidth: '85px' },
    totalTh: { textAlign: 'center', backgroundColor: '#1a2d4f', minWidth: '70px' },
    td: { padding: '7px 10px', borderBottom: '1px solid #eee', fontSize: '12px' },
    markTd: { padding: '2px 3px', borderBottom: '1px solid #eee', textAlign: 'center' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },

    // Mark cell (display mode) — clickable
    markCell: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        padding: '5px 4px', borderRadius: '4px', cursor: 'pointer', minHeight: '44px',
        justifyContent: 'center', position: 'relative',
        transition: 'background 0.15s',
        '&:hover': { backgroundColor: '#e3f2fd' }
    },
    markValue: { fontSize: '15px', fontWeight: 'bold' },
    gradeSmall: { color: 'white', padding: '1px 5px', borderRadius: '2px', fontSize: '10px', fontWeight: 'bold' },
    pendingDot: { position: 'absolute', top: 2, right: 2, color: '#fd7e14', fontSize: '8px' },
    deleteMarkBtn: {
        position: 'absolute', top: 1, left: 1,
        background: 'none', border: 'none', color: '#dc3545',
        fontSize: '10px', cursor: 'pointer', padding: '1px',
        opacity: 0, transition: 'opacity 0.2s',
        lineHeight: 1
    },
    emptyCell: { color: '#ccc', fontSize: '18px', cursor: 'pointer', lineHeight: '44px' },

    // Edit cell (input mode)
    editCellWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
    editInput: {
        width: '55px', padding: '4px 2px', borderRadius: '4px',
        border: '2px solid #2E75B6', fontSize: '14px', textAlign: 'center',
        outline: 'none', backgroundColor: '#e3f2fd'
    },
    editActions: { display: 'flex', gap: '3px' },
    editOkBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' },
    editCancelBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' },

    totalCell: { backgroundColor: '#f0f4ff', fontWeight: 'bold', textAlign: 'center' },
    gradeBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontWeight: 'bold', fontSize: '12px' },
    averageRow: { backgroundColor: '#e8f4f8', borderTop: '2px solid #2E75B6' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace' },

    // Save bar
    saveBar: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    saveBarText: { color: '#856404', fontWeight: 'bold', fontSize: '14px', flex: 1 },
    saveBarBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 22px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    discardBarBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' },

    deleteRowBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.5, padding: '2px 4px', borderRadius: '3px', flexShrink: 0, transition: 'opacity 0.2s' },
    mobileNameCol: { minWidth: '90px', maxWidth: '110px', position: 'static', backgroundColor: 'inherit', zIndex: 'auto', borderRight: '2px solid #eee' },
    deleteColBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '1px 4px', borderRadius: '3px', color: 'white', lineHeight: 1 },
    emptyCard: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
    goBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px' },
};

export default Results;