import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { compareClasses } from '../utils/classUtils';
import { letterheadHtml } from '../utils/school';

/**
 * Attendance → School Daily Record: the school's "SCHOOL ATTENDANCE RECORD" sheet for one day.
 * Every class: boys and girls present, absent and in total, with a grand total and a TOTAL row.
 * Filled in from the class registers (late = present, excused = absent). A class whose register
 * wasn't taken is left blank for present/absent so it can be filled by hand. Can also print blank.
 */
const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const serverMessage = (err, fallback) => { const d = err?.response?.data; if (typeof d === 'string' && d.length < 300) return d; return d?.message || d?.error || fallback; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayName = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const DUTY_KEY = 'attendanceDutyTeacher';

/** One class's numbers for the sheet (null = leave blank). */
const rowOf = (c, fill) => {
    const tb = fill ? c.enrolledBoys : null, tg = fill ? c.enrolledGirls : null;
    const has = fill && c.taken;
    return {
        pb: has ? c.presentBoys : null, pg: has ? c.presentGirls : null,
        ab: has ? c.absentBoys : null, ag: has ? c.absentGirls : null,
        tb, tg, grand: fill ? c.enrolledBoys + c.enrolledGirls + (c.genderNotSet || 0) : null,
    };
};
const sum = (rows, k) => { const v = rows.map(r => r[k]).filter(x => x !== null && x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
const cellText = (v) => (v === null || v === undefined ? '' : String(v));

export default function SchoolDayRecord({ setError, blocked }) {
    const [date, setDate] = useState(todayISO());
    const [duty, setDuty] = useState(() => { try { return localStorage.getItem(DUTY_KEY) || ''; } catch (e) { return ''; } });
    const [fill, setFill] = useState(true);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api.get(`/api/attendance/school-day/${date}`); setData(r.data); }
        catch (err) { setError(serverMessage(err, 'Could not load the day\'s attendance.')); setData(null); }
        setLoading(false);
    }, [date, setError]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { try { localStorage.setItem(DUTY_KEY, duty); } catch (e) { /* not essential */ } }, [duty]);

    const classes = [...(data?.classes || [])].sort(compareClasses);
    const rows = classes.map(c => ({ c, ...rowOf(c, fill) }));
    const totals = ['pb', 'pg', 'ab', 'ag', 'tb', 'tg', 'grand'].reduce((o, k) => ({ ...o, [k]: sum(rows, k) }), {});
    const notTaken = classes.filter(c => !c.taken);
    const unmarked = classes.filter(c => c.taken && c.notMarked > 0);
    const noGender = classes.reduce((n, c) => n + (c.genderNotSet || 0), 0);

    const print = () => {
        const tr = (label, r, bold) => `<tr${bold ? ' class="tot"' : ''}><td class="cls">${esc(label)}</td>${['pb', 'pg', 'ab', 'ag', 'tb', 'tg', 'grand'].map(k => `<td>${esc(cellText(r[k]))}</td>`).join('')}</tr>`;
        const body = rows.map(r => tr(r.c.className, r, false)).join('') + tr('TOTAL', totals, true);
        const notes = fill && (notTaken.length || noGender) ? `<p class="note">${notTaken.length ? `Register not taken (present/absent left blank): ${notTaken.map(c => esc(c.className)).join(', ')}.` : ''}
            ${noGender ? ` Grand total includes ${noGender} learner(s) with no gender recorded.` : ''}</p>` : '';
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>School attendance record ${esc(date)}</title><style>
            *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0 auto;padding:10px;max-width:780px}
            .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
            .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
            .rule{height:5px;background:#1a3fb0;border-radius:3px;margin:4px 0 8px;box-shadow:0 2px 3px rgba(0,0,0,.3)}
            .title{text-align:center;font-family:'Times New Roman',serif;font-weight:bold;font-size:12px;margin:2px 0 6px}
            .meta{font-family:'Times New Roman',serif;font-weight:bold;font-size:11px;margin:2px 0}
            .meta span{display:inline-block;border-bottom:1px dotted #000;min-width:170px;padding:0 4px;font-weight:normal}
            table{width:100%;border-collapse:collapse;margin-top:6px}
            th,td{border:1px solid #000;font-size:11px;padding:2px 4px;text-align:center;height:24px}
            th{font-family:'Times New Roman',serif;font-size:9.5px;font-weight:bold;height:18px}
            th.l,td.cls{text-align:left;font-weight:bold;width:17%}
            tr.tot td{font-weight:bold;font-size:13px;height:26px}
            .note{font-size:10px;color:#333;margin:6px 0 0}
            .sign{display:flex;justify-content:space-between;margin-top:22px;font-size:11px}
            @media print{.bar{display:none}body{padding:0;max-width:none}@page{size:A4 portrait;margin:10mm}}
        </style></head><body>
            <div class="bar"><strong>School attendance record — ${esc(longDate(date))}</strong><button onclick="window.print()">Print / Save PDF</button></div>
            ${letterheadHtml({ logoSize: 46 })}<div class="rule"></div>
            <div class="title">SCHOOL ATTENDANCE RECORD</div>
            <div class="meta">DAY <span>${fill ? esc(dayName(date)) : ''}</span> &nbsp;&nbsp; DATE <span>${fill ? esc(longDate(date)) : ''}</span></div>
            <div class="meta" style="margin-left:40px">TEACHER ON DUTY : <span style="min-width:340px">${esc(duty)}</span></div>
            <table>
                <thead>
                    <tr><th class="l" rowspan="2">CLASS/STREAM</th><th colspan="2">PRESENT</th><th colspan="2">ABSENT</th><th colspan="2">TOTAL</th><th rowspan="2">GRAND<br>TOTAL</th></tr>
                    <tr><th>BOYS</th><th>GIRLS</th><th>BOYS</th><th>GIRLS</th><th>BOYS</th><th>GIRLS</th></tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
            ${notes}
            <div class="sign"><span>Teacher on duty: ____________________</span><span>Head teacher: ____________________</span></div>
        </body></html>`;
        const w = window.open('', '_blank');
        if (!w) { blocked?.(); return; }
        w.document.write(html); w.document.close(); w.focus();
    };

    const num = (v) => (v === null || v === undefined ? <span style={{ color: '#bbb' }}>—</span> : v);
    return (
        <div>
            <div style={st.bar}>
                <label style={st.lbl}>Date<input type="date" style={st.input} value={date} max={todayISO()} onChange={e => setDate(e.target.value)} /></label>
                <label style={{ ...st.lbl, flex: 1, minWidth: '200px' }}>Teacher on duty<input style={st.input} value={duty} maxLength={80} placeholder="Name (optional — or write it on the sheet)" onChange={e => setDuty(e.target.value)} /></label>
                <label style={st.check}><input type="checkbox" checked={fill} onChange={e => setFill(e.target.checked)} />Fill in from the registers</label>
                <button onClick={print} disabled={!data} style={{ ...st.primary, opacity: data ? 1 : 0.5 }}><Icon name="printer-fill" />Print record</button>
            </div>

            {fill && data && (notTaken.length > 0 || unmarked.length > 0 || noGender > 0) && (
                <div style={st.warn}>
                    {notTaken.length > 0 && <div><Icon name="exclamation-circle-fill" />Register not taken yet: <b>{notTaken.map(c => c.className).join(', ')}</b> — their present/absent will be blank on the sheet.</div>}
                    {unmarked.length > 0 && <div><Icon name="exclamation-circle-fill" />Some learners not marked: {unmarked.map(c => `${c.className} (${c.notMarked})`).join(', ')}.</div>}
                    {noGender > 0 && <div><Icon name="exclamation-circle-fill" />{noGender} learner(s) have no gender recorded, so they can't be counted as boys or girls (Students page).</div>}
                </div>
            )}

            {loading ? <p style={st.center}><Icon name="hourglass-split" />Loading…</p> : data && (
                <div style={{ ...st.panel, overflowX: 'auto' }}>
                    <table style={st.table}>
                        <thead>
                            <tr><th style={st.th} rowSpan={2}>Class / stream</th><th style={st.thc} colSpan={2}>Present</th><th style={st.thc} colSpan={2}>Absent</th><th style={st.thc} colSpan={2}>Total</th><th style={st.thc} rowSpan={2}>Grand total</th></tr>
                            <tr>{['Boys', 'Girls', 'Boys', 'Girls', 'Boys', 'Girls'].map((h, i) => <th key={i} style={st.thc}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.c.classId} style={{ backgroundColor: fill && !r.c.taken ? '#fff8e1' : i % 2 ? 'white' : '#fafafa' }}>
                                    <td style={{ ...st.td, fontWeight: 700 }}>{r.c.className}{fill && !r.c.taken && <span style={st.tag}>not taken</span>}</td>
                                    {['pb', 'pg', 'ab', 'ag', 'tb', 'tg', 'grand'].map(k => <td key={k} style={{ ...st.tdc, fontWeight: k === 'grand' ? 700 : 400 }}>{num(r[k])}</td>)}
                                </tr>
                            ))}
                            <tr style={{ backgroundColor: '#eef3fb' }}>
                                <td style={{ ...st.td, fontWeight: 800 }}>TOTAL</td>
                                {['pb', 'pg', 'ab', 'ag', 'tb', 'tg', 'grand'].map(k => <td key={k} style={{ ...st.tdc, fontWeight: 800 }}>{num(totals[k])}</td>)}
                            </tr>
                        </tbody>
                    </table>
                    <p style={st.small}>Late counts as present; excused counts as absent. Total = learners in the class.</p>
                </div>
            )}
        </div>
    );
}

const st = {
    bar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', backgroundColor: 'white', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
    lbl: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: '#1F3864' },
    input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', fontWeight: 'normal', color: '#222' },
    check: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', paddingBottom: '8px' },
    primary: { padding: '9px 16px', border: 'none', background: '#1F3864', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
    warn: { backgroundColor: '#fff3cd', color: '#856404', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '12px', lineHeight: 1.6 },
    panel: { backgroundColor: 'white', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '560px' },
    th: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'left', fontSize: '12px' },
    thc: { backgroundColor: '#1F3864', color: 'white', padding: '7px 8px', textAlign: 'center', fontSize: '12px' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px' },
    tdc: { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'center' },
    tag: { marginLeft: '6px', fontSize: '10px', color: '#856404', backgroundColor: '#ffe8a1', borderRadius: '8px', padding: '1px 6px', fontWeight: 600 },
    small: { fontSize: '11px', color: '#888', margin: '8px 0 0' },
    center: { textAlign: 'center', color: '#666', padding: '20px' },
};
