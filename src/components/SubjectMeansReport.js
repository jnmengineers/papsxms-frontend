import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { classDisplayName, classLabel, compareClasses } from '../utils/classUtils';
import { SECTION_CODES, SECTION_NAMES_LIVE, SECTION_OF_GRADE_LIVE, gradeFromClassName } from '../utils/schoolData';
import { letterheadHtml } from '../utils/school';

/**
 * Academic report per section, straight from the marks in Results (no report cards needed):
 * one table per section — a row per class, a column per subject (class mean) and TOTAL MEAN
 * (sum of the subject means). Subjects set not to count (e.g. Computer) are left out.
 */
const fmt = (n) => (n === null || n === undefined || isNaN(n) ? '—' : Number(n).toFixed(2));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Usual order of learning areas; anything else follows alphabetically
const ORDER = ['number', 'math', 'english', 'language', 'literacy', 'kiswahili', 'integrated', 'science', 'pre-tech', 'pretech', 'agric', 'social', 'environment', 'religious', 'cre', 'creative'];
const rankOf = (name) => { const n = String(name).toLowerCase(); const i = ORDER.findIndex(k => n.includes(k)); return i === -1 ? 99 : i; };
const sectionLabel = (code) => (code === 'JUNIOR_SCHOOL' ? 'JSS' : (SECTION_NAMES_LIVE[code] || String(code || 'Other').replace(/_/g, ' ')).toUpperCase());
const sectionOfClass = (c) => c?.section || SECTION_OF_GRADE_LIVE[c?.gradeLevel] || SECTION_OF_GRADE_LIVE[gradeFromClassName(c?.className)] || 'OTHER';

