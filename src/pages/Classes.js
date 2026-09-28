import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import TempPasswordNotice from '../components/TempPasswordNotice';
import { SECTIONS_LIVE, GRADE_ORDER_LIVE, STREAMS_LIVE, GRADE_LABELS_LIVE, STREAM_NAMES_LIVE, STREAM_COLORS_LIVE, gradeFromClassName, textOn } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

// Sections, grades and streams come from School Settings
const SECTIONS = SECTIONS_LIVE;
const GRADE_ORDER = GRADE_ORDER_LIVE;
const STREAMS = STREAMS_LIVE;
const EMPTY_FORM = { className: '', stream: '', gradeLevel: '', section: '', meanTarget: '', autoName: true };

const GRADE_LABELS = GRADE_LABELS_LIVE;
const gradeLabel = (g) => GRADE_LABELS[g] || g || 'Unknown grade';
const streamLabel = (s) => STREAM_NAMES_LIVE[String(s || '').toUpperCase()] || s || '';
const streamColor = (s) => STREAM_COLORS_LIVE[String(s || '').toUpperCase()] || '#1F3864';
const sectionOf = (key) => SECTIONS.find(s => s.value === key);
const sectionColor = (key) => sectionOf(key)?.color || '#6c757d';
const autoNameFor = (grade, stream) => grade ? `${grade}${stream ? stream.charAt(0).toUpperCase() : ''}` : '';
const classTitle = (cls) => `${gradeLabel(cls.gradeLevel)}${cls.stream ? ` ${streamLabel(cls.stream)}` : ''}`;
const isMale = (g) => String(g || '').toLowerCase().startsWith('m');
const isFemale = (g) => String(g || '').toLowerCase().startsWith('f');
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

const extractGrade = (className) => gradeFromClassName(className);
const extractSection = (grade) => SECTIONS.find(s => s.grades.includes(grade))?.value || '';
const gradeOfClass = (c) => c.gradeLevel || extractGrade(c.className);
const sectionOfClass = (c) => c.section || extractSection(gradeOfClass(c));

