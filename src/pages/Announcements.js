import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/**
 * Notices — staff read the notices meant for them; the admin posts, edits, takes down
 * and sees who has read each one.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const fmtDate = (d) => { if (!d) return ''; const x = new Date(`${String(d).slice(0, 10)}T00:00:00`); return isNaN(x) ? String(d) : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const AUDIENCES = [['ALL', 'All staff'], ['TEACHER', 'Teachers'], ['CLERK', 'Clerks'], ['ACCOUNTANT', 'Bursar'], ['ADMIN', 'Admins']];
const audienceText = (a = []) => (a.includes('ALL') ? 'All staff' : a.map(x => AUDIENCES.find(y => y[0] === x)?.[1] || x).join(', '));
const EMPTY = { title: '', body: '', audience: ['ALL'], pinned: false, urgent: false, startsOn: '', endsOn: '' };
const changed = () => window.dispatchEvent(new Event('notices-changed'));

function Announcements() {
    const isAdmin = localStorage.getItem('role') === 'ADMIN';
    const [tab, setTab] = useState('read');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const flash = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 4000); };
    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="megaphone-fill" style={{ marginRight: '10px' }} />Notices</h2>
                    <p style={st.subtitle}>Notices from the school office.</p>
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}
                    {isAdmin && (
                        <div style={st.tabs} role="tablist">
                            {[['read', 'envelope-open-fill', 'My notices'], ['manage', 'pencil-square', 'Post & manage']].map(([k, ic, l]) => (
                                <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setError(''); setTab(k); }}
                                    style={{ ...st.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}><Icon name={ic} />{l}</button>
                            ))}
                        </div>
                    )}
                    {tab === 'read' && <ReadTab setError={setError} />}
                    {tab === 'manage' && isAdmin && <ManageTab setError={setError} flash={flash} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

function ReadTab({ setError }) {
    const [list, setList] = useState(null);
    const [open, setOpen] = useState({});
    const load = useCallback(() => api.get('/api/announcements').then(r => setList(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load notices.'))), [setError]);
    useEffect(() => { load(); }, [load]);
    const toggle = async (n) => {
        setOpen(o => ({ ...o, [n.announcementId]: !o[n.announcementId] }));
        if (!n.read) {
            try { await api.post(`/api/announcements/${n.announcementId}/read`); setList(l => l.map(x => (x.announcementId === n.announcementId ? { ...x, read: true } : x))); changed(); }
            catch (err) { /* reading still works if marking fails */ }
        }
    };
    const markAll = async () => {
        const unread = list.filter(n => !n.read);
        await Promise.allSettled(unread.map(n => api.post(`/api/announcements/${n.announcementId}/read`)));
        await load(); changed();
    };
    if (!list) return <p style={st.center}><Icon name="hourglass-split" />Loading…</p>;
    if (!list.length) return <div style={st.panel}><p style={{ margin: 0, color: '#666' }}><Icon name="inbox" />No notices right now.</p></div>;
    const unread = list.filter(n => !n.read).length;
    return (
        <div>
            {unread > 0 && <div style={{ ...st.bar, marginBottom: '10px' }}><span style={st.muted}>{unread} unread</span><button onClick={markAll} style={{ ...st.link, marginLeft: 'auto' }}>Mark all as read</button></div>}
            {list.map(n => {
                const isOpen = open[n.announcementId] || n.pinned;
                return (
                    <div key={n.announcementId} onClick={() => toggle(n)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') toggle(n); }}
                        style={{ ...st.card, borderLeftColor: n.urgent ? '#dc3545' : n.pinned ? '#fd7e14' : '#2E75B6', backgroundColor: n.read ? 'white' : '#f5f9ff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {n.pinned && <i className="bi bi-pin-angle-fill" style={{ color: '#fd7e14' }} aria-label="Pinned" />}
                            {n.urgent && <span style={{ ...st.pill, backgroundColor: '#dc3545' }}>URGENT</span>}
                            {!n.read && <span style={{ ...st.pill, backgroundColor: '#2E75B6' }}>NEW</span>}
                            <strong style={{ color: '#1F3864', fontSize: '16px', fontWeight: n.read ? 600 : 800 }}>{n.title}</strong>
                            <span style={{ ...st.muted, marginLeft: 'auto' }}>{fmtDate(n.startsOn)}</span>
                        </div>
                        {isOpen ? <p style={st.body}>{n.body}</p> : <p style={{ ...st.body, ...st.clip }}>{n.body}</p>}
                        {n.endsOn && <div style={st.small}>Until {fmtDate(n.endsOn)}</div>}
                    </div>
                );
            })}
        </div>
    );
}

function ManageTab({ setError, flash }) {
    const [list, setList] = useState(null);
    const [form, setForm] = useState(null);         // null = closed; {...} = new or editing
    const [saving, setSaving] = useState(false);
    const [readers, setReaders] = useState(null);   // { notice, list }
    const load = useCallback(() => api.get('/api/announcements/admin').then(r => setList(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load notices.'))), [setError]);
    useEffect(() => { load(); }, [load]);

    const toggleAudience = (key) => setForm(f => {
        if (key === 'ALL') return { ...f, audience: ['ALL'] };
        const rest = f.audience.filter(a => a !== 'ALL');
        const next = rest.includes(key) ? rest.filter(a => a !== key) : [...rest, key];
        return { ...f, audience: next.length ? next : ['ALL'] };
    });
    const save = async (e) => {
        e.preventDefault();
        if (form.title.trim().length < 3) { setError('Give the notice a title (at least 3 letters).'); return; }
        if (!form.body.trim()) { setError('Write the notice.'); return; }
        if (form.endsOn && form.startsOn && form.endsOn < form.startsOn) { setError('The end date is before the start date.'); return; }
        setSaving(true); setError('');
        const payload = { ...form, title: form.title.trim(), body: form.body.trim(), startsOn: form.startsOn || null, endsOn: form.endsOn || null };
        try {
            const r = form.announcementId ? await api.put(`/api/announcements/admin/${form.announcementId}`, payload) : await api.post('/api/announcements/admin', payload);
            flash(r.data.message); setForm(null); await load(); changed();
        } catch (err) { setError(serverMessage(err, 'Failed to save the notice.')); }
        setSaving(false);
    };
    const archive = async (n, down) => {
        if (down && !window.confirm(`Take down "${n.title}"? Staff will no longer see it (you can restore it later).`)) return;
        try { const r = await api.post(`/api/announcements/admin/${n.announcementId}/${down ? 'archive' : 'restore'}`); flash(r.data.message); await load(); changed(); }
        catch (err) { setError(serverMessage(err, 'Failed.')); }
    };
    const showReaders = async (n) => {
        try { const r = await api.get(`/api/announcements/admin/${n.announcementId}/readers`); setReaders({ notice: n, list: r.data || [] }); }
        catch (err) { setError(serverMessage(err, 'Could not load readers.')); }
    };
    const status = (n) => n.archived ? ['Taken down', '#6c757d'] : n.showingNow ? ['Showing', '#28a745'] : n.startsOn > today() ? ['Scheduled', '#2E75B6'] : ['Ended', '#6c757d'];

    return (
        <div>
            {!form ? (
                <button onClick={() => setForm({ ...EMPTY, startsOn: today() })} style={{ ...st.primary, marginBottom: '12px' }}><Icon name="plus-circle-fill" />Post a notice</button>
            ) : (
                <form onSubmit={save} style={st.panel}>
                    <h3 style={st.h3}>{form.announcementId ? 'Edit notice' : 'New notice'}</h3>
                    <label style={st.lbl}>Title<input style={st.input} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Staff meeting on Friday" /></label>
                    <label style={st.lbl}>Notice<textarea style={{ ...st.input, minHeight: '120px', fontFamily: 'inherit' }} maxLength={4000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
                    <div style={st.small}>{form.body.length}/4000</div>
                    <div style={{ ...st.lbl, marginTop: '8px' }}>Who sees it
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontWeight: 'normal' }}>
                            {AUDIENCES.map(([k, l]) => <label key={k} style={st.check}><input type="checkbox" checked={form.audience.includes(k)} onChange={() => toggleAudience(k)} />{l}</label>)}
                        </div>
                    </div>
                    <div style={st.grid}>
                        <label style={st.lbl}>Show from<input type="date" style={st.input} value={form.startsOn} onChange={e => setForm({ ...form, startsOn: e.target.value })} /></label>
                        <label style={st.lbl}>Until (optional)<input type="date" style={st.input} value={form.endsOn} min={form.startsOn || undefined} onChange={e => setForm({ ...form, endsOn: e.target.value })} /></label>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '6px 0 12px' }}>
                        <label style={st.check}><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /><Icon name="pin-angle-fill" style={{ color: '#fd7e14' }} />Pin to the top</label>
                        <label style={st.check}><input type="checkbox" checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })} /><Icon name="exclamation-octagon-fill" style={{ color: '#dc3545' }} />Urgent</label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setForm(null)} style={st.secondary} disabled={saving}>Cancel</button>
                        <button type="submit" disabled={saving} style={{ ...st.primary, opacity: saving ? 0.6 : 1 }}><Icon name={saving ? 'hourglass-split' : 'send-fill'} />{saving ? 'Saving…' : form.announcementId ? 'Save changes' : 'Post notice'}</button>
                    </div>
                </form>
            )}

            {!list ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : !list.length ? <div style={st.panel}><p style={{ margin: 0, color: '#666' }}>No notices posted yet.</p></div> : (
                <div style={st.panel}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={st.table}>
                            <thead><tr><th style={st.th}>Notice</th><th style={st.th}>For</th><th style={st.th}>Dates</th><th style={st.th}>Status</th><th style={st.th}>Read</th><th style={st.th}></th></tr></thead>
                            <tbody>
                                {list.map((n, i) => {
                                    const [label, colour] = status(n);
                                    return (
                                        <tr key={n.announcementId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: n.archived ? 0.6 : 1 }}>
                                            <td style={st.td}>{n.pinned && <i className="bi bi-pin-angle-fill" style={{ color: '#fd7e14', marginRight: '4px' }} aria-label="Pinned" />}{n.urgent && <span style={{ ...st.pill, backgroundColor: '#dc3545', marginRight: '4px' }}>URGENT</span>}<strong>{n.title}</strong><div style={st.small}>by {n.createdBy}</div></td>
                                            <td style={st.td}>{audienceText(n.audience)}</td>
                                            <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{fmtDate(n.startsOn)}{n.endsOn ? ` – ${fmtDate(n.endsOn)}` : ''}</td>
                                            <td style={st.td}><span style={{ ...st.pill, backgroundColor: colour }}>{label}</span></td>
                                            <td style={st.td}><button onClick={() => showReaders(n)} style={st.link} title="See who has read it">{n.readCount}/{n.audienceCount}</button></td>
                                            <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                                <button onClick={() => setForm({ announcementId: n.announcementId, title: n.title, body: n.body, audience: n.audience, pinned: n.pinned, urgent: n.urgent, startsOn: n.startsOn || '', endsOn: n.endsOn || '' })} style={st.iconBtn} title="Edit"><i className="bi bi-pencil" aria-label="Edit" /></button>
                                                <button onClick={() => archive(n, !n.archived)} style={{ ...st.iconBtn, color: n.archived ? '#28a745' : '#b02a37' }} title={n.archived ? 'Restore' : 'Take down'}><i className={`bi bi-${n.archived ? 'arrow-counterclockwise' : 'eye-slash'}`} aria-label={n.archived ? 'Restore' : 'Take down'} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {readers && (
                <div style={st.backdrop} onClick={e => { if (e.target === e.currentTarget) setReaders(null); }}>
                    <div style={st.dialog} role="dialog" aria-modal="true" aria-label="Who has read it">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ ...st.h3, margin: 0 }}>{readers.notice.title}</h3>
                            <button onClick={() => setReaders(null)} style={st.iconBtn} aria-label="Close"><i className="bi bi-x-lg" /></button>
                        </div>
                        <p style={st.muted}>{readers.list.filter(r => r.readAt).length} of {readers.list.length} have read it.</p>
                        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                            {readers.list.map(r => (
                                <div key={r.username} style={st.readerRow}>
                                    <span style={{ flex: 1 }}>{r.name}<span style={st.small}> · {r.role}</span></span>
                                    {r.readAt ? <span style={{ color: '#1e7e34', fontSize: '12px' }}><i className="bi bi-check2-all" aria-hidden="true" /> {new Date(r.readAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        : <span style={{ color: '#b02a37', fontSize: '12px' }}>Not yet</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const st = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px', maxWidth: '1000px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 14px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
    tab: { padding: '9px 14px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    card: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px', borderLeft: '5px solid', cursor: 'pointer' },
    body: { whiteSpace: 'pre-line', margin: '8px 0 4px', color: '#333', fontSize: '14px', lineHeight: 1.5 },
    clip: { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    pill: { color: 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' },
    bar: { display: 'flex', alignItems: 'center', gap: '8px' },
    h3: { color: '#1F3864', margin: '0 0 10px', fontSize: '16px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864', marginBottom: '8px' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: 'normal', color: '#222' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '9px 14px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' },
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#2E75B6', fontSize: '16px', padding: '2px 6px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '680px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '12px' },
    dialog: { backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
    readerRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
};

export default Announcements;
