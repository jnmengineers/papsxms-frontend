import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logo1 from '../assets/logo1.png';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

function ChangePassword() {
    const navigate = useNavigate();
    const { toast, showToast, hideToast } = useToast();
    const username = localStorage.getItem('username');
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const getPasswordStrength = (password) => {
        if (!password) return { strength: 0, label: '', color: '#ddd' };
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        const levels = [
            { strength: 0, label: '', color: '#ddd' },
            { strength: 25, label: 'Weak', color: '#dc3545' },
            { strength: 50, label: 'Fair', color: '#ffc107' },
            { strength: 75, label: 'Good', color: '#2E75B6' },
            { strength: 100, label: 'Strong', color: '#28a745' }
        ];
        return levels[score];
    };

    const strength = getPasswordStrength(formData.newPassword);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }
        if (formData.newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        setLoading(true);
        try {
            await api.post('/api/auth/change-password', {
                username,
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            });
            showToast('Password changed successfully! Please login again.', 'success');
            setTimeout(() => {
                localStorage.clear();
                navigate('/');
            }, 2500);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to change password. Check current password.', 'error');
        }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            <div style={styles.navbar}>
                <div style={styles.navLeft}>
                    <img src={logo1} alt="Logo" style={styles.navLogo} />
                    <h2 style={styles.navTitle}>Pipeline Adventist School</h2>
                </div>
                <div style={styles.navRight}>
                    <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>← Dashboard</button>
                    <button onClick={() => { localStorage.clear(); navigate('/'); }} style={styles.logoutBtn}>Logout</button>
                </div>
            </div>

            <div style={styles.content}>
                <div style={styles.formWrapper}>
                    <div style={styles.formCard}>
                        <div style={styles.formHeader}>
                            <div style={styles.lockIcon}>🔐</div>
                            <h2 style={styles.formTitle}>Change Password</h2>
                            <p style={styles.formSubtitle}>
                                Logged in as <strong>{username}</strong>
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Current Password */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Current Password</label>
                                <div style={styles.inputWrapper}>
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        style={styles.input}
                                        value={formData.currentPassword}
                                        onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                                        placeholder="Enter current password"
                                        required
                                    />
                                    <button type="button" style={styles.eyeBtn}
                                        onClick={() => setShowCurrent(!showCurrent)}>
                                        {showCurrent ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>New Password</label>
                                <div style={styles.inputWrapper}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        style={styles.input}
                                        value={formData.newPassword}
                                        onChange={e => setFormData({...formData, newPassword: e.target.value})}
                                        placeholder="Enter new password"
                                        required
                                    />
                                    <button type="button" style={styles.eyeBtn}
                                        onClick={() => setShowNew(!showNew)}>
                                        {showNew ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                {/* Password Strength */}
                                {formData.newPassword && (
                                    <div style={styles.strengthWrapper}>
                                        <div style={styles.strengthBar}>
                                            <div style={{...styles.strengthFill, width: `${strength.strength}%`, backgroundColor: strength.color}} />
                                        </div>
                                        <span style={{...styles.strengthLabel, color: strength.color}}>{strength.label}</span>
                                    </div>
                                )}
                                <div style={styles.hints}>
                                    <span style={{color: formData.newPassword.length >= 8 ? '#28a745' : '#999'}}>✓ 8+ characters</span>
                                    <span style={{color: /[A-Z]/.test(formData.newPassword) ? '#28a745' : '#999'}}>✓ Uppercase</span>
                                    <span style={{color: /[0-9]/.test(formData.newPassword) ? '#28a745' : '#999'}}>✓ Number</span>
                                    <span style={{color: /[^A-Za-z0-9]/.test(formData.newPassword) ? '#28a745' : '#999'}}>✓ Symbol</span>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Confirm New Password</label>
                                <div style={styles.inputWrapper}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        style={{
                                            ...styles.input,
                                            borderColor: formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? '#dc3545' : '#ddd'
                                        }}
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                        placeholder="Confirm new password"
                                        required
                                    />
                                    <button type="button" style={styles.eyeBtn}
                                        onClick={() => setShowConfirm(!showConfirm)}>
                                        {showConfirm ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                                    <p style={styles.matchError}>Passwords do not match</p>
                                )}
                                {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                                    <p style={styles.matchSuccess}>✅ Passwords match</p>
                                )}
                            </div>

                            <button type="submit" style={styles.submitBtn} disabled={loading}>
                                {loading ? '⏳ Changing Password...' : '🔐 Change Password'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    navbar: { backgroundColor: '#1F3864', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    navLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    navLogo: { width: '45px', height: '45px', objectFit: 'contain' },
    navTitle: { color: 'white', margin: 0, fontSize: '18px' },
    navRight: { display: 'flex', gap: '10px' },
    navBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    logoutBtn: { backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer' },
    content: { padding: '40px', display: 'flex', justifyContent: 'center' },
    formWrapper: { width: '100%', maxWidth: '480px' },
    formCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' },
    formHeader: { backgroundColor: '#1F3864', padding: '30px', textAlign: 'center' },
    lockIcon: { fontSize: '48px', marginBottom: '10px' },
    formTitle: { color: 'white', margin: '0 0 8px 0', fontSize: '22px' },
    formSubtitle: { color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '14px' },
    formGroup: { padding: '0 25px 20px 25px', paddingTop: '20px' },
    label: { display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#1F3864', fontSize: '13px' },
    inputWrapper: { position: 'relative' },
    input: { width: '100%', padding: '12px 45px 12px 12px', borderRadius: '5px', border: '2px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
    eyeBtn: { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' },
    strengthWrapper: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' },
    strengthBar: { flex: 1, height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' },
    strengthFill: { height: '100%', borderRadius: '3px', transition: 'all 0.3s' },
    strengthLabel: { fontSize: '12px', fontWeight: 'bold', minWidth: '50px' },
    hints: { display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' },
    matchError: { color: '#dc3545', fontSize: '12px', margin: '5px 0 0 0' },
    matchSuccess: { color: '#28a745', fontSize: '12px', margin: '5px 0 0 0' },
    submitBtn: { width: 'calc(100% - 50px)', margin: '5px 25px 25px 25px', padding: '13px', backgroundColor: '#1F3864', color: 'white', border: 'none', borderRadius: '5px', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }
};

export default ChangePassword;