// Outside parent — prevents keyboard dismiss on mobile
const ClassFormFields = ({ formData, setFormData, onSubmit, onCancel, submitLabel, submitIcon, saving, isEdit, originalName }) => {
    const section = sectionOf(formData.section);
    const suggested = autoNameFor(formData.gradeLevel, formData.stream);

    const handleSectionChange = (value) => {
        const s = sectionOf(value);
        setFormData(prev => ({ ...prev, section: value, meanTarget: s ? String(s.target) : '', gradeLevel: '', className: prev.autoName ? '' : prev.className, stream: '' }));
    };
    // Auto-name only while the user hasn't typed their own name
    const handleGradeChange = (value) => setFormData(prev => ({ ...prev, gradeLevel: value, className: prev.autoName ? autoNameFor(value, prev.stream) : prev.className }));
    const handleStreamChange = (value) => setFormData(prev => ({ ...prev, stream: value, className: prev.autoName ? autoNameFor(prev.gradeLevel, value) : prev.className }));

    return (
        <form onSubmit={onSubmit}>
            <div style={styles.stepGuide}>
                {['Section', 'Grade', 'Stream', 'Name fills in'].map((s, i) => (
                    <React.Fragment key={s}>
                        {i > 0 && <i className="bi bi-chevron-right" aria-hidden="true" style={styles.stepArrow} />}
                        <span style={styles.step}><span style={styles.stepNum}>{i + 1}</span>{s}</span>
                    </React.Fragment>
                ))}
            </div>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Section</label>
                    <select style={styles.input} value={formData.section} onChange={e => handleSectionChange(e.target.value)} required>
                        <option value="">Select Section</option>
                        {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Grade Level</label>
                    <select style={styles.input} value={formData.gradeLevel} onChange={e => handleGradeChange(e.target.value)} required disabled={!formData.section}>
                        <option value="">{formData.section ? 'Select Grade' : 'Select Section first'}</option>
                        {section?.grades.map(g => <option key={g} value={g}>{g} — {gradeLabel(g)}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Stream <span style={styles.optionalTag}>Optional</span></label>
                    <select style={styles.input} value={formData.stream} onChange={e => handleStreamChange(e.target.value)} disabled={!formData.gradeLevel}>
                        <option value="">No Stream (single class)</option>
                        {STREAMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Class Name {formData.autoName && <span style={styles.autoTag}>Auto</span>}</label>
                    <input style={{ ...styles.input, backgroundColor: formData.autoName ? '#e3f2fd' : 'white', fontWeight: 'bold' }}
                        value={formData.className} maxLength={20}
                        onChange={e => setFormData(prev => ({ ...prev, className: e.target.value.toUpperCase(), autoName: false }))}
                        placeholder="Fills in automatically" required />
                    {!formData.autoName && suggested && formData.className !== suggested && (
                        <button type="button" style={styles.linkBtn} onClick={() => setFormData(prev => ({ ...prev, className: suggested, autoName: true }))}>
                            Use suggested name ({suggested})
                        </button>
                    )}
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Mean Target (%)</label>
                    <input type="number" min="1" max="100" step="0.5" style={styles.input}
                        value={formData.meanTarget}
                        onChange={e => setFormData(prev => ({ ...prev, meanTarget: e.target.value }))}
                        placeholder={section ? String(section.target) : '—'} required />
                    {section && String(section.target) !== String(formData.meanTarget) && formData.meanTarget !== '' && (
                        <span style={styles.fieldHint}>Section default is {section.target}%</span>
                    )}
                </div>
            </div>
            {isEdit && originalName && formData.className && formData.className !== originalName && (
                <p style={styles.warnNote}>
                    <Icon name="exclamation-triangle-fill" />Renaming <strong>{originalName}</strong> to <strong>{formData.className}</strong>: Excel imports must then use the new name.
                </p>
            )}
            {formData.className && (
                <div style={styles.preview}>
                    <strong>Preview:</strong>
                    <span style={{ ...styles.previewBadge, backgroundColor: sectionColor(formData.section) }}>{formData.className}</span>
                    <span style={styles.previewDetail}>
                        {section?.label}
                        {formData.stream && ` • ${streamLabel(formData.stream)} stream`}
                        {formData.meanTarget && ` • Target ${formData.meanTarget}%`}
                    </span>
                </div>
            )}
            <div style={styles.btnGroup}>
                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                    <Icon name={saving ? 'hourglass-split' : submitIcon} />{saving ? 'Saving...' : submitLabel}
                </button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Cancel</button>
            </div>
        </form>
    );
};

function Classes() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyClassId, setBusyClassId] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);
    const latestClassRequest = useRef(null);
    const [newLogin, setNewLogin] = useState(null);   // shown once after a new teacher login is created

    // ── Where we are lives in the URL (?grade=G4&class=12), so the browser's
    //    Back/Forward buttons, refresh and shared links all keep your place ──
    const [searchParams, setSearchParams] = useSearchParams();
    const gradeParam = searchParams.get('grade') || '';
    const classParam = searchParams.get('class') || '';
    const selectedClass = classParam ? classes.find(c => String(c.classId) === classParam) || null : null;
    const selectedGrade = gradeParam
        ? { gradeLevel: gradeParam, section: extractSection(gradeParam) || (selectedClass ? sectionOfClass(selectedClass) : '') }
        : null;
    const view = classParam ? 'students' : gradeParam ? 'streams' : 'grades';

    const goTo = (params, replace = false) => {
        setEditingClass(null);
        setSearchParams(params, { replace });
    };
    const classParams = (cls) => {
        const g = gradeOfClass(cls);
        return g && sectionOf(sectionOfClass(cls)) ? { grade: g, class: String(cls.classId) } : { class: String(cls.classId) };
    };
    const hrefFor = (params) => { const q = new URLSearchParams(params).toString(); return q ? `/classes?${q}` : '/classes'; };
    // Normal click stays in the app; Ctrl/Cmd/middle-click opens a new tab
    const linkClick = (e, params) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); goTo(params);
    };

    useEffect(() => {
        fetchClasses(); fetchTeachers();
        return () => clearTimeout(successTimer.current);
    }, []);

    // Load a class's students whenever the URL points at one
    useEffect(() => {
        if (classParam) fetchStudentsByClass(classParam);
        else { latestClassRequest.current = null; setStudents([]); setLoadingStudents(false); }
    }, [classParam]);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3000);
    };

    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data || []); return r.data || []; }
        catch (err) { setError('Failed to load classes. Check your connection and refresh.'); return null; }
        finally { setLoading(false); }
    };
    const fetchTeachers = async () => {
        try {
            const r = await api.get('/api/teachers');
            setTeachers([...(r.data || [])].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
        } catch (e) { setError('Failed to load teachers — assigning class teachers won\'t work until you refresh.'); }
    };
    const fetchStudentsByClass = async (classId) => {
        classId = String(classId);
        latestClassRequest.current = classId;
        setLoadingStudents(true); setStudents([]);
        try {
            const r = await api.get('/api/students');
            if (latestClassRequest.current !== classId) return; // another class was opened meanwhile
            setStudents((r.data || []).filter(s => String(s.schoolClass?.classId) === String(classId)));
        } catch (err) { setError('Failed to load students'); }
        setLoadingStudents(false);
    };

    const resetForm = () => setFormData(EMPTY_FORM);

    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setEditingClass(null);
        // Adding from inside a grade: pre-select it
        const g = view !== 'grades' && selectedGrade ? selectedGrade : null;
        setFormData(g ? { ...EMPTY_FORM, section: g.section, gradeLevel: g.gradeLevel, meanTarget: String(sectionOf(g.section)?.target ?? ''), className: autoNameFor(g.gradeLevel, '') } : EMPTY_FORM);
        setShowAddForm(true);
    };

    const handleEdit = (cls) => {
        if (editingClass?.classId === cls.classId) { handleCancelEdit(); return; }
        const grade = gradeOfClass(cls);
        setEditingClass(cls);
        setFormData({
            className: cls.className || '', stream: cls.stream || '', gradeLevel: grade, section: sectionOfClass(cls),
            meanTarget: cls.meanTarget != null ? String(cls.meanTarget) : String(sectionOf(sectionOfClass(cls))?.target ?? ''),
            // keep the existing name; only auto-rename if it already follows the pattern
            autoName: cls.className === autoNameFor(grade, cls.stream)
        });
        setShowAddForm(false);
    };
    const handleCancelEdit = () => { setEditingClass(null); resetForm(); };

    const validate = (exceptId) => {
        const target = parseFloat(formData.meanTarget);
        if (isNaN(target) || target <= 0 || target > 100) return 'Mean target must be a number between 1 and 100.';
        const name = formData.className.trim();
        if (!name) return 'Class name is required.';
        const others = classes.filter(c => String(c.classId) !== String(exceptId ?? ''));
        const sameName = others.find(c => String(c.className).trim().toUpperCase() === name.toUpperCase());
        if (sameName) return `A class named ${name} already exists.`;
        const sameSlot = others.find(c => gradeOfClass(c) === formData.gradeLevel && String(c.stream || '') === String(formData.stream || ''));
        if (sameSlot) return `${classTitle({ gradeLevel: formData.gradeLevel, stream: formData.stream })} already exists (${sameSlot.className}).`;
        return null;
    };

    const payload = () => ({
        className: formData.className.trim(), stream: formData.stream || null,
        gradeLevel: formData.gradeLevel, section: formData.section, meanTarget: parseFloat(formData.meanTarget)
    });

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate();
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.post('/api/classes', payload());
            flashSuccess(`${formData.className} added!`);
            setShowAddForm(false); resetForm(); fetchClasses();
        } catch (err) { setError(`Failed to save class: ${serverMessage(err, err.message)}`); }
        setSaving(false);
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate(editingClass.classId);
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.put(`/api/classes/${editingClass.classId}`, payload());
            const editedId = String(editingClass.classId);
            const newGrade = formData.gradeLevel;
            const movedGrade = gradeParam && newGrade && newGrade !== gradeParam;
            flashSuccess(`${formData.className} updated!${movedGrade && !classParam ? ` It now appears under ${gradeLabel(newGrade)}.` : ''}`);
            handleCancelEdit();
            const fresh = await fetchClasses();
            if (fresh && classParam === editedId) {
                const updated = fresh.find(c => String(c.classId) === editedId);
                if (updated) goTo(classParams(updated), true); // breadcrumb follows the class to its new grade
            } else if (fresh && movedGrade && !fresh.some(c => gradeOfClass(c) === gradeParam)) {
                goTo({ grade: newGrade }, true);
            }
        } catch (err) { setError(`Failed to update class: ${serverMessage(err, err.message)}`); }
        setSaving(false);
    };

    const handleTeacherChange = async (cls, teacherId) => {
        if (String(teacherId) === String(cls.classTeacher?.teacherId ?? '')) return;
        setError('');
        if (!teacherId) {
            if (!window.confirm(`Remove ${cls.classTeacher.firstName} ${cls.classTeacher.lastName} as class teacher of ${cls.className}?`)) return;
            setBusyClassId(cls.classId);
            try { await api.patch(`/api/classes/${cls.classId}/unassign-teacher`); await fetchClasses(); flashSuccess(`${cls.className} no longer has a class teacher`); }
            catch (err) { setError(serverMessage(err, 'Failed to remove class teacher')); }
            setBusyClassId(null);
            return;
        }
        const teacher = teachers.find(t => String(t.teacherId) === String(teacherId));
        const already = classes.filter(c => c.classId !== cls.classId && String(c.classTeacher?.teacherId) === String(teacherId));
        if (already.length && !window.confirm(`${teacher.firstName} ${teacher.lastName} is already class teacher of ${already.map(c => c.className).join(', ')}.\n\nAlso make them class teacher of ${cls.className}?`)) return;
        setBusyClassId(cls.classId);
        try {
            const r = await api.patch(`/api/classes/${cls.classId}/assign-teacher/${teacherId}`);
            await fetchClasses();
            flashSuccess(`${teacher.firstName} ${teacher.lastName} is now class teacher of ${cls.className}`);
            if (r.data?.newLogin) setNewLogin({ ...r.data.newLogin, teacherName: `${teacher.firstName} ${teacher.lastName}` });
        }
        catch (err) { setError(serverMessage(err, 'Failed to assign teacher')); }
        setBusyClassId(null);
    };

    const handleDelete = async (cls) => {
        setError('');
        let count = null;
        try { count = ((await api.get('/api/students')).data || []).filter(s => String(s.schoolClass?.classId) === String(cls.classId)).length; } catch (e) { /* ignore */ }
        // A class with students can't be deleted (the server refuses) — say so up front
        if (count) {
            setError(`${cls.className} still has ${count} student(s). Move them to another class on the Students page first, then delete the class.`);
            return;
        }
        if (!window.confirm(`Delete class ${cls.className} (${classTitle(cls)})?\n\nThis cannot be undone.`)) return;
        setBusyClassId(cls.classId);
        try {
            await api.delete(`/api/classes/${cls.classId}`);
            if (editingClass?.classId === cls.classId) handleCancelEdit();
            const fresh = await fetchClasses();
            // Stay on the grade if it still has classes
            const gradeStillHasClasses = gradeParam && fresh && fresh.some(c => gradeOfClass(c) === gradeParam);
            if (classParam === String(cls.classId) || (gradeParam && !gradeStillHasClasses)) {
                goTo(gradeStillHasClasses ? { grade: gradeParam } : {}, true);
            }
            flashSuccess(`${cls.className} deleted`);
        } catch (err) {
            setError(serverMessage(err, `${cls.className} could not be deleted — it may still have students, subjects, marks or report cards linked to it.`));
        }
        setBusyClassId(null);
    };

    // ── Grouping ─────────────────────────────────────────────────────────────
    const gradesBySection = () => {
        const grouped = {};
        SECTIONS.forEach(s => { grouped[s.value] = {}; });
        classes.forEach(cls => {
            const grade = gradeOfClass(cls), sec = sectionOfClass(cls);
            if (!grade || !grouped[sec]) return;
            if (!grouped[sec][grade]) grouped[sec][grade] = { gradeLevel: grade, section: sec, classes: [] };
            grouped[sec][grade].classes.push(cls);
        });
        const out = {};
        Object.keys(grouped).forEach(k => {
            out[k] = Object.values(grouped[k]).sort((a, b) => GRADE_ORDER.indexOf(a.gradeLevel) - GRADE_ORDER.indexOf(b.gradeLevel));
        });
        return out;
    };
    // Classes whose grade/section can't be worked out would otherwise be invisible and impossible to fix
    const otherClasses = classes.filter(c => !gradeOfClass(c) || !sectionOf(sectionOfClass(c)));
    const getClassesForGrade = (gradeLevel) => classes.filter(c => gradeOfClass(c) === gradeLevel)
        .sort((a, b) => String(a.stream || '').localeCompare(String(b.stream || '')));

    const handleGradeClick = (grade) => goTo({ grade: grade.gradeLevel });
    const handleClassClick = (cls) => goTo(classParams(cls));
    // "Up one level" (not browser history, so it never leaves the page)
    const handleBack = () => goTo(view === 'students' && gradeParam ? { grade: gradeParam } : {});

    const tileKeys = (onClick) => ({
        role: 'button', tabIndex: 0, onClick,
        onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
    });

    const grouped = gradesBySection();

    // ── Breadcrumb trail: Classes › Grade 4 › G4Y ─────────────────────────────
    const crumbs = [{ label: 'Classes', icon: 'building', params: view !== 'grades' ? {} : null }];
    if (gradeParam) crumbs.push({ label: gradeLabel(gradeParam), params: view === 'students' ? { grade: gradeParam } : null });
    if (classParam) crumbs.push({ label: selectedClass ? selectedClass.className : (loading ? '…' : 'Not found'), params: null });

    const gradeClassCount = gradeParam ? getClassesForGrade(gradeParam).length : 0;
    const pageTitle = view === 'grades' ? 'All Classes'
        : view === 'streams' ? gradeLabel(gradeParam)
        : selectedClass ? `${selectedClass.className} — ${classTitle(selectedClass)}` : 'Class not found';
    const pageSubtitle = loading ? 'Loading…'
        : view === 'grades' ? `${classes.length} class(es) across ${Object.values(grouped).flat().length} grade level(s)`
        : view === 'streams' ? `${gradeClassCount} class(es) in ${gradeLabel(gradeParam)}`
        : !selectedClass ? 'This class may have been deleted.'
        : loadingStudents ? 'Loading students…'
        : `${students.length} student(s)`;
    const sortedStudents = [...students].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    const renderClassTile = (cls) => {
        const isEditing = editingClass?.classId === cls.classId;
        const sColor = streamColor(cls.stream);
        const busy = busyClassId === cls.classId;
        return (
            <div key={cls.classId} style={isEditing ? { gridColumn: '1 / -1' } : undefined}>
                <div style={{ ...styles.streamTile, borderTop: `5px solid ${sColor}`, outline: isEditing ? '2px solid #2E75B6' : 'none' }}>
                    <div style={styles.streamTop} {...tileKeys(() => handleClassClick(cls))} aria-label={`View students in ${cls.className}`}>
                        <div style={{ ...styles.streamBadge, backgroundColor: sColor, color: textOn(sColor) }}>
                            {streamLabel(cls.stream) || 'Single Stream'}
                        </div>
                        <div style={styles.streamName}>{cls.className}</div>
                        <div style={styles.streamSub}>{classTitle(cls)}</div>
                        <div style={styles.streamTeacher}>
                            <Icon name="person-workspace" />
                            {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : <span style={{ color: '#dc3545' }}>No class teacher</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            <Icon name="bullseye" />Target: {cls.meanTarget != null ? `${cls.meanTarget}%` : '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#2E75B6', fontWeight: 'bold' }}><Icon name="people-fill" />View Students <i className="bi bi-arrow-right" aria-hidden="true" /></div>
                    </div>
                    <div style={styles.streamActions}>
                        <select style={styles.teacherSelect} disabled={busy || !teachers.length}
                            value={cls.classTeacher?.teacherId != null ? String(cls.classTeacher.teacherId) : ''}
                            onChange={e => handleTeacherChange(cls, e.target.value)}
                            aria-label={`Class teacher for ${cls.className}`}>
                            <option value="">{cls.classTeacher ? '— Remove teacher —' : 'Assign teacher…'}</option>
                            {teachers.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{t.firstName} {t.lastName}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => handleEdit(cls)} style={isEditing ? styles.cancelEditBtn : styles.editBtn} title={isEditing ? 'Close editor' : 'Edit class'} aria-label={isEditing ? 'Close editor' : `Edit ${cls.className}`}>
                                <i className={`bi bi-${isEditing ? 'x-lg' : 'pencil-fill'}`} aria-hidden="true" />
                            </button>
                            <button onClick={() => handleDelete(cls)} style={styles.deleteBtn} disabled={busy} title="Delete class" aria-label={`Delete ${cls.className}`}>
                                <i className={`bi bi-${busy ? 'hourglass-split' : 'trash-fill'}`} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
                {isEditing && (
                    <div style={styles.inlineEditCard}>
                        <div style={styles.inlineEditHeader}>
                            <h4 style={{ color: '#2E75B6', margin: 0, fontSize: '14px' }}><Icon name="pencil-fill" />Editing: {cls.className}</h4>
                            <button onClick={handleCancelEdit} style={styles.closeX} aria-label="Close"><i className="bi bi-x-lg" /></button>
                        </div>
                        <ClassFormFields formData={formData} setFormData={setFormData}
                            onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                            submitLabel="Update Class" submitIcon="check-circle-fill" saving={saving}
                            isEdit originalName={cls.className} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        {view !== 'grades' && (
                            <button onClick={handleBack} style={styles.backBtn} aria-label="Up one level"><Icon name="arrow-left" />Back</button>
                        )}
                        <div style={{ minWidth: 0 }}>
                            <nav aria-label="Breadcrumb">
                                <ol style={styles.crumbs}>
                                    {crumbs.map((c, i) => (
                                        <li key={i} style={styles.crumbItem}>
                                            {i > 0 && <i className="bi bi-chevron-right" aria-hidden="true" style={styles.crumbSep} />}
                                            {c.params ? (
                                                <a href={hrefFor(c.params)} onClick={e => linkClick(e, c.params)} style={styles.crumbLink}>
                                                    {c.icon && <Icon name={c.icon} style={{ marginRight: '4px' }} />}{c.label}
                                                </a>
                                            ) : (
                                                <span aria-current="page" style={styles.crumbCurrent}>
                                                    {c.icon && <Icon name={c.icon} style={{ marginRight: '4px' }} />}{c.label}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                            <h2 style={styles.title}>{pageTitle}</h2>
                            <p style={styles.breadcrumb}>{pageSubtitle}</p>
                        </div>
                    </div>
                    <button onClick={toggleAddForm} style={styles.addBtn}>
                        {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Class</>}
                    </button>
                </div>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" />{error}
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}><Icon name="plus-circle" />Add New Class</h3>
                        <ClassFormFields formData={formData} setFormData={setFormData}
                            onSubmit={handleSubmitAdd} onCancel={() => { setShowAddForm(false); resetForm(); }}
                            submitLabel="Save Class" submitIcon="save-fill" saving={saving} />
                    </div>
                )}

                {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading classes...</p> : (
                    <>
                        {/* ── VIEW 1: Grade Tiles ── */}
                        {view === 'grades' && (
                            <div>
                                {SECTIONS.map(section => {
                                    const sectionGrades = grouped[section.value] || [];
                                    if (!sectionGrades.length) return null;
                                    return (
                                        <div key={section.value} style={styles.sectionBlock}>
                                            <div style={{ ...styles.sectionTitle, backgroundColor: section.color }}>
                                                <span>{section.label}</span>
                                                <span style={{ fontSize: '12px', opacity: 0.9 }}>
                                                    Target: {section.target}% | {sectionGrades.length} grade(s) | {sectionGrades.reduce((s, g) => s + g.classes.length, 0)} classes
                                                </span>
                                            </div>
                                            <div style={styles.gradeTiles}>
                                                {sectionGrades.map(grade => (
                                                    <div key={grade.gradeLevel} style={{ ...styles.gradeTile, borderTop: `4px solid ${section.color}` }}
                                                        {...tileKeys(() => handleGradeClick(grade))}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
                                                        <div style={{ ...styles.gradeLabelStyle, color: section.color }}>{grade.gradeLevel}</div>
                                                        <div style={styles.gradeFullName}>{gradeLabel(grade.gradeLevel)}</div>
                                                        <div style={styles.gradeCount}>{grade.classes.length} class{grade.classes.length !== 1 ? 'es' : ''}</div>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                                                            {grade.classes.map(cls => (
                                                                <span key={cls.classId} title={streamLabel(cls.stream) || 'Single stream'}
                                                                    style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: streamColor(cls.stream), display: 'inline-block' }} />
                                                            ))}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', fontWeight: 600 }}>View <i className="bi bi-arrow-right" aria-hidden="true" /></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {otherClasses.length > 0 && (
                                    <div style={styles.sectionBlock}>
                                        <div style={{ ...styles.sectionTitle, backgroundColor: '#6c757d' }}>
                                            <span><Icon name="question-circle-fill" />Other — grade or section not set</span>
                                            <span style={{ fontSize: '12px', opacity: 0.9 }}>Edit these to give them a section and grade</span>
                                        </div>
                                        <div style={styles.streamTiles}>{otherClasses.map(renderClassTile)}</div>
                                    </div>
                                )}

                                {classes.length === 0 && (
                                    <div style={styles.emptyState}>
                                        <Icon name="building" style={{ fontSize: '48px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '15px' }} />
                                        <h3>No Classes Yet</h3><p>Click <strong>Add Class</strong> to get started</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── VIEW 2: Classes in a grade ── */}
                        {view === 'streams' && gradeClassCount === 0 && (
                            <div style={{ ...styles.emptyState, borderRadius: '14px' }}>
                                <Icon name="question-circle" style={{ fontSize: '40px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '10px' }} />
                                <h3>No classes in {gradeLabel(gradeParam)}</h3>
                                <p><a href="/classes" onClick={e => linkClick(e, {})} style={{ color: '#2E75B6' }}>Back to all classes</a></p>
                            </div>
                        )}

                        {view === 'streams' && selectedGrade && gradeClassCount > 0 && (
                            <div>
                                <div style={{ ...styles.sectionTitle, backgroundColor: sectionColor(selectedGrade.section) }}>
                                    <span>{gradeLabel(selectedGrade.gradeLevel)} — Classes</span>
                                    <span style={{ fontSize: '12px', opacity: 0.9 }}>{getClassesForGrade(selectedGrade.gradeLevel).length} class(es)</span>
                                </div>
                                <div style={styles.streamTiles}>
                                    {getClassesForGrade(selectedGrade.gradeLevel).map(renderClassTile)}
                                </div>
                            </div>
                        )}

                        {/* ── VIEW 3: Students ── */}
                        {view === 'students' && !selectedClass && (
                            <div style={{ ...styles.emptyState, borderRadius: '14px' }}>
                                <Icon name="question-circle" style={{ fontSize: '40px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '10px' }} />
                                <h3>Class not found</h3>
                                <p>It may have been deleted. <a href="/classes" onClick={e => linkClick(e, {})} style={{ color: '#2E75B6' }}>Back to all classes</a></p>
                            </div>
                        )}

                        {view === 'students' && selectedClass && (
                            <div>
                                <div style={{ ...styles.sectionTitle, backgroundColor: sectionColor(sectionOfClass(selectedClass)) }}>
                                    <span>{selectedClass.className} — Students</span>
                                    <span style={{ fontSize: '12px', opacity: 0.9 }}>
                                        {students.length} student(s) | {students.filter(s => isMale(s.gender)).length} boys | {students.filter(s => isFemale(s.gender)).length} girls
                                    </span>
                                </div>
                                {loadingStudents ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading students...</p> : students.length === 0 ? (
                                    <div style={styles.emptyState}>
                                        <Icon name="people" style={{ fontSize: '48px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '15px' }} />
                                        <h3>No Students Yet</h3>
                                        <p>Add students to this class from the <a href="/students" onClick={e => { e.preventDefault(); navigate('/students'); }} style={{ color: '#2E75B6' }}>Students page</a>.</p>
                                    </div>
                                ) : (
                                    <div style={styles.studentGrid}>
                                        {sortedStudents.map((student, index) => (
                                            <a key={student.studentId} href={`/student/${student.studentId}`}
                                                onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); navigate(`/student/${student.studentId}`); } }}
                                                style={styles.studentCard}
                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                                                <div style={{ ...styles.studentAvatar, backgroundColor: isMale(student.gender) ? '#2E75B6' : '#e83e8c' }}>
                                                    {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                </div>
                                                <div style={styles.studentInfo}>
                                                    <strong style={styles.studentName}>{student.firstName} {student.lastName}</strong>
                                                    <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{student.admissionNumber}</span>
                                                    <span style={{ color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', width: 'fit-content', backgroundColor: isMale(student.gender) ? '#2E75B6' : '#e83e8c' }}>{student.gender || '-'}</span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold' }}>{index + 1}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
    title: { color: '#1F3864', margin: 0, fontSize: '22px', fontWeight: 800, overflowWrap: 'anywhere' },
    crumbs: { listStyle: 'none', margin: '0 0 4px 0', padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px' },
    crumbItem: { display: 'inline-flex', alignItems: 'center' },
    crumbSep: { color: '#aaa', fontSize: '10px', margin: '0 8px' },
    crumbLink: { color: '#2E75B6', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
    crumbCurrent: { color: '#555', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
    breadcrumb: { color: '#888', margin: '3px 0 0 0', fontSize: '13px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    addFormCard: { backgroundColor: 'white', padding: '25px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0', fontWeight: 700 },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 12px 12px', padding: '20px', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px', marginBottom: '8px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    closeX: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    stepGuide: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8f9fa', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap' },
    step: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    stepNum: { backgroundColor: '#1F3864', color: 'white', width: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' },
    stepArrow: { color: '#aaa', fontSize: '11px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '5px' },
    autoTag: { backgroundColor: '#2E75B6', color: 'white', padding: '1px 6px', borderRadius: '6px', fontSize: '9px' },
    optionalTag: { backgroundColor: '#6c757d', color: 'white', padding: '1px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: 'normal' },
    fieldHint: { fontSize: '11px', color: '#888' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px', padding: 0, textAlign: 'left' },
    warnNote: { backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#856404', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', margin: '0 0 12px' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    preview: { backgroundColor: '#f0f4ff', padding: '12px 16px', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    previewBadge: { color: 'white', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px' },
    previewDetail: { color: '#666', fontSize: '12px' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
    sectionBlock: { marginBottom: '30px' },
    sectionTitle: { color: 'white', padding: '14px 22px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '15px', flexWrap: 'wrap', gap: '6px' },
    gradeTiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '12px', padding: '18px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    gradeTile: { backgroundColor: 'white', padding: '22px 16px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', transition: 'transform 0.2s ease, box-shadow 0.2s ease', userSelect: 'none' },
    gradeLabelStyle: { fontSize: '24px', fontWeight: 800, marginBottom: '3px' },
    gradeFullName: { fontSize: '11px', color: '#888', marginBottom: '6px' },
    gradeCount: { fontSize: '12px', color: '#666' },
    streamTiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '16px', padding: '18px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    streamTile: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' },
    streamTop: { padding: '20px', cursor: 'pointer', textAlign: 'center' },
    streamBadge: { padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' },
    streamName: { fontSize: '22px', fontWeight: 800, color: '#1F3864' },
    streamSub: { fontSize: '12px', color: '#888', marginBottom: '8px' },
    streamTeacher: { fontSize: '12px', color: '#555', marginBottom: '5px' },
    streamActions: { borderTop: '1px solid #eee', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', gap: '8px', borderRadius: '0 0 12px 12px' },
    teacherSelect: { padding: '6px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', flex: 1, minWidth: 0, backgroundColor: 'white' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '7px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '7px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '7px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '12px', padding: '18px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    studentCard: { backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #f0f0f0', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', textDecoration: 'none', color: 'inherit' },
    studentAvatar: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 },
    studentInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
    studentName: { fontSize: '13px', color: '#1F3864', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '0 0 14px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default Classes;
