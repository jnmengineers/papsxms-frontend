import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { EXAM_TYPES_LIVE, CORE_TYPES_LIVE, SECTIONS_LIVE } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

// Exam types and sections come from School Settings
const EXAM_TYPES = EXAM_TYPES_LIVE;
const CORE_TYPES = CORE_TYPES_LIVE;
const SECTIONS = SECTIONS_LIVE;
const EMPTY_FORM = { examName: '', academicYear: '', academicYearId: '', term: '', startDate: '', endDate: '', classLevel: '', examType: '', termOpeningDate: '', termClosingDate: '' };

const isActiveTerm = (y) => !!(y?.isActive ?? y?.active);
const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');
const fmtDate = (d) => {
    if (!d) return '-';
    const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
    return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const norm = (v) => String(v ?? '').trim().toLowerCase();
const sectionColor = (level) => SECTIONS.find(s => s.grades.includes(level))?.color || '#1F3864';
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
// Does one class level cover another? "ALL" overlaps everything.
const levelsOverlap = (a, b) => a === 'ALL' || b === 'ALL' || a === b;

// Outside parent — prevents keyboard dismiss on mobile
const ExamForm = ({ formData, setFormData, academicYears, exams, onSubmit, onCancel, submitLabel, submitIcon, saving }) => {
    const handleAcademicYearChange = (yearId) => {
        const selected = academicYears.find(ay => String(ay.yearId) === String(yearId));
        if (!selected) { setFormData(prev => ({ ...prev, academicYearId: '', academicYear: '', term: '', startDate: '', endDate: '' })); return; }
        // Re-use the opening/closing dates already set on another exam of the same term
        const sibling = (exams || []).find(e =>
            String(e.academicYear) === String(selected.yearLabel) && String(e.term) === String(selected.term) &&
            (e.termOpeningDate || e.termClosingDate));
        setFormData(prev => ({
            ...prev,
            academicYearId: selected.yearId, academicYear: String(selected.yearLabel), term: String(selected.term),
            startDate: toDateInput(selected.startDate), endDate: toDateInput(selected.endDate),
            termOpeningDate: toDateInput(sibling?.termOpeningDate) || prev.termOpeningDate || '',
            termClosingDate: toDateInput(sibling?.termClosingDate) || prev.termClosingDate || ''
        }));
    };
    const type = EXAM_TYPES[formData.examType];

    return (
        <form onSubmit={onSubmit} style={styles.inlineForm}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="calendar3" />Academic Year & Term <span style={styles.autoTag}>Fills dates</span></label>
                    <select style={styles.input} value={formData.academicYearId ? String(formData.academicYearId) : ''}
                        onChange={e => handleAcademicYearChange(e.target.value)} required>
                        <option value="">-- Select Year & Term --</option>
                        {[...academicYears].sort((a, b) => String(b.yearLabel).localeCompare(String(a.yearLabel)) || Number(b.term) - Number(a.term)).map(ay => (
                            <option key={ay.yearId} value={String(ay.yearId)}>
                                {ay.yearLabel} | Term {ay.term}{isActiveTerm(ay) ? ' (current)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="bookmark-fill" />Exam Type</label>
                    <select style={styles.input} value={formData.examType || ''} required
                        onChange={e => {
                            const t = e.target.value;
                            // Fill the name from the type unless the user already typed their own
                            setFormData(prev => ({ ...prev, examType: t, examName: !prev.examName || Object.values(EXAM_TYPES).some(x => x.label === prev.examName) ? (EXAM_TYPES[t]?.label || '') : prev.examName }));
                        }}>
                        <option value="">-- Select Type --</option>
                        {Object.entries(EXAM_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="file-earmark-text" />Exam Name</label>
                    <input style={styles.input} value={formData.examName} maxLength={60}
                        onChange={e => setFormData(prev => ({ ...prev, examName: e.target.value }))}
                        placeholder="e.g. Opening, Mid Term, End Term" required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="building" />Class Level</label>
                    <select style={styles.input} value={formData.classLevel} required
                        onChange={e => setFormData(prev => ({ ...prev, classLevel: e.target.value }))}>
                        <option value="">Select Class Level</option>
                        <option value="ALL">All Classes</option>
                        {SECTIONS.map(s => (
                            <optgroup key={s.value} label={s.label}>
                                {s.grades.map(g => <option key={g} value={g}>{g}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="door-open" />Term Opening Date <span style={styles.autoTag}>Report cards</span></label>
                    <input type="date" style={styles.input} value={formData.termOpeningDate || ''}
                        onChange={e => setFormData(prev => ({ ...prev, termOpeningDate: e.target.value }))} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><Icon name="door-closed" />Term Closing Date <span style={styles.autoTag}>Report cards</span></label>
                    <input type="date" style={styles.input} value={formData.termClosingDate || ''} min={formData.termOpeningDate || undefined}
                        onChange={e => setFormData(prev => ({ ...prev, termClosingDate: e.target.value }))} />
                </div>
            </div>

            {formData.academicYearId && formData.term && (
                <div style={styles.autoFillPreview}>
                    <span style={styles.autoFillItem}><Icon name="calendar3" />Year <strong>{formData.academicYear}</strong></span>
                    <span style={styles.autoFillItem}><Icon name="bookmark" />Term <strong>{formData.term}</strong></span>
                    <span style={styles.autoFillItem}><Icon name="calendar-range" />{fmtDate(formData.startDate)} – {fmtDate(formData.endDate)}</span>
                    {(formData.termOpeningDate || formData.termClosingDate) && (
                        <span style={{ ...styles.autoFillItem, ...styles.pillBg, backgroundColor: '#d4edda' }}>
                            <Icon name="door-open" />{fmtDate(formData.termOpeningDate)} <Icon name="arrow-right" style={{ margin: '0 4px' }} /><Icon name="door-closed" />{fmtDate(formData.termClosingDate)}
                        </span>
                    )}
                    {type && <span style={{ ...styles.autoFillItem, ...styles.pillBg, backgroundColor: type.color, color: 'white', fontWeight: 'bold' }}>{type.label}</span>}
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

function Exams() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [yearsLoaded, setYearsLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);
    const formRef = useRef(null);

    useEffect(() => {
        fetchExams(); fetchAcademicYears();
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3500);
    };

    const fetchExams = async () => {
        try { const r = await api.get('/api/exams'); setExams(r.data || []); }
        catch (err) { setError('Failed to load exams. Check your connection and refresh.'); }
        setLoading(false);
    };
    const fetchAcademicYears = async () => {
        try { const r = await api.get('/api/academic-years'); setAcademicYears(r.data || []); }
        catch (err) { setError('Failed to load academic years — you won\'t be able to pick a term until you refresh.'); }
        setYearsLoaded(true);
    };

    const yearFor = (label, term) => academicYears.find(a => String(a.yearLabel) === String(label) && String(a.term) === String(term));

    const openAddForm = (prefill = {}) => {
        setEditingExam(null);
        setFormData({ ...EMPTY_FORM, ...prefill }); // never carry over an exam that was being edited
        setShowAddForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); setFormData(EMPTY_FORM); return; }
        const current = academicYears.find(isActiveTerm);
        openAddForm(current ? prefillForYear(current) : {});
    };

    // Clicking an empty "Add Mid Term" slot fills in that group's year, term and type
    const prefillForYear = (ay, type) => {
        const sibling = exams.find(e => String(e.academicYear) === String(ay.yearLabel) && String(e.term) === String(ay.term) && (e.termOpeningDate || e.termClosingDate));
        return {
            academicYearId: ay.yearId, academicYear: String(ay.yearLabel), term: String(ay.term),
            startDate: toDateInput(ay.startDate), endDate: toDateInput(ay.endDate),
            termOpeningDate: toDateInput(sibling?.termOpeningDate), termClosingDate: toDateInput(sibling?.termClosingDate),
            ...(type ? { examType: type, examName: EXAM_TYPES[type].label, classLevel: 'ALL' } : {})
        };
    };

    const handleEdit = (exam) => {
        if (editingExam?.examId === exam.examId) { handleCancelEdit(); return; }
        setEditingExam(exam);
        const ay = exam.academicYearRef?.yearId ? academicYears.find(a => String(a.yearId) === String(exam.academicYearRef.yearId)) : yearFor(exam.academicYear, exam.term);
        setFormData({
            examName: exam.examName || '', academicYear: String(exam.academicYear ?? ''), academicYearId: ay?.yearId || '',
            term: String(exam.term ?? ''), startDate: toDateInput(exam.startDate), endDate: toDateInput(exam.endDate),
            classLevel: exam.classLevel || '', examType: exam.examType || '',
            termOpeningDate: toDateInput(exam.termOpeningDate), termClosingDate: toDateInput(exam.termClosingDate)
        });
        setShowAddForm(false);
    };
    const handleCancelEdit = () => { setEditingExam(null); setFormData(EMPTY_FORM); };

    // Duplicates break reports: Progressive and Section reports pick exams by type within a term,
    // and Import picks by name within a term
    const validate = (exceptId) => {
        if (formData.termOpeningDate && formData.termClosingDate && formData.termClosingDate <= formData.termOpeningDate) {
            return 'Term closing date must be after the opening date.';
        }
        const sameTerm = exams.filter(e => String(e.examId) !== String(exceptId ?? '') &&
            String(e.academicYear) === String(formData.academicYear) && String(e.term) === String(formData.term));
        const sameName = sameTerm.find(e => norm(e.examName) === norm(formData.examName));
        if (sameName) return `"${formData.examName}" already exists in ${formData.academicYear} Term ${formData.term}. Use a different name.`;
        if (formData.examType !== 'EXTRA') {
            const sameType = sameTerm.find(e => e.examType === formData.examType && levelsOverlap(e.classLevel, formData.classLevel));
            if (sameType) return `${formData.academicYear} Term ${formData.term} already has a ${EXAM_TYPES[formData.examType].label} exam for ${sameType.classLevel === 'ALL' ? 'all classes' : sameType.classLevel} ("${sameType.examName}").`;
        }
        return null;
    };

    const buildPayload = () => ({
        examName: formData.examName.trim(),
        academicYear: formData.academicYear,
        term: parseInt(formData.term, 10),
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        classLevel: formData.classLevel,
        examType: formData.examType || null,
        termOpeningDate: formData.termOpeningDate || null,
        termClosingDate: formData.termClosingDate || null,
        ...(formData.academicYearId && { academicYearRef: { yearId: formData.academicYearId } })
    });

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate();
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.post('/api/exams', buildPayload());
            flashSuccess(`${formData.examName.trim()} added to ${formData.academicYear} Term ${formData.term}.`);
            setShowAddForm(false); setFormData(EMPTY_FORM); fetchExams();
        } catch (err) { setError(serverMessage(err, 'Failed to save exam')); }
        setSaving(false);
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate(editingExam.examId);
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            await api.put(`/api/exams/${editingExam.examId}`, buildPayload());
            flashSuccess(`${formData.examName.trim()} updated.`);
            handleCancelEdit(); fetchExams();
        } catch (err) { setError(serverMessage(err, 'Failed to update exam')); }
        setSaving(false);
    };

    const handleDelete = async (exam) => {
        setError('');
        // Say exactly what will be lost
        let markCount = null;
        try { markCount = ((await api.get(`/api/results/by-exam/${exam.examId}`)).data || []).length; } catch (e) { /* unknown */ }
        const loss = markCount === null ? 'all its marks and report cards'
            : markCount === 0 ? 'no marks (none entered yet)'
            : `${markCount} mark(s) and their report cards`;
        if (!window.confirm(`Delete "${exam.examName}" (${exam.academicYear} Term ${exam.term})?\n\nThis also deletes ${loss}. It cannot be undone.`)) return;
        if (markCount > 0 && window.prompt(`Type the exam name "${exam.examName}" to confirm deleting ${markCount} mark(s):`)?.trim() !== exam.examName.trim()) {
            setError('Delete cancelled — the exam name didn\'t match.');
            return;
        }
        setDeletingId(exam.examId);
        try {
            await api.delete(`/api/exams/${exam.examId}`);
            if (editingExam?.examId === exam.examId) handleCancelEdit();
            await fetchExams();
            flashSuccess(`"${exam.examName}" deleted.`);
        } catch (err) { setError(serverMessage(err, 'Failed to delete exam')); }
        setDeletingId(null);
    };

    // Group by year + term, newest first
    const groups = Object.values(exams.reduce((acc, exam) => {
        const key = `${exam.academicYear}|${exam.term}`;
        if (!acc[key]) acc[key] = { year: String(exam.academicYear ?? ''), term: String(exam.term ?? ''), exams: [] };
        acc[key].exams.push(exam);
        return acc;
    }, {}))
        .sort((a, b) => b.year.localeCompare(a.year) || Number(b.term) - Number(a.term))
        .map(g => ({ ...g, exams: g.exams.sort((a, b) => (EXAM_TYPES[a.examType]?.order || 9) - (EXAM_TYPES[b.examType]?.order || 9) || String(a.examName).localeCompare(String(b.examName))) }));

    const linkClick = (e, path) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); navigate(path);
    };

    return (
        <div style={styles.container}>
          <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}><Icon name="file-earmark-text-fill" style={{ marginRight: '10px' }} />Exams</h2>
                        <p style={styles.subtitle}>{exams.length} exam(s) — grouped by academic year and term</p>
                    </div>
                    <button onClick={toggleAddForm} style={styles.addBtn} disabled={!yearsLoaded}>
                        {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Exam</>}
                    </button>
                </div>

                {yearsLoaded && academicYears.length === 0 && (
                    <div style={styles.warningBanner}>
                        <Icon name="exclamation-triangle-fill" />No academic terms found.{' '}
                        <a href="/academic-years" onClick={e => linkClick(e, '/academic-years')} style={{ color: '#856404', fontWeight: 'bold' }}>Set up Academic Years first</a> so exams can be linked to a term.
                    </div>
                )}
                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" />{error}
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                {showAddForm && (
                    <div style={styles.addFormCard} ref={formRef}>
                        <h3 style={styles.formTitle}><Icon name="plus-circle" />Add New Exam</h3>
                        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 15px 0' }}>
                            <Icon name="lightbulb" />Each term normally has three exams: Opening, Mid Term and End Term.
                        </p>
                        <ExamForm formData={formData} setFormData={setFormData} academicYears={academicYears} exams={exams}
                            onSubmit={handleSubmitAdd} onCancel={() => { setShowAddForm(false); setFormData(EMPTY_FORM); }}
                            submitLabel="Save Exam" submitIcon="save-fill" saving={saving} />
                    </div>
                )}

                {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading exams...</p> : groups.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Icon name="file-earmark-text" style={{ fontSize: '48px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '15px' }} />
                        <h3>No Exams Yet</h3>
                        <p>Click <strong>Add Exam</strong> to create your first exam.</p>
                        <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>Add three per term: Opening, Mid Term, End Term.</p>
                    </div>
                ) : groups.map(group => {
                    const coreDone = CORE_TYPES.filter(t => group.exams.some(e => e.examType === t)).length;
                    const extras = group.exams.filter(e => !CORE_TYPES.includes(e.examType)).length;
                    const ay = yearFor(group.year, group.term);
                    return (
                        <div key={`${group.year}|${group.term}`} style={styles.groupBlock}>
                            <div style={styles.groupHeader}>
                                <span style={styles.groupTitle}>
                                    <Icon name="calendar3" />{group.year} — Term {group.term}
                                    {ay && isActiveTerm(ay) && <span style={styles.currentTag}>Current</span>}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {CORE_TYPES.map(type => {
                                        const exists = group.exams.some(e => e.examType === type);
                                        return (
                                            <span key={type} style={{ ...styles.typeChip, backgroundColor: exists ? EXAM_TYPES[type].color : 'rgba(255,255,255,0.1)', color: exists ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: exists ? 'bold' : 'normal' }}>
                                                <Icon name={exists ? 'check-circle-fill' : 'circle'} style={{ marginRight: '4px' }} />{EXAM_TYPES[type].label}
                                            </span>
                                        );
                                    })}
                                    <span style={styles.groupCount}>{coreDone}/3 core{extras ? ` + ${extras} extra` : ''}</span>
                                </div>
                            </div>
                            <div style={styles.examGrid}>
                                {group.exams.map(exam => {
                                    const t = EXAM_TYPES[exam.examType];
                                    const isEditing = editingExam?.examId === exam.examId;
                                    const busy = deletingId === exam.examId;
                                    return (
                                        <div key={exam.examId} style={isEditing ? { gridColumn: '1 / -1' } : undefined}>
                                            <div style={{ ...styles.examCard, outline: isEditing ? '2px solid #2E75B6' : 'none' }}>
                                                <div style={{ height: '5px', backgroundColor: t?.color || '#1F3864' }} />
                                                <div style={styles.examHeader}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {t && <span style={{ ...styles.typeTag, backgroundColor: t.color }}>{t.label}</span>}
                                                        <h3 style={styles.examName}>{exam.examName}</h3>
                                                        <p style={styles.examMeta}>{exam.academicYear} • Term {exam.term}</p>
                                                    </div>
                                                    <span style={{ ...styles.levelBadge, backgroundColor: sectionColor(exam.classLevel) }}>
                                                        {exam.classLevel === 'ALL' ? 'All classes' : exam.classLevel}
                                                    </span>
                                                </div>
                                                <div style={styles.examBody}>
                                                    <div style={styles.infoItem}>
                                                        <Icon name="calendar-range" style={styles.infoIcon} />
                                                        <div><div style={styles.infoLabel}>Term period</div><div style={styles.infoValue}>{fmtDate(exam.startDate)} – {fmtDate(exam.endDate)}</div></div>
                                                    </div>
                                                    <div style={styles.infoItem}>
                                                        <Icon name="door-open" style={styles.infoIcon} />
                                                        <div>
                                                            <div style={styles.infoLabel}>On report cards</div>
                                                            <div style={styles.infoValue}>
                                                                {exam.termOpeningDate || exam.termClosingDate
                                                                    ? <>Opens {fmtDate(exam.termOpeningDate)} · Closes {fmtDate(exam.termClosingDate)}</>
                                                                    : <span style={{ color: '#b26a00', fontWeight: 'normal' }}>Not set — report cards will show "-"</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={styles.examActions}>
                                                    <a href="/results" onClick={e => linkClick(e, '/results')} style={styles.resultsBtn}><Icon name="bar-chart-fill" />Results</a>
                                                    <button onClick={() => handleEdit(exam)} style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                        {isEditing ? <><Icon name="x-lg" />Close</> : <><Icon name="pencil-fill" />Edit</>}
                                                    </button>
                                                    <button onClick={() => handleDelete(exam)} style={styles.deleteBtn} disabled={busy} title="Delete exam" aria-label={`Delete ${exam.examName}`}>
                                                        <i className={`bi bi-${busy ? 'hourglass-split' : 'trash-fill'}`} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                            {isEditing && (
                                                <div style={styles.inlineEditCard}>
                                                    <div style={styles.inlineEditHeader}>
                                                        <h3 style={styles.inlineEditTitle}><Icon name="pencil-fill" />Editing: {exam.examName}</h3>
                                                        <button onClick={handleCancelEdit} style={styles.closeBtn} aria-label="Close"><i className="bi bi-x-lg" /></button>
                                                    </div>
                                                    <ExamForm formData={formData} setFormData={setFormData} academicYears={academicYears} exams={exams}
                                                        onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                        submitLabel="Update Exam" submitIcon="check-circle-fill" saving={saving} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {CORE_TYPES.filter(type => !group.exams.some(e => e.examType === type)).map(type => (
                                    <button key={type} type="button" style={styles.missingExamCard}
                                        disabled={!ay}
                                        title={ay ? `Add the ${EXAM_TYPES[type].label} exam for ${group.year} Term ${group.term}` : 'This term is not in Academic Years'}
                                        onClick={() => ay && openAddForm(prefillForYear(ay, type))}>
                                        <div style={{ height: '5px', backgroundColor: EXAM_TYPES[type].color, opacity: 0.35 }} />
                                        <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                                            <i className="bi bi-plus-circle" aria-hidden="true" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }} />
                                            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{EXAM_TYPES[type].label}</div>
                                            <div style={{ fontSize: '11px', marginTop: '4px' }}>{ay ? 'Click to add' : 'Add the term in Academic Years first'}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        <Footer />
     </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    warningBanner: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '13px 16px', borderRadius: '10px', marginBottom: '15px', color: '#856404', fontSize: '14px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    addFormCard: { backgroundColor: 'white', padding: '25px', borderRadius: '14px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864', scrollMarginTop: '80px' },
    formTitle: { color: '#1F3864', margin: '0 0 8px 0', fontWeight: 700 },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 12px 12px', padding: '20px', boxShadow: '0 6px 16px rgba(0,0,0,0.1)', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px', marginBottom: '8px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '15px', fontWeight: 700 },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
    autoTag: { backgroundColor: '#2E75B6', color: 'white', padding: '1px 7px', borderRadius: '6px', fontSize: '9px', fontWeight: 'normal' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', outline: 'none', backgroundColor: 'white' },
    autoFillPreview: { display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#e3f2fd', padding: '11px 16px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #2E75B6', alignItems: 'center' },
    autoFillItem: { fontSize: '13px', color: '#1F3864', display: 'inline-flex', alignItems: 'center' },
    pillBg: { padding: '3px 10px', borderRadius: '8px' },
    btnGroup: { display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
    groupBlock: { marginBottom: '30px' },
    groupHeader: { backgroundColor: '#1F3864', padding: '14px 22px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
    groupTitle: { color: 'white', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center' },
    currentTag: { marginLeft: '10px', backgroundColor: '#28a745', color: 'white', padding: '2px 9px', borderRadius: '10px', fontSize: '11px' },
    typeChip: { fontSize: '11px', padding: '3px 10px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center' },
    groupCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' },
    examGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '16px', padding: '18px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    examCard: { backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' },
    missingExamCard: { backgroundColor: '#fafafa', borderRadius: '14px', overflow: 'hidden', border: '2px dashed #ddd', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'center' },
    examHeader: { padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', backgroundColor: '#1F3864' },
    typeTag: { color: 'white', padding: '2px 9px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', display: 'inline-block', marginBottom: '6px' },
    examName: { color: 'white', margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, overflowWrap: 'anywhere' },
    examMeta: { color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '12px' },
    levelBadge: { color: 'white', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    examBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '6px' },
    infoIcon: { fontSize: '16px', color: '#2E75B6' },
    infoLabel: { fontSize: '11px', color: '#888' },
    infoValue: { fontSize: '13px', color: '#333', fontWeight: 'bold' },
    examActions: { borderTop: '1px solid #eee', padding: '11px 15px', display: 'flex', gap: '8px', backgroundColor: '#f8f9fa' },
    resultsBtn: { flex: 2, backgroundColor: '#28a745', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    editBtn: { flex: 2, backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cancelEditBtn: { flex: 2, backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { flex: 1, backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default Exams;
