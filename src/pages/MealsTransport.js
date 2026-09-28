import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

/**
 * Meals & Transport — class teachers tick who takes lunch, porridge, swimming, a trip…
 * and who uses the bus, for their own class in the current term.
 * The bursar decides which charges appear here (Finance → Extra Charges → "Class teachers can tick").
 * No amounts are shown. Learners with a special price are locked (the bursar changes them).
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const norm = (v) => String(v ?? '').trim().toLowerCase();
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const DIRS = [{ key: 'TWO_WAY', label: 'Two ways' }, { key: 'ONE_WAY', label: 'One way' }];

function MealsTransport() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [classes, setClasses] = useState(null);     // classes I may open
    const [termLabel, setTermLabel] = useState('');
    const [classId, setClassId] = useState('');
    const [sheet, setSheet] = useState(null);
    const [ticks, setTicks] = useState({});           // chargeId -> Set(studentId)
    const [trips, setTrips] = useState({});           // studentId -> { routeId, direction }
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const latest = useRef('');

    // Which classes, and the current term
    useEffect(() => {
        api.get('/api/class-services/classes')
            .then(r => {
                const list = [...(r.data.classes || [])].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
                setClasses(list);
                setTermLabel(r.data.termLabel || '');
                if (list.length) setClassId(String(list[0].classId));
            })
            .catch(err => { setClasses([]); setError(serverMessage(err, 'Could not load your classes.')); });
    }, []);

    const fromSheet = (d) => {
        const t = {};
        (d.charges || []).forEach(c => { t[c.chargeId] = new Set(d.learners.filter(l => l.charges[c.chargeId]?.ticked).map(l => l.studentId)); });
        const tr = {};
        d.learners.forEach(l => { tr[l.studentId] = { routeId: l.transport.routeId ?? null, direction: l.transport.direction || 'TWO_WAY' }; });
        setTicks(t); setTrips(tr);
    };

    const load = useCallback(async (id) => {
        if (!id) return;
        latest.current = id;
        setLoading(true); setError('');
        try {
            const r = await api.get('/api/class-services', { params: { classId: id } });
            if (latest.current !== id) return;
            setSheet(r.data); fromSheet(r.data);
        } catch (err) { if (latest.current === id) { setSheet(null); setError(serverMessage(err, 'Could not load the class.')); } }
        if (latest.current === id) setLoading(false);
    }, []);
    useEffect(() => { load(classId); }, [classId, load]);

    // ── what changed ──
    const changes = useMemo(() => {
        if (!sheet) return { charges: [], transport: [], count: 0 };
        const charges = sheet.charges.map(c => {
            const orig = new Set(sheet.learners.filter(l => l.charges[c.chargeId]?.ticked).map(l => l.studentId));
            const now = ticks[c.chargeId] || new Set();
            return { chargeId: c.chargeId, name: c.name, add: [...now].filter(id => !orig.has(id)), remove: [...orig].filter(id => !now.has(id)) };
        }).filter(c => c.add.length || c.remove.length);
        const transport = sheet.learners.filter(l => {
            const v = trips[l.studentId]; if (!v) return false;
            const was = l.transport;
            return String(v.routeId ?? '') !== String(was.routeId ?? '') || (v.routeId && v.direction !== (was.direction || 'TWO_WAY'));
        }).map(l => ({ studentId: l.studentId, routeId: trips[l.studentId].routeId ? Number(trips[l.studentId].routeId) : null, direction: trips[l.studentId].direction }));
        return { charges, transport, count: charges.reduce((s, c) => s + c.add.length + c.remove.length, 0) + transport.length };
    }, [sheet, ticks, trips]);
    const dirty = changes.count > 0;

    // Warn before leaving with unsaved ticks
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const pickClass = (id) => { if (!dirty || window.confirm('You have unsaved ticks. Discard them?')) setClassId(id); };
    const toggle = (chargeId, studentId) => setTicks(t => {
        const n = new Set(t[chargeId] || []); n.has(studentId) ? n.delete(studentId) : n.add(studentId);
        return { ...t, [chargeId]: n };
    });
    const setAll = (chargeId, on) => setTicks(t => {
        const n = new Set(t[chargeId] || []);
        shown.forEach(l => { const cell = l.charges[chargeId]; if (cell && !cell.lock) on ? n.add(l.studentId) : n.delete(l.studentId); });
        return { ...t, [chargeId]: n };
    });
    const setTrip = (studentId, patch) => setTrips(t => ({ ...t, [studentId]: { ...t[studentId], ...patch } }));

    const save = async () => {
        if (!dirty || saving) return;
        const lines = [
            ...changes.charges.map(c => `${c.name}: ${c.add.length} ticked, ${c.remove.length} unticked`),
            ...(changes.transport.length ? [`Transport: ${changes.transport.length} change(s)`] : []),
        ];
        if (!window.confirm(`Save for ${sheet.termLabel}?\n\n${lines.join('\n')}\n\nThe bursar will see these on the learners' accounts.`)) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const r = await api.post('/api/class-services', {
                classId: Number(classId),
                charges: changes.charges.map(c => ({ chargeId: c.chargeId, add: c.add, remove: c.remove })),
                transport: changes.transport,
            });
            setSuccess(r.data.message);
            await load(classId);
        } catch (err) { setError(serverMessage(err, 'Failed to save. Nothing was changed.')); }
        setSaving(false);
    };

    const shown = (sheet?.learners || []).filter(l => !search.trim() || norm(l.name).includes(norm(search)) || norm(l.admissionNumber).includes(norm(search)));
    const countOf = (chargeId) => (ticks[chargeId] || new Set()).size;
    const riders = sheet ? sheet.learners.filter(l => trips[l.studentId]?.routeId).length : 0;
    const routeName = (id) => sheet?.routes.find(r => String(r.routeId) === String(id))?.name;
    const cls = (classes || []).find(c => String(c.classId) === String(classId));

    return (
        <div style={s.container}>
            <Navbar />
            <div style={s.layoutRow}>
                <Sidebar />
                <div style={s.content}>
                    <h2 style={s.title}><Icon name="basket2-fill" style={{ marginRight: '10px' }} />Meals &amp; Transport</h2>
                    <p style={s.subtitle}>Tick who takes lunch, porridge, trips and other activities, and who uses the school bus{termLabel ? ` — ${termLabel}` : ''}.</p>

                    {error && <div style={s.error} role="alert"><Icon name="exclamation-triangle-fill" /><span style={{ flex: 1, whiteSpace: 'pre-line' }}>{error}</span>
                        <button onClick={() => setError('')} style={s.dismiss} aria-label="Dismiss"><i className="bi bi-x-lg" /></button></div>}
                    {success && <p style={s.success}><Icon name="check-circle-fill" />{success}</p>}

                    {classes === null ? <p style={s.center}><Icon name="hourglass-split" />Loading…</p>
                        : classes.length === 0 ? (
                            <div style={s.panel}><p style={{ margin: 0 }}><Icon name="info-circle-fill" style={{ color: '#2E75B6' }} />You are not set as class teacher of any class, so there is nothing to tick here. Ask the admin if this is wrong.</p></div>
                        ) : (
                        <>
                            <div style={s.bar}>
                                {classes.length > 1 ? (
                                    <select style={s.select} value={classId} onChange={e => pickClass(e.target.value)} aria-label="Class">
                                        {classes.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                                    </select>
                                ) : <strong style={{ color: '#1F3864', fontSize: '16px' }}>{cls ? classDisplayName(cls) : ''}</strong>}
                                <div style={s.searchBox}>
                                    <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                                    <input style={s.searchInput} placeholder="Find learner…" value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                            </div>

                            {loading ? <p style={s.center}><Icon name="hourglass-split" />Loading…</p> : sheet && (
                                <>
                                    <div style={s.chips}>
                                        {sheet.charges.map(c => (
                                            <div key={c.chargeId} style={s.chip}>
                                                <strong>{countOf(c.chargeId)}</strong><span>{c.name}</span>
                                                <span style={s.chipBtns}>
                                                    <button type="button" onClick={() => setAll(c.chargeId, true)} style={s.link} title={`Tick everyone shown for ${c.name}`}>all</button>·
                                                    <button type="button" onClick={() => setAll(c.chargeId, false)} style={s.link} title={`Untick everyone shown for ${c.name}`}>none</button>
                                                </span>
                                            </div>
                                        ))}
                                        {sheet.routes.length > 0 && <div style={s.chip}><strong>{riders}</strong><span>Bus users</span></div>}
                                    </div>

                                    {!sheet.charges.length && sheet.routes.length > 0 && (
                                        <p style={s.hint}><Icon name="info-circle-fill" style={{ color: '#2E75B6' }} />
                                            No meals or other charges are open for class teachers yet, so only the bus column shows.
                                            The bursar can open them in Finance → Extra Charges (tick "Class teachers can tick learners for this").
                                        </p>
                                    )}
                                    {!sheet.charges.length && !sheet.routes.length ? (
                                        <div style={s.panel}><p style={{ margin: 0 }}>The bursar hasn't opened any charges or bus destinations for class teachers yet.</p></div>
                                    ) : (
                                        <div style={s.panel}>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={s.table}>
                                                    <thead><tr>
                                                        <th style={{ ...s.th, ...s.sticky, backgroundColor: '#1F3864' }}>Learner</th>
                                                        {sheet.charges.map(c => <th key={c.chargeId} style={{ ...s.th, textAlign: 'center' }}>{c.name}</th>)}
                                                        {sheet.routes.length > 0 && <th style={s.th}>School bus</th>}
                                                    </tr></thead>
                                                    <tbody>
                                                        {shown.map((l, i) => {
                                                            const v = trips[l.studentId] || {};
                                                            const tripChanged = String(v.routeId ?? '') !== String(l.transport.routeId ?? '') || (v.routeId && v.direction !== (l.transport.direction || 'TWO_WAY'));
                                                            const bg = i % 2 ? 'white' : '#fafafa';
                                                            return (
                                                                <tr key={l.studentId} style={{ backgroundColor: bg }}>
                                                                    <td style={{ ...s.td, ...s.sticky, backgroundColor: bg }}>
                                                                        <strong style={{ color: '#1F3864' }}>{l.name}</strong>
                                                                        <div style={s.adm}>{l.admissionNumber}</div>
                                                                    </td>
                                                                    {sheet.charges.map(c => {
                                                                        const cell = l.charges[c.chargeId];
                                                                        if (!cell) return <td key={c.chargeId} style={{ ...s.td, textAlign: 'center', color: '#ccc' }}>—</td>;
                                                                        const on = (ticks[c.chargeId] || new Set()).has(l.studentId);
                                                                        const changed = on !== cell.ticked;
                                                                        return (
                                                                            <td key={c.chargeId} style={{ ...s.td, textAlign: 'center', backgroundColor: changed ? '#fff3cd' : undefined }}>
                                                                                {cell.lock ? (
                                                                                    <span title={cell.lock} style={{ color: '#888', cursor: 'help' }}>
                                                                                        <i className={`bi bi-${cell.ticked ? 'check-square-fill' : 'square'}`} aria-hidden="true" /> <i className="bi bi-lock-fill" aria-label={cell.lock} />
                                                                                    </span>
                                                                                ) : (
                                                                                    <input type="checkbox" checked={on} onChange={() => toggle(c.chargeId, l.studentId)}
                                                                                        style={{ width: '22px', height: '22px', cursor: 'pointer' }} aria-label={`${c.name} for ${l.name}`} />
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    {sheet.routes.length > 0 && (
                                                                        <td style={{ ...s.td, backgroundColor: tripChanged ? '#fff3cd' : undefined, whiteSpace: 'nowrap' }}>
                                                                            {l.transport.lock ? (
                                                                                <span title={l.transport.lock} style={{ color: '#555', cursor: 'help' }}>
                                                                                    {routeName(l.transport.routeId) || 'Bus'} <i className="bi bi-lock-fill" aria-label={l.transport.lock} />
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ display: 'flex', gap: '6px' }}>
                                                                                    <select style={s.cellSelect} value={v.routeId ?? ''} onChange={e => setTrip(l.studentId, { routeId: e.target.value || null })} aria-label={`Bus destination for ${l.name}`}>
                                                                                        <option value="">No bus</option>
                                                                                        {sheet.routes.map(r => <option key={r.routeId} value={String(r.routeId)}>{r.name}</option>)}
                                                                                    </select>
                                                                                    {v.routeId && (
                                                                                        <select style={s.cellSelect} value={v.direction || 'TWO_WAY'} onChange={e => setTrip(l.studentId, { direction: e.target.value })} aria-label="One or two ways">
                                                                                            {DIRS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                                                                        </select>
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                        {!shown.length && <tr><td colSpan={1 + sheet.charges.length + (sheet.routes.length ? 1 : 0)} style={{ ...s.td, textAlign: 'center', color: '#888', padding: '20px' }}>No learners.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p style={s.note}><i className="bi bi-lock-fill" aria-hidden="true" /> = the bursar has set a special price for this learner; ask the bursar to change it. Hold or tap the lock to see why.</p>
                                        </div>
                                    )}

                                    <div style={s.saveBar}>
                                        <span style={{ fontSize: '14px' }}>{dirty ? <><strong>{changes.count}</strong> unsaved change{changes.count === 1 ? '' : 's'}</> : 'No unsaved changes'}</span>
                                        <span style={{ display: 'flex', gap: '8px' }}>
                                            {dirty && <button onClick={() => fromSheet(sheet)} style={s.secondary} disabled={saving}>Undo</button>}
                                            <button onClick={save} disabled={!dirty || saving} style={{ ...s.primary, opacity: !dirty || saving ? 0.55 : 1 }}>
                                                <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}
                                            </button>
                                        </span>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

const s = {
    container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5' },
    layoutRow: { display: 'flex', flex: 1, minWidth: 0 },
    content: { flex: 1, minWidth: 0, padding: '20px', paddingBottom: '90px' },
    title: { color: '#1F3864', margin: '0 0 4px' },
    subtitle: { color: '#666', margin: '0 0 16px', fontSize: '14px' },
    error: { display: 'flex', alignItems: 'flex-start', gap: '6px', backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    dismiss: { background: 'none', border: 'none', cursor: 'pointer', color: '#721c24' },
    success: { backgroundColor: '#d4edda', color: '#155724', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' },
    center: { textAlign: 'center', color: '#666', padding: '24px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'white', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    select: { padding: '9px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '15px', backgroundColor: 'white' },
    searchBox: { display: 'flex', alignItems: 'center', flex: 1, minWidth: '160px', border: '1px solid #ccc', borderRadius: '6px', padding: '0 10px', backgroundColor: 'white' },
    searchInput: { border: 'none', outline: 'none', padding: '9px 0', fontSize: '15px', flex: 1, minWidth: 0 },
    chips: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
    chip: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', borderRadius: '20px', padding: '6px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', fontSize: '13px', color: '#1F3864' },
    chipBtns: { display: 'flex', alignItems: 'center', gap: '2px', color: '#aaa', marginLeft: '4px' },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', textDecoration: 'underline' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '520px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '9px 8px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' },
    td: { padding: '8px', borderBottom: '1px solid #eee', fontSize: '14px' },
    sticky: { position: 'sticky', left: 0, zIndex: 1, minWidth: '150px', boxShadow: '2px 0 3px rgba(0,0,0,0.05)' },
    adm: { fontSize: '11px', color: '#888' },
    cellSelect: { padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white', maxWidth: '170px' },
    note: { fontSize: '12px', color: '#777', margin: '10px 0 0' },
    hint: { fontSize: '13px', color: '#1F3864', backgroundColor: '#e8f1fb', padding: '8px 12px', borderRadius: '8px', margin: '0 0 12px' },
    saveBar: { position: 'sticky', bottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 -2px 10px rgba(0,0,0,0.12)', zIndex: 5 },
    primary: { padding: '10px 18px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' },
    secondary: { padding: '10px 14px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
};

export default MealsTransport;
