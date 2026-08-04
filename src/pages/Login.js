import React, { useState } from 'react';
import axios from 'axios';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import LoadingScreen from './LoadingScreen';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
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
                { username, password },
                { timeout: 90000 }
            );

            clearTimeout(wakeupTimer);
            setWakingUp(false);

            const data = response.data;
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
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
            } else if (err.response?.status === 401 || err.response?.status === 400) {
                setError('Invalid username or password');
            } else {
                setError('Unable to connect to server. Please try again in a moment.');
            }
        }
    };

    if (wakingUp) {
        return <LoadingScreen message="Connecting to server" />;
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.leftPanel}>
                    <div style={styles.logoBadge}>
                        <img src={logo1} alt="Pipeline Adventist School" style={styles.logo} />
                    </div>
                    <h1 style={styles.schoolName}>Pipeline Adventist School</h1>
                    <p style={styles.motto}>Abreast with the Best in Holistic Education</p>
                    <div style={styles.leftFooter}>
                        Exam Management System
                    </div>
                </div>

                <div style={styles.rightPanel}>
                    <h2 style={styles.formTitle}>Welcome back</h2>
                    <p style={styles.formSubtitle}>Sign in to continue to your dashboard</p>

                    {error && <p style={styles.error}>{error}</p>}

                    <form onSubmit={handleLogin}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Username</label>
                            <input type="text" value={username}
                                onChange={e => setUsername(e.target.value)}
                                style={styles.input} placeholder="Enter your username" required
                                onFocus={e => e.target.style.borderColor = '#1F3864'}
                                onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Password</label>
                            <input type="password" value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={styles.input} placeholder="Enter your password" required
                                onFocus={e => e.target.style.borderColor = '#1F3864'}
                                onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
                        </div>
                        <button type="submit" style={styles.button} disabled={loading}>
                            {loading ? 'Connecting…' : 'Sign in →'}
                        </button>
                    </form>

                    {loading && !wakingUp && (
                        <p style={styles.loadingHint}>Connecting to server, please wait…</p>
                    )}

                    <p style={styles.footer}>
                        © {new Date().getFullYear()} Pipeline Adventist School
                    </p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px'
    },
    card: {
        display: 'flex', width: '100%', maxWidth: '860px',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        backgroundColor: 'white'
    },
    leftPanel: {
        flex: '1 1 45%', backgroundColor: '#1F3864',
        padding: '48px 36px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center'
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
        fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase'
    },
    rightPanel: {
        flex: '1 1 55%', padding: '48px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
    },
    formTitle: { color: '#1F3864', fontSize: '24px', fontWeight: 500, margin: '0 0 6px 0' },
    formSubtitle: { color: '#666', fontSize: '14px', margin: '0 0 24px 0' },
    error: {
        color: '#dc3545', padding: '10px 14px', backgroundColor: '#fff3f3',
        borderRadius: '8px', fontSize: '14px', marginBottom: '18px'
    },
    formGroup: { marginBottom: '18px' },
    label: {
        display: 'block', marginBottom: '6px', fontWeight: 500,
        color: '#333', fontSize: '13px'
    },
    input: {
        width: '100%', padding: '12px 14px', borderRadius: '8px',
        border: '1.5px solid #e0e0e0', fontSize: '14px',
        boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
        transition: 'border-color 0.15s'
    },
    button: {
        width: '100%', padding: '13px', backgroundColor: '#1F3864',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '15px', cursor: 'pointer', fontWeight: 500,
        marginTop: '8px', fontFamily: 'inherit'
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