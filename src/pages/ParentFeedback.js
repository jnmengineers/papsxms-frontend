import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

/** Results of the Parents' End-of-Year Feedback & Comment Form (website). */
const RATE = ['Excellent', 'Good', 'Fair', 'Needs improvement'];
const RATE_COL = { 'Excellent': '#1e7e34', 'Good': '#5cb85c', 'Fair': '#e0a800', 'Needs improvement': '#C8102E' };
const B = ['Academic progress and quality of teaching', 'Communication with parents and guardians', 'Learner discipline, safety and welfare',
    'Spiritual nurture and Christian values', 'Co-curricular activities, clubs and sports', 'Cleanliness and learning environment',
    'School leadership and administration', 'Fee management and value for money'];
const C = ['What do you appreciate most about the school?', 'Which areas should the school improve?', 'Additional programs, facilities or learner support wanted',
    'How to improve communication and partnership with parents', 'Other comments or recommendations for management'];
const OVERALL = ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'];
const OV_COL = ['#1e7e34', '#5cb85c', '#9aa3b2', '#e0a800', '#C8102E'];
const REC = ['Yes', 'Not sure', 'No'];
const BANDS = ['Pre-Primary (PP1/PP2)', 'Lower Primary (Grades 1–3)', 'Upper Primary (Grades 4–6)', 'Junior School (Grades 7–9)'];
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const Bar = ({ parts, total }) => (
    <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: '#eef1f6' }}>
        {parts.map(([n, col], i) => n > 0 && <div key={i} title={`${n}`} style={{ width: `${(n / (total || 1)) * 100}%`, background: col }} />)}
    </div>
);

