import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Users() {
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: ''
    });

    useEffect(() => {
        fetchUsers();
        fetchClasses();
    }, []);

    useEffect(() => {
        let data = users;
        if (search) {
            data = data.filter(u =>
                u.username?.toLowerCase().includes(search.toLowerCase()) ||
                u.role?.toLowerCase().includes(search.toLowerCase())
            );
        }
        setFiltered(data);
    }, [search, users]);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users');
            setUsers(response.data);
            setFiltered(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load users');
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data);
        } catch (err) {
            console.error('Failed to load classes');
        }
    };

    const handleAssignClass = async (userId, classId) => {
        if (!classId) return;
        try {
            await api.patch(`/api/users/${userId}/assign-class/${classId}`);
            setSuccessMsg('Class assigned successfully!');
            fetchUsers();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to assign class');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/register', formData);
            setShowForm(false);
            setFormData({ username: '', password: '', role: '' });
            fetchUsers();
        } catch (err) {
            setError('Failed to add user');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await api.delete(`/api/users/${id}`);
                fetchUsers();
            } catch (err) {
                setError('Failed to delete user');
            }
        }
    };

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
                    <h2 style={styles.title}>👤 Users ({filtered.length})</h2>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add User'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add User Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3>Add New User</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label>Username</label>
                                    <input
                                        style={styles.input}
                                        value={formData.username}
                                        onChange={e => setFormData({...formData, username: e.target.value})}
                                        placeholder="Enter username"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        style={styles.input}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        placeholder="Enter password"
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label>Role</label>
                                    <select
                                        style={styles.input}
                                        value={formData.role}
                                        onChange={e => setFormData({...formData, role: e.target.value})}
                                        required
                                    >
                                        <option value="">Select Role</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="TEACHER">Teacher</option>
                                        <option value="CLERK">Clerk</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" style={styles.submitBtn}>Save User</button>
                        </form>
                    </div>
                )}

                {/* Search Bar */}
                <div style={styles.searchBar}>
                    <input
                        style={styles.searchInput}
                        placeholder="🔍 Search by username or role..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                </div>

                {/* Users Table */}
                {loading ? (
                    <p>Loading users...</p>
                ) : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Username</th>
                                    <th style={styles.th}>Role</th>
                                    <th style={styles.th}>Linked Class</th>
                                    <th style={styles.th}>Assign Class</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((user, index) => (
                                    <tr key={user.userId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        <td style={styles.td}>{index + 1}</td>
                                        <td style={styles.td}>
                                            <strong>{user.username}</strong>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{
                                                ...styles.roleBadge,
                                                backgroundColor:
                                                    user.role === 'ADMIN' ? '#1F3864' :
                                                    user.role === 'TEACHER' ? '#2E75B6' : '#28a745'
                                            }}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            {user.linkedClass ?
                                                <span style={styles.classBadge}>
                                                    🏫 {user.linkedClass.className}
                                                </span> :
                                                <span style={styles.notAssigned}>Not Assigned</span>
                                            }
                                        </td>
                                        <td style={styles.td}>
                                            {user.role === 'TEACHER' ? (
                                                <select
                                                    style={styles.smallSelect}
                                                    onChange={e => handleAssignClass(user.userId, e.target.value)}
                                                    defaultValue="">
                                                    <option value="">Assign Class</option>
                                                    {classes.map(cls => (
                                                        <option key={cls.classId} value={cls.classId}>
                                                            {cls.className}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span style={styles.notApplicable}>—</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <button
                                                onClick={() => handleDelete(user.userId)}
                                                style={styles.deleteBtn}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                            No users found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { color: '#1F3864', margin: 0 },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '700px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    roleBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    classBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    notAssigned: { color: '#999', fontStyle: 'italic', fontSize: '13px' },
    notApplicable: { color: '#ccc' },
    smallSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' }
};

export default Users;