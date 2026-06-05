import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';


function Teachers() {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    useEffect(() => {
        fetchTeachers();
    }, []);

    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);

useEffect(() => {
    let data = teachers;
    if (search) {
        data = data.filter(t =>
            t.firstName.toLowerCase().includes(search.toLowerCase()) ||
            t.lastName.toLowerCase().includes(search.toLowerCase()) ||
            t.email.toLowerCase().includes(search.toLowerCase())
        );
    }
    setFiltered(data);
}, [search, teachers]);

    const fetchTeachers = async () => {
        try {
            const response = await api.get('/api/teachers');
            setTeachers(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load teachers');
            setLoading(false);
        }
    };

    const handleEdit = (teacher) => {
        setEditingTeacher(teacher);
        setFormData({
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
            phone: teacher.phone
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTeacher) {
                await api.put(`/api/teachers/${editingTeacher.teacherId}`, formData);
            } else {
                await api.post('/api/teachers', formData);
            }
            setShowForm(false);
            setEditingTeacher(null);
            setFormData({ firstName: '', lastName: '', email: '', phone: '' });
            fetchTeachers();
        } catch (err) {
            setError('Failed to save teacher');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/teachers/${id}`);
                fetchTeachers();
            } catch (err) {
                setError('Failed to delete teacher');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTeacher(null);
        setFormData({ firstName: '', lastName: '', email: '', phone: '' });
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
                    <h2 style={styles.title}>👨‍🏫 Teachers</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingTeacher(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Teacher'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                <div style={styles.searchBar}>
    <input
        style={styles.searchInput}
        placeholder="🔍 Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
    />
    <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
</div>

                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>First Name</label>
                                    <input style={styles.input} value={formData.firstName}
                                        onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Last Name</label>
                                    <input style={styles.input} value={formData.lastName}
                                        onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Email</label>
                                    <input type="email" style={styles.input} value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Phone</label>
                                    <input style={styles.input} value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})} required />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingTeacher ? 'Update Teacher' : 'Save Teacher'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <p>Loading teachers...</p> : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>First Name</th>
                                <th style={styles.th}>Last Name</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Phone</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((teacher, index) => (
                                <tr key={teacher.teacherId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{teacher.firstName}</td>
                                    <td style={styles.td}>{teacher.lastName}</td>
                                    <td style={styles.td}>{teacher.email}</td>
                                    <td style={styles.td}>{teacher.phone}</td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(teacher)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(teacher.teacherId)} style={styles.deleteBtn}>Delete</button>
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
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
filterSelect: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Teachers;