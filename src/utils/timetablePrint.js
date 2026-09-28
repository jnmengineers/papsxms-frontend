/**
 * Timetable printouts in the school's own formats.
 *
 *  • Individual sheet (class or teacher) — the school's NEW_TTBL layout: landscape A4, one row
 *    per day (Mo–Fr), one column per period headed "number / time", and BREAK / LUNCH as tall
 *    single columns with large vertical lettering.
 *  • Block timetable (a whole section on one sheet) — the school's JSS / Upper block layout:
 *    letterhead, rows grouped by day with one row per class, subject codes with teacher numbers,
 *    breaks / lunch / games as one tall column each, and a numbered teacher key.
 */
import { letterheadHtml } from './school';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (t) => String(t || '').slice(0, 5);
const toMin = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m; };
const DAY_SHORT = { 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr' };
const DAY_BLOCK = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THUR', 5: 'FRI' };

/** Short code for a subject: its Subject Code if set, otherwise a short form of its name. */
export const subjectShort = (code, name) => {
    const c = String(code || '').trim();
    if (c) return c.toUpperCase();
    const words = String(name || '').replace(/&/g, ' ').split(/\s+/).filter(w => w && !/^(and|of|the)$/i.test(w));
    if (words.length >= 2) return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    return String(name || '').slice(0, 4).toUpperCase();
};

/** Break / lunch / games label as printed in the column (BREAK for any break, else the label). */
const bigWord = (label) => (/^\s*((short|long|tea|morning|lunch)\s+)?break\s*$/i.test(String(label || '')) ? 'BREAK' : String(label || '').toUpperCase());

const PAGE_CSS = `
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#000;margin:0;padding:10px;background:#eee}
    .bar{background:#1F3864;color:#fff;padding:8px 12px;border-radius:5px;margin:0 auto 10px;max-width:1120px;display:flex;justify-content:space-between;align-items:center}
    .bar button{background:#FFD700;border:none;padding:6px 16px;border-radius:4px;font-weight:bold;cursor:pointer}
    .page{background:#fff;max-width:1120px;margin:0 auto 14px;padding:14px 16px;break-after:page;page-break-after:always}
    .page:last-child{break-after:auto;page-break-after:auto}
    .vword{writing-mode:vertical-rl;transform:rotate(180deg);font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:3px;line-height:1;margin:0 auto;white-space:nowrap}
    @media print{body{background:#fff;padding:0}.bar{display:none}.page{margin:0;max-width:none;padding:0}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 landscape;margin:8mm}}
`;

export const openPrint = (title, pagesHtml, extraCss, onBlocked) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PAGE_CSS}${extraCss || ''}</style></head><body>
        <div class="bar"><strong>${esc(title)}</strong><button onclick="window.print()">Print / Save PDF</button></div>${pagesHtml}</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { onBlocked?.(); return; }
    w.document.write(html); w.document.close(); w.focus();
};

// ═════════════════════════════════════════════════════════════════════════════
// Individual sheet (NEW_TTBL layout)
// ═════════════════════════════════════════════════════════════════════════════
export const SHEET_CSS = `
    .who{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 6px;font-size:13px}
    .who b{font-size:17px;color:#1F3864}
    table.tt{width:100%;border-collapse:collapse;table-layout:fixed;border:2.5px solid #000}
    .tt th,.tt td{border:1px solid #000;text-align:center;vertical-align:middle;padding:3px}
    .tt thead th{height:58px;font-weight:normal}
    .tt .num{font-size:17px;display:block}.tt .brkhead{font-size:10px;display:block;letter-spacing:.3px}
    .tt .time{font-size:8.5px;display:block;margin-top:2px}
    .tt .day{font-size:24px;width:7.5%;border-right:2.5px solid #000}
    .tt thead th:first-child{border-right:2.5px solid #000}
    .tt tbody td{height:96px}
    .tt .brk{width:6.5%}
    .tt .sub{font-weight:700;font-size:14px;line-height:1.15}
    .tt .sm{font-size:10px;color:#333;margin-top:3px}
    .tt .alt{font-size:9px;color:#666}
`;

/**
 * slots: [{slotId,label,start,end,lesson}] in order; days: [{day,name}]
 * cell(day, slot) → null | { main, sub, note }
 */
