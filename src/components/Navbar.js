import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { schoolShortName, schoolMotto, logoLeftUrl } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';
import NoticeBell from './NoticeBell';
import BackButton, { useTrailRecorder } from './BackButton';
import { ROLE_LABELS, myRoles } from '../utils/roles';

// Charcoal grey gradient — no blue. For a flat grey use '#2c3037'.
const NAV_BG = 'linear-gradient(90deg, #2c3037 0%, #3a3f47 100%)';

// Brand animation: name and motto rise in (once per login); the motto glides left to right
// under the name (pauses while the mouse is over it).
// Switched off for people whose computer asks for reduced motion.
const NAV_CSS = `
    @keyframes papsNavRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    /* Motto glides left → right across the WHOLE strip under the name: starts just out of view on the
       left, ends just out of view on the right (100cqw = the strip's width), then starts again */
    @keyframes papsMottoSlide { from { transform: translateX(-100%); } to { transform: translateX(100cqw); } }
    @keyframes papsMottoShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .app-brand .app-brand-logo { transition: transform .35s ease; }
    .app-brand:hover .app-brand-logo { transform: rotate(-8deg) scale(1.08); }
    .app-brand.rise .app-brand-logo { animation: papsNavRise .5s ease-out both; }
    .app-brand.rise .app-brand-name { animation: papsNavRise .6s ease-out .1s both; }
    .app-brand.rise .app-brand-motto { animation: papsNavRise .6s ease-out .35s both; }
    .app-brand-motto {
        display: block; width: 100%; overflow: hidden; container-type: inline-size; text-align: left;
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 12%, #000 88%, transparent 100%);
        mask-image: linear-gradient(90deg, transparent 0, #000 12%, #000 88%, transparent 100%);
    }
    .app-brand-motto span {
        display: inline-block; white-space: nowrap; will-change: transform;
        background: linear-gradient(90deg, #FFD700 0%, #FFD700 38%, #fff8d6 50%, #FFD700 62%, #FFD700 100%);
        background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
        animation: papsMottoSlide 14s linear infinite, papsMottoShimmer 7s linear infinite;
    }
    /* Older browsers without container units: glide by the motto's own width instead */
    @supports not (container-type: inline-size) {
        @keyframes papsMottoSlideOld { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        .app-brand-motto span { animation: papsMottoSlideOld 14s linear infinite; color: #FFD700; }
    }
    .app-brand:hover .app-brand-motto span { animation-play-state: paused; }
    @media (max-width: 720px) {
        .app-navbar { padding: 8px 10px !important; gap: 6px !important; grid-template-columns: auto minmax(0, 1fr) auto !important; min-height: 60px !important; }
        .app-brand { gap: 8px !important; min-width: 0; }
        .app-brand-motto { display: none !important; }
        .app-brand-name { font-size: 15px !important; max-width: 100% !important; }
        .app-brand .app-brand-logo { width: 34px !important; height: 34px !important; }
        .app-nav-user, .app-nav-role { display: none !important; }
    }
    @media (prefers-reduced-motion: reduce) {
        .app-brand *, .app-brand-motto span { animation: none !important; transition: none !important; transform: none !important; }
        .app-brand-motto { -webkit-mask-image: none; mask-image: none; text-align: center; }
    }
`;
// Rise in only the first time the bar appears after logging in (not on every page)
const firstShowThisLogin = () => {
    try { if (sessionStorage.getItem('papsNavShown')) return false; sessionStorage.setItem('papsNavShown', '1'); return true; } catch (e) { return false; }
};

// Screen preferences that should survive logging out
const KEEP_ON_LOGOUT = ['sidebarCollapsed', 'sidebarOpenGroups'];

function Navbar({ rightContent }) {
    useTrailRecorder();   // remembers each page visited, for the Back button
    useSchoolSettings();   // re-draws when the school details have loaded
    const navigate = useNavigate();
    const location = useLocation();
    const username = localStorage.getItem('username');
    const displayName = localStorage.getItem('displayName') || username;
    const role = localStorage.getItem('role');
    // Shown on the account button: the person's main role, by name (Treasurer, Super admin…)
    const roleName = ROLE_LABELS[localStorage.getItem('mainRole') || role] || role;
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);
    const { isOpen, setIsOpen } = useSidebar();
    const [rise] = useState(firstShowThisLogin);
    const motto = schoolMotto();

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
        try { sessionStorage.removeItem('papsNavShown'); } catch (e) { /* not essential */ }
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
            <style>{NAV_CSS}</style>
            {/* Left: menu (phones) and Back */}
            <div style={styles.navLeftGroup}>
                <button type="button" className="app-hamburger" style={styles.hamburger}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen}>
                    <i className={`bi bi-${isOpen ? 'x-lg' : 'list'}`} aria-hidden="true" />
                </button>
                <BackButton />
            </div>

            {/* Centre: school logo, name and motto */}
            <a href="/dashboard" onClick={goHome} className={`app-brand${rise ? ' rise' : ''}`} style={styles.brand}
                aria-label={`${schoolShortName() || 'Home'} — go to Dashboard`}>
                <div style={styles.logoBadge} className="app-brand-logo">
                    <img src={logoLeftUrl()} alt="" style={styles.navLogo} />
                </div>
                <div style={styles.brandText}>
                    <span style={styles.navTitle} className="app-nav-title app-brand-name">{schoolShortName()}</span>
                    {motto && <span style={styles.motto} className="app-brand-motto"><span>{motto}</span></span>}
                </div>
            </a>

            {/* Right: notices and account */}
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
                            {role && <span style={styles.roleTag} className="app-nav-role">{String(roleName).toUpperCase()}</span>}
                            <i className={`bi bi-chevron-${menuOpen ? 'up' : 'down'}`} aria-hidden="true" style={styles.chevron} />
                        </button>
                        {menuOpen && (
                            <div style={styles.dropdown} role="menu">
                                <div style={styles.dropdownHeader}>
                                    <div style={styles.dropdownName}>{displayName}</div>
                                    {role && <div style={styles.dropdownRole}>{myRoles().filter(r => r !== 'ADMIN' || !myRoles().includes('SUPER_ADMIN')).filter(r => r !== 'ACCOUNTANT' || !myRoles().includes('TREASURER')).map(r => ROLE_LABELS[r] || r).join(' · ')}</div>}
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
        background: NAV_BG, padding: '10px 28px',
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center',
        gap: '12px', minHeight: '72px', boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        position: 'sticky', top: 0, zIndex: 1000
    },
    navLeftGroup: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, justifySelf: 'start' },
    brand: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textDecoration: 'none', minWidth: 0, justifySelf: 'center' },
    brandText: { display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, minWidth: 0 },
    motto: { fontSize: '12.5px', fontStyle: 'italic', letterSpacing: '0.4px', marginTop: '3px', whiteSpace: 'nowrap', maxWidth: '46vw', minWidth: '240px' },
    logoBadge: {
        width: '44px', height: '44px', borderRadius: '50%', boxShadow: '0 0 0 3px rgba(255,215,0,0.35)',
        backgroundColor: 'white', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0
    },
    hamburger: {
        display: 'none', background: 'none', border: 'none', color: 'white',
        fontSize: '24px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1
    },
    navLogo: { width: '32px', height: '32px', objectFit: 'contain' },
    navTitle: { color: 'white', fontSize: '21px', fontWeight: 800, letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46vw' },
    navRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, justifySelf: 'end' },
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
