import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { schoolShortName, logoLeftUrl, logoRightUrl } from '../utils/school';
import { useSchoolSettings } from '../context/SchoolSettingsContext';

const MIN_LENGTH = 8; // same rule as when an admin creates a user
const KEEP_ON_LOGOUT = ['sidebarCollapsed', 'sidebarOpenGroups'];

const Icon = ({ name, style }) => <i className={`bi bi-${name}`} aria-hidden="true" style={{ marginRight: '6px', ...style }} />;

// The server may send back a string OR an object like {message: "..."} — never render an object
const serverMessage = (err, fallback) => {
    const d = err?.response?.data;
    if (typeof d === 'string' && d.trim() && d.length < 300) return d;
    return d?.message || d?.error || fallback;
};

const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '#ddd' };
    let score = 0;
    if (pwd.length >= MIN_LENGTH) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length < MIN_LENGTH) return { score: 1, label: 'Too short', color: '#dc3545' };
    if (score <= 2) return { score: 2, label: 'Fair', color: '#ffc107' };
    if (score === 3) return { score: 3, label: 'Good', color: '#2E75B6' };
    return { score: 4, label: 'Strong', color: '#28a745' };
};

// Password field with show/hide and Caps Lock warning — outside the page so typing doesn't lose focus
const PasswordField = ({ id, label, icon, value, onChange, show, onToggle, placeholder, autoComplete, borderColor, autoFocus }) => {
    const [caps, setCaps] = useState(false);
    const checkCaps = (e) => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); };
    return (
        <div style={styles.formGroup}>
            <label htmlFor={id} style={styles.label}><Icon name={icon} />{label}</label>
            <div style={styles.inputWrapper}>
                <input id={id} type={show ? 'text' : 'password'} value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => setCaps(false)}
                    style={{ ...styles.input, borderColor: borderColor || '#e0e0e0' }}
                    placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus} required />
                <button type="button" style={styles.eyeBtn} onClick={onToggle}
                    aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
                    <i className={`bi bi-${show ? 'eye-slash-fill' : 'eye-fill'}`} aria-hidden="true" />
                </button>
            </div>
            {caps && <p style={styles.capsWarning}><Icon name="capslock-fill" />Caps Lock is on</p>}
        </div>
    );
};

