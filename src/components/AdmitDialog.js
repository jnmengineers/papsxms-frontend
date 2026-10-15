import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { classDisplayName, compareClasses } from '../utils/classUtils';
import { printAdmissionLetter } from '../utils/admissionPrint';

/**
 * One admission form for walk-ins (Students page) and website applications (Enquiries "Admit").
 * Creates the learner with the next admission number, their class and their parent.
 */
const msg = (err, f) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300 ? d : d?.message || d?.error) || f; };

export default function AdmitDialog({ enquiry, onDone, label = 'New admission', small }) {
    const [open, setOpen] = useState(false);
    const [classes, setClasses] = useState([]);
    const [f, setF] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setError('');
        const [first, ...rest] = String(enquiry?.learnerName || '').trim().split(/\s+/);
        setF({ admissionNumber: '', firstName: first || '', lastName: rest.join(' '), dateOfBirth: '', gender: '', classId: '',
               parentName: enquiry?.parentName || '', parentPhone: enquiry?.phone || '', relationship: '', parentEmail: enquiry?.email || '' });
        api.get('/api/admissions/next-number').then(r => setF(v => ({ ...v, admissionNumber: r.data.admissionNumber }))).catch(() => {});
        api.get('/api/classes').then(r => {
            const list = (r.data || []).slice().sort(compareClasses);
            setClasses(list);
            const want = String(enquiry?.gradeWanted || '').toLowerCase();
            const hit = want && list.find(c => classDisplayName(c).toLowerCase().startsWith(want));
            if (hit) setF(v => ({ ...v, classId: String(hit.classId) }));
        }).catch(() => setError('Could not load classes.'));
    }, [open, enquiry]);

    const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
    const save = async () => {
        setBusy(true); setError('');
        try {
            const r = await api.post('/api/admissions', { ...f, classId: f.classId ? Number(f.classId) : null, dateOfBirth: f.dateOfBirth || null, enquiryId: enquiry?.enquiryId || null });
            setOpen(false); onDone?.(r.data.message);
            if (window.confirm(r.data.message + '\n\nPrint the admission letter now?')) {
                const cls = classes.find(c => String(c.classId) === String(f.classId));
                printAdmissionLetter({ learnerName: `${f.firstName} ${f.lastName}`.toUpperCase(), admissionNumber: r.data.admissionNumber, className: cls ? classDisplayName(cls) : '', parentName: f.parentName });
            }
        } catch (err) { setError(msg(err, 'Could not admit.')); }
        setBusy(false);
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={{ backgroundColor: '#1e7e34', color: 'white', border: 'none', padding: small ? '6px 12px' : '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: small ? '12px' : '14px', marginLeft: small ? 0 : '10px' }}>
                <i className="bi bi-person-plus-fill" style={{ marginRight: '6px' }} />{label}
            </button>
            {open && f && (
                <div style={st.backdrop}>
                    <div style={st.modal}>
                        <h3 style={{ color: '#1F3864', margin: '0 0 10px' }}><i className="bi bi-person-plus-fill" style={{ marginRight: '6px' }} />{enquiry ? 'Admit applicant' : 'New admission'}</h3>
                        <div style={st.grid}>
                            <label style={st.lbl}>Admission no.<input style={st.in} value={f.admissionNumber} onChange={set('admissionNumber')} /></label>
                            <label style={st.lbl}>Class
                                <select style={st.in} value={f.classId} onChange={set('classId')}>
                                    <option value="">Choose…</option>{classes.map(c => <option key={c.classId} value={c.classId}>{classDisplayName(c)}</option>)}
                                </select></label>
                            <label style={st.lbl}>First name<input style={st.in} value={f.firstName} onChange={set('firstName')} /></label>
                            <label style={st.lbl}>Last name<input style={st.in} value={f.lastName} onChange={set('lastName')} /></label>
                            <label style={st.lbl}>Date of birth<input type="date" style={st.in} value={f.dateOfBirth} onChange={set('dateOfBirth')} /></label>
                            <label style={st.lbl}>Gender
                                <select style={st.in} value={f.gender} onChange={set('gender')}><option value="">—</option><option>Male</option><option>Female</option></select></label>
                        </div>
                        <h4 style={{ color: '#1F3864', margin: '12px 0 6px' }}>Parent / guardian</h4>
                        <div style={st.grid}>
                            <label style={st.lbl}>Name<input style={st.in} value={f.parentName} onChange={set('parentName')} /></label>
                            <label style={st.lbl}>Phone<input style={st.in} inputMode="tel" value={f.parentPhone} onChange={set('parentPhone')} placeholder="0712 345678" /></label>
                            <label style={st.lbl}>Relationship<input style={st.in} value={f.relationship} onChange={set('relationship')} placeholder="Mother, Father…" /></label>
                            <label style={st.lbl}>Email (optional)<input style={st.in} value={f.parentEmail} onChange={set('parentEmail')} /></label>
                        </div>
                        <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0' }}>If the phone already belongs to a parent (e.g. a sibling's), the learner is linked to that parent.</p>
                        {error && <p style={{ color: '#dc3545', backgroundColor: '#fff3f3', padding: '8px', borderRadius: '8px', fontSize: '13px' }}>{error}</p>}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                            <button onClick={() => setOpen(false)} disabled={busy} style={{ ...st.b, backgroundColor: '#6c757d' }}>Cancel</button>
                            <button onClick={save} disabled={busy} style={{ ...st.b, backgroundColor: '#1e7e34' }}>{busy ? 'Saving…' : 'Admit'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const st = {
    backdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px' },
    modal: { backgroundColor: 'white', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#1F3864' },
    in: { padding: '9px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '15px', fontWeight: 400 },
    b: { color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
};
