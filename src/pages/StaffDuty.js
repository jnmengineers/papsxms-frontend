import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { letterheadHtml } from '../utils/school';
import { hasRole } from '../utils/roles';

/**
 * Staff → Duty roster: who is on each duty each week. "Make a fair rota" continues from the last
 * rota and skips anyone on leave for most of a week (they keep their place for the next week).
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monday = (d = new Date()) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
/** The current school week — on Saturday or Sunday, the coming week. */
const schoolWeek = () => { const t = new Date(); const day = t.getDay(); if (day === 6 || day === 0) t.setDate(t.getDate() + (day === 6 ? 2 : 1)); return monday(t); };
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const short = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export default function StaffDuty({ staff, setError, flash, blocked }) {
    const canEdit = hasRole('ADMIN', 'HEAD_TEACHER');
    const [from, setFrom] = useState(iso(schoolWeek()));
    const [weeks, setWeeks] = useState(12);
    const [rota, setRota] = useState(null);
    const [gen, setGen] = useState(null);       // { dutyCode, from, weeks, plan }
    const [adding, setAdding] = useState(null); // { weekStart, dutyCode, staffId }
    const [kindEdit, setKindEdit] = useState(null);
    const load = useCallback(() => api.get('/api/duty/rota', { params: { from, to: addDays(from, (weeks - 1) * 7) } })
        .then(r => setRota(r.data)).catch(err => setError(serverMessage(err, 'Could not load the duty roster.'))), [from, weeks, setError]);
    useEffect(() => { load(); }, [load]);
    const kinds = (rota?.kinds || []).filter(k => k.active);
    const active = (staff || []).filter(s => s.active);
    const thisWeek = iso(schoolWeek());

    const preview = async () => {
        try { const r = await api.post('/api/duty/generate', { dutyCode: gen.dutyCode, from: gen.from, weeks: Number(gen.weeks), save: false }); setGen(g => ({ ...g, plan: r.data.plan })); }
        catch (err) { setError(serverMessage(err, 'Could not make the rota.')); }
    };
    const saveRota = async () => {
        if (!window.confirm(`Save this rota? It replaces the ${kinds.find(k => k.code === gen.dutyCode)?.name.toLowerCase()} already set for those ${gen.weeks} week(s).`)) return;
        try { const r = await api.post('/api/duty/generate', { dutyCode: gen.dutyCode, from: gen.from, weeks: Number(gen.weeks), save: true }); flash(r.data.message); setGen(null); load(); }
        catch (err) { setError(serverMessage(err, 'Could not save the rota.')); }
    };
    const addOne = async () => {
        try { const r = await api.post('/api/duty/assignments', { ...adding, staffId: Number(adding.staffId) }); flash(r.data.message); setAdding(null); load(); }
        catch (err) { setError(serverMessage(err, 'Could not add.')); }
    };
    const removeOne = async (a) => {
        if (!window.confirm(`Remove ${a.fullName} from this week's duty?`)) return;
        try { const r = await api.delete(`/api/duty/assignments/${a.assignmentId}`); flash(r.data.message); load(); }
        catch (err) { setError(serverMessage(err, 'Could not remove.')); }
    };
    const saveKind = async () => {
        try { const r = await api.put('/api/duty/kinds', { ...kindEdit, peoplePerWeek: Number(kindEdit.peoplePerWeek || 1) }); flash(r.data.message); setKindEdit(null); load(); }
        catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    const print = () => {
        const w = window.open('', '_blank'); if (!w) { blocked?.(); return; }
        const rows = rota.weeks.map(wk => `<tr${wk.weekStart === thisWeek ? ' class="now"' : ''}><td>${esc(short(wk.weekStart))} – ${esc(short(wk.weekEnd))}</td>${kinds.map(k => `<td>${esc((wk.duties[k.code] || []).map(a => a.fullName).join(', '))}</td>`).join('')}</tr>`).join('');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Duty roster</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:12px}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px 7px}th{background:#1F3864;color:#fff;text-align:left}tr.now td{background:#fff8e1;font-weight:bold}
            h2{text-align:center;color:#1F3864}.bar{background:#1F3864;color:#fff;padding:8px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:none;padding:5px 12px;font-weight:bold}
            @media print{.bar{display:none}}</style></head><body><div class="bar"><b>Duty roster</b><button onclick="window.print()">Print / Save PDF</button></div>
            ${letterheadHtml({ logoSize: 44 })}<h2>STAFF DUTY ROSTER</h2><table><tr><th>Week</th>${kinds.map(k => `<th>${esc(k.name)}</th>`).join('')}</tr>${rows}</table>
            <p style="margin-top:24px">Head teacher: ______________________ &nbsp; Date: ______________</p></body></html>`);
        w.document.close(); w.focus();
    };

    return (
        <div>
            <div style={{ ...st.panel, ...st.bar }}>
                <label style={st.check}>From the week of<input type="date" style={st.input} value={from} onChange={e => e.target.value && setFrom(iso(monday(new Date(`${e.target.value}T00:00:00`))))} /></label>
                <label style={st.check}>for<select style={st.input} value={weeks} onChange={e => setWeeks(Number(e.target.value))}>{[4, 8, 12, 16, 26].map(n => <option key={n} value={n}>{n} weeks</option>)}</select></label>
                <span style={{ marginLeft: 'auto' }} />
                {rota && <button type="button" onClick={print} style={st.secondary}><Icon name="printer" />Print</button>}
                {canEdit && kinds.length > 0 && <button type="button" onClick={() => setGen({ dutyCode: kinds[0].code, from, weeks: 13, plan: null })} style={st.primary}><Icon name="magic" />Make a fair rota</button>}
            </div>

            {gen && (
                <div style={st.panel}>
                    <h4 style={st.h4}><Icon name="magic" />Make a fair rota</h4>
                    <p style={{ ...st.muted, marginTop: 0 }}>Takes turns in order, continuing from the last rota. Anyone on approved leave for 3 or more days of a week is skipped and keeps their place for the next week.</p>
                    <div style={st.bar}>
                        <select style={st.input} value={gen.dutyCode} onChange={e => setGen(g => ({ ...g, dutyCode: e.target.value, plan: null }))} aria-label="Duty">{kinds.map(k => <option key={k.code} value={k.code}>{k.name} ({k.peoplePerWeek}/week)</option>)}</select>
                        <label style={st.check}>First week<input type="date" style={st.input} value={gen.from} onChange={e => setGen(g => ({ ...g, from: e.target.value, plan: null }))} /></label>
                        <label style={st.check}>Weeks<input style={{ ...st.input, width: '70px' }} inputMode="numeric" value={gen.weeks} onChange={e => setGen(g => ({ ...g, weeks: e.target.value.replace(/\D/g, ''), plan: null }))} /></label>
                        <button type="button" onClick={preview} style={st.secondary}><Icon name="eye" />Show the rota</button>
                        <button type="button" onClick={() => setGen(null)} style={st.link}>Close</button>
                    </div>
                    {gen.plan && (
                        <>
                            <table style={{ ...st.table, marginTop: '10px' }}>
                                <thead><tr><th style={st.th}>Week</th><th style={st.th}>On duty</th><th style={st.th}>Skipped (on leave)</th></tr></thead>
                                <tbody>{gen.plan.map(p => (
                                    <tr key={p.weekStart}><td style={st.td}>{short(p.weekStart)} – {short(addDays(p.weekStart, 4))}</td>
                                        <td style={st.td}>{p.staff.map(s => s.fullName).join(', ')}{p.short ? <span style={{ color: '#b02a37' }}> — {p.short} short</span> : null}</td>
                                        <td style={{ ...st.td, color: '#b8860b' }}>{p.skippedOnLeave.join(', ')}</td></tr>))}</tbody>
                            </table>
                            <div style={{ ...st.bar, justifyContent: 'flex-end', marginTop: '10px' }}><button type="button" onClick={saveRota} style={st.primary}><Icon name="save-fill" />Save this rota</button></div>
                        </>
                    )}
                </div>
            )}

            {!rota ? <p style={st.muted}>Loading…</p> : !kinds.length ? <p style={st.muted}>No kinds of duty yet.</p> : (
                <div style={{ ...st.panel, overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead><tr><th style={st.th}>Week</th>{kinds.map(k => <th key={k.code} style={st.th}>{k.name}</th>)}</tr></thead>
                        <tbody>{rota.weeks.map(wk => (
                            <tr key={wk.weekStart} style={{ backgroundColor: wk.weekStart === thisWeek ? '#fff8e1' : 'white' }}>
                                <td style={{ ...st.td, whiteSpace: 'nowrap', fontWeight: wk.weekStart === thisWeek ? 700 : 400 }}>{short(wk.weekStart)} – {short(wk.weekEnd)}{wk.weekStart === thisWeek && <div style={st.small}>this week</div>}</td>
                                {kinds.map(k => (
                                    <td key={k.code} style={st.td}>
                                        {(wk.duties[k.code] || []).map(a => (
                                            <span key={a.assignmentId} style={st.chip}>{a.fullName}{canEdit && <button type="button" onClick={() => removeOne(a)} style={st.x} aria-label={`Remove ${a.fullName}`}>×</button>}</span>))}
                                        {canEdit && <button type="button" onClick={() => setAdding({ weekStart: wk.weekStart, dutyCode: k.code, staffId: '' })} style={{ ...st.link, fontSize: '12px' }} aria-label="Add someone">+ add</button>}
                                    </td>))}
                            </tr>))}</tbody>
                    </table>
                </div>
            )}

            {adding && (
                <div style={{ ...st.panel, ...st.bar }}>
                    <b>Week of {short(adding.weekStart)} — {kinds.find(k => k.code === adding.dutyCode)?.name}:</b>
                    <select style={st.input} value={adding.staffId} onChange={e => setAdding(a => ({ ...a, staffId: e.target.value }))} aria-label="Staff member"><option value="">— choose —</option>{active.map(s => <option key={s.staffId} value={s.staffId}>{s.fullName}</option>)}</select>
                    <button type="button" disabled={!adding.staffId} onClick={addOne} style={st.primary}>Add</button>
                    <button type="button" onClick={() => setAdding(null)} style={st.link}>Cancel</button>
                </div>
            )}

            {canEdit && rota && (
                <div style={st.panel}>
                    <h4 style={st.h4}><Icon name="list-check" />Kinds of duty</h4>
                    {(rota.kinds || []).map(k => (
                        <div key={k.code} style={st.item}><span style={{ flex: 1, opacity: k.active ? 1 : 0.5 }}><b>{k.name}</b> — {k.peoplePerWeek} a week{k.teachersOnly ? ', teachers only' : ''}{k.notes ? <span style={st.small}> · {k.notes}</span> : null}</span>
                            <button type="button" onClick={() => setKindEdit({ ...k })} style={st.link}><Icon name="pencil" />Edit</button></div>))}
                    <button type="button" onClick={() => setKindEdit({ code: '', name: '', peoplePerWeek: 1, teachersOnly: true, active: true, sortOrder: 50, notes: '' })} style={{ ...st.link, marginTop: '6px' }}><Icon name="plus-circle" />Add a kind of duty</button>
                    {kindEdit && (
                        <div style={{ ...st.bar, marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                            <input style={{ ...st.input, width: '110px' }} placeholder="Code" maxLength={20} value={kindEdit.code} disabled={(rota.kinds || []).some(k => k.code === kindEdit.code) && !!kindEdit.name} onChange={e => setKindEdit(x => ({ ...x, code: e.target.value.toUpperCase() }))} aria-label="Code" />
                            <input style={{ ...st.input, flex: 1, minWidth: '160px' }} placeholder="Name (e.g. Games duty)" maxLength={60} value={kindEdit.name} onChange={e => setKindEdit(x => ({ ...x, name: e.target.value }))} aria-label="Name" />
                            <label style={st.check}>People a week<input style={{ ...st.input, width: '60px' }} inputMode="numeric" value={kindEdit.peoplePerWeek} onChange={e => setKindEdit(x => ({ ...x, peoplePerWeek: e.target.value.replace(/\D/g, '') }))} /></label>
                            <label style={st.check}><input type="checkbox" checked={kindEdit.teachersOnly} onChange={e => setKindEdit(x => ({ ...x, teachersOnly: e.target.checked }))} />Teachers only</label>
                            <label style={st.check}><input type="checkbox" checked={kindEdit.active} onChange={e => setKindEdit(x => ({ ...x, active: e.target.checked }))} />In use</label>
                            <button type="button" onClick={() => setKindEdit(null)} style={st.secondary}>Cancel</button>
                            <button type="button" onClick={saveKind} style={st.primary}><Icon name="save-fill" />Save</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const st = {
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
    input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', color: '#222', backgroundColor: 'white', minWidth: 0 },
    primary: { padding: '9px 14px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    h4: { color: '#1F3864', margin: '0 0 8px', fontSize: '14px' },
    item: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '520px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'top' },
    chip: { display: 'inline-flex', alignItems: 'center', gap: '2px', backgroundColor: '#eef3fb', color: '#1F3864', borderRadius: '12px', padding: '2px 8px', margin: '2px 4px 2px 0', fontSize: '12px', fontWeight: 600 },
    x: { background: 'none', border: 'none', color: '#b02a37', cursor: 'pointer', fontWeight: 700, padding: '0 0 0 4px', fontSize: '14px', lineHeight: 1 },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};
