import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { classDisplayName } from '../utils/classUtils';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import PriceEditor from '../components/PriceEditor';
import { letterheadHtml } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

const money = (n) => (n === null || n === undefined || n === '' ? '-' : Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const kes = (n) => `KES ${money(n)}`;
const norm = (v) => String(v ?? '').trim().toLowerCase();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isAmount = (s) => /^\d{1,7}(\.\d{1,2})?$/.test(String(s).trim()) && Number(s) > 0;
const isActiveTerm = (y) => !!(y?.isActive ?? y?.active);
const DIRS = [{ key: 'TWO_WAY', label: 'Two ways' }, { key: 'ONE_WAY', label: 'One way' }];
const dirLabel = (d) => DIRS.find(x => x.key === d)?.label || '';
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};
const busLabel = (v) => v ? `${v.name ? v.name + ' — ' : ''}${v.registration}` : '';
const fareFor = (route, dir) => !route ? null : Number(dir === 'ONE_WAY' ? route.oneWayTermly : route.twoWayTermly);
const monthlyFor = (route, dir) => !route ? null : (dir === 'ONE_WAY' ? route.oneWayMonthly : route.twoWayMonthly);
const dailyFor = (route, dir) => !route ? null : (dir === 'ONE_WAY' ? route.oneWayDaily : route.twoWayDaily);
// What a price choice comes to (same rules as the server)
const priceAmount = (p, route, dir) => {
    if (!p || !p.basis || p.basis === 'TERM') return fareFor(route, dir);
    if (p.basis === 'MONTHS') return Number(monthlyFor(route, dir) || 0) * (p.quantity || 0);
    if (p.basis === 'DAYS') return Number(dailyFor(route, dir) || 0) * (p.quantity || 0);
    return Number(p.amount || 0);
};
const priceText = (basis, quantity) => basis === 'MONTHS' ? `${quantity} month${quantity === 1 ? '' : 's'}`
    : basis === 'DAYS' ? `${quantity} day${quantity === 1 ? '' : 's'}` : basis === 'CUSTOM' ? 'agreed' : '';

function Transport() {
    useSchoolSettings();   // re-draws when School Settings have loaded
    const [tab, setTab] = useState('riders');
    const [classes, setClasses] = useState([]);
    const [years, setYears] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const successTimer = useRef(null);

    const loadRoutes = () => api.get('/api/transport/routes').then(r => setRoutes(r.data || [])).catch(err => setError(serverMessage(err, 'Failed to load destinations.')));
    const loadVehicles = () => api.get('/api/transport/vehicles').then(r => setVehicles(r.data || [])).catch(err => setError(serverMessage(err, 'Failed to load the fleet.')));

    useEffect(() => {
        Promise.allSettled([api.get('/api/classes'), api.get('/api/academic-years')]).then(([c, y]) => {
            if (c.status === 'fulfilled') setClasses([...(c.value.data || [])].sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true })));
            if (y.status === 'fulfilled') setYears(y.value.data || []);
        });
        loadRoutes(); loadVehicles();
        return () => clearTimeout(successTimer.current);
    }, []);

    const flashSuccess = (msg) => {
        setError(''); setSuccessMsg(msg);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSuccessMsg(''), 4500);
    };

    const termOptions = [...years].sort((a, b) => String(b.yearLabel).localeCompare(String(a.yearLabel)) || Number(b.term) - Number(a.term))
        .map(y => ({ value: `${y.yearLabel}|${y.term}`, label: `${y.yearLabel} — Term ${y.term}${isActiveTerm(y) ? ' (current)' : ''}`, active: isActiveTerm(y) }));
    const defaultTerm = (termOptions.find(t => t.active) || termOptions[0])?.value || '';

    const TABS = [['riders', 'people-fill', 'Riders'], ['lists', 'bus-front-fill', 'Bus Lists'], ['routes', 'geo-alt-fill', 'Destinations & Fares'], ['fleet', 'truck-front-fill', 'Fleet']];
    const shared = { termOptions, defaultTerm, classes, routes, vehicles, setError, flashSuccess };

    return (
        <div style={styles.container}>
            <Navbar />
            <div style={styles.layoutRow}>
                <Sidebar />
                <div style={styles.content}>
                    <h2 style={styles.title}><Icon name="bus-front-fill" style={{ marginRight: '10px' }} />Transport</h2>
                    <p style={styles.subtitle}>School buses, destinations and the learners who use them. Fares go straight to each learner's fee account.</p>

                    {error && (
                        <div style={styles.error} role="alert">
                            <Icon name="exclamation-triangle-fill" /><span style={{ flex: 1 }}>{error}</span>
                            <button onClick={() => setError('')} style={styles.dismissBtn} aria-label="Dismiss"><i className="bi bi-x-lg" /></button>
                        </div>
                    )}
                    {successMsg && <p style={styles.success}><Icon name="check-circle-fill" />{successMsg}</p>}

                    <div style={styles.tabs} role="tablist">
                        {TABS.map(([k, ic, label]) => (
                            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setError(''); setTab(k); }}
                                style={{ ...styles.tab, backgroundColor: tab === k ? '#1F3864' : 'white', color: tab === k ? 'white' : '#1F3864' }}>
                                <Icon name={ic} />{label}
                            </button>
                        ))}
                    </div>

                    {tab === 'riders' && <RidersTab {...shared} />}
                    {tab === 'lists' && <BusListsTab {...shared} />}
                    {tab === 'routes' && <RoutesTab routes={routes} reload={loadRoutes} setError={setError} flashSuccess={flashSuccess} />}
                    {tab === 'fleet' && <FleetTab vehicles={vehicles} reload={loadVehicles} setError={setError} flashSuccess={flashSuccess} />}
                </div>
            </div>
            <Footer />
        </div>
    );
}

