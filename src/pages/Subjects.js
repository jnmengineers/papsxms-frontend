import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

// Outside parent — prevents keyboard dismiss on re-render
const SubjectFormFields = ({ formData, setFormData, onSubmit, onCancel, submitLabel }) => (
    <form onSubmit={onSubmit} style={styles.inlineForm}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}>Subject Name</label>
                <input style={styles.input} value={formData.subjectName}
                    onChange={e => setFormData({...formData, subjectName: e.target.value})}
                    placeholder="e.g. Mathematics" required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Subject Code</label>
                <input style={styles.input} value={formData.subjectCode}
                    onChange={e => setFormData({...formData, subjectCode: e.target.value})}
                    placeholder="e.g. MATH" required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Section</label>
                <select style={styles.input} value={formData.gradeLevel}
                    onChange={e => setFormData({...formData, gradeLevel: e.target.value})} required>
                    <option value="">Select Section</option>
                    <option value="PG">Pre-School (PG, PP1, PP2)</option>
                    <option value="G1">Lower Primary (G1, G2, G3)</option>
                    <option value="G4">Upper Primary (G4, G5, G6)</option>
                    <option value="G7">Junior School (G7, G8, G9)</option>
                </select>
            </div>
        </div>
        <div style={styles.btnGroup}>
            <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
        </div>
    </form>
);