function ChangePassword() {
    useSchoolSettings();   // re-draws when the school details have loaded
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const displayName = localStorage.getItem('displayName') || username;
    const role = localStorage.getItem('role');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const [isForced] = useState(() => localStorage.getItem('mustChangePassword') === 'true');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Not logged in at all → back to login
    useEffect(() => { if (!username) navigate('/', { replace: true }); }, [username, navigate]);

    // Forced change: warn before leaving without changing (switched off once the change succeeds)
    useEffect(() => {
        if (!isForced || done) return;
        const h = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [isForced, done]);

    const strength = getStrength(newPassword);
    const checks = [
        { ok: newPassword.length >= MIN_LENGTH, text: `At least ${MIN_LENGTH} characters`, required: true },
        { ok: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword), text: 'Upper & lower case' },
        { ok: /[0-9]/.test(newPassword), text: 'A number' },
        { ok: /[^A-Za-z0-9]/.test(newPassword), text: 'A symbol' },
    ];
    const matches = confirmPassword && confirmPassword === newPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || done) return;
        setError(''); setSuccess('');

        if (newPassword.length < MIN_LENGTH) { setError(`New password must be at least ${MIN_LENGTH} characters.`); return; }
        if (newPassword !== confirmPassword) { setError('The two new passwords do not match.'); return; }
        if (newPassword === currentPassword) { setError('Your new password must be different from your current one.'); return; }
        if (username && newPassword.toLowerCase().includes(username.toLowerCase())) { setError('Your new password must not contain your username.'); return; }
        if (/^\+?\d{9,13}$/.test(newPassword.replace(/\s/g, ''))) { setError('Please don\'t use a phone number as your password — others may know it.'); return; }

        setLoading(true);
        try {
            const res = await api.post('/api/auth/change-password', { username, currentPassword, newPassword });
            // Changing the password ends every older session — keep the fresh one for this device
            if (res?.data?.token) localStorage.setItem('token', res.data.token);
            localStorage.removeItem('mustChangePassword');
            setDone(true);
            setSuccess('Password changed successfully! Taking you to the dashboard…');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
        } catch (err) {
            const status = err.response?.status;
            setError(status === 401 || status === 400 || status === 403
                ? serverMessage(err, 'Your current password is not correct.')
                : serverMessage(err, 'Could not change your password. Check your connection and try again.'));
            setLoading(false);
        }
    };

    const handleLogout = () => {
        const kept = {};
        KEEP_ON_LOGOUT.forEach(k => { const v = localStorage.getItem(k); if (v !== null) kept[k] = v; });
        localStorage.clear();
        Object.entries(kept).forEach(([k, v]) => localStorage.setItem(k, v));
        setDone(true); // don't show the "leave site?" warning when logging out on purpose
        navigate('/', { replace: true });
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logoRow}>
                    <img src={logoLeftUrl()} alt="" style={styles.logo} />
                    <img src={logoRightUrl()} alt="" style={styles.logo} />
                </div>
                <h2 style={styles.schoolName}>{schoolShortName().toUpperCase()}</h2>

                {isForced ? (
                    <div style={styles.forcedBanner}>
                        <i className="bi bi-shield-lock-fill" aria-hidden="true" style={styles.forcedIcon} />
                        <div>
                            <strong style={styles.forcedTitle}>Welcome, {displayName}!</strong>
                            <p style={styles.forcedMsg}>
                                {linkedClassName && <>Class Teacher — {linkedClassName}<br /></>}
                                Your account was created with a temporary password. Please choose your own password before continuing.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={styles.normalHeader}>
                        <h3 style={styles.title}><Icon name="key-fill" />Change Password</h3>
                        <p style={styles.subtitle}>Logged in as <strong>{displayName}</strong>{role ? ` (${role})` : ''}</p>
                    </div>
                )}

                {error && <p style={styles.error} role="alert"><Icon name="exclamation-triangle-fill" />{error}</p>}
                {success && <p style={styles.successMsg} role="status"><Icon name="check-circle-fill" />{success}</p>}

                <form onSubmit={handleSubmit} noValidate={false}>
                    {/* Hidden username helps password managers save the new password against the right account */}
                    <input type="text" name="username" autoComplete="username" value={username || ''} readOnly hidden />

                    <PasswordField id="current-password"
                        label={isForced ? 'Temporary Password' : 'Current Password'} icon="key-fill"
                        value={currentPassword} onChange={setCurrentPassword}
                        show={showCurrent} onToggle={() => setShowCurrent(s => !s)}
                        placeholder={isForced ? 'The password you logged in with' : 'Enter current password'}
                        autoComplete="current-password" autoFocus />
                    {isForced && <p style={{ ...styles.hint, marginTop: '-14px', marginBottom: '20px' }}>This is the password you just used to log in.</p>}

                    <PasswordField id="new-password" label="New Password" icon="lock-fill"
                        value={newPassword} onChange={setNewPassword}
                        show={showNew} onToggle={() => setShowNew(s => !s)}
                        placeholder="Enter new password" autoComplete="new-password" />
                    <div style={{ marginTop: '-12px', marginBottom: '20px' }}>
                        {newPassword && (
                            <div style={styles.strengthMeter}>
                                <div style={styles.strengthBarOuter}>
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} style={{ ...styles.strengthBarSegment, backgroundColor: i <= strength.score ? strength.color : '#e9ecef' }} />
                                    ))}
                                </div>
                                <span style={{ ...styles.strengthLabel, color: strength.color }}>{strength.label}</span>
                            </div>
                        )}
                        <div style={styles.requirements}>
                            {checks.map(c => (
                                <span key={c.text} style={{ color: c.ok ? '#28a745' : c.required ? '#dc3545' : '#999', display: 'inline-flex', alignItems: 'center' }}>
                                    <i className={`bi bi-${c.ok ? 'check-circle-fill' : c.required ? 'x-circle' : 'circle'}`} aria-hidden="true" style={{ marginRight: '4px' }} />
                                    {c.text}{c.required ? ' (required)' : ''}
                                </span>
                            ))}
                        </div>
                    </div>

                    <PasswordField id="confirm-password" label="Confirm New Password" icon="lock-fill"
                        value={confirmPassword} onChange={setConfirmPassword}
                        show={showConfirm} onToggle={() => setShowConfirm(s => !s)}
                        placeholder="Type the new password again" autoComplete="new-password"
                        borderColor={confirmPassword ? (matches ? '#28a745' : '#dc3545') : undefined} />
                    {confirmPassword && (
                        <p style={{ color: matches ? '#28a745' : '#dc3545', fontSize: '12px', margin: '-14px 0 20px 0', fontWeight: 500 }}>
                            <Icon name={matches ? 'check-circle-fill' : 'x-circle-fill'} />{matches ? 'Passwords match' : 'Passwords do not match'}
                        </p>
                    )}

                    <button type="submit" style={{ ...styles.submitBtn, opacity: loading || done ? 0.75 : 1 }} disabled={loading || done}>
                        {loading ? <><Icon name="hourglass-split" />Changing password…</> : done ? <><Icon name="check-circle-fill" />Done</> : <><Icon name="shield-lock-fill" />Change Password</>}
                    </button>

                    {isForced ? (
                        <button type="button" onClick={handleLogout} style={styles.cancelBtn} disabled={loading}>
                            <Icon name="box-arrow-right" />Not you? Log out
                        </button>
                    ) : (
                        <button type="button" onClick={() => navigate('/dashboard')} style={styles.cancelBtn} disabled={loading}>
                            <Icon name="arrow-left" />Back to Dashboard
                        </button>
                    )}
                </form>

                <p style={styles.footer}>© {new Date().getFullYear()} {schoolShortName()}</p>
            </div>
        </div>
    );
}

