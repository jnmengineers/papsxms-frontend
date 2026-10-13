/**
 * PAPSXMS learner report card — A5 size, printed TWO per A4 sheet (landscape, cut down the middle).
 * Uses the school's own grading scale (Grading Scales table), letterhead and term dates.
 *
 * Per subject: each exam's mark AND level, the average and its level, a performance bar and a
 * trend arrow (first exam → last exam). Summary: mean, overall level and its meaning, position,
 * strongest subject and the one needing most support. Comments, signatures, grading key.
 */
import { gradeInfo, gradingBands } from './grading';
import { schoolName, schoolMotto, schoolContact, logoLeftUrl, logoRightUrl } from './school';
import { classDisplayName } from './classUtils';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
/** Calculated numbers (averages, mean, total): always two decimal places, e.g. 72.33 */
const fmt2 = (v) => (v === null ? '–' : (Math.round(v * 100) / 100).toFixed(2));
/** Marks as entered: whole marks stay whole (53); decimals show two places (52.50) */
const mark = (v) => (v === null ? '–' : Number.isInteger(v) ? String(v) : fmt2(v));
/** Grading-key boundaries exactly as set (75, 74.5…) */
const bound = (v) => String(Number(v));
const fmtDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const EXAMS = [['opening', 'OPN', 'Opener'], ['midTerm', 'MID', 'Mid'], ['endTerm', 'END', 'End']];

/** Text colour that stays readable on white paper: pale colours (e.g. yellow) are darkened. */
const ink = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex;
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (light < 0.62) return hex;
    const k = 0.55;                                       // pale → about half as bright
    return '#' + [r, g, b].map(v => Math.round(v * k).toString(16).padStart(2, '0')).join('');
};

/** A level as a small coloured tag. */
const level = (pct) => {
    const g = gradeInfo(pct);
    return pct === null ? '<span class="dim">–</span>' : `<span class="lv" style="color:${ink(g.color)};border-color:${g.color}">${esc(g.label)}</span>`;
};

/** ↑ improving, ↓ dropping, → steady — comparing the first and the last exam written. */
const trend = (marks) => {
    const done = marks.filter(m => m !== null);
    if (done.length < 2) return '';
    const d = done[done.length - 1] - done[0];
    if (d >= 5) return `<span class="tr up" title="Improved by ${fmt2(d)}">▲</span>`;
    if (d <= -5) return `<span class="tr down" title="Dropped by ${fmt2(-d)}">▼</span>`;
    return '<span class="tr flat" title="Steady">▶</span>';
};

/** The rows of the card: [{ name, marks: [opn, mid, end] | [mark], avg }] and which exam columns exist. */
function subjectsOf(singleResults, progressiveData) {
    const prog = progressiveData?.subjects || [];
    const cols = EXAMS.filter(([k]) => prog.some(s => num(s[k]) !== null));
    if (prog.length && cols.length > 1) {
        return {
            cols,
            rows: prog.map(s => {
                const marks = cols.map(([k]) => num(s[k]));
                const done = marks.filter(m => m !== null);
                return { name: s.subjectName, marks, avg: done.length ? done.reduce((a, b) => a + b, 0) / done.length : null };
            }),
        };
    }
    return {
        cols: [['mark', 'MARK', 'Mark']],
        rows: (singleResults || []).map(r => {
            const m = num(r.marksObtained);
            return { name: r.subject?.subjectName || '', marks: [m], avg: m };
        }),
    };
}

