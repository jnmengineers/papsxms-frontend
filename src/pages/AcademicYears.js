import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';

// ✅ Outside parent — prevents keyboard dismiss on mobile
const YearForm = ({ formData, setFormData, onSubmit, onCancel, submitLabel }) => (
    <form onSubmit={onSubmit} style={styles.inlineForm}>
        <div style={styles.formGrid}>
            <div style={styles.formGroup}>
                <label style={styles.label}>Year Label</label>
                <input style={styles.input} value={formData.yearLabel}
                    onChange={e => setFormData(prev => ({...prev, yearLabel: e.target.value}))}
                    placeholder="e.g. 2025" required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Term</label>
                <select style={styles.input} value={formData.term}
                    onChange={e => setFormData(prev => ({...prev, term: e.target.value}))} required>
                    <option value="">Select Term</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                </select>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Start Date</label>
                <input type="date" style={styles.input} value={formData.startDate}
                    onChange={e => setFormData(prev => ({...prev, startDate: e.target.value}))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>End Date</label>
                <input type="date" style={styles.input} value={formData.endDate}
                    onChange={e => setFormData(prev => ({...prev, endDate: e.target.value}))} required />
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Status</label>
                <select style={styles.input} value={String(formData.isActive)}
                    onChange={e => setFormData(prev => ({...prev, isActive: e.target.value === 'true'}))}>
                    <option value="false">❌ Inactive</option>
                    <option value="true">✅ Active</option>
                </select>
            </div>
        </div>
        <div style={styles.btnGroup}>
            <button type="submit" style={styles.submitBtn}>{submitLabel}</button>
            <button type="button" onClick={onCancel} style={styles.cancelBtn}>✕ Cancel</button>
        </div>
    </form>
);

function AcademicYears() {
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingYear, setEditingYear] = useState(null);
    const [showPromote, setShowPromote] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [promotionProgress, setPromotionProgress] = useState(null);

    // Promotion state
    const [promotionPairs, setPromotionPairs] = useState([]); // [{fromClassId, toClassId}]

    const [formData, setFormData] = useState({
        yearLabel: '', term: '', startDate: '', endDate: '', isActive: false
    });

    const emptyForm = { yearLabel: '', term: '', startDate: '', endDate: '', isActive: false };

    const sections = [
        { value: 'PRE_SCHOOL', label: 'Pre-School', color: '#6f42c1' },
        { value: 'LOWER_PRIMARY', label: 'Lower Primary', color: '#2E75B6' },
        { value: 'UPPER_PRIMARY', label: 'Upper Primary', color: '#fd7e14' },
        { value: 'JUNIOR_SCHOOL', label: 'Junior School', color: '#20c997' }
    ];

    // Default promotion map — G1Y → G2Y, G1B → G2B etc
    const promotionMap = {
        'PG': 'PP1', 'PP1': 'PP2', 'PP2': 'G1',
        'G1': 'G2', 'G2': 'G3', 'G3': 'G4',
        'G4': 'G5', 'G5': 'G6', 'G6': 'G7',
        'G7': 'G8', 'G8': 'G9'
    };

    useEffect(() => { fetchYears(); fetchClasses(); }, []);

    const fetchYears = async () => {
        try {
            const response = await api.get('/api/academic-years');
            setYears(response.data);
            setLoading(false);
        } catch (err) { setError('Failed to load academic years'); setLoading(false); }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/api/classes');
            setClasses(response.data);
        } catch (err) {}
    };

    const handleEdit = (year) => {
        if (editingYear?.yearId === year.yearId) { setEditingYear(null); return; }
        setEditingYear(year);
        setFormData({
            yearLabel: year.yearLabel, term: year.term,
            startDate: year.startDate, endDate: year.endDate, isActive: year.isActive
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => { setEditingYear(null); setFormData(emptyForm); };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/academic-years', { ...formData, term: parseInt(formData.term) });
            setShowAddForm(false); setFormData(emptyForm);
            fetchYears();
            setSuccessMsg('✅ Academic year added!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to save academic year'); }
    };

    const handleSubmitEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/academic-years/${editingYear.yearId}`, { ...formData, term: parseInt(formData.term) });
            setEditingYear(null); setFormData(emptyForm);
            fetchYears();
            setSuccessMsg('✅ Academic year updated!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) { setError('Failed to update academic year'); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await api.delete(`/api/academic-years/${id}`);
                fetchYears();
            } catch (err) { setError('Failed to delete academic year'); }
        }
    };

    const handleSetActive = async (year) => {
        try {
            await api.put(`/api/academic-years/${year.yearId}`, { ...year, isActive: !year.isActive });
            fetchYears();
            setSuccessMsg(year.isActive ? 'Year deactivated' : '✅ Year set as active!');
            setTimeout(() => setSuccessMsg(''), 2000);
        } catch (err) { setError('Failed to update status'); }
    };

    // ── Promotion ──────────────────────────────────────────────────────────────
    const openPromotion = () => {
        // Auto-suggest pairs: for each class find the suggested next class
        const pairs = classes.map(cls => {
            const gradeLevel = cls.gradeLevel;
            const nextGrade = promotionMap[gradeLevel];
            // Find class with same stream in next grade
            const streamSuffix = cls.stream ? cls.stream.charAt(0).toUpperCase() : '';
            const suggestedNext = nextGrade
                ? classes.find(c =>
                    c.gradeLevel === nextGrade &&
                    (streamSuffix ? c.stream?.charAt(0).toUpperCase() === streamSuffix : !c.stream)
                ) || classes.find(c => c.gradeLevel === nextGrade)
                : null;

            return {
                fromClassId: String(cls.classId),
                fromClassName: cls.className,
                fromGrade: gradeLevel,
                toClassId: suggestedNext ? String(suggestedNext.classId) : '',
                toClassName: suggestedNext?.className || '',
                skip: !nextGrade // G9 graduates — no next class
            };
        }).sort((a, b) => a.fromClassName.localeCompare(b.fromClassName));

        setPromotionPairs(pairs);
        setShowPromote(true);
        setPromotionProgress(null);
    };

    const handlePromote = async () => {
        const validPairs = promotionPairs.filter(p => !p.skip && p.toClassId);
        if (validPairs.length === 0) {
            setError('No valid promotion pairs selected');
            return;
        }
        if (!window.confirm(`Promote students across ${validPairs.length} class(es)? Students will keep all their results and report cards.`)) return;

        setPromoting(true);
        let success = 0, failed = 0;
        setPromotionProgress({ done: 0, total: validPairs.length, success: 0, failed: 0 });

        for (let i = 0; i < validPairs.length; i++) {
            const pair = validPairs[i];
            try {
                // Move all students from fromClass to toClass
                const studentsRes = await api.get('/api/students');
                const classStudents = studentsRes.data.filter(s =>
                    String(s.schoolClass?.classId) === String(pair.fromClassId)
                );

                for (const student of classStudents) {
                    await api.put(`/api/students/${student.studentId}/move-class/${pair.toClassId}`);
                }
                success++;
            } catch (err) {
                failed++;
            }
            setPromotionProgress({ done: i + 1, total: validPairs.length, success, failed });
        }

        setPromoting(false);
        setSuccessMsg(`🎓 Promotion complete! ${success} class(es) promoted. ${failed > 0 ? `${failed} failed.` : ''}`);
        setTimeout(() => setSuccessMsg(''), 5000);
        setShowPromote(false);
        fetchClasses();
    };

    // Group years by yearLabel
    const groupedYears = years.reduce((groups, year) => {
        if (!groups[year.yearLabel]) groups[year.yearLabel] = [];
        groups[year.yearLabel].push(year);
        return groups;
    }, {});

    const activeYear = years.find(y => y.isActive);

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
                        <h2 style={styles.title}>📅 Academic Years</h2>
                        <p style={styles.subtitle}>
                            {activeYear ? `Active: ${activeYear.yearLabel} — Term ${activeYear.term}` : 'No active term'}
                        </p>
                    </div>
                    <div style={styles.headerBtns}>
                        <button onClick={openPromotion} style={styles.promoteBtn}>
                            🎓 Promote Students
                        </button>
                        <button onClick={() => { setShowAddForm(!showAddForm); setEditingYear(null); }} style={styles.addBtn}>
                            {showAddForm ? '✕ Cancel' : '+ Add Term'}
                        </button>
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}
                {successMsg && <p style={styles.success}>{successMsg}</p>}

                {/* Add Form */}
                {showAddForm && (
                    <div style={styles.addFormCard}>
                        <h3 style={styles.formTitle}>➕ Add Academic Term</h3>
                        <YearForm formData={formData} setFormData={setFormData}
                            onSubmit={handleSubmitAdd}
                            onCancel={() => { setShowAddForm(false); setFormData(emptyForm); }}
                            submitLabel="💾 Save" />
                    </div>
                )}

                {/* ── Promotion Modal ── */}
                {showPromote && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modal}>
                            <div style={styles.modalHeader}>
                                <h2 style={styles.modalTitle}>🎓 End of Year Student Promotion</h2>
                                <button onClick={() => setShowPromote(false)} style={styles.modalClose}>✕</button>
                            </div>
                            <p style={styles.modalSubtitle}>
                                Review the promotion mapping below. Each class's students will move to the target class.
                                Students keep all their results and report cards.
                                G9 students graduate and are not promoted.
                            </p>

                            {promotionProgress && (
                                <div style={styles.progressBox}>
                                    <div style={styles.progressBarOuter}>
                                        <div style={{ ...styles.progressBarInner, width: `${(promotionProgress.done / promotionProgress.total) * 100}%` }} />
                                    </div>
                                    <p style={styles.progressText}>
                                        Promoting {promotionProgress.done}/{promotionProgress.total}
                                        — ✅ {promotionProgress.success} done
                                        {promotionProgress.failed > 0 && ` — ❌ ${promotionProgress.failed} failed`}
                                    </p>
                                </div>
                            )}

                            <div style={styles.promotionTable}>
                                <div style={styles.promotionHeader}>
                                    <span style={styles.promoCol}>From Class</span>
                                    <span style={styles.promoArrow}></span>
                                    <span style={styles.promoCol}>To Class (editable)</span>
                                    <span style={styles.promoSkip}>Skip?</span>
                                </div>
                                <div style={styles.promotionRows}>
                                    {promotionPairs.map((pair, i) => (
                                        <div key={i} style={{
                                            ...styles.promotionRow,
                                            opacity: pair.skip ? 0.5 : 1,
                                            backgroundColor: pair.skip ? '#f8f9fa' : i % 2 === 0 ? 'white' : '#f9f9f9'
                                        }}>
                                            <span style={styles.promoFromBadge}>{pair.fromClassName}</span>
                                            <span style={styles.promoArrowIcon}>→</span>
                                            <select
                                                style={styles.promoSelect}
                                                value={pair.toClassId}
                                                disabled={pair.skip}
                                                onChange={e => {
                                                    const newPairs = [...promotionPairs];
                                                    const selected = classes.find(c => String(c.classId) === e.target.value);
                                                    newPairs[i] = { ...newPairs[i], toClassId: e.target.value, toClassName: selected?.className || '' };
                                                    setPromotionPairs(newPairs);
                                                }}>
                                                <option value="">-- Select Target Class --</option>
                                                {classes.filter(c => String(c.classId) !== pair.fromClassId).map(c => (
                                                    <option key={c.classId} value={c.classId}>{c.className}</option>
                                                ))}
                                            </select>
                                            <div style={styles.promoSkipToggle}>
                                                {pair.skip ? (
                                                    <span style={styles.graduateTag}>🎓 Graduates</span>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            const newPairs = [...promotionPairs];
                                                            newPairs[i] = { ...newPairs[i], skip: true };
                                                            setPromotionPairs(newPairs);
                                                        }}
                                                        style={styles.skipBtn}>Skip</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={styles.modalFooter}>
                                <button onClick={handlePromote} style={styles.confirmPromoteBtn} disabled={promoting}>
                                    {promoting ? '⏳ Promoting...' : `🎓 Confirm Promotion (${promotionPairs.filter(p => !p.skip && p.toClassId).length} classes)`}
                                </button>
                                <button onClick={() => setShowPromote(false)} style={styles.cancelBtn}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Years grouped by yearLabel */}
                {loading ? <p>Loading...</p> : Object.keys(groupedYears).length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📅</div>
                        <h3>No Academic Years Yet</h3>
                        <p>Click + Add Term to get started</p>
                    </div>
                ) : (
                    Object.entries(groupedYears)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([yearLabel, termsList]) => (
                            <div key={yearLabel} style={styles.yearBlock}>
                                <div style={styles.yearHeader}>
                                    <span style={styles.yearTitle}>📅 {yearLabel}</span>
                                    <span style={styles.yearTermCount}>{termsList.length} term(s)</span>
                                </div>
                                <div style={styles.termsGrid}>
                                    {termsList.sort((a, b) => a.term - b.term).map(year => (
                                        <div key={year.yearId}>
                                            <div style={{
                                                ...styles.termCard,
                                                borderTop: `4px solid ${year.isActive ? '#28a745' : '#ddd'}`,
                                                outline: editingYear?.yearId === year.yearId ? '2px solid #2E75B6' : 'none'
                                            }}>
                                                <div style={styles.termCardTop}>
                                                    <span style={styles.termLabel}>Term {year.term}</span>
                                                    <span style={{ ...styles.statusBadge, backgroundColor: year.isActive ? '#28a745' : '#6c757d' }}>
                                                        {year.isActive ? '✅ Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <div style={styles.termDates}>
                                                    <span>📅 {year.startDate}</span>
                                                    <span style={styles.dateSep}>→</span>
                                                    <span>📅 {year.endDate}</span>
                                                </div>
                                                <div style={styles.termActions}>
                                                    <button
                                                        onClick={() => handleSetActive(year)}
                                                        style={year.isActive ? styles.deactivateBtn : styles.activateBtn}>
                                                        {year.isActive ? 'Deactivate' : '✅ Set Active'}
                                                    </button>
                                                    <button
                                                        onClick={() => editingYear?.yearId === year.yearId ? handleCancelEdit() : handleEdit(year)}
                                                        style={editingYear?.yearId === year.yearId ? styles.cancelEditBtn : styles.editBtn}>
                                                        {editingYear?.yearId === year.yearId ? '✕' : 'Edit'}
                                                    </button>
                                                    <button onClick={() => handleDelete(year.yearId)} style={styles.deleteBtn}>Delete</button>
                                                </div>
                                            </div>
                                            {editingYear?.yearId === year.yearId && (
                                                <div style={styles.inlineEditCard}>
                                                    <div style={styles.inlineEditHeader}>
                                                        <h4 style={styles.inlineEditTitle}>✏️ Editing: {year.yearLabel} Term {year.term}</h4>
                                                        <button onClick={handleCancelEdit} style={styles.closeBtn}>✕</button>
                                                    </div>
                                                    <YearForm formData={formData} setFormData={setFormData}
                                                        onSubmit={handleSubmitEdit}
                                                        onCancel={handleCancelEdit}
                                                        submitLabel="✅ Update" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
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
    headerBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px' },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    promoteBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: 'red', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '5px', marginBottom: '15px' },
    success: { color: '#155724', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '15px' },

    addFormCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '2px solid #1F3864' },
    formTitle: { color: '#1F3864', margin: '0 0 15px 0' },
    inlineEditCard: { backgroundColor: 'white', borderRadius: '0 0 8px 8px', padding: '15px', border: '2px solid #2E75B6', borderTop: 'none', marginTop: '-2px' },
    inlineEditHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    inlineEditTitle: { color: '#2E75B6', margin: 0, fontSize: '13px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' },

    inlineForm: {},
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '9px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '13px' },
    btnGroup: { display: 'flex', gap: '10px' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '5px', cursor: 'pointer' },

    // Year blocks
    yearBlock: { marginBottom: '25px' },
    yearHeader: { backgroundColor: '#1F3864', padding: '12px 20px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    yearTitle: { color: 'white', fontWeight: 'bold', fontSize: '18px' },
    yearTermCount: { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px', borderRadius: '12px', fontSize: '12px' },
    termsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    termCard: { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '15px', border: '1px solid #eee' },
    termCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    termLabel: { fontSize: '18px', fontWeight: 'bold', color: '#1F3864' },
    statusBadge: { color: 'white', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' },
    termDates: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666', marginBottom: '12px', flexWrap: 'wrap' },
    dateSep: { color: '#999' },
    termActions: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    activateBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },
    deactivateBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' },

    // Promotion Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    modal: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    modalHeader: { backgroundColor: '#1F3864', padding: '20px 25px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: 'white', margin: 0, fontSize: '18px' },
    modalClose: { background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' },
    modalSubtitle: { color: '#666', fontSize: '13px', padding: '15px 25px 0 25px', margin: 0, lineHeight: '1.5' },
    progressBox: { margin: '15px 25px 0 25px' },
    progressBarOuter: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' },
    progressBarInner: { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s' },
    progressText: { fontSize: '12px', color: '#666', margin: 0 },
    promotionTable: { flex: 1, overflow: 'auto', margin: '15px 0' },
    promotionHeader: { display: 'grid', gridTemplateColumns: '1fr 30px 1fr 80px', gap: '10px', padding: '8px 25px', backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd', fontWeight: 'bold', fontSize: '12px', color: '#1F3864' },
    promotionRows: {},
    promotionRow: { display: 'grid', gridTemplateColumns: '1fr 30px 1fr 80px', gap: '10px', padding: '8px 25px', alignItems: 'center', borderBottom: '1px solid #eee' },
    promoCol: {},
    promoArrow: {},
    promoSkip: {},
    promoFromBadge: { backgroundColor: '#e3f2fd', color: '#1F3864', padding: '5px 10px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', display: 'inline-block' },
    promoArrowIcon: { color: '#28a745', fontWeight: 'bold', fontSize: '16px', textAlign: 'center' },
    promoSelect: { padding: '6px 8px', borderRadius: '5px', border: '1px solid #ddd', fontSize: '12px', width: '100%' },
    promoSkipToggle: { display: 'flex', justifyContent: 'center' },
    graduateTag: { backgroundColor: '#ffc107', color: '#856404', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' },
    skipBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' },
    modalFooter: { padding: '15px 25px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    confirmPromoteBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },

    emptyState: { backgroundColor: 'white', padding: '60px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    emptyIcon: { fontSize: '48px', marginBottom: '15px' },
};

export default AcademicYears;