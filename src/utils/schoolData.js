/**
 * Sections, grades, streams and exam types — from School Settings (database).
 *
 * These are LIVE tables: they start empty and are filled in place by SchoolSettingsProvider
 * (applySchoolData) once settings load, and refilled whenever settings are saved. Pages keep
 * using familiar names (SECTIONS, GRADE_ORDER, …) and re-draw via useSchoolSettings().
 *
 * No school values are written here — only the shapes the pages need.
 */
export const SECTIONS_LIVE = [];          // ordered; see sectionShape()
export const SECTION_CODES = [];          // ['PRE_SCHOOL', …]
export const SECTION_NAMES_LIVE = {};     // code → name
export const SECTION_COLORS_LIVE = {};    // code → colour
export const SECTION_COLOR_PAIRS = {};    // code → { bg, light }
export const SECTION_GRADES_LIVE = {};    // code → ['G4','G5','G6']
export const SECTION_TARGETS_LIVE = {};   // code → mean target
export const GRADE_ORDER_LIVE = [];       // ['PG','PP1',…]
export const GRADE_LABELS_LIVE = {};      // code → "Grade 4"
export const SECTION_OF_GRADE_LIVE = {};  // grade → section code
export const PROMOTION_MAP_LIVE = {};     // grade → next grade (last grade has none)
export const STREAMS_LIVE = [];           // in-use streams, ordered: { code, value, name, label, color }
export const STREAM_NAMES_LIVE = {};      // code → name (all streams, incl. switched off)
export const STREAM_COLORS_LIVE = {};     // code → colour
export const EXAM_TYPES_LIVE = {};        // code → { label, color, order, core, active }
export const EXAM_TYPE_LIST = [];         // ordered: { code, value, label, color, order, core, active }
export const CORE_TYPES_LIVE = [];        // codes expected every term

const clearObj = (o) => { Object.keys(o).forEach(k => { delete o[k]; }); };
const clearArr = (a) => { a.length = 0; };

/** A light tint of a colour (for card backgrounds). */
export function lighten(hex, amount = 0.88) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#f5f5f5';
    const n = parseInt(m[1], 16);
    const mix = (c) => Math.round(c + (255 - c) * amount);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Dark or white text, whichever reads better on this background colour. */
export function textOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'white';
    const n = parseInt(m[1], 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.65 ? '#333' : 'white';
}

export function applySchoolData({ sections = [], grades = [], streams = [], examTypes = [] } = {}) {
    [SECTIONS_LIVE, SECTION_CODES, GRADE_ORDER_LIVE, STREAMS_LIVE, EXAM_TYPE_LIST, CORE_TYPES_LIVE].forEach(clearArr);
    [SECTION_NAMES_LIVE, SECTION_COLORS_LIVE, SECTION_COLOR_PAIRS, SECTION_GRADES_LIVE, SECTION_TARGETS_LIVE,
        GRADE_LABELS_LIVE, SECTION_OF_GRADE_LIVE, PROMOTION_MAP_LIVE, STREAM_NAMES_LIVE, STREAM_COLORS_LIVE, EXAM_TYPES_LIVE].forEach(clearObj);

    const byOrder = (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    const gradeList = [...grades].sort(byOrder);
    gradeList.forEach(g => {
        GRADE_ORDER_LIVE.push(g.code);
        GRADE_LABELS_LIVE[g.code] = g.name;
        SECTION_OF_GRADE_LIVE[g.code] = g.sectionCode;
        if (g.nextGradeCode) PROMOTION_MAP_LIVE[g.code] = g.nextGradeCode;
    });

    [...sections].sort(byOrder).forEach(s => {
        const gradesHere = gradeList.filter(g => g.sectionCode === s.code).map(g => g.code);
        const subjectTeaching = !!s.subjectTeaching;
        // One object that fits every page's older shape (value/key/label/title/short/bg/target/mode)
        SECTIONS_LIVE.push({
            code: s.code, value: s.code, key: s.code,
            name: s.name, label: s.name, title: s.name, short: s.name,
            color: s.color, bg: s.color, light: lighten(s.color),
            meanTarget: s.meanTarget, target: s.meanTarget,
            grades: gradesHere, sortOrder: s.sortOrder,
            subjectTeaching, mode: subjectTeaching ? 'subject' : 'class',
        });
        SECTION_CODES.push(s.code);
        SECTION_NAMES_LIVE[s.code] = s.name;
        SECTION_COLORS_LIVE[s.code] = s.color;
        SECTION_COLOR_PAIRS[s.code] = { bg: s.color, light: lighten(s.color) };
        SECTION_GRADES_LIVE[s.code] = gradesHere;
        SECTION_TARGETS_LIVE[s.code] = s.meanTarget;
    });

    [...streams].sort(byOrder).forEach(s => {
        STREAM_NAMES_LIVE[s.code] = s.name;
        STREAM_COLORS_LIVE[s.code] = s.color;
        if (s.active !== false) STREAMS_LIVE.push({ code: s.code, value: s.code, name: s.name, label: s.name, color: s.color });
    });

    [...examTypes].sort(byOrder).forEach((t, i) => {
        const entry = { code: t.code, value: t.code, label: t.name, color: t.color, order: i + 1, core: !!t.core, active: t.active !== false };
        EXAM_TYPES_LIVE[t.code] = entry;
        EXAM_TYPE_LIST.push(entry);
        if (entry.core && entry.active) CORE_TYPES_LIVE.push(t.code);
    });
}

/** The grade a class name starts with, e.g. "G4Y" → "G4", "PP1 Blue" → "PP1". Longest grade code wins. */
export function gradeFromClassName(className) {
    const name = String(className || '').trim().toUpperCase();
    if (!name) return '';
    const hit = [...GRADE_ORDER_LIVE].sort((a, b) => b.length - a.length)
        .find(code => name.startsWith(code.toUpperCase()) && !/[0-9]/.test(name.charAt(code.length)));
    return hit || '';
}

export const gradeRankOf = (g) => { const i = GRADE_ORDER_LIVE.indexOf(g); return i === -1 ? 99 : i; };
export const lastGrades = () => GRADE_ORDER_LIVE.filter(g => !PROMOTION_MAP_LIVE[g]);
