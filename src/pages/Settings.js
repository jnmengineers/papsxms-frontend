import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const MAX_LOGO_BYTES = 500 * 1024;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Settings() {
    const settings = useSchoolSettings();
    const navigate = useNavigate();
    const [tab, setTab] = useState('profile');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const flash = (m) => { setError(''); setSuccessMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setSuccessMsg(''), 4000); };

    const TABS = [['profile', 'building-fill', 'School Profile'], ['sections', 'diagram-3-fill', 'Sections'], ['grades', 'bar-chart-steps', 'Grades & Promotion'],
        ['streams', 'palette-fill', 'Streams'], ['exams', 'file-earmark-text-fill', 'Exam Types']];
    const shared = { settings, setError, flash };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.title}><Icon name="gear-fill" style={{ marginRight: '10px' }} />School Settings</h2>
                    <p style={styles.subtitle}>
                        Everything the pages and printouts show about the school. Changes apply straight away.
                        {' '}Grading cut-offs are on the <a href="/grading-scales" onClick={e => { e.preventDefault(); navigate('/grading-scales'); }} style={styles.link}>Grading Scales</a> page.
                    </p>
                    {settings.loadError && (
                        <p style={styles.warn}><Icon name="exclamation-triangle-fill" />The settings couldn't be loaded from the server, so built-in values are showing. Restart the backend with the latest files.</p>
                    )}
                    {error && (
                        <div style={styles.error} role="alert">
                            <Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span>
                            <button onClick={() => setError('')} style={styles.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                        </div>
                    )}
                    {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                    <div style={styles.tabs} role="tablist">
                        {TABS.map(([k, ic, l]) => (
                            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setError(''); setTab(k); }}
                                style={{ ...styles.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}>
                                <Icon name={ic} />{l}
                            </button>
                        ))}
                    </div>

                    {tab === 'profile' && <ProfileTab {...shared} />}
                    {tab === 'sections' && <SectionsTab {...shared} />}
                    {tab === 'grades' && <GradesTab {...shared} />}
                    {tab === 'streams' && <StreamsTab {...shared} />}
                    {tab === 'exams' && <ExamTypesTab {...shared} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ══ Profile ═════════════════════════════════════════════════════════════════
const PROFILE_FIELDS = [
    ['School details', [['name', 'School name', 120, true], ['shortName', 'Short name (menus, small spaces)', 60], ['motto', 'Motto', 160],
        ['postalAddress', 'Postal address', 160], ['phones', 'Phone numbers', 120], ['email', 'Email', 100], ['website', 'Website', 100]]],
    ['Fee payment details (printed on fee documents and receipts)', [['bankName', 'Bank', 60], ['bankBranch', 'Branch', 60], ['bankAccountName', 'Account name', 120],
        ['bankAccountNumber', 'Account number', 40], ['paybillNumber', 'M-Pesa Paybill number', 20], ['paybillAccountHint', 'Paybill account (what parents enter)', 80],
        ['paymentNote', 'Payment note', 200]]],
];

const ProfileTab = ({ settings, setError, flash }) => {
    const initial = () => ({ ...(settings.profile || {}) });
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setForm(initial()); }, [settings.profile]);
    const dirty = !same(form, settings.profile || {});

    const pickLogo = (side) => (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) { setError('Choose a PNG, JPG, WEBP, GIF or SVG image.'); return; }
        if (file.size > MAX_LOGO_BYTES) { setError(`That image is ${Math.round(file.size / 1024)} KB — please use one under 500 KB.`); return; }
        const reader = new FileReader();
        reader.onload = () => setForm(f => ({ ...f, [side]: reader.result }));
        reader.readAsDataURL(file);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name?.trim()) { setError('The school name is required.'); return; }
        setSaving(true); setError('');
        try { await api.put('/api/settings/profile', form); await settings.reload(); flash('School profile saved.'); }
        catch (err) { setError(serverMessage(err, 'Failed to save the school profile.')); }
        setSaving(false);
    };

    return (
        <form onSubmit={save} style={styles.panel}>
            <h3 style={styles.h3}><Icon name="image" />Logos</h3>
            <div style={styles.logoRow}>
                {[['logoLeft', 'Left logo', settings.logoLeft], ['logoRight', 'Right logo', settings.logoRight]].map(([key, label, fallback]) => (
                    <div key={key} style={styles.logoBox}>
                        <img src={form[key] || fallback} alt={label} style={styles.logoImg} />
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1F3864' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>{form[key] ? 'Uploaded' : 'Built-in logo'}</div>
                        <label style={styles.uploadBtn}><Icon name="upload" />Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={pickLogo(key)} /></label>
                        {form[key] && <button type="button" onClick={() => setForm(f => ({ ...f, [key]: null }))} style={styles.linkBtn}>Use built-in logo</button>}
                    </div>
                ))}
            </div>
            {PROFILE_FIELDS.map(([title, fields]) => (
                <div key={title}>
                    <h3 style={{ ...styles.h3, marginTop: '18px' }}><Icon name="card-text" />{title}</h3>
                    <div style={styles.formGrid}>
                        {fields.map(([k, label, max, req]) => (
                            <label key={k} style={styles.field}>{label}{req ? ' *' : ''}
                                <input style={styles.input} value={form[k] || ''} maxLength={max} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                            </label>
                        ))}
                    </div>
                </div>
            ))}
            <div style={styles.saveBar}>
                <span style={{ fontSize: '13px', color: '#666' }}>{dirty ? 'Unsaved changes' : 'All saved'}</span>
                <button type="submit" disabled={!dirty || saving} style={{ ...styles.primary, opacity: !dirty || saving ? 0.55 : 1 }}>
                    <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save profile'}
                </button>
            </div>
        </form>
    );
};

