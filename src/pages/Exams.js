import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

// ✅ Outside parent — prevents keyboard dismiss on mobile
const ExamForm = ({ formData, setFormData, academicYears, onSubmit, onCancel, submitLabel }) => {

    const handleAcademicYearChange = (yearId) => {
        const selected = academicYears.find(ay => Number(ay.yearId) === Number(yearId));
        if (selected) {
            setFormData(prev => ({
                ...prev,
                academicYearId: Number(yearId),
                academicYear: selected.yearLabel,
                term: String(selected.term),
                startDate: selected.startDate,
                endDate: selected.endDate
            }));
        } else {
            setFormData(prev => ({ ...prev, academicYearId: '', academicYear: '', term: '', startDate: '', endDate: '' }));
        }
    };

    return (
        <form onSubmit={onSubmit} style={styles.inlineForm}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        📅 Academic Year
                        <span style={styles.autoTag}>Auto-fills term & dates</span>
                    </label>
                    <select style={styles.input} value={formData.academicYearId || ''}
                        onChange={e => handleAcademicYearChange(e.target.value)} required>
                        <option value="">-- Select Year & Term --</option>
                        {academicYears.map(ay => (
                            <option key={ay.yearId} value={ay.yearId}>
                                {ay.yearLabel} | Term {ay.term} {ay.isActive ? '✅ Active' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>📝 Exam Name</label>
                    <input style={styles.input} value={formData.examName}
                        onChange={e => setFormData(prev => ({...prev, examName: e.target.value}))}
                        placeholder="e.g. Opening, Mid Term, End Term" required />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>📋 Exam Type</label>
                    <select style={styles.input} value={formData.examType || ''}
                        onChange={e => setFormData(prev => ({...prev, examType: e.target.value}))} required>
                        <option value="">-- Select Type --</option>
                        <option value="OPENING">🟢 Opening Exam</option>
                        <option value="MID_TERM">🟡 Mid Term Exam</option>
                        <option value="END_TERM">🔵 End Term Exam</option>
                    </select>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>🏫 Class Level</label>
                    <select style={styles.input} value={formData.classLevel}
                        onChange={e => setFormData(prev => ({...prev, classLevel: e.target.value}))} required>
                        <option value="">Select Class Level</option>
                        <option value="ALL">All Classes</option>
                        <optgroup label="Pre-School">
                            <option value="PG">PG</option>
                            <option value="PP1">PP1</option>
                            <option value="PP2">PP2</option>
                        </optgroup>
                        <optgroup label="Lower Primary">
                            <option value="G1">G1</option>
                            <option value="G2">G2</option>
                            <option value="G3">G3</option>
                        </optgroup>
                        <optgroup label="Upper Primary">
                            <option value="G4">G4</option>
                            <option value="G5">G5</option>
                            <option value="G6">G6</option>
                        </optgroup>
                        <optgroup label="Junior School">
                            <option value="G7">G7</option>
                            <option value="G8">G8</option>
                            <option value="G9">G9</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            {/* Auto-filled preview */}
            {formData.academicYearId && formData.term && (
                <div style={styles.autoFillPreview}>
                    <span style={styles.autoFillItem}>🏫 Year: <strong>{formData.academicYear}</strong></span>
                    <span style={styles.autoFillItem}>📋 Term: <strong>Term {formData.term}</strong></span>
                    <span style={styles.autoFillItem}>🗓️ {formData.startDate} → {formData.endDate}</span>
                    {formData.examType && (
                        <span style={{
                            ...styles.autoFillItem,
                            backgroundColor: formData.examType === 'OPENING' ? '#d4edda' : formData.examType === 'MID_TERM' ? '#fff3cd' : '#cce5ff',
                            padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'
                        }}>
                            {formData.examType === 'OPENING' ? '🟢 Opening' : formData.examType === 'MID_TERM' ? '🟡 Mid Term' : '🔵 End Term'}
                        </span>
                    )}
                </div>
            )}

            <div style={styles.btnGroup}>
                <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
            </div>
        </form>
    );
};

function Exams() {
    const [exams, setExams] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [formData, setFormData] = useState({
        examName: '', academicYear: '', academicYearId: '',
        term: '', startDate: '', endDate: '', classLevel: '', examType: ''
    });

    const examTypeColors = { OPENING: '#28a745', MID_TERM: '#ffc107', END_TERM: '#2E75B6' };
    const examTypeLabels = { OPENING: '🟢 Opening', MID_TERM: '🟡 Mid Term', END_TERM: '🔵 End Term' };

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', grades: ['PG', 'PP1', 'PP2'], color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', grades: ['G1', 'G2', 'G3'], color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', grades: ['G4', 'G5', 'G6'], color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', grades: ['G7', 'G8', 'G9'], color: '#20c997' }
    ];

    useEffect(() => { fetchExams(); fetchAcademicYears(); }, []);

    const fetchExams = async () => {
        try {
            const response = await api.get('/api/exams');
            setExams(response.data);
            setLoading(false);
        } catch (err) { setError('Failed to load exams'); setLoading(false); }
    };

    const fetchAcademicYears = async () => {
        try {
            const response = await api.get('/api/academic-years');
            setAcademicYears(response.data);
        } catch (err) {}
    };

    const emptyForm = { examName: '', academicYear: '', academicYearId: '', term: '', startDate: '', endDate: '', classLevel: '', examType: '' };

    const handleEdit = (exam) => {
        setEditingExam(exam);
        const ay = academicYears.find(a => a.yearLabel === exam.academicYear && String(a.term) === String(exam.term));
        setFormData({
            examName: exam.examName,
            academicYear: exam.academicYear,
            academicYearId: ay?.yearId || '',
            term: String(exam.term),
            startDate: exam.startDate,
            endDate: exam.endDate,
            classLevel: exam.classLevel,
            examType: exam.examType || ''
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingExam(null); setFormData(emptyForm); };

    const buildPayload = () => ({
        examName: formData.examName,
        academicYear: formData.academicYear,
        term: parseInt(formData.term),
        startDate: formData.startDate,
        endDate: formData.endDate,
        classLevel: formData.classLevel,
        examType: formData.examType || null,
        ...(formData.academicYearId && { academicYearRef: { yearId: formData.academicYearId } })
    });

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/exams', buildPayload());
            setShowAddForm(false);
            setFormData(emptyForm);
            fetchExams();
            setSuccessMsg('✅ Exam added successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to save exam'); }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/exams/${editingExam.examId}`, buildPayload());
            setEditingExam(null);
            setFormData(emptyForm);
            fetchExams();
            setSuccessMsg('✅ Exam updated successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to update exam'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure? This will delete all results and report cards for this exam.')) {
            try {
                await api.delete(`/api/exams/${id}`);
                fetchExams();
                setSuccessMsg('Exam deleted!');
                setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) { setError('Failed to delete exam'); }
        }
    };

    const getSectionColor = (classLevel) => {
        for (const section of sections) {
            if (section.grades.includes(classLevel)) return section.color;
        }
        return '#1F3864';
    };

    // Group by academic year + term, then order exams OPENING → MID_TERM → END_TERM
    const typeOrder = { OPENING: 1, MID_TERM: 2, END_TERM: 3 };
    const groupedExams = exams.reduce((groups, exam) => {
        const key = `${exam.academicYear} — Term ${exam.term}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(exam);
        return groups;
    }, {});
    Object.values(groupedExams).forEach(group => {
        group.sort((a, b) => (typeOrder[a.examType] || 9) - (typeOrder[b.examType] || 9));
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
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>📝 Exams</h2>
                        <p style={styles.subtitle}>{exams.length} exam(s) — grouped by academic year and term</p>
                    </div>
                    <button onClick={() => { setShowAddForm(!showAddForm); setEditingExam(null); }} style={styles.addBtn}>
                        {showAddForm ? '✕ Cancel' : '+ Add Exam'}
                    </button>
                </div>

                {academicYears.length === 0 && (
                    <div style={styles.warningBanner}>
                        ⚠️ No Academic Years found. <a href="/academic-years" style={{ color: '#856404', fontWeight: 'bold' }}>Set up Academic Years first</a> to link exams properly.
                    </div>
                )}

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add New Exam</h3>
                        <p style={{ color:'#666', fontSize:'13px', margin:'0 0 15px 0' }}>
                            💡 Each term should have 3 exams: Opening → Mid Term → End Term
                        </p>
                        <ExamForm
                            formData={formData} setFormData={setFormData}
                            academicYears={academicYears}
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); setFormData(emptyForm); }}
                            submitLabel="💾 Save Exam"
                        />
                    </div>
                )}

                {loading ? <p style={styles.centerMsg}>⏳ Loading exams...</p> : exams.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📝</div>
                        <h3>No Exams Yet</h3>
                        <p>Click + Add Exam to create your first exam</p>
                        <p style={{ color:'#888', fontSize:'13px', marginTop:'8px' }}>
                            💡 Add 3 exams per term: Opening, Mid Term, End Term
                        </p>
                    </div>
                ) : (
                    Object.entries(groupedExams)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([groupKey, groupExams]) => (
                        <div key={groupKey} style={styles.groupBlock}>
                            <div style={styles.groupHeader}>
                                <span style={styles.groupTitle}>📅 {groupKey}</span>
                                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                    {/* Show which exam types exist */}
                                    {['OPENING','MID_TERM','END_TERM'].map(type => {
                                        const exists = groupExams.some(e => e.examType === type);
                                        return (
                                            <span key={type} style={{
                                                fontSize:'11px', padding:'2px 8px', borderRadius:'10px',
                                                backgroundColor: exists ? examTypeColors[type] : 'rgba(255,255,255,0.1)',
                                                color: exists ? 'white' : 'rgba(255,255,255,0.4)',
                                                fontWeight: exists ? 'bold' : 'normal'
                                            }}>
                                                {examTypeLabels[type]}
                                            </span>
                                        );
                                    })}
                                    <span style={styles.groupCount}>{groupExams.length}/3 exams</span>
                                </div>
                            </div>
                            <div style={styles.examGrid}>
                                {groupExams.map(exam => (
                                    <div key={exam.examId}>
                                        <div style={{
                                            ...styles.examCard,
                                            outline: editingExam?.examId === exam.examId ? '2px solid #2E75B6' : 'none'
                                        }}>
                                            {/* Exam type stripe */}
                                            <div style={{ height:'5px', backgroundColor: examTypeColors[exam.examType] || '#1F3864' }} />
                                            <div style={{ ...styles.examHeader, backgroundColor: '#1F3864' }}>
                                                <div style={{ flex:1 }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                                                        {exam.examType && (
                                                            <span style={{ backgroundColor: examTypeColors[exam.examType], color:'white', padding:'2px 8px', borderRadius:'3px', fontSize:'10px', fontWeight:'bold' }}>
                                                                {examTypeLabels[exam.examType]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 style={styles.examName}>{exam.examName}</h3>
                                                    <p style={styles.examMeta}>{exam.academicYear} • Term {exam.term}</p>
                                                </div>
                                                <span style={styles.termBadge}>Term {exam.term}</span>
                                            </div>
                                            <div style={styles.examBody}>
                                                <div style={styles.examInfo}>
                                                    <div style={styles.infoItem}>
                                                        <span style={styles.infoIcon}>📅</span>
                                                        <div><div style={styles.infoLabel}>Start</div><div style={styles.infoValue}>{exam.startDate}</div></div>
                                                    </div>
                                                    <div style={styles.infoItem}>
                                                        <span style={styles.infoIcon}>📅</span>
                                                        <div><div style={styles.infoLabel}>End</div><div style={styles.infoValue}>{exam.endDate}</div></div>
                                                    </div>
                                                    <div style={styles.infoItem}>
                                                        <span style={styles.infoIcon}>🏫</span>
                                                        <div>
                                                            <div style={styles.infoLabel}>Class Level</div>
                                                            <span style={{ ...styles.levelBadge, backgroundColor: getSectionColor(exam.classLevel) }}>
                                                                {exam.classLevel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={styles.examActions}>
                                                <button onClick={() => window.location.href = '/results'} style={styles.resultsBtn}>
                                                    📊 Results
                                                </button>
                                                <button
                                                    onClick={() => editingExam?.examId === exam.examId ? handleCancelEdit() : handleEdit(exam)}
                                                    style={editingExam?.examId === exam.examId ? styles.cancelEditBtn : styles.editBtn}>
                                                    {editingExam?.examId === exam.examId ? '✕ Cancel' : '✏️ Edit'}
                                                </button>
                                                <button onClick={() => handleDelete(exam.examId)} style={styles.deleteBtn}>🗑️</button>
                                            </div>
                                        </div>

                                        {editingExam?.examId === exam.examId && (
                                            <div style={styles.inlineEditCard}>
                                                <div style={styles.inlineEditHeader}>
                                                    <h3 style={styles.inlineEditTitle}>✏️ Editing: {exam.examName}</h3>
                                                    <button onClick={handleCancelEdit} style={styles.closeBtn}>✕</button>
                                                </div>
                                                <ExamForm
                                                    formData={formData} setFormData={setFormData}
                                                    academicYears={academicYears}
                                                    onSubmit={handleSubmitEdit}
                                                    onCancel={handleCancelEdit}
                                                    submitLabel="✅ Update Exam"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Hint cards for missing exam types */}
                                {['OPENING','MID_TERM','END_TERM'].filter(type => !groupExams.some(e => e.examType === type)).map(type => (
                                    <div key={type} style={styles.missingExamCard} onClick={() => {
                                        setShowAddForm(true);
                                        setEditingExam(null);
                                        setFormData(prev => ({ ...prev, examType: type, examName: examTypeLabels[type].split(' ').slice(1).join(' ') }));
                                    }}>
                                        <div style={{ height:'5px', backgroundColor: examTypeColors[type], opacity:0.3 }} />
                                        <div style={{ padding:'30px', textAlign:'center', color:'#ccc' }}>
                                            <div style={{ fontSize:'24px', marginBottom:'8px' }}>➕</div>
                                            <div style={{ fontSize:'13px', fontWeight:'bold' }}>{examTypeLabels[type]}</div>
                                            <div style={{ fontSize:'11px', marginTop:'4px' }}>Click to add</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
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
    header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' },
    title: { color:'#1F3864', margin:'0 0 5px 0', fontSize:'24px' },
    subtitle: { color:'#666', margin:0, fontSize:'14px' },
    addBtn: { backgroundColor:'#1F3864', color:'white', border:'none', padding:'10px 20px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold' },
    warningBanner: { backgroundColor:'#fff3cd', border:'1px solid #ffc107', padding:'12px 15px', borderRadius:'8px', marginBottom:'15px', color:'#856404', fontSize:'14px' },
    error: { color:'red', padding:'10px', backgroundColor:'#fff3f3', borderRadius:'5px', marginBottom:'15px' },
    success: { color:'#155724', padding:'10px', backgroundColor:'#d4edda', borderRadius:'5px', marginBottom:'15px' },
    centerMsg: { textAlign:'center', padding:'40px', color:'#666' },
    addFormCard: { backgroundColor:'white', padding:'25px', borderRadius:'10px', marginBottom:'25px', boxShadow:'0 2px 8px rgba(0,0,0,0.12)', border:'2px solid #1F3864' },
    formTitle: { color:'#1F3864', margin:'0 0 8px 0' },
    inlineEditCard: { backgroundColor:'white', borderRadius:'0 0 10px 10px', padding:'20px', boxShadow:'0 6px 16px rgba(0,0,0,0.15)', border:'2px solid #2E75B6', borderTop:'none', marginTop:'-2px', marginBottom:'8px' },
    inlineEditHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' },
    inlineEditTitle: { color:'#2E75B6', margin:0, fontSize:'15px' },
    closeBtn: { background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'#999' },
    inlineForm: {},
    formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px', marginBottom:'12px' },
    formGroup: { display:'flex', flexDirection:'column', gap:'5px' },
    label: { fontSize:'12px', fontWeight:'bold', color:'#1F3864', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' },
    autoTag: { backgroundColor:'#2E75B6', color:'white', padding:'1px 6px', borderRadius:'3px', fontSize:'9px', fontWeight:'normal' },
    input: { padding:'10px', borderRadius:'5px', border:'1.5px solid #ddd', fontSize:'14px', outline:'none', transition:'border-color 0.2s' },
    autoFillPreview: { display:'flex', gap:'12px', flexWrap:'wrap', backgroundColor:'#e3f2fd', padding:'10px 15px', borderRadius:'6px', marginBottom:'12px', border:'1px solid #2E75B6', alignItems:'center' },
    autoFillItem: { fontSize:'13px', color:'#1F3864' },
    btnGroup: { display:'flex', gap:'10px', marginTop:'5px' },
    submitBtn: { backgroundColor:'#2E75B6', color:'white', border:'none', padding:'10px 24px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'14px' },
    cancelBtn: { backgroundColor:'#6c757d', color:'white', border:'none', padding:'10px 18px', borderRadius:'5px', cursor:'pointer', fontSize:'14px' },
    groupBlock: { marginBottom:'30px' },
    groupHeader: { backgroundColor:'#1F3864', padding:'12px 20px', borderRadius:'8px 8px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' },
    groupTitle: { color:'white', fontWeight:'bold', fontSize:'16px' },
    groupCount: { backgroundColor:'rgba(255,255,255,0.2)', color:'white', padding:'3px 10px', borderRadius:'12px', fontSize:'12px' },
    examGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'15px', padding:'15px', backgroundColor:'white', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    examCard: { backgroundColor:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', border:'1px solid #eee' },
    missingExamCard: { backgroundColor:'#fafafa', borderRadius:'10px', overflow:'hidden', border:'2px dashed #ddd', cursor:'pointer', transition:'border-color 0.2s' },
    examHeader: { padding:'15px 20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px' },
    examName: { color:'white', margin:'0 0 4px 0', fontSize:'16px' },
    examMeta: { color:'rgba(255,255,255,0.8)', margin:0, fontSize:'12px' },
    termBadge: { backgroundColor:'rgba(255,255,255,0.2)', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' },
    examBody: { padding:'15px 20px' },
    examInfo: { display:'flex', flexDirection:'column', gap:'8px' },
    infoItem: { display:'flex', alignItems:'center', gap:'10px' },
    infoIcon: { fontSize:'16px' },
    infoLabel: { fontSize:'11px', color:'#999' },
    infoValue: { fontSize:'13px', color:'#333', fontWeight:'bold' },
    levelBadge: { color:'white', padding:'2px 8px', borderRadius:'3px', fontSize:'12px', fontWeight:'bold', display:'inline-block' },
    examActions: { borderTop:'1px solid #eee', padding:'10px 15px', display:'flex', gap:'8px', backgroundColor:'#f8f9fa' },
    resultsBtn: { flex:2, backgroundColor:'#28a745', color:'white', border:'none', padding:'8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' },
    editBtn: { flex:2, backgroundColor:'#2E75B6', color:'white', border:'none', padding:'8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px' },
    cancelEditBtn: { flex:2, backgroundColor:'#6c757d', color:'white', border:'none', padding:'8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px' },
    deleteBtn: { flex:1, backgroundColor:'#dc3545', color:'white', border:'none', padding:'8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px' },
    emptyState: { backgroundColor:'white', padding:'60px', borderRadius:'10px', textAlign:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize:'48px', marginBottom:'15px' }
};

export default Exams;