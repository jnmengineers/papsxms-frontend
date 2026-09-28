// ── Class Display Utilities ───────────────────────────────────────────────────
// Use these everywhere a class name is displayed.
// Grade and stream names, and their order, come from School Settings (utils/schoolData).
import { GRADE_LABELS_LIVE, STREAM_NAMES_LIVE, gradeRankOf } from './schoolData';

const streamName = (stream) => STREAM_NAMES_LIVE[String(stream).toUpperCase()] || stream;
// Initial = first letter of the stream's name ("Yellow" → "Y")
const streamInitial = (stream) => String(streamName(stream) || '').charAt(0).toUpperCase();
// Streams in their Settings order (includes streams that are switched off)
const streamRank = (stream) => {
    const i = Object.keys(STREAM_NAMES_LIVE).indexOf(String(stream || '').toUpperCase());
    return i === -1 ? 99 : i;
};

/**
 * Full display name: "G1B (Blue)", "G7"
 * Use this everywhere in the UI
 */
export const classDisplayName = (cls) => {
    if (!cls) return '';
    const grade = cls.className || cls.class_name || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade} (${streamName(stream)})`;
};

/**
 * Short code for print table headers: "G1B", "G1Y", "G7"
 * Use this in print headers where space is tight
 */
export const classShortCode = (cls) => {
    if (!cls) return '';
    const grade = cls.gradeLevel || cls.grade_level || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade}${streamInitial(stream)}`;
};

/**
 * Full label for print documents: "G1B (Blue Stream)", "G7"
 */
export const classPrintLabel = (cls) => {
    if (!cls) return '';
    const grade = cls.className || cls.class_name || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade} (${streamName(stream)} Stream)`;
};

/**
 * Stream label only: "Blue", "Yellow", null
 */
export const streamLabel = (stream) => {
    if (!stream) return null;
    return streamName(stream);
};

/**
 * Grade level label: "G1" → "Grade 1", "PG" → "Play Group" (names from Settings)
 */
export const gradeLabel = (gradeLevel) => GRADE_LABELS_LIVE[gradeLevel] || gradeLevel || '';

/**
 * Sort comparator for classes — by grade level then stream (orders from Settings)
 */
export const compareClasses = (a, b) => {
    const ga = gradeRankOf(a.gradeLevel || a.grade_level);
    const gb = gradeRankOf(b.gradeLevel || b.grade_level);
    if (ga !== gb) return ga - gb;
    return streamRank(a.stream) - streamRank(b.stream);
};
