import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/** Applications for job vacancies from the website (admin, head teacher). */
const STAGES = { NEW: 'New', SHORTLISTED: 'Shortlisted', INTERVIEW: 'Interview', HIRED: 'Hired', NOT_SUCCESSFUL: 'Not successful' };
const COLORS = { NEW: '#C8102E', SHORTLISTED: '#b8860b', INTERVIEW: '#6f42c1', HIRED: '#1e7e34', NOT_SUCCESSFUL: '#6c757d' };
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function JobApplications() {
    const [list, setList] = useState(null);
    const [vacancy, setVacancy] = useState('ALL');
    const [error, setError] = useState('');
    const load = () => api.get('/api/job-applications').then(r => setList(r.data || [])).catch(() => setError('Could not load applications.'));
    useEffect(() => { load(); }, []);
    const update = async (a, patch) => { try { await api.put(`/api/job-applications/${a.applicationId}`, { status: a.status, staffNote: a.staffNote, ...patch }); load(); } catch (e) { setError('Could not update.'); } };
    const note = (a) => { const n = window.prompt('Note (e.g. interview Tue 10am, strong maths):', a.staffNote || ''); if (n !== null) update(a, { staffNote: n }); };
    const openCv = async (a) => {   // the CV needs the login, so it is fetched and opened as a file
        try { const r = await api.get(`/api/job-applications/${a.applicationId}/cv`, { responseType: 'blob' }); window.open(URL.createObjectURL(r.data), '_blank'); }
        catch (e) { setError('Could not open the CV.'); }
    };
    const openDoc = async (d) => {
        try { const r = await api.get(`/api/job-applications/docs/${d.docId}`, { responseType: 'blob' }); window.open(URL.createObjectURL(r.data), '_blank'); }
        catch (e) { setError('Could not open the document.'); }
    };
    const del = async (a) => { if (!window.confirm(`Delete ${a.fullName}'s application?`)) return; try { await api.delete(`/api/job-applications/${a.applicationId}`); load(); } catch (e) { setError('Could not delete.'); } };
    const titles = [...new Set((list || []).map(a => a.vacancyTitle))];
    const shown = (list || []).filter(a => vacancy === 'ALL' || a.vacancyTitle === vacancy);
    const btn = (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' });
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '30px', flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: '#13306B', margin: 0 }}><i className="bi bi-briefcase-fill" style={{ marginRight: '8px' }} />Job applications</h2>
                    <p style={{ color: '#666' }}>From the website's Careers section. Post vacancies in Website News &amp; Gallery → Job vacancy.</p>
                    {error && <p style={{ color: '#dc3545' }}>{error}</p>}
                    {titles.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {['ALL', ...titles].map(t => (
                                <button key={t} onClick={() => setVacancy(t)} style={{ padding: '7px 14px', borderRadius: '8px', border: '2px solid #13306B', backgroundColor: vacancy === t ? '#13306B' : 'white', color: vacancy === t ? 'white' : '#13306B', fontWeight: 700, cursor: 'pointer' }}>
                                    {t === 'ALL' ? 'All' : t} ({(list || []).filter(a => t === 'ALL' || a.vacancyTitle === t).length})
                                </button>))}
                        </div>)}
                    {!list ? <p>Loading…</p> : shown.length === 0 ? <p style={{ color: '#777' }}>No applications yet.</p> : shown.map(a => (
                        <div key={a.applicationId} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', borderLeft: `5px solid ${COLORS[a.status] || '#999'}`, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                <b style={{ color: '#13306B' }}>{a.fullName} <span style={{ fontWeight: 400, color: '#666' }}>— {a.vacancyTitle}</span></b>
                                <span style={{ fontSize: '12px', color: '#777' }}>{fmt(a.createdAt)} · <b style={{ color: COLORS[a.status] }}>{STAGES[a.status] || a.status}</b></span>
                            </div>
                            <div style={{ fontSize: '14px', margin: '4px 0' }}><a href={`tel:${a.phone}`}>{a.phone}</a>{a.email && <> · <a href={`mailto:${a.email}`}>{a.email}</a></>}</div>
                            {a.qualifications && <div style={{ fontSize: '13px' }}><b>Qualifications:</b> {a.qualifications}</div>}
                            {a.message && <p style={{ margin: '4px 0', whiteSpace: 'pre-line', color: '#333', fontSize: '13px' }}>{a.message}</p>}
                            {a.staffNote && <p style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>Note: {a.staffNote}{a.handledBy ? ` (${a.handledBy})` : ''}</p>}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <select value={a.status} onChange={e => update(a, { status: e.target.value })} style={{ padding: '5px', borderRadius: '7px', fontSize: '12px' }} aria-label="Stage">
                                    {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                {a.hasCv ? <button onClick={() => openCv(a)} style={btn('#13306B')}><i className="bi bi-file-earmark-pdf" /> CV</button> : <span style={{ fontSize: '12px', color: '#999' }}>No CV</span>}
                                {(a.docs || []).map((d, i) => <button key={d.docId} onClick={() => openDoc(d)} style={btn('#2B4F8C')} title={d.fileName}><i className="bi bi-file-earmark-text" /> {d.fileName.length > 22 ? `Doc ${i + 1}` : d.fileName}</button>)}
                                <button onClick={() => note(a)} style={btn('#6c757d')}>Note</button>
                                <button onClick={() => del(a)} style={btn('#dc3545')}>Delete</button>
                            </div>
                        </div>))}
                </div>
            </div>
            <Footer />
        </div>
    );
}
export default JobApplications;
