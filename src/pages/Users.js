import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import { classDisplayName } from '../utils/classUtils';

function Users() {
    const [users, setUsers] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('TEACHER');
    const [formData, setFormData] = useState({ username: '', password: '', role: 'TEACHER' });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [uRes, tRes, cRes, sRes] = await Promise.all([
                api.get('/api/users'),
                api.get('/api/teachers'),
                api.get('/api/classes'),
                api.get('/api/students')
            ]);
            setUsers(uRes.data);
            setTeachers(tRes.data);
            setClasses(cRes.data);
            setStudents(sRes.data);
        } catch (err) {
            setError('Failed to load data');
        }
        setLoading(false);
    };

    // Get teacher name from LinkedId
    const getTeacherName = (user) => {
        if (!user.linkedId && !user.LinkedId) return null;
        const id = user.linkedId || user.LinkedId;
        const teacher = teachers.find(t => String(t.teacherId) === String(id));
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
    };

    const getStudentsForClass = (classId) =>
        students.filter(s => String(s.schoolClass?.classId) === String(classId));

    const handleAssignClass = async (userId, classId) => {
        if (!classId) return;
        try {
            await api.patch(`/api/users/${userId}/assign-class/${classId}`);
            setSuccessMsg('✅ Class assigned!');
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchAll();
        } catch (err) {
            setError('Failed to assign class');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/register', formData);
            setSuccessMsg('✅ User created!');
            setShowForm(false);
            setFormData({ username: '', password: '', role: 'TEACHER' });
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchAll();
        } catch (err) {
            setError('Failed to add user');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleDelete = async (id, username) => {
        if (!window.confirm(`Delete user "${username}"?`)) return;
        try {
            await api.delete(`/api/users/${id}`);
            setSuccessMsg('User deleted');
            setTimeout(() => setSuccessMsg(''), 2000);
            fetchAll();
        } catch (err) {
            setError('Failed to delete user');
        }
    };

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    const getRoleColor = (role) => ({
        ADMIN: '#1F3864', TEACHER: '#2E75B6', CLERK: '#28a745'
    }[role] || '#666');

    const filtered = users.filter(u => {
        if (filterRole && u.role !== filterRole) return false;
        if (search) {
            const name = getTeacherName(u) || '';
            return u.username?.toLowerCase().includes(search.toLowerCase()) ||
                   name.toLowerCase().includes(search.toLowerCase());
        }
        return true;
    });

    const teacherUsers = users.filter(u => u.role === 'TEACHER');
    const assigned = teacherUsers.filter(u => u.linkedClass);
    const unassigned = teacherUsers.filter(u => !u.linkedClass);
    const unassignedClasses = classes.filter(c =>
        !teacherUsers.some(t => String(t.linkedClass?.classId) === String(c.classId))
    );

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
                <div style={styles.pageHeader}>
                    <div>
                        <h2 style={styles.title}>👤 User Management</h2>
                        <p style={styles.subtitle}>Manage system users and class assignments</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? '✕ Cancel' : '+ Add User'}
                    </button>
                </div>

                {error && <div style={styles.error}>{error}</div>}
                {successMsg && <div style={styles.success}>{successMsg}</div>}

                {/* Summary bar */}
                <div style={styles.summaryBar}>
                    <div style={styles.summaryItem}>
                        <span style={styles.summaryNum}>{users.length}</span>
                        <span style={styles.summaryLabel}>Total Users</span>
                    </div>
                    <div style={styles.summaryDivider} />
                    <div style={styles.summaryItem}>
                        <span style={{ ...styles.summaryNum, color: '#28a745' }}>{assigned.length}</span>
                        <span style={styles.summaryLabel}>Teachers Assigned</span>
                    </div>
                    <div style={styles.summaryDivider} />
                    <div style={styles.summaryItem}>
                        <span style={{ ...styles.summaryNum, color: '#fd7e14' }}>{unassigned.length}</span>
                        <span style={styles.summaryLabel}>Unassigned Teachers</span>
                    </div>
                    <div style={styles.summaryDivider} />
                    <div style={styles.summaryItem}>
                        <span style={{ ...styles.summaryNum, color: '#dc3545' }}>{unassignedClasses.length}</span>
                        <span style={styles.summaryLabel}>Classes Without Teacher</span>
                    </div>
                </div>

                {/* Add user form */}
                {showForm && (
                    <div style={styles.formCard}>
                        <h3 style={styles.formTitle}>➕ Add New User</h3>
                        <form onSubmit={handleSubmit} style={styles.formRow}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Username</label>
                                <input style={styles.input} value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    placeholder="e.g. jsmith" required />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Password</label>
                                <input type="password" style={styles.input} value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    placeholder="Min 8 characters" required />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Role</label>
                                <select style={styles.input} value={formData.role}
                                    onChange={e => setFormData({...formData, role: e.target.value})} required>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="CLERK">Clerk</option>
                                </select>
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>&nbsp;</label>
                                <button type="submit" style={styles.submitBtn}>💾 Save</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filters */}
                <div style={styles.filterBar}>
                    <input style={styles.searchInput} placeholder="🔍 Search name or username..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <div style={styles.roleTabs}>
                        {[
                            { label: 'All', value: '' },
                            { label: 'Teachers', value: 'TEACHER' },
                            { label: 'Admins', value: 'ADMIN' },
                            { label: 'Clerks', value: 'CLERK' }
                        ].map(tab => (
                            <button key={tab.value}
                                onClick={() => setFilterRole(tab.value)}
                                style={{
                                    ...styles.roleTab,
                                    backgroundColor: filterRole === tab.value ? '#1F3864' : 'white',
                                    color: filterRole === tab.value ? 'white' : '#1F3864'
                                }}>
                                {tab.label}
                                <span style={styles.tabCount}>
                                    {tab.value === '' ? users.length : users.filter(u => u.role === tab.value).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={styles.loadingCard}>⏳ Loading...</div>
                ) : (
                    <div style={styles.tableCard}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.thead}>
                                    <th style={styles.th}>#</th>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Username</th>
                                    <th style={styles.th}>Role</th>
                                    <th style={styles.th}>Assigned Class</th>
                                    <th style={styles.th}>Students</th>
                                    <th style={styles.th}>Reassign</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((user, i) => {
                                    const teacherName = getTeacherName(user);
                                    const linkedClass = user.linkedClass
                                        ? classes.find(c => String(c.classId) === String(user.linkedClass.classId)) || user.linkedClass
                                        : null;
                                    const classStudents = linkedClass ? getStudentsForClass(linkedClass.classId) : [];
                                    const section = linkedClass ? sections.find(s => s.value === linkedClass.section) : null;
                                    const isTeacher = user.role === 'TEACHER';

                                    return (
                                        <tr key={user.userId} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                            <td style={styles.td}>{i + 1}</td>
                                            <td style={styles.td}>
                                                <div style={styles.nameCell}>
                                                    <div style={{ ...styles.avatar, backgroundColor: getRoleColor(user.role) }}>
                                                        {(teacherName || user.username)?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={styles.nameText}>
                                                        {teacherName || <span style={styles.noName}>—</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={styles.usernameText}>{user.username}</span>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.roleBadge, backgroundColor: getRoleColor(user.role) }}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                {linkedClass ? (
                                                    <span style={{ ...styles.classBadge, borderLeft: `3px solid ${section?.color || '#1F3864'}` }}>
                                                        {classDisplayName(linkedClass)}
                                                    </span>
                                                ) : isTeacher ? (
                                                    <span style={styles.unassignedBadge}>⚠️ Not assigned</span>
                                                ) : (
                                                    <span style={styles.naText}>—</span>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                {linkedClass ? (
                                                    <span style={styles.studentCount}>
                                                        👥 {classStudents.length}
                                                    </span>
                                                ) : <span style={styles.naText}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                {isTeacher ? (
                                                    <select style={styles.assignSelect}
                                                        defaultValue=""
                                                        onChange={e => handleAssignClass(user.userId, e.target.value)}>
                                                        <option value="">
                                                            {linkedClass ? 'Reassign...' : 'Assign class...'}
                                                        </option>
                                                        {sections.map(sec => (
                                                            <optgroup key={sec.value} label={sec.label}>
                                                                {classes.filter(c => c.section === sec.value).map(cls => (
                                                                    <option key={cls.classId} value={cls.classId}>
                                                                        {classDisplayName(cls)}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                ) : <span style={styles.naText}>—</span>}
                                            </td>
                                            <td style={styles.td}>
                                                <button onClick={() => handleDelete(user.userId, user.username)}
                                                    style={styles.deleteBtn}>🗑️ Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="8" style={styles.emptyRow}>No users found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Unassigned classes */}
                {unassignedClasses.length > 0 && (
                    <div style={styles.warningCard}>
                        <strong style={styles.warningTitle}>⚠️ {unassignedClasses.length} class(es) without a teacher:</strong>
                        <div style={styles.chipRow}>
                            {unassignedClasses.map(cls => (
                                <span key={cls.classId} style={styles.chip}>{classDisplayName(cls)}</span>
                            ))}
                        </div>
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

    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 4px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },

    error: { color: 'red', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    summaryBar: { backgroundColor: 'white', borderRadius: '10px', padding: '15px 25px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', flexWrap: 'wrap' },
    summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' },
    summaryNum: { fontSize: '28px', fontWeight: 'bold', color: '#1F3864', lineHeight: 1 },
    summaryLabel: { fontSize: '11px', color: '#888', marginTop: '3px', textAlign: 'center' },
    summaryDivider: { width: '1px', height: '40px', backgroundColor: '#eee' },

    formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    formRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'end' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' },

    filterBar: { display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' },
    searchInput: { flex: 1, padding: '9px 12px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
    roleTabs: { display: 'flex', gap: '5px' },
    roleTab: { padding: '7px 12px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' },
    tabCount: { backgroundColor: 'rgba(0,0,0,0.12)', padding: '1px 5px', borderRadius: '8px', fontSize: '11px' },

    tableCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', marginBottom: '20px', overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    thead: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    td: { padding: '11px 14px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    trEven: { backgroundColor: '#fafafa' },
    trOdd: { backgroundColor: 'white' },

    nameCell: { display: 'flex', alignItems: 'center', gap: '8px' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 },
    nameText: { fontWeight: 'bold', color: '#1F3864' },
    noName: { color: '#aaa', fontStyle: 'italic', fontWeight: 'normal' },
    usernameText: { fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', color: '#555' },

    roleBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' },
    classBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', paddingLeft: '8px' },
    unassignedBadge: { color: '#e65100', backgroundColor: '#fff3e0', padding: '3px 8px', borderRadius: '3px', fontSize: '12px' },
    naText: { color: '#ccc' },
    studentCount: { color: '#2E75B6', fontWeight: 'bold', fontSize: '13px' },

    assignSelect: { padding: '6px 8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '12px', width: '140px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
    emptyRow: { textAlign: 'center', padding: '30px', color: '#999' },

    loadingCard: { backgroundColor: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#666' },

    warningCard: { backgroundColor: '#fff8e1', border: '2px solid #ffc107', borderRadius: '10px', padding: '15px 20px' },
    warningTitle: { color: '#856404', display: 'block', marginBottom: '10px', fontSize: '14px' },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    chip: { backgroundColor: '#fff3cd', color: '#856404', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: '1px solid #ffc107' },
};

export default Users;