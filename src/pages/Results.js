import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Results() {
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

    // Pivot data
    const [pivotStudents, setPivotStudents] = useState([]);
    const [pivotSubjects, setPivotSubjects] = useState([]);
    const [pivotData, setPivotData] = useState({});

    useEffect(() => {
        fetchExams();
        fetchClasses();
    }, []);

    useEffect(() => {
        if (editingCell && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingCell]);

    const fetchExams = async () => {
        const response = await api.get('/api/exams');
        setExams(response.data);
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const handleSearch = async () => {
        if (!filterExam || !filterClass) {
            setError('Please select both an Exam and a Class to view results');
            return;
        }
        setLoading(true);
        setError('');
        setSearched(true);

        try {
            const response = await api.get('/api/results');
            let data = response.data;

            // Filter by exam and class
            data = data.filter(r =>
                String(r.exam?.examId) === String(filterExam) &&
                r.student?.className === filterClass
            );

            // Apply search
            if (search) {
                data = data.filter(r =>
                    r.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                    r.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                    r.student?.admissionNumber?.toLowerCase().includes(search.toLowerCase())
                );
            }

            setResults(data);
            buildPivotTable(data);
        } catch (err) {
            setError('Failed to load results');
        }
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

    const startEdit = (studentId, subjectId, currentValue) => {
        setEditingCell({ studentId, subjectId });
        setEditingValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '');
    };

    const commitEdit = (studentId, subjectId) => {
        const key = `${studentId}_${subjectId}`;
        const result = pivotData[studentId]?.[subjectId];
        const newVal = editingValue.trim();
        if (newVal === '' || newVal === String(result?.marksObtained)) {
            setEditingCell(null); return;
        }
        const parsed = parseFloat(newVal);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            setError('Marks must be between 0 and 100');
            setTimeout(() => setError(''), 3000);
            setEditingCell(null); return;
        }
        setPendingChanges(prev => ({
            ...prev,
            [key]: { marks: parsed, resultId: result?.resultId, studentId, subjectId, examId: filterExam }
        }));
        setPivotData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: { ...(prev[studentId]?.[subjectId] || {}), marksObtained: parsed }
            }
        }));
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    const handleSaveChanges = async () => {
        const changes = Object.values(pendingChanges);
        if (changes.length === 0) return;
        setSaving(true); setError('');
        const bulkPayload = {
            examId: parseInt(filterExam),
            results: changes.map(c => ({
                studentId: c.studentId, subjectId: c.subjectId,
                marksObtained: c.marks, maxMarks: 100, resultId: c.resultId || null
            }))
        };
        try {
            const r = await api.post('/api/results/bulk-save', bulkPayload);
            const d = r.data;
            setSuccessMsg(`✅ ${d.updated || 0} updated, ${d.saved || 0} new marks saved!`);
            setPendingChanges({});
            setTimeout(() => setSuccessMsg(''), 3000);
            handleSearchWithClass(filterClass, filterExam);
        } catch (e) {
            setError('Failed to save changes');
        }
        setSaving(false);
    };

    const handleDiscardChanges = () => {
        setPendingChanges({});
        handleSearchWithClass(filterClass, filterExam);
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

    // Calculate student total and average
    const getStudentStats = (studentId) => {
        const studentResults = pivotSubjects.map(sub =>
            pivotData[studentId]?.[sub.id]
        ).filter(Boolean);

        if (studentResults.length === 0) return { total: 0, average: 0, grade: '-' };

        const total = studentResults.reduce((sum, r) => sum + r.marksObtained, 0);
        const average = total / studentResults.length;

        let grade = 'D';
        if (average >= 80) grade = 'A';
        else if (average >= 60) grade = 'B';
        else if (average >= 40) grade = 'C';

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
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Pending changes banner */}
                {Object.keys(pendingChanges).length > 0 && (
                    <div style={styles.pendingBanner}>
                        <span style={{ color: '#856404', fontWeight: 'bold' }}>
                            ✏️ {Object.keys(pendingChanges).length} unsaved change{Object.keys(pendingChanges).length > 1 ? 's' : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleSaveChanges} disabled={saving}
                                style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {saving ? '⏳ Saving...' : '💾 Save Changes'}
                            </button>
                            <button onClick={handleDiscardChanges}
                                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '5px', cursor: 'pointer' }}>
                                ✕ Discard
                            </button>
                        </div>
                    </div>
                )}

                {/* Filter Card */}
                <div style={styles.filterCard}>
                    <div style={styles.filterGrid}>
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>📝 Exam *</label>
                            <select style={styles.filterSelect} value={filterExam}
                                onChange={e => setFilterExam(e.target.value)}>
                                <option value="">-- Select Exam --</option>
                                {exams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.examName} — Term {exam.term} {exam.academicYear}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>🏫 Class *</label>
                            <select style={styles.filterSelect} value={filterClass}
                                onChange={e => setFilterClass(e.target.value)}>
                                <option value="">-- Select Class --</option>
                                {classes.map(cls => (
                                    <option key={cls.classId} value={cls.className}>
                                        {cls.className} — {cls.stream}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>🔍 Search Student</label>
                            <input style={styles.filterSelect}
                                placeholder="Name or admission no..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>&nbsp;</label>
                            <div style={styles.btnRow}>
                                <button onClick={handleSearch} style={styles.searchBtn}
                                    disabled={loading}>
                                    {loading ? '⏳' : '🔍'} View Results
                                </button>
                                <button onClick={clearFilters} style={styles.clearBtn}>
                                    ✕ Clear
                                </button>
                            </div>
                        </div>
                    </div>
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
                                            {pivotStudents.map((student, index) => {
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
                                                                    {editingCell?.studentId === student.studentId && editingCell?.subjectId === sub.id ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                            <input
                                                                                ref={editInputRef}
                                                                                type="number" min="0" max="100"
                                                                                value={editingValue}
                                                                                onChange={e => setEditingValue(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(student.studentId, sub.id); }
                                                                                    if (e.key === 'Escape') cancelEdit();
                                                                                }}
                                                                                onBlur={() => commitEdit(student.studentId, sub.id)}
                                                                                style={{ width: '55px', padding: '4px', border: '2px solid #2E75B6', borderRadius: '4px', fontSize: '16px', textAlign: 'center', outline: 'none', backgroundColor: '#e3f2fd' }}
                                                                            />
                                                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                                                <button onMouseDown={() => commitEdit(student.studentId, sub.id)} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>✓</button>
                                                                                <button onMouseDown={cancelEdit} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : result ? (
                                                                        <div
                                                                            onClick={() => startEdit(student.studentId, sub.id, result.marksObtained)}
                                                                            title="Click to edit"
                                                                            style={{
                                                                                ...styles.markCell, cursor: 'pointer', padding: '4px', borderRadius: '4px',
                                                                                outline: pendingChanges[`${student.studentId}_${sub.id}`] ? '2px solid #fd7e14' : 'none',
                                                                                minHeight: '44px', justifyContent: 'center'
                                                                            }}>
                                                                            <span style={{ ...styles.markValue, color: getMarkColor(result.marksObtained) }}>
                                                                                {result.marksObtained}
                                                                            </span>
                                                                            <span style={{ ...styles.gradeSmall, backgroundColor: getGradeColor(getGradeLabel(result.marksObtained)) }}>
                                                                                {getGradeLabel(result.marksObtained)}
                                                                            </span>
                                                                            {pendingChanges[`${student.studentId}_${sub.id}`] && (
                                                                                <span style={{ fontSize: '8px', color: '#fd7e14' }}>●</span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            onClick={() => startEdit(student.studentId, sub.id, null)}
                                                                            style={{ ...styles.noMark, cursor: 'pointer', fontSize: '20px' }}
                                                                            title="Click to add mark">+</span>
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
                                            <tr style={styles.averageRow}>
                                                <td colSpan="3" style={{...styles.td, ...styles.avgLabel}}>
                                                    📊 Subject Average
                                                </td>
                                                {pivotSubjects.map(sub => (
                                                    <td key={sub.id} style={{...styles.td, textAlign: 'center'}}>
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

                                {/* Legend */}
                                <div style={styles.legend}>
                                    <span style={styles.legendTitle}>💡 Click any mark to edit · Grade Legend:</span>
                                    <span style={{...styles.legendItem, color: '#28a745'}}>● A (80-100) Excellent</span>
                                    <span style={{...styles.legendItem, color: '#2E75B6'}}>● B (60-79) Good</span>
                                    <span style={{...styles.legendItem, color: '#ffc107'}}>● C (40-59) Average</span>
                                    <span style={{...styles.legendItem, color: '#dc3545'}}>● D (0-39) Below Average</span>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Instructions when nothing selected */}
                {!searched && (
                    <div style={styles.instructionCard}>
                        <h3 style={{ color: '#1F3864', marginBottom: '15px' }}>📋 How to View Results</h3>
                        <ol style={{ paddingLeft: '20px', lineHeight: '2.2', color: '#555' }}>
                            <li>Select an <strong>Exam</strong> from the dropdown</li>
                            <li>Select a <strong>Class</strong> from the dropdown</li>
                            <li>Click <strong>🔍 View Results</strong></li>
                            <li>Results show as a table with students as rows and subjects as columns</li>
                            <li>Subject averages appear at the bottom</li>
                            <li>Use <strong>Mark Entry</strong> to add or edit marks</li>
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
    instructionCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
};

export default Results;