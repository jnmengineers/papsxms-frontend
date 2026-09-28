import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import TempPasswordNotice from '../components/TempPasswordNotice';
import { SECTIONS_LIVE, gradeFromClassName, gradeRankOf } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '' };
// Grades, sections and how each section is taught come from School Settings
const gradeIdx = (g) => gradeRankOf(g);

const norm = (v) => String(v ?? '').trim().toLowerCase();
// Compare phones by digits only, treating 07.. and +2547.. as the same number
const phoneKey = (p) => {
    const d = String(p ?? '').replace(/\D/g, '');
    return d.startsWith('254') ? '0' + d.slice(3) : d;
};
const fullName = (t) => `${t?.firstName || ''} ${t?.lastName || ''}`.trim();
const serverMessage = (err, fallback) => {
    const d = err.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

// Outside parent — prevents keyboard dismiss on re-render
const TeacherFormFields = ({ formData, setFormData, onSubmit, onCancel, submitLabel, submitIcon, saving }) => (
    <form onSubmit={onSubmit} style={styles.inlineForm}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}>First Name</label>
                <input style={styles.input} value={formData.firstName} autoComplete="off"
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Last Name</label>
                <input style={styles.input} value={formData.lastName} autoComplete="off"
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Phone <span style={styles.requiredTag}>Required • Unique</span></label>
                <input type="tel" inputMode="tel" style={styles.input} value={formData.phone} autoComplete="off"
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 0712345678" required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Email <span style={styles.optionalTag}>Optional</span></label>
                <input type="email" style={styles.input} value={formData.email} autoComplete="off"
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Can be added later" />
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

// ══════════════════════════════════════════════════════════════════════════════
// TEACHERS BY SECTION
//   Pre-School & Lower Primary → class-based: the class teacher teaches every subject
//   Upper Primary & Junior     → subject-based: each subject in each class has its own teacher
// A teacher's section(s) come from what they teach, so nothing needs entering twice.
// ══════════════════════════════════════════════════════════════════════════════
const SECTION_INFO = SECTIONS_LIVE;   // each has key, title, color, grades, and mode ('class' or 'subject')
const secGradeOf = (c) => c?.gradeLevel || gradeFromClassName(c?.className);
const secKeyOf = (c) => SECTION_INFO.find(s => s.grades.includes(secGradeOf(c)))?.key || c?.section || '';

const SectionsView = ({ classes, teachers, assignments, assignmentsState, classSubjects, busyKey,
                        onSetClassTeacher, onSetSubjectTeacher, onRetry }) => {
    // Until a tab is picked, show the first subject-taught section (or the first section)
    const [chosenKey, setActiveKey] = useState('');
    const activeKey = chosenKey || (SECTION_INFO.find(s => s.mode === 'subject') || SECTION_INFO[0] || {}).key || '';
    const aKey = (classId, subjectId) => `${classId}_${subjectId}`;
    const assignmentMap = {};
    assignments.forEach(a => { assignmentMap[aKey(a.schoolClass?.classId, a.subject?.subjectId)] = a; });

    // Which sections each teacher works in (class teacher or subject teacher)
    const teacherSections = {};
    const addTo = (tid, key) => { if (tid == null || !key) return; (teacherSections[tid] = teacherSections[tid] || new Set()).add(key); };
    classes.forEach(c => { if (c.classTeacher?.teacherId != null) addTo(c.classTeacher.teacherId, secKeyOf(c)); });
    assignments.forEach(a => { const c = classes.find(x => String(x.classId) === String(a.schoolClass?.classId)) || a.schoolClass; addTo(a.teacher?.teacherId, secKeyOf(c)); });
    const unplaced = teachers.filter(t => !teacherSections[t.teacherId]);

    const section = SECTION_INFO.find(s => s.key === activeKey);
    const secClasses = classes.filter(c => secKeyOf(c) === activeKey)
        .sort((a, b) => section.grades.indexOf(secGradeOf(a)) - section.grades.indexOf(secGradeOf(b)) || classDisplayName(a).localeCompare(classDisplayName(b)));
    const secTeachers = teachers.filter(t => teacherSections[t.teacherId]?.has(activeKey));
    const others = teachers.filter(t => !teacherSections[t.teacherId]?.has(activeKey));

    // Teaching load per teacher in this section
    const loadOf = (tid) => {
        const subj = assignments.filter(a => String(a.teacher?.teacherId) === String(tid) &&
            secClasses.some(c => String(c.classId) === String(a.schoolClass?.classId)));
        const classTeacherOf = secClasses.filter(c => String(c.classTeacher?.teacherId) === String(tid));
        return { subj, classTeacherOf };
    };

    const teacherOptions = (
        <>
            {secTeachers.length > 0 && <optgroup label={`In ${section.title}`}>{secTeachers.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{t.firstName} {t.lastName}</option>)}</optgroup>}
            {others.length > 0 && <optgroup label="Other teachers">{others.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{t.firstName} {t.lastName}</option>)}</optgroup>}
        </>
    );

    const counts = SECTION_INFO.map(s => ({ ...s, n: teachers.filter(t => teacherSections[t.teacherId]?.has(s.key)).length }));

    return (
        <div>
            <div style={secStyles.tabs} role="tablist">
                {counts.map(s => {
                    const active = s.key === activeKey;
                    return (
                        <button key={s.key} role="tab" aria-selected={active} onClick={() => setActiveKey(s.key)}
                            style={{ ...secStyles.tab, borderColor: s.color, backgroundColor: active ? s.color : 'white', color: active ? 'white' : s.color }}>
                            {s.title}<span style={{ ...secStyles.count, backgroundColor: active ? 'rgba(255,255,255,0.25)' : s.color + '22' }}>{s.n}</span>
                        </button>
                    );
                })}
            </div>

            {unplaced.length > 0 && (
                <div style={secStyles.unplaced}>
                    <strong><Icon name="person-dash-fill" />Not in any section yet ({unplaced.length}):</strong>{' '}
                    {unplaced.map(t => `${t.firstName} ${t.lastName}`).join(', ')}
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Make them a class teacher (Pre-School / Lower Primary) or give them subjects (Upper Primary / Junior) below.</div>
                </div>
            )}

            <div style={{ ...secStyles.banner, backgroundColor: section.color }}>
                <div>
                    <h3 style={secStyles.bannerTitle}>{section.title}</h3>
                    <p style={secStyles.bannerSub}>
                        {section.mode === 'class'
                            ? 'Class-based: each class teacher teaches all subjects in their class.'
                            : 'Subject-based: choose a teacher for each subject in each class.'}
                    </p>
                </div>
                <span style={secStyles.bannerBadge}><Icon name="people-fill" />{secTeachers.length} teacher(s)</span>
            </div>

            {/* Teachers in this section, with their load */}
            {secTeachers.length > 0 && (
                <div style={secStyles.panel}>
                    <div style={secStyles.chips}>
                        {secTeachers.map(t => {
                            const { subj, classTeacherOf } = loadOf(t.teacherId);
                            const subjectNames = [...new Set(subj.map(a => a.subject?.subjectName))];
                            return (
                                <div key={t.teacherId} style={secStyles.chip}>
                                    <strong style={{ color: '#1F3864' }}>{t.firstName} {t.lastName}</strong>
                                    <div style={secStyles.chipMeta}>
                                        {classTeacherOf.length > 0 && <div><Icon name="house-door" style={{ marginRight: '3px' }} />Class teacher: {classTeacherOf.map(classDisplayName).join(', ')}</div>}
                                        {subj.length > 0 && <div><Icon name="book" style={{ marginRight: '3px' }} />{subjectNames.join(', ')} · {subj.length} class{subj.length !== 1 ? 'es' : ''}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {secClasses.length === 0 ? (
                <div style={secStyles.panel}><p style={{ color: '#888', textAlign: 'center', margin: 0 }}>No {section.title} classes yet.</p></div>
            ) : section.mode === 'class' ? (
                /* ── Class-based sections ── */
                <div style={secStyles.panel}>
                    <table style={secStyles.table}>
                        <thead><tr><th style={secStyles.th}>Class</th><th style={secStyles.th}>Class Teacher (teaches all subjects)</th></tr></thead>
                        <tbody>
                            {secClasses.map((c, i) => (
                                <tr key={c.classId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={secStyles.td}><strong>{classDisplayName(c)}</strong></td>
                                    <td style={secStyles.td}>
                                        <select style={{ ...secStyles.select, borderColor: c.classTeacher ? '#ddd' : '#dc3545' }}
                                            value={c.classTeacher?.teacherId != null ? String(c.classTeacher.teacherId) : ''}
                                            disabled={busyKey === `class_${c.classId}`}
                                            onChange={e => onSetClassTeacher(c, e.target.value)}
                                            aria-label={`Class teacher for ${classDisplayName(c)}`}>
                                            <option value="">{c.classTeacher ? '— Remove teacher —' : 'No teacher — choose…'}</option>
                                            {teacherOptions}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : assignmentsState === 'missing' ? (
                <div style={secStyles.warn}>
                    <Icon name="exclamation-triangle-fill" />Subject teachers need the new <strong>TeachingAssignment</strong> backend files (entity, repository, controller). Add them to Spring Boot, restart, then <button onClick={onRetry} style={secStyles.linkBtn}>try again</button>.
                </div>
            ) : assignmentsState === 'error' ? (
                <div style={secStyles.warn}><Icon name="exclamation-triangle-fill" />Couldn't load subject-teacher assignments. <button onClick={onRetry} style={secStyles.linkBtn}>Retry</button></div>
            ) : (
                /* ── Subject-based sections: one grid per grade ── */
                section.grades.map(g => {
                    const streams = secClasses.filter(c => secGradeOf(c) === g);
                    if (!streams.length) return null;
                    const loaded = streams.every(c => classSubjects[c.classId]);
                    const subjMap = {};
                    streams.forEach(c => (classSubjects[c.classId] || []).forEach(s => { subjMap[s.subjectId] = s; }));
                    const subjects = Object.values(subjMap).sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName)));
                    const slots = streams.reduce((n, c) => n + (classSubjects[c.classId] || []).length, 0);
                    const filled = streams.reduce((n, c) => n + (classSubjects[c.classId] || []).filter(s => assignmentMap[aKey(c.classId, s.subjectId)]).length, 0);
                    return (
                        <div key={g} style={secStyles.panel}>
                            <div style={secStyles.gradeHead}>
                                <strong style={{ color: '#1F3864', fontSize: '15px' }}>{g}</strong>
                                {loaded && slots > 0 && (
                                    <span style={{ ...secStyles.cover, backgroundColor: filled === slots ? '#d4edda' : '#fff3cd', color: filled === slots ? '#155724' : '#856404' }}>
                                        <Icon name={filled === slots ? 'check-circle-fill' : 'exclamation-circle-fill'} style={{ marginRight: '4px' }} />
                                        {filled} of {slots} subject slots have a teacher
                                    </span>
                                )}
                            </div>
                            {!loaded ? <p style={{ color: '#888' }}><Icon name="hourglass-split" />Loading subjects…</p> : subjects.length === 0 ? (
                                <p style={{ color: '#888', margin: 0 }}>No subjects set up for {g}. Add them on the Class Subjects page.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ ...secStyles.table, minWidth: `${140 + streams.length * 190}px` }}>
                                        <thead>
                                            <tr>
                                                <th style={secStyles.th}>Subject</th>
                                                {streams.map(c => (
                                                    <th key={c.classId} style={secStyles.th}>
                                                        {classDisplayName(c)}
                                                        <div style={secStyles.thSub}>Class teacher: {c.classTeacher ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}` : '—'}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjects.map((s, i) => (
                                                <tr key={s.subjectId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                                    <td style={secStyles.td}><strong>{s.subjectName}</strong><div style={secStyles.code}>{s.subjectCode}</div></td>
                                                    {streams.map(c => {
                                                        const takes = (classSubjects[c.classId] || []).some(x => String(x.subjectId) === String(s.subjectId));
                                                        if (!takes) return <td key={c.classId} style={{ ...secStyles.td, color: '#bbb', textAlign: 'center' }}>not taken</td>;
                                                        const a = assignmentMap[aKey(c.classId, s.subjectId)];
                                                        const k = `subj_${c.classId}_${s.subjectId}`;
                                                        return (
                                                            <td key={c.classId} style={secStyles.td}>
                                                                <select style={{ ...secStyles.select, borderColor: a ? '#28a745' : '#ffc107', backgroundColor: a ? '#f3fbf5' : 'white' }}
                                                                    value={a ? String(a.teacher?.teacherId) : ''} disabled={busyKey === k}
                                                                    onChange={e => onSetSubjectTeacher(c, s, e.target.value, streams)}
                                                                    aria-label={`${s.subjectName} teacher for ${classDisplayName(c)}`}>
                                                                    <option value="">{a ? '— Remove —' : 'Choose teacher…'}</option>
                                                                    {teacherOptions}
                                                                </select>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

const secStyles = {
    tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
    tab: { border: '2px solid', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
    count: { padding: '1px 8px', borderRadius: '10px', fontSize: '11px' },
    unplaced: { backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#856404', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px' },
    banner: { borderRadius: '14px', padding: '14px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
    bannerTitle: { color: 'white', margin: '0 0 3px', fontSize: '18px', fontWeight: 700 },
    bannerSub: { color: 'rgba(255,255,255,0.92)', margin: 0, fontSize: '13px' },
    bannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '16px 18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    chips: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    chip: { border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', backgroundColor: '#fafbfc', minWidth: '180px' },
    chipMeta: { fontSize: '12px', color: '#555', marginTop: '3px', lineHeight: 1.5 },
    gradeHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' },
    cover: { padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '9px 10px', textAlign: 'left', fontSize: '12px', verticalAlign: 'top' },
    thSub: { fontWeight: 'normal', fontSize: '10px', opacity: 0.85, marginTop: '2px' },
    td: { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    code: { fontSize: '10px', color: '#999', fontFamily: 'monospace' },
    select: { width: '100%', padding: '7px 8px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px', backgroundColor: 'white' },
    warn: { backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#856404', padding: '12px 16px', borderRadius: '10px', fontSize: '13px' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0 },
};

function Teachers() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyClassId, setBusyClassId] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [activeTab, setActiveTab] = useState('sections');
    const [newLogin, setNewLogin] = useState(null);   // shown once after a new teacher login is created
    const [assignments, setAssignments] = useState([]);
    const [assignmentsState, setAssignmentsState] = useState('loading'); // loading | ok | missing | error
    const [classSubjects, setClassSubjects] = useState({});
    const [busyKey, setBusyKey] = useState('');
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);

    const sections = [...SECTIONS_LIVE, { value: 'OTHER', label: 'Other classes (no section or grade set)', color: '#6c757d' }];

    useEffect(() => {
        fetchTeachers(); fetchClasses(); fetchAssignments();
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError('');
        setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3000);
    };

    const fetchTeachers = async () => {
        try {
            const response = await api.get('/api/teachers');
            setTeachers([...(response.data || [])].sort((a, b) => fullName(a).localeCompare(fullName(b))));
        } catch (err) { setError('Failed to load teachers. Check your connection and refresh.'); }
        setLoading(false);
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data || []);
        } catch (err) { setError('Failed to load classes. Check your connection and refresh.'); }
    };

    const q = norm(search);
    const qPhone = phoneKey(search);
    const filtered = teachers.filter(t => !q ||
        norm(fullName(t)).includes(q) || norm(`${t.lastName} ${t.firstName}`).includes(q) ||
        norm(t.email).includes(q) || (qPhone.length >= 3 && phoneKey(t.phone).includes(qPhone)));

    const resetForm = () => setFormData(EMPTY_FORM);

    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setEditingTeacher(null);
        resetForm(); // never carry over the teacher that was being edited
        setShowAddForm(true);
        setActiveTab('teachers');
    };

    const handleEdit = (teacher) => {
        if (editingTeacher?.teacherId === teacher.teacherId) { handleCancelEdit(); return; }
        setEditingTeacher(teacher);
        setFormData({ firstName: teacher.firstName || '', lastName: teacher.lastName || '', email: teacher.email || '', phone: teacher.phone || '' });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingTeacher(null); resetForm(); };

    // Trim everything; checks phone format and that the phone isn't someone else's
    const validated = (exceptId) => {
        const data = {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phone: formData.phone.trim().replace(/\s+/g, ''),
            email: formData.email.trim().toLowerCase() || null
        };
        const digits = data.phone.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 13) return { problem: 'Please enter a valid phone number (e.g. 0712345678).' };
        const clash = teachers.find(t => String(t.teacherId) !== String(exceptId ?? '') && phoneKey(t.phone) === phoneKey(data.phone));
        if (clash) return { problem: `Phone ${data.phone} already belongs to ${fullName(clash)}.` };
        if (data.email) {
            const emailClash = teachers.find(t => String(t.teacherId) !== String(exceptId ?? '') && norm(t.email) === data.email);
            if (emailClash) return { problem: `Email ${data.email} already belongs to ${fullName(emailClash)}.` };
        }
        return { data };
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const { data, problem } = validated();
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.post('/api/teachers', data);
            flashSuccess(`${fullName(data)} added!`);
            setShowAddForm(false);
            resetForm();
            fetchTeachers();
        } catch (err) { setError(serverMessage(err, 'Failed to add teacher. The phone number may already be in use.')); }
        setSaving(false);
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const { data, problem } = validated(editingTeacher.teacherId);
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.put(`/api/teachers/${editingTeacher.teacherId}`, data);
            flashSuccess(`${fullName(data)} updated!`);
            handleCancelEdit();
            fetchTeachers(); fetchClasses(); // class cards show the teacher's name
        } catch (err) { setError(serverMessage(err, 'Failed to update teacher.')); }
        setSaving(false);
    };

    const getTeacherClasses = (teacherId) =>
        classes.filter(c => String(c.classTeacher?.teacherId) === String(teacherId));

    const handleDelete = async (teacher) => {
        const their = getTeacherClasses(teacher.teacherId);
        const note = their.length ? `\n\nThey are class teacher of ${their.map(classDisplayName).join(', ')} — that class will be left without a teacher.` : '';
        if (!window.confirm(`Delete ${fullName(teacher)}?${note}\n\nThis cannot be undone.`)) return;
        setError('');
        try {
            await api.delete(`/api/teachers/${teacher.teacherId}`);
            if (editingTeacher?.teacherId === teacher.teacherId) handleCancelEdit();
            flashSuccess(`${fullName(teacher)} deleted`);
            fetchTeachers(); fetchClasses();
        } catch (err) {
            const status = err.response?.status;
            setError(status === 409 || status === 500
                ? serverMessage(err, `${fullName(teacher)} could not be deleted — they may still be linked to subjects or a user account.`)
                : serverMessage(err, 'Failed to delete teacher'));
        }
    };

    const fetchAssignments = async () => {
        try {
            const r = await api.get('/api/teaching-assignments');
            setAssignments(r.data || []); setAssignmentsState('ok');
        } catch (err) {
            // 404 = the new backend files haven't been added yet
            setAssignmentsState(err.response?.status === 404 ? 'missing' : 'error');
        }
    };

    // Subjects of Upper Primary & Junior classes (needed for the subject-teacher grid).
    // Pre-School & Lower Primary don't need this: their class teacher teaches every subject.
    useEffect(() => {
        const need = classes.filter(c => SECTION_INFO.find(s => s.key === secKeyOf(c))?.mode === 'subject' && !classSubjects[c.classId]);
        if (!need.length) return;
        Promise.allSettled(need.map(c => api.get(`/api/class-subjects/by-class/${c.classId}`))).then(outs => {
            setClassSubjects(prev => {
                const next = { ...prev };
                outs.forEach((o, i) => { next[need[i].classId] = o.status === 'fulfilled' ? (o.value.data || []).map(cs => cs.subject).filter(Boolean) : []; });
                return next;
            });
        });
    }, [classes]);

    const setSubjectTeacher = async (cls, subject, teacherId, gradeStreams) => {
        const key = `subj_${cls.classId}_${subject.subjectId}`;
        setBusyKey(key); setError('');
        try {
            if (!teacherId) {
                await api.delete(`/api/teaching-assignments/class/${cls.classId}/subject/${subject.subjectId}`);
                flashSuccess(`${subject.subjectName} in ${classDisplayName(cls)} no longer has a teacher`);
                await fetchAssignments();
                return;
            }
            await api.put(`/api/teaching-assignments/class/${cls.classId}/subject/${subject.subjectId}/teacher/${teacherId}`);
            const teacher = teachers.find(t => String(t.teacherId) === String(teacherId));
            const fresh = (await api.get('/api/teaching-assignments')).data || [];
            setAssignments(fresh);
            // Offer the same teacher for the other streams of the grade that have no teacher yet
            const empty = (gradeStreams || []).filter(c => c.classId !== cls.classId &&
                (classSubjects[c.classId] || []).some(s => String(s.subjectId) === String(subject.subjectId)) &&
                !fresh.some(a => String(a.schoolClass?.classId) === String(c.classId) && String(a.subject?.subjectId) === String(subject.subjectId)));
            let extra = false;
            if (empty.length && window.confirm(`${teacher.firstName} ${teacher.lastName} now teaches ${subject.subjectName} in ${classDisplayName(cls)}.\n\nAlso give them ${subject.subjectName} in ${empty.map(classDisplayName).join(', ')}?`)) {
                const outs = await Promise.allSettled(empty.map(c => api.put(`/api/teaching-assignments/class/${c.classId}/subject/${subject.subjectId}/teacher/${teacherId}`)));
                const failed = outs.filter(o => o.status === 'rejected').length;
                if (failed) setError(`${failed} of the other streams could not be assigned.`);
                extra = failed < empty.length;
                await fetchAssignments();
            }
            flashSuccess(`${teacher.firstName} ${teacher.lastName} teaches ${subject.subjectName} in ${classDisplayName(cls)}${extra ? ' and the other streams' : ''}`);
        } catch (err) {
            setError(serverMessage(err, 'Failed to save the subject teacher'));
        } finally { setBusyKey(''); }
    };

    const setClassTeacherFromSection = async (cls, teacherId) => {
        setBusyKey(`class_${cls.classId}`);
        try {
            if (!teacherId) { if (cls.classTeacher) await handleUnassignTeacher(cls); }
            else await handleAssignTeacher(cls, teacherId);
        } finally { setBusyKey(''); }
    };

    const handleAssignTeacher = async (cls, teacherId) => {
        if (!teacherId) return;
        const teacher = teachers.find(t => String(t.teacherId) === String(teacherId));
        const already = getTeacherClasses(teacherId);
        if (already.length && !window.confirm(
            `${fullName(teacher)} is already class teacher of ${already.map(classDisplayName).join(', ')}.\n\n` +
            `Also make them class teacher of ${classDisplayName(cls)}? A teacher's login is linked to one class, so they may only see one of these when entering marks.`)) return;
        setBusyClassId(cls.classId); setError('');
        try {
            const r = await api.patch(`/api/classes/${cls.classId}/assign-teacher/${teacherId}`);
            await fetchClasses();
            flashSuccess(`${fullName(teacher)} is now class teacher of ${classDisplayName(cls)}`);
            if (r.data?.newLogin) setNewLogin({ ...r.data.newLogin, teacherName: fullName(teacher) });
        } catch (err) { setError(serverMessage(err, 'Failed to assign class teacher')); }
        setBusyClassId(null);
    };

    const handleUnassignTeacher = async (cls) => {
        if (!window.confirm(`Remove ${fullName(cls.classTeacher)} as class teacher of ${classDisplayName(cls)}?`)) return;
        setBusyClassId(cls.classId); setError('');
        try {
            await api.patch(`/api/classes/${cls.classId}/unassign-teacher`);
            await fetchClasses();
            flashSuccess(`${classDisplayName(cls)} no longer has a class teacher`);
        } catch (err) { setError(serverMessage(err, 'Failed to remove class teacher')); }
        setBusyClassId(null);
    };

    // Group classes by section; anything without a known section/grade goes to "Other" so it's never hidden
    const groupedClasses = sections.map(sec => ({
        ...sec,
        classes: classes
            .filter(c => sec.value === 'OTHER'
                ? !(c.section && c.gradeLevel && sections.some(s => s.value === c.section && s.value !== 'OTHER'))
                : c.section === sec.value && c.gradeLevel)
            .sort((a, b) => gradeIdx(a.gradeLevel) - gradeIdx(b.gradeLevel) || classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }))
    })).filter(sec => sec.classes.length > 0);

    const unassignedTeachers = teachers.filter(t => getTeacherClasses(t.teacherId).length === 0);
    const assignedTeachers = teachers.filter(t => getTeacherClasses(t.teacherId).length > 0);
    const totalAssigned = classes.filter(c => c.classTeacher).length;
    const totalUnassigned = classes.length - totalAssigned;

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}><Icon name="person-workspace" style={{ marginRight: '10px' }} />Teachers</h2>
                        <p style={styles.subtitle}>Manage teacher records and class assignments</p>
                    </div>
                    <button onClick={toggleAddForm} style={styles.addBtn}>
                        {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="person-plus-fill" />Add Teacher</>}
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
                        <h3 style={styles.formTitle}><Icon name="person-plus-fill" />Add New Teacher</h3>
                        <TeacherFormFields
                            formData={formData} setFormData={setFormData}
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); resetForm(); }}
                            submitLabel="Save Teacher" submitIcon="save-fill" saving={saving}
                        />
                    </div>
                )}

                <div style={styles.tabs}>
                    {[
                        { id: 'sections', icon: 'diagram-3-fill', label: 'By Section' },
                        { id: 'teachers', icon: 'people-fill', label: `All Teachers (${teachers.length})` },
                        { id: 'assignments', icon: 'building', label: `Class Assignments${totalUnassigned ? ` (${totalUnassigned} need a teacher)` : ''}` }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            ...styles.tab,
                            backgroundColor: activeTab === tab.id ? '#1F3864' : 'white',
                            color: activeTab === tab.id ? 'white' : '#1F3864'
                        }}>
                            <Icon name={tab.icon} />{tab.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB 1: All Teachers ── */}
                {activeTab === 'sections' && (
                    <SectionsView classes={classes} teachers={teachers} assignments={assignments}
                        assignmentsState={assignmentsState} classSubjects={classSubjects} busyKey={busyKey}
                        onSetClassTeacher={setClassTeacherFromSection} onSetSubjectTeacher={setSubjectTeacher}
                        onRetry={() => { setAssignmentsState('loading'); fetchAssignments(); }} />
                )}

                {activeTab === 'teachers' && (
                    <>
                        <div style={styles.searchBar}>
                            <div style={styles.searchBox}>
                                <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                <input style={styles.searchInput} placeholder="Search by name, phone or email..."
                                    value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <button onClick={() => setSearch('')} style={styles.clearBtn}><Icon name="arrow-counterclockwise" />Clear</button>
                        </div>

                        {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading teachers...</p> : (
                            <div style={styles.tableWrapper}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={styles.tableHeader}>
                                            <th style={styles.th}>#</th>
                                            <th style={styles.th}>First Name</th>
                                            <th style={styles.th}>Last Name</th>
                                            <th style={styles.th}>Phone</th>
                                            <th style={styles.th}>Email</th>
                                            <th style={styles.th}>Class Teacher Of</th>
                                            <th style={styles.th}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((teacher, index) => {
                                            const assignedClasses = getTeacherClasses(teacher.teacherId);
                                            const isEditing = editingTeacher?.teacherId === teacher.teacherId;
                                            return (
                                                <React.Fragment key={teacher.teacherId}>
                                                    <tr style={{ backgroundColor: isEditing ? '#e3f2fd' : index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                                                        <td style={styles.td}>{index + 1}</td>
                                                        <td style={styles.td}><strong>{teacher.firstName}</strong></td>
                                                        <td style={styles.td}>{teacher.lastName}</td>
                                                        <td style={styles.td}>
                                                            {teacher.phone
                                                                ? <a href={`tel:${teacher.phone}`} style={styles.phoneBadge}>{teacher.phone}</a>
                                                                : <span style={styles.noEmail}>—</span>}
                                                        </td>
                                                        <td style={styles.td}>{teacher.email || <span style={styles.noEmail}>Not provided</span>}</td>
                                                        <td style={styles.td}>
                                                            {assignedClasses.length > 0
                                                                ? assignedClasses.map(c => <span key={c.classId} style={styles.classBadge}>{classDisplayName(c)}</span>)
                                                                : <span style={styles.unassignedBadge}>None</span>}
                                                        </td>
                                                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                                            <button onClick={() => handleEdit(teacher)} style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                                {isEditing ? <><Icon name="x-lg" style={{ marginRight: '4px' }} />Close</> : <><Icon name="pencil-fill" style={{ marginRight: '4px' }} />Edit</>}
                                                            </button>
                                                            <button onClick={() => handleDelete(teacher)} style={styles.deleteBtn}>
                                                                <Icon name="trash-fill" style={{ marginRight: '4px' }} />Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isEditing && (
                                                        <tr>
                                                            <td colSpan="7" style={styles.inlineEditTd}>
                                                                <div style={styles.inlineEditCard}>
                                                                    <div style={styles.inlineEditHeader}>
                                                                        <h4 style={styles.inlineEditTitle}><Icon name="pencil-fill" />Editing: {fullName(teacher)}</h4>
                                                                        <button onClick={handleCancelEdit} style={styles.closeBtn} aria-label="Close"><i className="bi bi-x-lg" /></button>
                                                                    </div>
                                                                    <TeacherFormFields
                                                                        formData={formData} setFormData={setFormData}
                                                                        onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                                        submitLabel="Update Teacher" submitIcon="check-circle-fill" saving={saving}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                                                <Icon name="inbox" />{search ? `No teachers match "${search}"` : 'No teachers yet — click Add Teacher.'}
                                            </td></tr>
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
                        <div style={styles.summaryRow}>
                            {[
                                { num: totalAssigned, label: 'Classes with Teacher', color: '#28a745', icon: 'check-circle-fill' },
                                { num: totalUnassigned, label: 'Classes without Teacher', color: '#dc3545', icon: 'exclamation-circle-fill' },
                                { num: unassignedTeachers.length, label: 'Teachers without Class', color: '#2E75B6', icon: 'person-dash-fill' }
                            ].map((item, i) => (
                                <div key={i} style={{ ...styles.summaryCard, borderTop: `4px solid ${item.color}` }}>
                                    <span style={{ ...styles.summaryNum, color: item.color }}><Icon name={item.icon} style={{ fontSize: '20px' }} />{item.num}</span>
                                    <span style={styles.summaryLabel}>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {unassignedTeachers.length > 0 && (
                            <div style={styles.poolCard}>
                                <h4 style={styles.poolTitle}><Icon name="people-fill" />Teachers Without a Class</h4>
                                <div style={styles.poolTiles}>
                                    {unassignedTeachers.map(t => (
                                        <div key={t.teacherId} style={styles.poolTile}>
                                            <Icon name="person-fill" style={{ marginRight: 0 }} />{fullName(t)}
                                            <span style={styles.poolPhone}>{t.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {groupedClasses.length === 0 && (
                            <div style={styles.emptyState}><Icon name="building" style={{ fontSize: '40px', color: '#BDD7EE', marginRight: 0 }} /><p>No classes yet. Create classes first.</p></div>
                        )}

                        {groupedClasses.map(section => (
                            <div key={section.value} style={styles.sectionBlock}>
                                <div style={{ ...styles.sectionHeader, backgroundColor: section.color }}>
                                    <span style={styles.sectionLabel}>{section.label}</span>
                                    <span style={styles.sectionMeta}>{section.classes.length} class(es)</span>
                                </div>
                                <div style={styles.classGrid}>
                                    {section.classes.map(cls => {
                                        const busy = busyClassId === cls.classId;
                                        return (
                                            <div key={cls.classId} style={{ ...styles.classCard, borderLeft: `4px solid ${cls.classTeacher ? '#28a745' : '#dc3545'}` }}>
                                                <div style={styles.classCardTop}>
                                                    <span style={styles.classCardName}>{classDisplayName(cls)}</span>
                                                    <span style={{ ...styles.statusDot, backgroundColor: cls.classTeacher ? '#28a745' : '#dc3545' }}>
                                                        <Icon name={cls.classTeacher ? 'check-circle-fill' : 'x-circle-fill'} style={{ marginRight: '4px' }} />
                                                        {cls.classTeacher ? 'Assigned' : 'Unassigned'}
                                                    </span>
                                                </div>
                                                {cls.classTeacher ? (
                                                    <div style={styles.assignedRow}>
                                                        <span style={styles.assignedName} title={fullName(cls.classTeacher)}>
                                                            <Icon name="person-workspace" />{fullName(cls.classTeacher)}
                                                        </span>
                                                        <button onClick={() => handleUnassignTeacher(cls)} style={styles.unassignBtn} disabled={busy}
                                                            title="Remove teacher from this class">
                                                            {busy ? <Icon name="hourglass-split" style={{ marginRight: 0 }} /> : <><Icon name="x-lg" style={{ marginRight: '4px' }} />Remove</>}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select style={styles.assignSelect} value="" disabled={busy || teachers.length === 0}
                                                        onChange={e => handleAssignTeacher(cls, e.target.value)}
                                                        aria-label={`Assign a class teacher to ${classDisplayName(cls)}`}>
                                                        <option value="" disabled>{busy ? 'Assigning…' : teachers.length ? '— Assign a Teacher —' : 'Add teachers first'}</option>
                                                        {unassignedTeachers.length > 0 && (
                                                            <optgroup label="Available (no class yet)">
                                                                {unassignedTeachers.map(t => <option key={t.teacherId} value={t.teacherId}>{fullName(t)} ({t.phone})</option>)}
                                                            </optgroup>
                                                        )}
                                                        {assignedTeachers.length > 0 && (
                                                            <optgroup label="Already class teachers">
                                                                {assignedTeachers.map(t => (
                                                                    <option key={t.teacherId} value={t.teacherId}>
                                                                        {fullName(t)} — {getTeacherClasses(t.teacherId).map(classDisplayName).join(', ')}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                )}
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
        <Footer />
            <TempPasswordNotice login={newLogin} onClose={() => setNewLogin(null)} />
    </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex' },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '10px 15px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center', whiteSpace: 'pre-line' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '10px 15px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },

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
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '5px' },
    requiredTag: { backgroundColor: '#dc3545', color: 'white', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 'normal' },
    optionalTag: { backgroundColor: '#6c757d', color: 'white', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 'normal' },
    input: { padding: '9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },

    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #1F3864', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' },

    tableWrapper: { overflowX: 'auto', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '700px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '12px 15px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #eee', fontSize: '13px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    phoneBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', textDecoration: 'none' },
    noEmail: { color: '#999', fontStyle: 'italic', fontSize: '12px' },
    classBadge: { backgroundColor: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginRight: '4px', display: 'inline-block' },
    unassignedBadge: { color: '#999', fontStyle: 'italic', fontSize: '12px' },

    summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' },
    summaryCard: { backgroundColor: 'white', padding: '15px 20px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' },
    summaryNum: { fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    summaryLabel: { fontSize: '13px', color: '#666' },

    poolCard: { backgroundColor: 'white', padding: '15px 20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    poolTitle: { color: '#1F3864', margin: '0 0 10px 0', fontSize: '15px' },
    poolTiles: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    poolTile: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '8px 15px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
    poolPhone: { fontSize: '11px', color: '#856404', fontFamily: 'monospace' },

    sectionBlock: { marginBottom: '20px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    sectionHeader: { padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '14px' },
    sectionMeta: { color: 'rgba(255,255,255,0.85)', fontSize: '12px' },
    classGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', padding: '15px', backgroundColor: 'white' },
    classCard: { backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
    classCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '5px' },
    classCardName: { fontWeight: 'bold', color: '#1F3864', fontSize: '15px' },
    statusDot: { color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    assignSelect: { padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', backgroundColor: 'white' },
    assignedRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#e8f5e9', borderRadius: '8px', padding: '6px 10px' },
    assignedName: { fontSize: '12px', color: '#1b5e20', fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    unassignBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 },

    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default Teachers;
