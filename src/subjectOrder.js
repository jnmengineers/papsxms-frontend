/**
 * The school's standard subject order, used wherever marks are listed (Mark Entry, Results,
 * report cards, section report):  ENG → KIS → MAT → SCI → PRE-TECH → AGR → SST → CRE → CIA → others.
 * Pre-primary: Language/Literacy → Kiswahili → Number work → Environmental/Integrated → Religious → Creative.
 */
export function subjectRank(name, code) {
    const n = `${name || ''} ${code || ''}`.toLowerCase();
    if (/kiswahili|\bkis\b|\bksw\b/.test(n)) return 2;
    if (/english|\beng\b|language|literacy|reading/.test(n)) return /literacy|reading/.test(n) ? 1.5 : 1;
    if (/math|\bmat\b|\bmth\b|number/.test(n)) return 3;
    if (/creative|\barts?\b|sport|music|physical|\bcia\b|\bcas\b|cre\.?\s?a\b/.test(n)) return 9;   // before CRE (code "CRE.A")
    if (/pre[- ]?tech|technical|p\.?\s?tec/.test(n)) return 5;
    if (/agri|nutrition|home ?science|\bagr\b/.test(n)) return 6;
    if (/social|\bsst\b/.test(n)) return 7;
    if (/religious|\bcre\b|\bire\b|\bhre\b/.test(n)) return 8;
    if (/science|integrated|environment|\bsci\b|\bisci\b/.test(n)) return 4;
    return 50;   // anything else (e.g. Computer) last, alphabetically
}

/** Sorts a copy of a list of subjects; `get` returns [name, code] (or just the name) for an item. */
export function orderSubjects(list, get = (s) => [s?.subjectName, s?.subjectCode]) {
    const key = (x) => { const v = get(x); return Array.isArray(v) ? v : [v, '']; };
    return [...(list || [])].sort((a, b) => {
        const [an, ac] = key(a), [bn, bc] = key(b);
        return subjectRank(an, ac) - subjectRank(bn, bc) || String(an || '').localeCompare(String(bn || ''));
    });
}
