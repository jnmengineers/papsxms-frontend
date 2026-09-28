import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const EMPTY_FORM = { gradeLetter: '', minMark: '', maxMark: '', points: '', remarks: '' };
// The 4-level CBC scale the rest of PAPSXMS already uses for colours and report cards
const CBC_PRESET = [
    { gradeLetter: 'EE', minMark: 75, maxMark: 100, points: 4, remarks: 'Exceeding Expectations' },
    { gradeLetter: 'ME', minMark: 55, maxMark: 74.99, points: 3, remarks: 'Meeting Expectations' },
    { gradeLetter: 'AE', minMark: 40, maxMark: 54.99, points: 2, remarks: 'Approaching Expectations' },
    { gradeLetter: 'BE', minMark: 0, maxMark: 39.99, points: 1, remarks: 'Below Expectations' },
];

const num = (v) => { const n = Number(v); return v === '' || v === null || v === undefined || isNaN(n) ? null : n; };
const norm = (v) => String(v ?? '').trim().toLowerCase();
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
// Colour by position in the scale (best = green … worst = red), so any letters work — not just A/B/C
const PALETTE = ['#28a745', '#2E75B6', '#17a2b8', '#e0a800', '#fd7e14', '#dc3545', '#6f42c1', '#6c757d'];
const colourFor = (index, total) => total <= 1 ? PALETTE[0]
    : index === total - 1 ? '#dc3545'
    : PALETTE[Math.min(index, PALETTE.length - 3)];

// Checks the whole scale covers 0–100 with no gaps or overlaps
const analyse = (scales) => {
    const bands = scales.map(s => ({ ...s, min: num(s.minMark), max: num(s.maxMark) }))
        .filter(b => b.min !== null && b.max !== null).sort((a, b) => a.min - b.min);
    const issues = [];
    if (!bands.length) return { issues, bands };
    if (bands[0].min > 0) issues.push({ level: 'error', text: `Marks from 0 to below ${bands[0].min} have no grade.` });
    for (let i = 1; i < bands.length; i++) {
        const prev = bands[i - 1], cur = bands[i];
        if (cur.min <= prev.max) issues.push({ level: 'error', text: `${prev.gradeLetter} (${prev.min}–${prev.max}) and ${cur.gradeLetter} (${cur.min}–${cur.max}) overlap — a mark of ${cur.min} would match both.` });
        else if (cur.min - prev.max > 1) issues.push({ level: 'error', text: `Marks between ${prev.max} and ${cur.min} (e.g. ${Math.floor(prev.max) + 1}) have no grade.` });
        else if (cur.min - prev.max > 0.01 + 1e-9) issues.push({ level: 'warn', text: `Decimal marks between ${prev.max} and ${cur.min} (e.g. ${(prev.max + cur.min) / 2}) may get no grade. If marks can have decimals, set ${prev.gradeLetter}'s max to ${(cur.min - 0.01).toFixed(2)}.` });
    }
    const top = bands[bands.length - 1];
    if (top.max < 100) issues.push({ level: 'error', text: `Marks above ${top.max} up to 100 have no grade.` });
    return { issues, bands };
};

