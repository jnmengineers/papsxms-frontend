/**
 * Suggested report-card remarks by performance level (top band → lowest band of the school's
 * grading scale). Varied per learner so a class doesn't all get the same sentence.
 */
import { gradingBands } from './grading';

const TEACHER = [
    ['{name} has performed excellently this term. Keep up the hard work and curiosity.',
     'Outstanding work, {name}! You consistently exceed expectations. Aim even higher.',
     '{name} is a diligent learner with excellent results. Well done and keep it up.'],
    ['{name} has performed well and meets expectations. With more effort, you can excel.',
     'Good work, {name}. Keep practising to move to the next level.',
     '{name} is making steady progress. Stay focused to achieve even better results.'],
    ['{name} is approaching expectations. More practice and revision will bring improvement.',
     '{name} has potential. Consistent effort and asking for help will raise the results.',
     'Fair attempt, {name}. Work harder on the weaker areas next term.'],
    ['{name} needs a lot of support. Let us work together at home and school to improve.',
     '{name} is below expectations this term. Regular practice and closer guidance are needed.',
     '{name} can do better. Extra practice and support at home will help greatly.'],
];
const PRINCIPAL = [
    ['Excellent performance. Keep it up.', 'Outstanding results. Congratulations.', 'Very good work. Maintain the standard.'],
    ['Good performance. Aim higher.', 'Good work. Keep improving.', 'Satisfactory progress. Work harder to excel.'],
    ['Fair performance. More effort is needed.', 'Can improve with more effort and practice.', 'More hard work is needed next term.'],
    ['Needs serious improvement. Parent and teacher support required.', 'Below expectations. Work harder with support.', 'More effort and close follow-up needed.'],
];

/** 0 = top band … 3 = lowest band, from the school's grading scale (fallback 75/50/30). */
export function levelIndex(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return null;
    const bands = (gradingBands() || []).slice().sort((a, b) => Number(b.min) - Number(a.min));
    if (bands.length) {
        const i = bands.findIndex(b => Number(pct) >= Number(b.min));
        return Math.min(3, i === -1 ? bands.length - 1 : i);
    }
    return pct >= 75 ? 0 : pct >= 50 ? 1 : pct >= 30 ? 2 : 3;
}

/** { teacher, principal } remarks for a report card, or null if it has no average. */
export function autoRemarks(card) {
    const i = levelIndex(card?.averageMarks == null ? null : Number(card.averageMarks));
    if (i === null) return null;
    const first = String(card.student?.firstName || 'The learner').trim();
    const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    const pick = (list) => list[Number(card.student?.studentId || card.reportId || 0) % list.length];
    return { teacher: pick(TEACHER[i]).replace(/\{name\}/g, name), principal: pick(PRINCIPAL[i]) };
}