function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [activeTab, setActiveTab] = useState('pool');
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);
    const seeded = React.useRef(false);
    const [formData, setFormData] = useState({ subjectName: '', subjectCode: '', gradeLevel: '' });

    const sections = ['PRE_SCHOOL','LOWER_PRIMARY','UPPER_PRIMARY','JUNIOR_SCHOOL'];
    const sectionGrades = { PRE_SCHOOL: ['PG','PP1','PP2'], LOWER_PRIMARY: ['G1','G2','G3'], UPPER_PRIMARY: ['G4','G5','G6'], JUNIOR_SCHOOL: ['G7','G8','G9'] };
    const sectionColors = { PRE_SCHOOL: '#6f42c1', LOWER_PRIMARY: '#2E75B6', UPPER_PRIMARY: '#fd7e14', JUNIOR_SCHOOL: '#20c997' };
    const sectionNames = { PRE_SCHOOL: '🟣 Pre-School (PG, PP1, PP2)', LOWER_PRIMARY: '🔵 Lower Primary (G1-G3)', UPPER_PRIMARY: '🟠 Upper Primary (G4-G6)', JUNIOR_SCHOOL: '🟢 Junior Secondary (G7-G9)' };

    useEffect(() => {
        if (!seeded.current) { seeded.current = true; fetchSubjects(); fetchTeachers(); }
    }, []);

    useEffect(() => {
        let data = subjects;
        if (search) data = data.filter(s =>
            s.subjectName?.toLowerCase().includes(search.toLowerCase()) ||
            s.subjectCode?.toLowerCase().includes(search.toLowerCase()) ||
            s.gradeLevel?.toLowerCase().includes(search.toLowerCase())
        );
        setFiltered(data);
    }, [search, subjects]);

    const fetchSubjects = async () => {
        try {
            const response = await api.get('/api/subjects');
            setSubjects(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) { setError('Failed to load subjects'); setLoading(false); }
    };

    const fetchTeachers = async () => {
        const response = await api.get('/api/teachers');
        setTeachers(response.data);
    };

    const handleEdit = (subject) => {
        if (editingSubject?.subjectId === subject.subjectId) { setEditingSubject(null); return; }
        setEditingSubject(subject);
        setFormData({ subjectName: subject.subjectName, subjectCode: subject.subjectCode, gradeLevel: subject.gradeLevel });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => {
        setEditingSubject(null);
        setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' });
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/subjects', formData);
            setSuccessMsg('✅ Subject added!');
            setShowAddForm(false);
            setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' });
            fetchSubjects();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to save subject'); }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/subjects/${editingSubject.subjectId}`, formData);
            setSuccessMsg('✅ Subject updated!');
            setEditingSubject(null);
            setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' });
            fetchSubjects();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to update subject'); }
    };

    const handleAssignTeacher = async (subjectId, teacherId) => {
        try {
            await api.patch(`/api/subjects/${subjectId}/assign-teacher/${teacherId}`);
            fetchSubjects();
            setSuccessMsg('Teacher assigned!');
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) { setError('Failed to assign teacher'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure? This will also remove this subject from all class assignments.')) {
            try {
                await api.delete(`/api/subjects/${id}`);
                if (editingSubject?.subjectId === id) setEditingSubject(null);
                fetchSubjects();
                setSuccessMsg('Subject deleted!');
                setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) { setError('Failed to delete subject.'); }
        }
    };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <div>
                            <h2 style={styles.title}>📚 Subjects</h2>
                            <p style={styles.subtitle}>Subject pool — {subjects.length} subjects across all sections</p>
                        </div>
                        <button onClick={() => { setShowAddForm(!showAddForm); setEditingSubject(null); }} style={styles.addBtn}>
                            {showAddForm ? '✕ Cancel' : '+ Add Subject'}
                        </button>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}
                    {successMsg && <p style={styles.success}>{successMsg}</p>}

                    {showAddForm && (
                        <div style={styles.addFormCard}>
                            <h3 style={styles.formTitle}>➕ Add New Subject</h3>
                            <SubjectFormFields
                                formData={formData} setFormData={setFormData}
                                onSubmit={handleSubmitAdd}
                                onCancel={() => { setShowAddForm(false); setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' }); }}
                                submitLabel="💾 Save Subject"
                            />
                        </div>
                    )}

                    {activeTab === 'pool' && (
                        <>
                            <div style={styles.searchBar}>
                                <input style={styles.searchInput} placeholder="🔍 Search subjects..."
                                    value={search} onChange={e => setSearch(e.target.value)} />
                                <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                            </div>
                            {loading ? <p>Loading subjects...</p> : (
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.tableHeader}>
                                                <th style={styles.th}>#</th>
                                                <th style={styles.th}>Subject Name</th>
                                                <th style={styles.th}>Code</th>
                                                <th style={styles.th}>Grade</th>
                                                <th style={styles.th}>Teacher</th>
                                                <th style={styles.th}>Assign Teacher</th>
                                                <th style={styles.th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sections.map(section => {
                                                const sectionFiltered = filtered.filter(s => sectionGrades[section].includes(s.gradeLevel));
                                                if (sectionFiltered.length === 0) return null;
                                                return (
                                                    <React.Fragment key={section}>
                                                        <tr>
                                                            <td colSpan="7" style={{ backgroundColor: sectionColors[section], color: 'white', padding: '8px 15px', fontWeight: 'bold', fontSize: '13px' }}>
                                                                {sectionNames[section]} — {sectionFiltered.length} subjects
                                                            </td>
                                                        </tr>
                                                        {sectionFiltered.map((subject, index) => {
                                                            const isEditing = editingSubject?.subjectId === subject.subjectId;
                                                            return (
                                                                <React.Fragment key={subject.subjectId}>
                                                                    <tr style={{
                                                                        ...(index % 2 === 0 ? styles.trEven : styles.trOdd),
                                                                        outline: isEditing ? '2px solid #2E75B6' : 'none',
                                                                        outlineOffset: '-2px'
                                                                    }}>
                                                                        <td style={styles.td}>{subject.subjectId}</td>
                                                                        <td style={styles.td}><strong>{subject.subjectName}</strong></td>
                                                                        <td style={styles.td}><span style={styles.codeBadge}>{subject.subjectCode}</span></td>
                                                                        <td style={styles.td}>
                                                                            <span style={{ backgroundColor: sectionColors[section], color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                                {subject.gradeLevel}
                                                                            </span>
                                                                        </td>
                                                                        <td style={styles.td}>
                                                                            {subject.teacher ? `${subject.teacher.firstName} ${subject.teacher.lastName}` : <span style={styles.notAssigned}>Not Assigned</span>}
                                                                        </td>
                                                                        <td style={styles.td}>
                                                                            <select style={styles.smallSelect}
                                                                                onChange={e => handleAssignTeacher(subject.subjectId, e.target.value)}
                                                                                defaultValue="">
                                                                                <option value="">Assign Teacher</option>
                                                                                {teachers.map(t => <option key={t.teacherId} value={t.teacherId}>{t.firstName} {t.lastName}</option>)}
                                                                            </select>
                                                                        </td>
                                                                        <td style={styles.td}>
                                                                            <button onClick={() => handleEdit(subject)}
                                                                                style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                                                {isEditing ? '✕ Cancel' : 'Edit'}
                                                                            </button>
                                                                            <button onClick={() => handleDelete(subject.subjectId)} style={styles.deleteBtn}>Delete</button>
                                                                        </td>
                                                                    </tr>
                                                                    {isEditing && (
                                                                        <tr>
                                                                            <td colSpan="7" style={styles.inlineEditTd}>
                                                                                <div style={styles.inlineEditCard}>
                                                                                    <div style={styles.inlineEditHeader}>
                                                                                        <h4 style={styles.inlineEditTitle}>✏️ Editing: {subject.subjectName}</h4>
                                                                                        <button onClick={handleCancelEdit} style={styles.closeBtn}>✕</button>
                                                                                    </div>
                                                                                    <SubjectFormFields
                                                                                        formData={formData} setFormData={setFormData}
                                                                                        onSubmit={handleSubmitEdit}
                                                                                        onCancel={handleCancelEdit}
                                                                                        submitLabel="✅ Update Subject"
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })}
                                            {filtered.length === 0 && (
                                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No subjects found</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    title: { color: '#1F3864', margin: '0 0 5px 0' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    addFormCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    inlineEditTd: { padding: 0, border: 'none' },
    inlineEditCard: { backgroundColor: '#f0f7ff', padding: '15px 20px', borderLeft: '4px solid #2E75B6', borderBottom: '1px solid #ddd' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '14px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '5px', cursor: 'pointer' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
    tab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '700px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
    codeBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' },
    notAssigned: { color: '#999', fontStyle: 'italic', fontSize: '13px' },
    smallSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' }
};

export default Subjects;