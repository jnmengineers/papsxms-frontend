import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { PROMOTION_MAP_LIVE, GRADE_LABELS_LIVE, gradeRankOf, lastGrades } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { yearLabel: '', term: '', startDate: '', endDate: '', isActive: false };
// Promotion order and grades come from School Settings (Grades & Promotion)
const PROMOTION_MAP = PROMOTION_MAP_LIVE;
const gradeIdx = (g) => gradeRankOf(g);
const isLastGrade = (g) => !!g && lastGrades().includes(g);

// Spring/Lombok often sends a boolean "isActive" field as "active" — accept either
const isActiveOf = (y) => !!(y?.isActive ?? y?.active);
const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');
const fmtDate = (d) => {
    if (!d) return '-';
    const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
    return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const runLimited = async (items, limit, job, onProgress) => {
    const out = new Array(items.length);
    let next = 0, done = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            try { out[i] = { ok: true, value: await job(items[i]) }; }
            catch (err) { out[i] = { ok: false, error: err }; }
            onProgress?.(++done, items.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
};

// Outside parent — prevents keyboard dismiss on mobile
const YearForm = ({ formData, setFormData, onSubmit, onCancel, submitLabel, submitIcon, saving }) => (
    <form onSubmit={onSubmit} style={styles.inlineForm}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}><Icon name="calendar3" />Year</label>
                <input style={styles.input} value={formData.yearLabel} inputMode="numeric" maxLength={4}
                    onChange={e => setFormData(prev => ({ ...prev, yearLabel: e.target.value.replace(/\D/g, '') }))}
                    placeholder="e.g. 2026" required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}><Icon name="bookmark-fill" />Term</label>
                <select style={styles.input} value={formData.term}
                    onChange={e => setFormData(prev => ({ ...prev, term: e.target.value }))} required>
                    <option value="">Select Term</option>
                    <option value="1">Term 1 (Jan – Apr)</option>
                    <option value="2">Term 2 (May – Aug)</option>
                    <option value="3">Term 3 (Sep – Dec)</option>
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}><Icon name="calendar-event" />Start Date</label>
                <input type="date" style={styles.input} value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}><Icon name="calendar-check" />End Date</label>
                <input type="date" style={styles.input} value={formData.endDate} min={formData.startDate || undefined}
                    onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}><Icon name="toggle-on" />Status</label>
                <select style={styles.input} value={String(formData.isActive)}
                    onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}>
                    <option value="false">Inactive</option>
                    <option value="true">Active (current term)</option>
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

