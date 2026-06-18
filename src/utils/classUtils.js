// ─────────────────────────────────────────────────────────────────────────────
// classUtils.js  —  Shared helpers for displaying class names professionally
// Import this wherever you show class names, streams or grade levels
// ─────────────────────────────────────────────────────────────────────────────

// Grade level → human readable name
export const gradeLabel = (gradeLevel) => {
    const map = {
        'PG':  'Play Group',
        'PP1': 'Pre-Primary 1',
        'PP2': 'Pre-Primary 2',
        'G1':  'Grade 1',
        'G2':  'Grade 2',
        'G3':  'Grade 3',
        'G4':  'Grade 4',
        'G5':  'Grade 5',
        'G6':  'Grade 6',
        'G7':  'Grade 7',
        'G8':  'Grade 8',
        'G9':  'Grade 9',
    };
    return map[gradeLevel] || gradeLevel;
};

// Stream → human readable name
export const streamLabel = (stream) => {
    if (!stream) return '';
    const map = {
        'YELLOW': 'Yellow',
        'BLUE':   'Blue',
        'RED':    'Red',
        'GREEN':  'Green',
    };
    return map[stream?.toUpperCase()] || stream;
};

// Full class display name for dropdowns e.g. "Play Group (Blue)"
export const classDisplayName = (cls) => {
    if (!cls) return '';
    const grade = gradeLabel(cls.gradeLevel);
    const stream = streamLabel(cls.stream);
    return stream ? `${grade} (${stream})` : grade;
};

// Full class display name for report cards e.g. "Play Group — Blue Stream"
export const classReportName = (cls) => {
    if (!cls) return '';
    const grade = gradeLabel(cls.gradeLevel);
    const stream = streamLabel(cls.stream);
    return stream ? `${grade} — ${stream} Stream` : grade;
};

// Short display for badges/chips e.g. "PG (Blue)"
export const classShortName = (cls) => {
    if (!cls) return '';
    const stream = streamLabel(cls.stream);
    return stream ? `${cls.gradeLevel} (${stream})` : cls.gradeLevel;
};

// Stream color
export const streamColor = (stream) => {
    const map = {
        'YELLOW': '#ffc107',
        'BLUE':   '#2E75B6',
        'RED':    '#dc3545',
        'GREEN':  '#28a745',
    };
    return map[stream?.toUpperCase()] || '#1F3864';
};

// Section → human readable
export const sectionLabel = (section) => {
    const map = {
        'PRE_SCHOOL':    'Pre-School',
        'LOWER_PRIMARY': 'Lower Primary',
        'UPPER_PRIMARY': 'Upper Primary',
        'JUNIOR_SCHOOL': 'Junior School',
    };
    return map[section] || section;
};