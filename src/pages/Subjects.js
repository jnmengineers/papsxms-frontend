import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null); // inline edit
    const [teachers, setTeachers] = useState([]);
    const [activeTab, setActiveTab] = useState('pool');
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState([]);
    const seeded = React.useRef(false);
    const [formData, setFormData] = useState({ subjectName: '', subjectCode: '', gradeLevel: '' });

    const sectionSubjects = {
        PRE_SCHOOL: { label: 'Pre-School', color: '#6f42c1', grades: 'PG, PP1, PP2', subjects: ['Number Work','Language','Literacy','Integrated','Kiswahili','Environmental','Religious','Creative Activities'] },
        LOWER_PRIMARY: { label: 'Lower Primary', color: '#2E75B6', grades: 'G1, G2, G3', subjects: ['Mathematics','English','Kiswahili','Integrated','CRE','Environmental','Creative Activities'] },
        UPPER_PRIMARY: { label: 'Upper Primary', color: '#fd7e14', grades: 'G4, G5, G6', subjects: ['Mathematics','English','Kiswahili','Science & Technology','Agriculture & Nutrition','Social Studies','CRE','Creative Arts'] },
        JUNIOR_SCHOOL: { label: 'Junior Secondary School', color: '#20c997', grades: 'G7, G8, G9', subjects: ['Mathematics','English','Kiswahili','Integrated Science','Pre-Technical Studies','Agriculture & Nutrition','Social Studies','CRE','Creative Arts'] }
    };

    const gradeForSection = { PRE_SCHOOL: 'PG', LOWER_PRIMARY: 'G1', UPPER_PRIMARY: 'G4', JUNIOR_SCHOOL: 'G7' };

    const allToSeed = [
        { subjectName: 'Number Work', subjectCode: 'NUMWRK', gradeLevel: 'PG' },
        { subjectName: 'Language', subjectCode: 'LANG', gradeLevel: 'PG' },
        { subjectName: 'Literacy', subjectCode: 'LIT', gradeLevel: 'PG' },
        { subjectName: 'Integrated', subjectCode: 'INTG', gradeLevel: 'PG' },
        { subjectName: 'Kiswahili', subjectCode: 'KSW', gradeLevel: 'PG' },
        { subjectName: 'Environmental', subjectCode: 'ENV', gradeLevel: 'PG' },
        { subjectName: 'Religious', subjectCode: 'REL', gradeLevel: 'PG' },
        { subjectName: 'Creative Activities', subjectCode: 'CREAT', gradeLevel: 'PG' },
        { subjectName: 'Mathematics', subjectCode: 'MATH', gradeLevel: 'G1' },
        { subjectName: 'English', subjectCode: 'ENG', gradeLevel: 'G1' },
        { subjectName: 'Kiswahili', subjectCode: 'KSW', gradeLevel: 'G1' },
        { subjectName: 'Integrated', subjectCode: 'INTG', gradeLevel: 'G1' },
        { subjectName: 'CRE', subjectCode: 'CRE', gradeLevel: 'G1' },
        { subjectName: 'Environmental', subjectCode: 'ENV', gradeLevel: 'G1' },
        { subjectName: 'Creative Activities', subjectCode: 'CREAT', gradeLevel: 'G1' },
        { subjectName: 'Mathematics', subjectCode: 'MATH', gradeLevel: 'G4' },
        { subjectName: 'English', subjectCode: 'ENG', gradeLevel: 'G4' },
        { subjectName: 'Kiswahili', subjectCode: 'KSW', gradeLevel: 'G4' },
        { subjectName: 'Science & Technology', subjectCode: 'SCITEC', gradeLevel: 'G4' },
        { subjectName: 'Agriculture & Nutrition', subjectCode: 'AGRI', gradeLevel: 'G4' },
        { subjectName: 'Social Studies', subjectCode: 'SOCST', gradeLevel: 'G4' },
        { subjectName: 'CRE', subjectCode: 'CRE', gradeLevel: 'G4' },
        { subjectName: 'Creative Arts', subjectCode: 'CRARTS', gradeLevel: 'G4' },
        { subjectName: 'Mathematics', subjectCode: 'MATH', gradeLevel: 'G7' },
        { subjectName: 'English', subjectCode: 'ENG', gradeLevel: 'G7' },
        { subjectName: 'Kiswahili', subjectCode: 'KSW', gradeLevel: 'G7' },
        { subjectName: 'Integrated Science', subjectCode: 'INTSCI', gradeLevel: 'G7' },
        { subjectName: 'Pre-Technical Studies', subjectCode: 'PRETECH', gradeLevel: 'G7' },
        { subjectName: 'Agriculture & Nutrition', subjectCode: 'AGRI', gradeLevel: 'G7' },
        { subjectName: 'Social Studies', subjectCode: 'SOCST', gradeLevel: 'G7' },
        { subjectName: 'CRE', subjectCode: 'CRE', gradeLevel: 'G7' },
        { subjectName: 'Creative Arts', subjectCode: 'CRARTS', gradeLevel: 'G7' },
    ];

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

    const fetchSubjects = async (skipSeed = false) => {
        try {
            const response = await api.get('/api/subjects');
            setSubjects(response.data);
            setFiltered(response.data);
            setLoading(false);
            if (!skipSeed && response.data.length === 0) await seedSubjects();
        } catch (err) { setError('Failed to load subjects'); setLoading(false); }
    };

    const seedSubjects = async () => {
        for (const subject of allToSeed) {
            try { await api.post('/api/subjects', subject); } catch (err) {}
        }
        const response = await api.get('/api/subjects');
        setSubjects(response.data); setFiltered(response.data); setLoading(false);
        setSuccessMsg('✅ Default subjects loaded!');
        setTimeout(() => setSuccessMsg(''), 3000);
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
            fetchSubjects(true);
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
            fetchSubjects(true);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to update subject'); }
    };

    const handleQuickAdd = async (subjectName, gradeLevel) => {
        const exists = subjects.find(s => s.subjectName.toLowerCase() === subjectName.toLowerCase() && s.gradeLevel === gradeLevel);
        if (exists) { setSuccessMsg(`"${subjectName}" already in pool`); setTimeout(() => setSuccessMsg(''), 2000); return; }
        try {
            await api.post('/api/subjects', { subjectName, subjectCode: subjectName.replace(/[^A-Za-z]/g,'').substring(0,6).toUpperCase(), gradeLevel });
            fetchSubjects(true);
            setSuccessMsg(`✅ "${subjectName}" added!`);
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) { setError('Failed to add subject'); }
    };

    const handleAddAllForSection = async (sectionKey) => {
        const section = sectionSubjects[sectionKey];
        const gradeLevel = gradeForSection[sectionKey];
        let added = 0;
        for (const name of section.subjects) {
            const exists = subjects.find(s => s.subjectName.toLowerCase() === name.toLowerCase() && s.gradeLevel === gradeLevel);
            if (!exists) {
                try { await api.post('/api/subjects', { subjectName: name, subjectCode: name.replace(/[^A-Za-z]/g,'').substring(0,6).toUpperCase(), gradeLevel }); added++; } catch (err) {}
            }
        }
        fetchSubjects(true);
        setSuccessMsg(`✅ Added ${added} new subjects for ${section.label}!`);
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleAssignTeacher = async (subjectId, teacherId) => {
        try {
            await api.patch(`/api/subjects/${subjectId}/assign-teacher/${teacherId}`);
            fetchSubjects(true);
            setSuccessMsg('Teacher assigned!');
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) { setError('Failed to assign teacher'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure? This will also remove this subject from all class assignments.')) {
            try {
                await api.delete(`/api/subjects/${id}`);
                if (editingSubject?.subjectId === id) setEditingSubject(null);
                fetchSubjects(true);
                setSuccessMsg('Subject deleted!');
                setTimeout(() => setSuccessMsg(''), 2000);
            } catch (err) { setError('Failed to delete subject.'); }
        }
    };

    const isInPool = (subjectName, sectionKey) => {
        const gradeLevel = gradeForSection[sectionKey];
        return subjects.some(s => s.subjectName.toLowerCase() === subjectName.toLowerCase() && s.gradeLevel === gradeLevel);
    };

    const SubjectFormFields = ({ onSubmit, onCancel, submitLabel }) => (
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
                    <label style={styles.label}>Grade Level</label>
                    <select style={styles.input} value={formData.gradeLevel}
                        onChange={e => setFormData({...formData, gradeLevel: e.target.value})} required>
                        <option value="">Select Grade</option>
                        <optgroup label="Pre-School"><option value="PG">PG</option><option value="PP1">PP1</option><option value="PP2">PP2</option></optgroup>
                        <optgroup label="Lower Primary"><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></optgroup>
                        <optgroup label="Upper Primary"><option value="G4">G4</option><option value="G5">G5</option><option value="G6">G6</option></optgroup>
                        <optgroup label="Junior School"><option value="G7">G7</option><option value="G8">G8</option><option value="G9">G9</option></optgroup>
                    </select>
                </div>
            </div>
            <div style={styles.btnGroup}>
                <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
            </div>
        </form>
    );

    return (
        <div style={styles.container}>
            <div style={styles.navbar}>
                <div style={styles.navLeft}><img src={logo1} alt="Logo" style={styles.navLogo} /><h2 style={styles.navTitle}>Pipeline Adventist School</h2></div>
                <div style={styles.navRight}>
                    <button onClick={() => window.location.href = '/dashboard'} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

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

                {/* Add Form */}
                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add New Subject</h3>
                        <SubjectFormFields
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); setFormData({ subjectName: '', subjectCode: '', gradeLevel: '' }); }}
                            submitLabel="💾 Save Subject"
                        />
                    </div>
                )}

                <div style={styles.tabs}>
                    {[['pool', `📋 Subject Pool (${subjects.length})`], ['quick', '⚡ Quick Add by Section']].map(([key, label]) => (
                        <button key={key} onClick={() => setActiveTab(key)} style={{
                            ...styles.tab,
                            backgroundColor: activeTab === key ? '#1F3864' : 'white',
                            color: activeTab === key ? 'white' : '#1F3864'
                        }}>{label}</button>
                    ))}
                </div>

                {/* TAB 1 — Subject Pool */}
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
                                                                {/* ── Inline Edit Row ── */}
                                                                {isEditing && (
                                                                    <tr>
                                                                        <td colSpan="7" style={styles.inlineEditTd}>
                                                                            <div style={styles.inlineEditCard}>
                                                                                <div style={styles.inlineEditHeader}>
                                                                                    <h4 style={styles.inlineEditTitle}>✏️ Editing: {subject.subjectName}</h4>
                                                                                    <button onClick={handleCancelEdit} style={styles.closeBtn}>✕</button>
                                                                                </div>
                                                                                <SubjectFormFields
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

                {/* TAB 2 — Quick Add */}
                {activeTab === 'quick' && (
                    <div>
                        <p style={styles.quickHint}>Click a subject tile to add it. Green = already in pool.</p>
                        {Object.entries(sectionSubjects).map(([sectionKey, section]) => (
                            <div key={sectionKey} style={styles.sectionBlock}>
                                <div style={{ ...styles.sectionHeader, backgroundColor: section.color }}>
                                    <div>
                                        <h3 style={styles.sectionTitle}>{section.label}</h3>
                                        <p style={styles.sectionGrades}>Grades: {section.grades}</p>
                                    </div>
                                    <div style={styles.sectionRight}>
                                        <span style={styles.sectionCount}>
                                            {section.subjects.filter(name => isInPool(name, sectionKey)).length} / {section.subjects.length} in pool
                                        </span>
                                        <button onClick={() => handleAddAllForSection(sectionKey)} style={styles.addAllBtn}>➕ Add All</button>
                                    </div>
                                </div>
                                <div style={styles.sectionTiles}>
                                    {section.subjects.map(subjectName => {
                                        const inPool = isInPool(subjectName, sectionKey);
                                        return (
                                            <div key={subjectName}
                                                style={{ ...styles.quickTile, backgroundColor: inPool ? '#e8f5e9' : 'white', color: inPool ? '#28a745' : '#333', border: inPool ? '2px solid #28a745' : `2px solid ${section.color}`, cursor: inPool ? 'default' : 'pointer' }}
                                                onClick={() => !inPool && handleQuickAdd(subjectName, gradeForSection[sectionKey])}>
                                                <span style={styles.quickTileIcon}>{inPool ? '✅' : '➕'}</span>
                                                <span style={styles.quickTileName}>{subjectName}</span>
                                                <span style={{ ...styles.quickTileStatus, color: inPool ? '#28a745' : section.color }}>{inPool ? 'In Pool' : 'Click to Add'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
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
    smallSelect: { padding: '5px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },

    quickHint: { color: '#666', marginBottom: '20px', fontSize: '14px', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px' },
    sectionBlock: { marginBottom: '25px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    sectionHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { color: 'white', margin: '0 0 4px 0', fontSize: '16px' },
    sectionGrades: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '12px' },
    sectionRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    sectionCount: { color: 'white', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px' },
    addAllBtn: { backgroundColor: 'white', color: '#1F3864', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    sectionTiles: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '15px', backgroundColor: 'white' },
    quickTile: { padding: '15px 10px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
    quickTileIcon: { fontSize: '24px' },
    quickTileName: { fontSize: '13px', fontWeight: 'bold', lineHeight: '1.3' },
    quickTileStatus: { fontSize: '11px', fontWeight: 'bold' }
};

export default Subjects;