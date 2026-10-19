import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { orderSubjects } from '../utils/subjectOrder';
import { classDisplayName, classLabel, classStream, compareClasses } from '../utils/classUtils';
import { SECTION_CODES, SECTION_NAMES_LIVE, SECTION_OF_GRADE_LIVE, gradeFromClassName } from '../utils/schoolData';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

/**
 * Academic report per section, straight from the marks in Results (no report cards needed):
 * one table per section — a row per class, a column per subject (class mean) and TOTAL MEAN
 * (sum of the subject means). Subjects set not to count (e.g. Computer) are left out.
 */
const fmt = (n) => (n === null || n === undefined || isNaN(n) ? '—' : Number(n).toFixed(2));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sectionLabel = (code) => (code === 'JUNIOR_SCHOOL' ? 'JSS' : code === 'PRE_SCHOOL' ? 'PRE-SCHOOL' : (SECTION_NAMES_LIVE[code] || String(code || 'Other').replace(/_/g, ' ')).toUpperCase());
// Backup when a class has no section set: by its name (PG/PP → pre-school; grades 1–3, 4–6, 7–9)
const sectionByName = (name) => {
    const n = String(name || '').toUpperCase().replace(/\s+/g, '');
    if (/^(PG|PLAY|PP|PRE|BABY|KG)/.test(n)) return 'PRE_SCHOOL';
    const g = Number((n.match(/^(?:GRADE|GR|G)?(\d{1,2})/) || [])[1]);
    return g >= 1 && g <= 3 ? 'LOWER_PRIMARY' : g >= 4 && g <= 6 ? 'UPPER_PRIMARY' : g >= 7 && g <= 9 ? 'JUNIOR_SCHOOL' : 'OTHER';
};
const sectionOfClass = (c) => c?.section || SECTION_OF_GRADE_LIVE[c?.gradeLevel] || SECTION_OF_GRADE_LIVE[gradeFromClassName(c?.className)] || sectionByName(c?.className);
const FALLBACK_ORDER = ['PRE_SCHOOL', 'LOWER_PRIMARY', 'UPPER_PRIMARY', 'JUNIOR_SCHOOL'];
// The stream part of a class code: "G1R" → "R", "PP1Y" → "Y", "Grade 6 Blue" → "Blue", "G5" → ""
const streamCode = (name) => {
    const m = String(name || '').trim().match(/^(?:PP\s?\d|PG|PLAY\s?GROUP|PRE-?PRIMARY\s?\d|G(?:RADE)?\s?\d{1,2})\s*[-\s]?\s*(.*)$/i);
    return m ? m[1].trim() : '';
};