function GradingScales() {
    const [scales, setScales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingScale, setEditingScale] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState(EMPTY_FORM);
    const successTimer = useRef(null);
    const formRef = useRef(null);

    useEffect(() => { fetchScales(); return () => clearTimeout(successTimer.current); }, []);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 3500);
    };

    const fetchScales = async () => {
        try { const r = await api.get('/api/grading-scales'); setScales(r.data || []); }
        catch (err) { setError('Failed to load grading scales. Check your connection and refresh.'); }
        setLoading(false);
    };

    // Highest band first, like a report card key
    const sorted = [...scales].sort((a, b) => (num(b.minMark) ?? -1) - (num(a.minMark) ?? -1));
    const q = norm(search);
    const filtered = sorted.filter(s => !q || norm(s.gradeLetter).includes(q) || norm(s.remarks).includes(q));
    const { issues } = analyse(scales);
    const errorsInScale = issues.filter(i => i.level === 'error').length;

    const openForm = (scale = null) => {
        setEditingScale(scale);
        setFormData(scale
            ? { gradeLetter: scale.gradeLetter || '', minMark: String(scale.minMark ?? ''), maxMark: String(scale.maxMark ?? ''), points: String(scale.points ?? ''), remarks: scale.remarks || '' }
            : EMPTY_FORM); // never carry over the grade that was being edited
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    const handleCancel = () => { setShowForm(false); setEditingScale(null); setFormData(EMPTY_FORM); };

    const validate = () => {
        const letter = formData.gradeLetter.trim();
        const min = num(formData.minMark), max = num(formData.maxMark), pts = num(formData.points);
        if (!letter) return 'Grade letter is required.';
        if (min === null || max === null) return 'Min and max marks are required.';
        if (min < 0 || max > 100) return 'Marks must be between 0 and 100.';
        if (min > max) return 'Min mark must not be higher than max mark.';
        if (pts === null) return 'Points must be a number.';
        const others = scales.filter(s => !editingScale || s.scaleId !== editingScale.scaleId);
        if (others.some(s => norm(s.gradeLetter) === norm(letter))) return `Grade ${letter.toUpperCase()} already exists.`;
        const clash = others.find(s => num(s.minMark) !== null && num(s.maxMark) !== null && min <= num(s.maxMark) && max >= num(s.minMark));
        if (clash) return `${min}–${max} overlaps grade ${clash.gradeLetter} (${clash.minMark}–${clash.maxMark}). A mark would match two grades.`;
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const problem = validate();
        if (problem) { setError(problem); return; }
        setSaving(true); setError('');
        const payload = {
            gradeLetter: formData.gradeLetter.trim().toUpperCase(),
            minMark: num(formData.minMark), maxMark: num(formData.maxMark),
            points: num(formData.points), remarks: formData.remarks.trim()
        };
        try {
            if (editingScale) await api.put(`/api/grading-scales/${editingScale.scaleId}`, payload);
            else await api.post('/api/grading-scales', payload);
            flashSuccess(`Grade ${payload.gradeLetter} ${editingScale ? 'updated' : 'added'}.`);
            handleCancel();
            fetchScales();
        } catch (err) { setError(serverMessage(err, 'Failed to save grading scale')); }
        setSaving(false);
    };

    const handleDelete = async (scale) => {
        if (!window.confirm(`Delete grade ${scale.gradeLetter} (${scale.minMark}–${scale.maxMark})?\n\nMarks in this range will have no grade until another grade covers them.`)) return;
        try {
            await api.delete(`/api/grading-scales/${scale.scaleId}`);
            if (editingScale?.scaleId === scale.scaleId) handleCancel();
            await fetchScales();
            flashSuccess(`Grade ${scale.gradeLetter} deleted.`);
        } catch (err) { setError(serverMessage(err, 'Failed to delete grading scale')); }
    };

    const applyPreset = async () => {
        if (!window.confirm('Add the 4-level CBC scale (EE 75–100, ME 55–74.99, AE 40–54.99, BE 0–39.99)?')) return;
        setSaving(true); setError('');
        const outs = await Promise.allSettled(CBC_PRESET.map(p => api.post('/api/grading-scales', p)));
        const failed = outs.filter(o => o.status === 'rejected').length;
        await fetchScales();
        setSaving(false);
        if (failed) setError(`${CBC_PRESET.length - failed} grade(s) added, ${failed} failed.`);
        else flashSuccess('CBC grading scale added.');
    };

    return (
        <div style={styles.container}>
           <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}><Icon name="sliders" style={{ marginRight: '10px' }} />Grading Scales</h2>
                        <p style={styles.subtitle}>{scales.length} grade(s) — every mark from 0 to 100 should fall in exactly one grade</p>
                    </div>
                    <button onClick={() => (showForm ? handleCancel() : openForm())} style={styles.addBtn}>
                        {showForm ? <><Icon name="x-lg" />Close</> : <><Icon name="plus-circle" />Add Grade</>}
                    </button>
                </div>

                {error && (
                    <div style={styles.error} role="alert">
                        <Icon name="exclamation-triangle-fill" />{error}
                        <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                    </div>
                )}
                {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                {/* Coverage check: shows the scale as a 0–100 bar */}
                {!loading && scales.length > 0 && (
                    <div style={styles.coverageCard}>
                        <div style={styles.coverageHead}>
                            <strong style={{ color: '#1F3864' }}><Icon name="rulers" />Scale check</strong>
                            {errorsInScale === 0
                                ? <span style={{ ...styles.statusPill, backgroundColor: '#d4edda', color: '#155724' }}><Icon name="check-circle-fill" style={{ marginRight: '4px' }} />Covers 0–100 with no gaps or overlaps</span>
                                : <span style={{ ...styles.statusPill, backgroundColor: '#f8d7da', color: '#721c24' }}><Icon name="x-circle-fill" style={{ marginRight: '4px' }} />{errorsInScale} problem(s)</span>}
                        </div>
                        <div style={styles.scaleBar} aria-hidden="true">
                            {sorted.slice().reverse().map((s, i, arr) => {
                                const min = num(s.minMark), max = num(s.maxMark);
                                if (min === null || max === null) return null;
                                return (
                                    <div key={s.scaleId} title={`${s.gradeLetter}: ${min}–${max}`}
                                        style={{ ...styles.scaleSeg, left: `${Math.max(0, min)}%`, width: `${Math.max(0.8, Math.min(100, max) - Math.max(0, min))}%`, backgroundColor: colourFor(arr.length - 1 - i, arr.length) }}>
                                        {max - min >= 8 && s.gradeLetter}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={styles.scaleTicks}><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
                        {issues.length > 0 && (
                            <ul style={styles.issueList}>
                                {issues.map((it, i) => (
                                    <li key={i} style={{ color: it.level === 'error' ? '#721c24' : '#856404' }}>
                                        <Icon name={it.level === 'error' ? 'x-circle-fill' : 'exclamation-triangle-fill'} style={{ marginRight: '4px' }} />{it.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {showForm && (
                    <div style={styles.form} ref={formRef}>
                        <h3 style={styles.formTitle}><Icon name={editingScale ? 'pencil-fill' : 'plus-circle'} />{editingScale ? `Edit Grade ${editingScale.gradeLetter}` : 'Add New Grade'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={styles.formGrid}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Grade</label>
                                    <input style={{ ...styles.input, textTransform: 'uppercase' }} value={formData.gradeLetter} maxLength="5" autoFocus
                                        onChange={e => setFormData({ ...formData, gradeLetter: e.target.value })} placeholder="e.g. EE" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Min Mark</label>
                                    <input type="number" min="0" max="100" step="0.01" style={styles.input} value={formData.minMark}
                                        onChange={e => setFormData({ ...formData, minMark: e.target.value })} placeholder="e.g. 75" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Max Mark</label>
                                    <input type="number" min="0" max="100" step="0.01" style={styles.input} value={formData.maxMark}
                                        onChange={e => setFormData({ ...formData, maxMark: e.target.value })} placeholder="e.g. 100" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Points</label>
                                    <input type="number" step="0.5" style={styles.input} value={formData.points}
                                        onChange={e => setFormData({ ...formData, points: e.target.value })} placeholder="e.g. 4" required />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Remarks</label>
                                    <input style={styles.input} value={formData.remarks} maxLength={60}
                                        onChange={e => setFormData({ ...formData, remarks: e.target.value })} placeholder="e.g. Exceeding Expectations" />
                                </div>
                            </div>
                            <div style={styles.btnGroup}>
                                <button type="submit" style={{ ...styles.submitBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
                                    <Icon name={saving ? 'hourglass-split' : editingScale ? 'check-circle-fill' : 'save-fill'} />{saving ? 'Saving...' : editingScale ? 'Update Grade' : 'Save Grade'}
                                </button>
                                <button type="button" onClick={handleCancel} style={styles.cancelBtn} disabled={saving}><Icon name="x-lg" />Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {scales.length > 3 && (
                    <div style={styles.searchBar}>
                        <div style={styles.searchBox}>
                            <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                            <input style={styles.searchInput} placeholder="Search by grade or remarks..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button onClick={() => setSearch('')} style={styles.clearBtn} disabled={!search}><Icon name="arrow-counterclockwise" />Clear</button>
                    </div>
                )}

                {loading ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}><Icon name="hourglass-split" />Loading grading scales...</p>
                ) : scales.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Icon name="sliders" style={{ fontSize: '44px', color: '#BDD7EE', marginRight: 0, display: 'inline-block', marginBottom: '12px' }} />
                        <h3>No grading scale yet</h3>
                        <p style={{ color: '#666' }}>Add grades one by one, or start with the standard CBC scale.</p>
                        <button onClick={applyPreset} style={styles.presetBtn} disabled={saving}>
                            <Icon name={saving ? 'hourglass-split' : 'magic'} />Use CBC scale (EE / ME / AE / BE)
                        </button>
                    </div>
                ) : (
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>Grade</th>
                                    <th style={styles.th}>Mark Range</th>
                                    <th style={styles.th}>Points</th>
                                    <th style={styles.th}>Remarks</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((scale, index) => {
                                    const pos = sorted.indexOf(scale);
                                    const isEditing = editingScale?.scaleId === scale.scaleId;
                                    return (
                                        <tr key={scale.scaleId} style={{ backgroundColor: isEditing ? '#e3f2fd' : index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                                            <td style={styles.td}><span style={{ ...styles.gradeBadge, backgroundColor: colourFor(pos, sorted.length) }}>{scale.gradeLetter}</span></td>
                                            <td style={styles.td}><strong>{scale.minMark}</strong> – <strong>{scale.maxMark}</strong></td>
                                            <td style={styles.td}>{scale.points}</td>
                                            <td style={styles.td}>{scale.remarks || <span style={{ color: '#bbb' }}>—</span>}</td>
                                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                                <button onClick={() => (isEditing ? handleCancel() : openForm(scale))} style={isEditing ? styles.cancelEditBtn : styles.editBtn}>
                                                    {isEditing ? <><Icon name="x-lg" style={{ marginRight: '4px' }} />Close</> : <><Icon name="pencil-fill" style={{ marginRight: '4px' }} />Edit</>}
                                                </button>
                                                <button onClick={() => handleDelete(scale)} style={styles.deleteBtn} aria-label={`Delete grade ${scale.gradeLetter}`} title="Delete">
                                                    <i className="bi bi-trash-fill" aria-hidden="true" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No grades match "{search}"</td></tr>
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
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '22px', fontWeight: 800 },
    subtitle: { color: '#666', margin: 0, fontSize: '14px' },
    addBtn: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    coverageCard: { backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    coverageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' },
    statusPill: { padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center' },
    scaleBar: { position: 'relative', height: '28px', backgroundColor: '#f8d7da', borderRadius: '8px', overflow: 'hidden' },
    scaleSeg: { position: 'absolute', top: 0, bottom: 0, color: 'white', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid white', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap' },
    scaleTicks: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginTop: '4px' },
    issueList: { margin: '12px 0 0', paddingLeft: '4px', listStyle: 'none', fontSize: '13px', lineHeight: 1.7 },
    form: { backgroundColor: 'white', padding: '22px', borderRadius: '14px', marginBottom: '22px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #1F3864', scrollMarginTop: '80px' },
    formTitle: { color: '#1F3864', fontWeight: 700, margin: '0 0 15px 0' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px', marginBottom: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    submitBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    presetBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px', display: 'inline-flex', alignItems: 'center' },
    searchBar: { display: 'flex', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    clearBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    tableWrapper: { overflowX: 'auto', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', minWidth: '540px' },
    tableHeader: { backgroundColor: '#1F3864' },
    th: { color: 'white', padding: '13px 15px', textAlign: 'left', fontSize: '13px' },
    td: { padding: '12px 15px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' },
    editBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', marginRight: '5px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' },
    cancelEditBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', marginRight: '5px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' },
    deleteBtn: { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    gradeBadge: { color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', display: 'inline-block', minWidth: '34px', textAlign: 'center' },
    emptyState: { backgroundColor: 'white', padding: '50px 20px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};

export default GradingScales;
