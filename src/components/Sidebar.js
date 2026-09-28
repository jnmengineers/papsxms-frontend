import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import useWindowWidth from '../hooks/useWindowWidth';

// Same icons as the Dashboard quick-access cards, so each page looks the same everywhere
const GROUPS = [
    {
        label: 'Overview',
        items: [
            { icon: 'house-door-fill', label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT'] },
            { icon: 'calendar-week-fill', label: 'Timetable', path: '/timetable', roles: ['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT'] },
            { icon: 'megaphone-fill', label: 'Notices', path: '/announcements', roles: ['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT'] },
        ]
    },
    {
        label: 'People',
        items: [
            { icon: 'mortarboard-fill', label: 'Students', path: '/students', roles: ['ADMIN', 'TEACHER', 'CLERK'], alsoActive: ['/student/'] },
            { icon: 'person-workspace', label: 'Teachers', path: '/teachers', roles: ['ADMIN'] },
            { icon: 'people-fill', label: 'Users', path: '/users', roles: ['ADMIN'] },
        ]
    },
    {
        label: 'Academic Setup',
        items: [
            { icon: 'building', label: 'Classes', path: '/classes', roles: ['ADMIN'] },
            { icon: 'book-fill', label: 'Subjects', path: '/subjects', roles: ['ADMIN'] },
            { icon: 'link-45deg', label: 'Class Subjects', path: '/class-subjects', roles: ['ADMIN'] },
            { icon: 'calendar3', label: 'Academic Years', path: '/academic-years', roles: ['ADMIN'] },
            { icon: 'calendar-check-fill', label: 'Exam Schedules', path: '/exam-schedules', roles: ['ADMIN'] },
            { icon: 'sliders', label: 'Grading Scales', path: '/grading-scales', roles: ['ADMIN'] },
        ]
    },
    {
        label: 'Exams & Results',
        items: [
            { icon: 'file-earmark-text-fill', label: 'Exams', path: '/exams', roles: ['ADMIN'] },
            { icon: 'pencil-square', label: 'Mark Entry', path: '/mark-entry', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
            { icon: 'calendar2-check-fill', label: 'Attendance', path: '/attendance', roles: ['ADMIN', 'TEACHER'] },
            { icon: 'bar-chart-fill', label: 'Results', path: '/results', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
            { icon: 'clipboard-data-fill', label: 'Report Cards', path: '/reportcards', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
            { icon: 'graph-up-arrow', label: 'Progressive Report', path: '/progressive-report', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
            { icon: 'pie-chart-fill', label: 'Section Report', path: '/section-report', roles: ['ADMIN'] },
        ]
    },
    {
        label: 'Class Services',
        items: [
            { icon: 'basket2-fill', label: 'Meals & Transport', path: '/meals-transport', roles: ['ADMIN', 'ACCOUNTANT', 'TEACHER'] },
        ]
    },
    {
        label: 'Finance',
        items: [
            { icon: 'cash-stack', label: 'Finance', path: '/finance', roles: ['ADMIN', 'ACCOUNTANT'] },
            { icon: 'bus-front-fill', label: 'Transport', path: '/transport', roles: ['ADMIN', 'ACCOUNTANT'] },
        ]
    },
    {
        label: 'Admin',
        items: [
            { icon: 'box-arrow-in-down', label: 'Import Data', path: '/import', roles: ['ADMIN'] },
            { icon: 'gear-fill', label: 'School Settings', path: '/settings', roles: ['ADMIN'] },
        ]
    },
    {
        label: 'Account',
        items: [
            { icon: 'key-fill', label: 'Change Password', path: '/change-password', roles: ['ADMIN', 'TEACHER', 'CLERK', 'ACCOUNTANT'] },
        ]
    },
];

// Active on the page itself and on its sub-pages (e.g. /students/5, /student/5)
const isItemActive = (item, pathname) =>
    pathname === item.path ||
    pathname.startsWith(item.path + '/') ||
    (item.alsoActive || []).some(prefix => pathname.startsWith(prefix));

const STORAGE_KEY = 'sidebarOpenGroups';
const COLLAPSED_KEY = 'sidebarCollapsed';
const WIDE = 230, RAIL = 64;

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role');
    const { isOpen, setIsOpen } = useSidebar();
    const isMobile = useWindowWidth() <= 768;

    // Desktop only: shrink to an icon rail. On phones the slide-in menu always shows full labels.
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch (e) { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem(COLLAPSED_KEY, String(collapsed)); } catch (e) { /* ignore */ }
    }, [collapsed]);
    const isRail = collapsed && !isMobile;

    const visibleGroups = GROUPS
        .map(group => ({ ...group, items: group.items.filter(item => item.roles.includes(role)) }))
        .filter(group => group.items.length > 0);

    const activeGroupLabel = visibleGroups.find(group =>
        group.items.some(item => isItemActive(item, location.pathname)))?.label;

    // Remember which groups the user opened/closed, across pages and reloads
    const [openGroups, setOpenGroups] = useState(() => {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { saved = {}; }
        const initial = {};
        visibleGroups.forEach(group => {
            initial[group.label] = group.label in saved
                ? saved[group.label]
                : group.label === activeGroupLabel || group.label === 'Overview';
        });
        if (activeGroupLabel) initial[activeGroupLabel] = true;
        return initial;
    });

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)); } catch (e) { /* storage full or blocked */ }
    }, [openGroups]);

    // Keep the current page's group open when the route changes from elsewhere
    useEffect(() => {
        if (activeGroupLabel) setOpenGroups(prev => prev[activeGroupLabel] ? prev : { ...prev, [activeGroupLabel]: true });
    }, [activeGroupLabel]);

    // Mobile: Esc closes the menu
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, setIsOpen]);

    useEffect(() => {
        if (isMobile) return;
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); setCollapsed(c => !c); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isMobile]);

    const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

    // Real links: normal click navigates inside the app; Ctrl/Cmd/middle-click opens a new tab
    const handleLinkClick = (e, path) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(path);
        setIsOpen(false); // auto-close on mobile after navigating
    };

    return (
        <>
            {/* Mobile backdrop — shown by the stylesheet only on small screens */}
            {isOpen && <div className="app-backdrop" style={styles.backdrop} onClick={() => setIsOpen(false)} aria-hidden="true" />}

            <nav className={`app-sidebar${isOpen ? ' open' : ''}${isRail ? ' rail' : ''}`}
                style={{ ...styles.sidebar, width: isRail ? RAIL : WIDE, padding: isRail ? '10px 0 20px' : '10px 0 20px' }}
                aria-label="Main menu">

                {/* Collapse / expand toggle (desktop) */}
                {!isMobile && (
                    <button type="button" onClick={() => setCollapsed(c => !c)} className="app-sidebar-toggle"
                        style={{ ...styles.toggle, justifyContent: isRail ? 'center' : 'flex-end', padding: isRail ? '8px 0' : '8px 16px' }}
                        aria-label={isRail ? 'Expand menu' : 'Collapse menu'} aria-expanded={!isRail}
                        title={`${isRail ? 'Expand' : 'Collapse'} menu (Ctrl+B)`}>
                        {!isRail && <span style={styles.toggleText}>Collapse</span>}
                        <i className={`bi bi-${isRail ? 'chevron-double-right' : 'chevron-double-left'}`} aria-hidden="true" />
                    </button>
                )}

                {isRail ? (
                    /* ── Icon rail: every item as an icon, groups separated by thin lines ── */
                    <ul style={styles.list}>
                        {visibleGroups.map((group, gi) => (
                            <React.Fragment key={group.label}>
                                {gi > 0 && <li aria-hidden="true" style={styles.railDivider} />}
                                {group.items.map(item => {
                                    const isActive = isItemActive(item, location.pathname);
                                    return (
                                        <li key={item.path}>
                                            <a href={item.path}
                                                onClick={e => handleLinkClick(e, item.path)}
                                                aria-current={isActive ? 'page' : undefined}
                                                aria-label={item.label} title={item.label}
                                                className="app-sidebar-link"
                                                style={{
                                                    ...styles.railItem,
                                                    backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                                    borderLeft: isActive ? '3px solid #FFD700' : '3px solid transparent'
                                                }}>
                                                <i className={`bi bi-${item.icon}`} aria-hidden="true"
                                                    style={{ fontSize: '18px', color: isActive ? '#FFD700' : 'rgba(255,255,255,0.7)' }} />
                                            </a>
                                        </li>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </ul>
                ) : visibleGroups.map(group => {
                    const isGroupOpen = !!openGroups[group.label];
                    const groupId = `sidebar-group-${group.label.replace(/\W+/g, '-').toLowerCase()}`;
                    const hasActive = group.label === activeGroupLabel;
                    return (
                        <div key={group.label} style={styles.group}>
                            <button type="button" style={{ ...styles.groupLabel, color: hasActive && !isGroupOpen ? '#FFD700' : styles.groupLabel.color }}
                                onClick={() => toggleGroup(group.label)}
                                aria-expanded={isGroupOpen} aria-controls={groupId}
                                title={hasActive && !isGroupOpen ? 'The page you are on is in this group' : undefined}>
                                <span>{group.label}</span>
                                <i className="bi bi-chevron-right" aria-hidden="true"
                                    style={{ ...styles.chevron, transform: isGroupOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                            </button>
                            {isGroupOpen && (
                                <ul id={groupId} style={styles.list}>
                                    {group.items.map(item => {
                                        const isActive = isItemActive(item, location.pathname);
                                        return (
                                            <li key={item.path}>
                                                <a href={item.path}
                                                    onClick={e => handleLinkClick(e, item.path)}
                                                    aria-current={isActive ? 'page' : undefined}
                                                    className="app-sidebar-link"
                                                    style={{
                                                        ...styles.item,
                                                        backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                                        borderLeft: isActive ? '3px solid #FFD700' : '3px solid transparent',
                                                        color: isActive ? 'white' : 'rgba(255,255,255,0.78)',
                                                        fontWeight: isActive ? 700 : 500
                                                    }}>
                                                    <i className={`bi bi-${item.icon}`} aria-hidden="true"
                                                        style={{ ...styles.itemIcon, color: isActive ? '#FFD700' : 'rgba(255,255,255,0.6)' }} />
                                                    <span style={styles.itemLabel}>{item.label}</span>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </nav>

            <style>{`
                .app-sidebar-link:hover { background-color: rgba(255,255,255,0.08) !important; color: white !important; }
                .app-sidebar-link:focus-visible, .app-sidebar button:focus-visible { outline: 2px solid #FFD700; outline-offset: -2px; }
                .app-sidebar-toggle:hover { color: white !important; background-color: rgba(255,255,255,0.06) !important; }
                @media (prefers-reduced-motion: reduce) { .app-sidebar { transition: none !important; } }
            `}</style>
        </>
    );
}

const styles = {
    backdrop: {
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998
    },
    sidebar: {
        width: '230px',
        // Charcoal grey gradient — no blue
        background: 'linear-gradient(180deg, #2c3037 0%, #24272c 55%, #1f2226 100%)',
        minHeight: 'calc(100vh - 63px)',
        // maxHeight + overflow: a long menu on a short screen now scrolls instead of being cut off
        maxHeight: 'calc(100vh - 63px)', alignSelf: 'flex-start',
        padding: '20px 0', position: 'sticky', top: '63px', flexShrink: 0,
        overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box',
        transition: 'width 0.2s ease'
    },
    toggle: {
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
    },
    toggleText: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' },
    railItem: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '44px', cursor: 'pointer', textDecoration: 'none', transition: 'background-color 0.15s'
    },
    railDivider: { height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '8px 14px' },
    group: { marginBottom: '10px' },
    groupLabel: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        background: 'none', border: 'none', fontFamily: 'inherit',
        color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        padding: '8px 20px', marginBottom: '4px', cursor: 'pointer',
        userSelect: 'none', transition: 'color 0.15s', textAlign: 'left'
    },
    chevron: { fontSize: '11px', transition: 'transform 0.2s ease', display: 'inline-block' },
    list: { listStyle: 'none', margin: 0, padding: 0 },
    item: {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
        textDecoration: 'none', transition: 'background-color 0.15s'
    },
    itemIcon: { fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 },
    itemLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
};

export default Sidebar;