export default function SubjectMeansReport() {
    const settings = useSchoolSettings();   // redraw once the school's sections have loaded
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
            // One row per class AND stream (G1R, G1B…): the stream may be on the class or on the learner
            // One row per stream: the stream may be on the class, on the learner, or in the learner's class code (G1R)
            const ownCode = String(r.student?.className || '').trim();
            const fromCode = streamCode(ownCode);
            const stream = String(cls.stream || classStream(cls) || r.student?.stream || fromCode || streamCode(cls.className) || '').trim();
            const key = `${cls.classId}|${stream.toUpperCase()}`;
            const label = cls.stream ? classLabel(cls.className, cls.stream)
                : (fromCode && ownCode) ? ownCode.toUpperCase()          // as written in the school's report: G1R, G2Y…
                : classLabel(cls.className, stream || null) || classDisplayName(cls);
            const C = (S.classes[key] = S.classes[key] || { cls: { ...cls, stream: stream || null }, label, sums: {} });
            const a = (C.sums[sub.subjectId] = C.sums[sub.subjectId] || [0, 0]); a[0] += m; a[1]++;
        });
        const base = SECTION_CODES.length ? SECTION_CODES : FALLBACK_ORDER;
        const order = [...base, ...Object.keys(bySection).filter(k => !base.includes(k))];
        return order.filter(code => bySection[code]).map(code => {
            const S = bySection[code];
            const subjects = Object.entries(S.subjects).map(([id, name]) => ({ id, name }))
                ;
            subjects.splice(0, subjects.length, ...orderSubjects(subjects, x => x.name));
            const rows = Object.values(S.classes).sort((a, b) => compareClasses(a.cls, b.cls) || String(a.cls.stream || '').localeCompare(String(b.cls.stream || ''))).map(C => {
                const means = {};
                subjects.forEach(s => { const a = C.sums[s.id]; means[s.id] = a && a[1] ? a[0] / a[1] : null; });
                const vals = Object.values(means).filter(v => v !== null);
                return { cls: C.cls, label: C.label, means, total: vals.length ? vals.reduce((x, y) => x + y, 0) : null };
            });
            return { code, label: sectionLabel(code), subjects, rows };
        });
    }, [results, settings]);   // eslint-disable-line react-hooks/exhaustive-deps

    const title = group ? `ACADEMIC REPORT ${group.name.toUpperCase()} ASSESSMENT ${group.year}` : '';

    const print = () => {
        const examWord = group.name.toUpperCase();
        // Page 1: the cover (as in the school's document); then one page per section
        const cover = `<section class="cover">
            <div class="band"></div><div class="cream"></div><div class="panel"></div>
            <svg class="loops" viewBox="0 0 220 80" aria-hidden="true"><path d="M0 8 H150 a32 32 0 0 1 0 64 H0" fill="none" stroke="#d6402f" stroke-width="7"/><path d="M0 24 H150 a16 16 0 0 1 0 32 H0" fill="none" stroke="#d6402f" stroke-width="7"/></svg>
            <div class="title">${esc(group.year)} ${esc(examWord)}<br>ASSESSMENT<br>REPORT</div>
        </section>`;
        const pages = sections.map(s => `<section class="pg">
            <h1>ACADEMIC REPORT ${esc(examWord)} ASSESSMENT ${esc(group.year)}</h1><h2>${esc(s.label)}</h2>
            <table><thead><tr><th class="l">CLASS</th>${s.subjects.map(x => `<th>${esc(x.name.toUpperCase())}</th>`).join('')}<th>TOTAL MEAN</th></tr></thead>
            <tbody>${s.rows.map(r => `<tr><td class="l"><b>${esc(r.label)}</b></td>${s.subjects.map(x => `<td>${r.means[x.id] === null ? '--' : fmt(r.means[x.id])}</td>`).join('')}<td>${r.total === null ? '--' : fmt(r.total)}</td></tr>`).join('')}</tbody></table>
        </section>`).join('');
        const w = window.open('', '_blank');
        if (!w) { alert('Allow pop-ups for this site to print.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
            @page{size:A4 landscape;margin:12mm 14mm}*{box-sizing:border-box}
            body{font-family:"Times New Roman",Times,serif;color:#000;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .bar{background:#1F3864;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;font-family:Arial,sans-serif}.bar button{background:#FFD700;border:0;padding:6px 14px;border-radius:5px;font-weight:700;cursor:pointer}
            section{page-break-after:always;break-after:page}section:last-child{page-break-after:auto;break-after:auto}
            .cover{position:relative;height:180mm;overflow:hidden}
            .cover .band{position:absolute;left:3%;top:4%;width:92%;height:41%;background:#23475a}
            .cover .cream{position:absolute;left:3%;top:45%;width:92%;height:41%;background:#f7e6d6}
            .cover .panel{position:absolute;left:10%;top:8%;width:78%;height:73%;background:#fff7ef}
            .cover .loops{position:absolute;left:3%;top:10%;width:24%}
            .cover .title{position:absolute;left:16%;top:27.5%;width:73%;height:58.5%;background:#fff;padding:2.2% 1.2%;font-weight:700;font-size:19mm;line-height:1.32;letter-spacing:.3px}
            .pg{padding:6mm 0}h1{text-align:center;font-size:21px;margin:0 0 12px}h2{text-align:center;font-size:21px;margin:0 0 30px}
            table{border-collapse:collapse;font-size:14px;margin:0}th,td{border:1px solid #bfbfbf;padding:5px 6px;text-align:center;vertical-align:top}
            th{font-weight:700;background:#fff}tbody tr:nth-child(odd){background:#f2f2f2}.l{text-align:left;white-space:nowrap}
            @media print{.bar{display:none}}</style></head><body>
            <div class="bar"><b>${esc(title)}</b><button onclick="window.print()">Print / Save PDF</button></div>${cover}${pages}</body></html>`);
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
            {group && !loading && results && sections.length > 0 && (
                <p style={{ color: '#555', fontSize: '13px', margin: '10px 0 0' }}>
                    Found {results.length} marks · {sections.map(s => `${s.label}: ${s.rows.length} class${s.rows.length === 1 ? '' : 'es'}`).join(' · ')}
                </p>)}
            {group && !loading && results && sections.length === 0 && <p style={{ color: '#777' }}>No marks have been entered for this assessment yet.</p>}
            {sections.map(s => (
                <div key={s.code} style={{ marginTop: '18px' }}>
                    <div style={{ textAlign: 'center', color: '#1F3864', fontWeight: 800 }}>{title}<br /><span style={{ fontSize: '15px' }}>{s.label}</span></div>
                    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                            <thead><tr><th style={{ ...th, textAlign: 'left' }}>CLASS</th>{s.subjects.map(x => <th key={x.id} style={th}>{x.name.toUpperCase()}</th>)}<th style={{ ...th, backgroundColor: '#1F3864', color: 'white' }}>TOTAL MEAN</th></tr></thead>
                            <tbody>{s.rows.map((r, i) => (
                                <tr key={`${r.cls.classId}|${r.cls.stream || ''}`} style={{ backgroundColor: i % 2 ? '#fafbfd' : 'white' }}>
                                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.label}</td>
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