export const sheetHtml = ({ heading, left, right, slots: allSlots, days, cell }) => {
    // Like the school's template: the sheet ends with the last lesson (no games / preps after it)
    const lastLesson = allSlots.map(s => !!s.lesson).lastIndexOf(true);
    const slots = lastLesson >= 0 ? allSlots.slice(0, lastLesson + 1) : allSlots;
    let n = 0;
    const head = slots.map(s => s.lesson
        ? `<th><span class="num">${++n}</span><span class="time">${esc(hhmm(s.start))} – ${esc(hhmm(s.end))}</span></th>`
        : `<th class="brk"><span class="brkhead">${esc(String(s.label).toUpperCase())}</span><span class="time">${esc(hhmm(s.start))} – ${esc(hhmm(s.end))}</span></th>`).join('');
    const bodyRows = days.map((d, di) => `<tr><td class="day">${esc(DAY_SHORT[d.day] || d.name)}</td>${slots.map(s => {
        if (!s.lesson) {
            if (di > 0) return '';
            const size = Math.min(46, Math.max(24, Math.floor(360 / Math.max(5, bigWord(s.label).length))));
            return `<td class="brk" rowspan="${days.length}"><span class="vword" style="font-size:${size}px">${esc(bigWord(s.label))}</span></td>`;
        }
        const c = cell(d.day, s);
        return `<td>${c ? `<div class="sub">${esc(c.main)}</div>${c.sub ? `<div class="sm">${esc(c.sub)}</div>` : ''}${c.note ? `<div class="alt">${esc(c.note)}</div>` : ''}` : ''}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="page">
        <div class="who"><span>${heading}</span><span>${esc(left || '')}</span><span>${esc(right || '')}</span></div>
        <table class="tt"><thead><tr><th class="day"></th>${head}</tr></thead><tbody>${bodyRows}</tbody></table>
    </div>`;
};

/** A class's week. view = /api/timetable/class/{id}; entries = its lessons.
 *  layout: 'standard' (Grades 4–9 template) or 'lower' (Lower Primary / Pre-School style). */
export const classSheetHtml = (view, entries, name, schoolName, termText, layout = 'standard') => (layout === 'lower'
    ? lowerSheetHtml(view, entries, name, termText)
    : sheetHtml({
    heading: `<b>${esc(name)}</b> &nbsp;— class timetable`,
    left: view.classTeacherName ? `Class teacher: ${view.classTeacherName}` : '',
    right: [schoolName, termText].filter(Boolean).join(' · '),
    slots: view.slots, days: view.days,
    cell: (day, slot) => {
        const e = entries.find(x => x.day === day && String(x.slotId) === String(slot.slotId));
        return e ? { main: e.subjectName, sub: e.teacherName || '' } : null;
    },
}));

// ═════════════════════════════════════════════════════════════════════════════
// Lower Primary layout (the school's lower timetable): letterhead and title, times as
// "8.30 / 9.00", subjects written upwards in each cell, and every non-lesson period
// (devotion, breaks, lunch, computer, homework, games) spelled out down the week —
// one word per day ("HEALTH / BREAK / AND / ROLL / CALL") or a few letters per day
// ("D E / V O / T I / O / N").
// ═════════════════════════════════════════════════════════════════════════════
export const LOWER_CSS = `
    .ltitle{text-align:center;font-weight:800;font-size:15px;margin:2px 0 8px;letter-spacing:.3px}
    table.lp{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #000}
    .lp th,.lp td{border:1px solid #000;text-align:center;vertical-align:middle;padding:2px}
    .lp thead th{font-size:12px;font-weight:600;height:44px;line-height:1.3}
    .lp .day{font-family:Georgia,'Times New Roman',serif;font-weight:900;font-size:19px;width:8%;text-align:left;padding-left:6px}
    .lp .dayhead{color:#c00000;font-family:Georgia,serif;font-size:22px;font-weight:900}
    .lp tbody tr{height:110px}
    .lp .up{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:800;letter-spacing:.2px;margin:0 auto;max-height:104px;line-height:1.1}
    .lp .sm{font-size:8.5px;color:#444}
    .lp .letters{color:#c00000;font-weight:900;font-size:30px;line-height:1.05;font-family:Arial,sans-serif}
    .lp .word{writing-mode:vertical-rl;transform:rotate(180deg);color:#1e7e34;font-weight:800;font-size:13px;margin:0 auto}
`;

/** Share a label out over the days: one word each if it has several words, else a few letters each. */
const spread = (label, rows) => {
    const words = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= rows) return { kind: 'word', parts: [...words, ...Array(rows - words.length).fill('')].map(w => w.toUpperCase()) };
    const chars = String(label || '').replace(/\s+/g, '').toUpperCase().split('');
    const out = [];
    let k = 0;
    for (let i = 0; i < rows; i++) {
        const n = Math.floor(chars.length / rows) + (i < chars.length % rows ? 1 : 0);
        out.push(chars.slice(k, k + n).join(''));
        k += n;
    }
    return { kind: 'letters', parts: out };
};

const dotTime = (t) => hhmm(t).replace(':', '.').replace(/^0/, '');

export const lowerSheetHtml = (view, entries, name, termText) => {
    const days = view.days;
    const slots = view.slots;
    const head = slots.map(s => `<th>${esc(dotTime(s.start))}<br>${esc(dotTime(s.end))}</th>`).join('');
    const spreads = Object.fromEntries(slots.filter(s => !s.lesson).map(s => [s.slotId, spread(s.label, days.length)]));
    const rows = days.map((d, di) => `<tr><td class="day">${esc(DAY_BLOCK[d.day] || d.name)}</td>${slots.map(s => {
        if (!s.lesson) {
            const sp = spreads[s.slotId];
            const part = sp.parts[di] || '';
            return sp.kind === 'word'
                ? `<td>${part ? `<span class="word">${esc(part)}</span>` : ''}</td>`
                : `<td><div class="letters">${part.split('').map(esc).join('<br>')}</div></td>`;
        }
        const e = entries.find(x => x.day === d.day && String(x.slotId) === String(s.slotId));
        // Shrink long words so they stay inside the cell (e.g. ENVIRONMENTAL)
        const text = String(e?.subjectName || '').toUpperCase();
        const longest = Math.max(0, ...text.split(/\s+/).map(w => w.length));
        const size = longest > 12 ? 9.5 : longest > 9 ? 10.5 : 12;
        return `<td>${e ? `<span class="up" style="font-size:${size}px">${esc(text)}</span>` : ''}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="page">
        ${letterheadHtml({ logoSize: 50 })}
        <div class="ltitle">${esc(String(name).toUpperCase())} TIMETABLE${termText ? ` — ${esc(String(termText).toUpperCase())}` : ''}</div>
        <table class="lp"><thead><tr><th class="day dayhead">DAY</th>${head}</tr></thead><tbody>${rows}</tbody></table>
        ${view.classTeacherName ? `<p style="font-size:11px;margin:6px 0 0">Class teacher: <b>${esc(view.classTeacherName)}</b></p>` : ''}
    </div>`;
};

/**
 * A teacher's week, laid out on the periods of the section they teach most in.
 * Lessons in another section (different times) go in the column they overlap most, with
 * their own time shown in small print.
 */
export const teacherSheetHtml = (tv, slotsBySection, schoolName, termText) => {
    const bySection = {};
    tv.lessons.forEach(l => { bySection[l.section] = (bySection[l.section] || 0) + 1; });
    const main = Object.keys(bySection).sort((a, b) => bySection[b] - bySection[a])[0];
    const slots = (main && slotsBySection[main]) || Object.values(slotsBySection)[0] || [];
    const lessonSlots = slots.filter(s => s.lesson);
    const placed = {};
    tv.lessons.forEach(l => {
        let best = null, bestOverlap = 0;
        lessonSlots.forEach(s => {
            const ov = Math.min(toMin(s.end), toMin(l.end)) - Math.max(toMin(s.start), toMin(l.start));
            if (ov > bestOverlap) { bestOverlap = ov; best = s; }
        });
        if (best) placed[`${l.day}:${best.slotId}`] = { l, exact: hhmm(best.start) === hhmm(l.start) && hhmm(best.end) === hhmm(l.end) };
    });
    return sheetHtml({
        heading: `<b>${esc(tv.teacherName)}</b> &nbsp;— teacher's timetable`,
        left: `${tv.lessons.length} lesson(s) a week`,
        right: [schoolName, termText].filter(Boolean).join(' · '),
        slots, days: tv.days,
        cell: (day, slot) => {
            const p = placed[`${day}:${slot.slotId}`];
            if (!p) return null;
            return { main: p.l.subjectName, sub: p.l.classLabel || p.l.className, note: p.exact ? '' : `${hhmm(p.l.start)}–${hhmm(p.l.end)}` };
        },
    });
};

// ═════════════════════════════════════════════════════════════════════════════
// Block timetable (JSS / Upper layout)
// ═════════════════════════════════════════════════════════════════════════════
export const BLOCK_CSS = `
    .btitle{text-align:center;font-weight:800;font-size:14px;margin:4px 0 6px;letter-spacing:.5px}
    table.bk{width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #000;font-size:11.5px}
    .bk th,.bk td{border:1px solid #444;padding:2px 3px;text-align:left;vertical-align:middle;white-space:nowrap;overflow:hidden}
    .bk thead th{font-family:'Segoe Script','Brush Script MT',cursive,Georgia,serif;font-style:italic;font-size:10.5px;border-bottom:2px solid #000;text-align:center}
    .bk .d{text-align:center;font-weight:600;font-size:12px;border-right:1.5px solid #000}
    .bk .g{width:48px}
    .bk .brk{text-align:center;border-left:1.5px solid #000;border-right:1.5px solid #000;padding:0}
    .bk .brk .vword{color:#d00000;font-size:22px;letter-spacing:10px}
    .bk tr.first td{border-top:2px solid #000}
    .key{margin-top:8px;font-size:11px;display:flex;flex-wrap:wrap;gap:4px 18px}
    .key b{color:#1F3864}
`;

/**
 * section = { name, slots, days }; classes = [{ label, entries }]
 * showTeachers: add teacher numbers to cells (with a key).
 */
export const blockSheetHtml = ({ sectionName, slots, days, classes, showTeachers, termText }) => {
    // Teacher numbers: 1…n by name, only teachers who appear
    const names = [...new Set(classes.flatMap(c => c.entries.map(e => e.teacherName).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
    const num = Object.fromEntries(names.map((n, i) => [n, i + 1]));
    const rowsTotal = days.length * classes.length;
    // Fill one A4 landscape page: fewer classes → taller rows
    const rowH = Math.max(20, Math.min(34, Math.floor(540 / Math.max(1, rowsTotal))));
    const head = slots.map(s => `<th${s.lesson ? '' : ' class="brk"'}>${esc(hhmm(s.start))}-${esc(hhmm(s.end))}</th>`).join('');
    let body = '';
    let firstRow = true;
    days.forEach(d => {
        classes.forEach((c, ci) => {
            body += `<tr class="${ci === 0 ? 'first' : ''}" style="height:${rowH}px">`;
            if (ci === 0) body += `<td class="d" rowspan="${classes.length}">${esc(DAY_BLOCK[d.day] || d.name)}</td>`;
            body += `<td class="g">${esc(c.label)}</td>`;
            slots.forEach(s => {
                if (!s.lesson) {
                    if (firstRow) body += `<td class="brk" rowspan="${rowsTotal}"><span class="vword">${esc(bigWord(s.label))}</span></td>`;
                    return;
                }
                const e = c.entries.find(x => x.day === d.day && String(x.slotId) === String(s.slotId));
                body += `<td>${e ? `${esc(subjectShort(e.subjectCode, e.subjectName))}${showTeachers && e.teacherName ? `<sub style="font-size:8px">${num[e.teacherName]}</sub>` : ''}` : ''}</td>`;
            });
            body += '</tr>';
            firstRow = false;
        });
    });
    const key = showTeachers && names.length ? `<div class="key"><b>TEACHERS:</b>${names.map(n => `<span>${num[n]} — ${esc(n)}</span>`).join('')}</div>` : '';
    return `<div class="page">
        ${letterheadHtml({ logoSize: 58 })}
        <div class="btitle">${esc(String(sectionName).toUpperCase())} — BLOCK TIMETABLE${termText ? ` · ${esc(termText)}` : ''}</div>
        <table class="bk"><thead><tr><th class="d" style="width:52px">DAY</th><th class="g">GRADE</th>${head}</tr></thead><tbody>${body}</tbody></table>
        ${key}
    </div>`;
};