/** One A5 report card (HTML). */
export function buildA5Card(card, singleResults, progressiveData) {
    const st = card.student || {};
    const exam = card.exam || {};
    const { cols, rows } = subjectsOf(singleResults, progressiveData);
    const scored = rows.filter(r => r.avg !== null);
    // Mean = average of ALL marks across all exams — the same calculation as the full-page card
    const allMarks = rows.flatMap(r => r.marks).filter(m => m !== null);
    const mean = allMarks.length ? allMarks.reduce((a, b) => a + b, 0) / allMarks.length : null;
    const overall = gradeInfo(mean);
    const best = scored.length ? scored.reduce((a, r) => (r.avg > a.avg ? r : a)) : null;
    const weak = scored.length > 1 ? scored.reduce((a, r) => (r.avg < a.avg ? r : a)) : null;
    const total = scored.reduce((a, r) => a + r.avg, 0);
    const name = `${st.firstName || ''} ${st.lastName || ''}`.trim();
    // The class as the school names it (Settings → School Profile): "Grade 7 Blue", "G7B" or both
    const cls = classDisplayName({ className: st.className || st.schoolClass?.className, stream: st.stream || st.schoolClass?.stream, gradeLevel: st.schoolClass?.gradeLevel });
    const title = `TERM ${esc(exam.term || '')} · ${esc(exam.academicYear || '')}`;
    const multi = cols.length > 1;

    // Each exam: two columns — Marks and Level
    const head = multi
        ? `<tr><th class="sub" rowspan="2">Learning area</th>${cols.map(([, , l]) => `<th colspan="2" class="ex">${esc(l)}</th>`).join('')}`
          + `<th rowspan="2">AVG</th><th rowspan="2">LEVEL</th></tr>`
          + `<tr class="sub2">${cols.map(() => '<th>Mks</th><th>Lvl</th>').join('')}</tr>`
        : `<tr><th class="sub">Learning area</th><th>MARKS</th><th>LEVEL</th></tr>`;
    const body = rows.map((r, i) => {
        return `<tr class="${i % 2 ? '' : 'alt'}"><td class="sub">${esc(r.name)}</td>`
            + (multi
                ? r.marks.map(m => `<td class="n">${m === null ? '<span class="dim">–</span>' : mark(m)}</td><td class="c">${level(m)}</td>`).join('')
                  + `<td class="n b">${fmt2(r.avg)}${trend(r.marks)}</td><td class="c">${level(r.avg)}</td>`
                : `<td class="n">${r.marks[0] === null ? '<span class="dim">–</span>' : mark(r.marks[0])}</td><td class="c">${level(r.avg)}</td>`)
            + `</tr>`;
    }).join('');
    // Per-exam statistics: total and mean (with level) for each exam column
    const colStats = cols.map((_, ci) => {
        const ms = rows.map(r => r.marks[ci]).filter(m => m !== null);
        return { total: ms.reduce((a, b) => a + b, 0), n: ms.length, mean: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null };
    });
    const foot = rows.length ? (multi
        ? `<tr class="tot"><td class="sub">Total</td>${colStats.map(c => `<td class="n" colspan="2">${c.n ? mark(c.total) + ' / ' + c.n * 100 : '–'}</td>`).join('')}<td class="n b" colspan="2">${scored.length ? fmt2(total) + ' / ' + scored.length * 100 : '–'}</td></tr>`
          + `<tr class="tot"><td class="sub">Mean</td>${colStats.map(c => `<td class="n">${fmt2(c.mean)}</td><td class="c">${level(c.mean)}</td>`).join('')}<td class="n b">${fmt2(mean)}</td><td class="c">${level(mean)}</td></tr>`
        : `<tr class="tot"><td class="sub">Total</td><td class="n b">${colStats[0].n ? mark(colStats[0].total) + ' / ' + colStats[0].n * 100 : '–'}</td><td class="c">${level(mean)}</td></tr>`) : '';
    const progress = multi && colStats[0].mean !== null && colStats[colStats.length - 1].mean !== null
        ? colStats[colStats.length - 1].mean - colStats[0].mean : null;
    const counts = {};
    scored.forEach(r => { const l = gradeInfo(r.avg).label; counts[l] = (counts[l] || 0) + 1; });
    const levelCounts = gradingBands().filter(b => counts[b.label]).map(b => `<span class="cnt"><b style="color:${ink(b.color)}">${esc(b.label)}</b> ${counts[b.label]}</span>`).join('');
    const key = gradingBands().map(b => `<span class="key"><b style="color:${ink(b.color)}">${esc(b.label)}</b> ${bound(b.min)}–${bound(b.max)}${b.remarks ? ` <i>${esc(b.remarks)}</i>` : ''}</span>`).join('');
    const remark = overall.remarks || '';

    return `<section class="card">
  <header>
    <img src="${esc(logoLeftUrl())}" onerror="this.style.visibility='hidden'" alt="">
    <div class="school"><div class="sn">${esc(schoolName())}</div>${schoolMotto() ? `<div class="motto">${esc(schoolMotto())}</div>` : ''}${schoolContact() ? `<div class="contact">${esc(schoolContact())}</div>` : ''}</div>
    <img src="${esc(logoRightUrl())}" onerror="this.style.visibility='hidden'" alt="">
  </header>
  <div class="band"><span>LEARNER PROGRESS REPORT</span><span>${title}</span></div>
  <div class="who">
    <div class="nm">${esc(name || '—')}</div>
    <div class="facts"><span><b>Adm</b> ${esc(st.admissionNumber || '—')}</span><span><b>Class</b> ${esc(cls || '—')}</span><span><b>Exam</b> ${esc(exam.examName || '')}</span></div>
  </div>
  <div class="tablewrap"><table class="marks"><thead>${head}</thead><tfoot>${foot}</tfoot><tbody>${body || `<tr><td colspan="${multi ? cols.length * 2 + 3 : 3}" class="c dim">No results recorded</td></tr>`}</tbody></table></div>
  <div class="summary">
    <div class="big" style="border-color:${overall.color}"><div class="k">Overall level</div><div class="v" style="color:${ink(overall.color)}">${esc(overall.label)}</div>${remark ? `<div class="r">${esc(remark)}</div>` : ''}</div>
    <div class="stat"><div class="k">Mean score</div><div class="v">${mean === null ? '–' : fmt2(mean) + '%'}</div><div class="r">${scored.length} learning area${scored.length === 1 ? '' : 's'}</div></div>
    <div class="stat"><div class="k">${multi ? 'Progress' : 'Total'}</div><div class="v">${multi ? (progress === null ? '–' : (progress > 0 ? '+' : '') + fmt2(progress)) : (scored.length ? fmt2(total) : '–')}</div><div class="r">${multi ? `${esc(cols[0][2])} → ${esc(cols[cols.length - 1][2])}` : `out of ${scored.length * 100}`}</div></div>
    <div class="notes">${levelCounts ? `<div class="cnts"><b>Areas by level:</b> ${levelCounts}</div>` : ''}${best ? `<div><span class="up">▲</span> <b>Strongest:</b> ${esc(best.name)} (${fmt2(best.avg)})</div>` : ''}${weak && weak !== best ? `<div><span class="down">▼</span> <b>Needs support:</b> ${esc(weak.name)} (${fmt2(weak.avg)})</div>` : ''}</div>
  </div>
  <div class="comments">
    <div><div class="ct">Class teacher</div><div class="cb">${card.teacherComment ? esc(card.teacherComment) : '&nbsp;'}</div><div class="sig">Sign ____________</div></div>
    <div><div class="ct">Head teacher</div><div class="cb">${card.principalComment ? esc(card.principalComment) : '&nbsp;'}</div><div class="sig">Sign ____________ <span class="stamp">Stamp</span></div></div>
  </div>
  <div class="foot">
    <div class="dates">${exam.termClosingDate ? `<span><b>Closing:</b> ${fmtDate(exam.termClosingDate)}</span>` : ''}${exam.termOpeningDate ? `<span><b>Opening:</b> ${fmtDate(exam.termOpeningDate)}</span>` : ''}<span><b>Parent's sign:</b> ____________</span></div>
    ${key ? `<div class="keys"><b>Grading key:</b> ${key}</div>` : ''}
    <div class="issued">Issued ${fmtDate(new Date().toISOString())} · ${esc(schoolName())}</div>
  </div>
</section>`;
}

