import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: ''
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/users');
            setUsers(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load users');
            setLoading(false);
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
        if (window.confirm('Are you sure?')) {
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
                    <h2 style={styles.title}>👤 Users</h2>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? 'Cancel' : '+ Add User'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}

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

                {/* Users Table */}
                {loading ? (
                    <p>Loading users...</p>
                ) : (
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Username</th>
                                <th style={styles.th}>Role</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user, index) => (
                                <tr key={user.userId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{index + 1}</td>
                                    <td style={styles.td}>{user.username}</td>
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
                                        <button
                                            onClick={() => handleDelete(user.userId)}
                                            style={styles.deleteBtn}>
                                            Delete
                                        </button>
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
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left' },
    td: { padding: '12px 15px', borderBottom: '1px solid #eee' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    roleBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 'bold' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
};

export default Users;