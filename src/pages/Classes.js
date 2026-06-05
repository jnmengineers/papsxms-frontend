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
    const [formData, setFormData] = useState({
        className: '',
        stream: ''
    });

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

    const handleEdit = (cls) => {
        setEditingClass(cls);
        setFormData({ className: cls.className, stream: cls.stream });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingClass) {
                await api.put(`/api/classes/${editingClass.classId}`, formData);
            } else {
                await api.post('/api/classes', formData);
            }
            setShowForm(false);
            setEditingClass(null);
            setFormData({ className: '', stream: '' });
            fetchClasses();
        } catch (err) {
            setError('Failed to save class');
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
            } catch (err) {
                setError('Failed to delete class');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingClass(null);
        setFormData({ className: '', stream: '' });
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
                    <h2 style={styles.title}>🏫 Classes</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingClass(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Class'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingClass ? 'Edit Class' : 'Add New Class'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Class Name</label>
                                    <input style={styles.input} value={formData.className}
                                        onChange={e => setFormData({...formData, className: e.target.value})}
                                        placeholder="e.g. Grade 1 Yellow" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Stream</label>
                                    <select style={styles.input} value={formData.stream}
                                        onChange={e => setFormData({...formData, stream: e.target.value})} required>
                                        <option value="">Select Stream</option>
                                        <option value="YELLOW">Yellow</option>
                                        <option value="BLUE">Blue</option>
                                        <option value="RED">Red</option>
                                        <option value="GREEN">Green</option>
                                    </select>
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingClass ? 'Update Class' : 'Save Class'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <p>Loading classes...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Class Name</th>
                                <th style={styles.th}>Stream</th>
                                <th style={styles.th}>Class Teacher</th>
                                <th style={styles.th}>Assign Teacher</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classes.map((cls, index) => (
                                <tr key={cls.classId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{cls.className}</td>
                                    <td style={styles.td}>
                                        <span style={{...styles.streamBadge, backgroundColor:
                                            cls.stream === 'YELLOW' ? '#ffc107' :
                                            cls.stream === 'BLUE' ? '#2E75B6' :
                                            cls.stream === 'RED' ? '#dc3545' : '#28a745'}}>
                                            {cls.stream}
                                        </span>
                                    </td>
                                    <td style={styles.td}>
                                        {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : 'Not Assigned'}
                                    </td>
                                    <td style={styles.td}>
                                        <select style={styles.smallSelect}
                                            onChange={e => handleAssignTeacher(cls.classId, e.target.value)}
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
                                        <button onClick={() => handleEdit(cls)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(cls.classId)} style={styles.deleteBtn}>Delete</button>
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
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' },
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
    streamBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    smallSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Classes;