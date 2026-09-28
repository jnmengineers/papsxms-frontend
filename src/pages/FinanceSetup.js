import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { SECTION_NAMES_LIVE } from '../utils/schoolData';

/**
 * Finance → Setup → Money groups
 *   • the groups (Tuition & Fees, Meals, Transport, Trips…) in PAYMENT ORDER — a learner's payment
 *     clears the oldest term first, then these groups top to bottom
 *   • which group takes school fees (and anything unassigned), and which takes transport fares
 *   • which group each fee item and each extra charge belongs to
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function MoneyGroupsTab({ setError, flashSuccess }) {
    const [data, setData] = useState(null);
    const [groups, setGroups] = useState([]);
    const [items, setItems] = useState({});      // itemName -> groupId|''
    const [charges, setCharges] = useState({});  // chargeId -> groupId|''
    const [saving, setSaving] = useState('');

    const load = useCallback(async () => {
        try {
            const r = await api.get('/api/finance/groups');
            // "Explicitly the fees group" and "no group" mean the same thing — show both as the fees group
            const feesId = r.data.groups.find(g => g.feesDefault)?.groupId;
            const norm = (id) => (id === null || id === undefined || id === feesId ? '' : id);
            const d = { ...r.data, feeItems: r.data.feeItems.map(i => ({ ...i, groupId: norm(i.groupId) })), charges: r.data.charges.map(c => ({ ...c, groupId: norm(c.groupId) })) };
            setData(d);
            setGroups(d.groups.map(g => ({ ...g })));
            setItems(Object.fromEntries(d.feeItems.map(i => [i.itemName, i.groupId])));
            setCharges(Object.fromEntries(d.charges.map(c => [c.chargeId, c.groupId])));
        } catch (err) { setError(serverMessage(err, 'Failed to load money groups.')); }
    }, [setError]);
    useEffect(() => { load(); }, [load]);

    if (!data) return <p style={st.center}><Icon name="hourglass-split" />Loading…</p>;

    const groupsDirty = !sameJson(groups.map(g => [g.groupId, g.name, g.color, g.active, g.feesDefault, g.transport]),
        data.groups.map(g => [g.groupId, g.name, g.color, g.active, g.feesDefault, g.transport]));
    const itemsDirty = data.feeItems.some(i => String(items[i.itemName] ?? '') !== String(i.groupId ?? ''));
    const chargesDirty = data.charges.some(c => String(charges[c.chargeId] ?? '') !== String(c.groupId ?? ''));
    const activeGroups = groups.filter(g => g.active && g.groupId);
    const feesGroup = groups.find(g => g.feesDefault);

    const setG = (i, patch) => setGroups(gs => gs.map((g, k) => (k === i ? { ...g, ...patch } : g)));
    const move = (i, d) => setGroups(gs => { const n = [...gs]; const j = i + d; if (j < 0 || j >= n.length) return gs; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const onlyOne = (i, field) => setGroups(gs => gs.map((g, k) => ({ ...g, [field]: k === i })));
    const addGroup = () => setGroups(gs => [...gs, { groupId: null, name: '', color: '#6c757d', active: true, feesDefault: false, transport: false }]);

    const run = async (key, fn, msg) => {
        setSaving(key); setError('');
        try { const r = await fn(); flashSuccess(r.data?.message || msg); await load(); }
        catch (err) { setError(serverMessage(err, 'Failed to save.')); }
        setSaving('');
    };
    const saveGroups = () => {
        if (groups.some(g => !g.name.trim())) { setError('Every group needs a name.'); return; }
        run('groups', () => api.put('/api/finance/groups', groups.map(g => ({ groupId: g.groupId, name: g.name.trim(), color: g.color, active: g.active, feesDefault: g.feesDefault, transport: g.transport }))));
    };
    const saveItems = () => run('items', () => api.put('/api/finance/groups/items',
        data.feeItems.filter(i => String(items[i.itemName] ?? '') !== String(i.groupId ?? '')).map(i => ({ itemName: i.itemName, groupId: items[i.itemName] ? Number(items[i.itemName]) : null }))));
    const saveCharges = () => run('charges', () => api.put('/api/finance/groups/charges',
        data.charges.filter(c => String(charges[c.chargeId] ?? '') !== String(c.groupId ?? '')).map(c => ({ chargeId: c.chargeId, groupId: charges[c.chargeId] ? Number(charges[c.chargeId]) : null }))));

    const groupSelect = (value, onChange, label) => (
        <select style={st.select} value={value ?? ''} onChange={e => onChange(e.target.value)} aria-label={label}>
            <option value="">{feesGroup ? `${feesGroup.name} (fees group)` : 'Fees group'}</option>
            {activeGroups.filter(g => !g.feesDefault).map(g => <option key={g.groupId} value={String(g.groupId)}>{g.name}</option>)}
        </select>
    );

    return (
        <div>
            {/* ── groups ── */}
            <div style={st.panel}>
                <h3 style={st.h3}><Icon name="collection-fill" />Money groups</h3>
                <p style={st.help}>
                    Every charge and every expense belongs to a group, so each group's money in and money out can be compared.
                    <strong> The order is the payment order:</strong> a learner's payment clears the oldest term first and, within a term, the groups from top to bottom.
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead><tr>
                            <th style={st.th}>Paid</th><th style={st.th}>Group</th><th style={st.th}>Colour</th>
                            <th style={{ ...st.th, textAlign: 'center' }} title="School fee items and anything not given a group">School fees</th>
                            <th style={{ ...st.th, textAlign: 'center' }}>Transport fares</th>
                            <th style={{ ...st.th, textAlign: 'center' }}>In use</th>
                        </tr></thead>
                        <tbody>
                            {groups.map((g, i) => (
                                <tr key={g.groupId ?? `new${i}`} style={{ opacity: g.active ? 1 : 0.55, backgroundColor: i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                                        <strong style={{ display: 'inline-block', width: '22px' }}>{i + 1}</strong>
                                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={st.arrow} aria-label="Move up">↑</button>
                                        <button type="button" onClick={() => move(i, 1)} disabled={i === groups.length - 1} style={st.arrow} aria-label="Move down">↓</button>
                                    </td>
                                    <td style={st.td}><input style={st.input} value={g.name} maxLength={60} placeholder="e.g. Swimming" onChange={e => setG(i, { name: e.target.value })} /></td>
                                    <td style={st.td}><input type="color" value={g.color} onChange={e => setG(i, { color: e.target.value })} style={st.color} aria-label="Colour" /></td>
                                    <td style={{ ...st.td, textAlign: 'center' }}><input type="radio" name="feesDefault" checked={!!g.feesDefault} onChange={() => onlyOne(i, 'feesDefault')} aria-label="School fees group" /></td>
                                    <td style={{ ...st.td, textAlign: 'center' }}><input type="radio" name="transport" checked={!!g.transport} onChange={() => onlyOne(i, 'transport')} aria-label="Transport group" /></td>
                                    <td style={{ ...st.td, textAlign: 'center' }}><input type="checkbox" checked={!!g.active} onChange={e => setG(i, { active: e.target.checked })} aria-label="In use" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={st.foot}>
                    <button type="button" onClick={addGroup} style={st.linkBtn}><Icon name="plus-circle" />Add a group</button>
                    <span style={{ fontSize: '12px', color: '#777' }}>Groups can't be deleted (past records use them); untick "In use" instead.</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        {groupsDirty && <button type="button" onClick={() => setGroups(data.groups.map(g => ({ ...g })))} style={st.secondary}>Undo</button>}
                        <button type="button" onClick={saveGroups} disabled={!groupsDirty || !!saving} style={{ ...st.primary, opacity: groupsDirty && !saving ? 1 : 0.5 }}>
                            <Icon name={saving === 'groups' ? 'hourglass-split' : 'save-fill'} />Save groups
                        </button>
                    </span>
                </div>
            </div>

            {groupsDirty && <p style={st.warn}><Icon name="info-circle-fill" />Save the groups first, then assign items and charges below.</p>}

            <div style={st.two}>
                {/* ── fee items ── */}
                <div style={st.panel}>
                    <h3 style={st.h3}><Icon name="tags-fill" />School fee items</h3>
                    <p style={st.help}>Items from the fee structures. Anything left on the fees group stays there.</p>
                    {data.feeItems.length === 0 ? <p style={st.muted}>No fee items yet.</p> : data.feeItems.map(i => (
                        <div key={i.itemName} style={{ ...st.row, backgroundColor: String(items[i.itemName] ?? '') !== String(i.groupId ?? '') ? '#fff8e1' : undefined }}>
                            <span style={{ flex: 1 }}>{i.itemName}</span>
                            {groupSelect(items[i.itemName], v => setItems(x => ({ ...x, [i.itemName]: v })), `Group for ${i.itemName}`)}
                        </div>
                    ))}
                    <div style={st.foot}>
                        <button type="button" onClick={saveItems} disabled={!itemsDirty || groupsDirty || !!saving} style={{ ...st.primary, marginLeft: 'auto', opacity: itemsDirty && !groupsDirty && !saving ? 1 : 0.5 }}>
                            <Icon name={saving === 'items' ? 'hourglass-split' : 'save-fill'} />Save fee items
                        </button>
                    </div>
                </div>

                {/* ── extra charges ── */}
                <div style={st.panel}>
                    <h3 style={st.h3}><Icon name="check2-square" />Extra charges</h3>
                    <p style={st.help}>Lunch and Porridge → Meals, each trip → Trips, and so on.</p>
                    {data.charges.length === 0 ? <p style={st.muted}>No extra charges yet.</p> : data.charges.map(c => (
                        <div key={c.chargeId} style={{ ...st.row, opacity: c.active ? 1 : 0.55, backgroundColor: String(charges[c.chargeId] ?? '') !== String(c.groupId ?? '') ? '#fff8e1' : undefined }}>
                            <span style={{ flex: 1 }}>{c.name}<span style={st.small}>{(c.sections || []).map(x => SECTION_NAMES_LIVE[x] || x).join(', ')}{!c.active ? ' · switched off' : ''}</span></span>
                            {groupSelect(charges[c.chargeId], v => setCharges(x => ({ ...x, [c.chargeId]: v })), `Group for ${c.name}`)}
                        </div>
                    ))}
                    <div style={st.foot}>
                        <button type="button" onClick={saveCharges} disabled={!chargesDirty || groupsDirty || !!saving} style={{ ...st.primary, marginLeft: 'auto', opacity: chargesDirty && !groupsDirty && !saving ? 1 : 0.5 }}>
                            <Icon name={saving === 'charges' ? 'hourglass-split' : 'save-fill'} />Save extra charges
                        </button>
                    </div>
                </div>
            </div>
            <p style={st.muted}>Transport fares always go to the group ticked "Transport fares". Changes apply to reports straight away, including past terms.</p>
        </div>
    );
}

const st = {
    center: { textAlign: 'center', color: '#666', padding: '20px' },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px', minWidth: 0 },
    two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' },
    h3: { color: '#1F3864', margin: '0 0 6px', fontSize: '16px' },
    help: { fontSize: '13px', color: '#555', margin: '0 0 10px' },
    muted: { fontSize: '12px', color: '#888' },
    warn: { backgroundColor: '#fff3cd', color: '#856404', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '560px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '8px', textAlign: 'left', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px' },
    input: { padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', width: '100%', minWidth: '160px' },
    color: { width: '42px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' },
    arrow: { border: '1px solid #ccc', background: 'white', borderRadius: '4px', cursor: 'pointer', padding: '1px 7px', marginLeft: '3px' },
    select: { padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white', maxWidth: '210px' },
    row: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
    small: { display: 'block', fontSize: '11px', color: '#888' },
    foot: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '10px' },
    linkBtn: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: 0 },
    primary: { padding: '8px 14px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
};