// ══ Generic editable list (sections, grades, streams, exam types) ═══════════
const useListEditor = (source) => {
    const [rows, setRows] = useState(source);
    useEffect(() => { setRows(source); }, [source]);
    const setRow = (i, patch) => setRows(r => r.map((x, j) => j === i ? { ...x, ...patch } : x));
    const move = (i, d) => setRows(r => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const dirty = !same(rows, source);
    return { rows, setRows, setRow, move, dirty };
};
const withOrder = (rows) => rows.map((r, i) => ({ ...r, sortOrder: i + 1 }));

const SaveBar = ({ dirty, saving, onSave, onUndo, note }) => (
    <div style={styles.saveBar}>
        <span style={{ fontSize: '13px', color: '#666' }}>{note || (dirty ? 'Unsaved changes' : 'All saved')}</span>
        <span style={{ display: 'flex', gap: '8px' }}>
            {dirty && <button type="button" onClick={onUndo} style={styles.secondary}>Undo</button>}
            <button type="button" onClick={onSave} disabled={!dirty || saving} style={{ ...styles.primary, opacity: !dirty || saving ? 0.55 : 1 }}>
                <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}
            </button>
        </span>
    </div>
);

const OrderButtons = ({ i, n, move }) => (
    <span style={{ whiteSpace: 'nowrap' }}>
        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={styles.iconBtn} aria-label="Move up"><i className="bi bi-arrow-up" /></button>
        <button type="button" onClick={() => move(i, 1)} disabled={i === n - 1} style={styles.iconBtn} aria-label="Move down"><i className="bi bi-arrow-down" /></button>
    </span>
);

const useSaver = (settings, setError, flash) => {
    const [saving, setSaving] = useState(false);
    const save = async (url, body, message) => {
        setSaving(true); setError('');
        try { await api.put(url, body); await settings.reload(); flash(message); }
        catch (err) { setError(serverMessage(err, 'Failed to save.')); }
        setSaving(false);
    };
    return { saving, save };
};

