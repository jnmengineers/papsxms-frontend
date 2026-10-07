import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/**
 * Parents & guardians: phone numbers for fee reminders, and siblings (children who share a parent).
 * A phone number belongs to one parent only — add more children to that parent instead.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
export const prettyPhone = (p) => (p && p.startsWith('+254') && p.length === 13 ? `0${p.slice(4, 7)} ${p.slice(7)}` : p || '');
const EMPTY = { guardianId: null, fullName: '', phone: '', phone2: '', email: '', relationship: 'Mother', notes: '', children: [] };

function Parents() {
    const [list, setList] = useState(null);
    const [students, setStudents] = useState([]);
    const [q, setQ] = useState('');
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [importing, setImporting] = useState(false);
    const load = useCallback(() => api.get('/api/guardians').then(r => setList(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load the parents.'))), []);
    useEffect(() => { load(); api.get('/api/students').then(r => setStudents(r.data || [])).catch(() => {}); }, [load]);
    const linked = new Set((list || []).flatMap(g => g.children.map(c => c.studentId)));
    const shown = (list || []).filter(g => { const t = norm(q); return !t || norm(`${g.fullName} ${g.phone} ${prettyPhone(g.phone)} ${g.children.map(c => `${c.name} ${c.admissionNumber}`).join(' ')}`).includes(t); });
    const noParent = students.filter(s => !linked.has(s.studentId)).length;

    const save = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const r = await api.put('/api/guardians', { ...form, studentIds: form.children.map(c => c.studentId) });
            setSuccess(r.data.message); setTimeout(() => setSuccess(''), 4000); setForm(null); await load();
        } catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    const remove = async (g) => {
        if (!window.confirm(`Remove ${g.fullName}? Their children stay; only the parent record and links are removed.`)) return;
        try { const r = await api.delete(`/api/guardians/${g.guardianId}`); setSuccess(r.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Could not remove.')); }
    };

    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="people-fill" style={{ marginRight: '10px' }} />Parents &amp; guardians</h2>
                    <p style={st.subtitle}>Phone numbers for fee reminders. Children who share a parent are siblings — one payment can then be shared between them.</p>
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}
                    {importing && !form && <ImportPanel onDone={(m) => { setSuccess(m); setImporting(false); load(); }} setError={setError} />}
                    {form ? <ParentForm form={form} setForm={setForm} students={students} save={save} /> : <>
                        <div style={{ ...st.panel, ...st.bar }}>
                            <button onClick={() => setForm({ ...EMPTY })} style={st.primary}><Icon name="person-plus-fill" />Add parent</button>
                            <button onClick={() => setImporting(x => !x)} style={st.secondary}><Icon name="file-earmark-arrow-up" />Import from Excel</button>
                            <input style={{ ...st.input, flex: 1, minWidth: '200px' }} placeholder="Find by parent, phone or child…" value={q} onChange={e => setQ(e.target.value)} />
                            <span style={st.muted}>{list ? `${list.length} parent(s)` : ''}{students.length ? ` · ${noParent} learner(s) with no parent recorded` : ''}</span>
                        </div>
                        {!list ? <p style={st.muted}>Loading…</p> : (
                            <div style={{ ...st.panel, overflowX: 'auto' }}>
                                <table style={st.table}>
                                    <thead><tr>{['Parent / guardian', 'Phone', 'Children', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {shown.map((g, i) => (
                                            <tr key={g.guardianId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                                <td style={st.td}><b>{g.fullName}</b><div style={st.small}>{g.relationship}{g.email ? ` · ${g.email}` : ''}</div></td>
                                                <td style={st.td}>{prettyPhone(g.phone)}{g.phone2 && <div style={st.small}>{prettyPhone(g.phone2)}</div>}</td>
                                                <td style={st.td}>{g.children.length ? g.children.map(c => <div key={c.studentId}>{c.name} <span style={st.small}>{c.className} · {c.admissionNumber}</span></div>) : <span style={{ color: '#b8860b' }}>no children linked</span>}</td>
                                                <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                                    <button onClick={() => setForm({ ...EMPTY, ...g, phone: prettyPhone(g.phone), phone2: prettyPhone(g.phone2), email: g.email || '', notes: g.notes || '', relationship: g.relationship || '' })} style={st.link}><Icon name="pencil" />Edit</button>
                                                    <button onClick={() => remove(g)} style={{ ...st.link, color: '#b02a37' }} aria-label="Remove"><i className="bi bi-trash" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!shown.length && <tr><td colSpan={4} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>{list.length ? 'Nobody matches.' : 'No parents yet — press "Add parent".'}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>}
                </div>
            </div>
            <Footer />
        </div>
    );
}

/** Import from Excel/CSV: download the template (learners without parents), fill it in, upload, check, import. */
const ACTION = { NEW_PARENT: ['New parent', '#1e7e34'], SAME_FAMILY: ['Same family (same phone)', '#0f766e'], ADD_TO_EXISTING: ['Added to existing parent', '#2E75B6'], ALREADY: ['Already linked', '#6c757d'], PROBLEM: ['Problem', '#b02a37'] };
function ImportPanel({ onDone, setError }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const template = async () => {
        try {
            const r = await api.get('/api/guardians/import-template', { responseType: 'blob' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'Parents to fill in.xlsx';
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } catch (err) { setError('Could not download the template.'); }
    };
    const send = async (commit) => {
        if (!file) { setError('Choose the filled-in file first.'); return; }
        const fd = new FormData(); fd.append('file', file);
        setBusy(true); setError('');
        try {
            // The shared client defaults to JSON; a file must go as multipart (the browser adds the boundary)
            const r = await api.post(`/api/guardians/import?commit=${commit}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (commit) onDone(r.data.message); else setPreview(r.data);
        } catch (err) { setError(serverMessage(err, 'Could not read the file.')); }
        setBusy(false);
    };
    return (
        <div style={st.panel}>
            <h3 style={st.h3}><Icon name="file-earmark-spreadsheet" />Import parents from Excel</h3>
            <ol style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '13px', color: '#444', lineHeight: 1.7 }}>
                <li><button type="button" onClick={template} style={st.link}><Icon name="download" />Download the template</button> — it already lists every learner without a parent.</li>
                <li>Fill in the parent's <b>name</b> and <b>phone</b> (and relationship if you like). Children with the same phone become one family. Leave a row empty to skip it.</li>
                <li>Upload it below, check the list, then import. (CSV files with the same headings work too.)</li>
            </ol>
            <div style={st.bar}>
                <input type="file" accept=".xlsx,.csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} aria-label="Filled-in file" />
                <button type="button" onClick={() => send(false)} disabled={!file || busy} style={{ ...st.secondary, opacity: file && !busy ? 1 : 0.5 }}><Icon name={busy ? 'hourglass-split' : 'search'} />Check the file</button>
            </div>
            {preview && (
                <div style={{ marginTop: '12px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '14px' }}><b>{preview.newParents}</b> new parent(s), <b>{preview.links}</b> child link(s)
                        {preview.problems > 0 && <span style={{ color: '#b02a37' }}> · <b>{preview.problems}</b> row(s) with problems (they'll be skipped)</span>}
                        {preview.leftBlank > 0 && <span style={st.muted}> · {preview.leftBlank} row(s) left empty</span>}</p>
                    <div style={{ overflowX: 'auto', maxHeight: '360px', overflowY: 'auto' }}>
                        <table style={st.table}>
                            <thead><tr>{['Row', 'Adm', 'Learner', 'Parent', 'Phone', 'Result'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                            <tbody>{preview.rows.map(r => { const [l, c] = ACTION[r.action] || [r.action, '#666']; return (
                                <tr key={r.row}><td style={st.td}>{r.row}</td><td style={st.td}>{r.admissionNumber}</td><td style={st.td}>{r.learner || '—'}</td><td style={st.td}>{r.parent}</td>
                                    <td style={st.td}>{prettyPhone(r.phone)}</td><td style={{ ...st.td, color: c, fontWeight: 600 }}>{l}{r.problem && r.action !== 'ALREADY' ? `: ${r.problem}` : ''}{r.note ? <div style={st.small}>{r.note}</div> : null}</td></tr>); })}</tbody>
                        </table>
                    </div>
                    <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button type="button" onClick={() => send(true)} disabled={busy || !preview.links} style={{ ...st.primary, opacity: preview.links && !busy ? 1 : 0.5 }}><Icon name="check2-all" />Import {preview.links} link(s)</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ParentForm({ form, setForm, students, save }) {
    const [q, setQ] = useState('');
    const set = (p) => setForm(f => ({ ...f, ...p }));
    const have = new Set(form.children.map(c => c.studentId));
    const matches = norm(q).length < 2 ? [] : students.filter(s => !have.has(s.studentId) && norm(`${s.firstName} ${s.lastName} ${s.admissionNumber}`).includes(norm(q))).slice(0, 8);
    const add = (s) => { set({ children: [...form.children, { studentId: s.studentId, name: `${s.firstName} ${s.lastName}`, admissionNumber: s.admissionNumber, className: s.schoolClass?.className }] }); setQ(''); };
    return (
        <form onSubmit={save} style={st.panel}>
            <h3 style={st.h3}>{form.guardianId ? `Edit — ${form.fullName}` : 'Add parent / guardian'}</h3>
            <div style={st.grid}>
                <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Full name<input style={{ ...st.input, textTransform: 'uppercase' }} required maxLength={100} value={form.fullName} onChange={e => set({ fullName: e.target.value.toUpperCase() })} /></label>
                <label style={st.lbl}>Relationship<select style={st.input} value={form.relationship} onChange={e => set({ relationship: e.target.value })}>{['Mother', 'Father', 'Guardian', 'Grandparent', 'Sponsor', 'Other'].map(r => <option key={r}>{r}</option>)}</select></label>
                <label style={st.lbl}>Phone (for reminders)<input style={st.input} required inputMode="tel" maxLength={20} placeholder="0712 345678" value={form.phone} onChange={e => set({ phone: e.target.value })} /></label>
                <label style={st.lbl}>Other phone (optional)<input style={st.input} inputMode="tel" maxLength={20} value={form.phone2} onChange={e => set({ phone2: e.target.value })} /></label>
                <label style={st.lbl}>Email (optional)<input style={st.input} type="email" maxLength={100} value={form.email} onChange={e => set({ email: e.target.value })} /></label>
            </div>
            <h4 style={st.h4}><Icon name="backpack-fill" />Children ({form.children.length})</h4>
            {form.children.map(c => (
                <div key={c.studentId} style={st.item}><span style={{ flex: 1 }}><b>{c.name}</b> <span style={st.small}>{c.className} · {c.admissionNumber}</span></span>
                    <button type="button" onClick={() => set({ children: form.children.filter(x => x.studentId !== c.studentId) })} style={{ ...st.link, color: '#b02a37' }} aria-label={`Remove ${c.name}`}><i className="bi bi-x-lg" /></button></div>
            ))}
            <div style={{ position: 'relative', maxWidth: '460px', marginTop: '6px' }}>
                <input style={{ ...st.input, width: '100%', boxSizing: 'border-box' }} placeholder="Add a child: type a name or admission number…" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a child" />
                {matches.length > 0 && <div style={st.dropdown}>{matches.map(s => (
                    <button type="button" key={s.studentId} onClick={() => add(s)} style={st.option}>{s.firstName} {s.lastName} <span style={st.small}>{s.schoolClass?.className} · {s.admissionNumber}</span></button>))}</div>}
            </div>
            <label style={{ ...st.lbl, marginTop: '12px' }}>Notes<input style={st.input} maxLength={200} value={form.notes} onChange={e => set({ notes: e.target.value })} /></label>
            <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '14px' }}>
                <button type="button" onClick={() => setForm(null)} style={st.secondary}>Cancel</button>
                <button type="submit" style={st.primary}><Icon name="save-fill" />Save</button>
            </div>
        </form>
    );
}

const st = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 14px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    dropdown: { position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
    option: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0f0f0', background: 'white', cursor: 'pointer', fontSize: '14px' },
    item: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '17px' },
    h4: { color: '#1F3864', margin: '16px 0 8px', fontSize: '14px', borderBottom: '1px solid #e3e8f0', paddingBottom: '4px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '640px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};

export default Parents;
