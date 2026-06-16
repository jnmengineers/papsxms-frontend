import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function ClassSubjects() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [gradeSubjects, setGradeSubjects] = useState([]);
    const [selectedSubjectTiles, setSelectedSubjectTiles] = useState([]);

    // Pre-defined subjects per section
    const sectionSubjects = {
        PRE_SCHOOL: [
            'Number Work', 'Language', 'Literacy', 'Integrated',
            'Kiswahili', 'Environmental', 'Religious', 'Creative Activities'
        ],
        LOWER_PRIMARY: [
            'Mathematics', 'English', 'Kiswahili', 'Integrated',
            'CRE', 'Environmental', 'Creative Activities'
        ],
        UPPER_PRIMARY: [
            'Mathematics', 'English', 'Kiswahili', 'Science & Technology',
            'Agriculture & Nutrition', 'Social Studies', 'CRE', 'Creative Arts'
        ],
        JUNIOR_SCHOOL: [
            'Mathematics', 'English', 'Kiswahili', 'Integrated Science',
            'Pre-Technical Studies', 'Agriculture & Nutrition',
            'Social Studies', 'CRE', 'Creative Arts'
        ]
    };

    const sectionColors = {
        PRE_SCHOOL: { bg: '#6f42c1', light: '#f3e5f5' },
        LOWER_PRIMARY: { bg: '#2E75B6', light: '#e3f2fd' },
        UPPER_PRIMARY: { bg: '#fd7e14', light: '#fff3e0' },
        JUNIOR_SCHOOL: { bg: '#20c997', light: '#e0f7f1' }
    };

    const sectionLabels = {
        PRE_SCHOOL: 'Pre-School',
        LOWER_PRIMARY: 'Lower Primary',
        UPPER_PRIMARY: 'Upper Primary',
        JUNIOR_SCHOOL: 'Junior Secondary School'
    };

  // ✅ Extract grade from class name e.g. G1R → G1, PP1 Yellow → PP1
    const extractGrade = (className) => {
        if (!className) return '';
        const name = className.trim().toUpperCase();
        if (name.startsWith('PP2')) return 'PP2';
        if (name.startsWith('PP1')) return 'PP1';
        if (name.startsWith('PG')) return 'PG';
        const match = name.match(/^(G[1-9])\b/);
        if (match) return match[1];
        return name;
    };

    // ✅ Extract section from grade level
    const extractSection = (gradeOrClassName) => {
        const grade = extractGrade(gradeOrClassName);
        if (['PG', 'PP1', 'PP2'].includes(grade)) return 'PRE_SCHOOL';
        if (['G1', 'G2', 'G3'].includes(grade)) return 'LOWER_PRIMARY';
        if (['G4', 'G5', 'G6'].includes(grade)) return 'UPPER_PRIMARY';
        if (['G7', 'G8', 'G9'].includes(grade)) return 'JUNIOR_SCHOOL';
        return '';
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedGrade) {
            fetchGradeSubjects(selectedGrade);
            setSelectedSubjectTiles([]);
        }
    }, [selectedGrade]);

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    // ✅ Get all classes for a grade level — uses gradeLevel or extracts from className
    const getClassesForGrade = (gradeLevel) => {
        return classes.filter(c => {
            const grade = c.gradeLevel || extractGrade(c.className);
            return grade === gradeLevel;
        });
    };

    // ✅ Get section for a grade level
    const getSectionForGrade = (gradeLevel) => {
        const cls = classes.find(c => {
            const grade = c.gradeLevel || extractGrade(c.className);
            return grade === gradeLevel;
        });
        return cls?.section || extractSection(gradeLevel);
    };

    // Fetch subjects already assigned to ANY class of this grade
    const fetchGradeSubjects = async (gradeLevel) => {
        try {
            setLoading(true);
            const gradeClasses = getClassesForGrade(gradeLevel);
            if (gradeClasses.length === 0) {
                setGradeSubjects([]);
                setLoading(false);
                return;
            }

            // Use the first class to get assigned subjects
            const firstClass = gradeClasses[0];
            const response = await api.get(`/api/class-subjects/by-class/${firstClass.classId}`);
            setGradeSubjects(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load subjects');
            setLoading(false);
        }
    };

    const toggleSubjectTile = (subjectName) => {
        const isAssigned = gradeSubjects.some(
            cs => cs.subject?.subjectName?.toLowerCase() === subjectName.toLowerCase()
        );
        if (isAssigned) return;
        setSelectedSubjectTiles(prev =>
            prev.includes(subjectName)
                ? prev.filter(s => s !== subjectName)
                : [...prev, subjectName]
        );
    };

    const selectAllSubjects = () => {
        const section = getSectionForGrade(selectedGrade);
        const allSubjects = sectionSubjects[section] || [];
        const assignedNames = gradeSubjects.map(cs => cs.subject?.subjectName?.toLowerCase());
        const unassigned = allSubjects.filter(s => !assignedNames.includes(s.toLowerCase()));
        setSelectedSubjectTiles(unassigned);
    };

    const clearSelection = () => setSelectedSubjectTiles([]);

    // Assign subjects to ALL streams of the selected grade
    const handleBulkAssign = async () => {
        if (!selectedGrade || selectedSubjectTiles.length === 0) {
            setError('Please select at least one subject to assign');
            return;
        }

        setSaving(true);
        setError('');
        setSuccessMsg('');

        const gradeClasses = getClassesForGrade(selectedGrade);

        if (gradeClasses.length === 0) {
            setError('No classes found for this grade level');
            setSaving(false);
            return;
        }

        let totalSaved = 0;
        let totalFailed = 0;

        try {
            // Get or create subjects
            const subjectsRes = await api.get('/api/subjects');
            const allSubjects = subjectsRes.data;

            for (const subjectName of selectedSubjectTiles) {
                // Find or create subject
                let subject = allSubjects.find(s =>
                    s.subjectName.toLowerCase() === subjectName.toLowerCase()
                );

                if (!subject) {
                    const section = getSectionForGrade(selectedGrade);
                    try {
                        const createRes = await api.post('/api/subjects', {
                            subjectName: subjectName,
                            subjectCode: subjectName.replace(/\s/g, '').substring(0, 6).toUpperCase(),
                            gradeLevel: selectedGrade
                        });
                        subject = createRes.data;
                    } catch (err) {
                        totalFailed++;
                        continue;
                    }
                }

                // Assign to ALL streams of this grade simultaneously
                const assignRequests = gradeClasses.map(cls =>
                    api.post(`/api/class-subjects/assign/class/${cls.classId}/subject/${subject.subjectId}`)
                        .then(() => ({ success: true, className: cls.className }))
                        .catch(err => ({ success: false, className: cls.className }))
                );

                const results = await Promise.all(assignRequests);
                const successCount = results.filter(r => r.success).length;
                totalSaved += successCount;
            }

        } catch (err) {
            setError('Failed to assign subjects');
        }

        setSaving(false);
        setSelectedSubjectTiles([]);
        fetchGradeSubjects(selectedGrade);
        setSuccessMsg(`✅ Subjects assigned to all ${gradeClasses.length} stream(s) of ${selectedGrade}!`);
        setTimeout(() => setSuccessMsg(''), 5000);
    };

    // Remove subject from ALL streams of this grade
    const handleRemoveFromGrade = async (subjectId, subjectName) => {
        if (!window.confirm(`Remove "${subjectName}" from ALL streams of ${selectedGrade}?`)) return;

        const gradeClasses = getClassesForGrade(selectedGrade);

        try {
            const removeRequests = gradeClasses.map(cls =>
                api.delete(`/api/class-subjects/remove/class/${cls.classId}/subject/${subjectId}`)
                    .catch(() => {})
            );
            await Promise.all(removeRequests);
            fetchGradeSubjects(selectedGrade);
            setSuccessMsg(`✅ "${subjectName}" removed from all streams of ${selectedGrade}`);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to remove subject');
        }
    };

    // Get unique grade levels grouped by section
   const getGradesBySection = () => {
    const gradeMap = {};

    classes.forEach(cls => {
        // Use gradeLevel if set, otherwise extract from className
        const grade = cls.gradeLevel || extractGrade(cls.className);
        const section = cls.section || extractSection(cls.className);

        if (grade && section) {
            if (!gradeMap[grade]) {
                gradeMap[grade] = {
                    gradeLevel: grade,
                    section: section,
                    streams: []
                };
            }
            gradeMap[grade].streams.push(cls);
        }
    });

    const grouped = {
        PRE_SCHOOL: [],
        LOWER_PRIMARY: [],
        UPPER_PRIMARY: [],
        JUNIOR_SCHOOL: []
    };

    Object.values(gradeMap).forEach(grade => {
        if (grouped[grade.section]) {
            grouped[grade.section].push(grade);
        }
    });

    // Sort grades within each section
    Object.keys(grouped).forEach(section => {
        grouped[section].sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel));
    });

    return grouped;
};

    const gradesBySection = getGradesBySection();
    const currentSection = getSectionForGrade(selectedGrade);
    const availableSubjects = sectionSubjects[currentSection] || [];
    const assignedSubjectNames = gradeSubjects.map(cs => cs.subject?.subjectName?.toLowerCase());
    const selectedGradeStreams = getClassesForGrade(selectedGrade);

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
                <h2 style={styles.title}>📚 Class Subject Assignment</h2>
                <p style={styles.subtitle}>
                    Assign subjects by grade level — all streams inherit automatically
                </p>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                <div style={styles.mainGrid}>

                    {/* LEFT — Grade Selection */}
                    <div style={styles.leftPanel}>
                        <div style={styles.panelCard}>
                            <h3 style={styles.panelTitle}>🏫 Select Grade Level</h3>
                            <p style={styles.hint}>All streams of the grade will share the same subjects</p>

                            {Object.entries(gradesBySection).map(([sectionKey, grades]) => (
                                grades.length > 0 && (
                                    <div key={sectionKey} style={styles.sectionGroup}>
                                        <div style={{
                                            ...styles.sectionGroupTitle,
                                            backgroundColor: sectionColors[sectionKey]?.bg
                                        }}>
                                            {sectionLabels[sectionKey]}
                                        </div>
                                        {grades.map(grade => (
                                            <div key={grade.gradeLevel}
                                                style={{
                                                    ...styles.gradeItem,
                                                    backgroundColor: selectedGrade === grade.gradeLevel
                                                        ? sectionColors[sectionKey]?.bg
                                                        : sectionColors[sectionKey]?.light,
                                                    color: selectedGrade === grade.gradeLevel
                                                        ? 'white' : '#333',
                                                    borderLeft: `4px solid ${sectionColors[sectionKey]?.bg}`
                                                }}
                                                onClick={() => setSelectedGrade(grade.gradeLevel)}>
                                                <div style={styles.gradeItemLeft}>
                                                    <strong style={styles.gradeLevel}>{grade.gradeLevel}</strong>
                                                    <span style={styles.streamCount}>
                                                        {grade.streams.length} stream{grade.streams.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div style={styles.streamTags}>
                                                    {grade.streams.map(s => (
                                                        <span key={s.classId} style={{
                                                            ...styles.streamTag,
                                                            backgroundColor: selectedGrade === grade.gradeLevel
                                                                ? 'rgba(255,255,255,0.3)'
                                                                : 'rgba(0,0,0,0.1)'
                                                        }}>
                                                            {s.stream || s.className}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ))}

                            {classes.length === 0 && (
                                <p style={styles.noData}>No classes found. Add classes first.</p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT — Subject Assignment */}
                    <div style={styles.rightPanel}>
                        {!selectedGrade ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>👈</div>
                                <h3>Select a Grade Level</h3>
                                <p style={{ color: '#666' }}>
                                    Choose a grade from the left panel.<br />
                                    Subjects will be assigned to all its streams at once.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Streams Info Banner */}
                                <div style={{
                                    ...styles.streamsBanner,
                                    backgroundColor: sectionColors[currentSection]?.bg
                                }}>
                                    <div>
                                        <h3 style={styles.bannerTitle}>
                                            {selectedGrade} — {sectionLabels[currentSection]}
                                        </h3>
                                        <p style={styles.bannerSubtitle}>
                                            Assigning subjects to all {selectedGradeStreams.length} stream(s):
                                            {' '}{selectedGradeStreams.map(c => c.stream || c.className).join(', ')}
                                        </p>
                                    </div>
                                    <div style={styles.bannerBadge}>
                                        🎯 Target: {selectedGradeStreams[0]?.meanTarget || '-'}%
                                    </div>
                                </div>

                                {/* Subject Tiles */}
                                <div style={styles.panelCard}>
                                    <div style={styles.subjectHeader}>
                                        <div>
                                            <h3 style={styles.panelTitle}>
                                                📖 Available Subjects
                                            </h3>
                                            <p style={styles.hint}>
                                                Click to select • Green = already assigned
                                            </p>
                                        </div>
                                        <div style={styles.actionBtns}>
                                            <button onClick={selectAllSubjects} style={styles.selectAllBtn}>
                                                ✅ Select All
                                            </button>
                                            <button onClick={clearSelection} style={styles.clearSelBtn}>
                                                ✕ Clear
                                            </button>
                                        </div>
                                    </div>

                                    <div style={styles.tilesGrid}>
                                        {availableSubjects.map(subjectName => {
                                            const isAssigned = assignedSubjectNames.includes(subjectName.toLowerCase());
                                            const isSelected = selectedSubjectTiles.includes(subjectName);
                                            const color = sectionColors[currentSection];

                                            return (
                                                <div key={subjectName}
                                                    style={{
                                                        ...styles.subjectTile,
                                                        backgroundColor: isAssigned
                                                            ? '#e8f5e9'
                                                            : isSelected
                                                                ? color?.bg
                                                                : 'white',
                                                        color: isAssigned
                                                            ? '#28a745'
                                                            : isSelected
                                                                ? 'white'
                                                                : '#333',
                                                        border: isAssigned
                                                            ? '2px solid #28a745'
                                                            : isSelected
                                                                ? `2px solid ${color?.bg}`
                                                                : '2px solid #eee',
                                                        cursor: isAssigned ? 'default' : 'pointer',
                                                        transform: isSelected ? 'scale(1.03)' : 'scale(1)'
                                                    }}
                                                    onClick={() => !isAssigned && toggleSubjectTile(subjectName)}>
                                                    <span style={styles.tileIcon}>
                                                        {isAssigned ? '✅' : isSelected ? '☑️' : '📘'}
                                                    </span>
                                                    <span style={styles.tileName}>{subjectName}</span>
                                                    {isAssigned && (
                                                        <span style={styles.assignedTag}>All Streams</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Assign Button */}
                                    {selectedSubjectTiles.length > 0 && (
                                        <div style={styles.assignSection}>
                                            <div>
                                                <strong>{selectedSubjectTiles.length}</strong> subject(s) selected
                                                <span style={styles.assignNote}>
                                                    → Will assign to {selectedGradeStreams.length} stream(s)
                                                </span>
                                            </div>
                                            <button onClick={handleBulkAssign}
                                                style={{
                                                    ...styles.assignBtn,
                                                    backgroundColor: sectionColors[currentSection]?.bg
                                                }}
                                                disabled={saving}>
                                                {saving
                                                    ? '⏳ Assigning to all streams...'
                                                    : `➕ Assign to All ${selectedGrade} Streams`}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Assigned Subjects List */}
                                <div style={styles.panelCard}>
                                    <h3 style={styles.panelTitle}>
                                        ✅ Assigned Subjects
                                        <span style={{
                                            ...styles.countBadge,
                                            backgroundColor: sectionColors[currentSection]?.bg
                                        }}>
                                            {gradeSubjects.length}
                                        </span>
                                    </h3>

                                    {loading ? (
                                        <p style={styles.noData}>Loading...</p>
                                    ) : gradeSubjects.length === 0 ? (
                                        <p style={styles.noData}>
                                            No subjects assigned yet. Select subjects above and click Assign.
                                        </p>
                                    ) : (
                                        <div style={styles.assignedGrid}>
                                            {gradeSubjects.map((cs, index) => (
                                                <div key={cs.id} style={styles.assignedItem}>
                                                    <div style={styles.assignedLeft}>
                                                        <span style={{
                                                            ...styles.assignedNum,
                                                            backgroundColor: sectionColors[currentSection]?.bg
                                                        }}>
                                                            {index + 1}
                                                        </span>
                                                        <div>
                                                            <strong style={styles.assignedName}>
                                                                {cs.subject?.subjectName}
                                                            </strong>
                                                            <div style={styles.assignedMeta}>
                                                                📚 {cs.subject?.subjectCode} |
                                                                Applied to {selectedGradeStreams.length} stream(s)
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveFromGrade(
                                                            cs.subject?.subjectId,
                                                            cs.subject?.subjectName
                                                        )}
                                                        style={styles.removeBtn}>
                                                        ✕ Remove from All
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
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
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px', border: '1px solid #ffcdd2' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    hint: { color: '#888', fontSize: '12px', margin: '0 0 10px 0', fontStyle: 'italic' },

    // Layout
    mainGrid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' },

    // Left Panel
    leftPanel: {},
    panelCard: { backgroundColor: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' },
    panelTitle: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
    sectionGroup: { marginBottom: '15px' },
    sectionGroupTitle: { color: 'white', padding: '6px 12px', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' },
    gradeItem: { padding: '10px 12px', borderRadius: '5px', marginBottom: '6px', cursor: 'pointer', transition: 'all 0.2s' },
    gradeItemLeft: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
    gradeLevel: { fontSize: '15px' },
    streamCount: { fontSize: '11px', opacity: 0.8 },
    streamTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
    streamTag: { fontSize: '10px', padding: '2px 6px', borderRadius: '3px' },
    noData: { color: '#999', textAlign: 'center', padding: '20px', fontStyle: 'italic' },

    // Right Panel
    rightPanel: {},
    emptyState: { backgroundColor: 'white', borderRadius: '10px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },

    // Streams Banner
    streamsBanner: { borderRadius: '10px', padding: '15px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    bannerTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '18px' },
    bannerSubtitle: { color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '13px' },
    bannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' },

    // Subject Tiles
    subjectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' },
    actionBtns: { display: 'flex', gap: '8px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
    clearSelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' },
    tilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px' },
    subjectTile: { padding: '15px 10px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s', userSelect: 'none' },
    tileIcon: { fontSize: '22px' },
    tileName: { fontSize: '12px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.3' },
    assignedTag: { fontSize: '10px', backgroundColor: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '10px' },

    // Assign Section
    assignSection: { borderTop: '2px solid #f0f2f5', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    assignNote: { color: '#666', fontSize: '12px', marginLeft: '8px', fontStyle: 'italic' },
    assignBtn: { color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    // Assigned Subjects
    countBadge: { color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', marginLeft: '8px' },
    assignedGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
    assignedItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' },
    assignedLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    assignedNum: { color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 },
    assignedName: { fontSize: '14px', color: '#1F3864' },
    assignedMeta: { fontSize: '11px', color: '#999', marginTop: '2px' },
    removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }
};

export default ClassSubjects;