function ParentFeedback() {
    const [list, setList] = useState(null);
    const [band, setBand] = useState('ALL');
    const [error, setError] = useState('');
    const isAdmin = (localStorage.getItem('role') || '') === 'ADMIN';
    const load = () => api.get('/api/feedback').then(r => setList(r.data || [])).catch(() => setError('Could not load feedback.'));
    useEffect(() => { load(); }, []);
    const rows = useMemo(() => (list || []).filter(f => band === 'ALL' || f.answers?.band === band), [list, band]);
    const count = (k, v) => rows.filter(f => f.answers?.[k] === v).length;

    const download = () => {
        const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const head = ['Date', 'Parent', 'Phone', 'Learner', 'Grade/Class', ...B, 'Overall satisfaction', 'Recommend', ...C];
        const lines = rows.map(f => { const a = f.answers || {}; return [fmt(f.createdAt), f.parentName || 'Anonymous', f.phone, a.learnerName, a.band,
            ...B.map((_, i) => a['b' + (i + 1)]), a.overall, a.recommend, ...C.map((_, i) => a['c' + (i + 1)])].map(cell).join(','); });
        const blob = new Blob(['\uFEFF' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `parents-feedback-${new Date().toISOString().slice(0, 10)}.csv`; el.click();
    };
    const del = async (f) => { if (!window.confirm('Delete this response?')) return; try { await api.delete(`/api/feedback/${f.id}`); load(); } catch (e) { setError('Could not delete.'); } };
    const link = `${window.location.origin}/website/feedback.html`;
    const legend = (items) => <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: '#555', marginBottom: '8px' }}>{items.map(([l, c]) => <span key={l}><span style={{ display: 'inline-block', width: '10px', height: '10px', background: c, borderRadius: '2px', marginRight: '4px' }} />{l}</span>)}</div>;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '24px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h2 style={{ color: '#13306B', margin: 0 }}><i className="bi bi-chat-heart-fill" style={{ marginRight: '8px' }} />Parents' end-of-year feedback</h2>
                        {rows.length > 0 && <button onClick={download} style={btn('#1e7e34')}><i className="bi bi-download" /> Download (Excel/CSV)</button>}
                    </div>
                    <p style={{ color: '#555', margin: '8px 0 12px' }}>Form link for parents: <a href={link} target="_blank" rel="noreferrer"><b>{link}</b></a>{' '}
                        <button onClick={() => navigator.clipboard?.writeText(link)} style={{ ...btn('#13306B'), padding: '4px 10px' }}>Copy</button></p>
                    {error && <p style={{ color: '#dc3545' }}>{error}</p>}
                    {!list ? <p>Loading…</p> : list.length === 0 ? <p style={{ color: '#777' }}>No feedback yet.</p> : (<>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            {['ALL', ...BANDS].map(b => { const n = b === 'ALL' ? list.length : list.filter(f => f.answers?.band === b).length; return (
                                <button key={b} onClick={() => setBand(b)} style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid #13306B', backgroundColor: band === b ? '#13306B' : 'white', color: band === b ? 'white' : '#13306B', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>{b === 'ALL' ? 'All' : b} ({n})</button>); })}
                        </div>

                        <div style={card}>
                            <h3 style={h3}>Section B: Rate our school — {rows.length} response{rows.length === 1 ? '' : 's'}</h3>
                            {legend(RATE.map(r => [r, RATE_COL[r]]))}
                            {B.map((q, i) => { const k = 'b' + (i + 1); const c = RATE.map(r => count(k, r)); const t = c.reduce((a, b) => a + b, 0);
                                return (
                                    <div key={k} style={{ margin: '10px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px', marginBottom: '3px' }}>
                                            <span>{i + 1}. {q}</span>
                                            <b style={{ color: '#13306B', whiteSpace: 'nowrap' }}>{t ? `${Math.round(((c[0] + c[1]) / t) * 100)}% Excellent/Good` : '—'}</b>
                                        </div>
                                        <Bar parts={RATE.map((r, j) => [c[j], RATE_COL[r]])} total={t} />
                                        <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>{RATE.map((r, j) => `${r}: ${c[j]}`).join(' · ')}</div>
                                    </div>); })}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '14px', margin: '14px 0' }}>
                            <div style={card}><h3 style={h3}>Overall satisfaction</h3>
                                {(() => { const c = OVERALL.map(o => count('overall', o)); const t = c.reduce((a, b) => a + b, 0); return (<>
                                    <Bar parts={OVERALL.map((o, j) => [c[j], OV_COL[j]])} total={t} />
                                    {OVERALL.map((o, j) => <div key={o} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '6px' }}><span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: OV_COL[j], borderRadius: '2px', marginRight: '6px' }} />{o}</span><b>{c[j]}{t ? ` (${Math.round((c[j] / t) * 100)}%)` : ''}</b></div>)}
                                </>); })()}
                            </div>
                            <div style={card}><h3 style={h3}>Would recommend the school</h3>
                                {(() => { const c = REC.map(o => count('recommend', o)); const t = c.reduce((a, b) => a + b, 0); const col = ['#1e7e34', '#e0a800', '#C8102E']; return (<>
                                    <Bar parts={REC.map((o, j) => [c[j], col[j]])} total={t} />
                                    {REC.map((o, j) => <div key={o} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '6px' }}><span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: col[j], borderRadius: '2px', marginRight: '6px' }} />{o}</span><b>{c[j]}{t ? ` (${Math.round((c[j] / t) * 100)}%)` : ''}</b></div>)}
                                </>); })()}
                            </div>
                        </div>

                        <div style={card}>
                            <h3 style={h3}>Section C: Parent comments and suggestions</h3>
                            {C.map((q, i) => { const k = 'c' + (i + 1); const said = rows.filter(f => f.answers?.[k]);
                                return (
                                    <details key={k} style={{ margin: '8px 0' }} open={i < 2}>
                                        <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#13306B', fontSize: '14px' }}>{i + 1}. {q} ({said.length})</summary>
                                        {said.length === 0 ? <p style={{ color: '#999', fontSize: '13px' }}>No comments.</p> : said.map(f => (
                                            <p key={f.id} style={{ margin: '6px 0 6px 12px', fontSize: '14px', borderLeft: '3px solid #e1e6ee', paddingLeft: '8px' }}>
                                                {f.answers[k]} <span style={{ color: '#999', fontSize: '12px' }}>— {f.parentName || 'Anonymous'}{f.answers?.band ? `, ${f.answers.band.split(' (')[0]}` : ''}</span></p>))}
                                    </details>); })}
                        </div>

                        {isAdmin && (
                            <details style={{ ...card, marginTop: '14px' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#13306B' }}>All responses ({rows.length}) — view or delete</summary>
                                {rows.map(f => (
                                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #eee', padding: '6px 0', fontSize: '13px', flexWrap: 'wrap' }}>
                                        <span><b>{f.parentName || 'Anonymous'}</b>{f.phone ? ` · ${f.phone}` : ''}{f.answers?.learnerName ? ` · ${f.answers.learnerName}` : ''} · {f.answers?.band || '—'} · {fmt(f.createdAt)}</span>
                                        <button onClick={() => del(f)} style={{ ...btn('#dc3545'), padding: '3px 10px' }}>Delete</button>
                                    </div>))}
                            </details>)}
                    </>)}
                </div>
            </div>
            <Footer />
        </div>
    );
}
const card = { backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const h3 = { color: '#13306B', margin: '0 0 8px', fontSize: '16px' };
const btn = (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' });
export default ParentFeedback;
