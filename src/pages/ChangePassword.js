import React, { useState, useEffect } from 'react';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';

function ChangePassword() {
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    const linkedClassName = localStorage.getItem('linkedClassName');
    const isForced = localStorage.getItem('mustChangePassword') === 'true';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // If forced change — block navigation away
    useEffect(() => {
        if (isForced) {
            window.onbeforeunload = () => true;
        }
        return () => { window.onbeforeunload = null; };
    }, [isForced]);

    const getStrength = (pwd) => {
        if (!pwd) return { score: 0, label: '', color: '#ddd' };
        let score = 0;
        if (pwd.length >= 8) score++;
        if (pwd.length >= 12) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        if (score <= 1) return { score, label: 'Weak', color: '#dc3545' };
        if (score <= 2) return { score, label: 'Fair', color: '#ffc107' };
        if (score <= 3) return { score, label: 'Good', color: '#2E75B6' };
        return { score, label: 'Strong', color: '#28a745' };
    };

    const strength = getStrength(newPassword);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }
        if (isForced && newPassword === currentPassword) {
            setError('New password must be different from your default password');
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/auth/change-password', {
                username,
                currentPassword,
                newPassword
            });

            // ✅ Clear the force-change flag
            localStorage.removeItem('mustChangePassword');
            setSuccess('✅ Password changed successfully! Redirecting...');

            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } catch (err) {
            setError(err.response?.data || 'Failed to change password. Check your current password.');
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Header */}
                <div style={styles.logoRow}>
                    <img src={logo1} alt="Logo 1" style={styles.logo} />
                    <img src={logo2} alt="Logo 2" style={styles.logo} />
                </div>
                <h2 style={styles.schoolName}>PIPELINE ADVENTIST SCHOOL</h2>

                {/* Forced change banner */}
                {isForced && (
                    <div style={styles.forcedBanner}>
                        <div style={styles.forcedIcon}>🔐</div>
                        <div>
                            <strong style={styles.forcedTitle}>Welcome, {username}!</strong>
                            <p style={styles.forcedMsg}>
                                {linkedClassName && `Class Teacher — ${linkedClassName} | `}
                                Your account has been created with a default password.
                                You must set a new password before continuing.
                            </p>
                        </div>
                    </div>
                )}

                {!isForced && (
                    <div style={styles.normalHeader}>
                        <h3 style={styles.title}>🔑 Change Password</h3>
                        <p style={styles.subtitle}>Logged in as <strong>{username}</strong> ({role})</p>
                    </div>
                )}

                {error && <p style={styles.error}>{error}</p>}
                {success && <p style={styles.successMsg}>{success}</p>}

                <form onSubmit={handleSubmit}>
                    {/* Current Password */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            {isForced ? '🔑 Default Password (your phone number)' : '🔑 Current Password'}
                        </label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                style={styles.input}
                                placeholder={isForced ? 'Enter your phone number' : 'Enter current password'}
                                required
                            />
                            <button type="button" style={styles.eyeBtn}
                                onClick={() => setShowCurrent(!showCurrent)}>
                                {showCurrent ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {isForced && (
                            <p style={styles.hint}>Your default password is your phone number e.g. 0712345678</p>
                        )}
                    </div>

                    {/* New Password */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>🔒 New Password</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                style={styles.input}
                                placeholder="Enter new password"
                                required
                            />
                            <button type="button" style={styles.eyeBtn}
                                onClick={() => setShowNew(!showNew)}>
                                {showNew ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {/* Strength Meter */}
                        {newPassword && (
                            <div style={styles.strengthMeter}>
                                <div style={styles.strengthBarOuter}>
                                    {[1,2,3,4].map(i => (
                                        <div key={i} style={{
                                            ...styles.strengthBarSegment,
                                            backgroundColor: i <= strength.score ? strength.color : '#e9ecef'
                                        }} />
                                    ))}
                                </div>
                                <span style={{ ...styles.strengthLabel, color: strength.color }}>
                                    {strength.label}
                                </span>
                            </div>
                        )}
                        <div style={styles.requirements}>
                            <span style={{ color: newPassword.length >= 8 ? '#28a745' : '#ccc' }}>✓ Min 8 characters</span>
                            <span style={{ color: /[A-Z]/.test(newPassword) ? '#28a745' : '#ccc' }}>✓ Uppercase letter</span>
                            <span style={{ color: /[0-9]/.test(newPassword) ? '#28a745' : '#ccc' }}>✓ Number</span>
                            <span style={{ color: /[^A-Za-z0-9]/.test(newPassword) ? '#28a745' : '#ccc' }}>✓ Special character</span>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>🔒 Confirm New Password</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={{
                                    ...styles.input,
                                    borderColor: confirmPassword
                                        ? confirmPassword === newPassword ? '#28a745' : '#dc3545'
                                        : '#ddd'
                                }}
                                placeholder="Confirm new password"
                                required
                            />
                            <button type="button" style={styles.eyeBtn}
                                onClick={() => setShowConfirm(!showConfirm)}>
                                {showConfirm ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p style={{ color: '#dc3545', fontSize: '12px', margin: '5px 0 0 0' }}>
                                Passwords do not match
                            </p>
                        )}
                        {confirmPassword && confirmPassword === newPassword && (
                            <p style={{ color: '#28a745', fontSize: '12px', margin: '5px 0 0 0' }}>
                                ✅ Passwords match
                            </p>
                        )}
                    </div>

                    <button type="submit" style={styles.submitBtn} disabled={loading}>
                        {loading ? '⏳ Changing password...' : '🔐 Change Password'}
                    </button>

                    {!isForced && (
                        <button type="button"
                            onClick={() => window.location.href = '/dashboard'}
                            style={styles.cancelBtn}>
                            ← Back to Dashboard
                        </button>
                    )}
                </form>

                <p style={styles.footer}>
                    © {new Date().getFullYear()} Pipeline Adventist School
                </p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f0f2f5',
        padding: '20px'
    },
    card: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        width: '100%',
        maxWidth: '460px'
    },
    logoRow: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px' },
    logo: { width: '60px', height: '60px', objectFit: 'contain' },
    schoolName: { textAlign: 'center', color: '#1F3864', fontSize: '15px', margin: '0 0 15px 0' },

    // Forced change banner
    forcedBanner: {
        backgroundColor: '#e3f2fd',
        border: '2px solid #2E75B6',
        borderRadius: '10px',
        padding: '15px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    forcedIcon: { fontSize: '28px', flexShrink: 0 },
    forcedTitle: { color: '#1F3864', fontSize: '15px', display: 'block', marginBottom: '4px' },
    forcedMsg: { color: '#555', fontSize: '13px', margin: 0, lineHeight: '1.5' },

    normalHeader: { marginBottom: '20px', textAlign: 'center' },
    title: { color: '#1F3864', margin: '0 0 5px 0' },
    subtitle: { color: '#666', fontSize: '13px', margin: 0 },

    error: {
        color: 'red', padding: '10px', backgroundColor: '#fff3f3',
        borderRadius: '5px', marginBottom: '15px', fontSize: '13px'
    },
    successMsg: {
        color: '#155724', padding: '10px', backgroundColor: '#d4edda',
        borderRadius: '5px', marginBottom: '15px', fontSize: '13px', textAlign: 'center'
    },

    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    inputWrapper: { position: 'relative' },
    input: {
        width: '100%', padding: '12px 45px 12px 12px',
        borderRadius: '5px', border: '2px solid #ddd',
        fontSize: '14px', boxSizing: 'border-box', outline: 'none'
    },
    eyeBtn: {
        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0'
    },
    hint: { color: '#888', fontSize: '11px', margin: '5px 0 0 0', fontStyle: 'italic' },

    strengthMeter: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' },
    strengthBarOuter: { display: 'flex', gap: '4px', flex: 1 },
    strengthBarSegment: { height: '5px', flex: 1, borderRadius: '3px', transition: 'background-color 0.3s' },
    strengthLabel: { fontSize: '12px', fontWeight: 'bold', minWidth: '50px' },

    requirements: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', fontSize: '11px' },

    submitBtn: {
        width: '100%', padding: '13px', backgroundColor: '#1F3864',
        color: 'white', border: 'none', borderRadius: '5px',
        fontSize: '15px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px'
    },
    cancelBtn: {
        width: '100%', padding: '10px', backgroundColor: 'transparent',
        color: '#666', border: '1px solid #ddd', borderRadius: '5px',
        fontSize: '14px', cursor: 'pointer'
    },
    footer: { textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '20px', marginBottom: 0 }
};

export default ChangePassword;