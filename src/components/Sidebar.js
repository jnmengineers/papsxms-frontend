import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role');
    const { isOpen, setIsOpen } = useSidebar();

    const groups = [
        {
            label: 'Overview',
            items: [
                { icon: '🏠', label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
            ]
        },
        {
            label: 'People',
            items: [
                { icon: '🎓', label: 'Students', path: '/students', roles: ['ADMIN', 'TEACHER'] },
                { icon: '👨\u200d🏫', label: 'Teachers', path: '/teachers', roles: ['ADMIN'] },
                { icon: '👤', label: 'Users', path: '/users', roles: ['ADMIN'] },
            ]
        },
        {
            label: 'Academic Setup',
            items: [
                { icon: '🏫', label: 'Classes', path: '/classes', roles: ['ADMIN'] },
                { icon: '📚', label: 'Subjects', path: '/subjects', roles: ['ADMIN'] },
                { icon: '🔗', label: 'Class Subjects', path: '/class-subjects', roles: ['ADMIN'] },
                { icon: '📅', label: 'Academic Years', path: '/academic-years', roles: ['ADMIN'] },
                { icon: '🗓️', label: 'Exam Schedules', path: '/exam-schedules', roles: ['ADMIN'] },
                { icon: '📊', label: 'Grading Scales', path: '/grading-scales', roles: ['ADMIN'] },
            ]
        },
        {
            label: 'Exams & Results',
            items: [
                { icon: '📝', label: 'Exams', path: '/exams', roles: ['ADMIN'] },
                { icon: '✏️', label: 'Mark Entry', path: '/mark-entry', roles: ['ADMIN', 'TEACHER'] },
                { icon: '📊', label: 'Results', path: '/results', roles: ['ADMIN', 'TEACHER', 'CLERK'] },
                { icon: '📋', label: 'Report Cards', path: '/reportcards', roles: ['ADMIN', 'TEACHER'] },
                { icon: '📈', label: 'Progressive Report', path: '/progressive-report', roles: ['ADMIN', 'TEACHER'] },
                { icon: '📈', label: 'Section Report', path: '/section-report', roles: ['ADMIN'] },
            ]
        },
        {
            label: 'Admin',
            items: [
                { icon: '📥', label: 'Import Data', path: '/import', roles: ['ADMIN'] },
            ]
        },
    ];

    const visibleGroups = groups
        .map(group => ({
            ...group,
            items: group.items.filter(item => item.roles.includes(role))
        }))
        .filter(group => group.items.length > 0);

    // Determine which group contains the current active page, so it starts open
    const activeGroupLabel = visibleGroups.find(group =>
        group.items.some(item =>
            location.pathname === item.path ||
            (item.path === '/students' && location.pathname.startsWith('/student/'))
        )
    )?.label;

    const [openGroups, setOpenGroups] = useState(() => {
        const initial = {};
        visibleGroups.forEach(group => {
            initial[group.label] = group.label === activeGroupLabel || group.label === 'Overview';
        });
        return initial;
    });

    // Keep the active page's group open if the route changes externally (e.g. via a link click elsewhere)
    useEffect(() => {
        if (activeGroupLabel) {
            setOpenGroups(prev => ({ ...prev, [activeGroupLabel]: true }));
        }
    }, [activeGroupLabel]);

    const toggleGroup = (label) => {
        setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const handleNavigate = (path) => {
        navigate(path);
        setIsOpen(false); // auto-close on mobile after navigating
    };

    return (
        <>
            {/* Mobile backdrop — only visible when sidebar is open on small screens */}
            {isOpen && (
                <div className="app-backdrop" style={styles.backdrop} onClick={() => setIsOpen(false)} />
            )}
            <div className={`app-sidebar${isOpen ? ' open' : ''}`} style={styles.sidebar}>
                {visibleGroups.map((group, gi) => {
                    const isGroupOpen = openGroups[group.label];
                    return (
                        <div key={gi} style={styles.group}>
                            <div
                                style={styles.groupLabel}
                                onClick={() => toggleGroup(group.label)}>
                                <span>{group.label}</span>
                                <span style={{ ...styles.chevron, transform: isGroupOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                            </div>
                            {isGroupOpen && group.items.map((item, ii) => {
                                const isActive = location.pathname === item.path ||
                                    (item.path === '/students' && location.pathname.startsWith('/student/'));
                                return (
                                    <div key={ii}
                                        onClick={() => handleNavigate(item.path)}
                                        style={{
                                            ...styles.item,
                                            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                            borderLeft: isActive ? '3px solid #FFD700' : '3px solid transparent',
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.75)'
                                        }}>
                                        <span style={styles.itemIcon}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
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
        width: '230px', backgroundColor: '#16294d', minHeight: 'calc(100vh - 63px)',
        padding: '20px 0', position: 'sticky', top: '63px', flexShrink: 0,
        overflowY: 'auto'
    },
    group: { marginBottom: '10px' },
    groupLabel: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        padding: '8px 20px', marginBottom: '4px', cursor: 'pointer',
        userSelect: 'none', transition: 'color 0.15s'
    },
    chevron: {
        fontSize: '13px', transition: 'transform 0.2s ease', display: 'inline-block'
    },
    item: {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
        transition: 'background-color 0.15s'
    },
    itemIcon: { fontSize: '16px', width: '20px', textAlign: 'center' }
};

export default Sidebar;