function AcademicYears() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingYear, setEditingYear] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [showPromote, setShowPromote] = useState(false);
    const [promotionPairs, setPromotionPairs] = useState([]);
    const [classCounts, setClassCounts] = useState({});
    const [loadingPromote, setLoadingPromote] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [promotionProgress, setPromotionProgress] = useState(null);
    const [promotionResult, setPromotionResult] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const successTimer = useRef(null);

    useEffect(() => {
        fetchYears(); fetchClasses();
        return () => clearTimeout(successTimer.current);
    }, []);

    // Closing the tab mid-promotion would leave some classes moved and others not
    useEffect(() => {
        if (!promoting) return;
        const h = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [promoting]);

    const flashSuccess = (msg, ms = 3500) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), ms);
    };

    const fetchYears = async () => {
        try { const r = await api.get('/api/academic-years'); setYears(r.data || []); }
        catch (err) { setError('Failed to load academic years. Check your connection and refresh.'); }
        setLoading(false);
    };
    const fetchClasses = async () => {
        try { const r = await api.get('/api/classes'); setClasses(r.data || []); }
        catch (err) { setError('Failed to load classes — promotion won\'t work until you refresh.'); }
    };

    // Send both spellings of the active flag so it saves whichever the backend uses
    const payloadFor = (data) => ({
        yearLabel: String(data.yearLabel).trim(), term: parseInt(data.term, 10),
        startDate: data.startDate, endDate: data.endDate,
        isActive: !!data.isActive, active: !!data.isActive
    });

    // Only one term can be the current term — switch the others off
    const deactivateOthers = async (keepId) => {
        const others = years.filter(y => isActiveOf(y) && String(y.yearId) !== String(keepId ?? ''));
        await Promise.all(others.map(y => api.put(`/api/academic-years/${y.yearId}`, {
            ...payloadFor({ ...y, startDate: toDateInput(y.startDate), endDate: toDateInput(y.endDate) }), isActive: false, active: false
        })));
    };

    const validate = (data, exceptId) => {
        if (!/^\d{4}$/.test(String(data.yearLabel).trim())) return 'Year must be 4 digits, e.g. 2026.';
        if (data.startDate && data.endDate && data.endDate <= data.startDate) return 'End date must be after the start date.';
        const dup = years.find(y => String(y.yearId) !== String(exceptId ?? '') &&
            String(y.yearLabel).trim() === String(data.yearLabel).trim() && String(y.term) === String(data.term));
        if (dup) return `${data.yearLabel} Term ${data.term} already exists.`;
        const overlap = years.find(y => String(y.yearId) !== String(exceptId ?? '') && y.startDate && y.endDate &&
            data.startDate <= toDateInput(y.endDate) && data.endDate >= toDateInput(y.startDate));
        if (overlap) return `These dates overlap ${overlap.yearLabel} Term ${overlap.term} (${fmtDate(overlap.startDate)} – ${fmtDate(overlap.endDate)}).`;
        return null;
    };

    const resetForm = () => setFormData(EMPTY_FORM);

    const toggleAddForm = () => {
        if (showAddForm) { setShowAddForm(false); resetForm(); return; }
        setEditingYear(null); resetForm(); setShowAddForm(true);
    };

    const handleEdit = (year) => {
        if (editingYear?.yearId === year.yearId) { handleCancelEdit(); return; }
        setEditingYear(year);
        setFormData({ yearLabel: String(year.yearLabel ?? ''), term: String(year.term ?? ''), startDate: toDateInput(year.startDate), endDate: toDateInput(year.endDate), isActive: isActiveOf(year) });
        setShowAddForm(false);
    };
    const handleCancelEdit = () => { setEditingYear(null); resetForm(); };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate(formData);
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            if (formData.isActive) await deactivateOthers(null);
            await api.post('/api/academic-years', payloadFor(formData));
            setShowAddForm(false); resetForm(); await fetchYears();
            flashSuccess(`${formData.yearLabel} Term ${formData.term} added${formData.isActive ? ' and set as the current term' : ''}.`);
        } catch (err) { setError(serverMessage(err, 'Failed to save academic term')); await fetchYears(); }
        setSaving(false);
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate(formData, editingYear.yearId);
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        try {
            if (formData.isActive) await deactivateOthers(editingYear.yearId);
            await api.put(`/api/academic-years/${editingYear.yearId}`, payloadFor(formData));
            handleCancelEdit(); await fetchYears();
            flashSuccess(`${formData.yearLabel} Term ${formData.term} updated.`);
        } catch (err) { setError(serverMessage(err, 'Failed to update academic term')); await fetchYears(); }
        setSaving(false);
    };

    const handleDelete = async (year) => {
        setSaving(true); setError('');
        try {
            await api.delete(`/api/academic-years/${year.yearId}`);
            if (editingYear?.yearId === year.yearId) handleCancelEdit();
            setDeleteConfirm(null); await fetchYears();
            flashSuccess(`${year.yearLabel} Term ${year.term} deleted.`);
        } catch (err) {
            setDeleteConfirm(null);
            setError(serverMessage(err, `${year.yearLabel} Term ${year.term} could not be deleted — exams may still be linked to it.`));
        }
        setSaving(false);
    };

    const handleSetActive = async (year) => {
        const activating = !isActiveOf(year);
        const current = years.find(y => isActiveOf(y) && y.yearId !== year.yearId);
        if (activating && current && !window.confirm(`Make ${year.yearLabel} Term ${year.term} the current term?\n\n${current.yearLabel} Term ${current.term} will be switched off.`)) return;
        setSaving(true); setError('');
        try {
            if (activating) await deactivateOthers(year.yearId);
            await api.put(`/api/academic-years/${year.yearId}`, {
                ...payloadFor({ ...year, startDate: toDateInput(year.startDate), endDate: toDateInput(year.endDate) }),
                isActive: activating, active: activating
            });
            await fetchYears();
            flashSuccess(activating ? `${year.yearLabel} Term ${year.term} is now the current term.` : `${year.yearLabel} Term ${year.term} deactivated.`);
        } catch (err) { setError(serverMessage(err, 'Failed to update status')); await fetchYears(); }
        setSaving(false);
    };

    // ── PROMOTION ────────────────────────────────────────────────────────────
    const findNextClass = (cls) => {
        const nextGrade = PROMOTION_MAP[cls.gradeLevel];
        if (!nextGrade) return null;
        const inNext = classes.filter(c => c.gradeLevel === nextGrade);
        return inNext.find(c => (c.stream || '') === (cls.stream || ''))                       // same stream
            || (cls.stream && inNext.find(c => c.stream?.charAt(0).toUpperCase() === cls.stream.charAt(0).toUpperCase()))
            || (inNext.length === 1 ? inNext[0] : null);                                    // only one option
    };

    const openPromotion = async () => {
        setError(''); setPromotionResult(null); setPromotionProgress(null); setConfirmText('');
        setLoadingPromote(true); setShowPromote(true);
        try {
            const studentsRes = await api.get('/api/students');
            const counts = {};
            (studentsRes.data || []).forEach(s => { const id = s.schoolClass?.classId; if (id != null) counts[id] = (counts[id] || 0) + 1; });
            setClassCounts(counts);
        } catch (err) { setError('Could not count students per class.'); }
        const pairs = [...classes]
            .sort((a, b) => gradeIdx(a.gradeLevel) - gradeIdx(b.gradeLevel) || classDisplayName(a).localeCompare(classDisplayName(b)))
            .map(cls => {
                const graduates = isLastGrade(cls.gradeLevel);
                const next = graduates ? null : findNextClass(cls);
                return {
                    fromClassId: String(cls.classId), fromLabel: classDisplayName(cls), fromGrade: cls.gradeLevel,
                    toClassId: next ? String(next.classId) : '',
                    graduates, skip: graduates,
                    unknownGrade: !graduates && !PROMOTION_MAP[cls.gradeLevel]
                };
            });
        setPromotionPairs(pairs);
        setLoadingPromote(false);
    };

    const updatePair = (i, patch) => setPromotionPairs(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));

    const activePairs = promotionPairs.filter(p => !p.skip && p.toClassId);
    const studentsToMove = activePairs.reduce((s, p) => s + (classCounts[p.fromClassId] || 0), 0);
    const needsTarget = promotionPairs.filter(p => !p.skip && !p.toClassId);
    // Two classes promoted into the same class = streams being merged; point it out
    const targetUse = {};
    activePairs.forEach(p => { targetUse[p.toClassId] = (targetUse[p.toClassId] || 0) + 1; });
    const classLabel = (id) => { const c = classes.find(x => String(x.classId) === String(id)); return c ? classDisplayName(c) : '?'; };

    const handlePromote = async () => {
        if (!activePairs.length || confirmText.trim().toUpperCase() !== 'PROMOTE') return;
        setPromoting(true); setError('');
        try {
            // IMPORTANT: take ONE snapshot of where every student is BEFORE moving anyone.
            // Moving class by class and re-reading after each move would push G1 students
            // into G2, then on into G3 when G2 is processed, and so on up the school.
            const snapshot = (await api.get('/api/students')).data || [];
            const moves = [];
            activePairs.forEach(pair => {
                snapshot.filter(s => String(s.schoolClass?.classId) === pair.fromClassId)
                    .forEach(student => moves.push({ student, pair }));
            });
            setPromotionProgress({ done: 0, total: moves.length });
            const outs = await runLimited(moves, 5,
                m => api.put(`/api/students/${m.student.studentId}/move-class/${m.pair.toClassId}`),
                (done, total) => setPromotionProgress({ done, total }));
            const failures = [];
            outs.forEach((o, i) => {
                if (!o.ok) failures.push(`${moves[i].student.firstName} ${moves[i].student.lastName} (${moves[i].student.admissionNumber}) — ${moves[i].pair.fromLabel}: ${serverMessage(o.error, 'failed')}`);
            });
            setPromotionResult({ moved: moves.length - failures.length, failures });
            await fetchClasses();
            if (!failures.length) flashSuccess(`Promotion complete — ${moves.length} student(s) moved up.`, 6000);
        } catch (err) {
            setError(serverMessage(err, 'Promotion could not start. Nothing was changed.'));
        }
        setPromoting(false);
        setConfirmText('');
    };

    const closePromotion = () => { if (!promoting) setShowPromote(false); };

    // ── Grouping for display ─────────────────────────────────────────────────
    const groupedYears = years.reduce((groups, y) => {
        const key = String(y.yearLabel);
        (groups[key] = groups[key] || []).push(y);
        return groups;
    }, {});
    const activeTerms = years.filter(isActiveOf);
    const activeYear = activeTerms[0];

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
            <Sidebar />
            <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}><Icon name="calendar3" style={{ marginRight: '10px' }} />Academic Years</h2>
                        <p style={styles.subtitle}>
                            {activeYear
                                ? <span>Current term: <strong>{activeYear.yearLabel} — Term {activeYear.term}</strong> ({fmtDate(activeYear.startDate)} – {fmtDate(activeYear.endDate)})</span>
                                : 'No current term set'}
                        </p>
                    </div>
                    <div style={styles.headerBtns}>
                        <button onClick={openPromotion} style={styles.promoteBtn} disabled={!classes.length}><Icon name="mortarboard-fill" />Promote Students</button>
                        <button onClick={toggleAddForm} style={styles.addBtn}>
                            {showAddForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Term</>}
                        </button>
                    </div>
                </div>

                {activeTerms.length > 1 && (
                    <div style={styles.warning}>
                        <Icon name="exclamation-triangle-fill" />
                        {activeTerms.length} terms are marked active ({activeTerms.map(t => `${t.yearLabel} T${t.term}`).join(', ')}). Only one should be — click <strong>Set Current</strong> on the right one to fix it.
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
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}><Icon name="plus-circle" />Add Academic Term</h3>
                        <YearForm formData={formData} setFormData={setFormData}
                            onSubmit={handleSubmitAdd} onCancel={() => { setShowAddForm(false); resetForm(); }}
                            submitLabel="Save" submitIcon="save-fill" saving={saving} />
                    </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.smallModal}>
                            <h3 style={{ color: '#dc3545', margin: '0 0 12px 0' }}><Icon name="exclamation-triangle-fill" />Delete Academic Term?</h3>
                            <p style={{ color: '#555', marginBottom: '20px' }}>
                                Delete <strong>{deleteConfirm.yearLabel} — Term {deleteConfirm.term}</strong>?
                                {isActiveOf(deleteConfirm) && <> This is the <strong>current term</strong>.</>} This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeleteConfirm(null)} style={styles.cancelBtn} disabled={saving}>Cancel</button>
                                <button onClick={() => handleDelete(deleteConfirm)} style={{ ...styles.cancelBtn, backgroundColor: '#dc3545' }} disabled={saving}>
                                    <Icon name={saving ? 'hourglass-split' : 'trash-fill'} />{saving ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Promotion */}
                {showPromote && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="promote-title">
                            <div style={styles.modalHeader}>
                                <h2 id="promote-title" style={styles.modalTitle}><Icon name="mortarboard-fill" />End of Year Student Promotion</h2>
                                <button onClick={closePromotion} style={styles.modalClose} disabled={promoting} aria-label="Close"><i className="bi bi-x-lg" /></button>
                            </div>

                            {promotionResult ? (
                                <div style={{ padding: '25px' }}>
                                    <h3 style={{ color: promotionResult.failures.length ? '#856404' : '#155724', marginTop: 0 }}>
                                        <Icon name={promotionResult.failures.length ? 'exclamation-triangle-fill' : 'check-circle-fill'} />
                                        {promotionResult.moved} student(s) promoted{promotionResult.failures.length ? `, ${promotionResult.failures.length} failed` : ''}
                                    </h3>
                                    {promotionResult.failures.length > 0 && (
                                        <>
                                            <p style={{ color: '#555', fontSize: '13px' }}>These students were NOT moved. Move them individually from the Students page (Edit → Class):</p>
                                            <ul style={styles.failList}>{promotionResult.failures.map((f, i) => <li key={i}>{f}</li>)}</ul>
                                        </>
                                    )}
                                    <button onClick={() => setShowPromote(false)} style={styles.submitBtn}>Done</button>
                                </div>
                            ) : (
                                <>
                                    <p style={styles.modalSubtitle}>
                                        Every student moves to the target class and keeps all their past results. {lastGrades().map(g => GRADE_LABELS_LIVE[g] || g).join(', ')} students graduate and are not moved.
                                        <strong> Run this only once, at the end of the school year.</strong>
                                    </p>

                                    {loadingPromote ? <p style={{ padding: '25px', color: '#666' }}><Icon name="hourglass-split" />Counting students…</p> : (
                                        <div style={styles.promotionTable}>
                                            <div style={styles.promotionHeader}>
                                                <span>From Class</span><span style={{ textAlign: 'center' }} /><span>To Class</span><span style={{ textAlign: 'center' }}>Include</span>
                                            </div>
                                            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                                                {promotionPairs.map((pair, i) => {
                                                    const count = classCounts[pair.fromClassId] || 0;
                                                    const merged = pair.toClassId && !pair.skip && targetUse[pair.toClassId] > 1;
                                                    return (
                                                        <div key={pair.fromClassId} style={{ ...styles.pairRow, backgroundColor: pair.skip ? '#f8f9fa' : i % 2 === 0 ? 'white' : '#fafafa', opacity: pair.skip ? 0.65 : 1 }}>
                                                            <span style={styles.fromBadge}>{pair.fromLabel} <span style={styles.countTag}>{count}</span></span>
                                                            <i className="bi bi-arrow-right" aria-hidden="true" style={{ color: '#28a745', textAlign: 'center' }} />
                                                            {pair.graduates ? (
                                                                <span style={styles.gradTag}><Icon name="mortarboard-fill" />Graduates</span>
                                                            ) : (
                                                                <div>
                                                                    <select style={{ ...styles.pairSelect, borderColor: !pair.skip && !pair.toClassId ? '#dc3545' : '#ddd' }}
                                                                        value={pair.toClassId} disabled={pair.skip || promoting}
                                                                        onChange={e => updatePair(i, { toClassId: e.target.value })}
                                                                        aria-label={`Target class for ${pair.fromLabel}`}>
                                                                        <option value="">-- Select Target --</option>
                                                                        {[...classes].sort((a, b) => gradeIdx(a.gradeLevel) - gradeIdx(b.gradeLevel) || classDisplayName(a).localeCompare(classDisplayName(b)))
                                                                            .filter(c => String(c.classId) !== pair.fromClassId)
                                                                            .map(c => <option key={c.classId} value={c.classId}>{classDisplayName(c)}</option>)}
                                                                    </select>
                                                                    {pair.unknownGrade && !pair.toClassId && !pair.skip && <div style={styles.pairNote}>Grade not recognised — choose a target or untick</div>}
                                                                    {merged && <div style={{ ...styles.pairNote, color: '#856404' }}>Merges with another class into {classLabel(pair.toClassId)}</div>}
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                {!pair.graduates && (
                                                                    <input type="checkbox" checked={!pair.skip} disabled={promoting}
                                                                        onChange={e => updatePair(i, { skip: !e.target.checked })}
                                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                                        aria-label={`Include ${pair.fromLabel}`} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {promotionProgress && (
                                        <div style={{ margin: '0 25px 10px' }}>
                                            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${(promotionProgress.done / Math.max(promotionProgress.total, 1)) * 100}%` }} /></div>
                                            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>Moving students {promotionProgress.done}/{promotionProgress.total}… keep this page open.</p>
                                        </div>
                                    )}

                                    <div style={styles.promoteFooter}>
                                        {needsTarget.length > 0 && (
                                            <p style={{ ...styles.pairNote, width: '100%', margin: 0 }}>
                                                <Icon name="exclamation-circle-fill" />{needsTarget.length} ticked class(es) have no target and will be left where they are.
                                            </p>
                                        )}
                                        <label style={styles.confirmLabel}>
                                            Type <strong>PROMOTE</strong> to move <strong>{studentsToMove}</strong> student(s) in <strong>{activePairs.length}</strong> class(es):
                                            <input style={styles.confirmInput} value={confirmText} onChange={e => setConfirmText(e.target.value)}
                                                disabled={promoting || !activePairs.length} placeholder="PROMOTE" autoComplete="off" />
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                                            <button onClick={handlePromote}
                                                disabled={promoting || !activePairs.length || confirmText.trim().toUpperCase() !== 'PROMOTE'}
                                                style={{ ...styles.promoteBtn, opacity: promoting || confirmText.trim().toUpperCase() !== 'PROMOTE' ? 0.55 : 1 }}>
                                                {promoting ? <><Icon name="hourglass-split" />Promoting...</> : <><Icon name="mortarboard-fill" />Confirm Promotion</>}
                                            </button>
                                            <button onClick={closePromotion} style={styles.cancelBtn} disabled={promoting}>Cancel</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {loading ? <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}><Icon name="hourglass-split" />Loading...</p> :
                    Object.keys(groupedYears).length === 0 ? (
                        <div style={styles.emptyState}>
                            <Icon name="calendar3" style={{ fontSize: '48px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '15px' }} />
                            <h3>No Academic Years Yet</h3>
                            <p>Click <strong>Add Term</strong> to get started</p>
                        </div>
                    ) : (
                        Object.entries(groupedYears).sort(([a], [b]) => b.localeCompare(a)).map(([yearLabel, termsList]) => (
                            <div key={yearLabel} style={styles.yearBlock}>
                                <div style={styles.yearHeader}>
                                    <span style={styles.yearTitle}><Icon name="calendar3" />{yearLabel}</span>
                                    <span style={styles.yearCount}>{termsList.length} term(s)</span>
                                </div>
                                <div style={styles.termsGrid}>
                                    {[...termsList].sort((a, b) => Number(a.term) - Number(b.term)).map(year => {
                                        const active = isActiveOf(year);
                                        const isEditing = editingYear?.yearId === year.yearId;
                                        return (
                                            <div key={year.yearId} style={isEditing ? { gridColumn: '1 / -1' } : undefined}>
                                                <div style={{ ...styles.termCard, borderTop: `4px solid ${active ? '#28a745' : '#ddd'}`, outline: isEditing ? '2px solid #2E75B6' : 'none' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#1F3864' }}>Term {year.term}</span>
                                                        <span style={{ ...styles.statusPill, backgroundColor: active ? '#28a745' : '#6c757d' }}>
                                                            {active ? <><Icon name="check-circle-fill" style={{ marginRight: '4px' }} />Current</> : 'Inactive'}
                                                        </span>
                                                    </div>
                                                    <div style={styles.dateRow}>
                                                        <Icon name="calendar-event" style={{ marginRight: '2px' }} />{fmtDate(year.startDate)}
                                                        <i className="bi bi-arrow-right" aria-hidden="true" style={{ margin: '0 4px' }} />
                                                        {fmtDate(year.endDate)}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                        <button onClick={() => handleSetActive(year)} disabled={saving}
                                                            style={{ ...styles.cardBtn, flex: 1, backgroundColor: active ? '#6c757d' : '#28a745', fontWeight: 'bold' }}>
                                                            {active ? 'Deactivate' : <><Icon name="check-circle-fill" style={{ marginRight: '4px' }} />Set Current</>}
                                                        </button>
                                                        <button onClick={() => handleEdit(year)} style={{ ...styles.cardBtn, flex: 1, backgroundColor: isEditing ? '#6c757d' : '#2E75B6' }}>
                                                            {isEditing ? <><Icon name="x-lg" style={{ marginRight: '4px' }} />Close</> : <><Icon name="pencil-fill" style={{ marginRight: '4px' }} />Edit</>}
                                                        </button>
                                                        <button onClick={() => setDeleteConfirm(year)} style={{ ...styles.cardBtn, backgroundColor: '#dc3545' }} title="Delete term" aria-label={`Delete ${year.yearLabel} Term ${year.term}`}>
                                                            <i className="bi bi-trash-fill" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {isEditing && (
                                                    <div style={styles.editPanel}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <h4 style={{ color: '#2E75B6', margin: 0, fontSize: '13px' }}><Icon name="pencil-fill" />Editing: {year.yearLabel} Term {year.term}</h4>
                                                            <button onClick={handleCancelEdit} style={styles.closeX} aria-label="Close"><i className="bi bi-x-lg" /></button>
                                                        </div>
                                                        <YearForm formData={formData} setFormData={setFormData}
                                                            onSubmit={handleSubmitEdit} onCancel={handleCancelEdit}
                                                            submitLabel="Update" submitIcon="check-circle-fill" saving={saving} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )
                }
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
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' },
    headerBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    promoteBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    warning: { color: '#856404', padding: '12px 16px', backgroundColor: '#fff8e1', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffc107' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    addFormCard: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0', fontWeight: 700 },
    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' },
    yearBlock: { marginBottom: '25px' },
    yearHeader: { backgroundColor: '#1F3864', padding: '14px 22px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    yearTitle: { color: 'white', fontWeight: 800, fontSize: '18px' },
    yearCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px', borderRadius: '20px', fontSize: '12px' },
    termsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '15px', padding: '18px', backgroundColor: 'white', borderRadius: '0 0 14px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    termCard: { backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '16px', border: '1px solid #eee' },
    statusPill: { color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    dateRow: { display: 'flex', alignItems: 'center', fontSize: '12px', color: '#666', marginBottom: '12px', flexWrap: 'wrap' },
    cardBtn: { color: 'white', border: 'none', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    editPanel: { backgroundColor: 'white', borderRadius: '0 0 10px 10px', padding: '15px', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px' },
    closeX: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    smallModal: { backgroundColor: 'white', padding: '25px 30px', borderRadius: '14px', maxWidth: '400px', width: '90%' },
    modal: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' },
    modalHeader: { backgroundColor: '#1F3864', padding: '18px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: 'white', margin: 0, fontSize: '18px', fontWeight: 700 },
    modalClose: { background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' },
    modalSubtitle: { color: '#555', fontSize: '13px', padding: '15px 25px 0', margin: 0, lineHeight: '1.5' },
    promotionTable: { flex: 1, overflow: 'auto', margin: '15px 0' },
    promotionHeader: { display: 'grid', gridTemplateColumns: '1fr 24px 1.3fr 64px', gap: '10px', padding: '8px 25px', backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd', fontWeight: 'bold', fontSize: '12px', color: '#1F3864' },
    pairRow: { display: 'grid', gridTemplateColumns: '1fr 24px 1.3fr 64px', gap: '10px', padding: '8px 25px', alignItems: 'center', borderBottom: '1px solid #eee' },
    fromBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '5px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '6px' },
    countTag: { backgroundColor: '#1F3864', color: 'white', borderRadius: '10px', padding: '0 7px', fontSize: '11px', lineHeight: '18px' },
    gradTag: { backgroundColor: '#fff3cd', color: '#856404', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    pairSelect: { padding: '7px 8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', backgroundColor: 'white' },
    pairNote: { color: '#dc3545', fontSize: '11px', marginTop: '3px' },
    promoteFooter: { padding: '15px 25px', borderTop: '1px solid #eee', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#fafafa' },
    confirmLabel: { fontSize: '13px', color: '#333', display: 'flex', flexDirection: 'column', gap: '6px' },
    confirmInput: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', width: '170px', letterSpacing: '1px' },
    progressTrack: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    failList: { maxHeight: '240px', overflowY: 'auto', fontSize: '13px', color: '#721c24', paddingLeft: '20px', margin: '0 0 15px' },
    emptyState: { backgroundColor: 'white', padding: '60px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default AcademicYears;
