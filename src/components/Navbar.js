import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo1 from '../assets/logo1.png';

function Navbar({ rightContent }) {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => { localStorage.clear(); navigate('/'); };

    return (
        <div style={styles.navbar}>
            <div style={styles.navLeft} onClick={() => navigate('/dashboard')}>
                <div style={styles.logoBadge}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                </div>
                <span style={styles.navTitle}>Pipeline Adventist School</span>
            </div>
            <div style={styles.navRight}>
                {rightContent}
                {username && (
                    <div style={styles.userMenuWrap} ref={menuRef}>
                        <div style={styles.userTrigger} onClick={() => setMenuOpen(!menuOpen)}>
                            <div style={styles.avatar}>{username.charAt(0).toUpperCase()}</div>
                            <span style={styles.navUser}>{username}</span>
                            <span style={styles.roleTag}>{role}</span>
                            <span style={styles.chevron}>{menuOpen ? '▲' : '▼'}</span>
                        </div>
                        {menuOpen && (
                            <div style={styles.dropdown}>
                                <div style={styles.dropdownItem}
                                    onClick={() => { setMenuOpen(false); navigate('/change-password'); }}>
                                    Change Password
                                </div>
                                <div style={{ ...styles.dropdownItem, color: '#dc3545' }}
                                    onClick={handleLogout}>
                                    Logout
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    navbar: {
        backgroundColor: '#1F3864', padding: '12px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        position: 'sticky', top: 0, zIndex: 1000
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
    logoBadge: {
        width: '38px', height: '38px', borderRadius: '50%',
        backgroundColor: 'white', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0
    },
    navLogo: { width: '26px', height: '26px', objectFit: 'contain' },
    navTitle: { color: 'white', fontSize: '17px', fontWeight: 700, letterSpacing: '0.2px' },
    navRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    userMenuWrap: { position: 'relative' },
    userTrigger: {
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
        padding: '6px 10px', borderRadius: '8px', transition: 'background-color 0.15s'
    },
    avatar: {
        width: '28px', height: '28px', borderRadius: '50%',
        backgroundColor: '#FFD700', color: '#1F3864', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '13px',
        fontWeight: 700, flexShrink: 0
    },
    navUser: { color: 'white', fontSize: '13px', fontWeight: 500 },
    roleTag: {
        backgroundColor: 'rgba(255,215,0,0.15)', color: '#FFD700',
        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
    },
    chevron: { color: 'rgba(255,255,255,0.6)', fontSize: '9px', marginLeft: '2px' },
    dropdown: {
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        backgroundColor: 'white', borderRadius: '10px', minWidth: '180px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 1001
    },
    dropdownItem: {
        padding: '12px 16px', fontSize: '14px', color: '#333',
        cursor: 'pointer', fontWeight: 500, transition: 'background-color 0.15s'
    }
};

export default Navbar;