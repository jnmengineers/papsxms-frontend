import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Exams() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingExam, setEditingExam] = useState(null); // holds exam being edited
    const [formData, setFormData] = useState({
        examName: '', academicYear: '', term: '',
        startDate: '', endDate: '', classLevel: ''
    });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', grades: ['PG', 'PP1', 'PP2'], color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', grades: ['G1', 'G2', 'G3'], color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', grades: ['G4', 'G5', 'G6'], color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', grades: ['G7', 'G8', 'G9'], color: '#20c997' }
    ];

    useEffect(() => { fetchExams(); }, []);

    const fetchExams = async () => {
        try {
            const response = await api.get('/api/exams');
            setExams(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load exams');
            setLoading(false);
        }
    };

    const handleEdit = (exam) => {
        setEditingExam(exam);
        setFormData({
            examName: exam.examName,
            academicYear: exam.academicYear,
            term: exam.term,
            startDate: exam.startDate,
            endDate: exam.endDate,
            classLevel: exam.classLevel
        });
        setShowAddForm(false); // close add form if open
    };

    const handleCancelEdit = () => {
        setEditingExam(null);
        setFormData({ examName: '', academicYear: '', term: '', startDate: '', endDate: '', classLevel: '' });
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/exams', { ...formData, term: parseInt(formData.term) });
            setShowAddForm(false);
            setFormData({ examName: '', academicYear: '', term: '', startDate: '', endDate: '', classLevel: '' });
            fetchExams();
            setSuccessMsg('✅ Exam added successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to save exam');
        }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/exams/${editingExam.examId}`, { ...formData, term: parseInt(formData.term) });
            setEditingExam(null);
            setFormData({ examName: '', academicYear: '', term: '', startDate: '', endDate: '', classLevel: '' });
            fetchExams();
            setSuccessMsg('✅ Exam updated successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to update exam');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure? This will delete all results and report cards for this exam.')) {
            try {
                await api.delete(`/api/exams/${id}`);
                fetchExams();
                setSuccessMsg('Exam deleted!');
                setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) {
                setError('Failed to delete exam');
            }
        }
    };

    const getSectionColor = (classLevel) => {
        for (const section of sections) {
            if (section.grades.includes(classLevel)) return section.color;
        }
        return '#1F3864';
    };

    const getTermLabel = (term) => `Term ${term}`;

    const ExamForm = ({ onSubmit, onCancel, submitLabel }) => (
        <form onSubmit={onSubmit} style={styles.inlineForm}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Exam Name</label>
                    <input style={styles.input} value={formData.examName}
                        onChange={e => setFormData({...formData, examName: e.target.value})}
                        placeholder="e.g. End Term 1 2025" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Academic Year</label>
                    <input style={styles.input} value={formData.academicYear}
                        onChange={e => setFormData({...formData, academicYear: e.target.value})}
                        placeholder="e.g. 2025" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Term</label>
                    <select style={styles.input} value={formData.term}
                        onChange={e => setFormData({...formData, term: e.target.value})} required>
                        <option value="">Select Term</option>
                        <option value="1">Term 1</option>
                        <option value="2">Term 2</option>
                        <option value="3">Term 3</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Start Date</label>
                    <input type="date" style={styles.input} value={formData.startDate}
                        onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>End Date</label>
                    <input type="date" style={styles.input} value={formData.endDate}
                        onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Class Level</label>
                    <select style={styles.input} value={formData.classLevel}
                        onChange={e => setFormData({...formData, classLevel: e.target.value})} required>
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
            <div style={styles.btnGroup}>
                <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
            </div>
        </form>
    );

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
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>📝 Exams</h2>
                        <p style={styles.subtitle}>Create and manage school examinations</p>
                    </div>
                    <button onClick={() => { setShowAddForm(!showAddForm); setEditingExam(null); }} style={styles.addBtn}>
                        {showAddForm ? '✕ Cancel' : '+ Add Exam'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add Form — shown at top only when adding new */}
                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add New Exam</h3>
                        <ExamForm
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); }}
                            submitLabel="💾 Save Exam"
                        />
                    </div>
                )}

                {/* Exams Grid */}
                {loading ? (
                    <p style={styles.centerMsg}>⏳ Loading exams...</p>
                ) : exams.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📝</div>
                        <h3>No Exams Yet</h3>
                        <p>Click + Add Exam to create your first exam</p>
                    </div>
                ) : (
                    <div style={styles.examGrid}>
                        {exams.map(exam => (
                            <div key={exam.examId}>
                                {/* ── Exam Card ── */}
                                <div style={{
                                    ...styles.examCard,
                                    outline: editingExam?.examId === exam.examId ? '2px solid #2E75B6' : 'none'
                                }}>
                                    <div style={{ ...styles.examHeader, backgroundColor: getSectionColor(exam.classLevel) }}>
                                        <div>
                                            <h3 style={styles.examName}>{exam.examName}</h3>
                                            <p style={styles.examMeta}>{exam.academicYear} • {getTermLabel(exam.term)}</p>
                                        </div>
                                        <span style={styles.termBadge}>{getTermLabel(exam.term)}</span>
                                    </div>
                                    <div style={styles.examBody}>
                                        <div style={styles.examInfo}>
                                            <div style={styles.infoItem}>
                                                <span style={styles.infoIcon}>📅</span>
                                                <div>
                                                    <div style={styles.infoLabel}>Start Date</div>
                                                    <div style={styles.infoValue}>{exam.startDate}</div>
                                                </div>
                                            </div>
                                            <div style={styles.infoItem}>
                                                <span style={styles.infoIcon}>📅</span>
                                                <div>
                                                    <div style={styles.infoLabel}>End Date</div>
                                                    <div style={styles.infoValue}>{exam.endDate}</div>
                                                </div>
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
                                            {editingExam?.examId === exam.examId ? '✕ Cancel Edit' : '✏️ Edit'}
                                        </button>
                                        <button onClick={() => handleDelete(exam.examId)} style={styles.deleteBtn}>
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>

                                {/* ── Inline Edit Form — opens directly below the card ── */}
                                {editingExam?.examId === exam.examId && (
                                    <div style={styles.inlineEditCard}>
                                        <div style={styles.inlineEditHeader}>
                                            <h3 style={styles.inlineEditTitle}>✏️ Editing: {exam.examName}</h3>
                                            <button onClick={handleCancelEdit} style={styles.closeBtn}>✕</button>
                                        </div>
                                        <ExamForm
                                            onSubmit={handleSubmitEdit}
                                            onCancel={handleCancelEdit}
                                            submitLabel="✅ Update Exam"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },

    // Add form card
    addFormCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', marginBottom: '20px', margin: '0 0 15px 0' },

    // Inline edit card — opens below the exam card
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 10px 10px', padding: '20px', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px', marginBottom: '8px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '15px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999', padding: '0 5px' },

    // Form shared
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '5px', cursor: 'pointer' },

    // Exam Grid
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
    examCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #eee' },
    examHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    examName: { color: 'white', margin: '0 0 4px 0', fontSize: '16px' },
    examMeta: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '12px' },
    termBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
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

    // Empty state
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' }
};

export default Exams;