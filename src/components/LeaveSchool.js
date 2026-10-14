import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

/**
 * Learners who leave (transfer, leave, graduate) are kept with their marks, report cards and
 * fees, but no longer appear in everyday lists. They can be reinstated.
 */
const STATUS = { TRANSFERRED: 'Transferred (with consent)', DISAPPEARED: 'Disappeared (no notice)', LEFT: 'Left (other)', GRADUATED: 'Graduated' };
const kes = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const msg = (err, f) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300 ? d : d?.message || d?.error) || f; };
const fmt = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export function LeaveButton({ student, onDone, small }) {
    const [open, setOpen] = useState(false);
    const [f, setF] = useState({ status: 'TRANSFERRED', dateLeft: todayLocal(), transferSchool: '', reason: '', consent: true });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const save = async () => {
        setBusy(true); setError('');
        try { await api.put(`/api/students/${student.studentId}/leave`, f); setOpen(false); onDone?.(`${name} marked as ${STATUS[f.status].toLowerCase()}. Fee balance on leaving was recorded.`); }
        catch (err) { setError(msg(err, 'Could not save.')); }
        setBusy(false);
    };
    return (
        <>
            <button onClick={() => setOpen(true)} title="Left school (transfer, left, graduated)"
                style={{ backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '6px', padding: small ? '5px 8px' : '6px 9px', marginLeft: '4px', cursor: 'pointer' }}>
                <i className="bi bi-box-arrow-right" />
            </button>
            {open && (
                <div style={st.backdrop}>
                    <div style={st.modal}>
                        <h3 style={st.h3}><i className="bi bi-box-arrow-right" style={{ marginRight: '6px' }} />{name} — left school</h3>
                        <p style={st.note}>Marks, report cards and fee balance are kept. The learner stops appearing in class lists, mark entry and report cards.</p>
                        <label style={st.lbl}>Reason
                            <select style={st.input} value={f.status} onChange={e => setF({ ...f, status: e.target.value, consent: e.target.value !== 'DISAPPEARED' })}>
                                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </label>
                        <label style={st.lbl}>Date left
                            <input type="date" style={st.input} max={todayLocal()} value={f.dateLeft} onChange={e => setF({ ...f, dateLeft: e.target.value })} />
                        </label>
                        {f.status === 'TRANSFERRED' && (
                            <label style={st.lbl}>New school (optional)
                                <input style={st.input} maxLength={120} value={f.transferSchool} onChange={e => setF({ ...f, transferSchool: e.target.value })} placeholder="e.g. Nairobi Primary School" />
                            </label>
                        )}
                        {f.status !== 'DISAPPEARED' && (
                            <label style={{ ...st.lbl, flexDirection: 'row', alignItems: 'center', gap: '8px', fontWeight: 400 }}>
                                <input type="checkbox" checked={!!f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} />
                                Parent/guardian gave notice or consent (e.g. transfer letter)
                            </label>
                        )}
                        {f.status === 'DISAPPEARED' && <p style={{ ...st.note, color: '#b02a37' }}>Recorded as leaving <b>without notice</b>. Any fee balance stays on record for follow-up.</p>}
                        <label style={st.lbl}>Note (optional)
                            <input style={st.input} maxLength={200} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="e.g. family relocated" />
                        </label>
                        {error && <p style={st.error}>{error}</p>}
                        <div style={st.btns}>
                            <button onClick={() => setOpen(false)} style={st.cancel} disabled={busy}>Cancel</button>
                            <button onClick={save} style={st.ok} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export function FormerLearners({ onChange }) {
    const [open, setOpen] = useState(false);
    const [list, setList] = useState(null);
    const [error, setError] = useState('');
    const load = () => api.get('/api/students/former').then(r => setList(r.data || [])).catch(err => setError(msg(err, 'Could not load.')));
    const show = () => { setOpen(true); setList(null); setError(''); load(); };
    const reinstate = async (row) => {
        const s = row.student;
        if (!window.confirm(`Bring ${s.firstName} ${s.lastName} back into school (class ${s.schoolClass?.className || s.className || ''})?`)) return;
        try { await api.put(`/api/students/${s.studentId}/reinstate`); load(); onChange?.(`${s.firstName} ${s.lastName} is back in school.`); }
        catch (err) { setError(msg(err, 'Could not reinstate.')); }
    };
    return (
        <>
            <button onClick={show} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', marginLeft: '10px' }}>
                <i className="bi bi-archive" style={{ marginRight: '6px' }} />Former learners
            </button>
            {open && (
                <div style={st.backdrop}>
                    <div style={{ ...st.modal, maxWidth: '1000px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={st.h3}><i className="bi bi-archive" style={{ marginRight: '6px' }} />Former learners {list ? `(${list.length})` : ''}</h3>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }} aria-label="Close"><i className="bi bi-x-lg" /></button>
                        </div>
                        {error && <p style={st.error}>{error}</p>}
                        {!list ? <p style={st.note}>Loading…</p> : list.length === 0 ? <p style={st.note}>No learners have left.</p> : (
                            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead><tr>{['Learner', 'Adm', 'Last class', 'How left', 'Consent', 'Date', 'Owed on leaving', 'Owed now', 'New school / note', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                                    <tbody>{list.map(row => { const s = row.student; const now = Number(row.balanceNow || 0); const then = Number(s.balanceAtLeaving || 0); return (
                                        <tr key={s.studentId}>
                                            <td style={st.td}><Link to={`/student/${s.studentId}`} title="Profile and payment history" style={{ fontWeight: 700, color: '#1F3864' }}>{s.firstName} {s.lastName}</Link></td>
                                            <td style={st.td}>{s.admissionNumber}</td>
                                            <td style={st.td}>{s.schoolClass?.className || s.className}{s.schoolClass?.stream ? ` ${s.schoolClass.stream}` : ''}</td>
                                            <td style={{ ...st.td, color: s.status === 'DISAPPEARED' ? '#b02a37' : undefined, fontWeight: s.status === 'DISAPPEARED' ? 700 : 400 }}>{STATUS[s.status] || s.status}</td>
                                            <td style={st.td}>{s.leaveConsent === true ? 'Yes' : s.leaveConsent === false ? <b style={{ color: '#b02a37' }}>No</b> : '—'}</td>
                                            <td style={st.td}>{fmt(s.dateLeft)}</td>
                                            <td style={st.td}>{s.balanceAtLeaving == null ? '—' : kes(then)}</td>
                                            <td style={{ ...st.td, fontWeight: 700, color: now > 0 ? '#b02a37' : '#1e7e34' }}>{now > 0 ? kes(now) : now < 0 ? `Credit ${kes(-now)}` : 'Cleared'}</td>
                                            <td style={st.td}>{[s.transferSchool, s.leftReason].filter(Boolean).join(' — ')}</td>
                                            <td style={st.td}><button onClick={() => reinstate(row)} style={{ ...st.ok, padding: '5px 10px' }}>Reinstate</button></td>
                                        </tr>); })}</tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

const st = {
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' },
    modal: { backgroundColor: 'white', borderRadius: '14px', padding: '22px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
    h3: { color: '#1F3864', margin: '0 0 8px', fontSize: '17px' },
    note: { color: '#666', fontSize: '13px', margin: '0 0 12px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#1F3864', marginBottom: '10px' },
    input: { padding: '9px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '15px', fontWeight: 400 },
    error: { color: '#dc3545', backgroundColor: '#fff3f3', padding: '8px 10px', borderRadius: '8px', fontSize: '13px' },
    btns: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' },
    cancel: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
    ok: { backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
    th: { textAlign: 'left', padding: '7px', borderBottom: '2px solid #1F3864', color: '#1F3864' },
    td: { padding: '7px', borderBottom: '1px solid #eee' },
};