// ══ Sections ════════════════════════════════════════════════════════════════
const SectionsTab = ({ settings, setError, flash }) => {
    const ed = useListEditor(settings.sections);
    const { saving, save } = useSaver(settings, setError, flash);
    return (
        <div style={styles.panel}>
            <p style={styles.help}>Sections group the grades. You can rename them, change their colour and mean target, and reorder them. <b>Subject teachers</b>: tick it where each subject has its own teacher; untick it where one class teacher teaches everything. This decides how the Teachers page sets up that section.</p>
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Order</th><th style={styles.th}>Code</th><th style={styles.th}>Name</th><th style={styles.th}>Colour</th><th style={styles.th}>Mean target %</th><th style={styles.th}>Subject teachers</th></tr></thead>
                <tbody>
                    {ed.rows.map((r, i) => (
                        <tr key={r.code}>
                            <td style={styles.td}><OrderButtons i={i} n={ed.rows.length} move={ed.move} /></td>
                            <td style={styles.td}><code>{r.code}</code></td>
                            <td style={styles.td}><input style={styles.cell} value={r.name} maxLength={60} onChange={e => ed.setRow(i, { name: e.target.value })} /></td>
                            <td style={styles.td}><input type="color" value={r.color} onChange={e => ed.setRow(i, { color: e.target.value })} style={styles.color} /></td>
                            <td style={styles.td}><input style={{ ...styles.cell, width: '90px' }} type="number" min="1" max="100" value={r.meanTarget} onChange={e => ed.setRow(i, { meanTarget: e.target.value === '' ? '' : Number(e.target.value) })} /></td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                <input type="checkbox" checked={!!r.subjectTeaching} aria-label={`${r.name}: subject teachers`}
                                    onChange={e => ed.setRow(i, { subjectTeaching: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <SaveBar dirty={ed.dirty} saving={saving} onUndo={() => ed.setRows(settings.sections)}
                onSave={() => save('/api/settings/sections', withOrder(ed.rows), 'Sections saved.')} />
        </div>
    );
};

// ══ Grades & promotion ══════════════════════════════════════════════════════
const GradesTab = ({ settings, setError, flash }) => {
    const ed = useListEditor(settings.grades);
    const { saving, save } = useSaver(settings, setError, flash);
    return (
        <div style={styles.panel}>
            <p style={styles.help}>The full name of each grade, its section, and <strong>which grade its learners are promoted to</strong> at the end of the year (used by Promote Students). The last grade graduates.</p>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ ...styles.table, minWidth: '640px' }}>
                    <thead><tr><th style={styles.th}>Order</th><th style={styles.th}>Code</th><th style={styles.th}>Full name</th><th style={styles.th}>Section</th><th style={styles.th}>Promoted to</th></tr></thead>
                    <tbody>
                        {ed.rows.map((r, i) => (
                            <tr key={r.code}>
                                <td style={styles.td}><OrderButtons i={i} n={ed.rows.length} move={ed.move} /></td>
                                <td style={styles.td}><code>{r.code}</code></td>
                                <td style={styles.td}><input style={styles.cell} value={r.name} maxLength={40} onChange={e => ed.setRow(i, { name: e.target.value })} /></td>
                                <td style={styles.td}>
                                    <select style={styles.cell} value={r.sectionCode} onChange={e => ed.setRow(i, { sectionCode: e.target.value })}>
                                        {settings.sections.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                                    </select>
                                </td>
                                <td style={styles.td}>
                                    <select style={styles.cell} value={r.nextGradeCode || ''} onChange={e => ed.setRow(i, { nextGradeCode: e.target.value || null })}>
                                        <option value="">— Graduates —</option>
                                        {ed.rows.filter(g => g.code !== r.code).map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <SaveBar dirty={ed.dirty} saving={saving} onUndo={() => ed.setRows(settings.grades)}
                onSave={() => save('/api/settings/grades', withOrder(ed.rows), 'Grades saved.')} />
        </div>
    );
};

// ══ Streams ═════════════════════════════════════════════════════════════════
const StreamsTab = ({ settings, setError, flash }) => {
    const ed = useListEditor(settings.streams);
    const { saving, save } = useSaver(settings, setError, flash);
    return (
        <div style={styles.panel}>
            <p style={styles.help}>Streams used when creating classes. Add a new one, rename, recolour, or switch one off (classes already using it keep it).</p>
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Order</th><th style={styles.th}>Name</th><th style={styles.th}>Colour</th><th style={styles.th}>In use</th></tr></thead>
                <tbody>
                    {ed.rows.map((r, i) => (
                        <tr key={r.code || `new-${i}`} style={{ opacity: r.active === false ? 0.55 : 1 }}>
                            <td style={styles.td}><OrderButtons i={i} n={ed.rows.length} move={ed.move} /></td>
                            <td style={styles.td}><input style={styles.cell} value={r.name} maxLength={40} placeholder="e.g. Purple" onChange={e => ed.setRow(i, { name: e.target.value })} />{!r.code && <span style={styles.newTag}>new</span>}</td>
                            <td style={styles.td}><input type="color" value={r.color} onChange={e => ed.setRow(i, { color: e.target.value })} style={styles.color} /></td>
                            <td style={styles.td}><input type="checkbox" checked={r.active !== false} onChange={e => ed.setRow(i, { active: e.target.checked })} aria-label="In use" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button type="button" onClick={() => ed.setRows(r => [...r, { code: null, name: '', color: '#6c757d', active: true }])} style={{ ...styles.linkBtn, marginTop: '8px' }}><Icon name="plus-circle" />Add stream</button>
            <SaveBar dirty={ed.dirty} saving={saving} onUndo={() => ed.setRows(settings.streams)}
                onSave={() => { if (ed.rows.some(r => !r.name?.trim())) { setError('Every stream needs a name.'); return; } save('/api/settings/streams', withOrder(ed.rows), 'Streams saved.'); }} />
        </div>
    );
};

// ══ Exam types ══════════════════════════════════════════════════════════════
const ExamTypesTab = ({ settings, setError, flash }) => {
    const ed = useListEditor(settings.examTypes);
    const { saving, save } = useSaver(settings, setError, flash);
    return (
        <div style={styles.panel}>
            <p style={styles.help}><strong>Core</strong> types are expected every term (the Exams page shows which are still missing). The order sets how exams are listed and compared in progressive reports.</p>
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Order</th><th style={styles.th}>Name</th><th style={styles.th}>Colour</th><th style={styles.th}>Core</th><th style={styles.th}>In use</th></tr></thead>
                <tbody>
                    {ed.rows.map((r, i) => (
                        <tr key={r.code || `new-${i}`} style={{ opacity: r.active === false ? 0.55 : 1 }}>
                            <td style={styles.td}><OrderButtons i={i} n={ed.rows.length} move={ed.move} /></td>
                            <td style={styles.td}><input style={styles.cell} value={r.name} maxLength={40} placeholder="e.g. CAT" onChange={e => ed.setRow(i, { name: e.target.value })} />{!r.code && <span style={styles.newTag}>new</span>}</td>
                            <td style={styles.td}><input type="color" value={r.color} onChange={e => ed.setRow(i, { color: e.target.value })} style={styles.color} /></td>
                            <td style={styles.td}><input type="checkbox" checked={!!r.core} onChange={e => ed.setRow(i, { core: e.target.checked })} aria-label="Core" /></td>
                            <td style={styles.td}><input type="checkbox" checked={r.active !== false} onChange={e => ed.setRow(i, { active: e.target.checked })} aria-label="In use" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button type="button" onClick={() => ed.setRows(r => [...r, { code: null, name: '', color: '#6c757d', core: false, active: true }])} style={{ ...styles.linkBtn, marginTop: '8px' }}><Icon name="plus-circle" />Add exam type</button>
            <SaveBar dirty={ed.dirty} saving={saving} onUndo={() => ed.setRows(settings.examTypes)}
                onSave={() => { if (ed.rows.some(r => !r.name?.trim())) { setError('Every exam type needs a name.'); return; } save('/api/settings/exam-types', withOrder(ed.rows), 'Exam types saved.'); }} />
        </div>
    );
};

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: '0 0 18px 0', fontSize: '14px' },
    link: { color: '#2E75B6', fontWeight: 'bold' },
    warn: { color: '#856404', backgroundColor: '#fff8e1', border: '1px solid #ffc107', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismiss: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    tabs: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
    tab: { border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '14px' },
    h3: { color: '#1F3864', fontSize: '15px', margin: '0 0 10px', display: 'flex', alignItems: 'center' },
    help: { fontSize: '13px', color: '#555', margin: '0 0 12px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '15px', backgroundColor: 'white' },
    logoRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
    logoBox: { border: '1px dashed #ccd6e0', borderRadius: '12px', padding: '12px', width: '190px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' },
    logoImg: { width: '80px', height: '80px', objectFit: 'contain' },
    uploadBtn: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'inline-flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '9px 10px', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' },
    td: { padding: '7px 10px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    cell: { width: '100%', minWidth: '120px', padding: '7px 8px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' },
    color: { width: '46px', height: '32px', border: 'none', padding: 0, background: 'none', cursor: 'pointer' },
    iconBtn: { background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', marginRight: '3px', color: '#1F3864' },
    newTag: { marginLeft: '6px', backgroundColor: '#fff3cd', color: '#856404', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' },
    saveBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '2px solid #f0f2f5', marginTop: '14px', paddingTop: '12px' },
    primary: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'inline-flex', alignItems: 'center' },
    secondary: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0, display: 'inline-flex', alignItems: 'center' },
};

export default Settings;
