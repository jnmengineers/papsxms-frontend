import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import { streamLabel, classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

function ClassSubjects() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [gradeSubjects, setGradeSubjects] = useState([]);
    const [selectedSubjectTiles, setSelectedSubjectTiles] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);

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
        fetchAllSubjects();
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
    const fetchAllSubjects = async () => {
        try { const response = await api.get('/api/subjects'); setAllSubjects(response.data); } catch (err) {}
    };

    const getClassesForGrade = (gradeLevel) => {
        return classes.filter(c => {
            const grade = c.gradeLevel || extractGrade(c.className);
            return grade === gradeLevel;
        });
    };

    const getSectionForGrade = (gradeLevel) => {
        const cls = classes.find(c => {
            const grade = c.gradeLevel || extractGrade(c.className);
            return grade === gradeLevel;
        });
        return cls?.section || extractSection(gradeLevel);
    };

    const fetchGradeSubjects = async (gradeLevel) => {
        try {
            setLoading(true);
            const gradeClasses = getClassesForGrade(gradeLevel);
            if (gradeClasses.length === 0) {
                setGradeSubjects([]);
                setLoading(false);
                return;
            }

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
        const subjectNames = [...new Set(allSubjects.filter(s => extractSection(s.gradeLevel) === currentSection).map(s => s.subjectName))];
        const assignedNames = gradeSubjects.map(cs => cs.subject?.subjectName?.toLowerCase());
        const unassigned = subjectNames.filter(s => !assignedNames.includes(s.toLowerCase()));
        setSelectedSubjectTiles(unassigned);
    };

    const clearSelection = () => setSelectedSubjectTiles([]);

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
            const subjectsRes = await api.get('/api/subjects');
            const allSubjects = subjectsRes.data;

            for (const subjectName of selectedSubjectTiles) {
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

    const getGradesBySection = () => {
    const gradeMap = {};

    classes.forEach(cls => {
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

    Object.keys(grouped).forEach(section => {
        grouped[section].sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel));
    });
    return grouped;
};
    const gradesBySection = getGradesBySection();
    const currentSection = getSectionForGrade(selectedGrade);
    const availableSubjects = [...new Set(allSubjects.filter(s => extractSection(s.gradeLevel) === currentSection).map(s => s.subjectName))];
    const assignedSubjectNames = gradeSubjects.map(cs => cs.subject?.subjectName?.toLowerCase());
    const selectedGradeStreams = getClassesForGrade(selectedGrade);

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
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
                                                            {streamLabel(s.stream) || classDisplayName(s)}
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
                                                                : '2px solid #f0f0f0',
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
            <Footer/>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#888', marginBottom: '25px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px' },
    hint: { color: '#999', fontSize: '12px', margin: '0 0 10px 0', fontStyle: 'italic' },

    mainGrid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' },

    leftPanel: {},
    panelCard: { backgroundColor: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
    panelTitle: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
    sectionGroup: { marginBottom: '15px' },
    sectionGroupTitle: { color: 'white', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' },
    gradeItem: { padding: '11px 12px', borderRadius: '10px', marginBottom: '7px', cursor: 'pointer', transition: 'all 0.2s' },
    gradeItemLeft: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
    gradeLevel: { fontSize: '15px' },
    streamCount: { fontSize: '11px', opacity: 0.8 },
    streamTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
    streamTag: { fontSize: '10px', padding: '2px 7px', borderRadius: '6px' },
    noData: { color: '#999', textAlign: 'center', padding: '20px', fontStyle: 'italic' },

    rightPanel: {},
    emptyState: { backgroundColor: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },

    streamsBanner: { borderRadius: '14px', padding: '16px 22px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    bannerTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '18px', fontWeight: 700 },
    bannerSubtitle: { color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '13px' },
    bannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' },

    subjectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' },
    actionBtns: { display: 'flex', gap: '8px' },
    selectAllBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
    clearSelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
    tilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px' },
    subjectTile: { padding: '16px 10px', borderRadius: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s', userSelect: 'none' },
    tileIcon: { fontSize: '22px' },
    tileName: { fontSize: '12px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.3' },
    assignedTag: { fontSize: '10px', backgroundColor: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '10px' },

    assignSection: { borderTop: '2px solid #f0f2f5', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    assignNote: { color: '#666', fontSize: '12px', marginLeft: '8px', fontStyle: 'italic' },
    assignBtn: { color: 'white', border: 'none', padding: '11px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    countBadge: { color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '12px', marginLeft: '8px' },
    assignedGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
    assignedItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '1px solid #f0f0f0' },
    assignedLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    assignedNum: { color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 },
    assignedName: { fontSize: '14px', color: '#1F3864' },
    assignedMeta: { fontSize: '11px', color: '#999', marginTop: '2px' },
    removeBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }
};

export default ClassSubjects;