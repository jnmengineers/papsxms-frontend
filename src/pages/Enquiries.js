import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/** Admission applications and messages sent from the public website. */
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const COLORS = { NEW: '#b02a37', CONTACTED: '#b8860b', CLOSED: '#1e7e34' };

function Enquiries() {
    const [list, setList] = useState(null);
    const [filter, setFilter] = useState('OPEN');
    const [error, setError] = useState('');
    const load = () => api.get('/api/enquiries').then(r => setList(r.data || [])).catch(() => setError('Could not load enquiries.'));
    useEffect(() => { load(); }, []);
    const setStatus = async (e, status) => {
        const note = status === 'CLOSED' ? window.prompt('Note (optional), e.g. "admitted", "not interested":', e.staffNote || '') : e.staffNote;
        if (note === null) return;
        try { await api.put(`/api/enquiries/${e.enquiryId}`, { status, staffNote: note }); load(); } catch (err) { setError('Could not update.'); }
    };
    const shown = (list || []).filter(e => filter === 'ALL' || (filter === 'OPEN' ? e.status !== 'CLOSED' : e.kind === filter));
    const newCount = (list || []).filter(e => e.status === 'NEW').length;
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '30px', flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: '#1F3864', margin: 0 }}><i className="bi bi-envelope-paper-fill" style={{ marginRight: '8px' }} />Website enquiries {newCount > 0 && <span style={{ fontSize: '14px', color: '#b02a37' }}>({newCount} new)</span>}</h2>
                    <p style={{ color: '#666' }}>Admission applications and messages from the school website. <a href="/website/index.html" target="_blank" rel="noreferrer">Open the website</a></p>
                    {error && <p style={{ color: '#dc3545' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {[['OPEN', 'Open'], ['ADMISSION', 'Admissions'], ['CONTACT', 'Messages'], ['ALL', 'All']].map(([k, l]) => (
                            <button key={k} onClick={() => setFilter(k)} style={{ padding: '7px 14px', borderRadius: '8px', border: '2px solid #1F3864', backgroundColor: filter === k ? '#1F3864' : 'white', color: filter === k ? 'white' : '#1F3864', fontWeight: 700, cursor: 'pointer' }}>{l}</button>))}
                    </div>
                    {!list ? <p>Loading…</p> : shown.length === 0 ? <p style={{ color: '#777' }}>Nothing here.</p> : shown.map(e => (
                        <div key={e.enquiryId} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', borderLeft: `5px solid ${COLORS[e.status] || '#999'}`, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                <b style={{ color: '#1F3864' }}>{e.kind === 'ADMISSION' ? '🎓 Admission' : '✉ Message'} — {e.parentName}</b>
                                <span style={{ fontSize: '12px', color: '#777' }}>{fmt(e.createdAt)} · <b style={{ color: COLORS[e.status] }}>{e.status}</b></span>
                            </div>
                            <div style={{ fontSize: '14px', margin: '4px 0' }}>
                                <a href={`tel:${e.phone}`}>{e.phone}</a>{e.email && <> · <a href={`mailto:${e.email}`}>{e.email}</a></>}
                                {e.learnerName && <> · Learner: <b>{e.learnerName}</b></>}{e.gradeWanted && <> · {e.gradeWanted}</>}
                            </div>
                            {e.message && <p style={{ margin: '4px 0', whiteSpace: 'pre-line', color: '#333' }}>{e.message}</p>}
                            {e.staffNote && <p style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>Note: {e.staffNote}{e.handledBy ? ` (${e.handledBy})` : ''}</p>}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                {e.status !== 'CONTACTED' && e.status !== 'CLOSED' && <button onClick={() => setStatus(e, 'CONTACTED')} style={btn('#b8860b')}>Mark contacted</button>}
                                {e.status !== 'CLOSED' && <button onClick={() => setStatus(e, 'CLOSED')} style={btn('#1e7e34')}>Close</button>}
                                {e.status === 'CLOSED' && <button onClick={() => setStatus(e, 'NEW')} style={btn('#6c757d')}>Reopen</button>}
                            </div>
                        </div>))}
                </div>
            </div>
            <Footer />
        </div>
    );
}
const btn = (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' });
export default Enquiries;
