/**
 * The school's grading scale — from the Grading Scales table (database), loaded once after login
 * by SchoolSettingsProvider. Every page uses these helpers, so all of them always agree.
 *
 *   gradeOf(72.5)      → "ME"
 *   gradeInfo(72.5)    → { label: "ME", color: "#2E75B6", remarks: "Meeting Expectations", points: 3 }
 *   pctColor(72.5)     → "#2E75B6"
 *   gradeColor("ME")   → "#2E75B6"
 *
 * Colours follow each grade's position in the scale: best = green … lowest = red, so any
 * letters work (EE/ME/AE/BE, A–E, …). Before the scale loads (or if none is set) grades show "-".
 */
const PALETTE_MIDDLE = ['#2E75B6', '#ffc107', '#17a2b8', '#fd7e14', '#6f42c1'];
const NONE = { label: '-', color: '#999', remarks: '', points: null };

let bands = [];          // highest first: { label, min, max, remarks, points, color }

export function setGradingScale(list) {
    const rows = (list || [])
        .map(s => ({ label: String(s.gradeLetter || '').trim(), min: Number(s.minMark), max: Number(s.maxMark), remarks: s.remarks || '', points: s.points ?? null }))
        .filter(b => b.label && !isNaN(b.min) && !isNaN(b.max))
        .sort((a, b) => b.min - a.min);
    bands = rows.map((b, i) => ({
        ...b,
        color: i === 0 ? '#28a745' : i === rows.length - 1 ? '#dc3545' : PALETTE_MIDDLE[(i - 1) % PALETTE_MIDDLE.length],
    }));
}

export const gradingBands = () => bands;
export const hasGradingScale = () => bands.length > 0;

/** Full grade details for a percentage. Uses the highest band whose minimum the mark reaches,
 *  so decimal marks (e.g. 74.5 between 74 and 75) are never left without a grade. */
export function gradeInfo(pct) {
    const m = pct === null || pct === undefined || pct === '' ? NaN : Number(pct);
    if (isNaN(m) || !bands.length) return NONE;
    const band = bands.find(b => m >= b.min) || bands[bands.length - 1];
    return { label: band.label, color: band.color, remarks: band.remarks, points: band.points };
}

export const gradeOf = (pct) => gradeInfo(pct).label;
export const pctColor = (pct) => gradeInfo(pct).color;
export const gradeRemarks = (pct) => gradeInfo(pct).remarks;
export const gradeColor = (label) => bands.find(b => b.label === label)?.color || '#999';
