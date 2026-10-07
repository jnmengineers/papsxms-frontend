import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { letterheadHtml } from '../utils/school';
import { hasRole } from '../utils/roles';
import { useTabParam } from '../utils/useTabParam';
import StaffLeave from './StaffLeave';
import StaffDuty from './StaffDuty';
import StaffAttendanceTab from './StaffAttendanceTab';

/**
 * Staff register: everyone working at the school — teachers and support staff (a private school employs its own).
 * Payroll uses the same records (only those "on the school payroll").
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const CATEGORY = { TEACHING: 'Teaching', SUPPORT: 'Support', ADMINISTRATION: 'Administration' };
const EMPLOYER = { SCHOOL: 'The school', AGENCY: 'Agency / outsourced', OTHER: 'Other' };
const TERMS = { PERMANENT: 'Permanent', CONTRACT: 'Contract', CASUAL: 'Casual', INTERN: 'Intern', VOLUNTEER: 'Volunteer' };
const LEVELS = { PHD: 'PhD', MASTERS: 'Masters', DEGREE: 'Degree', DIPLOMA: 'Diploma', CERTIFICATE: 'Certificate', KCSE: 'KCSE', OTHER: 'Other' };
const EMPTY = { staffId: null, staffNumber: '', fullName: '', jobTitle: '', category: 'TEACHING', teacherId: '', phone: '', email: '', gender: '', dateOfBirth: '', idNumber: '', residence: '',
    employer: 'SCHOOL', tscNumber: '', employmentType: 'PERMANENT', startDate: '', contractEnd: '', department: '', active: true, dateLeft: '', leftReason: '', onPayroll: true,
    kraPin: '', nssfNumber: '', shaNumber: '', nextOfKinName: '', nextOfKinRelationship: '', nextOfKinPhone: '', notes: '', qualifications: [] };

const TAB_NAMES = { register: 'Register', leave: 'Leave', duty: 'Duty roster', attendance: 'Attendance' };

function Staff() {
    const [tab, setTab] = useTabParam('register', TAB_NAMES);
    const canEdit = hasRole('ADMIN');
    const [staff, setStaff] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('');
    const [emp, setEmp] = useState('');
    const [status, setStatus] = useState('active');
    const [saving, setSaving] = useState(false);
    const flash = (m) => { setSuccess(m); setTimeout(() => setSuccess(''), 4500); };
    const load = useCallback(() => api.get('/api/staff').then(r => setStaff(r.data || [])).catch(err => setError(serverMessage(err, 'Could not load the staff register.'))), []);
    useEffect(() => { load(); api.get('/api/teachers').then(r => setTeachers(r.data || [])).catch(() => {}); }, [load]);

    const active = (staff || []).filter(s => s.active);
    const cards = useMemo(() => [
        ['Active staff', active.length, '#1F3864', ''],
        ['Teachers', active.filter(s => s.category === 'TEACHING').length, '#2E75B6', 'teachers'],
        ['Support & admin', active.filter(s => s.category !== 'TEACHING').length, '#6f42c1', 'support'],
        ['On school payroll', active.filter(s => s.onPayroll).length, '#1e7e34', 'payroll'],
        ['Contracts ending ≤ 60 days', active.filter(s => s.contractDaysLeft !== null && s.contractDaysLeft <= 60).length, '#b02a37', 'ending'],
        ['Records incomplete', active.filter(s => s.missing.length).length, '#b8860b', 'incomplete'],
    ], [active]);
    const [quick, setQuick] = useState('');
    const shown = (staff || []).filter(s => {
        if (status === 'active' && !s.active) return false;
        if (status === 'left' && s.active) return false;
        if (cat && s.category !== cat) return false;
        if (emp && s.employer !== emp) return false;
        if (quick === 'teachers' && s.category !== 'TEACHING') return false;
        if (quick === 'support' && s.category === 'TEACHING') return false;
        if (quick === 'payroll' && !s.onPayroll) return false;
        if (quick === 'ending' && !(s.contractDaysLeft !== null && s.contractDaysLeft <= 60)) return false;
        if (quick === 'incomplete' && !s.missing.length) return false;
        const t = q.trim().toLowerCase();
        return !t || `${s.fullName} ${s.staffNumber} ${s.jobTitle || ''} ${s.tscNumber || ''} ${s.idNumber || ''} ${s.phone || ''}`.toLowerCase().includes(t);
    });

    const edit = (s) => setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ''])), teacherId: s.teacherId ?? '', active: s.active, onPayroll: s.onPayroll,
        qualifications: (s.qualifications || []).map(x => ({ ...x, yearCompleted: x.yearCompleted ?? '' })) });
    const save = async (e) => {
        e.preventDefault();
        setSaving(true); setError('');
        const blankToNull = (v) => (v === '' ? null : v);
        try {
            const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, blankToNull(v)]));
            body.teacherId = form.teacherId ? Number(form.teacherId) : null;
            body.qualifications = form.qualifications.map(x => ({ ...x, yearCompleted: x.yearCompleted ? Number(x.yearCompleted) : null }));
            const r = await api.put('/api/staff', body);
            flash(r.data.message); setForm(null); await load();
        } catch (err) { setError(serverMessage(err, 'Could not save.')); }
        setSaving(false);
    };
    const importTeachers = async () => {
        if (!window.confirm('Add every teacher who has no staff record yet to the register?\n\nThey go on the school payroll — you then fill in their details (and their pay on Payroll → Staff).')) return;
        try { const r = await api.post('/api/staff/import-teachers'); flash(r.data.message); await load(); }
        catch (err) { setError(serverMessage(err, 'Could not add the teachers.')); }
    };

    const printList = () => {
        const rows = shown.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.staffNumber)}</td><td><b>${esc(s.fullName)}</b><br><small>${esc(s.jobTitle || '')}</small></td><td>${esc(CATEGORY[s.category] || '')}</td>
            <td>${esc(EMPLOYER[s.employer] || 'The school')}${s.tscNumber ? `<br><small>TSC reg. ${esc(s.tscNumber)}</small>` : ''}</td><td>${esc(s.phone || '')}</td><td>${esc(s.idNumber || '')}</td><td>${esc(fmt(s.startDate))}</td><td>${esc(TERMS[s.employmentType] || '')}${s.contractEnd ? `<br><small>to ${esc(fmt(s.contractEnd))}</small>` : ''}</td></tr>`).join('');
        openPrint('Staff list', `${letterheadHtml({ logoSize: 44 })}<h2>STAFF LIST (${shown.length})</h2><table><tr><th>#</th><th>No</th><th>Name</th><th>Category</th><th>Employed by</th><th>Phone</th><th>ID No</th><th>Started</th><th>Terms</th></tr>${rows}</table>`, true, setError);
    };
    const printRecord = (s) => {
        const row = (l, v) => `<tr><td class="l">${esc(l)}</td><td>${esc(v || '—')}</td></tr>`;
        const quals = (s.qualifications || []).map(x => `<tr><td>${esc(LEVELS[x.level] || x.level)}</td><td>${esc(x.title)}</td><td>${esc(x.institution || '')}</td><td>${esc(x.yearCompleted || '')}</td></tr>`).join('');
        openPrint(`Staff record — ${s.fullName}`, `${letterheadHtml({ logoSize: 44 })}<h2>STAFF RECORD</h2>
            <div class="grid"><table>${row('Name', s.fullName)}${row('Staff number', s.staffNumber)}${row('Position', s.jobTitle)}${row('Category', CATEGORY[s.category])}${row('Department', s.department)}
                ${row('Gender', s.gender && s.gender[0] + s.gender.slice(1).toLowerCase())}${row('Date of birth', fmt(s.dateOfBirth))}${row('ID number', s.idNumber)}${row('Phone', s.phone)}${row('Email', s.email)}${row('Residence', s.residence)}</table>
            <table>${row('Employed by', EMPLOYER[s.employer] || 'The school')}${s.category === 'TEACHING' ? row('TSC registration no.', s.tscNumber) : ''}${row('Terms', TERMS[s.employmentType])}${row('Started', fmt(s.startDate))}${row('Contract ends', fmt(s.contractEnd))}
                ${row('On school payroll', s.onPayroll ? 'Yes' : 'No')}${row('KRA PIN', s.kraPin)}${row('NSSF number', s.nssfNumber)}${row('SHA number', s.shaNumber)}${!s.active ? row('Left on', fmt(s.dateLeft)) + row('Reason', s.leftReason) : ''}</table></div>
            <h3>Next of kin</h3><table>${row('Name', s.nextOfKinName)}${row('Relationship', s.nextOfKinRelationship)}${row('Phone', s.nextOfKinPhone)}</table>
            <h3>Qualifications</h3>${quals ? `<table class="q"><tr><th>Level</th><th>Qualification</th><th>Institution</th><th>Year</th></tr>${quals}</table>` : '<p>None recorded.</p>'}
            ${s.notes ? `<h3>Notes</h3><p>${esc(s.notes)}</p>` : ''}<p style="margin-top:30px">Staff signature: ______________ &nbsp;&nbsp; Head teacher: ______________ &nbsp;&nbsp; Date: ______________</p>`, false, setError);
    };
    const csv = () => {
        const qv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const head = ['Staff no', 'Name', 'Position', 'Category', 'Department', 'Gender', 'Date of birth', 'ID number', 'Phone', 'Email', 'Residence', 'Employed by', 'TSC registration no.', 'Terms', 'Started', 'Contract ends', 'On payroll', 'KRA PIN', 'NSSF', 'SHA', 'Next of kin', 'Relationship', 'Next of kin phone', 'Highest qualification', 'Active', 'Left on', 'Reason', 'Missing'];
        const rows = shown.map(s => [s.staffNumber, s.fullName, s.jobTitle, CATEGORY[s.category], s.department, s.gender, s.dateOfBirth, s.idNumber, s.phone, s.email, s.residence, EMPLOYER[s.employer], s.tscNumber,
            TERMS[s.employmentType], s.startDate, s.contractEnd, s.onPayroll ? 'Yes' : 'No', s.kraPin, s.nssfNumber, s.shaNumber, s.nextOfKinName, s.nextOfKinRelationship, s.nextOfKinPhone,
            (s.qualifications || [])[0]?.title, s.active ? 'Yes' : 'No', s.dateLeft, s.leftReason, s.missing.join('; ')].map(qv).join(','));
        const blob = new Blob(['\uFEFF' + [head.map(qv).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Staff list.csv';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <div style={st.container}>
            <Navbar />
            <div style={st.layoutRow}>
                <Sidebar />
                <div style={st.content}>
                    <h2 style={st.title}><Icon name="person-badge-fill" style={{ marginRight: '10px' }} />Staff</h2>
                    <p style={st.subtitle}>Everyone working at the school — teachers and support staff. Payroll uses the same records.</p>
                    {error && <div style={st.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span><button onClick={() => setError('')} style={st.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={st.success}><Icon name="check-circle-fill" />{success}</p>}

                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }} role="tablist">
                        {[['register', 'person-lines-fill', 'Register'], ['leave', 'calendar2-heart', 'Leave'], ['duty', 'shield-check', 'Duty roster'], ['attendance', 'clock-history', 'Attendance']].map(([k, ic, l]) => (
                            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setForm(null); setTab(k); }}
                                style={{ padding: '9px 14px', border: '1px solid #1F3864', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}>
                                <Icon name={ic} />{l}</button>
                        ))}
                    </div>
                    {tab === 'duty' ? <StaffDuty staff={staff} setError={setError} flash={flash} blocked={() => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.')} />
                    : tab === 'attendance' ? <StaffAttendanceTab setError={setError} flash={flash} blocked={() => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.')} />
                    : tab === 'leave' ? <StaffLeave staff={staff} setError={setError} flash={flash} blocked={() => setError('Your browser blocked the print window. Allow pop-ups for this site and try again.')} /> : form ? <StaffForm form={form} setForm={setForm} teachers={teachers} save={save} saving={saving} /> : <>
                        <div style={st.cards}>
                            {cards.map(([l, v, c, k]) => (
                                <button key={l} type="button" onClick={() => setQuick(quick === k ? '' : k)} title={k ? 'Show only these' : ''}
                                    style={{ ...st.card, borderTopColor: c, outline: quick === k && k ? `2px solid ${c}` : 'none', cursor: k ? 'pointer' : 'default' }}>
                                    <b style={{ color: c }}>{v}</b><span>{l}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ ...st.panel, ...st.bar }}>
                            {canEdit && <button onClick={() => setForm({ ...EMPTY })} style={st.primary}><Icon name="person-plus-fill" />Add staff</button>}
                            {canEdit && <button onClick={importTeachers} style={st.secondary} title="A staff record for every teacher who has none"><Icon name="people" />Add all teachers</button>}
                            <input style={{ ...st.input, flex: 1, minWidth: '180px' }} placeholder="Find by name, number, TSC no, ID or phone…" value={q} onChange={e => setQ(e.target.value)} />
                            <select style={st.input} value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{Object.entries(CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                            <select style={st.input} value={emp} onChange={e => setEmp(e.target.value)} aria-label="Employed by"><option value="">Employed by: all</option>{Object.entries(EMPLOYER).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                            <select style={st.input} value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="active">Working here</option><option value="left">Left</option><option value="all">Everyone</option></select>
                            <button onClick={printList} style={st.secondary} disabled={!shown.length}><Icon name="printer" />Print</button>
                            <button onClick={csv} style={st.secondary} disabled={!shown.length}><Icon name="file-earmark-spreadsheet" />Excel</button>
                        </div>
                        {!staff ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : (
                            <div style={{ ...st.panel, overflowX: 'auto' }}>
                                <table style={st.table}>
                                    <thead><tr>{['No', 'Name', 'Category', 'Employed by', 'Phone', 'Started', 'Terms', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {shown.map((s, i) => (
                                            <tr key={s.staffId} style={{ backgroundColor: i % 2 ? 'white' : '#fafafa', opacity: s.active ? 1 : 0.6 }}>
                                                <td style={st.td}>{s.staffNumber}</td>
                                                <td style={st.td}><strong>{s.fullName}</strong><div style={st.small}>{s.jobTitle}{s.department ? ` · ${s.department}` : ''}{s.onPayroll ? ' · on payroll' : ''}</div>
                                                    {s.missing.length > 0 && <div style={{ ...st.small, color: '#b8860b' }}><Icon name="exclamation-circle" />Missing: {s.missing.join(', ')}</div>}
                                                    {!s.active && <div style={{ ...st.small, color: '#b02a37' }}>Left {fmt(s.dateLeft)} — {s.leftReason}</div>}</td>
                                                <td style={st.td}>{CATEGORY[s.category]}</td>
                                                <td style={st.td}>{EMPLOYER[s.employer] || 'The school'}{s.tscNumber && <div style={st.small}>TSC reg. {s.tscNumber}</div>}</td>
                                                <td style={st.td}>{s.phone}</td>
                                                <td style={st.td}>{fmt(s.startDate)}</td>
                                                <td style={st.td}>{TERMS[s.employmentType] || ''}{s.contractEnd && <div style={{ ...st.small, color: s.contractDaysLeft !== null && s.contractDaysLeft <= 60 ? '#b02a37' : '#888', fontWeight: s.contractDaysLeft <= 60 ? 700 : 400 }}>
                                                    {s.contractDaysLeft === null ? `ended ${fmt(s.contractEnd)}` : s.contractDaysLeft < 0 ? `ENDED ${fmt(s.contractEnd)}` : `ends ${fmt(s.contractEnd)} (${s.contractDaysLeft} days)`}</div>}</td>
                                                <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                                    <button onClick={() => printRecord(s)} style={st.link} title="Print the staff record"><i className="bi bi-printer" aria-label="Print record" /></button>
                                                    {canEdit && <button onClick={() => edit(s)} style={st.link}><Icon name="pencil" />Edit</button>}
                                                </td>
                                            </tr>
                                        ))}
                                        {!shown.length && <tr><td colSpan={8} style={{ ...st.td, textAlign: 'center', color: '#888', padding: '20px' }}>{staff.length ? 'Nobody matches.' : 'No staff yet — press "Add all teachers", then add support staff.'}</td></tr>}
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

function StaffForm({ form, setForm, teachers, save, saving }) {
    const set = (patch) => setForm(f => ({ ...f, ...patch }));
    const field = (k, label, props = {}) => (
        <label style={st.lbl}>{label}<input style={st.input} value={form[k] ?? ''} onChange={e => set({ [k]: props.upper ? e.target.value.toUpperCase() : e.target.value })} {...props} upper={undefined} /></label>
    );
    const select = (k, label, options, blank) => (
        <label style={st.lbl}>{label}<select style={st.input} value={form[k] ?? ''} onChange={e => set({ [k]: e.target.value })}>
            {blank && <option value="">{blank}</option>}{Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    );
    const setQual = (i, patch) => set({ qualifications: form.qualifications.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
    const pickTeacher = (id) => {
        const t = teachers.find(x => String(x.teacherId) === String(id));
        set({ teacherId: id, ...(t && !form.fullName ? { fullName: `${t.firstName || ''} ${t.lastName || ''}`.trim().toUpperCase(), phone: form.phone || t.phone || '', email: form.email || t.email || '', category: 'TEACHING', jobTitle: form.jobTitle || 'Teacher' } : {}) });
    };
    return (
        <form onSubmit={save}>
            <div style={st.panel}>
                <h3 style={st.h3}>{form.staffId ? `Edit — ${form.fullName}` : 'Add staff'}</h3>
                <h4 style={st.h4}><Icon name="person-vcard" />Personal</h4>
                <div style={st.grid}>
                    <label style={{ ...st.lbl, gridColumn: 'span 2' }}>Full name<input style={{ ...st.input, textTransform: 'uppercase' }} required maxLength={100} value={form.fullName} onChange={e => set({ fullName: e.target.value.toUpperCase() })} /></label>
                    {select('gender', 'Gender', { MALE: 'Male', FEMALE: 'Female' }, '—')}
                    {field('dateOfBirth', 'Date of birth', { type: 'date' })}
                    {field('idNumber', 'ID number', { maxLength: 20 })}
                    {field('phone', 'Phone', { maxLength: 20 })}
                    {field('email', 'Email', { type: 'email', maxLength: 100 })}
                    {field('residence', 'Residence', { maxLength: 100 })}
                </div>
                <h4 style={st.h4}><Icon name="briefcase" />Employment</h4>
                <div style={st.grid}>
                    {field('staffNumber', 'Staff number (blank = next free)', { maxLength: 20, upper: true })}
                    {select('category', 'Category', CATEGORY)}
                    {field('jobTitle', 'Position', { maxLength: 60, placeholder: 'Teacher, Cook, Driver…' })}
                    {field('department', 'Department / section', { maxLength: 60, placeholder: 'e.g. Upper Primary, Kitchen' })}
                    <label style={st.lbl}>Teacher record (for teachers)<select style={st.input} value={form.teacherId} onChange={e => pickTeacher(e.target.value)}>
                        <option value="">— not linked —</option>{teachers.map(t => <option key={t.teacherId} value={String(t.teacherId)}>{`${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>)}</select></label>
                    <label style={st.lbl}>Employed by<select style={st.input} value={form.employer || 'SCHOOL'} onChange={e => set({ employer: e.target.value, onPayroll: e.target.value === 'SCHOOL' })}>
                        {Object.entries(EMPLOYER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    {form.category === 'TEACHING' && field('tscNumber', 'TSC registration number', { maxLength: 20 })}
                    {select('employmentType', 'Terms', TERMS)}
                    {field('startDate', 'Started on', { type: 'date' })}
                    {(form.employmentType === 'CONTRACT' || form.contractEnd) && field('contractEnd', 'Contract ends', { type: 'date', required: form.employmentType === 'CONTRACT' })}
                </div>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', margin: '10px 0' }}>
                    <label style={st.check}><input type="checkbox" checked={form.onPayroll} onChange={e => set({ onPayroll: e.target.checked })} />On the school payroll {form.employer === 'AGENCY' && <span style={st.small}>(agency staff are paid by their agency)</span>}</label>
                    <label style={st.check}><input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} />Still working here</label>
                </div>
                {!form.active && <div style={st.grid}>{field('dateLeft', 'Date left', { type: 'date', required: true })}<label style={{ ...st.lbl, gridColumn: 'span 2' }}>Why they left<input style={st.input} required maxLength={200} value={form.leftReason} placeholder="Transferred, resigned, contract ended, retired…" onChange={e => set({ leftReason: e.target.value })} /></label></div>}
                <h4 style={st.h4}><Icon name="shield-check" />Statutory numbers</h4>
                <div style={st.grid}>
                    {field('kraPin', 'KRA PIN', { maxLength: 20, upper: true })}
                    {field('nssfNumber', 'NSSF number', { maxLength: 20 })}
                    {field('shaNumber', 'SHA number', { maxLength: 20 })}
                </div>
                <h4 style={st.h4}><Icon name="telephone-plus" />Next of kin</h4>
                <div style={st.grid}>
                    {field('nextOfKinName', 'Name', { maxLength: 100 })}
                    {field('nextOfKinRelationship', 'Relationship', { maxLength: 40, placeholder: 'Spouse, parent, sibling…' })}
                    {field('nextOfKinPhone', 'Phone', { maxLength: 20 })}
                </div>
                <h4 style={st.h4}><Icon name="mortarboard" />Qualifications</h4>
                {form.qualifications.map((x, i) => (
                    <div key={i} style={st.qualRow}>
                        <select style={{ ...st.input, width: '130px' }} value={x.level} onChange={e => setQual(i, { level: e.target.value })} aria-label="Level">{Object.entries(LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        <input style={{ ...st.input, flex: 2, minWidth: '160px' }} maxLength={100} value={x.title} placeholder="e.g. B.Ed (Arts), P1 Certificate" onChange={e => setQual(i, { title: e.target.value })} aria-label="Qualification" required />
                        <input style={{ ...st.input, flex: 2, minWidth: '140px' }} maxLength={100} value={x.institution || ''} placeholder="Institution" onChange={e => setQual(i, { institution: e.target.value })} aria-label="Institution" />
                        <input style={{ ...st.input, width: '90px' }} inputMode="numeric" maxLength={4} value={x.yearCompleted} placeholder="Year" onChange={e => setQual(i, { yearCompleted: e.target.value.replace(/\D/g, '') })} aria-label="Year" />
                        <button type="button" onClick={() => set({ qualifications: form.qualifications.filter((_, k) => k !== i) })} style={{ ...st.link, color: '#b02a37' }} aria-label="Remove"><i className="bi bi-x-lg" /></button>
                    </div>
                ))}
                <button type="button" onClick={() => set({ qualifications: [...form.qualifications, { level: 'DEGREE', title: '', institution: '', yearCompleted: '' }] })} style={st.link}><Icon name="plus-circle" />Add qualification</button>
                <label style={{ ...st.lbl, marginTop: '12px' }}>Notes<input style={st.input} maxLength={200} value={form.notes} onChange={e => set({ notes: e.target.value })} /></label>
                <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '14px' }}>
                    <button type="button" onClick={() => setForm(null)} style={st.secondary}>Cancel</button>
                    <button type="submit" disabled={saving} style={st.primary}><Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </form>
    );
}

const openPrint = (title, body, landscape, setError) => {
    const w = window.open('', '_blank');
    if (!w) { setError('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
        body{font-family:Arial,sans-serif;font-size:11.5px;margin:12px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top}
        th{background:#1F3864;color:#fff;text-align:left}td.l{width:38%;background:#f4f6fa;font-weight:bold}h2{text-align:center;color:#1F3864;margin:6px 0 10px}h3{color:#1F3864;margin:12px 0 4px;font-size:13px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}small{color:#666}.bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between;margin-bottom:8px}
        .bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold;cursor:pointer}@media print{.bar{display:none}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm}}</style></head>
        <body><div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Print / Save PDF</button></div>${body}</body></html>`);
    w.document.close(); w.focus();
};

const st = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 14px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' },
    card: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', border: 'none', borderTop: '4px solid', borderRadius: '8px', padding: '10px 12px', backgroundColor: 'white', fontSize: '12px', color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'left' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' },
    qualRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    h3: { color: '#1F3864', margin: '0 0 6px', fontSize: '17px' },
    h4: { color: '#1F3864', margin: '16px 0 8px', fontSize: '14px', borderBottom: '1px solid #e3e8f0', paddingBottom: '4px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '780px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '7px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    small: { fontSize: '11px', color: '#888' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
};

export default Staff;
