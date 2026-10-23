import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { letterheadHtml } from '../utils/school';

/**
 * Forms built inside the system (like Google Forms, plus SMS to parents, filters and printable reports).
 * Admin, clerk and head teacher. Parents fill them in at /f/<code> (website/form.html).
 */
const TYPES = [
    ['short', 'Short answer'], ['paragraph', 'Paragraph'], ['single', 'Single choice'], ['multi', 'Tick boxes (several)'],
    ['dropdown', 'Drop-down'], ['rating', 'Rating bar'], ['scale', 'Scale 1–5'], ['yesno', 'Yes / No'], ['number', 'Number'], ['date', 'Date'], ['heading', 'Section heading'],
];
const TYPE_NAME = Object.fromEntries(TYPES);
const CHOICE_TYPES = ['single', 'multi', 'dropdown', 'rating'];
const RATE = ['Excellent', 'Good', 'Fair', 'Needs improvement'];
const SECTIONS = [['ALL', 'All parents'], ['PRE_SCHOOL', 'Pre-Primary parents'], ['LOWER_PRIMARY', 'Lower Primary parents'], ['UPPER_PRIMARY', 'Upper Primary parents'], ['JUNIOR_SCHOOL', 'Junior School parents']];
const uid = () => 'q' + Math.random().toString(36).slice(2, 8);
const msg = (err, f) => { const d = err?.response?.data; return (typeof d === 'string' && d.length < 300 ? d : d?.message || d?.error) || f; };
const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkFor = (code) => `${window.location.origin}/f/${code}`;

