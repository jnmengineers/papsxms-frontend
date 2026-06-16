import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Classes() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [view, setView] = useState('grades');

    const [formData, setFormData] = useState({
        className: '',
        stream: '',
        gradeLevel: '',
        section: '',
        meanTarget: ''
    });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', grades: ['PG', 'PP1', 'PP2'], target: 80, color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', grades: ['G1', 'G2', 'G3'], target: 80, color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', grades: ['G4', 'G5', 'G6'], target: 70, color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', grades: ['G7', 'G8', 'G9'], target: 65, color: '#20c997' }
    ];

    const streamColors = {
        'YELLOW': '#ffc107',
        'BLUE': '#2E75B6',
        'RED': '#dc3545',
        'GREEN': '#28a745',
        'default': '#1F3864'
    };

    

    // ✅ Extract grade from class name e.g. G1R → G1
   const extractGrade = (className) => {
    if (!className) return '';
    const name = className.trim().toUpperCase();

    // Must check longer prefixes first
    if (name.startsWith('PP2')) return 'PP2';
    if (name.startsWith('PP1')) return 'PP1';
    if (name.startsWith('PG')) return 'PG';

    // Match G1, G2, G3 ... G9 exactly at start
    const match = name.match(/^(G[1-9])\b/);
    if (match) return match[1];

    return '';
};

    // ✅ Extract section from grade level
    const extractSection = (grade) => {
        if (!grade) return '';
        if (['PG', 'PP1', 'PP2'].includes(grade)) return 'PRE_SCHOOL';
        if (['G1', 'G2', 'G3'].includes(grade)) return 'LOWER_PRIMARY';
        if (['G4', 'G5', 'G6'].includes(grade)) return 'UPPER_PRIMARY';
        if (['G7', 'G8', 'G9'].includes(grade)) return 'JUNIOR_SCHOOL';
        return '';
    };

    // ✅ Auto generate class name from grade + stream
    useEffect(() => {
        if (formData.gradeLevel) {
            const streamSuffix = formData.stream
                ? formData.stream.charAt(0).toUpperCase()
                : '';
            const autoName = `${formData.gradeLevel}${streamSuffix}`;
            setFormData(prev => ({ ...prev, className: autoName }));
        }
    }, [formData.gradeLevel, formData.stream]);

    useEffect(() => {
        fetchClasses();
        fetchTeachers();
    }, []);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load classes');
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        const response = await api.get('/api/teachers');
        setTeachers(response.data);
    };

    const fetchStudentsByClass = async (classId) => {
        setLoadingStudents(true);
        try {
            const response = await api.get('/api/students');
            const classStudents = response.data.filter(s =>
                String(s.schoolClass?.classId) === String(classId)
            );
            setStudents(classStudents);
        } catch (err) {
            setError('Failed to load students');
        }
        setLoadingStudents(false);
    };

    const handleSectionChange = (sectionValue) => {
        const section = sections.find(s => s.value === sectionValue);
        setFormData(prev => ({
            ...prev,
            section: sectionValue,
            meanTarget: section ? section.target : '',
            gradeLevel: '',
            className: ''
        }));
    };

    const handleEdit = (cls) => {
        setEditingClass(cls);
        setFormData({
            className: cls.className,
            stream: cls.stream || '',
            gradeLevel: cls.gradeLevel || extractGrade(cls.className),
            section: cls.section || extractSection(cls.gradeLevel || extractGrade(cls.className)),
            meanTarget: cls.meanTarget || ''
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const payload = {
            className: formData.className,
            stream: formData.stream || null,
            gradeLevel: formData.gradeLevel,
            section: formData.section,
            meanTarget: parseFloat(formData.meanTarget)
        };

        console.log('Sending payload:', payload);

        if (editingClass) {
            await api.put(`/api/classes/${editingClass.classId}`, payload);
        } else {
            await api.post('/api/classes', payload);
        }
        setShowForm(false);
        setEditingClass(null);
        setFormData({ className: '', stream: '', gradeLevel: '', section: '', meanTarget: '' });
        fetchClasses();
    } catch (err) {
        console.log('Error:', err.response?.data);
        setError(`Failed to save class: ${err.response?.data?.message || err.message}`);
    }
};

    const handleAssignTeacher = async (classId, teacherId) => {
        try {
            await api.patch(`/api/classes/${classId}/assign-teacher/${teacherId}`);
            fetchClasses();
        } catch (err) {
            setError('Failed to assign teacher');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/classes/${id}`);
                fetchClasses();
                setView('grades');
                setSelectedGrade(null);
                setSelectedClass(null);
            } catch (err) {
                setError('Failed to delete class');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingClass(null);
        setFormData({ className: '', stream: '', gradeLevel: '', section: '', meanTarget: '' });
    };

    // ✅ Get unique grades using fallback
    const getUniqueGrades = () => {
        const grades = {};
        classes.forEach(cls => {
            const grade = cls.gradeLevel || extractGrade(cls.className);
            const section = cls.section || extractSection(grade);
            if (grade && section) {
                if (!grades[grade]) {
                    grades[grade] = {
                        gradeLevel: grade,
                        section: section,
                        count: 0,
                        classes: []
                    };
                }
                grades[grade].count++;
                grades[grade].classes.push(cls);
            }
        });
        return Object.values(grades);
    };

    // ✅ Get classes for grade using fallback
   const getClassesForGrade = (gradeLevel) => {
    return classes.filter(c => {
        // Use stored gradeLevel first — most reliable
        if (c.gradeLevel) {
            return c.gradeLevel === gradeLevel;
        }
        // Fallback — extract from className
        const extracted = extractGrade(c.className);
        return extracted === gradeLevel;
    });
};

    const getSectionInfo = (sectionKey) => sections.find(s => s.value === sectionKey);
    const getSectionColor = (sectionKey) => getSectionInfo(sectionKey)?.color || '#1F3864';
    const getStreamColor = (stream) => streamColors[stream?.toUpperCase()] || streamColors.default;

    // ✅ Group grades by section sorted
    const gradesBySection = () => {
        const grouped = {};
        sections.forEach(s => {
            grouped[s.value] = getUniqueGrades()
                .filter(g => g.section === s.value)
                .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel));
        });
        return grouped;
    };

    const handleGradeClick = (grade) => {
        setSelectedGrade(grade);
        setSelectedClass(null);
        setStudents([]);
        setView('streams');
    };

    const handleClassClick = (cls) => {
        setSelectedClass(cls);
        setView('students');
        fetchStudentsByClass(cls.classId);
    };

    const handleBack = () => {
        if (view === 'students') {
            setView('streams');
            setSelectedClass(null);
            setStudents([]);
        } else if (view === 'streams') {
            setView('grades');
            setSelectedGrade(null);
        }
    };

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
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        {view !== 'grades' && (
                            <button onClick={handleBack} style={styles.backBtn}>← Back</button>
                        )}
                        <div>
                            <h2 style={styles.title}>
                                🏫 Classes
                                {selectedGrade && ` › ${selectedGrade.gradeLevel}`}
                                {selectedClass && ` › ${selectedClass.className}`}
                            </h2>
                            <p style={styles.breadcrumb}>
                                {view === 'grades' && `${classes.length} total classes`}
                                {view === 'streams' && `${getClassesForGrade(selectedGrade?.gradeLevel).length} class(es) in ${selectedGrade?.gradeLevel}`}
                                {view === 'students' && `${students.length} student(s) in ${selectedClass?.className}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setEditingClass(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Class'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* Add/Edit Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3 style={styles.formTitle}>
                            {editingClass ? '✏️ Edit Class' : '➕ Add New Class'}
                        </h3>

                        {/* Step Guide */}
                        <div style={styles.stepGuide}>
                            <span style={styles.step}>1️⃣ Select Section</span>
                            <span style={styles.stepArrow}>→</span>
                            <span style={styles.step}>2️⃣ Select Grade</span>
                            <span style={styles.stepArrow}>→</span>
                            <span style={styles.step}>3️⃣ Select Stream</span>
                            <span style={styles.stepArrow}>→</span>
                            <span style={styles.step}>4️⃣ Name auto-fills ✅</span>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                {/* Step 1 — Section */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        1️⃣ Section
                                    </label>
                                    <select style={styles.input} value={formData.section}
                                        onChange={e => handleSectionChange(e.target.value)} required>
                                        <option value="">Select Section</option>
                                        <option value="PRE_SCHOOL">🟣 Pre-School (PG, PP1, PP2)</option>
                                        <option value="LOWER_PRIMARY">🔵 Lower Primary (G1, G2, G3)</option>
                                        <option value="UPPER_PRIMARY">🟠 Upper Primary (G4, G5, G6)</option>
                                        <option value="JUNIOR_SCHOOL">🟢 Junior School (G7, G8, G9)</option>
                                    </select>
                                </div>

                                {/* Step 2 — Grade Level */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        2️⃣ Grade Level
                                    </label>
                                    <select style={styles.input} value={formData.gradeLevel}
                                        onChange={e => setFormData(prev => ({...prev, gradeLevel: e.target.value}))}
                                        required disabled={!formData.section}>
                                        <option value="">
                                            {formData.section ? 'Select Grade' : 'Select Section first'}
                                        </option>
                                        {formData.section && sections.find(s => s.value === formData.section)?.grades.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Step 3 — Stream */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        3️⃣ Stream (Optional)
                                    </label>
                                    <select style={styles.input} value={formData.stream}
                                        onChange={e => setFormData(prev => ({...prev, stream: e.target.value}))}
                                        disabled={!formData.gradeLevel}>
                                        <option value="">No Stream (Single Class)</option>
                                        <option value="YELLOW">🟡 Yellow</option>
                                        <option value="BLUE">🔵 Blue</option>
                                        <option value="RED">🔴 Red</option>
                                        <option value="GREEN">🟢 Green</option>
                                    </select>
                                </div>

                                {/* Step 4 — Auto Class Name */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        4️⃣ Class Name
                                        <span style={styles.autoTag}>Auto Generated</span>
                                    </label>
                                    <input
                                        style={{...styles.input, backgroundColor: '#e3f2fd', fontWeight: 'bold', fontSize: '16px'}}
                                        value={formData.className}
                                        onChange={e => setFormData(prev => ({...prev, className: e.target.value}))}
                                        placeholder="Auto-filled"
                                        required
                                    />
                                </div>

                                {/* Mean Target — Read Only */}
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        🎯 Mean Target (%)
                                        <span style={styles.autoTag}>Auto</span>
                                    </label>
                                    <input
                                        style={{...styles.input, backgroundColor: '#f8f9fa', color: '#1F3864', fontWeight: 'bold'}}
                                        value={formData.meanTarget ? `${formData.meanTarget}%` : ''}
                                        readOnly
                                        placeholder="Auto-filled based on section"
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            {formData.className && (
                                <div style={styles.preview}>
                                    <strong>Preview: </strong>
                                    <span style={{
                                        ...styles.previewBadge,
                                        backgroundColor: getSectionColor(formData.section)
                                    }}>
                                        {formData.className}
                                    </span>
                                    <span style={styles.previewDetail}>
                                        {formData.section && sections.find(s => s.value === formData.section)?.label}
                                        {formData.stream && ` • ${formData.stream} Stream`}
                                        {formData.meanTarget && ` • Target: ${formData.meanTarget}%`}
                                    </span>
                                </div>
                            )}

                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingClass ? '✅ Update Class' : '💾 Save Class'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <p style={styles.centerMsg}>⏳ Loading classes...</p>
                ) : (
                    <>
                        {/* VIEW 1 — Grade Tiles */}
                        {view === 'grades' && (
                            <div>
                                {sections.map(section => {
                                    const sectionGrades = gradesBySection()[section.value] || [];
                                    if (sectionGrades.length === 0) return null;
                                    return (
                                        <div key={section.value} style={styles.sectionBlock}>
                                            <div style={{...styles.sectionTitle, backgroundColor: section.color}}>
                                                <span>{section.label}</span>
                                                <span style={styles.sectionMeta}>
                                                    Target: {section.target}% | {sectionGrades.length} grade(s)
                                                </span>
                                            </div>
                                            <div style={styles.gradeTiles}>
                                                {sectionGrades.map(grade => (
                                                    <div key={grade.gradeLevel}
                                                        style={{...styles.gradeTile, borderTop: `4px solid ${section.color}`}}
                                                        onClick={() => handleGradeClick(grade)}>
                                                        <div style={{...styles.gradeLabel, color: section.color}}>
                                                            {grade.gradeLevel}
                                                        </div>
                                                        <div style={styles.gradeCount}>
                                                            {grade.count} class{grade.count !== 1 ? 'es' : ''}
                                                        </div>
                                                        <div style={styles.gradeArrow}>View →</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {classes.length === 0 && (
                                    <div style={styles.emptyState}>
                                        <div style={styles.emptyIcon}>🏫</div>
                                        <h3>No Classes Yet</h3>
                                        <p>Click + Add Class to get started</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* VIEW 2 — Stream Tiles */}
                        {view === 'streams' && selectedGrade && (
                            <div>
                                <div style={{
                                    ...styles.sectionTitle,
                                    backgroundColor: getSectionColor(selectedGrade.section)
                                }}>
                                    <span>{selectedGrade.gradeLevel} — Classes</span>
                                    <span style={styles.sectionMeta}>
                                        {getClassesForGrade(selectedGrade.gradeLevel).length} class(es)
                                    </span>
                                </div>
                                <div style={styles.streamTiles}>
                                    {getClassesForGrade(selectedGrade.gradeLevel).map(cls => (
                                        <div key={cls.classId}
                                            style={{
                                                ...styles.streamTile,
                                                borderTop: `5px solid ${getStreamColor(cls.stream)}`
                                            }}>
                                            <div style={styles.streamTop}
                                                onClick={() => handleClassClick(cls)}>
                                                <div style={{
                                                    ...styles.streamBadge,
                                                    backgroundColor: getStreamColor(cls.stream)
                                                }}>
                                                    {cls.stream || 'SINGLE'}
                                                </div>
                                                <div style={styles.streamName}>{cls.className}</div>
                                                <div style={styles.streamTeacher}>
                                                    👨‍🏫 {cls.classTeacher
                                                        ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}`
                                                        : 'No Teacher Assigned'}
                                                </div>
                                                <div style={styles.streamTarget}>
                                                    🎯 Target: {cls.meanTarget}%
                                                </div>
                                                <div style={styles.viewStudentsBtn}>
                                                    👥 View Students →
                                                </div>
                                            </div>
                                            <div style={styles.streamActions}>
                                                <select style={styles.teacherSelect}
                                                    onChange={e => handleAssignTeacher(cls.classId, e.target.value)}
                                                    defaultValue=""
                                                    onClick={e => e.stopPropagation()}>
                                                    <option value="">Assign Teacher</option>
                                                    {teachers.map(t => (
                                                        <option key={t.teacherId} value={t.teacherId}>
                                                            {t.firstName} {t.lastName}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div style={styles.streamBtns}>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleEdit(cls); }}
                                                        style={styles.editBtn}>Edit</button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleDelete(cls.classId); }}
                                                        style={styles.deleteBtn}>Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* VIEW 3 — Students */}
                        {view === 'students' && selectedClass && (
                            <div>
                                <div style={{
                                    ...styles.sectionTitle,
                                    backgroundColor: getSectionColor(
                                        selectedClass.section ||
                                        extractSection(selectedClass.gradeLevel || extractGrade(selectedClass.className))
                                    )
                                }}>
                                    <span>{selectedClass.className} — Students</span>
                                    <span style={styles.sectionMeta}>{students.length} student(s)</span>
                                </div>
                                {loadingStudents ? (
                                    <p style={styles.centerMsg}>⏳ Loading students...</p>
                                ) : students.length === 0 ? (
                                    <div style={styles.emptyState}>
                                        <div style={styles.emptyIcon}>👥</div>
                                        <h3>No Students Yet</h3>
                                        <p>Go to Students page to add students to this class</p>
                                    </div>
                                ) : (
                                    <div style={styles.studentGrid}>
                                        {students.map((student, index) => (
                                            <div key={student.studentId} style={styles.studentCard}>
                                                <div style={{
                                                    ...styles.studentAvatar,
                                                    backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c'
                                                }}>
                                                    {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                </div>
                                                <div style={styles.studentInfo}>
                                                    <strong style={styles.studentName}>
                                                        {student.firstName} {student.lastName}
                                                    </strong>
                                                    <span style={styles.studentAdm}>{student.admissionNumber}</span>
                                                    <span style={{
                                                        ...styles.studentGender,
                                                        backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c'
                                                    }}>
                                                        {student.gender}
                                                    </span>
                                                </div>
                                                <div style={styles.studentRank}>#{index + 1}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' },
    title: { color: '#1F3864', margin: 0, fontSize: '22px' },
    breadcrumb: { color: '#666', margin: '3px 0 0 0', fontSize: '13px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },

    // Form
    form: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formTitle: { color: '#1F3864', marginBottom: '15px' },
    stepGuide: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8f9fa', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px', flexWrap: 'wrap' },
    step: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    stepArrow: { color: '#999', fontSize: '16px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '13px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '5px' },
    autoTag: { backgroundColor: '#2E75B6', color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', marginLeft: '5px' },
    input: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    preview: { backgroundColor: '#f0f4ff', padding: '12px 15px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    previewBadge: { color: 'white', padding: '4px 12px', borderRadius: '5px', fontWeight: 'bold', fontSize: '16px' },
    previewDetail: { color: '#666', fontSize: '13px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    // Section Block
    sectionBlock: { marginBottom: '30px' },
    sectionTitle: { color: 'white', padding: '12px 20px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '15px' },
    sectionMeta: { fontSize: '12px', opacity: 0.85 },

    // Grade Tiles
    gradeTiles: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', padding: '15px', backgroundColor: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    gradeTile: { backgroundColor: 'white', padding: '20px 15px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', transition: 'transform 0.2s', border: '1px solid #eee' },
    gradeLabel: { fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' },
    gradeCount: { fontSize: '12px', color: '#666', marginBottom: '8px' },
    gradeArrow: { fontSize: '12px', color: '#999' },

    // Stream Tiles
    streamTiles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    streamTile: { backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #eee' },
    streamTop: { padding: '20px', cursor: 'pointer', textAlign: 'center' },
    streamBadge: { color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' },
    streamName: { fontSize: '16px', fontWeight: 'bold', color: '#1F3864', marginBottom: '8px' },
    streamTeacher: { fontSize: '12px', color: '#666', marginBottom: '5px' },
    streamTarget: { fontSize: '12px', color: '#666', marginBottom: '10px' },
    viewStudentsBtn: { fontSize: '12px', color: '#2E75B6', fontWeight: 'bold' },
    streamActions: { borderTop: '1px solid #eee', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', gap: '8px' },
    teacherSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '12px', flex: 1 },
    streamBtns: { display: 'flex', gap: '5px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },

    // Student Grid
    studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '15px', backgroundColor: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    studentCard: { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '15px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eee', position: 'relative' },
    studentAvatar: { width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 },
    studentInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
    studentName: { fontSize: '13px', color: '#1F3864', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    studentAdm: { fontSize: '11px', color: '#999', fontFamily: 'monospace' },
    studentGender: { color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', display: 'inline-block', width: 'fit-content' },
    studentRank: { position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#ccc' },

    // Empty state
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '10px' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' }
};

export default Classes;