import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

// ✅ Outside parent — prevents keyboard dismiss on mobile
const ClassFormFields = ({ formData, setFormData, sections, getSectionColor, onSubmit, onCancel, submitLabel }) => {
    const handleSectionChange = (sectionValue) => {
        const section = sections.find(s => s.value === sectionValue);
        setFormData(prev => ({ ...prev, section: sectionValue, meanTarget: section ? section.target : '', gradeLevel: '', className: '', stream: '' }));
    };

    return (
        <form onSubmit={onSubmit}>
            <div style={styles.stepGuide}>
                <span style={styles.step}>1️⃣ Section</span><span style={styles.stepArrow}>→</span>
                <span style={styles.step}>2️⃣ Grade</span><span style={styles.stepArrow}>→</span>
                <span style={styles.step}>3️⃣ Stream</span><span style={styles.stepArrow}>→</span>
                <span style={styles.step}>4️⃣ Name auto-fills ✅</span>
            </div>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>1️⃣ Section</label>
                    <select style={styles.input} value={formData.section} onChange={e => handleSectionChange(e.target.value)} required>
                        <option value="">Select Section</option>
                        <option value="PRE_SCHOOL">🟣 Pre-School</option>
                        <option value="LOWER_PRIMARY">🔵 Lower Primary</option>
                        <option value="UPPER_PRIMARY">🟠 Upper Primary</option>
                        <option value="JUNIOR_SCHOOL">🟢 Junior School</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>2️⃣ Grade Level</label>
                    <select style={styles.input} value={formData.gradeLevel}
                        onChange={e => setFormData(prev => ({...prev, gradeLevel: e.target.value}))}
                        required disabled={!formData.section}>
                        <option value="">{formData.section ? 'Select Grade' : 'Select Section first'}</option>
                        {formData.section && sections.find(s => s.value === formData.section)?.grades.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>3️⃣ Stream (Optional)</label>
                    <select style={styles.input} value={formData.stream}
                        onChange={e => setFormData(prev => ({...prev, stream: e.target.value}))}
                        disabled={!formData.gradeLevel}>
                        <option value="">No Stream</option>
                        <option value="YELLOW">🟡 Yellow</option>
                        <option value="BLUE">🔵 Blue</option>
                        <option value="RED">🔴 Red</option>
                        <option value="GREEN">🟢 Green</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>4️⃣ Class Name <span style={styles.autoTag}>Auto</span></label>
                    <input style={{...styles.input, backgroundColor:'#e3f2fd', fontWeight:'bold', fontSize:'15px'}}
                        value={formData.className}
                        onChange={e => setFormData(prev => ({...prev, className: e.target.value}))}
                        placeholder="Auto-filled" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>🎯 Mean Target <span style={styles.autoTag}>Auto</span></label>
                    <input style={{...styles.input, backgroundColor:'#f8f9fa', color:'#1F3864', fontWeight:'bold'}}
                        value={formData.meanTarget ? `${formData.meanTarget}%` : ''} readOnly placeholder="Auto-filled" />
                </div>
            </div>
            {formData.className && (
                <div style={styles.preview}>
                    <strong>Preview: </strong>
                    <span style={{ ...styles.previewBadge, backgroundColor: getSectionColor(formData.section) }}>{formData.className}</span>
                    <span style={styles.previewDetail}>
                        {sections.find(s => s.value === formData.section)?.label}
                        {formData.stream && ` • ${formData.stream} Stream`}
                        {formData.meanTarget && ` • Target: ${formData.meanTarget}%`}
                    </span>
                </div>
            )}
            <div style={styles.btnGroup}>
                <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
            </div>
        </form>
    );
};

function Classes() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [view, setView] = useState('grades');
    const [successMsg, setSuccessMsg] = useState('');
    const [formData, setFormData] = useState({ className: '', stream: '', gradeLevel: '', section: '', meanTarget: '' });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', grades: ['PG','PP1','PP2'], target: 80, color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', grades: ['G1','G2','G3'], target: 80, color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', grades: ['G4','G5','G6'], target: 70, color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', grades: ['G7','G8','G9'], target: 65, color: '#20c997' }
    ];

    const streamColors = { YELLOW: '#ffc107', BLUE: '#2E75B6', RED: '#dc3545', GREEN: '#28a745', default: '#1F3864' };

    const extractGrade = (className) => {
        if (!className) return '';
        const name = className.trim().toUpperCase();
        if (name.startsWith('PP2')) return 'PP2';
        if (name.startsWith('PP1')) return 'PP1';
        if (name.startsWith('PG')) return 'PG';
        const match = name.match(/^(G[1-9])\b/);
        return match ? match[1] : '';
    };

    const extractSection = (grade) => {
        if (!grade) return '';
        if (['PG','PP1','PP2'].includes(grade)) return 'PRE_SCHOOL';
        if (['G1','G2','G3'].includes(grade)) return 'LOWER_PRIMARY';
        if (['G4','G5','G6'].includes(grade)) return 'UPPER_PRIMARY';
        if (['G7','G8','G9'].includes(grade)) return 'JUNIOR_SCHOOL';
        return '';
    };

    const gradeLabel = (g) => {
        const labels = { PG:'Play Group', PP1:'Pre-Primary 1', PP2:'Pre-Primary 2', G1:'Grade 1', G2:'Grade 2', G3:'Grade 3', G4:'Grade 4', G5:'Grade 5', G6:'Grade 6', G7:'Grade 7', G8:'Grade 8', G9:'Grade 9' };
        return labels[g] || g;
    };

    const streamLabel = (s) => {
        const labels = { YELLOW:'Yellow', BLUE:'Blue', RED:'Red', GREEN:'Green' };
        return labels[s] || s || '';
    };

    // Auto-fill className when grade or stream changes
    useEffect(() => {
        if (formData.gradeLevel) {
            const streamSuffix = formData.stream ? formData.stream.charAt(0).toUpperCase() : '';
            setFormData(prev => ({ ...prev, className: `${prev.gradeLevel}${streamSuffix}` }));
        }
    }, [formData.gradeLevel, formData.stream]);

    useEffect(() => { fetchClasses(); fetchTeachers(); }, []);

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data); setLoading(false); }
        catch (err) { setError('Failed to load classes'); setLoading(false); }
    };

    const fetchTeachers = async () => {
        try { const r = await api.get('/api/teachers'); setTeachers(r.data); } catch(e) {}
    };

    const fetchStudentsByClass = async (classId) => {
        setLoadingStudents(true);
        try {
            const r = await api.get('/api/students');
            setStudents(r.data.filter(s => String(s.schoolClass?.classId) === String(classId)));
        } catch (err) { setError('Failed to load students'); }
        setLoadingStudents(false);
    };

    const getSectionColor = (sectionKey) => sections.find(s => s.value === sectionKey)?.color || '#1F3864';
    const getStreamColor = (stream) => streamColors[stream?.toUpperCase()] || streamColors.default;

    const handleEdit = (cls) => {
        if (editingClass?.classId === cls.classId) { setEditingClass(null); return; }
        setEditingClass(cls);
        setFormData({
            className: cls.className, stream: cls.stream || '',
            gradeLevel: cls.gradeLevel || extractGrade(cls.className),
            section: cls.section || extractSection(cls.gradeLevel || extractGrade(cls.className)),
            meanTarget: cls.meanTarget || ''
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingClass(null); setFormData({ className:'', stream:'', gradeLevel:'', section:'', meanTarget:'' }); };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/classes', { className: formData.className, stream: formData.stream || null, gradeLevel: formData.gradeLevel, section: formData.section, meanTarget: parseFloat(formData.meanTarget) });
            setShowAddForm(false);
            setFormData({ className:'', stream:'', gradeLevel:'', section:'', meanTarget:'' });
            fetchClasses();
            setSuccessMsg('✅ Class added!'); setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError(`Failed to save class: ${err.response?.data?.message || err.message}`); }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/classes/${editingClass.classId}`, { className: formData.className, stream: formData.stream || null, gradeLevel: formData.gradeLevel, section: formData.section, meanTarget: parseFloat(formData.meanTarget) });
            setEditingClass(null);
            setFormData({ className:'', stream:'', gradeLevel:'', section:'', meanTarget:'' });
            fetchClasses();
            setSuccessMsg('✅ Class updated!'); setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError(`Failed to update class: ${err.response?.data?.message || err.message}`); }
    };

    const handleAssignTeacher = async (classId, teacherId) => {
        try { await api.patch(`/api/classes/${classId}/assign-teacher/${teacherId}`); fetchClasses(); setSuccessMsg('✅ Teacher assigned!'); setTimeout(() => setSuccessMsg(''), 2000); }
        catch (err) { setError('Failed to assign teacher'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this class? Students in it will be unassigned.')) {
            try {
                await api.delete(`/api/classes/${id}`);
                if (editingClass?.classId === id) setEditingClass(null);
                fetchClasses();
                setView('grades'); setSelectedGrade(null); setSelectedClass(null);
                setSuccessMsg('Class deleted'); setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) { setError('Failed to delete class'); }
        }
    };

    const getUniqueGrades = () => {
        const grades = {};
        classes.forEach(cls => {
            const grade = cls.gradeLevel || extractGrade(cls.className);
            const section = cls.section || extractSection(grade);
            if (grade && section) {
                if (!grades[grade]) grades[grade] = { gradeLevel: grade, section, count: 0, classes: [], streams: [] };
                grades[grade].count++;
                grades[grade].classes.push(cls);
                if (cls.stream) grades[grade].streams.push(cls.stream);
            }
        });
        return Object.values(grades);
    };

    const getClassesForGrade = (gradeLevel) => classes.filter(c => (c.gradeLevel || extractGrade(c.className)) === gradeLevel);

    const gradesBySection = () => {
        const grouped = {};
        sections.forEach(s => {
            grouped[s.value] = getUniqueGrades().filter(g => g.section === s.value).sort((a,b) => a.gradeLevel.localeCompare(b.gradeLevel));
        });
        return grouped;
    };

    const handleGradeClick = (grade) => { setSelectedGrade(grade); setSelectedClass(null); setStudents([]); setView('streams'); setEditingClass(null); };
    const handleClassClick = (cls) => { setSelectedClass(cls); setView('students'); fetchStudentsByClass(cls.classId); };
    const handleBack = () => {
        if (view === 'students') { setView('streams'); setSelectedClass(null); setStudents([]); }
        else if (view === 'streams') { setView('grades'); setSelectedGrade(null); setEditingClass(null); }
    };

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}><img src={logo1} alt="Logo" style={styles.navLogo} /><h2 style={styles.navTitle}>Pipeline Adventist School</h2></div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href = '/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        {view !== 'grades' && <button onClick={handleBack} style={styles.backBtn}>← Back</button>}
                        <div>
                            <h2 style={styles.title}>
                                🏫 Classes
                                {selectedGrade && ` › ${gradeLabel(selectedGrade.gradeLevel)}`}
                                {selectedClass && ` › ${selectedClass.className}`}
                            </h2>
                            <p style={styles.breadcrumb}>
                                {view === 'grades' && `${classes.length} total classes across ${getUniqueGrades().length} grade levels`}
                                {view === 'streams' && `${getClassesForGrade(selectedGrade?.gradeLevel).length} stream(s) in ${selectedGrade?.gradeLevel}`}
                                {view === 'students' && `${students.length} student(s) in ${selectedClass?.className}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { setShowAddForm(!showAddForm); setEditingClass(null); }} style={styles.addBtn}>
                        {showAddForm ? '✕ Cancel' : '+ Add Class'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add New Class</h3>
                        <ClassFormFields
                            formData={formData} setFormData={setFormData}
                            sections={sections} getSectionColor={getSectionColor}
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); setFormData({ className:'', stream:'', gradeLevel:'', section:'', meanTarget:'' }); }}
                            submitLabel="💾 Save Class" />
                    </div>
                )}

                {loading ? <p style={styles.centerMsg}>⏳ Loading classes...</p> : (
                    <>
                        {/* ── VIEW 1: Grade Tiles ── */}
                        {view === 'grades' && (
                            <div>
                                {sections.map(section => {
                                    const sectionGrades = gradesBySection()[section.value] || [];
                                    if (!sectionGrades.length) return null;
                                    return (
                                        <div key={section.value} style={styles.sectionBlock}>
                                            <div style={{ ...styles.sectionTitle, backgroundColor: section.color }}>
                                                <span>{section.label}</span>
                                                <span style={{ fontSize:'12px', opacity:0.85 }}>
                                                    Target: {section.target}% | {sectionGrades.length} grade(s) | {sectionGrades.reduce((s,g) => s+g.count, 0)} classes
                                                </span>
                                            </div>
                                            <div style={styles.gradeTiles}>
                                                {sectionGrades.map(grade => (
                                                    <div key={grade.gradeLevel}
                                                        style={{ ...styles.gradeTile, borderTop:`4px solid ${section.color}` }}
                                                        onClick={() => handleGradeClick(grade)}
                                                        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform='none'}>
                                                        <div style={{ ...styles.gradeLabelStyle, color: section.color }}>{grade.gradeLevel}</div>
                                                        <div style={styles.gradeFullName}>{gradeLabel(grade.gradeLevel)}</div>
                                                        <div style={styles.gradeCount}>{grade.count} class{grade.count !== 1 ? 'es' : ''}</div>
                                                        {/* Stream dots */}
                                                        <div style={{ display:'flex', gap:'4px', justifyContent:'center', marginTop:'6px', flexWrap:'wrap' }}>
                                                            {grade.classes.map((cls, i) => (
                                                                <span key={i} style={{ width:'10px', height:'10px', borderRadius:'50%', backgroundColor: getStreamColor(cls.stream), display:'inline-block', title: cls.stream || 'Single' }} />
                                                            ))}
                                                        </div>
                                                        <div style={{ fontSize:'11px', color:'#999', marginTop:'6px' }}>View →</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {classes.length === 0 && (
                                    <div style={styles.emptyState}><div style={{ fontSize:'48px', marginBottom:'15px' }}>🏫</div><h3>No Classes Yet</h3><p>Click + Add Class to get started</p></div>
                                )}
                            </div>
                        )}

                        {/* ── VIEW 2: Stream Tiles ── */}
                        {view === 'streams' && selectedGrade && (
                            <div>
                                <div style={{ ...styles.sectionTitle, backgroundColor: getSectionColor(selectedGrade.section) }}>
                                    <span>{gradeLabel(selectedGrade.gradeLevel)} — Classes</span>
                                    <span style={{ fontSize:'12px', opacity:0.85 }}>{getClassesForGrade(selectedGrade.gradeLevel).length} class(es)</span>
                                </div>
                                <div style={styles.streamTiles}>
                                    {getClassesForGrade(selectedGrade.gradeLevel).map(cls => {
                                        const isEditing = editingClass?.classId === cls.classId;
                                        const streamColor = getStreamColor(cls.stream);
                                        return (
                                            <div key={cls.classId}>
                                                <div style={{ ...styles.streamTile, borderTop:`5px solid ${streamColor}`, outline: isEditing ? '2px solid #2E75B6' : 'none' }}>
                                                    <div style={styles.streamTop} onClick={() => handleClassClick(cls)}>
                                                        <div style={{ ...styles.streamBadge, backgroundColor: streamColor }}>
                                                            {streamLabel(cls.stream) || 'Single Stream'}
                                                        </div>
                                                        <div style={styles.streamName}>{gradeLabel(cls.gradeLevel)}</div>
                                                        <div style={styles.streamTeacher}>
                                                            👨‍🏫 {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : <span style={{ color:'#dc3545' }}>No Teacher Assigned</span>}
                                                        </div>
                                                        <div style={{ fontSize:'12px', color:'#666', marginBottom:'8px' }}>🎯 Target: {cls.meanTarget}%</div>
                                                        <div style={{ fontSize:'12px', color:'#2E75B6', fontWeight:'bold' }}>👥 View Students →</div>
                                                    </div>
                                                    <div style={styles.streamActions}>
                                                        <select style={styles.teacherSelect} onChange={e => handleAssignTeacher(cls.classId, e.target.value)} defaultValue="" onClick={e => e.stopPropagation()}>
                                                            <option value="">Assign Teacher</option>
                                                            {teachers.map(t => <option key={t.teacherId} value={t.teacherId}>{t.firstName} {t.lastName}</option>)}
                                                        </select>
                                                        <div style={{ display:'flex', gap:'5px' }}>
                                                            <button onClick={e => { e.stopPropagation(); handleEdit(cls); }} style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                                {isEditing ? '✕' : 'Edit'}
                                                            </button>
                                                            <button onClick={e => { e.stopPropagation(); handleDelete(cls.classId); }} style={styles.deleteBtn}>Del</button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isEditing && (
                                                    <div style={styles.inlineEditCard}>
                                                        <div style={styles.inlineEditHeader}>
                                                            <h4 style={{ color:'#2E75B6', margin:0, fontSize:'14px' }}>✏️ Editing: {cls.className}</h4>
                                                            <button onClick={handleCancelEdit} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'#999' }}>✕</button>
                                                        </div>
                                                        <ClassFormFields
                                                            formData={formData} setFormData={setFormData}
                                                            sections={sections} getSectionColor={getSectionColor}
                                                            onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                            submitLabel="✅ Update Class" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── VIEW 3: Students ── */}
                        {view === 'students' && selectedClass && (
                            <div>
                                <div style={{ ...styles.sectionTitle, backgroundColor: getSectionColor(selectedClass.section || extractSection(selectedClass.gradeLevel || extractGrade(selectedClass.className))) }}>
                                    <span>{selectedClass.className} — Students</span>
                                    <span style={{ fontSize:'12px', opacity:0.85 }}>
                                        {students.length} student(s) |
                                        {students.filter(s => s.gender === 'Male').length} boys |
                                        {students.filter(s => s.gender === 'Female').length} girls
                                    </span>
                                </div>
                                {loadingStudents ? <p style={styles.centerMsg}>⏳ Loading students...</p> : students.length === 0 ? (
                                    <div style={styles.emptyState}><div style={{ fontSize:'48px', marginBottom:'15px' }}>👥</div><h3>No Students Yet</h3><p>Go to Students page to add students to this class</p></div>
                                ) : (
                                    <div style={styles.studentGrid}>
                                        {students.sort((a,b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map((student, index) => (
                                            <div key={student.studentId} style={styles.studentCard}
                                                onClick={() => window.location.href = `/student/${student.studentId}`}>
                                                <div style={{ ...styles.studentAvatar, backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c' }}>
                                                    {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                </div>
                                                <div style={styles.studentInfo}>
                                                    <strong style={styles.studentName}>{student.firstName} {student.lastName}</strong>
                                                    <span style={{ fontSize:'11px', color:'#999', fontFamily:'monospace' }}>{student.admissionNumber}</span>
                                                    <div style={{ display:'flex', gap:'4px', marginTop:'2px', flexWrap:'wrap' }}>
                                                        <span style={{ color:'white', padding:'1px 6px', borderRadius:'3px', fontSize:'10px', backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c' }}>{student.gender}</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize:'12px', color:'#1F3864', fontWeight:'bold' }}>#{index + 1}</div>
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
    container: { minHeight:'100vh', backgroundColor:'#f0f2f5' },
    navbar: { backgroundColor:'#1F3864', padding:'15px 30px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    navLeft: { display:'flex', alignItems:'center', gap:'10px' },
    navLogo: { width:'45px', height:'45px', objectFit:'contain' },
    navTitle: { color:'white', margin:0, fontSize:'18px' },
    navRight: { display:'flex', gap:'10px' },
    navBtn: { backgroundColor:'transparent', color:'white', border:'1px solid white', padding:'8px 16px', borderRadius:'5px', cursor:'pointer' },
    logoutBtn: { backgroundColor:'transparent', color:'white', border:'1px solid white', padding:'8px 16px', borderRadius:'5px', cursor:'pointer' },
    content: { padding:'clamp(15px,3vw,30px)' },
    header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'10px' },
    headerLeft: { display:'flex', alignItems:'center', gap:'15px' },
    backBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'8px 16px', borderRadius:'5px', cursor:'pointer', fontSize:'14px' },
    title: { color:'#1F3864', margin:0, fontSize:'22px' },
    breadcrumb: { color:'#666', margin:'3px 0 0 0', fontSize:'13px' },
    addBtn: { backgroundColor:'#1F3864', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' },
    error: { color:'red', padding:'10px', backgroundColor:'#fff3f3', borderRadius:'5px', marginBottom:'15px' },
    success: { color:'#155724', padding:'10px', backgroundColor:'#d4edda', borderRadius:'5px', marginBottom:'15px' },
    centerMsg: { textAlign:'center', padding:'40px', color:'#666' },
    addFormCard: { backgroundColor:'white', padding:'25px', borderRadius:'10px', marginBottom:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.12)', border:'2px solid #1F3864' },
    formTitle: { color:'#1F3864', margin:'0 0 15px 0' },
    inlineEditCard: { backgroundColor:'white', borderRadius:'0 0 8px 8px', padding:'20px', border:'2px solid #2E75B6', borderTop:'none', marginTop:'-2px', marginBottom:'8px' },
    inlineEditHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' },
    stepGuide: { display:'flex', alignItems:'center', gap:'8px', backgroundColor:'#f8f9fa', padding:'8px 12px', borderRadius:'6px', marginBottom:'15px', flexWrap:'wrap' },
    step: { fontSize:'11px', fontWeight:'bold', color:'#1F3864' },
    stepArrow: { color:'#999', fontSize:'14px' },
    formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px', marginBottom:'12px' },
    formGroup: { display:'flex', flexDirection:'column', gap:'5px' },
    label: { fontSize:'12px', fontWeight:'bold', color:'#1F3864', display:'flex', alignItems:'center', gap:'5px' },
    autoTag: { backgroundColor:'#2E75B6', color:'white', padding:'1px 5px', borderRadius:'3px', fontSize:'9px' },
    input: { padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px' },
    preview: { backgroundColor:'#f0f4ff', padding:'10px 15px', borderRadius:'6px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' },
    previewBadge: { color:'white', padding:'3px 10px', borderRadius:'4px', fontWeight:'bold', fontSize:'15px' },
    previewDetail: { color:'#666', fontSize:'12px' },
    btnGroup: { display:'flex', gap:'10px' },
    submitBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'10px 22px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' },
    cancelBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 18px', borderRadius:'5px', cursor:'pointer', fontSize:'14px' },
    sectionBlock: { marginBottom:'30px' },
    sectionTitle: { color:'white', padding:'12px 20px', borderRadius:'8px 8px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:'bold', fontSize:'15px' },
    gradeTiles: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'10px', padding:'15px', backgroundColor:'white', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    gradeTile: { backgroundColor:'white', padding:'20px 15px', borderRadius:'8px', textAlign:'center', cursor:'pointer', boxShadow:'0 2px 4px rgba(0,0,0,0.08)', border:'1px solid #eee', transition:'transform 0.15s', userSelect:'none' },
    gradeLabelStyle: { fontSize:'24px', fontWeight:'bold', marginBottom:'3px' },
    gradeFullName: { fontSize:'10px', color:'#888', marginBottom:'5px' },
    gradeCount: { fontSize:'12px', color:'#666' },
    streamTiles: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'15px', padding:'15px', backgroundColor:'white', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    streamTile: { backgroundColor:'white', borderRadius:'8px', overflow:'visible', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', border:'1px solid #eee' },
    streamTop: { padding:'20px', cursor:'pointer', textAlign:'center' },
    streamBadge: { color:'white', padding:'5px 15px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', display:'inline-block', marginBottom:'10px' },
    streamName: { fontSize:'16px', fontWeight:'bold', color:'#1F3864', marginBottom:'8px' },
    streamTeacher: { fontSize:'12px', color:'#666', marginBottom:'5px' },
    streamActions: { borderTop:'1px solid #eee', padding:'10px 15px', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor:'#f8f9fa', gap:'8px' },
    teacherSelect: { padding:'6px', borderRadius:'5px', border:'1px solid #ddd', fontSize:'12px', flex:1 },
    editBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'6px 12px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    cancelEditBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'6px 12px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    deleteBtn: { backgroundColor:'#dc3545', color:'white', border:'none', padding:'6px 10px', borderRadius:'3px', cursor:'pointer', fontSize:'12px' },
    studentGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px', padding:'15px', backgroundColor:'white', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    studentCard: { backgroundColor:'#f8f9fa', borderRadius:'8px', padding:'12px', display:'flex', alignItems:'center', gap:'12px', border:'1px solid #eee', cursor:'pointer', transition:'transform 0.15s' },
    studentAvatar: { width:'40px', height:'40px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:'13px', flexShrink:0 },
    studentInfo: { flex:1, display:'flex', flexDirection:'column', gap:'2px', minWidth:0 },
    studentName: { fontSize:'13px', color:'#1F3864', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    emptyState: { backgroundColor:'white', padding:'60px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', marginTop:'10px' },
};

export default Classes;