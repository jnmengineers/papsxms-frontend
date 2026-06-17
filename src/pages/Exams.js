import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

// ✅ Outside parent — prevents mobile keyboard dismiss on re-render
const ExamForm = ({ formData, setFormData, academicYears, onSubmit, onCancel, submitLabel }) => {

    // When academic year is selected, auto-fill term, startDate, endDate
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
                {/* Academic Year — drives everything else */}
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
                    <label style={styles.label}>Exam Name</label>
                    <input style={styles.input} value={formData.examName}
                        onChange={e => setFormData(prev => ({...prev, examName: e.target.value}))}
                        placeholder="e.g. End Term 1 2025" required />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Class Level</label>
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
                    <span style={styles.autoFillItem}>🏫 Academic Year: <strong>{formData.academicYear}</strong></span>
                    <span style={styles.autoFillItem}>📋 Term: <strong>Term {formData.term}</strong></span>
                    <span style={styles.autoFillItem}>🗓️ {formData.startDate} → {formData.endDate}</span>
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
        term: '', startDate: '', endDate: '', classLevel: ''
    });

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

    const emptyForm = { examName: '', academicYear: '', academicYearId: '', term: '', startDate: '', endDate: '', classLevel: '' };

    const handleEdit = (exam) => {
        setEditingExam(exam);
        // Find matching academic year
        const ay = academicYears.find(a =>
            a.yearLabel === exam.academicYear && String(a.term) === String(exam.term)
        );
        setFormData({
            examName: exam.examName,
            academicYear: exam.academicYear,
            academicYearId: ay?.yearId || '',
            term: String(exam.term),
            startDate: exam.startDate,
            endDate: exam.endDate,
            classLevel: exam.classLevel
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
        // Link to academic year record
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

    // Group exams by academic year + term
    const groupedExams = exams.reduce((groups, exam) => {
        const key = `${exam.academicYear} — Term ${exam.term}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(exam);
        return groups;
    }, {});

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
                        <p style={styles.subtitle}>{exams.length} exam(s) — grouped by academic year</p>
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
                    </div>
                ) : (
                    // Grouped by Academic Year → Term
                    Object.entries(groupedExams).map(([groupKey, groupExams]) => (
                        <div key={groupKey} style={styles.groupBlock}>
                            <div style={styles.groupHeader}>
                                <span style={styles.groupTitle}>📅 {groupKey}</span>
                                <span style={styles.groupCount}>{groupExams.length} exam(s)</span>
                            </div>
                            <div style={styles.examGrid}>
                                {groupExams.map(exam => (
                                    <div key={exam.examId}>
                                        <div style={{
                                            ...styles.examCard,
                                            outline: editingExam?.examId === exam.examId ? '2px solid #2E75B6' : 'none'
                                        }}>
                                            <div style={{ ...styles.examHeader, backgroundColor: getSectionColor(exam.classLevel) }}>
                                                <div>
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
                                                            <div style={styles.infoValue}>
                                                                <span style={{ ...styles.levelBadge, backgroundColor: getSectionColor(exam.classLevel) }}>
                                                                    {exam.classLevel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={styles.examActions}>
                                                <button
                                                    onClick={() => editingExam?.examId === exam.examId ? handleCancelEdit() : handleEdit(exam)}
                                                    style={editingExam?.examId === exam.examId ? styles.cancelEditBtn : styles.editBtn}>
                                                    {editingExam?.examId === exam.examId ? '✕ Cancel' : '✏️ Edit'}
                                                </button>
                                                <button onClick={() => handleDelete(exam.examId)} style={styles.deleteBtn}>🗑️ Delete</button>
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
                            </div>
                        </div>
                    ))
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    warningBanner: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '12px 15px', borderRadius: '8px', marginBottom: '15px', color: '#856404', fontSize: '14px' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    addFormCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 10px 10px', padding: '20px', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px', marginBottom: '8px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '15px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999' },
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    autoTag: { backgroundColor: '#2E75B6', color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 'normal' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    autoFillPreview: { display: 'flex', gap: '15px', flexWrap: 'wrap', backgroundColor: '#e3f2fd', padding: '10px 15px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #2E75B6' },
    autoFillItem: { fontSize: '13px', color: '#1F3864' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '5px', cursor: 'pointer' },

    // Grouped exams
    groupBlock: { marginBottom: '25px' },
    groupHeader: { backgroundColor: '#1F3864', padding: '10px 20px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    groupTitle: { color: 'white', fontWeight: 'bold', fontSize: '15px' },
    groupCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '12px' },
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', backgroundColor: 'white', padding: '15px', borderRadius: '0 0 8px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', gap: '15px' },
    examCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #eee' },
    examHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    examName: { color: 'white', margin: '0 0 4px 0', fontSize: '16px' },
    examMeta: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '12px' },
    termBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
    examBody: { padding: '15px 20px' },
    examInfo: { display: 'flex', flexDirection: 'column', gap: '10px' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '10px' },
    infoIcon: { fontSize: '16px' },
    infoLabel: { fontSize: '11px', color: '#999' },
    infoValue: { fontSize: '13px', color: '#333', fontWeight: 'bold' },
    levelBadge: { color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    examActions: { borderTop: '1px solid #eee', padding: '10px 15px', display: 'flex', gap: '8px', backgroundColor: '#f8f9fa' },
    editBtn: { flex: 1, backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' },
    cancelEditBtn: { flex: 1, backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' },
    deleteBtn: { flex: 1, backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' },
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' }
};

export default Exams;