/** Puts the cards two per A4 sheet (landscape), with a cut line between them. */
export function buildA5Document(cards, title) {
    const sheets = [];
    for (let i = 0; i < cards.length; i += 2) {
        sheets.push(`<div class="sheet">${cards[i]}<div class="cut"></div>${cards[i + 1] || '<section class="card empty"></section>'}</div>`);
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<div class="toolbar"><b>${esc(title)}</b><span>A4 landscape · 2 report cards per sheet · cut along the dotted line</span><button onclick="window.print()">Print / Save PDF</button></div>
${sheets.join('\n')}</body></html>`;
}

const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #1d2433; background: #e9edf3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.toolbar { position: sticky; top: 0; z-index: 9; display: flex; gap: 14px; align-items: center; background: #1F3864; color: #fff; padding: 10px 18px; font-size: 13px; }
.toolbar span { opacity: .8; flex: 1; }
.toolbar button { background: #FFD700; color: #1F3864; border: 0; padding: 8px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; }
.sheet { width: 297mm; height: 210mm; margin: 8mm auto; background: #fff; display: flex; position: relative; box-shadow: 0 2px 12px rgba(0,0,0,.15); page-break-after: always; break-after: page; overflow: hidden; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.cut { position: absolute; left: 148.5mm; top: 4mm; bottom: 4mm; border-left: 1px dashed #b9c2d0; }
.card { width: 148.5mm; height: 210mm; padding: 7mm 7mm 6mm; display: flex; flex-direction: column; justify-content: space-between; font-size: 8.4pt; }
.card.empty { visibility: hidden; }
header { display: flex; align-items: center; gap: 3mm; }
header img { width: 13mm; height: 13mm; object-fit: contain; }
.school { flex: 1; text-align: center; }
.sn { font-weight: 800; font-size: 11pt; letter-spacing: .3px; color: #1F3864; text-transform: uppercase; }
.motto { font-style: italic; color: #2E75B6; font-size: 7.8pt; }
.contact { color: #5b6475; font-size: 6.8pt; margin-top: .5mm; }
.band { display: flex; justify-content: space-between; margin-top: 2.5mm; padding: 1.2mm 0; border-top: .5mm solid #1F3864; border-bottom: .5mm solid #1F3864; color: #1F3864; font-weight: 700; font-size: 8pt; letter-spacing: .6px; }
.band span:last-child { color: #2E75B6; }
.who { margin-top: 2.5mm; padding: 2mm 3mm; border: .3mm solid #d6dce6; border-left: 1.2mm solid #2E75B6; border-radius: 1.5mm; background: #fff; }
.nm { font-weight: 800; font-size: 11.5pt; color: #1F3864; text-transform: uppercase; }
.facts { display: flex; flex-wrap: wrap; gap: 1mm 4mm; margin-top: .8mm; font-size: 7.8pt; color: #333; }
.facts b { color: #5b6475; font-weight: 600; margin-right: .8mm; }
.tablewrap { margin-top: 2.5mm; }
table.marks { width: 100%; border-collapse: collapse; }
.marks td { height: 5.8mm; }
.marks tfoot td { background: none; border-top: .3mm solid #1F3864; font-weight: 700; color: #1F3864; }
.cnts { display: flex; flex-wrap: wrap; gap: 1mm 2.5mm; }
.cnt { white-space: nowrap; }
.marks th { background: none; color: #1F3864; border-bottom: .4mm solid #1F3864; font-size: 7pt; font-weight: 700; padding: 1.3mm 1mm; text-align: center; letter-spacing: .3px; }
.marks th.sub { text-align: left; padding-left: 2mm; border-top-left-radius: 1.2mm; }
.marks th.barh { border-top-right-radius: 1.2mm; width: 16mm; }
.marks th.ex { border-left: .2mm solid #c9d3e3; }
.marks tr.sub2 th { font-size: 6pt; padding: .6mm .5mm; color: #5b6475; border-bottom: .3mm solid #1F3864; }
.marks td { padding: 1mm .6mm; border-bottom: .2mm solid #e3e7ee; font-size: 8.4pt; }
.marks tr.alt td { background: none; }
.marks td.sub { padding-left: 2mm; font-weight: 600; }
.n { text-align: center; font-variant-numeric: tabular-nums; }
.b { font-weight: 800; color: #1F3864; }
.c { text-align: center; }
.lv { display: inline-block; min-width: 6.5mm; padding: .1mm .7mm; border: .3mm solid; border-radius: 3mm; font-weight: 800; font-size: 7.2pt; text-align: center; }
.bar { white-space: nowrap; }
.track { display: inline-block; vertical-align: middle; width: 11mm; height: 2.3mm; background: #e8ecf2; border-radius: 1.2mm; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 1.2mm; }
.tr { display: inline-block; width: 4mm; text-align: center; font-size: 6.5pt; vertical-align: middle; }
.up { color: #1e7e34; } .down { color: #c0392b; } .flat { color: #8a94a6; }
.dim { color: #b3bac6; }
.summary { display: grid; grid-template-columns: 27mm 22mm 22mm 1fr; gap: 2mm; margin-top: 3mm; }
.summary > div { border: .3mm solid #d6dce6; border-radius: 1.5mm; padding: 1.5mm 2mm; }
.summary .big { border-width: .6mm; text-align: center; }
.summary .stat { text-align: center; }
.k { font-size: 6.6pt; color: #5b6475; text-transform: uppercase; letter-spacing: .4px; }
.v { font-size: 14pt; font-weight: 800; color: #1F3864; line-height: 1.15; }
.r { font-size: 6.6pt; color: #5b6475; }
.notes { font-size: 7.4pt; display: flex; flex-direction: column; justify-content: center; gap: 1mm; }
.comments { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 2mm; height: 19mm; flex: none; }
.comments > div { border: .3mm solid #d6dce6; border-radius: 1.5mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; }
.ct { font-weight: 700; color: #1F3864; font-size: 7.6pt; }
.cb { flex: 1; font-size: 7.8pt; margin-top: .8mm; background: repeating-linear-gradient(transparent 0 3.6mm, #e3e7ee 3.6mm 3.8mm); line-height: 3.8mm; }
.sig { font-size: 7pt; color: #5b6475; margin-top: 1mm; display: flex; justify-content: space-between; }
.stamp { border: .3mm dashed #b9c2d0; border-radius: 50%; padding: 1mm 2mm; font-size: 6pt; color: #b9c2d0; }
.foot { margin-top: 2.5mm; border-top: .5mm solid #1F3864; padding-top: 1.5mm; font-size: 7.2pt; }
.dates { display: flex; flex-wrap: wrap; gap: 1mm 5mm; }
.dates b { color: #1F3864; }
.keys { margin-top: 1mm; display: flex; flex-wrap: wrap; gap: .8mm 3mm; color: #333; }
.key i { color: #5b6475; }
.issued { margin-top: 1mm; text-align: center; font-size: 6.4pt; color: #8a94a6; }
@media print {
  body { background: #fff; }
  .toolbar { display: none; }
  .sheet { margin: 0; box-shadow: none; }
}`;