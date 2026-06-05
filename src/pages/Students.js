import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import '../index.css';

function Students() {
    const [students, setStudents] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [search, setSearch] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        admissionNumber: ''
    });
    const [classId, setClassId] = useState('');
    const [classes, setClasses] = useState([]);

    useEffect(() => {
        fetchStudents();
        fetchClasses();
    }, []);

    useEffect(() => {
        let data = students;
        if (search) {
            data = data.filter(s =>
                s.firstName.toLowerCase().includes(search.toLowerCase()) ||
                s.lastName.toLowerCase().includes(search.toLowerCase()) ||
                s.admissionNumber?.toLowerCase().includes(search.toLowerCase())
            );
        }
        if (filterGender) {
            data = data.filter(s => s.gender === filterGender);
        }
        if (filterClass) {
            data = data.filter(s => s.className === filterClass);
        }
        setFiltered(data);
    }, [search, filterGender, filterClass, students]);

    const fetchStudents = async () => {
        try {
            const response = await api.get('/api/students');
            setStudents(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load students');
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        const response = await api.get('/api/classes');
        setClasses(response.data);
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            firstName: student.firstName,
            lastName: student.lastName,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            admissionNumber: student.admissionNumber
        });
        setClassId('');
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStudent) {
                await api.put(`/api/students/${editingStudent.studentId}`, formData);
            } else {
                await api.post(`/api/students?classId=${classId}`, formData);
            }
            setShowForm(false);
            setEditingStudent(null);
            setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' });
            fetchStudents();
        } catch (err) {
            setError('Failed to save student');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/students/${id}`);
                fetchStudents();
            } catch (err) {
                setError('Failed to delete student');
            }
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingStudent(null);
        setFormData({ firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' });
    };

    const uniqueClasses = [...new Set(students.map(s => s.className))].filter(Boolean);

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
                    <h2 style={styles.title}>🎓 Students ({filtered.length})</h2>
                    <button onClick={() => { setShowForm(!showForm); setEditingStudent(null); }} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add Student'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                {/* Search and Filter */}
                <div style={styles.searchBar}>
                    <input
                        style={styles.searchInput}
                        placeholder="🔍 Search by name or admission number..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <select style={styles.filterSelect} value={filterGender}
                        onChange={e => setFilterGender(e.target.value)}>
                        <option value="">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                    <select style={styles.filterSelect} value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}>
                        <option value="">All Classes</option>
                        {uniqueClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>
                    <button onClick={() => { setSearch(''); setFilterGender(''); setFilterClass(''); }}
                        style={styles.clearBtn}>Clear</button>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
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
                                    <label>Date of Birth</label>
                                    <input type="date" style={styles.input} value={formData.dateOfBirth}
                                        onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Gender</label>
                                    <select style={styles.input} value={formData.gender}
                                        onChange={e => setFormData({...formData, gender: e.target.value})} required>
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Admission Number</label>
                                    <input style={styles.input} value={formData.admissionNumber}
                                        onChange={e => setFormData({...formData, admissionNumber: e.target.value})} required />
                                </div>
                                {!editingStudent && (
                                    <div style={styles.formGroup}>
                                        <label>Class</label>
                                        <select style={styles.input} value={classId}
                                            onChange={e => setClassId(e.target.value)} required>
                                            <option value="">Select Class</option>
                                            {classes.map(cls => (
                                                <option key={cls.classId} value={cls.classId}>
                                                    {cls.className}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingStudent ? 'Update Student' : 'Save Student'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Students Table */}
                {/* Wrap table in scrollable div */}
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Admission No</th>
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>Gender</th>
                                <th>Class</th>
                                <th>Stream</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((student, index) => (
                                <tr key={student.studentId}>
                                    <td>{index + 1}</td>
                                    <td>{student.admissionNumber}</td>
                                    <td>{student.firstName}</td>
                                    <td>{student.lastName}</td>
                                    <td>
                                        <span style={{
                                            backgroundColor: student.gender === 'Male' ? '#2E75B6' : '#e83e8c',
                                            color: 'white', padding: '3px 8px', borderRadius: '3px',
                                            fontSize: '12px', fontWeight: 'bold'
                                        }}>
                                            {student.gender}
                                        </span>
                                    </td>
                                    <td>{student.className}</td>
                                    <td>{student.stream}</td>
                                    <td>
                                        <button onClick={() => handleEdit(student)} className="edit-btn">Edit</button>
                                        <button onClick={() => handleDelete(student.studentId)} className="delete-btn">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                        No students found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
    filterSelect: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
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
    genderBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Students;