// ══ Riders: who uses transport this term ═══════════════════════════════════
const RidersTab = ({ termOptions, defaultTerm, classes, routes, vehicles, setError, flashSuccess }) => {
    const [termKey, setTermKey] = useState('');
    const [classId, setClassId] = useState('');
    const [search, setSearch] = useState('');
    const [ridersOnly, setRidersOnly] = useState(false);
    const [rows, setRows] = useState([]);            // from the server
    const [edits, setEdits] = useState({});          // studentId -> { routeId, direction, vehicleId, price? }
    const [pricing, setPricing] = useState(null);    // row whose price is being set
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const latest = useRef('');

    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm]);
    const [year, term] = termKey.split('|');

    const load = async () => {
        if (!termKey) return;
        const key = `${termKey}|${classId}`;
        latest.current = key;
        setLoading(true);
        try {
            const r = await api.get('/api/transport/term', { params: { yearLabel: year, term, ...(classId ? { classId } : {}) } });
            if (latest.current !== key) return;
            setRows(r.data.learners || []);
            setEdits({});
        } catch (err) { if (latest.current === key) setError(serverMessage(err, 'Failed to load riders.')); }
        if (latest.current === key) setLoading(false);
    };
    useEffect(() => { load(); }, [termKey, classId]);

    const valueOf = (r) => edits[r.studentId] || { routeId: r.routeId, direction: r.direction || 'TWO_WAY', vehicleId: r.vehicleId };
    const sameTrip = (r, v) => String(v.routeId ?? '') === String(r.routeId ?? '') && v.direction === r.direction;
    const isChanged = (r) => {
        const e = edits[r.studentId];
        if (!e) return false;
        return String(e.routeId ?? '') !== String(r.routeId ?? '') ||
            (e.routeId && (e.direction !== r.direction || String(e.vehicleId ?? '') !== String(r.vehicleId ?? '') || !!e.price));
    };
    // Changing destination or one/two ways drops a chosen price (the new trip starts at the full term)
    const setField = (r, patch) => setEdits(ed => {
        const cur = { ...valueOf(r), ...patch };
        if ('routeId' in patch || 'direction' in patch) delete cur.price;
        return { ...ed, [r.studentId]: cur };
    });
    // The fare this row will be charged, and a short label for it
    const fareOf = (r) => {
        const v = valueOf(r);
        if (!v.routeId) return null;
        const route = routeById(v.routeId);
        if (v.price) return priceAmount(v.price, route, v.direction);
        if (r.routeId && sameTrip(r, v) && r.amount !== null && r.amount !== undefined) return Number(r.amount);
        return fareFor(route, v.direction);
    };
    const fareLabel = (r) => {
        const v = valueOf(r);
        if (v.price) return priceText(v.price.basis, v.price.quantity);
        if (r.routeId && sameTrip(r, v)) return priceText(r.basis, r.quantity);
        return '';
    };
    const changed = rows.filter(isChanged);
    const dirty = changed.length > 0;

    const guard = (fn) => (v) => { if (!dirty || window.confirm('You have unsaved transport changes. Discard them?')) fn(v); };

    const routeById = (id) => routes.find(x => String(x.routeId) === String(id));
    const activeRoutes = routes.filter(r => r.active);
    const activeVehicles = vehicles.filter(v => v.active);

    const shown = rows.filter(r => {
        const v = valueOf(r);
        if (ridersOnly && !v.routeId) return false;
        return !search.trim() || norm(r.name).includes(norm(search)) || norm(r.admissionNumber).includes(norm(search));
    });
    const riders = rows.filter(r => valueOf(r).routeId);
    const termTotal = riders.reduce((s, r) => s + (fareOf(r) || 0), 0);

    // Copy last term's transport for learners with none yet this term
    const idx = termOptions.findIndex(t => t.value === termKey);
    const prevTerm = idx >= 0 ? termOptions[idx + 1] : null;
    const copyPrevious = async () => {
        const [py, pt] = prevTerm.value.split('|');
        try {
            const r = await api.get('/api/transport/term', { params: { yearLabel: py, term: pt, ...(classId ? { classId } : {}) } });
            const prev = {};
            (r.data.learners || []).forEach(l => { if (l.routeId) prev[l.studentId] = l; });
            let n = 0;
            const next = { ...edits };
            rows.forEach(row => {
                const p = prev[row.studentId];
                if (p && !valueOf(row).routeId && routeById(p.routeId)?.active) {
                    next[row.studentId] = { routeId: p.routeId, direction: p.direction, vehicleId: p.vehicleId };
                    n++;
                }
            });
            setEdits(next);
            flashSuccess(`${n} learner(s) given the same transport as ${prevTerm.label.replace(' (current)', '')}. Check, then Save.`);
        } catch (err) { setError(serverMessage(err, 'Could not read last term.')); }
    };

    const save = async () => {
        if (!dirty || saving) return;
        const adds = changed.filter(r => !r.routeId && valueOf(r).routeId).length;
        const removes = changed.filter(r => r.routeId && !valueOf(r).routeId).length;
        const others = changed.length - adds - removes;
        if (!window.confirm(`Transport for ${year} Term ${term}:\n\n${adds} new rider(s)\n${others} change(s) (destination, one/two ways or bus)\n${removes} removed\n\nFares are charged to (or cancelled from) each learner's fee account. Save?`)) return;
        setSaving(true); setError('');
        try {
            const r = await api.post('/api/transport/apply', {
                yearLabel: year, term: Number(term),
                changes: changed.map(row => {
                    const v = valueOf(row);
                    // No price sent = keep the learner's price on the same trip (or full term for a new trip)
                    return { studentId: row.studentId, routeId: v.routeId ? Number(v.routeId) : null, direction: v.direction, vehicleId: v.vehicleId ? Number(v.vehicleId) : null,
                        ...(v.price ? { basis: v.price.basis, quantity: v.price.quantity, amount: v.price.amount, note: v.price.note } : {}) };
                }),
            });
            flashSuccess(r.data.message);
            await load();
        } catch (err) { setError(serverMessage(err, 'Failed to save. Nothing was changed.')); }
        setSaving(false);
    };

    if (!termOptions.length) return <div style={styles.panel}><p style={{ margin: 0 }}>No terms found. Add terms on the Academic Years page first.</p></div>;
    if (!routes.length) return <div style={styles.panel}><p style={{ margin: 0 }}>No destinations yet. Add them on the <strong>Destinations &amp; Fares</strong> tab (or run the transport routes script).</p></div>;

    return (
        <div>
            <div style={styles.bar}>
                <label style={styles.check}>Term
                    <select style={styles.select} value={termKey} onChange={e => guard(setTermKey)(e.target.value)}>
                        {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>
                <select style={styles.select} value={classId} onChange={e => guard(setClassId)(e.target.value)} aria-label="Class">
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c.classId} value={String(c.classId)}>{classDisplayName(c)}</option>)}
                </select>
                <div style={{ ...styles.searchBox, flex: 1, minWidth: '160px' }}>
                    <Icon name="search" style={{ color: '#999', marginRight: '8px' }} />
                    <input style={styles.searchInput} placeholder="Find learner…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <label style={styles.check}><input type="checkbox" checked={ridersOnly} onChange={e => setRidersOnly(e.target.checked)} /> Riders only</label>
                {prevTerm && <button onClick={copyPrevious} style={styles.secondaryBtn}><Icon name="files" />Copy from {prevTerm.label.replace(' (current)', '')}</button>}
            </div>

            <div style={styles.cards}>
                <div style={{ ...styles.card, borderTopColor: '#1F3864' }}><div style={styles.cardNum}>{riders.length}</div><div style={styles.cardLbl}>Riders{classId ? ' in this class' : ''}</div></div>
                <div style={{ ...styles.card, borderTopColor: '#28a745' }}><div style={styles.cardNum}>{kes(termTotal)}</div><div style={styles.cardLbl}>Transport fares this term</div></div>
            </div>

            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : (
                <div style={styles.panel}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ ...styles.table, minWidth: '860px' }}>
                            <thead><tr>
                                <th style={styles.th}>Learner</th><th style={styles.th}>Destination</th><th style={styles.th}>Trips</th>
                                <th style={styles.th}>Bus</th><th style={styles.thNum}>Fare this term</th>
                            </tr></thead>
                            <tbody>
                                {shown.map((r, i) => {
                                    const v = valueOf(r);
                                    const ch = isChanged(r);
                                    const route = routeById(v.routeId);
                                    return (
                                        <tr key={r.studentId} style={{ backgroundColor: ch ? '#fff8e1' : v.routeId ? '#f3fbf5' : i % 2 ? 'white' : '#fafafa' }}>
                                            <td style={styles.td}>
                                                <strong style={{ color: '#1F3864' }}>{r.name}</strong>
                                                <div style={styles.adm}>{r.admissionNumber} · {r.className}</div>
                                                {ch && <span style={styles.changedTag}>{!r.routeId ? 'new rider' : !v.routeId ? 'will stop' : 'changed'}</span>}
                                            </td>
                                            <td style={styles.td}>
                                                <select style={styles.cellSelect} value={v.routeId ?? ''} onChange={e => setField(r, { routeId: e.target.value || null })} aria-label={`Destination for ${r.name}`}>
                                                    <option value="">— No transport —</option>
                                                    {activeRoutes.map(x => <option key={x.routeId} value={String(x.routeId)}>{x.name}</option>)}
                                                    {route && !route.active && <option value={String(route.routeId)}>{route.name} (switched off)</option>}
                                                </select>
                                            </td>
                                            <td style={styles.td}>
                                                <select style={styles.cellSelect} value={v.direction} disabled={!v.routeId} onChange={e => setField(r, { direction: e.target.value })} aria-label="One or two ways">
                                                    {DIRS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                                </select>
                                            </td>
                                            <td style={styles.td}>
                                                <select style={styles.cellSelect} value={v.vehicleId ?? ''} disabled={!v.routeId} onChange={e => setField(r, { vehicleId: e.target.value || null })} aria-label="Bus">
                                                    <option value="">— Not set —</option>
                                                    {activeVehicles.map(x => <option key={x.vehicleId} value={String(x.vehicleId)}>{busLabel(x)}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ ...styles.tdNum, whiteSpace: 'nowrap' }}>
                                                {v.routeId ? (
                                                    <>
                                                        <strong>{money(fareOf(r))}</strong>
                                                        {fareLabel(r) && <div style={{ fontSize: '11px', color: '#2e7d32' }}>{fareLabel(r)}</div>}
                                                        <button type="button" onClick={() => setPricing(r)} style={{ ...styles.linkBtn, fontSize: '12px' }}
                                                            title="Full term, some months, some days, or an agreed amount">
                                                            <Icon name="tag" style={{ marginRight: '3px' }} />Price
                                                        </button>
                                                    </>
                                                ) : <span style={{ color: '#bbb' }}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!shown.length && <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#888', padding: '24px' }}>No learners.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {pricing && (() => {
                        const v = valueOf(pricing);
                        const route = routeById(v.routeId);
                        const cur = v.price || (pricing.routeId && sameTrip(pricing, v)
                            ? { basis: pricing.basis, quantity: pricing.quantity, amount: pricing.amount, note: pricing.priceNote } : null);
                        return (
                            <PriceEditor
                                title={`Transport — ${pricing.name}`}
                                subtitle={`${route?.name || ''} (${DIRS.find(d => d.key === v.direction)?.label.toLowerCase() || ''}) · ${year} Term ${term}`}
                                rates={{ term: fareFor(route, v.direction), monthly: monthlyFor(route, v.direction), daily: dailyFor(route, v.direction) }}
                                current={cur}
                                saveLabel="Use this price"
                                onSave={async (p) => { setEdits(ed => ({ ...ed, [pricing.studentId]: { ...valueOf(pricing), price: p } })); return true; }}
                                onClose={() => setPricing(null)} />
                        );
                    })()}
                    <div style={styles.saveBar}>
                        <span style={{ fontSize: '13px' }}>{dirty ? <><strong>{changed.length}</strong> unsaved change(s) — prices are charged when you Save</> : 'No unsaved changes'}</span>
                        <button onClick={save} disabled={!dirty || saving} style={{ ...styles.primaryBtn, opacity: !dirty || saving ? 0.55 : 1 }}>
                            <Icon name={saving ? 'hourglass-split' : 'save-fill'} />{saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ══ Bus lists (for drivers) ════════════════════════════════════════════════
const BusListsTab = ({ termOptions, defaultTerm, routes, vehicles, setError }) => {
    const [termKey, setTermKey] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => { if (!termKey && defaultTerm) setTermKey(defaultTerm); }, [defaultTerm]);
    const [year, term] = termKey.split('|');

    useEffect(() => {
        if (!termKey) return;
        setLoading(true);
        api.get('/api/transport/term', { params: { yearLabel: year, term } })
            .then(r => setRows((r.data.learners || []).filter(l => l.routeId)))
            .catch(err => setError(serverMessage(err, 'Failed to load bus lists.')))
            .finally(() => setLoading(false));
    }, [termKey]);

    // Group: bus → destination → learners
    const groups = [...vehicles.map(v => ({ key: String(v.vehicleId), vehicle: v })), { key: '', vehicle: null }]
        .map(g => {
            const riders = rows.filter(r => String(r.vehicleId ?? '') === g.key);
            const byRoute = {};
            riders.forEach(r => { (byRoute[r.routeName] = byRoute[r.routeName] || []).push(r); });
            return { ...g, riders, byRoute: Object.entries(byRoute).sort(([a], [b]) => a.localeCompare(b)) };
        })
        .filter(g => g.riders.length > 0);

    const print = (g) => {
        const title = g.vehicle ? `Bus List — ${busLabel(g.vehicle)}` : 'Riders without a bus';
        const body = `
            ${g.vehicle ? `<p><b>Driver:</b> ${esc(g.vehicle.driverName || '________________')} &nbsp; <b>Phone:</b> ${esc(g.vehicle.driverPhone || '____________')} &nbsp; <b>Capacity:</b> ${esc(g.vehicle.capacity ?? '-')} &nbsp; <b>Riders:</b> ${g.riders.length}</p>` : ''}
            ${g.byRoute.map(([route, list]) => `
                <h4 style="margin:14px 0 4px;color:#1F3864">${esc(route)} (${list.length})</h4>
                <table><thead><tr><th>#</th><th>Learner</th><th>Class</th><th>Trips</th><th style="width:22%">Picked by / notes</th></tr></thead><tbody>
                ${list.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td><td>${esc(dirLabel(r.direction))}</td><td></td></tr>`).join('')}
                </tbody></table>`).join('')}`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
            body{font-family:'Times New Roman',serif;font-size:12px;padding:15px;color:#000}table{width:100%;border-collapse:collapse}
            th{background:#1F3864;color:#fff;padding:5px;text-align:left}td{border:1px solid #bbb;padding:5px 6px}
            .h{text-align:center;border-bottom:3px solid #1F3864;margin-bottom:10px;padding-bottom:6px}
            .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:12px;display:flex;justify-content:space-between}
            @media print{.bar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}}</style></head><body>
            <div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()" style="background:#FFD700;border:none;padding:5px 14px;border-radius:4px;font-weight:bold;cursor:pointer">Print / Save PDF</button></div>
            <div class="h">${letterheadHtml({ logoSize: 45 })}
            <div style="font-weight:bold;margin-top:4px">${esc(title.toUpperCase())}</div><div>${esc(year)} Term ${esc(term)}</div></div>${body}
            <p style="text-align:center;font-size:9px;color:#888;margin-top:12px">Printed ${esc(new Date().toLocaleDateString('en-GB'))}</p></body></html>`;
        const win = window.open('', '_blank');
        if (!win) { setError('Your browser blocked the print window. Allow pop-ups for this site, then try again.'); return; }
        win.document.write(html); win.document.close(); win.focus();
    };

    return (
        <div>
            <div style={styles.bar}>
                <label style={styles.check}>Term
                    <select style={styles.select} value={termKey} onChange={e => setTermKey(e.target.value)}>
                        {termOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>
                <span style={{ fontSize: '12px', color: '#666' }}>{rows.length} rider(s) this term · {routes.length} destinations</span>
            </div>
            {loading ? <p style={styles.centerMsg}><Icon name="hourglass-split" />Loading…</p> : !groups.length ? (
                <div style={styles.panel}><p style={{ margin: 0, color: '#666' }}>No riders for this term yet. Add them on the Riders tab.</p></div>
            ) : (
                <div style={styles.busGrid}>
                    {groups.map(g => {
                        const over = g.vehicle?.capacity && g.riders.length > g.vehicle.capacity;
                        return (
                            <div key={g.key || 'none'} style={{ ...styles.panel, borderTop: `4px solid ${g.vehicle ? '#1F3864' : '#ffc107'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div>
                                        <strong style={{ color: '#1F3864', fontSize: '15px' }}><Icon name={g.vehicle ? 'bus-front-fill' : 'question-circle-fill'} />{g.vehicle ? busLabel(g.vehicle) : 'No bus assigned'}</strong>
                                        {g.vehicle && <div style={styles.adm}>{g.vehicle.driverName || 'No driver set'}{g.vehicle.driverPhone ? ` · ${g.vehicle.driverPhone}` : ''}</div>}
                                    </div>
                                    <button onClick={() => print(g)} style={styles.secondaryBtn}><Icon name="printer-fill" />Print</button>
                                </div>
                                <p style={{ fontSize: '13px', margin: '8px 0', color: over ? '#b02a37' : '#333', fontWeight: over ? 700 : 400 }}>
                                    {g.riders.length} rider(s){g.vehicle?.capacity ? ` of ${g.vehicle.capacity} seats` : ''}{over ? ' — over capacity!' : ''}
                                </p>
                                {g.byRoute.map(([route, list]) => (
                                    <div key={route} style={{ marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#555', textTransform: 'uppercase' }}>{route} ({list.length})</div>
                                        <div style={{ fontSize: '13px', color: '#333' }}>{list.map(r => `${r.name}${r.direction === 'ONE_WAY' ? ' (one way)' : ''}`).join(', ')}</div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ══ Destinations & fares ═══════════════════════════════════════════════════
const RoutesTab = ({ routes, reload, setError, flashSuccess }) => {
    const [drafts, setDrafts] = useState({});
    const [adding, setAdding] = useState(null);
    const fields = [['oneWayMonthly', 'One way / month'], ['oneWayTermly', 'One way / term'], ['twoWayMonthly', 'Two ways / month'], ['twoWayTermly', 'Two ways / term']];
    // Optional: for learners who ride only some days (empty = not offered)
    const optFields = [['oneWayDaily', 'One way / day'], ['twoWayDaily', 'Two ways / day']];
    const allFields = [...fields, ...optFields];
    const optStr = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));
    const draftOf = (r) => drafts[r.routeId] || { ...r, ...Object.fromEntries(fields.map(([k]) => [k, String(Number(r[k]))])), ...Object.fromEntries(optFields.map(([k]) => [k, optStr(r[k])])) };
    const setD = (r, patch) => setDrafts(d => ({ ...d, [r.routeId]: { ...draftOf(r), ...patch } }));
    const isDirty = (r) => { const d = drafts[r.routeId]; return d && (d.name !== r.name || d.active !== r.active || fields.some(([k]) => Number(d[k]) !== Number(r[k])) || optFields.some(([k]) => optStr(d[k]) !== optStr(r[k]))); };

    // Fill the other three fares from "one way / month" (termly = x3, two ways = x2)
    const autofill = (d) => { const m = Number(d.oneWayMonthly) || 0; return { ...d, oneWayTermly: String(m * 3), twoWayMonthly: String(m * 2), twoWayTermly: String(m * 6) }; };

    const save = async (d) => {
        if (!d.name?.trim()) { setError('Give the destination a name.'); return false; }
        const bad = fields.find(([k]) => !isAmount(d[k]));
        if (bad) { setError(`${d.name}: "${bad[1]}" must be a valid amount.`); return false; }
        const badOpt = optFields.find(([k]) => String(d[k] ?? '').trim() !== '' && !isAmount(d[k]));
        if (badOpt) { setError(`${d.name}: "${badOpt[1]}" must be a valid amount, or left empty.`); return false; }
        try {
            const r = await api.put('/api/transport/routes', { routeId: d.routeId || null, name: d.name.trim(), active: d.active !== false,
                ...Object.fromEntries(fields.map(([k]) => [k, String(d[k]).trim()])),
                ...Object.fromEntries(optFields.map(([k]) => [k, String(d[k] ?? '').trim() === '' ? null : String(d[k]).trim()])) });
            flashSuccess(r.data.message);
            setDrafts(x => { const n = { ...x }; delete n[d.routeId]; return n; });
            await reload();
            return true;
        } catch (err) { setError(serverMessage(err, 'Failed to save the destination.')); return false; }
    };

    return (
        <div style={styles.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#555' }}>Learners are charged the <strong>termly</strong> fare unless you set a different price on the Riders tab (months use the monthly fare; days use the daily fare, if set). Changing a fare doesn't change what learners were already charged.</span>
                <button onClick={() => setAdding({ name: '', oneWayMonthly: '', oneWayTermly: '', twoWayMonthly: '', twoWayTermly: '', oneWayDaily: '', twoWayDaily: '', active: true })} style={styles.secondaryBtn}><Icon name="plus-circle" />Add destination</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ ...styles.table, minWidth: '1150px' }}>
                    <thead><tr>
                        <th style={styles.th}>Destination</th>
                        {allFields.map(([k, l]) => <th key={k} style={styles.thNum}>{l}</th>)}
                        <th style={styles.th}>Active</th><th style={styles.th}></th>
                    </tr></thead>
                    <tbody>
                        {adding && (
                            <tr style={{ backgroundColor: '#fff8e1' }}>
                                <td style={styles.td}><input style={styles.cellInput} value={adding.name} placeholder="e.g. Savannah" onChange={e => setAdding({ ...adding, name: e.target.value })} /></td>
                                {allFields.map(([k]) => <td key={k} style={styles.td}><input style={{ ...styles.cellInput, textAlign: 'right' }} inputMode="decimal" value={adding[k]} onChange={e => setAdding({ ...adding, [k]: e.target.value.replace(/[^\d.]/g, '') })} /></td>)}
                                <td style={styles.td}></td>
                                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                    <button onClick={() => setAdding(autofill(adding))} style={styles.linkBtn} title="Fill termly and two-way fares from one way / month">Auto-fill</button>{' '}
                                    <button onClick={async () => { if (await save(adding)) setAdding(null); }} style={styles.smallBtn}>Save</button>
                                    <button onClick={() => setAdding(null)} style={{ ...styles.smallBtn, backgroundColor: '#6c757d' }}>Cancel</button>
                                </td>
                            </tr>
                        )}
                        {routes.map((r, i) => {
                            const d = draftOf(r);
                            const dirty = isDirty(r);
                            return (
                                <tr key={r.routeId} style={{ backgroundColor: dirty ? '#fff8e1' : i % 2 ? 'white' : '#fafafa', opacity: d.active ? 1 : 0.6 }}>
                                    <td style={styles.td}><input style={styles.cellInput} value={d.name} maxLength={60} onChange={e => setD(r, { name: e.target.value })} /></td>
                                    {allFields.map(([k]) => <td key={k} style={styles.td}><input style={{ ...styles.cellInput, textAlign: 'right' }} inputMode="decimal" value={d[k]} onChange={e => setD(r, { [k]: e.target.value.replace(/[^\d.]/g, '') })} /></td>)}
                                    <td style={styles.td}><input type="checkbox" checked={!!d.active} onChange={e => setD(r, { active: e.target.checked })} aria-label="Active" /></td>
                                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                        {dirty && <>
                                            <button onClick={() => save(d)} style={styles.smallBtn}>Save</button>
                                            <button onClick={() => setDrafts(x => { const n = { ...x }; delete n[r.routeId]; return n; })} style={{ ...styles.smallBtn, backgroundColor: '#6c757d' }}>Undo</button>
                                        </>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ══ Fleet ══════════════════════════════════════════════════════════════════
const FleetTab = ({ vehicles, reload, setError, flashSuccess }) => {
    const empty = { vehicleId: null, registration: '', name: '', capacity: '', driverName: '', driverPhone: '', active: true };
    const [form, setForm] = useState(null);
    const save = async (e) => {
        e.preventDefault();
        if (form.registration.trim().length < 4) { setError('Enter the registration number, e.g. KDA 123X.'); return; }
        if (form.capacity !== '' && form.capacity !== null && !(Number(form.capacity) >= 1 && Number(form.capacity) <= 100)) { setError('Capacity must be between 1 and 100.'); return; }
        try {
            const r = await api.put('/api/transport/vehicles', { ...form, capacity: form.capacity === '' || form.capacity === null ? null : Number(form.capacity) });
            flashSuccess(r.data.message); setForm(null); reload();
        } catch (err) { setError(serverMessage(err, 'Failed to save the vehicle.')); }
    };
    return (
        <div>
            {form ? (
                <form onSubmit={save} style={styles.panel}>
                    <h3 style={styles.h3}><Icon name={form.vehicleId ? 'pencil-fill' : 'plus-circle'} />{form.vehicleId ? 'Edit vehicle' : 'Add vehicle'}</h3>
                    <div style={styles.formGrid}>
                        <label style={styles.field}>Registration<input style={{ ...styles.input, textTransform: 'uppercase' }} value={form.registration} maxLength={15} placeholder="KDA 123X" onChange={e => setForm({ ...form, registration: e.target.value })} /></label>
                        <label style={styles.field}>Name (optional)<input style={styles.input} value={form.name || ''} maxLength={40} placeholder="Bus 1" onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                        <label style={styles.field}>Seats<input style={styles.input} inputMode="numeric" value={form.capacity ?? ''} onChange={e => setForm({ ...form, capacity: e.target.value.replace(/\D/g, '') })} /></label>
                        <label style={styles.field}>Driver<input style={styles.input} value={form.driverName || ''} maxLength={80} onChange={e => setForm({ ...form, driverName: e.target.value })} /></label>
                        <label style={styles.field}>Driver's phone<input style={styles.input} inputMode="tel" value={form.driverPhone || ''} maxLength={20} onChange={e => setForm({ ...form, driverPhone: e.target.value })} /></label>
                    </div>
                    {form.vehicleId && <label style={{ ...styles.check, marginBottom: '12px' }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> In service</label>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" style={styles.primaryBtn}><Icon name="save-fill" />Save</button>
                        <button type="button" onClick={() => setForm(null)} style={styles.secondaryBtn}>Cancel</button>
                    </div>
                </form>
            ) : (
                <div style={{ marginBottom: '12px' }}><button onClick={() => setForm({ ...empty })} style={styles.secondaryBtn}><Icon name="plus-circle" />Add vehicle</button></div>
            )}
            {!vehicles.length ? <div style={styles.panel}><p style={{ margin: 0, color: '#666' }}>No vehicles yet. Add your school buses so riders can be put on a bus.</p></div> : (
                <div style={styles.busGrid}>
                    {vehicles.map(v => (
                        <div key={v.vehicleId} style={{ ...styles.panel, opacity: v.active ? 1 : 0.6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                <strong style={{ color: '#1F3864', fontSize: '15px' }}><Icon name="bus-front-fill" />{busLabel(v)}</strong>
                                <button onClick={() => setForm({ ...empty, ...v, capacity: v.capacity ?? '' })} style={styles.linkBtn}>Edit</button>
                            </div>
                            <div style={{ fontSize: '13px', color: '#444', marginTop: '6px', lineHeight: 1.7 }}>
                                <div><Icon name="people" />{v.capacity ? `${v.capacity} seats` : 'Seats not set'}</div>
                                <div><Icon name="person-badge" />{v.driverName || 'No driver set'}</div>
                                {v.driverPhone && <div><Icon name="telephone" />{v.driverPhone}</div>}
                                {!v.active && <div style={{ color: '#b02a37', fontWeight: 700 }}>Out of service</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' },
    layoutRow: { display: 'flex', flex: 1 },
    content: { padding: '30px', flex: 1, minWidth: 0 },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800 },
    subtitle: { color: '#666', margin: '0 0 18px 0', fontSize: '14px' },
    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ffd6d6', display: 'flex', alignItems: 'center' },
    dismissBtn: { marginLeft: '8px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' },
    success: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '15px', border: '1px solid #c3e6cb' },
    tabs: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
    tab: { border: '2px solid #1F3864', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center' },
    bar: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'white', padding: '12px 16px', borderRadius: '12px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    select: { padding: '9px 10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white' },
    searchBox: { display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0 12px', backgroundColor: 'white' },
    searchInput: { flex: 1, minWidth: 0, padding: '10px 0', border: 'none', outline: 'none', fontSize: '16px', backgroundColor: 'transparent' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' },
    card: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', borderTop: '4px solid', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    cardNum: { fontSize: '18px', fontWeight: 800, color: '#1F3864' },
    cardLbl: { fontSize: '12px', color: '#666', marginTop: '2px' },
    centerMsg: { textAlign: 'center', padding: '40px', color: '#666' },
    panel: { backgroundColor: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '14px' },
    h3: { color: '#1F3864', fontSize: '15px', margin: '0 0 10px 0', display: 'flex', alignItems: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' },
    thNum: { backgroundColor: '#1F3864', color: 'white', padding: '10px 12px', textAlign: 'right', fontSize: '12px', whiteSpace: 'nowrap' },
    td: { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' },
    tdNum: { padding: '8px 10px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
    adm: { fontSize: '11px', color: '#888', fontFamily: 'monospace' },
    changedTag: { display: 'inline-block', marginTop: '3px', backgroundColor: '#fff3cd', color: '#856404', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' },
    cellSelect: { width: '100%', minWidth: '130px', padding: '7px 8px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px', backgroundColor: 'white' },
    cellInput: { width: '100%', minWidth: '90px', padding: '7px 8px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '14px', backgroundColor: 'white', boxSizing: 'border-box' },
    saveBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '2px solid #f0f2f5', marginTop: '10px', paddingTop: '12px' },
    primaryBtn: { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '11px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'inline-flex', alignItems: 'center' },
    secondaryBtn: { backgroundColor: 'white', color: '#1F3864', border: '2px solid #1F3864', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'inline-flex', alignItems: 'center' },
    smallBtn: { backgroundColor: '#2E75B6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', marginLeft: '5px' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', padding: 0 },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '10px', borderRadius: '8px', border: '1.5px solid #ddd', fontSize: '16px', backgroundColor: 'white', minWidth: 0 },
    busGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
};

export default Transport;
