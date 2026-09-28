import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logo1 from '../assets/logo1.png';
import LoadingScreen from './LoadingScreen';
import { school, rememberPublicInfo } from '../utils/school';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [focused, setFocused] = useState('');
    // A message left by api.js when a session ended (e.g. "Your session has expired")
    const [notice] = useState(() => sessionStorage.getItem('loginNotice') || '');
    // School name, motto and logos from School Settings (public — no login needed).
    // Starts with what was remembered last time, so the page never shows blank.
    const [pub, setPub] = useState(() => school());
    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/settings/public`)
            .then(r => { if (r.data?.name) { setPub(r.data); rememberPublicInfo(r.data); } })
            .catch(() => { /* server asleep or offline — keep the remembered details */ });
    }, []);
    const [error, setError] = useState('');
    useEffect(() => { sessionStorage.removeItem('loginNotice'); }, []);
    const [loading, setLoading] = useState(false);
    const [wakingUp, setWakingUp] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const wakeupTimer = setTimeout(() => setWakingUp(true), 3000);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/auth/login`,
                { username: username.trim(), password },
                { timeout: 90000 }
            );

            clearTimeout(wakeupTimer);
            setWakingUp(false);

            const data = response.data;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('displayName', data.displayName || data.username);
            localStorage.setItem('role', data.role);
            localStorage.setItem('linkedClassId', data.linkedClassId || '');
            localStorage.setItem('linkedClassName', data.linkedClassName || '');
            localStorage.setItem('linkedStream', data.linkedStream || '');

            if (data.mustChangePassword) {
                localStorage.setItem('mustChangePassword', 'true');
                window.location.href = '/change-password';
            } else {
                localStorage.removeItem('mustChangePassword');
                window.location.href = '/dashboard';
            }

        } catch (err) {
            clearTimeout(wakeupTimer);
            setWakingUp(false);
            setLoading(false);

            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                setError('Server took too long to respond. Please try again — it may still be waking up.');
            } else if (err.response?.status === 429) {
                // Locked after too many wrong passwords — the server says for how long
                setError(err.response.data?.message || 'Too many wrong passwords. Please wait 15 minutes and try again.');
            } else if (err.response?.status === 401 || err.response?.status === 400) {
                setError('Invalid username or password');
            } else {
                setError('Unable to connect to server. Please try again in a moment.');
            }
        }
    };

    // Detect Caps Lock while typing the password
    const checkCapsLock = (e) => {
        if (e.getModifierState) setCapsLockOn(e.getModifierState('CapsLock'));
    };

    if (wakingUp) {
        return <LoadingScreen message="Connecting to server" />;
    }

    const fieldStyle = (name) => ({
        ...styles.inputWrap,
        borderColor: focused === name ? '#1F3864' : '#e0e0e0',
        boxShadow: focused === name ? '0 0 0 3px rgba(31,56,100,0.12)' : 'none'
    });

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.leftPanel}>
                    <div style={styles.logoBadge}>
                        <img src={pub.logoLeft || logo1} alt={pub.name || ''} style={styles.logo} />
                    </div>
                    <h1 style={styles.schoolName}>{pub.shortName || pub.name || 'Welcome'}</h1>
                    {pub.motto && <p style={styles.motto}>{pub.motto}</p>}
                    <div style={styles.leftFooter}>
                        <i className="bi bi-mortarboard-fill" aria-hidden="true" style={{ marginRight: '8px' }} />
                        Exam Management System
                    </div>
                </div>

                <div style={styles.rightPanel}>
                    <h2 style={styles.formTitle}>Welcome back</h2>
                    <p style={styles.formSubtitle}>Sign in to continue to your dashboard</p>

                    {notice && !error && (
                        <div role="status" style={{ backgroundColor: '#fff8e1', border: '1px solid #ffc107', color: '#856404', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="bi bi-clock-history" aria-hidden="true" />{notice}
                        </div>
                    )}
                    {error && (
                        <p style={styles.error} role="alert">
                            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ marginRight: '8px' }} />
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleLogin}>
                        <div style={styles.formGroup}>
                            <label htmlFor="username" style={styles.label}>Username</label>
                            <div style={fieldStyle('username')}>
                                <i className="bi bi-person-fill" aria-hidden="true" style={styles.inputIcon} />
                                <input id="username" type="text" value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    onFocus={() => setFocused('username')}
                                    onBlur={() => setFocused('')}
                                    style={styles.input} placeholder="Enter your username"
                                    autoComplete="username" autoCapitalize="none" autoCorrect="off"
                                    spellCheck={false} autoFocus required />
                            </div>
                        </div>

                        <div style={styles.formGroup}>
                            <label htmlFor="password" style={styles.label}>Password</label>
                            <div style={fieldStyle('password')}>
                                <i className="bi bi-lock-fill" aria-hidden="true" style={styles.inputIcon} />
                                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={checkCapsLock}
                                    onKeyUp={checkCapsLock}
                                    onFocus={() => setFocused('password')}
                                    onBlur={() => { setFocused(''); setCapsLockOn(false); }}
                                    style={styles.input} placeholder="Enter your password"
                                    autoComplete="current-password" required />
                                <button type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    style={styles.eyeBtn}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}>
                                    <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} aria-hidden="true" />
                                </button>
                            </div>
                            {capsLockOn && (
                                <p style={styles.capsWarning}>
                                    <i className="bi bi-capslock-fill" aria-hidden="true" style={{ marginRight: '6px' }} />
                                    Caps Lock is on
                                </p>
                            )}
                        </div>

                        <button type="submit" style={{ ...styles.button, opacity: loading ? 0.75 : 1, cursor: loading ? 'wait' : 'pointer' }} disabled={loading}>
                            {loading ? (
                                <>
                                    <span style={styles.spinner} aria-hidden="true" />
                                    Connecting…
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <i className="bi bi-arrow-right" aria-hidden="true" style={{ marginLeft: '8px' }} />
                                </>
                            )}
                        </button>
                    </form>

                    {loading && !wakingUp && (
                        <p style={styles.loadingHint}>Connecting to server, please wait…</p>
                    )}

                    <p style={styles.footer}>
                        © {new Date().getFullYear()} {pub.shortName || pub.name || ''}
                    </p>
                </div>
            </div>
            <style>{`@keyframes login-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const styles = {
    page: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px',
        boxSizing: 'border-box'
    },
    card: {
        display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: '860px',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        backgroundColor: 'white'
    },
    leftPanel: {
        flex: '1 1 45%', minWidth: '280px', backgroundColor: '#1F3864',
        padding: '48px 36px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        boxSizing: 'border-box'
    },
    logoBadge: {
        width: '96px', height: '96px', borderRadius: '50%',
        backgroundColor: 'white', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
    },
    logo: { width: '68px', height: '68px', objectFit: 'contain' },
    schoolName: {
        color: 'white', fontSize: '24px', fontWeight: 700,
        margin: '0 0 12px 0', lineHeight: 1.35, letterSpacing: '0.3px'
    },
    motto: {
        color: '#BDD7EE', fontSize: '14px', fontStyle: 'italic',
        margin: 0, maxWidth: '260px'
    },
    leftFooter: {
        marginTop: '40px', color: 'rgba(255,255,255,0.65)',
        fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center'
    },
    rightPanel: {
        flex: '1 1 55%', minWidth: '280px', padding: '48px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        boxSizing: 'border-box'
    },
    formTitle: { color: '#1F3864', fontSize: '24px', fontWeight: 500, margin: '0 0 6px 0' },
    formSubtitle: { color: '#666', fontSize: '14px', margin: '0 0 24px 0' },
    error: {
        color: '#dc3545', padding: '10px 14px', backgroundColor: '#fff3f3',
        borderRadius: '8px', fontSize: '14px', marginBottom: '18px',
        border: '1px solid #ffd6d6', display: 'flex', alignItems: 'flex-start'
    },
    formGroup: { marginBottom: '18px' },
    label: {
        display: 'block', marginBottom: '6px', fontWeight: 500,
        color: '#333', fontSize: '13px'
    },
    inputWrap: {
        display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0',
        borderRadius: '8px', backgroundColor: 'white',
        transition: 'border-color 0.15s, box-shadow 0.15s'
    },
    inputIcon: { color: '#8a94a6', fontSize: '16px', padding: '0 4px 0 14px' },
    input: {
        flex: 1, minWidth: 0, padding: '12px 14px 12px 8px', border: 'none',
        fontSize: '16px', outline: 'none', fontFamily: 'inherit',
        backgroundColor: 'transparent'
    },
    eyeBtn: {
        background: 'none', border: 'none', cursor: 'pointer', color: '#8a94a6',
        fontSize: '17px', padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center'
    },
    capsWarning: { color: '#b26a00', fontSize: '12px', margin: '6px 0 0 0', display: 'flex', alignItems: 'center' },
    button: {
        width: '100%', padding: '13px', backgroundColor: '#1F3864',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '15px', fontWeight: 500, marginTop: '8px', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    spinner: {
        width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)',
        borderTopColor: 'white', borderRadius: '50%', marginRight: '10px',
        animation: 'login-spin 0.8s linear infinite', display: 'inline-block'
    },
    loadingHint: {
        textAlign: 'center', color: '#666', fontSize: '13px',
        marginTop: '14px', fontStyle: 'italic'
    },
    footer: {
        textAlign: 'center', color: '#999', fontSize: '12px',
        marginTop: '28px', marginBottom: 0
    }
};

export default Login;
