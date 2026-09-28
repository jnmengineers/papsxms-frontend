import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { schoolShortName, logoLeftUrl } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import NoticeBell from './NoticeBell';

// Charcoal grey gradient — no blue. For a flat grey use '#2c3037'.
const NAV_BG = 'linear-gradient(90deg, #2c3037 0%, #3a3f47 100%)';

// Screen preferences that should survive logging out
const KEEP_ON_LOGOUT = ['sidebarCollapsed', 'sidebarOpenGroups'];

function Navbar({ rightContent }) {
    useSchoolSettings();   // re-draws when the school details have loaded
    const navigate = useNavigate();
    const location = useLocation();
    const username = localStorage.getItem('username');
    const displayName = localStorage.getItem('displayName') || username;
    const role = localStorage.getItem('role');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);
    const { isOpen, setIsOpen } = useSidebar();

    // Close the user menu on outside click/tap or Esc
    useEffect(() => {
        if (!menuOpen) return;
        const onPointer = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus(); } };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
    }, [menuOpen]);

    // ...and whenever the page changes
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const handleLogout = () => {
        // Clear the login (token, role, class) but keep harmless screen preferences
        const kept = {};
        KEEP_ON_LOGOUT.forEach(k => { const v = localStorage.getItem(k); if (v !== null) kept[k] = v; });
        localStorage.clear();
        Object.entries(kept).forEach(([k, v]) => localStorage.setItem(k, v));
        setMenuOpen(false);
        navigate('/', { replace: true }); // replace: Back can't return to a logged-in page
    };

    const goHome = (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow open-in-new-tab
        e.preventDefault();
        navigate('/dashboard');
    };

    return (
        <header style={styles.navbar} className="app-navbar">
            <div style={styles.navLeftGroup}>
                <button type="button" className="app-hamburger" style={styles.hamburger}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen}>
                    <i className={`bi bi-${isOpen ? 'x-lg' : 'list'}`} aria-hidden="true" />
                </button>
                <a href="/dashboard" onClick={goHome} style={styles.navLeft} aria-label={`${schoolShortName() || 'Home'} — go to Dashboard`}>
                    <div style={styles.logoBadge}>
                        <img src={logoLeftUrl()} alt="" style={styles.navLogo} />
                    </div>
                    <span style={styles.navTitle} className="app-nav-title">{schoolShortName()}</span>
                </a>
            </div>

            <div style={styles.navRight}>
                {rightContent}
                {username && <NoticeBell />}
                {username && (
                    <div style={styles.userMenuWrap} ref={menuRef}>
                        <button type="button" ref={triggerRef} className="app-user-trigger" style={styles.userTrigger}
                            onClick={() => setMenuOpen(o => !o)}
                            aria-haspopup="menu" aria-expanded={menuOpen}
                            aria-label={`Account menu for ${displayName}`}>
                            <div style={styles.avatar} aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div>
                            <span style={styles.navUser} className="app-nav-user">{displayName}</span>
                            {role && <span style={styles.roleTag} className="app-nav-role">{role}</span>}
                            <i className={`bi bi-chevron-${menuOpen ? 'up' : 'down'}`} aria-hidden="true" style={styles.chevron} />
                        </button>
                        {menuOpen && (
                            <div style={styles.dropdown} role="menu">
                                <div style={styles.dropdownHeader}>
                                    <div style={styles.dropdownName}>{displayName}</div>
                                    {role && <div style={styles.dropdownRole}>{role.charAt(0) + role.slice(1).toLowerCase()}</div>}
                                </div>
                                <button type="button" role="menuitem" className="app-dropdown-item" style={styles.dropdownItem}
                                    onClick={() => { setMenuOpen(false); navigate('/change-password'); }}>
                                    <i className="bi bi-key-fill" aria-hidden="true" style={styles.itemIcon} />Change Password
                                </button>
                                <button type="button" role="menuitem" className="app-dropdown-item" style={{ ...styles.dropdownItem, color: '#dc3545' }}
                                    onClick={handleLogout}>
                                    <i className="bi bi-box-arrow-right" aria-hidden="true" style={styles.itemIcon} />Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .app-user-trigger:hover { background-color: rgba(255,255,255,0.1) !important; }
                .app-dropdown-item:hover { background-color: #f3f4f6 !important; }
                .app-navbar button:focus-visible, .app-navbar a:focus-visible { outline: 2px solid #FFD700; outline-offset: 2px; }
                /* Phones: keep everything on one line — show just the avatar, shorten the title */
                @media (max-width: 768px) {
                    .app-nav-user, .app-nav-role { display: none; }
                    .app-nav-title { font-size: 15px !important; }
                }
                @media (max-width: 400px) { .app-nav-title { display: none; } }
                @media print { .app-navbar { display: none !important; } }
            `}</style>
        </header>
    );
}

const styles = {
    navbar: {
        background: NAV_BG, padding: '12px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '10px', minHeight: '63px', boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        position: 'sticky', top: 0, zIndex: 1000
    },
    navLeftGroup: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
    navLeft: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', minWidth: 0 },
    logoBadge: {
        width: '38px', height: '38px', borderRadius: '50%',
        backgroundColor: 'white', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0
    },
    hamburger: {
        display: 'none', background: 'none', border: 'none', color: 'white',
        fontSize: '24px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1
    },
    navLogo: { width: '26px', height: '26px', objectFit: 'contain' },
    navTitle: { color: 'white', fontSize: '17px', fontWeight: 700, letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    navRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
    userMenuWrap: { position: 'relative' },
    userTrigger: {
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
        padding: '6px 10px', borderRadius: '8px', transition: 'background-color 0.15s',
        background: 'none', border: 'none', fontFamily: 'inherit'
    },
    avatar: {
        width: '30px', height: '30px', borderRadius: '50%',
        backgroundColor: '#FFD700', color: '#2c3037', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '13px',
        fontWeight: 700, flexShrink: 0
    },
    navUser: { color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    roleTag: {
        backgroundColor: 'rgba(255,215,0,0.15)', color: '#FFD700',
        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
    },
    chevron: { color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginLeft: '2px' },
    dropdown: {
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        backgroundColor: 'white', borderRadius: '10px', minWidth: '200px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 1001
    },
    dropdownHeader: { padding: '12px 16px', borderBottom: '1px solid #eee', backgroundColor: '#f8f9fa' },
    dropdownName: { fontWeight: 700, color: '#333', fontSize: '14px', wordBreak: 'break-all' },
    dropdownRole: { color: '#888', fontSize: '12px', marginTop: '2px' },
    dropdownItem: {
        display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
        padding: '12px 16px', fontSize: '14px', color: '#333', background: 'white', border: 'none',
        cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', transition: 'background-color 0.15s'
    },
    itemIcon: { marginRight: '10px', fontSize: '15px', width: '16px' }
};

export default Navbar;
