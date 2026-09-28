import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import '../index.css';
import { classDisplayName } from '../utils/classUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Spinner from '../components/Spinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { SECTIONS_LIVE, GRADE_ORDER_LIVE, STREAM_COLORS_LIVE, gradeFromClassName, textOn } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { firstName: '', lastName: '', dateOfBirth: '', gender: '', admissionNumber: '' };
const UNASSIGNED = '__none__';

// ── Small helpers ─────────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').trim().toLowerCase();
const isMale = (g) => norm(g).startsWith('m');
const isFemale = (g) => norm(g).startsWith('f');
// Date inputs need yyyy-mm-dd; the server may send a full timestamp
const toDateInput = (d) => {
    if (!d) return '';
    if (Array.isArray(d)) return `${d[0]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`;
    return String(d).slice(0, 10);
};
const studentClassId = (s) => s.schoolClass?.classId ?? null;
const matchesSearch = (s, q) => {
    const t = norm(q);
    if (!t) return true;
    return norm(`${s.firstName} ${s.lastName}`).includes(t) ||
        norm(`${s.lastName} ${s.firstName}`).includes(t) ||
        norm(s.admissionNumber).includes(t);
};
const matchesGender = (s, g) => !g || (g === 'Male' ? isMale(s.gender) : isFemale(s.gender));
const byName = (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
const serverMessage = (err, fallback) => {
    const d = err.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

// Outside parent — prevents keyboard dismiss on re-render
const StudentFormFields = ({ formData, setFormData, classId, setClassId, sections, classes, onSubmit, onCancel, submitLabel, submitIcon, saving, showClassField = false, classHint }) => {
    const sectionValues = sections.map(s => s.value);
    const otherClasses = classes.filter(c => !sectionValues.includes(c.section));
    return (
        <form onSubmit={onSubmit} style={styles.inlineForm}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>First Name</label>
                    <input style={{ ...styles.input, textTransform: 'uppercase' }} value={formData.firstName} autoComplete="off"
                        onChange={e => setFormData({ ...formData, firstName: e.target.value.toUpperCase() })} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Last Name</label>
                    <input style={{ ...styles.input, textTransform: 'uppercase' }} value={formData.lastName} autoComplete="off"
                        onChange={e => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Date of Birth</label>
                    <input type="date" style={styles.input} value={formData.dateOfBirth}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Gender</label>
                    <select style={styles.input} value={formData.gender}
                        onChange={e => setFormData({ ...formData, gender: e.target.value })} required>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Admission Number</label>
                    <input style={styles.input} value={formData.admissionNumber} autoComplete="off"
                        onChange={e => setFormData({ ...formData, admissionNumber: e.target.value })} required />
                </div>
                {showClassField && (
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Class</label>
                        <select style={styles.input} value={classId} onChange={e => setClassId(e.target.value)} required>
                            <option value="">Select Class</option>
                            {sections.map(section => {
                                const opts = classes.filter(c => c.section === section.value)
                                    .sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
                                return opts.length ? (
                                    <optgroup key={section.value} label={section.label}>
                                        {opts.map(cls => <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>)}
                                    </optgroup>
                                ) : null;
                            })}
                            {otherClasses.length > 0 && (
                                <optgroup label="Other">
                                    {otherClasses.map(cls => <option key={cls.classId} value={cls.classId}>{classDisplayName(cls)}</option>)}
                                </optgroup>
                            )}
                        </select>
                        {classHint && <span style={styles.fieldHint}>{classHint}</span>}
                    </div>
                )}
            </div>
            <div style={styles.btnGroup}>
                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                    <Icon name={saving ? 'hourglass-split' : (submitIcon || 'save-fill')} />{saving ? 'Saving...' : submitLabel}
                </button>
                <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Cancel</button>
            </div>
        </form>
    );
};

function Students() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [students, setStudents] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [search, setSearch] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [selectedClassFilter, setSelectedClassFilter] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [classId, setClassId] = useState('');
    const [allClasses, setClasses] = useState([]);
    const role = localStorage.getItem('role');
    const isTeacher = role === 'TEACHER';
    const myClassId = localStorage.getItem('linkedClassId');
    // Teachers only see the tiles of classes they teach: their own class, plus any class
    // whose students the server lets them see (subject classes). Admins see every class.
    const classes = isTeacher
        ? allClasses.filter(c => String(c.classId) === String(myClassId) ||
            students.some(st => String(studentClassId(st)) === String(c.classId)))
        : allClasses;
    const autoOpened = useRef(false);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast, showToast, hideToast } = useToast();

    // Sections, grades and stream colours from School Settings
    const sections = SECTIONS_LIVE;
    const GRADE_ORDER = GRADE_ORDER_LIVE;
    const streamColors = new Proxy(STREAM_COLORS_LIVE, { get: (t, k) => t[k] || '#1F3864' });

    useEffect(() => { fetchStudents(); fetchClasses(); }, []);

    useEffect(() => {
        let data = students.filter(s => matchesSearch(s, search) && matchesGender(s, filterGender));
        if (selectedClassFilter === UNASSIGNED) data = data.filter(s => studentClassId(s) == null);
        else if (selectedClassFilter) data = data.filter(s => String(studentClassId(s)) === String(selectedClassFilter));
        setFiltered([...data].sort(byName));
    }, [search, filterGender, selectedClassFilter, students]);

    // Returns the fresh list so callers can check what the server actually saved
    const fetchStudents = async () => {
        try {
            setLoading(prev => prev && true);
            const response = await api.get('/api/students');
            setStudents(response.data || []);
            setError('');
            return response.data || [];
        } catch (err) {
            setError('Failed to load students. Check your connection and refresh.');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data || []);
        } catch (err) {
            setError('Failed to load classes. Check your connection and refresh.');
        }
    };

    const extractGrade = (className) => gradeFromClassName(className);

    const extractSection = (grade) => sections.find(s => s.grades.includes(grade))?.value || '';

    const gradeOfClass = (cls) => cls ? (cls.gradeLevel || extractGrade(cls.className)) : '';

    const getUniqueGrades = () => {
        const grades = {};
        classes.forEach(cls => {
            const grade = gradeOfClass(cls);
            const section = cls.section || extractSection(grade);
            if (grade && section) {
                if (!grades[grade]) grades[grade] = { gradeLevel: grade, section, count: 0, classes: [] };
                grades[grade].count++;
                grades[grade].classes.push(cls);
            }
        });
        return Object.values(grades);
    };

    const getClassesForGrade = (gradeLevel) =>
        classes.filter(c => gradeOfClass(c) === gradeLevel)
            .sort((a, b) => String(a.stream || '').localeCompare(String(b.stream || '')));

    const getStudentsForClass = (cls) => {
        if (!cls) return [];
        return students.filter(s => {
            if (studentClassId(s) != null) return String(studentClassId(s)) === String(cls.classId);
            // Older records without a class link: match on name AND stream
            return s.className === cls.className && (cls.stream ? s.stream === cls.stream : !s.stream);
        });
    };

    // Prefer the exact class link; only fall back to name + stream
    const findClassForStudent = (student) => {
        const id = studentClassId(student);
        if (id != null) return classes.find(c => String(c.classId) === String(id));
        return classes.find(c => c.className === student.className && (c.stream ? c.stream === student.stream : !student.stream));
    };

    const gradesBySection = () => {
        const grouped = {};
        sections.forEach(s => { grouped[s.value] = []; });
        getUniqueGrades().forEach(g => { if (grouped[g.section]) grouped[g.section].push(g); });
        Object.keys(grouped).forEach(s => grouped[s].sort((a, b) =>
            (GRADE_ORDER.indexOf(a.gradeLevel) - GRADE_ORDER.indexOf(b.gradeLevel)) || a.gradeLevel.localeCompare(b.gradeLevel)));
        return grouped;
    };

    const getSectionInfo = (key) => sections.find(s => s.value === key);

    // ── Where we are lives in the URL (?grade=G4&class=12): Back/Forward, refresh
    //    and shared links keep your place; breadcrumbs are real links ──
    const gradeParam = searchParams.get('grade') || '';
    const classParam = searchParams.get('class') || '';
    const selectedClass = classParam ? classes.find(c => String(c.classId) === classParam) || null : null;
    const selectedGrade = gradeParam
        ? (getUniqueGrades().find(g => g.gradeLevel === gradeParam) || { gradeLevel: gradeParam, section: extractSection(gradeParam), count: 0, classes: [] })
        : null;
    const view = classParam ? 'students' : gradeParam ? 'streams' : 'grades';
    const goTo = (params, replace = false) => { setEditingStudent(null); setSearchParams(params, { replace }); };
    const hrefFor = (params) => { const q = new URLSearchParams(params).toString(); return q ? `/students?${q}` : '/students'; };

    // A teacher with one class goes straight to their class's students on first load
    useEffect(() => {
        if (!isTeacher || autoOpened.current || loading || !allClasses.length) return;
        autoOpened.current = true;
        if (view !== 'grades' || classes.length !== 1) return;
        const only = classes[0];
        const g = gradeOfClass(only);
        setSearchParams(g ? { grade: g, class: String(only.classId) } : { class: String(only.classId) }, { replace: true });
    }, [isTeacher, loading, allClasses, classes.length, view]);
    const linkClick = (e, params) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); goTo(params);
    };
    const getStreamColor = (stream) => streamColors[String(stream || '').toUpperCase()] || streamColors.default;

    const resetForm = () => { setFormData(EMPTY_FORM); setClassId(''); };

    // Opening a class no longer sets the search filter (that made a stray "Search Results"
    // table appear on the main page after jumping back)
    const handleGradeClick = (grade) => goTo({ grade: grade.gradeLevel });
    const handleClassClick = (cls) => {
        const g = gradeOfClass(cls);
        goTo(g ? { grade: g, class: String(cls.classId) } : { class: String(cls.classId) });
    };
    const handleBack = () => goTo(view === 'students' && gradeParam ? { grade: gradeParam } : {});

    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setEditingStudent(null);
        setFormData(EMPTY_FORM); // never carry over a student that was being edited
        setClassId(selectedClass ? String(selectedClass.classId) : '');
        setShowAddForm(true);
    };

    const handleEdit = (student) => {
        if (editingStudent?.studentId === student.studentId) { setEditingStudent(null); resetForm(); return; }
        setEditingStudent(student);
        setFormData({
            firstName: student.firstName || '', lastName: student.lastName || '',
            dateOfBirth: toDateInput(student.dateOfBirth), gender: isMale(student.gender) ? 'Male' : isFemale(student.gender) ? 'Female' : '',
            admissionNumber: student.admissionNumber || ''
        });
        const cls = findClassForStudent(student);
        setClassId(cls ? String(cls.classId) : '');
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingStudent(null); resetForm(); };

    const cleaned = () => ({
        ...formData,
        // Learner names are kept in CAPITALS everywhere
        firstName: formData.firstName.trim().toUpperCase(),
        lastName: formData.lastName.trim().toUpperCase(),
        admissionNumber: formData.admissionNumber.trim()
    });

    const admissionTaken = (adm, exceptId) =>
        students.some(s => norm(s.admissionNumber) === norm(adm) && String(s.studentId) !== String(exceptId ?? ''));

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const data = cleaned();
        if (admissionTaken(data.admissionNumber, editingStudent.studentId)) {
            showToast(`Admission number ${data.admissionNumber} already belongs to another student.`, 'error'); return;
        }
        const original = editingStudent;
        const oldClassId = findClassForStudent(original)?.classId;
        const classChanged = classId && String(classId) !== String(oldClassId ?? '');
        const targetClass = classes.find(c => String(c.classId) === String(classId));
        setSaving(true);
        // Step 1: save the student's details (class fields left exactly as they were)
        try {
            await api.put(`/api/students/${original.studentId}`, {
                ...data,
                className: original.className || original.schoolClass?.className,
                stream: original.stream ?? original.schoolClass?.stream ?? null
            });
        } catch (err) {
            showToast(serverMessage(err, 'Failed to update student.'), 'error');
            setSaving(false);
            return;
        }
        // Step 2: if a new class was chosen, use the dedicated move endpoint
        let moveFailed = null;
        if (classChanged) {
            try {
                await api.put(`/api/students/${original.studentId}/move-class/${classId}`);
            } catch (err) {
                moveFailed = serverMessage(err, 'the server rejected the class change');
            }
        }
        await fetchStudents();
        if (moveFailed) {
            showToast(`Details saved, but the student was NOT moved: ${moveFailed}`, 'error');
        } else {
            showToast(classChanged ? `Student updated and moved to ${classDisplayName(targetClass)}.` : 'Student updated successfully!', 'success');
            setEditingStudent(null);
            resetForm();
            // If we moved them out of the class being viewed, they'll disappear from it — that's expected
        }
        setSaving(false);
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const data = cleaned();
        if (!classId) { showToast('Please choose a class.', 'error'); return; }
        if (admissionTaken(data.admissionNumber)) {
            showToast(`Admission number ${data.admissionNumber} already exists.`, 'error'); return;
        }
        setSaving(true);
        try {
            await api.post(`/api/students?classId=${classId}`, data);
            showToast(`${data.firstName} ${data.lastName} added successfully!`, 'success');
            // Keep the form open with the same class, ready for the next student
            setFormData(EMPTY_FORM);
            fetchStudents();
        } catch (err) {
            showToast(serverMessage(err, 'Failed to add student. Please check all fields.'), 'error');
        }
        setSaving(false);
    };

    const handleDelete = async (student) => {
        if (!window.confirm(`Delete ${student.firstName} ${student.lastName} (${student.admissionNumber})? This cannot be undone.`)) return;
        try {
            await api.delete(`/api/students/${student.studentId}`);
            showToast('Student deleted.', 'success');
            if (editingStudent?.studentId === student.studentId) handleCancelEdit();
            fetchStudents();
        } catch (err) {
            const status = err.response?.status;
            showToast(status === 409 || status === 500
                ? serverMessage(err, 'This student could not be deleted — they may still have marks or report cards.')
                : serverMessage(err, 'Failed to delete student'), 'error');
        }
    };

    const grouped = gradesBySection();

    // ── Breadcrumb trail: Students › G4 › Grade 4 Yellow ─────────────────────
    const crumbs = [{ label: 'Students', icon: 'mortarboard-fill', params: view !== 'grades' ? {} : null }];
    if (gradeParam) crumbs.push({ label: gradeParam, params: view === 'students' ? { grade: gradeParam } : null });
    if (classParam) crumbs.push({ label: selectedClass ? classDisplayName(selectedClass) : (loading ? '…' : 'Not found'), params: null });
    const gradeClassCount = gradeParam ? getClassesForGrade(gradeParam).length : 0;
    const pageTitle = view === 'grades' ? 'All Students'
        : view === 'streams' ? `${gradeParam} — ${getSectionInfo(selectedGrade?.section)?.label || 'Grade'}`
        : selectedClass ? classDisplayName(selectedClass) : 'Class not found';
    const pageSubtitle = loading ? 'Loading…'
        : view === 'grades' ? (isTeacher ? `${students.length} student(s) in your class${classes.length > 1 ? 'es' : ''}` : `${students.length} total students across all classes`)
        : view === 'streams' ? `${gradeClassCount} class(es) in ${gradeParam}`
        : selectedClass ? `${getStudentsForClass(selectedClass).length} student(s)` : 'This class may have been deleted.';
    const unassignedCount = students.filter(s => !findClassForStudent(s)).length;
    const genderCounts = (list) => ({ boys: list.filter(s => isMale(s.gender)).length, girls: list.filter(s => isFemale(s.gender)).length });
    const studentsInSection = (sectionValue) => students.filter(s => {
        const cls = findClassForStudent(s);
        return cls && (cls.section || extractSection(gradeOfClass(cls))) === sectionValue;
    });

    const editForm = (student) => (
        <div style={styles.inlineEditCard}>
            <div style={styles.inlineEditHeader}>
                <h4 style={styles.inlineEditTitle}><Icon name="pencil-fill" />Editing: {student.firstName} {student.lastName}</h4>
                <button onClick={handleCancelEdit} style={styles.closeBtn} aria-label="Close"><i className="bi bi-x-lg" /></button>
            </div>
            <StudentFormFields
                formData={formData} setFormData={setFormData}
                classId={classId} setClassId={setClassId}
                sections={sections} classes={classes}
                onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                submitLabel="Update Student" submitIcon="check-circle-fill"
                saving={saving} showClassField={true}
                classHint="Change this to move the student to another class."
            />
        </div>
    );

    return (
        <div style={styles.container}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <div style={styles.headerLeft}>
                            {view !== 'grades' && (
                                <button onClick={handleBack} style={styles.backBtn}><Icon name="arrow-left" style={{ marginRight: '4px' }} />Back</button>
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
                            {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Student</>}
                        </button>
                    </div>

                    {error && <p style={styles.error}><Icon name="exclamation-triangle-fill" />{error}</p>}

                    {showAddForm && (
                        <div style={styles.addFormCard}>
                            <h3 style={styles.formTitle}><Icon name="plus-circle" style={{ color: '#1F3864' }} />Add New Student</h3>
                            <StudentFormFields
                                formData={formData} setFormData={setFormData}
                                classId={classId} setClassId={setClassId}
                                sections={sections} classes={classes}
                                onSubmit={handleSubmitAdd}
                                onCancel={() => { setShowAddForm(false); resetForm(); }}
                                submitLabel="Save Student" submitIcon="save-fill"
                                saving={saving} showClassField={true}
                                classHint="After saving, the form stays open so you can add the next student."
                            />
                        </div>
                    )}

                    {loading ? <Spinner message="Loading students..." /> : (
                        <>
                            {/* ── VIEW 1: Grade Tiles ── */}
                            {view === 'grades' && (
                                <div>
                                    {/* Section totals: useful for admins, just zeros for a class teacher */}
                                    {!isTeacher && <div style={styles.statsRow}>
                                        {sections.map(section => {
                                            const sectionStudents = studentsInSection(section.value);
                                            const sectionClasses = classes.filter(c => (c.section || extractSection(gradeOfClass(c))) === section.value);
                                            return (
                                                <div key={section.value} style={{ ...styles.statCard, borderTop: `4px solid ${section.color}` }}>
                                                    <div style={{ ...styles.statIcon, backgroundColor: section.light, color: section.color }}>{section.label.charAt(0)}</div>
                                                    <div style={styles.statInfo}>
                                                        <div style={{ ...styles.statNum, color: section.color }}>{sectionStudents.length}</div>
                                                        <div style={styles.statLabel}>{section.label}</div>
                                                        <div style={styles.statMeta}>{sectionClasses.length} classes</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>}

                                    {unassignedCount > 0 && (
                                        <div style={styles.notice}>
                                            <Icon name="exclamation-circle-fill" />
                                            <span><strong>{unassignedCount}</strong> student{unassignedCount !== 1 ? 's are' : ' is'} not in any class, so they don't appear in the tiles below.</span>
                                            <button onClick={() => setSelectedClassFilter(UNASSIGNED)} style={styles.noticeBtn}>Show them</button>
                                        </div>
                                    )}

                                    <div style={styles.searchCard}>
                                        <div style={styles.searchInputWrap}>
                                            <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                            <input style={styles.searchInput} placeholder="Search by name or admission number..."
                                                value={search} onChange={e => setSearch(e.target.value)} />
                                        </div>
                                        <select style={styles.filterSelect} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                                            <option value="">All Genders</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                        <button onClick={() => { setSearch(''); setFilterGender(''); setSelectedClassFilter(''); }} style={styles.clearBtn}>
                                            <Icon name="arrow-counterclockwise" />Clear
                                        </button>
                                    </div>

                                    {(search || filterGender || selectedClassFilter) && (
                                        <div style={{ ...styles.tableCard, marginTop: 0, marginBottom: '22px' }}>
                                            <div style={styles.tableTopBar}>
                                                <h3 style={styles.tableTitle}>
                                                    <Icon name="search" />
                                                    {selectedClassFilter === UNASSIGNED ? 'Students without a class' : 'Search Results'} ({filtered.length})
                                                </h3>
                                            </div>
                                            {filtered.length === 0 ? (
                                                <p style={{ padding: '25px', textAlign: 'center', color: '#666', margin: 0 }}>No students match your search.</p>
                                            ) : (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={styles.table}>
                                                        <thead>
                                                            <tr style={styles.thead}>
                                                                <th style={styles.th}>#</th>
                                                                <th style={styles.th}>Adm No</th>
                                                                <th style={styles.th}>Name</th>
                                                                <th style={styles.th}>Gender</th>
                                                                <th style={styles.th}>Class</th>
                                                                <th style={styles.th}>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((s, i) => {
                                                                const cls = findClassForStudent(s);
                                                                const isEditing = editingStudent?.studentId === s.studentId;
                                                                return (
                                                                    <React.Fragment key={s.studentId}>
                                                                        <tr style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                                            <td style={styles.td}>{i + 1}</td>
                                                                            <td style={styles.td}><span style={styles.admNo}>{s.admissionNumber}</span></td>
                                                                            <td style={styles.td}><strong>{s.firstName} {s.lastName}</strong></td>
                                                                            <td style={styles.td}>
                                                                                <span style={{ ...styles.genderBadge, backgroundColor: isMale(s.gender) ? '#2E75B6' : '#e83e8c' }}>{s.gender || '-'}</span>
                                                                            </td>
                                                                            <td style={styles.td}>{cls ? classDisplayName(cls) : <span style={{ color: '#dc3545', fontWeight: 'bold' }}>No class</span>}</td>
                                                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                                                                <button onClick={() => navigate(`/student/${s.studentId}`)} style={styles.viewBtn} title="View profile"><i className="bi bi-person-circle" /></button>
                                                                                <button onClick={() => handleEdit(s)} style={isEditing ? { ...styles.editBtn, backgroundColor: '#6c757d' } : styles.editBtn} title={isEditing ? 'Close editor' : 'Edit'}>
                                                                                    <i className={`bi bi-${isEditing ? 'x-lg' : 'pencil-fill'}`} />
                                                                                </button>
                                                                                <button onClick={() => handleDelete(s)} style={styles.deleteBtn} title="Delete"><i className="bi bi-trash-fill" /></button>
                                                                            </td>
                                                                        </tr>
                                                                        {isEditing && (
                                                                            <tr><td colSpan={6} style={{ padding: '0 15px 15px' }}>{editForm(s)}</td></tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {sections.map(section => {
                                        const sectionGrades = grouped[section.value] || [];
                                        if (sectionGrades.length === 0) return null;
                                        return (
                                            <div key={section.value} style={styles.sectionBlock}>
                                                <div style={{ ...styles.sectionTitle, backgroundColor: section.color }}>
                                                    <div>
                                                        <span style={styles.sectionLabel}>{section.label}</span>
                                                        <span style={styles.sectionMeta}>Target: {section.target}% | {sectionGrades.length} grade(s)</span>
                                                    </div>
                                                    <span style={styles.sectionCount}>{studentsInSection(section.value).length} students</span>
                                                </div>
                                                <div style={styles.gradeTiles}>
                                                    {sectionGrades.map(grade => {
                                                        const gradeStudents = students.filter(s => gradeOfClass(findClassForStudent(s)) === grade.gradeLevel);
                                                        const gc = genderCounts(gradeStudents);
                                                        return (
                                                            <div key={grade.gradeLevel}
                                                                style={{ ...styles.gradeTile, borderTop: `4px solid ${section.color}` }}
                                                                onClick={() => handleGradeClick(grade)}
                                                                role="button" tabIndex={0}
                                                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGradeClick(grade); } }}
                                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
                                                                <div style={{ ...styles.gradeLabel, color: section.color }}>{grade.gradeLevel}</div>
                                                                <div style={styles.gradeStudentCount}>{gradeStudents.length} students</div>
                                                                <div style={styles.genderRow}>
                                                                    <span style={styles.maleCount}><Icon name="gender-male" style={{ marginRight: '3px' }} />{gc.boys}</span>
                                                                    <span style={styles.femaleCount}><Icon name="gender-female" style={{ marginRight: '3px' }} />{gc.girls}</span>
                                                                </div>
                                                                <div style={styles.gradeClasses}>{grade.count} class{grade.count !== 1 ? 'es' : ''}</div>
                                                                <div style={{ ...styles.viewArrow, color: section.color }}>View <i className="bi bi-arrow-right" /></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── VIEW 2: Stream Tiles ── */}
                            {view === 'streams' && gradeClassCount === 0 && (
                                <div style={{ ...styles.emptyState, borderRadius: '14px' }}>
                                    <div style={styles.emptyIcon}><i className="bi bi-question-circle" /></div>
                                    <h3>No classes in {gradeParam}</h3>
                                    <p><a href="/students" onClick={e => linkClick(e, {})} style={{ color: '#2E75B6' }}>Back to all students</a></p>
                                </div>
                            )}

                            {view === 'streams' && selectedGrade && gradeClassCount > 0 && (() => {
                                const sectionInfo = getSectionInfo(selectedGrade.section);
                                const gradeClasses = getClassesForGrade(selectedGrade.gradeLevel);
                                return (
                                    <div>
                                        <div style={{ ...styles.sectionTitle, backgroundColor: sectionInfo?.color || '#1F3864', borderRadius: '14px 14px 0 0' }}>
                                            <div>
                                                <span style={styles.sectionLabel}>{selectedGrade.gradeLevel} — {sectionInfo?.label}</span>
                                                <span style={styles.sectionMeta}>{gradeClasses.length} class(es)</span>
                                            </div>
                                            <span style={styles.sectionCount}>
                                                {gradeClasses.reduce((sum, c) => sum + getStudentsForClass(c).length, 0)} students
                                            </span>
                                        </div>
                                        <div style={styles.streamTiles}>
                                            {gradeClasses.map(cls => {
                                                const clsStudents = getStudentsForClass(cls);
                                                const gc = genderCounts(clsStudents);
                                                const streamColor = getStreamColor(cls.stream);
                                                return (
                                                    <div key={cls.classId}
                                                        style={{ ...styles.streamTile, borderTop: `5px solid ${streamColor}` }}
                                                        onClick={() => handleClassClick(cls)}
                                                        role="button" tabIndex={0}
                                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClassClick(cls); } }}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}>
                                                        <div style={{ ...styles.streamBadge, backgroundColor: streamColor, color: textOn(streamColor) }}>{cls.stream || 'SINGLE'}</div>
                                                        <div style={styles.streamName}>{classDisplayName(cls)}</div>
                                                        <div style={styles.streamStats}>
                                                            <div style={styles.streamStatItem}><span style={styles.streamStatNum}>{clsStudents.length}</span><span style={styles.streamStatLabel}>Total</span></div>
                                                            <div style={styles.streamStatItem}><span style={{ ...styles.streamStatNum, color: '#2E75B6' }}>{gc.boys}</span><span style={styles.streamStatLabel}>Boys</span></div>
                                                            <div style={styles.streamStatItem}><span style={{ ...styles.streamStatNum, color: '#e83e8c' }}>{gc.girls}</span><span style={styles.streamStatLabel}>Girls</span></div>
                                                        </div>
                                                        <div style={styles.streamTeacher}>
                                                            <Icon name="person-workspace" style={{ color: '#888' }} />
                                                            {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : 'No Teacher'}
                                                        </div>
                                                        <div style={{ ...styles.viewStudentsBtn, color: streamColor === '#ffc107' ? '#b38600' : streamColor }}><Icon name="people-fill" />View Students <i className="bi bi-arrow-right" /></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── VIEW 3: Students in Class ── */}
                            {view === 'students' && !selectedClass && (
                                <div style={{ ...styles.emptyState, borderRadius: '14px' }}>
                                    <div style={styles.emptyIcon}><i className="bi bi-question-circle" /></div>
                                    <h3>Class not found</h3>
                                    <p>It may have been deleted. <a href="/students" onClick={e => linkClick(e, {})} style={{ color: '#2E75B6' }}>Back to all students</a></p>
                                </div>
                            )}

                            {view === 'students' && selectedClass && (() => {
                                const sectionInfo = getSectionInfo(selectedClass.section || extractSection(gradeOfClass(selectedClass)));
                                const allInClass = getStudentsForClass(selectedClass);
                                const clsStudents = allInClass.filter(s => matchesSearch(s, search) && matchesGender(s, filterGender)).sort(byName);
                                const gc = genderCounts(allInClass);
                                const target = selectedClass.meanTarget ?? sectionInfo?.target;
                                return (
                                    <div>
                                        <div style={{ ...styles.classHeader, backgroundColor: sectionInfo?.color || '#1F3864' }}>
                                            <div>
                                                <h3 style={styles.classHeaderTitle}>{classDisplayName(selectedClass)} Students</h3>
                                                <p style={styles.classHeaderMeta}>
                                                    {sectionInfo?.label}{target != null ? ` | Target: ${target}%` : ''} | Teacher: {selectedClass.classTeacher ? `${selectedClass.classTeacher.firstName} ${selectedClass.classTeacher.lastName}` : 'Not Assigned'}
                                                </p>
                                            </div>
                                            <div style={styles.classHeaderStats}>
                                                {[['Total', allInClass.length, 'white'], ['Boys', gc.boys, '#BDD7EE'], ['Girls', gc.girls, '#FFCCE5']].map(([label, n, color]) => (
                                                    <div key={label} style={styles.classStatBox}>
                                                        <span style={{ ...styles.classStatNum, color }}>{n}</span>
                                                        <span style={styles.classStatLabel}>{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={styles.classSearchBar}>
                                            <div style={styles.searchInputWrap}>
                                                <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                                <input style={styles.searchInput} placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
                                            </div>
                                            <select style={styles.filterSelect} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                                                <option value="">All</option>
                                                <option value="Male">Boys</option>
                                                <option value="Female">Girls</option>
                                            </select>
                                            <button onClick={() => { setSearch(''); setFilterGender(''); }} style={styles.clearBtn}><Icon name="arrow-counterclockwise" />Clear</button>
                                        </div>

                                        {clsStudents.length === 0 ? (
                                            <div style={styles.emptyState}>
                                                <div style={styles.emptyIcon}><i className="bi bi-people" /></div>
                                                {allInClass.length === 0 ? (
                                                    <>
                                                        <h3>No Students Yet</h3>
                                                        <p>Click <strong>Add Student</strong> to add students to {classDisplayName(selectedClass)}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <h3>No matches</h3>
                                                        <p>No students in this class match your search. <button onClick={() => { setSearch(''); setFilterGender(''); }} style={styles.linkBtn}>Clear search</button></p>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={styles.studentGrid}>
                                                {clsStudents.map((student, index) => {
                                                    const isEditing = editingStudent?.studentId === student.studentId;
                                                    return (
                                                        <div key={student.studentId} style={isEditing ? { gridColumn: '1 / -1' } : undefined}>
                                                            <div style={{ ...styles.studentCard, outline: isEditing ? '2px solid #2E75B6' : 'none' }}>
                                                                <div style={styles.studentCardTop}>
                                                                    <div style={styles.studentRankBadge}>{index + 1}</div>
                                                                    <div style={{ ...styles.studentAvatar, backgroundColor: isMale(student.gender) ? '#2E75B6' : '#e83e8c' }}>
                                                                        {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                                                                    </div>
                                                                </div>
                                                                <div style={styles.studentCardBody}>
                                                                    <strong style={styles.studentName}>{student.firstName} {student.lastName}</strong>
                                                                    <span style={styles.studentAdm}>{student.admissionNumber}</span>
                                                                    <span style={{ ...styles.genderBadge, backgroundColor: isMale(student.gender) ? '#2E75B6' : '#e83e8c' }}>
                                                                        <i className={`bi bi-gender-${isMale(student.gender) ? 'male' : 'female'}`} style={{ marginRight: '4px' }} />{student.gender}
                                                                    </span>
                                                                </div>
                                                                <div style={styles.studentCardActions}>
                                                                    <button onClick={() => navigate(`/student/${student.studentId}`)} style={styles.profileBtn}><i className="bi bi-person-circle" style={{ marginRight: '4px' }} />Profile</button>
                                                                    <button onClick={() => handleEdit(student)} style={isEditing ? styles.cancelEditBtnSm : styles.editBtnSm} title={isEditing ? 'Close editor' : 'Edit'}>
                                                                        <i className={`bi bi-${isEditing ? 'x-lg' : 'pencil-fill'}`} />
                                                                    </button>
                                                                    <button onClick={() => handleDelete(student)} style={styles.deleteBtnSm} title="Delete"><i className="bi bi-trash-fill" /></button>
                                                                </div>
                                                            </div>
                                                            {isEditing && editForm(student)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </>
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' },
    backBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    title: { color: '#1F3864', margin: 0, fontSize: '22px', fontWeight: 800, overflowWrap: 'anywhere' },
    crumbs: { listStyle: 'none', margin: '0 0 4px 0', padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px' },
    crumbItem: { display: 'inline-flex', alignItems: 'center' },
    crumbSep: { color: '#aaa', fontSize: '10px', margin: '0 8px' },
    crumbLink: { color: '#2E75B6', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
    crumbCurrent: { color: '#555', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
    breadcrumb: { color: '#888', margin: '3px 0 0 0', fontSize: '13px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6' },
    notice: { color: '#856404', padding: '10px 16px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffc107', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px' },
    noticeBtn: { marginLeft: 'auto', backgroundColor: '#856404', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
    linkBtn: { background: 'none', border: 'none', color: '#1F3864', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold', padding: 0 },
    addFormCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0', fontWeight: 700, display: 'flex', alignItems: 'center' },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 12px 12px', padding: '16px', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center' },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    inlineForm: {},

    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '11px', fontWeight: 'bold', color: '#1F3864' },
    fieldHint: { fontSize: '11px', color: '#888' },
    input: { padding: '9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '22px' },
    statCard: { backgroundColor: 'white', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    statIcon: { width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 },
    statInfo: { flex: 1 },
    statNum: { fontSize: '26px', fontWeight: 800, display: 'block' },
    statLabel: { fontSize: '12px', color: '#333', fontWeight: 'bold' },
    statMeta: { fontSize: '11px', color: '#999' },
    searchCard: { backgroundColor: 'white', padding: '16px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: '10px', flexWrap: 'wrap' },
    searchInputWrap: { flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    filterSelect: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' },
    sectionBlock: { marginBottom: '25px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    sectionTitle: { padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
    sectionLabel: { color: 'white', fontWeight: 'bold', fontSize: '15px', marginRight: '10px' },
    sectionMeta: { color: 'rgba(255,255,255,0.85)', fontSize: '12px' },
    sectionCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
    gradeTiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', padding: '16px', backgroundColor: 'white' },
    gradeTile: { backgroundColor: 'white', padding: '16px 10px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    gradeLabel: { fontSize: '22px', fontWeight: 800, marginBottom: '4px' },
    gradeStudentCount: { fontSize: '13px', color: '#333', fontWeight: 'bold', marginBottom: '4px' },
    genderRow: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '4px' },
    maleCount: { fontSize: '11px', color: '#2E75B6', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    femaleCount: { fontSize: '11px', color: '#e83e8c', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    gradeClasses: { fontSize: '11px', color: '#999', marginBottom: '6px' },
    viewArrow: { fontSize: '12px', fontWeight: 'bold' },

    streamTiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', padding: '16px', backgroundColor: 'white', borderRadius: '0 0 14px 14px' },
    streamTile: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0', textAlign: 'center', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    streamBadge: { color: 'white', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' },
    streamName: { fontSize: '20px', fontWeight: 800, color: '#1F3864', marginBottom: '12px' },
    streamStats: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' },
    streamStatItem: { textAlign: 'center' },
    streamStatNum: { fontSize: '20px', fontWeight: 800, color: '#1F3864', display: 'block' },
    streamStatLabel: { fontSize: '11px', color: '#999' },
    streamTeacher: { fontSize: '12px', color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    viewStudentsBtn: { fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
    classHeader: { padding: '20px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' },
    classHeaderTitle: { color: 'white', margin: '0 0 5px 0', fontSize: '20px', fontWeight: 800 },
    classHeaderMeta: { color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '13px' },
    classHeaderStats: { display: 'flex', gap: '15px', flexWrap: 'wrap' },
    classStatBox: { textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px 15px', borderRadius: '10px' },
    classStatNum: { color: 'white', fontSize: '24px', fontWeight: 800, display: 'block' },
    classStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: '11px' },
    classSearchBar: { display: 'flex', gap: '10px', padding: '13px 15px', backgroundColor: 'white', marginBottom: '2px', flexWrap: 'wrap' },
    studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px', padding: '16px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    studentCard: { backgroundColor: '#f8f9fa', borderRadius: '12px', border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    studentCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px 0 12px' },
    studentRankBadge: { fontSize: '11px', color: '#999', fontWeight: 'bold' },
    studentAvatar: { width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '15px' },
    studentCardBody: { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' },
    studentName: { fontSize: '13px', color: '#1F3864' },
    studentAdm: { fontSize: '11px', color: '#999', fontFamily: 'monospace' },
    genderBadge: { color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', width: 'fit-content' },
    studentCardActions: { display: 'flex', gap: '4px', padding: '8px 12px', borderTop: '1px solid #eee', backgroundColor: 'white', borderRadius: '0 0 12px 12px' },
    profileBtn: { flex: 1, backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    editBtnSm: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    cancelEditBtnSm: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    deleteBtnSm: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    tableCard: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: '22px' },
    tableTopBar: { backgroundColor: '#1F3864', padding: '13px 20px' },
    tableTitle: { color: 'white', margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
    thead: { backgroundColor: '#f8f9fa' },
    th: { padding: '11px 15px', textAlign: 'left', fontWeight: 'bold', color: '#1F3864', borderBottom: '2px solid #eee', fontSize: '12px' },
    td: { padding: '10px 15px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    trEven: { backgroundColor: '#f9f9f9' },
    trOdd: { backgroundColor: 'white' },
    admNo: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' },
    viewBtn: { backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '0 0 14px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px', color: '#ccc' },
};

export default Students;
