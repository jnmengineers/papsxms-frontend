import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Teachers() {
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [activeTab, setActiveTab] = useState('teachers'); // teachers | assignments
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1', grades: ['PG', 'PP1', 'PP2'] },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6', grades: ['G1', 'G2', 'G3'] },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14', grades: ['G4', 'G5', 'G6'] },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997', grades: ['G7', 'G8', 'G9'] }
    ];

    useEffect(() => {
        fetchTeachers();
        fetchClasses();
    }, []);

    useEffect(() => {
        let data = teachers;
        if (search) {
            data = data.filter(t =>
                t.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                t.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                t.email?.toLowerCase().includes(search.toLowerCase()) ||
                t.phone?.toLowerCase().includes(search.toLowerCase())
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

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data);
        } catch (err) {
            setError('Failed to load classes');
        }
    };

    const handleEdit = (teacher) => {
        setEditingTeacher(teacher);
        setFormData({
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email || '',
            phone: teacher.phone
        });
        setShowForm(true);
        setActiveTab('teachers');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email ? formData.email : null,
                phone: formData.phone
            };
            if (editingTeacher) {
                await api.put(`/api/teachers/${editingTeacher.teacherId}`, payload);
                setSuccessMsg('Teacher updated successfully!');
            } else {
                await api.post('/api/teachers', payload);
                setSuccessMsg('Teacher added successfully!');
            }
            setShowForm(false);
            setEditingTeacher(null);
            setFormData({ firstName: '', lastName: '', email: '', phone: '' });
            fetchTeachers();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save teacher. Phone number may already be in use.');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure? This teacher will be unassigned from any class.')) {
            try {
                await api.delete(`/api/teachers/${id}`);
                setSuccessMsg('Teacher deleted!');
                fetchTeachers();
                fetchClasses();
                setTimeout(() => setSuccessMsg(''), 2000);
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

    // ── Class Assignment Handlers ──────────────────────────────────────────
    const handleAssignTeacher = async (classId, teacherId) => {
        try {
            if (teacherId === '') {
                // Unassign — using 0 or a special unassign endpoint
                await api.patch(`/api/classes/${classId}/unassign-teacher`);
            } else {
                await api.patch(`/api/classes/${classId}/assign-teacher/${teacherId}`);
            }
            setSuccessMsg('Class teacher updated!');
            fetchClasses();
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) {
            setError('Failed to update class teacher assignment');
            setTimeout(() => setError(''), 3000);
        }
    };

    // Group classes by section → grade
    const getGroupedClasses = () => {
        const grouped = {};
        sections.forEach(s => { grouped[s.value] = {}; });
        classes.forEach(cls => {
            const section = cls.section;
            const grade = cls.gradeLevel;
            if (section && grade) {
                if (!grouped[section]) grouped[section] = {};
                if (!grouped[section][grade]) grouped[section][grade] = [];
                grouped[section][grade].push(cls);
            }
        });
        return grouped;
    };

    // Get classes assigned to a teacher
    const getTeacherClasses = (teacherId) =>
        classes.filter(c => String(c.classTeacher?.teacherId) === String(teacherId));

    // Get teachers with no class assigned
    const getUnassignedTeachers = () =>
        teachers.filter(t => !classes.some(c => String(c.classTeacher?.teacherId) === String(t.teacherId)));

    const groupedClasses = getGroupedClasses();
    const totalAssigned = classes.filter(c => c.classTeacher).length;
    const totalUnassigned = classes.length - totalAssigned;

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
                    <div>
                        <h2 style={styles.title}>👨‍🏫 Teachers</h2>
                        <p style={styles.subtitle}>Manage teacher records and class assignments</p>
                    </div>
                    <button onClick={() => { setShowForm(!showForm); setEditingTeacher(null); setActiveTab('teachers'); }} style={styles.addBtn}>
                        {showForm ? '✕ Cancel' : '+ Add Teacher'}
                    </button>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add/Edit Form */}
                {showForm && (
                    <div style={styles.form}>
                        <h3 style={styles.formTitle}>{editingTeacher ? '✏️ Edit Teacher' : '➕ Add New Teacher'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>First Name</label>
                                    <input style={styles.input} value={formData.firstName}
                                        onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Last Name</label>
                                    <input style={styles.input} value={formData.lastName}
                                        onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        Phone <span style={styles.requiredTag}>Required • Unique</span>
                                    </label>
                                    <input style={styles.input} value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        placeholder="e.g. 0712345678" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        Email <span style={styles.optionalTag}>Optional</span>
                                    </label>
                                    <input type="email" style={styles.input} value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        placeholder="Can be added later" />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={styles.submitBtn}>
                                    {editingTeacher ? '✅ Update Teacher' : '💾 Save Teacher'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button onClick={() => setActiveTab('teachers')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'teachers' ? '#1F3864' : 'white',
                        color: activeTab === 'teachers' ? 'white' : '#1F3864'
                    }}>
                        👨‍🏫 All Teachers ({teachers.length})
                    </button>
                    <button onClick={() => setActiveTab('assignments')} style={{
                        ...styles.tab,
                        backgroundColor: activeTab === 'assignments' ? '#1F3864' : 'white',
                        color: activeTab === 'assignments' ? 'white' : '#1F3864'
                    }}>
                        🏫 Class Assignments
                    </button>
                </div>

                {/* ── TAB 1: All Teachers ── */}
                {activeTab === 'teachers' && (
                    <>
                        <div style={styles.searchBar}>
                            <input style={styles.searchInput}
                                placeholder="🔍 Search by name, phone or email..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                            <button onClick={() => setSearch('')} style={styles.clearBtn}>Clear</button>
                        </div>

                        {loading ? <p style={styles.centerMsg}>⏳ Loading teachers...</p> : (
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeader}>
                                            <th style={styles.th}>#</th>
                                            <th style={styles.th}>First Name</th>
                                            <th style={styles.th}>Last Name</th>
                                            <th style={styles.th}>Phone</th>
                                            <th style={styles.th}>Email</th>
                                            <th style={styles.th}>Assigned Class</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((teacher, index) => {
                                            const assignedClasses = getTeacherClasses(teacher.teacherId);
                                            return (
                                                <tr key={teacher.teacherId} style={index % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                    <td style={styles.td}>{index + 1}</td>
                                                    <td style={styles.td}><strong>{teacher.firstName}</strong></td>
                                                    <td style={styles.td}>{teacher.lastName}</td>
                                                    <td style={styles.td}>
                                                        <span style={styles.phoneBadge}>{teacher.phone}</span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        {teacher.email
                                                            ? teacher.email
                                                            : <span style={styles.noEmail}>Not provided</span>}
                                                    </td>
                                                    <td style={styles.td}>
                                                        {assignedClasses.length > 0
                                                            ? assignedClasses.map(c => (
                                                                <span key={c.classId} style={styles.classBadge}>{c.className}</span>
                                                              ))
                                                            : <span style={styles.unassignedBadge}>Unassigned</span>}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <button onClick={() => handleEdit(teacher)} style={styles.editBtn}>Edit</button>
                                                        <button onClick={() => handleDelete(teacher.teacherId)} style={styles.deleteBtn}>Delete</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                                    No teachers found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* ── TAB 2: Class Assignments ── */}
                {activeTab === 'assignments' && (
                    <div>
                        {/* Summary */}
                        <div style={styles.summaryRow}>
                            <div style={{ ...styles.summaryCard, borderTop: '4px solid #28a745' }}>
                                <span style={{ ...styles.summaryNum, color: '#28a745' }}>{totalAssigned}</span>
                                <span style={styles.summaryLabel}>Classes with Teacher</span>
                            </div>
                            <div style={{ ...styles.summaryCard, borderTop: '4px solid #dc3545' }}>
                                <span style={{ ...styles.summaryNum, color: '#dc3545' }}>{totalUnassigned}</span>
                                <span style={styles.summaryLabel}>Classes without Teacher</span>
                            </div>
                            <div style={{ ...styles.summaryCard, borderTop: '4px solid #2E75B6' }}>
                                <span style={{ ...styles.summaryNum, color: '#2E75B6' }}>{getUnassignedTeachers().length}</span>
                                <span style={styles.summaryLabel}>Teachers without Class</span>
                            </div>
                        </div>

                        {/* Unassigned Teachers Pool */}
                        {getUnassignedTeachers().length > 0 && (
                            <div style={styles.poolCard}>
                                <h4 style={styles.poolTitle}>👥 Teachers Without a Class</h4>
                                <div style={styles.poolTiles}>
                                    {getUnassignedTeachers().map(t => (
                                        <div key={t.teacherId} style={styles.poolTile}>
                                            👨‍🏫 {t.firstName} {t.lastName}
                                            <span style={styles.poolPhone}>{t.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Classes grouped by section → grade, each with teacher dropdown */}
                        {sections.map(section => {
                            const sectionGrades = groupedClasses[section.value] || {};
                            const hasClasses = Object.keys(sectionGrades).length > 0;
                            if (!hasClasses) return null;
                            return (
                                <div key={section.value} style={styles.sectionBlock}>
                                    <div style={{ ...styles.sectionHeader, backgroundColor: section.color }}>
                                        <span style={styles.sectionLabel}>{section.label}</span>
                                        <span style={styles.sectionMeta}>
                                            {Object.values(sectionGrades).flat().length} class(es)
                                        </span>
                                    </div>
                                    <div style={styles.classGrid}>
                                        {Object.entries(sectionGrades)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .flatMap(([grade, gradeClasses]) => gradeClasses)
                                            .map(cls => (
                                                <div key={cls.classId} style={{
                                                    ...styles.classCard,
                                                    borderLeft: `4px solid ${cls.classTeacher ? '#28a745' : '#dc3545'}`
                                                }}>
                                                    <div style={styles.classCardTop}>
                                                        <span style={styles.classCardName}>{cls.className}</span>
                                                        <span style={{
                                                            ...styles.statusDot,
                                                            backgroundColor: cls.classTeacher ? '#28a745' : '#dc3545'
                                                        }}>
                                                            {cls.classTeacher ? '✅ Assigned' : '❌ Unassigned'}
                                                        </span>
                                                    </div>
                                                    <select style={styles.assignSelect}
                                                        value={cls.classTeacher?.teacherId || ''}
                                                        onChange={e => handleAssignTeacher(cls.classId, e.target.value)}>
                                                        <option value="">— No Teacher —</option>
                                                        {teachers.map(t => (
                                                            <option key={t.teacherId} value={t.teacherId}>
                                                                {t.firstName} {t.lastName} ({t.phone})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            );
                        })}

                        {classes.length === 0 && (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>🏫</div>
                                <h3>No Classes Yet</h3>
                                <p>Add classes first from the Classes page</p>
                            </div>
                        )}
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

    // Form
    form: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formTitle: { color: '#1F3864', marginBottom: '15px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '13px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '6px' },
    requiredTag: { backgroundColor: '#dc3545', color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'normal' },
    optionalTag: { backgroundColor: '#6c757d', color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'normal' },
    input: { padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' },

    // Tabs
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '5px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    // Search
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px' },
    searchInput: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '14px' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' },

    // Table
    tableWrapper: { overflowX: 'auto', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '700px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' },
    phoneBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' },
    noEmail: { color: '#999', fontStyle: 'italic', fontSize: '12px' },
    classBadge: { backgroundColor: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', marginRight: '4px', display: 'inline-block', marginBottom: '2px' },
    unassignedBadge: { color: '#999', fontStyle: 'italic', fontSize: '12px' },

    // Summary
    summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' },
    summaryCard: { backgroundColor: 'white', padding: '15px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '4px' },
    summaryNum: { fontSize: '28px', fontWeight: 'bold' },
    summaryLabel: { fontSize: '13px', color: '#666' },

    // Unassigned teachers pool
    poolCard: { backgroundColor: 'white', padding: '15px 20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
    poolTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '15px' },
    poolTiles: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    poolTile: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '8px 15px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
    poolPhone: { fontSize: '11px', color: '#856404', fontFamily: 'monospace' },

    // Section block
    sectionBlock: { marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    sectionHeader: { padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '14px' },
    sectionMeta: { color: 'rgba(255,255,255,0.8)', fontSize: '12px' },
    classGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '15px', backgroundColor: 'white' },
    classCard: { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
    classCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '5px' },
    classCardName: { fontWeight: 'bold', color: '#1F3864', fontSize: '15px' },
    statusDot: { color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' },
    assignSelect: { padding: '8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '12px', width: '100%' },

    // Empty
    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
};

export default Teachers;