export default function SubjectMeansReport() {
    const [exams, setExams] = useState([]);
    const [pick, setPick] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { api.get('/api/exams').then(r => setExams(r.data || [])).catch(() => setError('Could not load exams.')); }, []);

    // Exams with the same name, term and year form one assessment (they may be set up per grade)
    const groups = useMemo(() => {
        const m = {};
        exams.forEach(e => {
            const k = `${String(e.examName).trim().toLowerCase()}|${e.term}|${e.academicYear}`;
            (m[k] = m[k] || { key: k, name: String(e.examName).trim(), term: e.term, year: e.academicYear, ids: [], last: 0 }).ids.push(e.examId);
            m[k].last = Math.max(m[k].last, e.examId || 0);
        });
        return Object.values(m).sort((a, b) => b.last - a.last);
    }, [exams]);
    const group = groups.find(g => g.key === pick);

    useEffect(() => {
        if (!group) { setResults(null); return; }
        setLoading(true); setError('');
        Promise.all(group.ids.map(id => api.get(`/api/results/by-exam/${id}`).then(r => r.data || []).catch(() => [])))
            .then(lists => setResults(lists.flat())).catch(() => setError('Could not load the marks.')).finally(() => setLoading(false));
    }, [pick]);   // eslint-disable-line react-hooks/exhaustive-deps

    // section → { subjects: [{id,name}], rows: [{ cls, means: {subjectId: mean}, total }] }
    const sections = useMemo(() => {
        if (!results) return [];
        const bySection = {};
        results.forEach(r => {
            const cls = r.student?.schoolClass, sub = r.subject, m = Number(r.marksObtained);
            if (!cls || !sub || isNaN(m) || sub.countsInTotals === false) return;
            const sec = sectionOfClass(cls);
            const S = (bySection[sec] = bySection[sec] || { subjects: {}, classes: {} });
            S.subjects[sub.subjectId] = sub.subjectName;
            const C = (S.classes[cls.classId] = S.classes[cls.classId] || { cls, sums: {} });
            const a = (C.sums[sub.subjectId] = C.sums[sub.subjectId] || [0, 0]); a[0] += m; a[1]++;
        });
        const order = [...SECTION_CODES, ...Object.keys(bySection).filter(k => !SECTION_CODES.includes(k))];
        return order.filter(code => bySection[code]).map(code => {
            const S = bySection[code];
            const subjects = Object.entries(S.subjects).map(([id, name]) => ({ id, name }))
                .sort((a, b) => rankOf(a.name) - rankOf(b.name) || a.name.localeCompare(b.name));
            const rows = Object.values(S.classes).sort((a, b) => compareClasses(a.cls, b.cls)).map(C => {
                const means = {};
                subjects.forEach(s => { const a = C.sums[s.id]; means[s.id] = a && a[1] ? a[0] / a[1] : null; });
                const vals = Object.values(means).filter(v => v !== null);
                return { cls: C.cls, means, total: vals.length ? vals.reduce((x, y) => x + y, 0) : null };
            });
            return { code, label: sectionLabel(code), subjects, rows };
        });
    }, [results]);

    const title = group ? `ACADEMIC REPORT ${group.name.toUpperCase()} ASSESSMENT ${group.year}` : '';

    const print = () => {
        const pages = sections.map((s, i) => `<section class="pg"${i ? ' style="page-break-before:always"' : ''}>
            ${letterheadHtml({ logoSize: 50 })}
            <h2>${esc(title)}</h2><h3>${esc(s.label)}</h3>
            <table><thead><tr><th class="l">CLASS</th>${s.subjects.map(x => `<th>${esc(x.name.toUpperCase())}</th>`).join('')}<th>TOTAL MEAN</th></tr></thead>
            <tbody>${s.rows.map(r => `<tr><td class="l"><b>${esc(classLabel(r.cls.className, r.cls.stream) || classDisplayName(r.cls))}</b></td>${s.subjects.map(x => `<td>${fmt(r.means[x.id])}</td>`).join('')}<td><b>${fmt(r.total)}</b></td></tr>`).join('')}</tbody></table>
            <p class="foot">Class mean per learning area, from marks entered in Results. Term ${esc(group.term)}, ${esc(group.year)}.</p></section>`).join('');
        const w = window.open('', '_blank');
        if (!w) { alert('Allow pop-ups for this site to print.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
            @page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
            .bar{background:#1F3864;color:#fff;padding:10px 16px;display:flex;justify-content:space-between}.bar button{background:#FFD700;border:0;padding:6px 14px;border-radius:5px;font-weight:700;cursor:pointer}
            .pg{padding:10px 14px}h2{text-align:center;color:#1F3864;font-size:16px;margin:10px 0 2px;text-decoration:underline}h3{text-align:center;color:#1F3864;font-size:15px;margin:0 0 10px}
            table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #333;padding:6px 5px;text-align:center}th{background:#fff;color:#1F3864;font-size:10.5px}
            .l{text-align:left;white-space:nowrap}tbody tr:nth-child(even){background:#f5f7fa}.foot{font-size:10px;color:#666;margin-top:6px}
            @media print{.bar{display:none}.pg{padding:0}}</style></head><body>
            <div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Print / Save PDF</button></div>${pages}</body></html>`);
        w.document.close(); w.focus();
    };

    const th = { border: '1px solid #ccd3df', padding: '7px 6px', color: '#1F3864', fontSize: '11px', textAlign: 'center', backgroundColor: '#f3f6fb' };
    const td = { border: '1px solid #e1e6ee', padding: '6px', textAlign: 'center', fontSize: '13px' };
    return (
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px 20px', marginBottom: '22px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h3 style={{ color: '#1F3864', margin: 0, fontSize: '17px' }}><i className="bi bi-table" style={{ marginRight: '8px' }} />Section report — subject means (from Results)</h3>
                <select value={pick} onChange={e => setPick(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '15px', minWidth: '260px' }}>
                    <option value="">-- Choose assessment --</option>
                    {groups.map(g => <option key={g.key} value={g.key}>{g.name} — Term {g.term} {g.year}</option>)}
                </select>
                {sections.length > 0 && <button onClick={print} style={{ backgroundColor: '#1F3864', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}><i className="bi bi-printer-fill" style={{ marginRight: '6px' }} />Print report</button>}
            </div>
            {error && <p style={{ color: '#dc3545' }}>{error}</p>}
            {loading && <p style={{ color: '#666' }}>Loading marks…</p>}
            {group && !loading && results && sections.length === 0 && <p style={{ color: '#777' }}>No marks have been entered for this assessment yet.</p>}
            {sections.map(s => (
                <div key={s.code} style={{ marginTop: '18px' }}>
                    <div style={{ textAlign: 'center', color: '#1F3864', fontWeight: 800 }}>{title}<br /><span style={{ fontSize: '15px' }}>{s.label}</span></div>
                    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                            <thead><tr><th style={{ ...th, textAlign: 'left' }}>CLASS</th>{s.subjects.map(x => <th key={x.id} style={th}>{x.name.toUpperCase()}</th>)}<th style={{ ...th, backgroundColor: '#1F3864', color: 'white' }}>TOTAL MEAN</th></tr></thead>
                            <tbody>{s.rows.map((r, i) => (
                                <tr key={r.cls.classId} style={{ backgroundColor: i % 2 ? '#fafbfd' : 'white' }}>
                                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{classLabel(r.cls.className, r.cls.stream) || classDisplayName(r.cls)}</td>
                                    {s.subjects.map(x => <td key={x.id} style={{ ...td, color: r.means[x.id] === null ? '#aaa' : '#111' }}>{fmt(r.means[x.id])}</td>)}
                                    <td style={{ ...td, fontWeight: 800, color: '#1F3864' }}>{fmt(r.total)}</td>
                                </tr>))}</tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}
