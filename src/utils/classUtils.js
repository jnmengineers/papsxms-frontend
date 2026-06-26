// ── Class Display Utilities ───────────────────────────────────────────────────
// Use these everywhere a class name is displayed

const streamLabels = {
    YELLOW: 'Yellow', BLUE: 'Blue', RED: 'Red', GREEN: 'Green'
};

const streamInitials = {
    YELLOW: 'Y', BLUE: 'B', RED: 'R', GREEN: 'G'
};

/**
 * Full display name: "Grade 1 Blue", "Play Group Yellow", "Grade 7"
 * Use this everywhere in the UI
 */
export const classDisplayName = (cls) => {
    if (!cls) return '';
    const grade = cls.className || cls.class_name || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade} ${streamLabels[stream] || stream}`;
};

/**
 * Short code for print table headers: "G1B", "G1Y", "G7", "PGR"
 * Use this in print headers where space is tight
 */
export const classShortCode = (cls) => {
    if (!cls) return '';
    const grade = cls.gradeLevel || cls.grade_level || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade}${streamInitials[stream] || stream.charAt(0)}`;
};

/**
 * Full label for print documents: "Grade 1 Blue Stream", "Grade 7"
 */
export const classPrintLabel = (cls) => {
    if (!cls) return '';
    const grade = cls.className || cls.class_name || '';
    const stream = cls.stream;
    if (!stream) return grade;
    return `${grade} ${streamLabels[stream] || stream} Stream`;
};

/**
 * Stream label only: "Blue", "Yellow", null
 */
export const streamLabel = (stream) => {
    if (!stream) return null;
    return streamLabels[stream] || stream;
};

/**
 * Grade level label: "G1" → "Grade 1", "PG" → "Play Group"
 */
export const gradeLabel = (gradeLevel) => {
    const labels = {
        PG: 'Play Group', PP1: 'Pre-Primary 1', PP2: 'Pre-Primary 2',
        G1: 'Grade 1', G2: 'Grade 2', G3: 'Grade 3',
        G4: 'Grade 4', G5: 'Grade 5', G6: 'Grade 6',
        G7: 'Grade 7', G8: 'Grade 8', G9: 'Grade 9'
    };
    return labels[gradeLevel] || gradeLevel || '';
};

/**
 * Sort comparator for classes — by grade level then stream
 */
export const compareClasses = (a, b) => {
    const gradeOrder = ['PG','PP1','PP2','G1','G2','G3','G4','G5','G6','G7','G8','G9'];
    const streamOrder = ['YELLOW','BLUE','RED','GREEN'];
    const ga = gradeOrder.indexOf(a.gradeLevel || a.grade_level);
    const gb = gradeOrder.indexOf(b.gradeLevel || b.grade_level);
    if (ga !== gb) return ga - gb;
    const sa = streamOrder.indexOf(a.stream);
    const sb = streamOrder.indexOf(b.stream);
    return sa - sb;
};