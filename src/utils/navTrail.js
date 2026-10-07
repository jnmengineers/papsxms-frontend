/**
 * Where the user has been in the app, so "Back" can say where it goes ("← Back to Students").
 * Kept per browser tab (sessionStorage). Positions follow the router's history index, so the
 * trail matches the browser's own Back and Forward buttons.
 */
import { GROUPS } from '../components/Sidebar';

const KEY = 'papsxmsNavTrail';
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { return []; } };
const save = (t) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-60))); } catch (e) { /* not essential */ } };
const historyIndex = () => { const i = window.history.state?.idx; return typeof i === 'number' ? i : null; };

// Page names come from the side menu, so they always match what people see there
const EXTRA_NAMES = { '/dashboard': 'Dashboard', '/change-password': 'Change Password' };
export const pageLabel = (pathname) => {
    if (!pathname) return '';
    if (EXTRA_NAMES[pathname]) return EXTRA_NAMES[pathname];
    if (pathname.startsWith('/student/')) return 'Learner Profile';
    for (const g of GROUPS) for (const it of g.items) if (it.path === pathname) return it.label;
    return '';
};

/** Where Back goes when there's no earlier page in this visit (opened from a bookmark, refreshed…). */
export const parentOf = (pathname) => (pathname.startsWith('/student/') ? '/students' : '/dashboard');

/** Record the page just shown. navType: 'PUSH' | 'REPLACE' | 'POP' (from the router). */
export const recordVisit = (location, navType) => {
    const entry = { path: location.pathname + location.search, pathname: location.pathname };
    let trail = read();
    const idx = historyIndex();
    if (idx !== null) {
        if (navType === 'PUSH') trail = trail.slice(0, idx);
        const keepSub = trail[idx] && trail[idx].path === entry.path ? trail[idx].sub : undefined;
        trail[idx] = { ...entry, ...(keepSub ? { sub: keepSub } : {}) };
    } else {                                              // older router: simple stack
        if (navType === 'POP') { if (trail.length > 1 && trail[trail.length - 2].path === entry.path) trail.pop(); else trail.push(entry); }
        else if (navType === 'REPLACE' && trail.length) trail[trail.length - 1] = entry;
        else if (!trail.length || trail[trail.length - 1].path !== entry.path) trail.push(entry);
    }
    save(trail);
};

/** A tab or sub-view name for the current page ("Expenses"), shown on the Back button of the next page. */
export const setCurrentSub = (sub) => {
    const trail = read();
    const idx = historyIndex();
    const i = idx !== null ? idx : trail.length - 1;
    if (i >= 0 && trail[i]) { trail[i] = { ...trail[i], sub: sub || undefined }; save(trail); }
};

/** The page before this one in this visit, or null. */
export const previousEntry = () => {
    const trail = read();
    const idx = historyIndex();
    if (idx !== null) return idx > 0 && trail[idx - 1] ? trail[idx - 1] : null;
    return trail.length > 1 ? trail[trail.length - 2] : null;
};

/** "Finance · Expenses", "Students", … */
export const entryLabel = (e) => {
    if (!e) return '';
    const page = pageLabel(e.pathname) || 'previous page';
    return e.sub ? `${page} · ${e.sub}` : page;
};
