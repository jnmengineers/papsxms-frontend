/**
 * Auto-fill a class's weekly timetable.
 *   • places each subject's lessons-per-week into free lesson periods
 *   • spreads a subject across the week (one a day where possible, never back-to-back if avoidable)
 *   • never books a teacher when they teach another class at an overlapping time (busy list)
 *   • obeys each subject's rules: "must end by" (e.g. Mathematics by 12:00) and no double
 *     lessons (same subject back-to-back with no break between) unless doubles are allowed
 *   • keeps lessons already placed (unless keepExisting is false)
 * Tries many shuffled arrangements and keeps the one that places the most lessons.
 * Pure function — no screen or server code — so it can be tested on its own.
 */
const hm = (t) => String(t || '').slice(0, 5);   // "08:00:00" → "08:00"
const overlaps = (aStart, aEnd, bStart, bEnd) => hm(aStart) < hm(bEnd) && hm(bStart) < hm(aEnd);   // "HH:mm" strings compare correctly
/** Lesson periods next to each other with no break between them (in lesson order). */
const touching = (a, b) => !!a && !!b && hm(a.end) >= hm(b.start);
/** Does placing this subject here break its rules? Returns a reason, or '' if fine. */
export function ruleProblem(subject, day, slot, lessonSlots, subjectAt) {
    if (!subject) return '';
    if (subject.latestEnd && hm(slot.end) > hm(subject.latestEnd)) return `${subject.subjectName} must end by ${hm(subject.latestEnd)}`;
    if (!subject.doublesAllowed) {
        const i = lessonSlots.findIndex(s => String(s.slotId) === String(slot.slotId));
        const prev = lessonSlots[i - 1], next = lessonSlots[i + 1];
        const same = (n) => n && String(subjectAt(day, n.slotId)) === String(subject.subjectId);
        if ((touching(prev, slot) && same(prev)) || (touching(slot, next) && same(next))) return `${subject.subjectName}: no double lessons`;
    }
    return '';
}

// Small seeded random generator, so results can be repeated in tests
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function autoFill({ days, slots, subjects, entries = [], busy = [], keepExisting = true, attempts = 60, seed = Date.now() }) {
    const lessonSlots = slots.filter(s => s.lesson !== false);
    const slotIndex = new Map(lessonSlots.map((s, i) => [String(s.slotId), i]));
    const slotById = new Map(lessonSlots.map(s => [String(s.slotId), s]));
    const kept = keepExisting ? entries.filter(e => slotById.has(String(e.slotId))) : [];
    const rand = rng(seed);

    const teacherFree = (teacherId, day, slot) => !teacherId
        || !busy.some(b => String(b.teacherId) === String(teacherId) && b.day === day && overlaps(slot.start, slot.end, b.start, b.end));

    let best = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const grid = new Map(kept.map(e => [`${e.day}:${e.slotId}`, { ...e }]));
        const countOn = (subjectId, day) => [...grid.values()].filter(e => e.day === day && String(e.subjectId) === String(subjectId)).length;
        const need = subjects.map(s => ({ ...s, left: Math.max(0, (s.lessons || 0) - kept.filter(e => String(e.subjectId) === String(s.subjectId)).length) }));
        // Hardest first (most lessons), random tie-break; then deal lessons out round-robin
        need.sort((a, b) => b.left - a.left || rand() - 0.5);
        const tokens = [];
        for (let round = 0; need.some(s => s.left > 0); round++) need.forEach(s => { if (s.left > 0) { tokens.push(s); s.left--; } });

        let placed = 0, cost = 0;
        const missing = {};
        for (const s of tokens) {
            let pick = null, pickScore = Infinity;
            for (const day of days) {
                const sameDay = countOn(s.subjectId, day);
                for (const slot of lessonSlots) {
                    if (grid.has(`${day}:${slot.slotId}`) || !teacherFree(s.teacherId, day, slot)) continue;
                    if (ruleProblem(s, day, slot, lessonSlots, (d, id) => grid.get(`${d}:${id}`)?.subjectId)) continue;
                    const i = slotIndex.get(String(slot.slotId));
                    const prev = lessonSlots[i - 1], next = lessonSlots[i + 1];
                    const adjacent = [prev, next].some(n => n && String(grid.get(`${day}:${n.slotId}`)?.subjectId) === String(s.subjectId));
                    const score = sameDay * 10 + (adjacent ? 4 : 0) + rand() * 2;
                    if (score < pickScore) { pickScore = score; pick = { day, slot }; }
                }
            }
            if (pick) {
                grid.set(`${pick.day}:${pick.slot.slotId}`, { day: pick.day, slotId: pick.slot.slotId, subjectId: s.subjectId, subjectName: s.subjectName, teacherId: s.teacherId ?? null, teacherName: s.teacherName ?? null });
                placed++; cost += pickScore;
            } else missing[s.subjectId] = { subjectId: s.subjectId, subjectName: s.subjectName, missing: (missing[s.subjectId]?.missing || 0) + 1 };
        }
        const result = { entries: [...grid.values()], placed, unplaced: Object.values(missing), cost };
        if (!best || result.placed > best.placed || (result.placed === best.placed && result.cost < best.cost)) best = result;
        if (!result.unplaced.length && attempt > 10) break;
    }
    return { entries: best.entries, unplaced: best.unplaced };
}

/** Placed lessons that break their subject's rules: "day:slotId" → reason. */
export function ruleIssuesFor(entries, slots, subjects) {
    const lessonSlots = slots.filter(s => s.lesson !== false);
    const bySubject = new Map(subjects.map(s => [String(s.subjectId), s]));
    const at = (d, id) => entries.find(e => e.day === d && String(e.slotId) === String(id))?.subjectId;
    const out = new Map();
    entries.forEach(e => {
        const slot = lessonSlots.find(s => String(s.slotId) === String(e.slotId));
        const why = slot && ruleProblem(bySubject.get(String(e.subjectId)), e.day, slot, lessonSlots, at);
        if (why) out.set(`${e.day}:${e.slotId}`, why);
    });
    return out;
}

/** Lessons of a teacher that clash with another class, for warnings on screen. */
export function clashesFor(entries, slots, busy) {
    const byId = new Map(slots.map(s => [String(s.slotId), s]));
    const out = new Map();   // "day:slotId" → busy entry it clashes with
    entries.forEach(e => {
        const slot = byId.get(String(e.slotId));
        if (!slot || !e.teacherId) return;
        const hit = busy.find(b => String(b.teacherId) === String(e.teacherId) && b.day === e.day && overlaps(slot.start, slot.end, b.start, b.end));
        if (hit) out.set(`${e.day}:${e.slotId}`, hit);
    });
    return out;
}
