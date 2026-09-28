import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { SECTION_CODES, SECTION_GRADES_LIVE, SECTION_COLORS_LIVE, SECTION_NAMES_LIVE } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { subjectName: '', subjectCode: '', gradeLevel: '' };

// Sections and grades come from School Settings
const SECTIONS = SECTION_CODES;
const SECTION_GRADES = SECTION_GRADES_LIVE;
const SECTION_COLORS = new Proxy(SECTION_COLORS_LIVE, { get: (t, k) => t[k] || '#6c757d' });
const gradeRange = (sec) => { const g = SECTION_GRADES_LIVE[sec] || []; return g.length ? ` (${g.join(', ')})` : ''; };
const sectionNames = () => ({ ...Object.fromEntries(SECTION_CODES.map(sec => [sec, `${SECTION_NAMES_LIVE[sec]}${gradeRange(sec)}`])), OTHER: 'No section set' });
// The value saved for each section (the first grade of the section, as before)
const sectionOptions = () => SECTION_CODES.filter(sec => (SECTION_GRADES_LIVE[sec] || []).length)
    .map(sec => ({ value: SECTION_GRADES_LIVE[sec][0], label: `${SECTION_NAMES_LIVE[sec]}${gradeRange(sec)}` }));

const sectionOf = (gradeLevel) => SECTIONS.find(sec => SECTION_GRADES[sec].includes(String(gradeLevel || '').toUpperCase())) || 'OTHER';
const norm = (v) => String(v ?? '').trim().toLowerCase();
const serverMessage = (err, fallback) => {
    const d = err.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

// Outside parent — prevents keyboard dismiss on re-render
const SubjectFormFields = ({ formData, setFormData, onSubmit, onCancel, submitLabel, submitIcon, saving }) => {
    // Keep an existing value like "G5" selectable, so editing doesn't silently change it
    const extraOption = formData.gradeLevel && !sectionOptions().some(o => o.value === formData.gradeLevel)
        ? { value: formData.gradeLevel, label: `Keep current (${formData.gradeLevel})` } : null;
    return (
        <form onSubmit={onSubmit} style={styles.inlineForm}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Subject Name</label>
                    <input style={styles.input} value={formData.subjectName} autoComplete="off"
                        onChange={e => setFormData({ ...formData, subjectName: e.target.value })}
                        placeholder="e.g. Mathematics" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Subject Code</label>
                    <input style={{ ...styles.input, textTransform: 'uppercase' }} value={formData.subjectCode} autoComplete="off"
                        onChange={e => setFormData({ ...formData, subjectCode: e.target.value })}
                        placeholder="e.g. MATH" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Section</label>
                    <select style={styles.input} value={formData.gradeLevel}
                        onChange={e => setFormData({ ...formData, gradeLevel: e.target.value })} required>
                        <option value="">Select Section</option>
                        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
                        {sectionOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>
            <div style={styles.btnGroup}>
                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                    <Icon name={saving ? 'hourglass-split' : submitIcon} />{saving ? 'Saving...' : submitLabel}
                </button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Cancel</button>
            </div>
        </form>
    );
};

function Subjects() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assigningId, setAssigningId] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);

    useEffect(() => {
        fetchSubjects(); fetchTeachers();
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError('');
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3000);
    };

    const fetchSubjects = async () => {
        try {
            const response = await api.get('/api/subjects');
            setSubjects(response.data || []);
        } catch (err) { setError('Failed to load subjects. Check your connection and refresh.'); }
        setLoading(false);
    };

    const fetchTeachers = async () => {
        try {
            const response = await api.get('/api/teachers');
            setTeachers([...(response.data || [])].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
        } catch (err) { setError('Failed to load teachers — assigning teachers won\'t work until you refresh.'); }
    };

    const q = norm(search);
    const filtered = subjects
        .filter(s => !q || norm(s.subjectName).includes(q) || norm(s.subjectCode).includes(q) || norm(s.gradeLevel).includes(q) ||
            norm(s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '').includes(q))
        .sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));

    const resetForm = () => setFormData(EMPTY_FORM);

    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setEditingSubject(null);
        resetForm(); // never carry over the subject that was being edited
        setShowAddForm(true);
    };

    const handleEdit = (subject) => {
        if (editingSubject?.subjectId === subject.subjectId) { handleCancelEdit(); return; }
        setEditingSubject(subject);
        setFormData({ subjectName: subject.subjectName || '', subjectCode: subject.subjectCode || '', gradeLevel: subject.gradeLevel || '' });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingSubject(null); resetForm(); };

    const cleaned = () => ({
        subjectName: formData.subjectName.trim(),
        subjectCode: formData.subjectCode.trim().toUpperCase(),
        gradeLevel: formData.gradeLevel
    });

    // Same code in the same section = duplicate
    const duplicateOf = (data, exceptId) => subjects.find(s =>
        String(s.subjectId) !== String(exceptId ?? '') &&
        norm(s.subjectCode) === norm(data.subjectCode) &&
        sectionOf(s.gradeLevel) === sectionOf(data.gradeLevel));

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const data = cleaned();
        const dup = duplicateOf(data);
        if (dup) { setError(`Code ${data.subjectCode} is already used by ${dup.subjectName} in this section.`); return; }
        setSaving(true); setError('');
        try {
            await api.post('/api/subjects', data);
            flashSuccess(`${data.subjectName} added!`);
            setShowAddForm(false);
            resetForm();
            fetchSubjects();
        } catch (err) { setError(serverMessage(err, 'Failed to save subject')); }
        setSaving(false);
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const data = cleaned();
        const dup = duplicateOf(data, editingSubject.subjectId);
        if (dup) { setError(`Code ${data.subjectCode} is already used by ${dup.subjectName} in this section.`); return; }
        setSaving(true); setError('');
        try {
            await api.put(`/api/subjects/${editingSubject.subjectId}`, data);
            flashSuccess(`${data.subjectName} updated!`);
            handleCancelEdit();
            fetchSubjects();
        } catch (err) { setError(serverMessage(err, 'Failed to update subject')); }
        setSaving(false);
    };

    const handleAssignTeacher = async (subject, teacherId) => {
        if (!teacherId || String(teacherId) === String(subject.teacher?.teacherId ?? '')) return;
        const teacher = teachers.find(t => String(t.teacherId) === String(teacherId));
        setAssigningId(subject.subjectId); setError('');
        try {
            await api.patch(`/api/subjects/${subject.subjectId}/assign-teacher/${teacherId}`);
            await fetchSubjects();
            flashSuccess(`${teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Teacher'} assigned to ${subject.subjectName}`);
        } catch (err) { setError(serverMessage(err, 'Failed to assign teacher')); }
        setAssigningId(null);
    };

    const handleDelete = async (subject) => {
        if (!window.confirm(`Delete ${subject.subjectName} (${subject.subjectCode})?\n\nThis also removes it from all class assignments and cannot be undone.`)) return;
        setError('');
        try {
            await api.delete(`/api/subjects/${subject.subjectId}`);
            if (editingSubject?.subjectId === subject.subjectId) handleCancelEdit();
            fetchSubjects();
            flashSuccess(`${subject.subjectName} deleted`);
        } catch (err) {
            const status = err.response?.status;
            setError(status === 409 || status === 500
                ? serverMessage(err, `${subject.subjectName} could not be deleted — marks have probably already been entered for it.`)
                : serverMessage(err, 'Failed to delete subject.'));
        }
    };

    const groups = [...SECTIONS, 'OTHER']
        .map(sec => ({ sec, items: filtered.filter(s => sectionOf(s.gradeLevel) === sec) }))
        .filter(g => g.items.length > 0);

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <div>
                            <h2 style={styles.title}><Icon name="journals" style={{ marginRight: '10px' }} />Subjects</h2>
                            <p style={styles.subtitle}>Subject pool — {subjects.length} subjects across all sections</p>
                        </div>
                        <button onClick={toggleAddForm} style={styles.addBtn}>
                            {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Subject</>}
                        </button>
                    </div>

                    {error && (
                        <p style={styles.error} role="alert">
                            <Icon name="exclamation-triangle-fill" />{error}
                            <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                        </p>
                    )}
                    {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                    {showAddForm && (
                        <div style={styles.addFormCard}>
                            <h3 style={styles.formTitle}><Icon name="plus-circle" />Add New Subject</h3>
                            <SubjectFormFields
                                formData={formData} setFormData={setFormData}
                                onSubmit={handleSubmitAdd}
                                onCancel={() => { setShowAddForm(false); resetForm(); }}
                                submitLabel="Save Subject" submitIcon="save-fill" saving={saving}
                            />
                        </div>
                    )}

                    <div style={styles.searchBar}>
                        <div style={styles.searchBox}>
                            <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                            <input style={styles.searchInput} placeholder="Search by name, code, grade or teacher..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button onClick={() => setSearch('')} style={styles.clearBtn}><Icon name="arrow-counterclockwise" />Clear</button>
                    </div>

                    {loading ? (
                        <p style={{ color: '#666' }}><Icon name="hourglass-split" />Loading subjects...</p>
                    ) : (
                        <div style={styles.tableWrapper}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHeader}>
                                        <th style={styles.th}>#</th>
                                        <th style={styles.th}>Subject Name</th>
                                        <th style={styles.th}>Code</th>
                                        <th style={styles.th}>Grade</th>
                                        <th style={styles.th}>Teacher</th>
                                        <th style={styles.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map(({ sec, items }) => (
                                        <React.Fragment key={sec}>
                                            <tr>
                                                <td colSpan="6" style={{ ...styles.groupRow, backgroundColor: SECTION_COLORS[sec] }}>
                                                    <Icon name={sec === 'OTHER' ? 'question-circle-fill' : 'circle-fill'} style={{ fontSize: sec === 'OTHER' ? '13px' : '9px' }} />
                                                    {sectionNames()[sec]} — {items.length} subject{items.length !== 1 ? 's' : ''}
                                                    {sec === 'OTHER' && <span style={{ fontWeight: 'normal', marginLeft: '8px' }}>(edit these to choose a section)</span>}
                                                </td>
                                            </tr>
                                            {items.map((subject, index) => {
                                                const isEditing = editingSubject?.subjectId === subject.subjectId;
                                                const rowBg = isEditing ? '#e3f2fd' : index % 2 === 0 ? '#f9f9f9' : 'white';
                                                return (
                                                    <React.Fragment key={subject.subjectId}>
                                                        <tr style={{ backgroundColor: rowBg }}>
                                                            <td style={styles.td}>{index + 1}</td>
                                                            <td style={styles.td}><strong>{subject.subjectName}</strong></td>
                                                            <td style={styles.td}><span style={styles.codeBadge}>{subject.subjectCode}</span></td>
                                                            <td style={styles.td}>
                                                                <span style={{ ...styles.gradeBadge, backgroundColor: SECTION_COLORS[sec] }}>{subject.gradeLevel || '—'}</span>
                                                            </td>
                                                            <td style={styles.td}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <select style={{ ...styles.smallSelect, color: subject.teacher ? '#1F3864' : '#999', fontStyle: subject.teacher ? 'normal' : 'italic' }}
                                                                        value={subject.teacher?.teacherId ? String(subject.teacher.teacherId) : ''}
                                                                        disabled={assigningId === subject.subjectId || teachers.length === 0}
                                                                        onChange={e => handleAssignTeacher(subject, e.target.value)}
                                                                        aria-label={`Teacher for ${subject.subjectName}`}>
                                                                        {!subject.teacher && <option value="">Not assigned — choose…</option>}
                                                                        {teachers.map(t => <option key={t.teacherId} value={String(t.teacherId)} style={{ fontStyle: 'normal', color: '#333' }}>{t.firstName} {t.lastName}</option>)}
                                                                    </select>
                                                                    {assigningId === subject.subjectId && <Icon name="hourglass-split" style={{ color: '#888' }} />}
                                                                </div>
                                                            </td>
                                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                                                <button onClick={() => handleEdit(subject)} style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                                    {isEditing ? <><Icon name="x-lg" style={{ marginRight: '4px' }} />Close</> : <><Icon name="pencil-fill" style={{ marginRight: '4px' }} />Edit</>}
                                                                </button>
                                                                <button onClick={() => handleDelete(subject)} style={styles.deleteBtn} title="Delete subject">
                                                                    <Icon name="trash-fill" style={{ marginRight: '4px' }} />Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {isEditing && (
                                                            <tr>
                                                                <td colSpan="6" style={styles.inlineEditTd}>
                                                                    <div style={styles.inlineEditCard}>
                                                                        <div style={styles.inlineEditHeader}>
                                                                            <h4 style={styles.inlineEditTitle}><Icon name="pencil-fill" />Editing: {subject.subjectName}</h4>
                                                                            <button onClick={handleCancelEdit} style={styles.closeBtn} aria-label="Close"><i className="bi bi-x-lg" /></button>
                                                                        </div>
                                                                        <SubjectFormFields
                                                                            formData={formData} setFormData={setFormData}
                                                                            onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                                            submitLabel="Update Subject" submitIcon="check-circle-fill" saving={saving}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                                            <Icon name="inbox" />{search ? `No subjects match "${search}"` : 'No subjects yet — click Add Subject to create one.'}
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    addFormCard: { backgroundColor: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    inlineEditTd: { padding: 0, border: 'none' },
    inlineEditCard: { backgroundColor: '#f0f7ff', padding: '15px 20px', borderLeft: '4px solid #2E75B6', borderBottom: '1px solid #ddd' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '14px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' },
    tableWrapper: { overflowX: 'auto', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '700px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    groupRow: { color: 'white', padding: '8px 15px', fontWeight: 'bold', fontSize: '13px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    codeBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' },
    gradeBadge: { color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
    smallSelect: { padding: '6px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', maxWidth: '200px', backgroundColor: 'white' },
};

export default Subjects;
