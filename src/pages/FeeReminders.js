import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { classDisplayName, compareClasses } from '../utils/classUtils';
import { prettyPhone } from './Parents';
import { hasRole } from '../utils/roles';

/**
 * Finance → Fee Reminders: one message per family (a parent with each owing child and balance).
 * Send by WhatsApp (one tap per family) or download a CSV for a bulk-SMS service; then mark the
 * families as reminded so the date is kept.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const kes = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
/** wa.me needs the number without "+" (e.g. 254712345678). */
export const whatsappLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export default function FeeRemindersTab({ setError, flashSuccess }) {
    const [classes, setClasses] = useState([]);
    const [classId, setClassId] = useState('');
    const [min, setMin] = useState('');
    const [data, setData] = useState(null);
    const [ticked, setTicked] = useState(new Set());
    const [channel, setChannel] = useState('WHATSAPP');
    const [edit, setEdit] = useState(null);           // { template, minBalance }
    const [smsResult, setSmsResult] = useState(null);
    const [showSms, setShowSms] = useState(false);
    const [sending, setSending] = useState(false);
    const load = useCallback(() => {
        setData(null);
        api.get('/api/reminders', { params: { classId: classId || undefined, minBalance: min === '' ? undefined : min } })
            .then(r => { setData(r.data); setTicked(new Set()); if (min === '') setMin(String(Number(r.data.minBalance))); })
            .catch(err => setError(serverMessage(err, 'Could not load the reminders.')));
    }, [classId, min, setError]);  // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { api.get('/api/classes').then(r => setClasses([...(r.data || [])].sort(compareClasses))).catch(() => {}); }, []);
    useEffect(() => { load(); }, [classId]);  // eslint-disable-line react-hooks/exhaustive-deps

    const fams = data?.families || [];
    const chosen = fams.filter(f => ticked.has(f.guardianId));
    const toggle = (id) => setTicked(t => { const n = new Set(t); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const copy = async (text) => { try { await navigator.clipboard.writeText(text); flashSuccess('Message copied.'); } catch (e) { window.prompt('Copy the message:', text); } };
    const csv = () => {
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = chosen.map(f => [f.phone.replace('+', ''), f.message, f.parent, f.total].map(q).join(','));
        const blob = new Blob(['\uFEFF' + [['Phone', 'Message', 'Parent', 'Total owed'].map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Fee reminders ${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const markSent = async (list, ch) => {
        try {
            const r = await api.post('/api/reminders/sent', { channel: ch, families: list.map(f => ({ guardianId: f.guardianId, children: f.children.map(c => ({ studentId: c.studentId, balance: c.balance })) })) });
            flashSuccess(r.data.message); load();
        } catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    const sendSms = async () => {
        if (!window.confirm(`Send the reminder SMS to ${chosen.length} famil${chosen.length === 1 ? 'y' : 'ies'}?\n\nEach SMS is charged by the provider (unless the account is in sandbox/test mode). Families whose SMS goes through are marked as reminded.`)) return;
        setSending(true); setSmsResult(null);
        try {
            const r = await api.post('/api/reminders/send-sms', { guardianIds: chosen.map(f => f.guardianId), classId: classId || null, minBalance: min === '' ? null : min });
            setSmsResult(r.data); flashSuccess(r.data.message); load();
        } catch (err) { setError(serverMessage(err, 'Could not send the SMS.')); }
        setSending(false);
    };

    const saveSettings = async () => {
        try { const r = await api.put('/api/reminders/settings', edit); flashSuccess(r.data.message); setEdit(null); setMin(String(edit.minBalance)); load(); }
        catch (err) { setError(serverMessage(err, 'Could not save the message.')); }
    };

    return (
        <div>
            <div style={st.panel}>
                <div style={st.bar}>
                    <select style={st.input} value={classId} onChange={e => setClassId(e.target.value)} aria-label="Class"><option value="">All classes</option>{classes.map(c => <option key={c.classId} value={c.classId}>{classDisplayName(c)}</option>)}</select>
                    <label style={{ ...st.check, fontWeight: 600 }}>Balance at least KES<input style={{ ...st.input, width: '100px' }} inputMode="decimal" value={min} onChange={e => setMin(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Smallest balance" /></label>
                    <button type="button" onClick={load} style={st.secondary}><Icon name="arrow-clockwise" />Show</button>
                    <button type="button" onClick={() => setEdit({ template: data?.template || '', minBalance: Number(data?.minBalance || 0) })} style={{ ...st.link, marginLeft: 'auto' }}><Icon name="pencil-square" />Edit the message</button>
                    {hasRole('ADMIN') && <button type="button" onClick={() => setShowSms(x => !x)} style={st.link}><Icon name="gear" />SMS settings</button>}
                </div>
                {edit && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                        <label style={st.lbl}>Message (placeholders: <code>{'{parent}'}</code> first name, <code>{'{children}'}</code> each child, class and balance, <code>{'{total}'}</code>)
                            <textarea style={{ ...st.input, minHeight: '90px', fontFamily: 'inherit' }} maxLength={1000} value={edit.template} onChange={e => setEdit(x => ({ ...x, template: e.target.value }))} /></label>
                        <div style={{ ...st.bar, marginTop: '8px' }}>
                            <label style={st.check}>Default smallest balance KES<input style={{ ...st.input, width: '100px' }} inputMode="decimal" value={edit.minBalance} onChange={e => setEdit(x => ({ ...x, minBalance: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
                            <span style={st.muted}>{edit.template.length}/1000 characters (an SMS is about 160)</span>
                            <button type="button" onClick={() => setEdit(null)} style={{ ...st.secondary, marginLeft: 'auto' }}>Cancel</button>
                            <button type="button" onClick={saveSettings} style={st.primary}><Icon name="save-fill" />Save message</button>
                        </div>
                    </div>
                )}
            </div>

            {showSms && <SmsSettings setError={setError} flashSuccess={flashSuccess} onSaved={load} />}
            {smsResult && (
                <div style={st.panel}>
                    <h4 style={{ margin: '0 0 6px', color: '#1F3864', fontSize: '14px' }}><Icon name="send-check" />{smsResult.message}</h4>
                    {smsResult.results.map(x => <div key={x.guardianId} style={{ fontSize: '13px', color: x.ok ? '#1e7e34' : '#b02a37' }}>{x.ok ? '✓' : '✗'} {x.parent} {prettyPhone(x.phone)} — {x.ok ? `sent${x.cost ? ` (${x.cost})` : ''}` : x.error}</div>)}
                    <button type="button" onClick={() => setSmsResult(null)} style={st.link}>Close</button>
                </div>
            )}
            {!data ? <p style={st.muted}>Loading…</p> : (
                <>
                    <div style={{ ...st.panel, ...st.bar }}>
                        <b style={{ color: '#1F3864' }}>{fams.length} famil{fams.length === 1 ? 'y' : 'ies'} · {kes(data.totalOwed)} owed</b>
                        <button type="button" onClick={() => setTicked(ticked.size === fams.length ? new Set() : new Set(fams.map(f => f.guardianId)))} style={st.link}>{ticked.size === fams.length && fams.length ? 'Clear all' : 'Select all'}</button>
                        <span style={{ marginLeft: 'auto' }} />
                        {data.smsReady && <button type="button" disabled={!chosen.length || sending} onClick={sendSms} style={{ ...st.primary, backgroundColor: '#0f766e', opacity: chosen.length && !sending ? 1 : 0.5 }}><Icon name={sending ? 'hourglass-split' : 'send-fill'} />{sending ? 'Sending…' : `Send SMS (${chosen.length})`}</button>}
                        <button type="button" disabled={!chosen.length} onClick={csv} style={{ ...st.secondary, opacity: chosen.length ? 1 : 0.5 }} title="Phone and message for a bulk-SMS service"><Icon name="file-earmark-spreadsheet" />CSV for SMS ({chosen.length})</button>
                        <select style={st.input} value={channel} onChange={e => setChannel(e.target.value)} aria-label="Sent by"><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="CALL">Phone call</option><option value="OTHER">Other</option></select>
                        <button type="button" disabled={!chosen.length} onClick={() => markSent(chosen, channel)} style={{ ...st.primary, opacity: chosen.length ? 1 : 0.5 }}><Icon name="check2-all" />Mark as reminded ({chosen.length})</button>
                    </div>
                    {fams.map(f => (
                        <div key={f.guardianId} style={{ ...st.panel, borderLeft: `4px solid ${ticked.has(f.guardianId) ? '#1F3864' : '#e3e8f0'}` }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <input type="checkbox" checked={ticked.has(f.guardianId)} onChange={() => toggle(f.guardianId)} aria-label={`Select ${f.parent}`} style={{ marginTop: '4px' }} />
                                <div style={{ flex: 1, minWidth: '220px' }}>
                                    <b>{f.parent}</b> <span style={st.muted}>{prettyPhone(f.phone)}</span>
                                    {f.lastReminded && <span style={{ ...st.pill, marginLeft: '8px' }}>last reminded {fmt(f.lastReminded)}</span>}
                                    {f.children.map(c => <div key={c.studentId} style={{ fontSize: '13px' }}>{c.name} <span style={st.small}>{c.className}</span> — <b>{kes(c.balance)}</b></div>)}
                                    <div style={st.message}>{f.message}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                    <b style={{ color: '#b02a37' }}>{kes(f.total)}</b>
                                    <a href={whatsappLink(f.phone, f.message)} target="_blank" rel="noreferrer" style={st.wa} onClick={() => setTimeout(() => { if (window.confirm(`Mark ${f.parent} as reminded by WhatsApp?`)) markSent([f], 'WHATSAPP'); }, 400)}><Icon name="whatsapp" />WhatsApp</a>
                                    <button type="button" onClick={() => copy(f.message)} style={st.link}><Icon name="clipboard" />Copy</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {!fams.length && <div style={st.panel}><p style={{ ...st.muted, margin: 0 }}>No family owes {kes(data.minBalance)} or more{classId ? ' in this class' : ''}.</p></div>}
                    {data.noParent.length > 0 && (
                        <div style={st.panel}>
                            <h4 style={{ color: '#8a6d00', margin: '0 0 6px', fontSize: '14px' }}><Icon name="exclamation-circle-fill" />Owing, but no parent recorded ({data.noParent.length})</h4>
                            <p style={{ ...st.muted, marginTop: 0 }}>Add their parents on <b>People → Parents</b> so they can be reminded.</p>
                            {data.noParent.map(s => <div key={s.studentId} style={{ fontSize: '13px' }}>{s.name} <span style={st.small}>{s.className} · {s.admissionNumber}</span> — {kes(s.balance)}</div>)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/** Admin: the Africa's Talking account. The API key is never shown again once saved. */
function SmsSettings({ setError, flashSuccess, onSaved }) {
    const [f, setF] = useState(null);
    const [saved, setSaved] = useState(null);
    const [testPhone, setTestPhone] = useState('');
    const [log, setLog] = useState(null);
    useEffect(() => { api.get('/api/sms/settings').then(r => { setSaved(r.data); setF({ username: r.data.username || '', apiKey: '', senderId: r.data.senderId || '', sandbox: r.data.sandbox, enabled: r.data.enabled }); }).catch(err => setError(serverMessage(err, 'Could not load the SMS settings.'))); }, [setError]);
    if (!f) return null;
    const save = async () => {
        try { const r = await api.put('/api/sms/settings', f); flashSuccess(r.data.message); const x = await api.get('/api/sms/settings'); setSaved(x.data); setF(v => ({ ...v, apiKey: '' })); onSaved(); }
        catch (err) { setError(serverMessage(err, 'Could not save.')); }
    };
    const test = async () => {
        try { const r = await api.post('/api/sms/test', { phone: testPhone }); (r.data.ok ? flashSuccess : setError)(r.data.message); }
        catch (err) { setError(serverMessage(err, 'The test failed.')); }
    };
    return (
        <div style={{ ...st.panel, borderLeft: '4px solid #0f766e' }}>
            <h4 style={{ margin: '0 0 6px', color: '#0f766e', fontSize: '14px' }}><Icon name="chat-dots-fill" />SMS settings — Africa's Talking</h4>
            <p style={{ ...st.muted, marginTop: 0 }}>Create an account at Africa's Talking, then enter the username and API key from its dashboard. Start in <b>sandbox</b> (free tests, not delivered to real phones); switch it off to send real messages, which are charged to the account. A sender ID (the name parents see) must be approved by the provider first.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                <label style={st.lbl}>Username<input style={st.input} maxLength={60} value={f.username} placeholder="sandbox" onChange={e => setF(v => ({ ...v, username: e.target.value }))} /></label>
                <label style={st.lbl}>API key<input style={st.input} type="password" autoComplete="new-password" value={f.apiKey} placeholder={saved?.keySaved ? `saved (ends …${saved.keyEnding}) — leave blank to keep` : 'paste the API key'} onChange={e => setF(v => ({ ...v, apiKey: e.target.value }))} /></label>
                <label style={st.lbl}>Sender ID (optional)<input style={st.input} maxLength={11} value={f.senderId} placeholder="e.g. PIPELINE" onChange={e => setF(v => ({ ...v, senderId: e.target.value }))} /></label>
            </div>
            {saved?.keyFrom === 'server' && <p style={{ ...st.muted, margin: '6px 0 0' }}>The API key is set on the server (SMS_API_KEY) — that one is used.</p>}
            <div style={{ ...st.bar, marginTop: '10px' }}>
                <label style={st.check}><input type="checkbox" checked={!!f.sandbox} onChange={e => setF(v => ({ ...v, sandbox: e.target.checked }))} />Sandbox (test mode)</label>
                <label style={st.check}><input type="checkbox" checked={!!f.enabled} onChange={e => setF(v => ({ ...v, enabled: e.target.checked }))} />SMS switched on</label>
                <button type="button" onClick={save} style={{ ...st.primary, marginLeft: 'auto' }}><Icon name="save-fill" />Save</button>
            </div>
            {saved?.ready && (
                <div style={{ ...st.bar, marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <input style={{ ...st.input, width: '160px' }} inputMode="tel" placeholder="0712 345678" value={testPhone} onChange={e => setTestPhone(e.target.value)} aria-label="Test phone" />
                    <button type="button" onClick={test} disabled={!testPhone.trim()} style={st.secondary}><Icon name="send" />Send a test SMS</button>
                    <button type="button" onClick={() => api.get('/api/sms/log').then(r => setLog(r.data)).catch(() => setError('Could not load the log.'))} style={st.link}><Icon name="list-ul" />Recent SMS</button>
                </div>
            )}
            {log && <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px' }}>{log.length ? log.map((x, i) => (
                <div key={i} style={{ fontSize: '12px', borderTop: '1px solid #f0f0f0', padding: '4px 0', color: x.status === 'Success' ? '#333' : '#b02a37' }}>{String(x.sentAt).replace('T', ' ').slice(0, 16)} · {prettyPhone(x.phone)} · <b>{x.status}</b>{x.cost ? ` · ${x.cost}` : ''}{x.error ? ` · ${x.error}` : ''}</div>)) : <p style={st.muted}>No SMS sent in the last 90 days.</p>}</div>}
        </div>
    );
}

const st = {
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '10px' },
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222', backgroundColor: 'white', minWidth: 0 },
    primary: { padding: '9px 14px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    secondary: { padding: '8px 12px', border: '1px solid #1F3864', background: 'white', color: '#1F3864', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    link: { background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: '4px' },
    wa: { backgroundColor: '#25D366', color: 'white', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', fontSize: '13px', whiteSpace: 'nowrap' },
    message: { backgroundColor: '#f6f8fb', border: '1px dashed #cdd6e4', borderRadius: '6px', padding: '8px', fontSize: '12.5px', color: '#333', marginTop: '6px', whiteSpace: 'pre-wrap' },
    pill: { backgroundColor: '#eef3fb', color: '#1F3864', borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 600 },
    small: { fontSize: '11px', color: '#888' },
    muted: { fontSize: '13px', color: '#777' },
};
