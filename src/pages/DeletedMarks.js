import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/** Every deleted mark — who deleted it and when — with Restore (admin only). */
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const msg = (err, f) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300 ? d : d?.message || d?.error) || f; };

function DeletedMarks() {
    const [list, setList] = useState(null);
    const [q, setQ] = useState('');
    const [note, setNote] = useState('');
    const load = () => api.get('/api/results/deleted').then(r => setList(r.data || [])).catch(err => setNote(msg(err, 'Could not load.')));
    useEffect(() => { load(); }, []);
    const restore = async (d) => {
        if (!window.confirm(`Restore ${d.learnerName}'s ${d.subjectName} mark (${d.marksObtained}) for ${d.examName}?`)) return;
        try { const r = await api.post(`/api/results/deleted/${d.id}/restore`); setNote(r.data.message); load(); } catch (err) { setNote(msg(err, 'Could not restore.')); }
    };
    const s = q.trim().toLowerCase();
    const shown = (list || []).filter(d => !s || [d.learnerName, d.admissionNumber, d.className, d.subjectName, d.examName, d.deletedBy].join(' ').toLowerCase().includes(s));
    const th = { textAlign: 'left', padding: '7px', borderBottom: '2px solid #13306B', color: '#13306B', fontSize: '12px' }, td = { padding: '7px', borderBottom: '1px solid #eee', fontSize: '13px' };
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '30px', flex: 1, minWidth: 0 }}>
                    <h2 style={{ color: '#13306B', margin: 0 }}><i className="bi bi-trash3" style={{ marginRight: '8px' }} />Deleted marks</h2>
                    <p style={{ color: '#666' }}>Every mark deleted from Results is kept here (latest 500): who deleted it and when. Restore puts it back.</p>
                    {note && <p style={{ backgroundColor: '#eef6ff', padding: '8px 12px', borderRadius: '8px' }}>{note}</p>}
                    <input placeholder="Search learner, class, subject, exam, who deleted…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '1.5px solid #ddd', width: '100%', maxWidth: '420px', marginBottom: '12px' }} />
                    {!list ? <p>Loading…</p> : shown.length === 0 ? <p style={{ color: '#777' }}>No deleted marks.</p> : (
                        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '10px', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead><tr>{['Deleted', 'By', 'Learner', 'Class', 'Exam', 'Subject', 'Mark', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                <tbody>{shown.map(d => (
                                    <tr key={d.id} style={{ opacity: d.restoredAt ? 0.55 : 1 }}>
                                        <td style={td}>{fmt(d.deletedAt)}</td><td style={td}>{d.deletedBy}</td>
                                        <td style={td}><b>{d.learnerName}</b> <span style={{ color: '#888' }}>{d.admissionNumber}</span></td>
                                        <td style={td}>{d.className}</td><td style={td}>{d.examName}</td><td style={td}>{d.subjectName}</td>
                                        <td style={{ ...td, fontWeight: 700 }}>{d.marksObtained}</td>
                                        <td style={td}>{d.restoredAt ? <span style={{ color: '#1e7e34', fontSize: '12px' }}>Restored {fmt(d.restoredAt)} by {d.restoredBy}</span>
                                            : <button onClick={() => restore(d)} style={{ backgroundColor: '#13306B', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '7px', fontWeight: 700, cursor: 'pointer' }}>Restore</button>}</td>
                                    </tr>))}</tbody>
                            </table>
                        </div>)}
                </div>
            </div>
            <Footer />
        </div>
    );
}
export default DeletedMarks;
