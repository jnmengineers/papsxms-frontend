// ── Class names: ONE rule for the whole system ────────────────────────────────
// Every page and printout names a class through these functions, built from the class's
// GRADE and STREAM in School Settings — never from free-typed text:
//
//   code       grade code + first letter of the stream name     G1B, PP1Y, PGR, G7 (no stream)
//   full name  grade name + stream name                         Grade 1 Blue, Play Group Red, Grade 7
//
// What screens and documents show is chosen in Settings → School Profile → "Class names shown as":
//   CODE → "G1B"   ·   FULL → "Grade 1 Blue"   ·   BOTH → "Grade 1 Blue (G1B)"
// Tight spaces (block timetables, the daily attendance sheet) always use the code.
// If only a name like "G1B" is known, the grade and stream are read from it (G1 + B → Blue).
import { GRADE_LABELS_LIVE, STREAM_NAMES_LIVE, gradeFromClassName, gradeRankOf } from './schoolData';
import { school } from './school';

const up = (v) => String(v ?? '').trim().toUpperCase();
const streamName = (stream) => STREAM_NAMES_LIVE[up(stream)] || (stream ? String(stream) : '');
const streamInitial = (stream) => String(streamName(stream) || '').trim().charAt(0).toUpperCase();

/** The stream a name like "G1B" points to (by the letter after the grade), or '' if not clear. */
const streamFromName = (name, grade) => {
    const rest = up(name).slice(String(grade || '').length).replace(/[^A-Z]/g, '');
    if (!rest) return '';
    const codes = Object.keys(STREAM_NAMES_LIVE);
    const exact = codes.find(c => up(STREAM_NAMES_LIVE[c]) === rest || c === rest);
    if (exact) return exact;
    const byLetter = codes.filter(c => streamInitial(c) === rest);
    return byLetter.length === 1 ? byLetter[0] : '';
};

/** Grade and stream of a class object ({ gradeLevel, stream, className }). */
const parts = (cls) => {
    if (!cls) return { grade: '', stream: '' };
    const grade = up(cls.gradeLevel || cls.grade_level) || gradeFromClassName(cls.className || cls.class_name);
    const stream = up(cls.stream) || (grade ? streamFromName(cls.className || cls.class_name, grade) : '');
    return { grade, stream };
};

/** Short code: "G1B", "PP1Y", "G7". Falls back to the stored name if the grade can't be worked out. */
export const classCode = (cls) => {
    if (!cls) return '';
    const { grade, stream } = parts(cls);
    if (!grade) return String(cls.className || cls.class_name || '');
    return `${grade}${stream ? streamInitial(stream) : ''}`;
};

/** Full name: "Grade 1 Blue", "Grade 7". Falls back to the stored name if the grade can't be worked out. */
export const classFullName = (cls) => {
    if (!cls) return '';
    const { grade, stream } = parts(cls);
    if (!grade) return String(cls.className || cls.class_name || '');
    const g = GRADE_LABELS_LIVE[grade] || grade;
    return stream ? `${g} ${streamName(stream)}` : g;
};

/** The school's chosen style (Settings → School Profile). */
const style = () => up(school().classNameStyle) || 'FULL';

/** How a class is shown everywhere on screen and in documents. */
export const classDisplayName = (cls) => {
    if (!cls) return '';
    const code = classCode(cls), full = classFullName(cls);
    if (code === full) return code;                       // grade unknown: the stored name
    switch (style()) {
        case 'CODE': return code;
        case 'BOTH': return `${full} (${code})`;
        default: return full;
    }
};

/** Same, when only the class name text is known (e.g. a learner's class on a receipt). */
export const classLabel = (className, stream) => classDisplayName({ className, stream });

/** Short code for tight spaces (print table headers, block timetables). */
export const classShortCode = (cls) => classCode(cls);

/** Formal documents (report cards, letters): always the full name. */
export const classPrintLabel = (cls) => classFullName(cls);

/** Stream label only: "Blue", "Yellow", null */
export const streamLabel = (stream) => (stream ? streamName(stream) : null);

/** Grade level label: "G1" → "Grade 1" (names from Settings) */
export const gradeLabel = (gradeLevel) => GRADE_LABELS_LIVE[gradeLevel] || gradeLevel || '';

/** Sort: by grade (Settings order), then stream (Settings order). */
export const compareClasses = (a, b) => {
    const pa = parts(a), pb = parts(b);
    const ga = gradeRankOf(pa.grade), gb = gradeRankOf(pb.grade);
    if (ga !== gb) return ga - gb;
    const order = Object.keys(STREAM_NAMES_LIVE);
    const sa = order.indexOf(pa.stream), sb = order.indexOf(pb.stream);
    return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
};
