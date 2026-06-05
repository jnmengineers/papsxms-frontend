import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [formData, setFormData] = useState({
        subjectName: '',
        subjectCode: '',
        gradeLevel: ''
    });

    useEffect(() => {
        fetchSubjects();
        fetchTeachers();
    }, []);

    const fetchSubjects = async () => {
        try {
            const response = await api.get('/api/subjects');
            setSubjects(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load subjects');
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        const response = await api.get('/api/teachers');
        setTeachers(response.data);
    };

    const handleEdit = (subject) => {
        setEditingSubject(subject);
        setFormData({
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            gradeLevel: subject.gradeLevel
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSubject) {
                await api.put(`/api/subjects/${editingSubject.subjectId}`, formData);
            } else {
                await api.post('/api/subjects', formData);
            }
            setShowForm(false);
            setEditingSubject(null);
            setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' });
            fetchSubjects();
        } catch (err) {
            setError('Failed to save subject');
        }
    };

    const handleAssignTeacher = async (subjectId, teacherId) => {
        try {
            await api.patch(`/api/subjects/${subjectId}/assign-teacher/${teacherId}`);
            fetchSubjects();
        } catch (err) {
            setError('Failed to assign teacher');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/subjects/${id}`);
                fetchSubjects();
            } catch (err) {
                setError('Failed to delete subject');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingSubject(null);
        setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' });
    };

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
                    <h2 style={styles.title}>📚 Subjects</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingSubject(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Subject'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Subject Name</label>
                                    <input style={styles.input} value={formData.subjectName}
                                        onChange={e => setFormData({...formData, subjectName: e.target.value})}
                                        placeholder="e.g. Mathematics" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Subject Code</label>
                                    <input style={styles.input} value={formData.subjectCode}
                                        onChange={e => setFormData({...formData, subjectCode: e.target.value})}
                                        placeholder="e.g. MATH001" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Grade Level</label>
                                    <input style={styles.input} value={formData.gradeLevel}
                                        onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
                                        placeholder="e.g. Grade 1" required />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingSubject ? 'Update Subject' : 'Save Subject'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <p>Loading subjects...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Subject Name</th>
                                <th style={styles.th}>Subject Code</th>
                                <th style={styles.th}>Grade Level</th>
                                <th style={styles.th}>Teacher</th>
                                <th style={styles.th}>Assign Teacher</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjects.map((subject, index) => (
                                <tr key={subject.subjectId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{subject.subjectName}</td>
                                    <td style={styles.td}>{subject.subjectCode}</td>
                                    <td style={styles.td}>{subject.gradeLevel}</td>
                                    <td style={styles.td}>
                                        {subject.teacher ? `${subject.teacher.firstName} ${subject.teacher.lastName}` : 'Not Assigned'}
                                    </td>
                                    <td style={styles.td}>
                                        <select style={styles.smallSelect}
                                            onChange={e => handleAssignTeacher(subject.subjectId, e.target.value)}
                                            defaultValue="">
                                            <option value="">Assign Teacher</option>
                                            {teachers.map(t => (
                                                <option key={t.teacherId} value={t.teacherId}>
                                                    {t.firstName} {t.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(subject)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(subject.subjectId)} style={styles.deleteBtn}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '30px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { color: '#1F3864', margin: 0 },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    error: { color: 'red', marginBottom: '15px' },
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    smallSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Subjects;