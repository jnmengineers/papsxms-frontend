import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/** Website news, events and gallery photos — shown on the public website automatically. */
const KINDS = { NEWS: 'News', EVENT: 'Event', GALLERY: 'Gallery photo', SLIDE: 'Slider background', PERSON: 'Management member', PROGRAM: 'Programme' };
const EMPTY = { kind: 'NEWS', title: '', tag: '', body: '', eventDate: '', published: true };
const msg = (err, f) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300 ? d : d?.message || d?.error) || f; };

// Shrink a photo in the browser (longest side 1400px, JPEG) so uploads stay small and fast
const shrink = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => reject(new Error('Not a photo')); img.src = r.result; };
    r.onerror = () => reject(new Error('Could not read the file')); r.readAsDataURL(file);
});

function SitePosts() {
    const [list, setList] = useState(null);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = () => api.get('/api/site-posts').then(r => setList(r.data || [])).catch(() => setError('Could not load.'));
    useEffect(() => { load(); }, []);
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    const pick = async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const data = await shrink(file); setForm(f => ({ ...f, imageBase64: data, preview: data, removeImage: false })); } catch (err) { setError(err.message); } };
    const save = async () => {
        setBusy(true); setError('');
        const body = { ...form, tag: form.kind === 'PERSON' ? (form.tag || 'SCHOOL') : form.tag, eventDate: form.eventDate || null, imageType: form.imageBase64 ? 'image/jpeg' : null };
        try { if (form.postId) await api.put(`/api/site-posts/${form.postId}`, body); else await api.post('/api/site-posts', body); setForm(null); load(); }
        catch (err) { setError(msg(err, 'Could not save.')); }
        setBusy(false);
    };
    const del = async (p) => { if (!window.confirm(`Delete "${p.title || 'this photo'}"?`)) return; try { await api.delete(`/api/site-posts/${p.postId}`); load(); } catch (err) { setError('Could not delete.'); } };
    const edit = (p) => setForm({ postId: p.postId, kind: p.kind, title: p.title || '', tag: p.tag || '', body: p.body || '', eventDate: p.eventDate || '', published: p.published, preview: p.published && p.image ? p.image : null, hasImage: p.hasImage });

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '30px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h2 style={{ color: '#13306B', margin: 0 }}><i className="bi bi-newspaper" style={{ marginRight: '8px' }} />Website news &amp; gallery</h2>
                        <button onClick={() => setForm({ ...EMPTY })} style={st.btn('#C8102E')}><i className="bi bi-plus-lg" /> Add</button>
                        <a href="/website/index.html" target="_blank" rel="noreferrer">View website</a>
                    </div>
                    <p style={{ color: '#666' }}>News and events appear in "News &amp; events"; gallery photos in "Gallery". Hidden items stay off the website.</p>
                    {error && <p style={{ color: '#dc3545' }}>{error}</p>}

                    {form && (
                        <div style={st.card}>
                            <div style={st.grid}>
                                <label style={st.lbl}>Type<select style={st.in} value={form.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                <label style={st.lbl}>{form.kind === 'PERSON' ? 'Name' : form.kind === 'PROGRAM' ? 'Programme (e.g. Kindergarten (ages 3–5))' : 'Title'}{form.kind === 'GALLERY' ? ' (optional)' : ''}<input style={st.in} maxLength={150} value={form.title} onChange={set('title')} /></label>
                                {form.kind === 'PERSON' ? <label style={st.lbl}>Group<select style={st.in} value={form.tag || 'SCHOOL'} onChange={set('tag')}><option value="BOARD">Board of management</option><option value="SCHOOL">School management</option></select></label>
                                    : !['GALLERY', 'PROGRAM'].includes(form.kind) && <label style={st.lbl}>{form.kind === 'SLIDE' ? 'Small label (e.g. Welcome)' : 'Label (e.g. Sports)'}<input style={st.in} maxLength={30} value={form.tag} onChange={set('tag')} /></label>}
                                {form.kind === 'EVENT' && <label style={st.lbl}>Event date<input type="date" style={st.in} value={form.eventDate} onChange={set('eventDate')} /></label>}
                            </div>
                            {form.kind !== 'GALLERY' && <label style={{ ...st.lbl, marginTop: '10px' }}>{form.kind === 'PERSON' ? 'Role (e.g. Head Teacher)' : 'Text'}<textarea style={st.in} rows={4} maxLength={2000} value={form.body} onChange={set('body')} /></label>}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                                {form.preview && <img src={form.preview} alt="" style={{ height: '90px', borderRadius: '8px' }} />}
                                {!form.preview && form.hasImage && <span style={{ color: '#777', fontSize: '13px' }}>Photo saved (hidden item)</span>}
                                <label style={st.lbl}>{form.preview || form.hasImage ? 'Change photo' : 'Photo'}<input type="file" accept="image/*" onChange={pick} /></label>
                                {(form.preview || form.hasImage) && !['GALLERY', 'SLIDE'].includes(form.kind) && <button onClick={() => setForm(f => ({ ...f, preview: null, imageBase64: null, hasImage: false, removeImage: true }))} style={st.btn('#6c757d')}>Remove photo</button>}
                                <label style={{ ...st.lbl, flexDirection: 'row', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={!!form.published} onChange={set('published')} />Show on website</label>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <button onClick={save} disabled={busy} style={st.btn('#13306B')}>{busy ? 'Saving…' : 'Save'}</button>
                                <button onClick={() => setForm(null)} disabled={busy} style={st.btn('#6c757d')}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {!list ? <p>Loading…</p> : list.length === 0 ? <p style={{ color: '#777' }}>Nothing posted yet.</p> : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                            {list.map(p => (
                                <div key={p.postId} style={{ ...st.card, padding: 0, overflow: 'hidden', opacity: p.published ? 1 : 0.6 }}>
                                    <div style={{ height: '130px', background: p.published && p.image ? `center/cover url(${p.image})` : 'linear-gradient(135deg,#13306B,#2B4F8C)' }} />
                                    <div style={{ padding: '10px 12px' }}>
                                        <small style={{ color: '#C8102E', fontWeight: 700 }}>{KINDS[p.kind]}{p.published ? '' : ' · hidden'}</small>
                                        <div style={{ fontWeight: 700, color: '#13306B' }}>{p.title || '(photo)'}</div>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                            <button onClick={() => edit(p)} style={st.btn('#2B4F8C')}>Edit</button>
                                            <button onClick={() => del(p)} style={st.btn('#dc3545')}>Delete</button>
                                        </div>
                                    </div>
                                </div>))}
                        </div>)}
                </div>
            </div>
            <Footer />
        </div>
    );
}
const st = {
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#13306B' },
    in: { padding: '9px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '15px', fontWeight: 400, fontFamily: 'inherit' },
    btn: (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }),
};
export default SitePosts;