// ── Templates ──
const q = (type, label, extra = {}) => ({ id: uid(), type, label, help: '', required: false, options: type === 'rating' ? RATE : (extra.options || []), ...extra });
const TEMPLATES = {
    blank: { title: 'Untitled form', description: '', questions: [] },
    parents: {
        title: "Parents' End-of-Year Feedback & Comment Form", showOnWebsite: true,
        description: 'Dear Parent/Guardian,\nThank you for partnering with us in the education and holistic development of your child. Kindly complete this form to help us evaluate our performance, identify areas for improvement, and plan effectively for the coming year. Your honest feedback is highly valued.',
        allowAnonymous: true, collectContact: true,
        thankYou: 'Thank you for taking the time to share your views. Your feedback will guide our continuous improvement as we nurture learners who are spiritually grounded, academically competent, disciplined and prepared for service.',
        questions: [
            q('heading', 'Section A: Learner details'),
            q('short', "Learner's name (optional)"),
            q('single', 'Grade/Class', { required: true, options: ['Pre-Primary (PP1/PP2)', 'Lower Primary (Grades 1–3)', 'Upper Primary (Grades 4–6)', 'Junior School (Grades 7–9)'] }),
            q('heading', 'Section B: Rate our school', { help: 'Select one rating for each area.' }),
            ...['Academic progress and quality of teaching', 'Communication with parents and guardians', 'Learner discipline, safety and welfare', 'Spiritual nurture and Christian values',
                'Co-curricular activities, clubs and sports', 'Cleanliness and learning environment', 'School leadership and administration', 'Fee management and value for money'].map(l => q('rating', l)),
            q('heading', 'Section C: Parent comments and suggestions'),
            q('paragraph', 'What do you appreciate most about the school?'), q('paragraph', 'Which areas do you feel the school should improve?'),
            q('paragraph', 'What additional programs, facilities or learner support would you like the school to introduce?'),
            q('paragraph', 'How can the school improve communication and partnership with parents?'), q('paragraph', 'Any other comments or recommendations for the school management?'),
            q('heading', 'Section D: Overall satisfaction'),
            q('single', 'Overall, how satisfied are you with the education and services provided by the school?', { options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'] }),
            q('single', 'Would you recommend the school to other parents?', { options: ['Yes', 'Not sure', 'No'] }),
        ],
    },
    event: {
        title: 'Event registration', description: 'Please register to attend.', collectContact: true, onePerPhone: true, showOnWebsite: true,
        questions: [q('short', 'Parent/Guardian name', { required: true }), q('short', "Learner's name and class", { required: true }),
            q('number', 'How many people will attend?', { required: true }), q('yesno', 'Will you need transport?'), q('paragraph', 'Any special requests?')],
    },
};

function Forms() {
    const [view, setView] = useState({ name: 'list' });   // list | edit | results
    const [forms, setForms] = useState(null);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const load = () => api.get('/api/surveys').then(r => setForms(r.data || [])).catch(err => setError(msg(err, 'Could not load forms.')));
    useEffect(() => { load(); }, []);
    const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 4000); };

    const startNew = async (key) => {
        const t = JSON.parse(JSON.stringify(TEMPLATES[key]));
        t.questions = (t.questions || []).map(x => ({ ...x, id: uid() }));
        try { const r = await api.post('/api/surveys', { ...t, status: 'DRAFT' }); setView({ name: 'edit', form: r.data }); }
        catch (err) { setError(msg(err, 'Could not create the form.')); }
    };
    const open = async (f, name) => { try { const r = await api.get(`/api/surveys/${f.id}`); setView({ name, form: r.data }); } catch (err) { setError(msg(err, 'Could not open the form.')); } };
    const duplicate = async (f) => { try { await api.post(`/api/surveys/${f.id}/duplicate`); flash('Form copied.'); load(); } catch (err) { setError(msg(err, 'Could not copy.')); } };
    const remove = async (f) => { if (!window.confirm(`Delete "${f.title}" and its ${f.responses} response(s)? This can't be undone.`)) return; try { await api.delete(`/api/surveys/${f.id}`); load(); } catch (err) { setError(msg(err, 'Could not delete.')); } };
    const setStatus = async (f, status) => {
        try { const full = (await api.get(`/api/surveys/${f.id}`)).data; await api.put(`/api/surveys/${f.id}`, { ...full, status }); load(); flash(status === 'OPEN' ? 'The form is open for responses.' : 'The form is closed.'); }
        catch (err) { setError(msg(err, 'Could not change the status.')); }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Navbar />
            <div style={{ display: 'flex' }}>
                <Sidebar />
                <div style={{ padding: '24px', flex: 1, minWidth: 0 }}>
                    {error && <div style={st.err} role="alert">{error} <button onClick={() => setError('')} style={st.x}>×</button></div>}
                    {note && <div style={st.ok}>{note}</div>}
                    {view.name === 'list' && <FormList forms={forms} onNew={startNew} onEdit={f => open(f, 'edit')} onResults={f => open(f, 'results')} onCopy={duplicate} onDelete={remove} onStatus={setStatus} flash={flash} />}
                    {view.name === 'edit' && <Editor form={view.form} onBack={() => { setView({ name: 'list' }); load(); }} setError={setError} flash={flash} />}
                    {view.name === 'results' && <Results form={view.form} onBack={() => { setView({ name: 'list' }); load(); }} setError={setError} flash={flash} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ══ List ═══════════════════════════════════════════════════
function FormList({ forms, onNew, onEdit, onResults, onCopy, onDelete, onStatus, flash }) {
    const [menu, setMenu] = useState(false);
    const chip = (s) => ({ OPEN: ['#1e7e34', 'Open'], CLOSED: ['#6c757d', 'Closed'], DRAFT: ['#b8860b', 'Draft'] }[s] || ['#999', s]);
    return (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <h2 style={{ color: '#13306B', margin: 0 }}><i className="bi bi-ui-checks" style={{ marginRight: '8px' }} />Forms</h2>
            <div style={{ position: 'relative' }}>
                <button onClick={() => setMenu(m => !m)} style={st.btn('#C8102E')}><i className="bi bi-plus-lg" /> New form</button>
                {menu && (
                    <div style={st.menu} onMouseLeave={() => setMenu(false)}>
                        {[['blank', 'Blank form', 'Start from scratch'], ['parents', "Parents' end-of-year feedback", 'The school evaluation form, ready to use'], ['event', 'Event registration', 'Names, attendance, transport']].map(([k, t, d]) => (
                            <button key={k} onClick={() => { setMenu(false); onNew(k); }} style={st.menuItem}><b>{t}</b><small style={{ display: 'block', color: '#777' }}>{d}</small></button>))}
                    </div>)}
            </div>
        </div>
        {!forms ? <p>Loading…</p> : forms.length === 0 ? (
            <div style={{ ...st.card, textAlign: 'center', padding: '40px' }}><p style={{ color: '#666' }}>No forms yet. Click <b>New form</b> to create one, or start from the parents' feedback template.</p></div>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))', gap: '14px' }}>
                {forms.map(f => { const [c, l] = chip(f.status); return (
                    <div key={f.id} style={{ ...st.card, display: 'flex', flexDirection: 'column', gap: '8px', borderTop: `4px solid ${c}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <b style={{ color: '#13306B', fontSize: '15px' }}>{f.title}</b>
                            <span style={{ background: c, color: 'white', borderRadius: '10px', padding: '2px 9px', fontSize: '11px', fontWeight: 700, height: 'fit-content' }}>{l}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#555' }}><b style={{ fontSize: '20px', color: '#13306B' }}>{f.responses}</b> response{f.responses === 1 ? '' : 's'}
                            {f.closesOn && <span style={{ marginLeft: '10px' }}>· closes {new Date(f.closesOn + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</div>
                        {f.showOnWebsite && <span style={{ fontSize: '11px', color: '#2B4F8C', fontWeight: 700 }}><i className="bi bi-globe2" /> Shown on the website while open</span>}
                        {f.status === 'OPEN' && <div style={{ fontSize: '12px', background: '#f5f7fb', borderRadius: '8px', padding: '6px 8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{linkFor(f.code)}</span>
                            <button onClick={() => { navigator.clipboard?.writeText(linkFor(f.code)); flash('Link copied — paste it in WhatsApp or SMS.'); }} style={st.small('#13306B')}>Copy link</button></div>}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <button onClick={() => onResults(f)} style={st.small('#1e7e34')}><i className="bi bi-bar-chart-fill" /> Results</button>
                            <button onClick={() => onEdit(f)} style={st.small('#13306B')}><i className="bi bi-pencil" /> Edit</button>
                            {f.status !== 'OPEN' ? <button onClick={() => onStatus(f, 'OPEN')} style={st.small('#2B4F8C')}>Open</button> : <button onClick={() => onStatus(f, 'CLOSED')} style={st.small('#6c757d')}>Close</button>}
                            <button onClick={() => onCopy(f)} style={st.small('#6c757d')}>Copy form</button>
                            <button onClick={() => onDelete(f)} style={st.small('#dc3545')}>Delete</button>
                        </div>
                    </div>); })}
            </div>)}
    </>);
}

// ══ Editor ═════════════════════════════════════════════════
function Editor({ form, onBack, setError, flash }) {
    const [f, setF] = useState({ ...form, questions: form.questions || [] });
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setDirty(true); };
    const setQ = (i, patch) => { setF(x => ({ ...x, questions: x.questions.map((qq, j) => j === i ? { ...qq, ...patch } : qq) })); setDirty(true); };
    const move = (i, d) => { const a = [...f.questions]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set('questions', a); };
    const add = (type) => set('questions', [...f.questions, { id: uid(), type, label: '', help: '', required: false, options: type === 'rating' ? RATE : CHOICE_TYPES.includes(type) ? ['Option 1', 'Option 2'] : [] }]);
    const save = async (status) => {
        setSaving(true); setError('');
        try { const r = await api.put(`/api/surveys/${f.id}`, { ...f, status: status || f.status }); setF({ ...r.data, questions: r.data.questions || [] }); setDirty(false); flash(status === 'OPEN' ? 'Saved and opened for responses.' : 'Saved.'); }
        catch (err) { setError(msg(err, 'Could not save.')); }
        setSaving(false);
    };
    const back = () => { if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return; onBack(); };
    return (<>
        <div style={st.sticky}>
            <button onClick={back} style={st.small('#6c757d')}><i className="bi bi-arrow-left" /> Forms</button>
            <b style={{ color: '#13306B', flex: 1, minWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title || 'Untitled form'}</b>
            {dirty && <span style={{ fontSize: '12px', color: '#b8860b' }}>Unsaved changes</span>}
            <a href={`/f/${f.code}`} target="_blank" rel="noreferrer" style={{ ...st.small('#2B4F8C'), textDecoration: 'none' }}><i className="bi bi-eye" /> Preview</a>
            <button onClick={() => save()} disabled={saving} style={st.btn('#13306B')}>{saving ? 'Saving…' : 'Save'}</button>
            {f.status !== 'OPEN' && <button onClick={() => save('OPEN')} disabled={saving} style={st.btn('#1e7e34')}>Save &amp; open</button>}
        </div>

        <div style={{ ...st.card, borderTop: '5px solid #C8102E' }}>
            <input value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="Form title" style={{ ...st.in, fontSize: '20px', fontWeight: 700, color: '#13306B' }} />
            <textarea value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="Introduction shown at the top of the form" rows={3} style={{ ...st.in, marginTop: '8px' }} />
        </div>

        <details style={st.card}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#13306B' }}><i className="bi bi-gear" /> Settings — status, dates, privacy, thank-you message</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '10px', marginTop: '12px' }}>
                <label style={st.lbl}>Status<select value={f.status} onChange={e => set('status', e.target.value)} style={st.in}><option value="DRAFT">Draft (not accepting)</option><option value="OPEN">Open (accepting responses)</option><option value="CLOSED">Closed</option></select></label>
                <label style={st.lbl}>Opens on (optional)<input type="date" value={f.opensOn || ''} onChange={e => set('opensOn', e.target.value || null)} style={st.in} /></label>
                <label style={st.lbl}>Closes on (optional)<input type="date" value={f.closesOn || ''} onChange={e => set('closesOn', e.target.value || null)} style={st.in} /></label>
            </div>
            {[['showOnWebsite', 'Show on the school website (Forms & surveys section) while open'], ['collectContact', 'Ask for the name and phone number'], ['allowAnonymous', 'Allow anonymous responses (an "I wish to stay anonymous" switch)'], ['onePerPhone', 'Only one response per phone number']].map(([k, l]) => (
                <label key={k} style={{ ...st.lbl, flexDirection: 'row', alignItems: 'center', gap: '8px', fontWeight: 600, marginTop: '10px' }}><input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} />{l}</label>))}
            <label style={{ ...st.lbl, marginTop: '10px' }}>Thank-you message<textarea value={f.thankYou || ''} onChange={e => set('thankYou', e.target.value)} rows={2} style={st.in} placeholder="Thank you! Your response has been received." /></label>
        </details>

        {f.questions.map((qq, i) => (
            <div key={qq.id} style={{ ...st.card, borderLeft: `5px solid ${qq.type === 'heading' ? '#C8102E' : '#13306B'}`, background: qq.type === 'heading' ? '#fbf7f7' : 'white' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ color: '#999', minWidth: '28px' }}>{qq.type === 'heading' ? '§' : `${f.questions.slice(0, i + 1).filter(x => x.type !== 'heading').length}.`}</b>
                    <input value={qq.label} onChange={e => setQ(i, { label: e.target.value })} placeholder={qq.type === 'heading' ? 'Section title' : 'Question'} style={{ ...st.in, flex: 1, minWidth: '200px', fontWeight: 600 }} />
                    <select value={qq.type} onChange={e => { const type = e.target.value; setQ(i, { type, options: type === 'rating' ? RATE : CHOICE_TYPES.includes(type) ? (qq.options?.length >= 2 ? qq.options : ['Option 1', 'Option 2']) : [] }); }} style={{ ...st.in, width: 'auto' }}>
                        {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </div>
                <input value={qq.help || ''} onChange={e => setQ(i, { help: e.target.value })} placeholder="Help text (optional)" style={{ ...st.in, marginTop: '8px', fontSize: '13px' }} />
                {CHOICE_TYPES.includes(qq.type) && (
                    <div style={{ marginTop: '10px', paddingLeft: '10px' }}>
                        {(qq.options || []).map((o, k) => (
                            <div key={k} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                                <span style={{ color: '#999', width: '18px' }}>{qq.type === 'multi' ? '☐' : '○'}</span>
                                <input value={o} onChange={e => setQ(i, { options: qq.options.map((x, z) => z === k ? e.target.value : x) })} style={{ ...st.in, flex: 1 }} />
                                <button onClick={() => setQ(i, { options: qq.options.filter((_, z) => z !== k) })} disabled={qq.options.length <= 2} style={st.icon} title="Remove choice">×</button>
                            </div>))}
                        <button onClick={() => setQ(i, { options: [...(qq.options || []), `Option ${(qq.options || []).length + 1}`] })} style={st.small('#2B4F8C')}>+ Add choice</button>
                    </div>)}
                {qq.type === 'scale' && <p style={{ fontSize: '12px', color: '#777', margin: '8px 0 0' }}>Parents choose 1 (lowest) to 5 (highest).</p>}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    {qq.type !== 'heading' && <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginRight: 'auto' }}><input type="checkbox" checked={!!qq.required} onChange={e => setQ(i, { required: e.target.checked })} />Required</label>}
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={st.icon} title="Move up"><i className="bi bi-arrow-up" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === f.questions.length - 1} style={st.icon} title="Move down"><i className="bi bi-arrow-down" /></button>
                    <button onClick={() => { const a = [...f.questions]; a.splice(i + 1, 0, { ...qq, id: uid() }); set('questions', a); }} style={st.icon} title="Duplicate"><i className="bi bi-files" /></button>
                    <button onClick={() => set('questions', f.questions.filter((_, j) => j !== i))} style={{ ...st.icon, color: '#dc3545' }} title="Delete"><i className="bi bi-trash" /></button>
                </div>
            </div>))}

        <div style={{ ...st.card, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <b style={{ color: '#13306B', marginRight: '6px' }}>Add:</b>
            {TYPES.map(([k, l]) => <button key={k} onClick={() => add(k)} style={st.small(k === 'heading' ? '#C8102E' : '#2B4F8C')}>+ {l}</button>)}
        </div>
    </>);
}

// ══ Results ════════════════════════════════════════════════
function Results({ form, onBack, setError, flash }) {
    const [list, setList] = useState(null);
    const [filter, setFilter] = useState({ q: '', v: '' });
    const [sms, setSms] = useState(null);
    const qs = (form.questions || []).filter(x => x.type !== 'heading');
    const load = () => api.get(`/api/surveys/${form.id}/responses`).then(r => setList(r.data || [])).catch(err => setError(msg(err, 'Could not load responses.')));
    useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
    const filterable = qs.filter(x => ['single', 'dropdown', 'rating', 'yesno'].includes(x.type));
    const rows = useMemo(() => (list || []).filter(r => !filter.q || !filter.v || r.answers?.[filter.q] === filter.v), [list, filter]);

    const summary = (qq) => {
        const vals = rows.map(r => r.answers?.[qq.id]).filter(v => v !== undefined && v !== null && v !== '');
        if (['single', 'dropdown', 'rating', 'yesno', 'multi'].includes(qq.type)) {
            const opts = qq.type === 'yesno' ? ['Yes', 'No'] : qq.options || [];
            const counts = opts.map(o => [o, vals.filter(v => (Array.isArray(v) ? v.includes(o) : v === o)).length]);
            return { kind: 'choice', counts, n: vals.length };
        }
        if (qq.type === 'scale' || qq.type === 'number') {
            const nums = vals.map(Number).filter(n => !isNaN(n));
            return { kind: 'num', n: nums.length, avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null, counts: qq.type === 'scale' ? [1, 2, 3, 4, 5].map(k => [String(k), nums.filter(n => n === k).length]) : null };
        }
        return { kind: 'text', n: vals.length, vals: rows.filter(r => r.answers?.[qq.id]).map(r => ({ v: r.answers[qq.id], who: r.respondentName })) };
    };
    const COLORS = { Excellent: '#1e7e34', Good: '#5cb85c', Fair: '#e0a800', 'Needs improvement': '#C8102E', Yes: '#1e7e34', No: '#C8102E', 'Not sure': '#e0a800',
        'Very satisfied': '#1e7e34', Satisfied: '#5cb85c', Neutral: '#9aa3b2', Dissatisfied: '#e0a800', 'Very dissatisfied': '#C8102E' };
    const colorOf = (o, k) => COLORS[o] || ['#13306B', '#2E75B6', '#5b9bd5', '#9dc3e6', '#C8102E', '#e0a800', '#1e7e34'][k % 7];

    const csv = () => {
        const cell = (v) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
        const head = ['Date', 'Name', 'Phone', ...qs.map(x => x.label)];
        const lines = rows.map(r => [fmt(r.createdAt), r.respondentName || (form.allowAnonymous ? 'Anonymous' : ''), r.phone, ...qs.map(x => r.answers?.[x.id])].map(cell).join(','));
        const blob = new Blob(['\uFEFF' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(form.title || 'form').replace(/[^\w]+/g, '_')}.csv`; a.click();
    };
    const print = () => {
        const parts = qs.map((qq, i) => { const s = summary(qq); const title = `<h3>${i + 1}. ${esc(qq.label)} <small>(${s.n} answer${s.n === 1 ? '' : 's'})</small></h3>`;
            if (s.kind === 'choice' || (s.kind === 'num' && s.counts)) { const t = s.counts.reduce((a, [, n]) => a + n, 0) || 1;
                return title + `<table>${s.counts.map(([o, n]) => `<tr><td class="o">${esc(o)}</td><td class="b"><div style="width:${(n / t) * 100}%"></div></td><td class="n">${n} (${Math.round((n / t) * 100)}%)</td></tr>`).join('')}</table>${s.avg != null ? `<p>Average: <b>${s.avg.toFixed(2)}</b></p>` : ''}`; }
            if (s.kind === 'num') return title + `<p>Average: <b>${s.avg == null ? '—' : s.avg.toFixed(2)}</b></p>`;
            return title + (s.vals.length ? `<ul>${s.vals.map(x => `<li>${esc(x.v)}</li>`).join('')}</ul>` : '<p class="m">No answers.</p>'); }).join('');
        const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(form.title)} — results</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0}
            .bar{background:#13306B;color:#fff;padding:10px 16px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:0;padding:6px 14px;border-radius:5px;font-weight:700;cursor:pointer}
            .pg{padding:12px 16px}h2{text-align:center;color:#13306B;margin:6px 0}h3{color:#13306B;font-size:13px;margin:16px 0 6px;page-break-after:avoid}h3 small{color:#777;font-weight:400}
            table{width:100%;border-collapse:collapse}td{padding:3px 6px;vertical-align:middle}.o{width:32%}.n{width:18%;text-align:right;white-space:nowrap}.b div{height:10px;background:#13306B;border-radius:3px}
            ul{margin:4px 0 0 18px;padding:0}li{margin:3px 0}.m{color:#888}@media print{.bar{display:none}}</style></head><body>
            <div class="bar"><b>${esc(form.title)}</b><button onclick="window.print()">Print / Save PDF</button></div><div class="pg">${letterheadHtml({ logoSize: 50 })}
            <h2>${esc(form.title)} — summary of responses</h2><p style="text-align:center;color:#555">${rows.length} response${rows.length === 1 ? '' : 's'}${filter.q && filter.v ? ` · filtered: ${esc(filter.v)}` : ''} · printed ${new Date().toLocaleDateString('en-GB')}</p>${parts}</div></body></html>`);
        w.document.close();
    };
    const sendSms = async () => {
        try { const r = await api.post(`/api/surveys/${form.id}/sms`, { section: sms.section, message: sms.message }); flash(r.data.message); setSms(null); }
        catch (err) { setError(msg(err, 'Could not send the SMS.')); }
    };
    const del = async (r) => { if (!window.confirm('Delete this response?')) return; try { await api.delete(`/api/surveys/${form.id}/responses/${r.id}`); load(); } catch (err) { setError(msg(err, 'Could not delete.')); } };

    return (<>
        <div style={st.sticky}>
            <button onClick={onBack} style={st.small('#6c757d')}><i className="bi bi-arrow-left" /> Forms</button>
            <b style={{ color: '#13306B', flex: 1, minWidth: '120px' }}>{form.title} — results</b>
            <button onClick={() => { navigator.clipboard?.writeText(linkFor(form.code)); flash('Link copied.'); }} style={st.small('#13306B')}>Copy link</button>
            <button onClick={() => setSms({ section: 'ALL', message: `Dear parent, kindly fill in "${form.title}": ${linkFor(form.code)} Thank you.` })} style={st.small('#6f42c1')}><i className="bi bi-chat-dots" /> SMS parents</button>
            {rows.length > 0 && <><button onClick={csv} style={st.small('#1e7e34')}><i className="bi bi-download" /> CSV</button><button onClick={print} style={st.small('#2B4F8C')}><i className="bi bi-printer" /> Print report</button></>}
        </div>
        {sms && (
            <div style={{ ...st.card, borderLeft: '5px solid #6f42c1' }}>
                <b style={{ color: '#13306B' }}>Send the form link by SMS</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '10px', marginTop: '10px' }}>
                    <label style={st.lbl}>Send to<select value={sms.section} onChange={e => setSms({ ...sms, section: e.target.value })} style={st.in}>{SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
                <label style={{ ...st.lbl, marginTop: '8px' }}>Message ({sms.message.length}/459 characters — about {Math.max(1, Math.ceil(sms.message.length / 153))} SMS each)<textarea value={sms.message} onChange={e => setSms({ ...sms, message: e.target.value })} rows={3} style={st.in} /></label>
                <p style={{ fontSize: '12px', color: '#777' }}>Each parent receives it once, even with several children. SMS charges apply (Settings → SMS). The form must be <b>Open</b>.</p>
                <div style={{ display: 'flex', gap: '8px' }}><button onClick={sendSms} style={st.btn('#6f42c1')}>Send SMS</button><button onClick={() => setSms(null)} style={st.btn('#6c757d')}>Cancel</button></div>
            </div>)}
        {!list ? <p>Loading…</p> : list.length === 0 ? <div style={{ ...st.card, textAlign: 'center', color: '#666' }}>No responses yet. Share the link: <b>{linkFor(form.code)}</b></div> : (<>
            <div style={{ ...st.card, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '22px', color: '#13306B' }}>{rows.length}</b><span style={{ color: '#555' }}>response{rows.length === 1 ? '' : 's'}{rows.length !== list.length ? ` of ${list.length}` : ''}</span>
                {filterable.length > 0 && <>
                    <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#555' }}>Show only:</span>
                    <select value={filter.q} onChange={e => setFilter({ q: e.target.value, v: '' })} style={{ ...st.in, width: 'auto' }}><option value="">— everyone —</option>{filterable.map(x => <option key={x.id} value={x.id}>{x.label.slice(0, 50)}</option>)}</select>
                    {filter.q && <select value={filter.v} onChange={e => setFilter({ ...filter, v: e.target.value })} style={{ ...st.in, width: 'auto' }}><option value="">— any answer —</option>
                        {(qs.find(x => x.id === filter.q)?.type === 'yesno' ? ['Yes', 'No'] : qs.find(x => x.id === filter.q)?.options || []).map(o => <option key={o}>{o}</option>)}</select>}
                </>}
            </div>
            {(form.questions || []).map((qq, i) => {
                if (qq.type === 'heading') return <h3 key={qq.id} style={{ color: '#C8102E', margin: '20px 4px 8px' }}>{qq.label}</h3>;
                const s = summary(qq); const n = qs.indexOf(qq) + 1;
                return (
                    <div key={qq.id} style={st.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                            <b style={{ color: '#13306B' }}>{n}. {qq.label}</b><span style={{ fontSize: '12px', color: '#777', whiteSpace: 'nowrap' }}>{s.n} answer{s.n === 1 ? '' : 's'} · {TYPE_NAME[qq.type]}</span>
                        </div>
                        {(s.kind === 'choice' || (s.kind === 'num' && s.counts)) && (() => { const t = s.counts.reduce((a, [, x]) => a + x, 0) || 1; return s.counts.map(([o, c], k) => (
                            <div key={o} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) 1fr 90px', gap: '8px', alignItems: 'center', fontSize: '13px', margin: '4px 0' }}>
                                <span>{o}</span><div style={{ height: '12px', background: '#eef1f6', borderRadius: '6px', overflow: 'hidden' }}><div style={{ width: `${(c / t) * 100}%`, height: '100%', background: colorOf(o, k) }} /></div>
                                <b style={{ textAlign: 'right' }}>{c} ({Math.round((c / t) * 100)}%)</b>
                            </div>)); })()}
                        {s.kind === 'num' && <p style={{ margin: '6px 0 0', fontSize: '14px' }}>Average: <b>{s.avg == null ? '—' : s.avg.toFixed(2)}</b></p>}
                        {s.kind === 'text' && (s.vals.length === 0 ? <p style={{ color: '#999', margin: 0 }}>No answers.</p> : (
                            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>{s.vals.map((x, k) => <p key={k} style={{ margin: '6px 0', fontSize: '14px', borderLeft: '3px solid #e1e6ee', paddingLeft: '8px' }}>{x.v}{x.who ? <span style={{ color: '#999', fontSize: '12px' }}> — {x.who}</span> : null}</p>)}</div>))}
                    </div>);
            })}
            <details style={st.card}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#13306B' }}>Individual responses ({rows.length})</summary>
                {rows.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '13px', flexWrap: 'wrap' }}>
                        <span><b>{r.respondentName || 'Anonymous'}</b>{r.phone ? ` · ${r.phone}` : ''} · {fmt(r.createdAt)}</span>
                        <button onClick={() => del(r)} style={st.small('#dc3545')}>Delete</button>
                    </div>))}
            </details>
        </>)}
    </>);
}

const st = {
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '12px' },
    sticky: { position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(240,242,245,0.97)', padding: '10px 0', marginBottom: '8px' },
    in: { width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #dde3ec', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#13306B' },
    btn: (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }),
    small: (bg) => ({ backgroundColor: bg, color: 'white', border: 'none', padding: '6px 11px', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center' }),
    icon: { background: 'white', border: '1.5px solid #dde3ec', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: '#13306B' },
    menu: { position: 'absolute', top: '110%', left: 0, zIndex: 30, background: 'white', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', width: '300px', overflow: 'hidden' },
    menuItem: { display: 'block', width: '100%', textAlign: 'left', background: 'white', border: 'none', borderBottom: '1px solid #eee', padding: '12px 14px', cursor: 'pointer', color: '#13306B' },
    err: { background: '#fff3f3', color: '#b02a37', border: '1px solid #f5c2c7', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' },
    ok: { background: '#d4edda', color: '#155724', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' },
    x: { background: 'none', border: 'none', float: 'right', fontSize: '18px', cursor: 'pointer', color: '#b02a37' },
};
export default Forms;
