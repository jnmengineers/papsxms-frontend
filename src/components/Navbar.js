import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo1 from '../assets/logo1.png';

function Navbar({ rightContent }) {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

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
                    <span style={styles.navUser}>{username} <span style={styles.roleTag}>{role}</span></span>
                )}
                {username && (
                    <button onClick={() => navigate('/change-password')} style={styles.pwdBtn}>Password</button>
                )}
                {username && (
                    <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
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
    navUser: {
        color: 'white', fontSize: '13px', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '6px'
    },
    roleTag: {
        backgroundColor: 'rgba(255,215,0,0.15)', color: '#FFD700',
        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
    },
    pwdBtn: {
        backgroundColor: 'transparent', color: 'white',
        border: '1.5px solid rgba(255,255,255,0.4)', padding: '7px 14px',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
        fontFamily: 'inherit'
    },
    logoutBtn: {
        backgroundColor: 'rgba(255,255,255,0.12)', color: 'white', border: 'none',
        padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit'
    }
};

export default Navbar;