const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px', boxSizing: 'border-box' },
    card: { backgroundColor: 'white', padding: '40px 36px', borderRadius: '18px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', width: '100%', maxWidth: '460px', boxSizing: 'border-box' },
    logoRow: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '12px' },
    logo: { width: '60px', height: '60px', objectFit: 'contain' },
    schoolName: { textAlign: 'center', color: '#1F3864', fontSize: '15px', fontWeight: 700, margin: '0 0 18px 0', letterSpacing: '0.3px' },

    forcedBanner: { backgroundColor: '#e3f2fd', border: '1.5px solid #2E75B6', borderRadius: '14px', padding: '16px', marginBottom: '22px', display: 'flex', gap: '12px', alignItems: 'flex-start' },
    forcedIcon: { fontSize: '28px', flexShrink: 0, color: '#1F3864' },
    forcedTitle: { color: '#1F3864', fontSize: '15px', display: 'block', marginBottom: '4px', fontWeight: 700 },
    forcedMsg: { color: '#555', fontSize: '13px', margin: 0, lineHeight: '1.5' },

    normalHeader: { marginBottom: '22px', textAlign: 'center' },
    title: { color: '#1F3864', margin: '0 0 5px 0', fontWeight: 700 },
    subtitle: { color: '#666', fontSize: '13px', margin: 0 },

    error: { color: '#dc3545', padding: '12px 16px', backgroundColor: '#fff3f3', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', border: '1px solid #ffd6d6' },
    successMsg: { color: '#155724', padding: '12px 16px', backgroundColor: '#d4edda', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', textAlign: 'center' },

    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '7px', fontWeight: 700, color: '#1F3864', fontSize: '13px' },
    inputWrapper: { position: 'relative' },
    input: { width: '100%', padding: '13px 45px 13px 14px', borderRadius: '10px', border: '1.5px solid #e0e0e0', fontSize: '16px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#fafbfc', fontFamily: 'inherit' },
    eyeBtn: { position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '17px', padding: '6px 8px', color: '#8a94a6' },
    capsWarning: { color: '#b26a00', fontSize: '12px', margin: '6px 0 0 0' },
    hint: { color: '#888', fontSize: '12px', fontStyle: 'italic' },

    strengthMeter: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
    strengthBarOuter: { display: 'flex', gap: '4px', flex: 1 },
    strengthBarSegment: { height: '5px', flex: 1, borderRadius: '3px', transition: 'background-color 0.3s' },
    strengthLabel: { fontSize: '12px', fontWeight: 700, minWidth: '64px' },
    requirements: { display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: '10px', fontSize: '12px' },

    submitBtn: { width: '100%', padding: '14px', backgroundColor: '#1F3864', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', cursor: 'pointer', fontWeight: 700, marginBottom: '10px', boxShadow: '0 4px 14px rgba(31,56,100,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { width: '100%', padding: '11px', backgroundColor: 'transparent', color: '#555', border: '1.5px solid #e0e0e0', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    footer: { textAlign: 'center', color: '#888', fontSize: '12px', marginTop: '22px', marginBottom: 0 }
};

export default ChangePassword;
