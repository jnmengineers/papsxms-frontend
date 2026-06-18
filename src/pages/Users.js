import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import { classDisplayName } from '../utils/classUtils';

function Users() {
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [reassigning, setReassigning] = useState({}); // { userId: true }
    const [formData, setFormData] = useState({ username: '', password: '', role: '' });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [uRes, cRes, sRes] = await Promise.all([
                api.get('/api/users'),
                api.get('/api/classes'),
                api.get('/api/students')
            ]);
            setUsers(uRes.data);
            setClasses(cRes.data);
            setStudents(sRes.data);
        } catch (err) {
            setError('Failed to load data');
        }
        setLoading(false);
    };

    const handleAssignClass = async (userId, classId) => {
        if (!classId) return;
        setReassigning(prev => ({ ...prev, [userId]: true }));
        try {
            await api.patch(`/api/users/${userId}/assign-class/${classId}`);
            setSuccessMsg('✅ Class assigned successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchAll();
        } catch (err) {
            setError('Failed to assign class');
            setTimeout(() => setError(''), 3000);
        }
        setReassigning(prev => ({ ...prev, [userId]: false }));
    };

    const handleUnassignClass = async (userId) => {
        if (!window.confirm('Remove this teacher from their class?')) return;
        try {
            await api.patch(`/api/classes/unassign-teacher`, { userId });
            setSuccessMsg('✅ Teacher unassigned from class');
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchAll();
        } catch (err) {
            setError('Failed to unassign');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/register', formData);
            setSuccessMsg('✅ User created successfully!');
            setShowForm(false);
            setFormData({ username: '', password: '', role: '' });
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchAll();
        } catch (err) {
            setError('Failed to add user. Username may already exist.');
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleDelete = async (id, username) => {
        if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/api/users/${id}`);
            setSuccessMsg('User deleted');
            setTimeout(() => setSuccessMsg(''), 2000);
            fetchAll();
        } catch (err) {
            setError('Failed to delete user');
            setTimeout(() => setError(''), 3000);
        }
    };

    const getStudentsForClass = (classId) =>
        students.filter(s => String(s.schoolClass?.classId) === String(classId));

    const getClassForUser = (user) =>
        user.linkedClass
            ? classes.find(c => String(c.classId) === String(user.linkedClass.classId)) || user.linkedClass
            : null;

    // Filter
    const filtered = users.filter(u => {
        if (search && !u.username?.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterRole && u.role !== filterRole) return false;
        return true;
    });

    // Stats
    const teachers = users.filter(u => u.role === 'TEACHER');
    const assignedTeachers = teachers.filter(u => u.linkedClass);
    const unassignedTeachers = teachers.filter(u => !u.linkedClass);
    const unassignedClasses = classes.filter(c => !teachers.some(t => String(t.linkedClass?.classId) === String(c.classId)));

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    const getRoleBadgeColor = (role) => {
        if (role === 'ADMIN') return '#1F3864';
        if (role === 'TEACHER') return '#2E75B6';
        return '#28a745';
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
                {/* Header */}
                <div style={styles.pageHeader}>
                    <div>
                        <h2 style={styles.title}>👤 User Management</h2>
                        <p style={styles.subtitle}>Manage teachers, admins and class assignments</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
                        {showForm ? '✕ Cancel' : '+ Add User'}
                    </button>
                </div>

                {error && <div style={styles.error}>{error}</div>}
                {successMsg && <div style={styles.success}>{successMsg}</div>}

                {/* Stats Row */}
                <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                        <div style={{ ...styles.statIcon, backgroundColor: '#e3f2fd', color: '#2E75B6' }}>👤</div>
                        <div>
                            <div style={styles.statNum}>{users.length}</div>
                            <div style={styles.statLabel}>Total Users</div>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={{ ...styles.statIcon, backgroundColor: '#e8f5e9', color: '#28a745' }}>✅</div>
                        <div>
                            <div style={{ ...styles.statNum, color: '#28a745' }}>{assignedTeachers.length}</div>
                            <div style={styles.statLabel}>Teachers Assigned</div>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={{ ...styles.statIcon, backgroundColor: '#fff3e0', color: '#fd7e14' }}>⚠️</div>
                        <div>
                            <div style={{ ...styles.statNum, color: '#fd7e14' }}>{unassignedTeachers.length}</div>
                            <div style={styles.statLabel}>Teachers Unassigned</div>
                        </div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={{ ...styles.statIcon, backgroundColor: '#fce4ec', color: '#dc3545' }}>🏫</div>
                        <div>
                            <div style={{ ...styles.statNum, color: '#dc3545' }}>{unassignedClasses.length}</div>
                            <div style={styles.statLabel}>Classes Without Teacher</div>
                        </div>
                    </div>
                </div>

                {/* Add User Form */}
                {showForm && (
                    <div style={styles.formCard}>
                        <h3 style={styles.formTitle}>➕ Add New User</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Username</label>
                                    <input style={styles.input} value={formData.username}
                                        onChange={e => setFormData({...formData, username: e.target.value})}
                                        placeholder="e.g. teacher01" required />
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
                                        <option value="">Select Role</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="TEACHER">Teacher</option>
                                        <option value="CLERK">Clerk</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" style={styles.submitBtn}>💾 Save User</button>
                        </form>
                    </div>
                )}

                {/* Filters */}
                <div style={styles.filterBar}>
                    <input style={styles.searchInput} placeholder="🔍 Search username..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <div style={styles.roleTabs}>
                        {['', 'ADMIN', 'TEACHER', 'CLERK'].map(role => (
                            <button key={role}
                                onClick={() => setFilterRole(role)}
                                style={{
                                    ...styles.roleTab,
                                    backgroundColor: filterRole === role ? '#1F3864' : 'white',
                                    color: filterRole === role ? 'white' : '#1F3864'
                                }}>
                                {role === '' ? 'All' : role}
                                <span style={styles.roleTabCount}>
                                    {role === '' ? users.length : users.filter(u => u.role === role).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div style={styles.loadingCard}><p>⏳ Loading users...</p></div>
                ) : (
                    <div style={styles.userGrid}>
                        {filtered.map(user => {
                            const linkedClass = getClassForUser(user);
                            const classStudents = linkedClass ? getStudentsForClass(linkedClass.classId) : [];
                            const isTeacher = user.role === 'TEACHER';
                            const section = linkedClass
                                ? sections.find(s => s.value === linkedClass.section)
                                : null;

                            return (
                                <div key={user.userId} style={styles.userCard}>
                                    {/* Card Header */}
                                    <div style={{ ...styles.userCardHeader, backgroundColor: getRoleBadgeColor(user.role) }}>
                                        <div style={styles.userAvatar}>
                                            {user.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={styles.userInfo}>
                                            <div style={styles.username}>{user.username}</div>
                                            <span style={styles.rolePill}>{user.role}</span>
                                        </div>
                                        <button onClick={() => handleDelete(user.userId, user.username)}
                                            style={styles.deleteBtn} title="Delete user">🗑️</button>
                                    </div>

                                    {/* Class Assignment */}
                                    <div style={styles.userCardBody}>
                                        {isTeacher ? (
                                            <>
                                                {/* Current class */}
                                                {linkedClass ? (
                                                    <div style={styles.assignedClass}>
                                                        <div style={{ ...styles.classTag, borderLeft: `4px solid ${section?.color || '#1F3864'}` }}>
                                                            <div style={styles.classTagTop}>
                                                                <span style={styles.classTagName}>
                                                                    🏫 {classDisplayName(linkedClass)}
                                                                </span>
                                                                <span style={{ ...styles.sectionPill, backgroundColor: section?.color || '#1F3864' }}>
                                                                    {section?.label || linkedClass.section}
                                                                </span>
                                                            </div>
                                                            <div style={styles.classTagStats}>
                                                                <span>👥 {classStudents.length} students</span>
                                                                <span>👦 {classStudents.filter(s => s.gender === 'Male').length} boys</span>
                                                                <span>👧 {classStudents.filter(s => s.gender === 'Female').length} girls</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={styles.noClass}>
                                                        <span style={styles.noClassText}>⚠️ No class assigned</span>
                                                    </div>
                                                )}

                                                {/* Reassign dropdown */}
                                                <div style={styles.assignRow}>
                                                    <select style={styles.classSelect}
                                                        defaultValue=""
                                                        onChange={e => handleAssignClass(user.userId, e.target.value)}
                                                        disabled={reassigning[user.userId]}>
                                                        <option value="">
                                                            {linkedClass ? '🔄 Reassign class...' : '➕ Assign class...'}
                                                        </option>
                                                        {sections.map(section => (
                                                            <optgroup key={section.value} label={section.label}>
                                                                {classes
                                                                    .filter(c => c.section === section.value)
                                                                    .map(cls => (
                                                                        <option key={cls.classId} value={cls.classId}>
                                                                            {classDisplayName(cls)}
                                                                            {teachers.some(t => String(t.linkedClass?.classId) === String(cls.classId) && t.userId !== user.userId)
                                                                                ? ' ⚠️ Has teacher'
                                                                                : ''}
                                                                        </option>
                                                                    ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    {reassigning[user.userId] && <span style={styles.savingText}>⏳</span>}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={styles.nonTeacherInfo}>
                                                <span style={styles.nonTeacherText}>
                                                    {user.role === 'ADMIN' ? '🔑 Full system access' : '📋 Clerk access'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {filtered.length === 0 && (
                            <div style={styles.emptyCard}>
                                <div style={styles.emptyIcon}>👤</div>
                                <p>No users found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Unassigned Classes Warning */}
                {unassignedClasses.length > 0 && (
                    <div style={styles.warningCard}>
                        <h3 style={styles.warningTitle}>⚠️ Classes Without a Teacher ({unassignedClasses.length})</h3>
                        <div style={styles.unassignedGrid}>
                            {unassignedClasses.map(cls => (
                                <div key={cls.classId} style={styles.unassignedChip}>
                                    🏫 {classDisplayName(cls)}
                                </div>
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

    error: { color: 'red', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px', border: '1px solid #ffcdd2' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    // Stats
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' },
    statCard: { backgroundColor: 'white', borderRadius: '10px', padding: '15px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
    statIcon: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 },
    statNum: { fontSize: '26px', fontWeight: 'bold', color: '#1F3864', display: 'block' },
    statLabel: { fontSize: '12px', color: '#666' },

    // Form
    formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },

    // Filters
    filterBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' },
    roleTabs: { display: 'flex', gap: '5px' },
    roleTab: { padding: '8px 14px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' },
    roleTabCount: { backgroundColor: 'rgba(0,0,0,0.15)', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' },

    // User cards grid
    userGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' },
    userCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    userCardHeader: { padding: '15px', display: 'flex', alignItems: 'center', gap: '12px' },
    userAvatar: { width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 },
    userInfo: { flex: 1 },
    username: { color: 'white', fontWeight: 'bold', fontSize: '15px' },
    rolePill: { backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' },
    deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.7, padding: '4px' },

    userCardBody: { padding: '15px' },

    assignedClass: { marginBottom: '12px' },
    classTag: { backgroundColor: '#f8f9fa', borderRadius: '6px', padding: '10px 12px' },
    classTagTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' },
    classTagName: { fontWeight: 'bold', color: '#1F3864', fontSize: '14px' },
    sectionPill: { color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' },
    classTagStats: { display: 'flex', gap: '12px', fontSize: '12px', color: '#666' },

    noClass: { backgroundColor: '#fff3e0', borderRadius: '6px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #ffe0b2' },
    noClassText: { color: '#e65100', fontSize: '13px', fontWeight: 'bold' },

    assignRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    classSelect: { flex: 1, padding: '8px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '13px', backgroundColor: 'white' },
    savingText: { fontSize: '16px' },

    nonTeacherInfo: { padding: '10px 0' },
    nonTeacherText: { color: '#666', fontSize: '13px' },

    loadingCard: { backgroundColor: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center' },
    emptyCard: { gridColumn: '1/-1', backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center' },
    emptyIcon: { fontSize: '48px', marginBottom: '10px' },

    // Unassigned warning
    warningCard: { backgroundColor: '#fff8e1', border: '2px solid #ffc107', borderRadius: '10px', padding: '15px 20px' },
    warningTitle: { color: '#856404', margin: '0 0 12px 0', fontSize: '15px' },
    unassignedGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    unassignedChip: { backgroundColor: '#fff3cd', color: '#856404', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #ffc107' },
};

export default Users;